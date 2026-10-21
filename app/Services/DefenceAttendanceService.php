<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\DefenceSession;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Whether an open defence actually took place.
 *
 * Nothing in the platform can tell that a team did not turn up, so the college
 * officer records it once the defence date arrives:
 *  - held:   the panel's scores decide the result. Until then the result waits,
 *            so scores submitted for a defence that never happened can't pass or
 *            fail a proposal on their own.
 *  - absent: the team did not appear. The proposal is rejected at once as having
 *            failed its defence, scores already submitted are voided (kept for the
 *            record, never counted) and the rest of the panel is stood down.
 *
 * A panel member can flag a no-show instead of scoring; the officer confirms it.
 */
class DefenceAttendanceService
{
    public const HELD = 'held';

    public const ABSENT = 'absent';

    public const PERMISSION = 'open_defence.attendance';

    private const ACTIVE_STATUSES = ['pending', 'accepted', 'in_progress'];

    public function __construct(
        private readonly WorkflowService $workflowService,
        private readonly ReviewScoreService $reviewScoreService,
    ) {}

    /** The open defence currently under way for a proposal, if any. */
    public function currentSession(Proposal $proposal): ?DefenceSession
    {
        return DefenceSession::where('proposal_id', $proposal->id)
            ->where('status', 'scheduled')
            ->latest()
            ->first();
    }

    /** Can this user record attendance for this defence? */
    public function canMark(?DefenceSession $session, User $user): bool
    {
        $proposal = $session?->proposal;

        return $proposal
            && $user->can(self::PERMISSION)
            && $user->accessScope()->covers($proposal->college_id, $proposal->category);
    }

    /** Null when attendance can be recorded now, otherwise why not. */
    public function markError(?DefenceSession $session): ?string
    {
        return match (true) {
            ! $session || $session->proposal?->status !== 'under_open_defence' => 'This proposal has no open defence under way.',
            $session->attendance !== null => 'Attendance for this defence has already been recorded.',
            now()->lt($session->scoringOpensAt()) => 'Attendance can be recorded from the defence date, '.$session->scoringOpensAt()->format('M d, Y').'.',
            default => null,
        };
    }

    /** The defence took place: let the panel's scores decide the result. */
    public function markHeld(DefenceSession $session, User $actor, ?string $note = null): DefenceSession
    {
        $session->update([
            'attendance' => self::HELD,
            'attendance_note' => $note,
            'attendance_marked_by' => $actor->id,
            'attendance_marked_at' => now(),
        ]);

        AuditLogger::log('defence.attendance_held', DefenceSession::class, $session->id, $actor->id, null, [
            'proposal_id' => $session->proposal_id,
            'note' => $note,
        ]);

        // Every score may already be in — decide it now.
        $this->reviewScoreService->processOpenDefenceResultIfComplete($session->proposal->fresh());

        return $session->fresh();
    }

    /**
     * The team did not appear: void submitted scores, stand the rest of the panel
     * down and reject the proposal as having failed its defence.
     */
    public function markAbsent(DefenceSession $session, User $actor, string $note): Proposal
    {
        $proposal = $session->proposal;
        $date = $session->scheduled_date->format('M d, Y');
        $reason = "The proposal team did not appear for the open defence scheduled on {$date}, so the proposal could not be defended. Recorded by {$actor->name}: {$note}";

        $assignments = ReviewAssignment::with('reviewer')
            ->where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
            ->whereIn('status', ['submitted', ...self::ACTIVE_STATUSES])
            ->get();
        $voided = $assignments->where('status', 'submitted');
        $cancelled = $assignments->whereIn('status', self::ACTIVE_STATUSES);

        $systemActor = User::role('central_officer')->first() ?? User::role('super_admin')->first() ?? $actor;

        DB::transaction(function () use ($session, $proposal, $actor, $note, $reason, $voided, $cancelled, $systemActor) {
            $session->update([
                'attendance' => self::ABSENT,
                'attendance_note' => $note,
                'attendance_marked_by' => $actor->id,
                'attendance_marked_at' => now(),
                'status' => 'no_show',
            ]);

            if ($voided->isNotEmpty()) {
                ReviewAssignment::whereIn('id', $voided->pluck('id'))->update(['status' => 'voided', 'updated_at' => now()]);
            }
            if ($cancelled->isNotEmpty()) {
                ReviewAssignment::whereIn('id', $cancelled->pluck('id'))->update(['status' => 'cancelled', 'updated_at' => now()]);
            }

            DB::table('proposals')->where('id', $proposal->id)->update(['rejection_reason' => $reason, 'rejected_at' => now()]);

            // An automatic consequence of the recorded no-show, shown as "System" in the history.
            $this->workflowService->transition($proposal->fresh(), 'fail_defence', $systemActor, $reason, [
                'automatic' => true,
                'no_show' => true,
                'defence_session_id' => $session->id,
                'recorded_by' => $actor->id,
                'voided_scores' => $voided->count(),
            ]);
        });

        AuditLogger::log('defence.attendance_absent', DefenceSession::class, $session->id, $actor->id, null, [
            'proposal_id' => $proposal->id,
            'note' => $note,
            'voided_scores' => $voided->pluck('id')->all(),
            'cancelled_assignments' => $cancelled->pluck('id')->all(),
        ]);

        $data = ['proposal_id' => $proposal->id, 'tracker_number' => $proposal->tracker_number, 'title' => $proposal->title];
        foreach ($cancelled as $assignment) {
            $this->notify($assignment->reviewer, 'review_assignment_cancelled', $data);
        }
        foreach ($voided as $assignment) {
            $this->notify($assignment->reviewer, 'defence_score_voided', $data + [
                'message' => "The team did not appear for the open defence of {$proposal->tracker_number} on {$session->scheduled_date->format('M d, Y')}. The proposal was rejected and the score you submitted no longer counts. No further action is needed.",
            ]);
        }

        return $proposal->fresh();
    }

    /** A panel member says the team did not appear; the college officer is asked to confirm. */
    public function reportAbsence(DefenceSession $session, ReviewAssignment $assignment, User $reviewer, ?string $note): DefenceSession
    {
        $session->update([
            'absence_reported_by' => $reviewer->id,
            'absence_reported_at' => now(),
            'absence_report_note' => $note,
        ]);

        $proposal = $session->proposal;
        foreach ($this->collegeOfficers($proposal) as $officer) {
            $this->notify($officer, 'defence_absence_reported', [
                'proposal_id' => $proposal->id,
                'tracker_number' => $proposal->tracker_number,
                'title' => $proposal->title,
                'message' => "A panel member reported that the team did not appear for the open defence of {$proposal->tracker_number}"
                    .($note ? " — \"{$note}\"" : '').'. Open the Open Defence page to confirm the defence was held or record that the team did not appear.',
            ]);
        }

        AuditLogger::log('defence.absence_reported', DefenceSession::class, $session->id, $reviewer->id, null, [
            'assignment_id' => $assignment->id,
            'note' => $note,
        ]);

        return $session->fresh();
    }

    /**
     * Every panel score is in but nobody has said the defence took place: ask the
     * college officer once to record it, so the result can be decided.
     */
    public function requestAttendance(DefenceSession $session): void
    {
        if ($session->attendance !== null || $session->attendance_requested_at) {
            return;
        }

        $session->update(['attendance_requested_at' => now()]);
        $proposal = $session->proposal;

        foreach ($this->collegeOfficers($proposal) as $officer) {
            $this->notify($officer, 'defence_attendance_needed', [
                'proposal_id' => $proposal->id,
                'tracker_number' => $proposal->tracker_number,
                'title' => $proposal->title,
                'message' => "Every panel score for the open defence of {$proposal->tracker_number} is in. Confirm on the Open Defence page that the defence was held — or record that the team did not appear — so the result can be decided.",
            ]);
        }
    }

    /** @return Collection<int, User> */
    private function collegeOfficers(Proposal $proposal): Collection
    {
        return User::whoCan(self::PERMISSION, $proposal->college_id, $proposal->category)
            ->filter(fn (User $user) => $user->accessScope()->isCollege())
            ->values();
    }

    private function notify(?User $user, string $event, array $data): void
    {
        if (! $user) {
            return;
        }

        try {
            StoreInAppNotificationJob::dispatchSync($user->id, $event, $data);
        } catch (\Throwable $e) {
            Log::error("Failed to store in-app notification [{$event}]: ".$e->getMessage());
        }

        try {
            SendEmailNotificationJob::deliver($user, $event, $data);
        } catch (\Throwable $e) {
            Log::error("Failed to send email notification [{$event}]: ".$e->getMessage());
        }
    }
}
