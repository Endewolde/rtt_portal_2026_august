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
 *            failed its defence, and every open-defence assignment is removed with
 *            the scores already given, so nothing about a defence that never took
 *            place stays on a reviewer's list or counts anywhere. A full copy of
 *            what was removed is kept in the audit log.
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
     * The team did not appear: remove the panel's assignments and any scores they
     * gave, and reject the proposal as having failed its defence.
     */
    public function markAbsent(DefenceSession $session, User $actor, string $note): Proposal
    {
        $proposal = $session->proposal;
        $date = $session->scheduled_date->format('M d, Y');
        $reason = "The proposal team did not appear for the open defence scheduled on {$date}, so the proposal could not be defended. Recorded by {$actor->name}: {$note}";

        $assignments = $this->defenceAssignments($proposal);
        $scored = $assignments->where('status', 'submitted');
        $waiting = $assignments->whereIn('status', self::ACTIVE_STATUSES);

        $systemActor = User::role('central_officer')->first() ?? User::role('super_admin')->first() ?? $actor;

        DB::transaction(function () use ($session, $proposal, $actor, $note, $reason, $assignments, $scored, $systemActor) {
            $session->update([
                'attendance' => self::ABSENT,
                'attendance_note' => $note,
                'attendance_marked_by' => $actor->id,
                'attendance_marked_at' => now(),
                'status' => 'no_show',
            ]);

            $this->removeAssignments($assignments);

            DB::table('proposals')->where('id', $proposal->id)->update(['rejection_reason' => $reason, 'rejected_at' => now()]);

            // An automatic consequence of the recorded no-show, shown as "System" in the history.
            $this->workflowService->transition($proposal->fresh(), 'fail_defence', $systemActor, $reason, [
                'automatic' => true,
                'no_show' => true,
                'defence_session_id' => $session->id,
                'recorded_by' => $actor->id,
                'removed_assignments' => $assignments->count(),
                'removed_scores' => $scored->count(),
            ]);
        });

        AuditLogger::log('defence.attendance_absent', DefenceSession::class, $session->id, $actor->id, null, [
            'proposal_id' => $proposal->id,
            'note' => $note,
            'removed_assignments' => $this->snapshot($assignments),
        ]);

        $data = ['proposal_id' => $proposal->id, 'tracker_number' => $proposal->tracker_number, 'title' => $proposal->title];
        foreach ($waiting as $assignment) {
            $this->notify($assignment->reviewer, 'review_assignment_cancelled', $data);
        }
        foreach ($scored as $assignment) {
            $this->notify($assignment->reviewer, 'defence_score_voided', $data + [
                'message' => "The team did not appear for the open defence of {$proposal->tracker_number} on {$date}. The proposal was rejected, so this review has been removed from your list and the score you gave no longer counts. No further action is needed.",
            ]);
        }

        return $proposal->fresh();
    }

    /**
     * Open-defence assignments still on record for a proposal, whatever their state
     * (older no-shows left them "voided" or "cancelled").
     *
     * @return Collection<int, ReviewAssignment>
     */
    public function defenceAssignments(Proposal $proposal): Collection
    {
        return ReviewAssignment::with(['reviewer:id,name,email', 'scores.evaluationQuestion:id,question_text,max_score'])
            ->where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
            ->get();
    }

    /**
     * Delete assignments with their scores and reminders.
     *
     * @param  Collection<int, ReviewAssignment>  $assignments
     */
    public function removeAssignments(Collection $assignments): void
    {
        if ($assignments->isEmpty()) {
            return;
        }

        $ids = $assignments->pluck('id');
        DB::table('review_scores')->whereIn('review_assignment_id', $ids)->delete();
        DB::table('review_reminders')->whereIn('review_assignment_id', $ids)->delete();
        ReviewAssignment::whereIn('id', $ids)->delete();
    }

    /**
     * What was removed, in words an auditor can read later.
     *
     * @param  Collection<int, ReviewAssignment>  $assignments
     * @return list<array<string, mixed>>
     */
    public function snapshot(Collection $assignments): array
    {
        return $assignments->map(fn (ReviewAssignment $a) => [
            'assignment_id' => $a->id,
            'reviewer' => $a->reviewer?->name,
            'reviewer_email' => $a->reviewer?->email,
            'status' => $a->status,
            'submitted_at' => $a->submitted_at?->toDateTimeString(),
            'scores' => $a->scores->map(fn ($s) => [
                'question' => $s->evaluationQuestion?->question_text,
                'score' => $s->score,
                'max' => $s->evaluationQuestion?->max_score,
                'comment' => $s->comment,
            ])->values()->all(),
            'recommendation' => $a->scores->firstWhere('recommendation')?->recommendation,
        ])->values()->all();
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
