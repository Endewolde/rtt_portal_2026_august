<?php

namespace App\Services;

use App\Exceptions\DefenceDeadlineException;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\DefenceDeadlineExtension;
use App\Models\DefenceSession;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Open defence score deadlines: each session's scores are due by the end of the day
 * after the defence. A college officer can request a later date for one proposal;
 * that proposal's category director, or the central office, approves it.
 */
class DefenceDeadlineService
{
    /** May approve any proposal's extension. */
    public const CENTRAL_ROLES = ['super_admin', 'admin', 'central_officer'];

    /** Category director role for each proposal category. */
    public const DIRECTOR_ROLE_FOR_CATEGORY = [
        'research' => 'research_officer',
        'community_engagement' => 'community_officer',
        'technology_transfer' => 'technology_officer',
    ];

    private const REMINDER_HOURS_BEFORE_DEADLINE = 24;

    private const DATE_FORMAT = 'D, M j, Y g:i A';

    /**
     * @throws DefenceDeadlineException
     */
    public function requestExtension(DefenceSession $session, User $actor, Carbon $requestedUntil, string $reason): DefenceDeadlineExtension
    {
        $proposal = $session->proposal;

        if (! $actor->hasRole('college_officer') || ! $proposal || $actor->college_id !== $proposal->college_id) {
            throw new DefenceDeadlineException('Only the college officer of this proposal\'s college can request a score deadline extension.', 403);
        }

        if ($session->status !== 'scheduled') {
            throw new DefenceDeadlineException('This defence session is no longer active, so its deadline cannot be extended.');
        }

        if ($requestedUntil->lte(now()) || $requestedUntil->lte($session->scoreDeadline())) {
            throw new DefenceDeadlineException(
                'The new deadline must be in the future and later than the current deadline ('.$session->scoreDeadline()->format(self::DATE_FORMAT).').'
            );
        }

        if ($session->deadlineExtensions()->where('status', 'pending')->exists()) {
            throw new DefenceDeadlineException('An extension request for this defence is already awaiting approval.');
        }

        $extension = DefenceDeadlineExtension::create([
            'defence_session_id' => $session->id,
            'proposal_id' => $proposal->id,
            'requested_by' => $actor->id,
            'requested_until' => $requestedUntil,
            'reason' => $reason,
            'status' => 'pending',
        ]);

        AuditLogger::log('defence_deadline.extension_requested', DefenceDeadlineExtension::class, $extension->id, $actor->id, null, [
            'proposal' => $proposal->tracker_number,
            'current_deadline' => $session->scoreDeadline()->toDateTimeString(),
            'requested_until' => $requestedUntil->toDateTimeString(),
            'reason' => $reason,
        ]);

        $data = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'requested_until' => $requestedUntil->toIso8601String(),
            'message' => "{$actor->name} requested to extend the open defence score deadline for {$proposal->tracker_number} "
                ."to {$requestedUntil->format(self::DATE_FORMAT)}. Reason: {$reason}",
        ];
        foreach ($this->approversFor($proposal) as $approver) {
            $this->notify($approver, 'defence_extension_requested', $data);
        }

        return $extension;
    }

    /**
     * @throws DefenceDeadlineException
     */
    public function decide(DefenceDeadlineExtension $extension, User $actor, string $decision, ?Carbon $grantedUntil, string $notes): DefenceDeadlineExtension
    {
        $extension->loadMissing(['proposal', 'defenceSession', 'requestedBy']);
        $proposal = $extension->proposal;
        $session = $extension->defenceSession;

        if (! $this->canApprove($proposal, $actor)) {
            throw new DefenceDeadlineException('Only the '.$this->directorLabel($proposal).' or the central office can decide this extension request.', 403);
        }

        if ($extension->status !== 'pending') {
            throw new DefenceDeadlineException('This extension request has already been decided.');
        }

        if ($decision === 'approved') {
            $grantedUntil ??= $extension->requested_until->copy();

            if ($grantedUntil->lte(now())) {
                throw new DefenceDeadlineException('The approved deadline must be in the future.');
            }
        }

        DB::transaction(function () use ($extension, $session, $actor, $decision, $grantedUntil, $notes) {
            $extension->update([
                'status' => $decision,
                'granted_until' => $decision === 'approved' ? $grantedUntil : null,
                'decided_by' => $actor->id,
                'decision_notes' => $notes,
                'decided_at' => now(),
            ]);

            if ($decision === 'approved') {
                $session->update([
                    'score_deadline_extended_until' => $grantedUntil,
                    'deadline_reminder_sent_at' => null,
                    'flagged_incomplete_at' => null,
                ]);

                $this->outstandingDefenceAssignments($session->proposal_id)
                    ->update(['due_date' => $grantedUntil->toDateString()]);
            }
        });

        AuditLogger::log('defence_deadline.extension_'.$decision, DefenceDeadlineExtension::class, $extension->id, $actor->id, ['status' => 'pending'], [
            'status' => $decision,
            'granted_until' => $grantedUntil?->toDateTimeString(),
            'notes' => $notes,
        ]);

        $base = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'decision' => $decision,
        ];

        if ($extension->requestedBy) {
            $this->notify($extension->requestedBy, 'defence_extension_resolved', $base + [
                'message' => $decision === 'approved'
                    ? "Your extension request for {$proposal->tracker_number} was approved. Defence scores are now due by {$grantedUntil->format(self::DATE_FORMAT)}. Note: {$notes}"
                    : "Your extension request for {$proposal->tracker_number} was denied. Note: {$notes}",
            ]);
        }

        if ($decision === 'approved') {
            $reviewers = User::whereIn('id', $this->outstandingDefenceAssignments($proposal->id)->pluck('reviewer_id'))->get();
            foreach ($reviewers as $reviewer) {
                $this->notify($reviewer, 'defence_deadline_extended', $base + [
                    'deadline' => $grantedUntil->toIso8601String(),
                    'message' => "The open defence score deadline for {$proposal->tracker_number} has been extended. You can now submit your score until {$grantedUntil->format(self::DATE_FORMAT)}.",
                ]);
            }
        }

        return $extension->fresh(['requestedBy:id,name', 'decidedBy:id,name']);
    }

    /**
     * Scheduled sweep: remind reviewers on the last day, and flag (never reject)
     * defences whose deadline passed with scores still missing.
     *
     * @return array{reminded: int, flagged: int}
     */
    public function sweep(): array
    {
        $reminded = 0;
        $flagged = 0;

        $sessions = DefenceSession::with('proposal')->where('status', 'scheduled')->get();

        foreach ($sessions as $session) {
            $proposal = $session->proposal;
            if (! $proposal || $proposal->status !== 'under_open_defence') {
                continue;
            }

            $deadline = $session->scoreDeadline();
            $outstanding = $this->outstandingDefenceAssignments($proposal->id)->get();

            if ($outstanding->isEmpty()) {
                continue;
            }

            if (now()->gt($deadline)) {
                if (! $session->flagged_incomplete_at) {
                    $session->update(['flagged_incomplete_at' => now()]);
                    $this->notifyDeadlinePassed($proposal, $deadline, $outstanding->count());
                    $flagged++;
                }

                continue;
            }

            if (! $session->deadline_reminder_sent_at
                && now()->gte($session->scoringOpensAt())
                && now()->diffInHours($deadline, false) <= self::REMINDER_HOURS_BEFORE_DEADLINE) {
                foreach (User::whereIn('id', $outstanding->pluck('reviewer_id'))->get() as $reviewer) {
                    $this->notify($reviewer, 'defence_deadline_reminder', [
                        'proposal_id' => $proposal->id,
                        'tracker_number' => $proposal->tracker_number,
                        'deadline' => $deadline->toIso8601String(),
                        'message' => "Reminder: your open defence score for {$proposal->tracker_number} is due by {$deadline->format(self::DATE_FORMAT)}.",
                    ]);
                }
                $session->update(['deadline_reminder_sent_at' => now()]);
                $reminded++;
            }
        }

        return ['reminded' => $reminded, 'flagged' => $flagged];
    }

    /** That proposal's category director, or the central office. */
    public function canApprove(?Proposal $proposal, User $actor): bool
    {
        if ($actor->hasAnyRole(self::CENTRAL_ROLES)) {
            return true;
        }

        $directorRole = self::DIRECTOR_ROLE_FOR_CATEGORY[$proposal?->category] ?? null;

        return $directorRole !== null && $actor->hasRole($directorRole);
    }

    public function isApprover(User $actor): bool
    {
        return $actor->hasAnyRole([...self::CENTRAL_ROLES, ...array_values(self::DIRECTOR_ROLE_FOR_CATEGORY)]);
    }

    /**
     * Deadline details for one proposal's active defence session, as shown on the
     * Open Defence page.
     *
     * @return array<string, mixed>|null
     */
    public function present(?DefenceSession $session, ?User $viewer = null): ?array
    {
        if (! $session) {
            return null;
        }

        $session->loadMissing(['proposal:id,college_id,category', 'deadlineExtensions.requestedBy:id,name', 'deadlineExtensions.decidedBy:id,name']);
        $deadline = $session->scoreDeadline();
        $outstanding = $this->outstandingDefenceAssignments($session->proposal_id)->count();
        $panelSize = ReviewAssignment::where('proposal_id', $session->proposal_id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
            ->whereNotIn('status', ['declined', 'cancelled'])
            ->count();
        $pending = $session->deadlineExtensions->firstWhere('status', 'pending');

        $phase = match (true) {
            now()->lt($session->scoringOpensAt()) => 'upcoming',
            now()->gt($deadline) => 'passed',
            default => 'open',
        };

        return [
            'session_id' => $session->id,
            'deadline' => $deadline->toIso8601String(),
            'default_deadline' => $session->defaultScoreDeadline()->toIso8601String(),
            'is_extended' => $session->score_deadline_extended_until !== null,
            'phase' => $phase,
            'outstanding_scores' => $outstanding,
            'panel_size' => $panelSize,
            'flagged' => $session->flagged_incomplete_at !== null,
            'can_request_extension' => $viewer
                && $panelSize > 0
                && $session->status === 'scheduled'
                && ! $pending
                && $viewer->hasRole('college_officer')
                && $viewer->college_id === $session->proposal?->college_id,
            'pending_extension' => $pending ? $this->presentExtension($pending) : null,
            'extensions' => $session->deadlineExtensions->map(fn ($e) => $this->presentExtension($e))->values(),
        ];
    }

    /** @return array<string, mixed> */
    public function presentExtension(DefenceDeadlineExtension $extension): array
    {
        return [
            'id' => $extension->id,
            'status' => $extension->status,
            'requested_until' => $extension->requested_until?->toIso8601String(),
            'granted_until' => $extension->granted_until?->toIso8601String(),
            'reason' => $extension->reason,
            'decision_notes' => $extension->decision_notes,
            'requested_by' => $extension->requestedBy?->name,
            'decided_by' => $extension->decidedBy?->name,
            'created_at' => $extension->created_at?->toIso8601String(),
            'decided_at' => $extension->decided_at?->toIso8601String(),
        ];
    }

    private function notifyDeadlinePassed(Proposal $proposal, Carbon $deadline, int $missing): void
    {
        $data = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'missing_scores' => $missing,
            'message' => "The open defence score deadline for {$proposal->tracker_number} passed on {$deadline->format(self::DATE_FORMAT)} "
                ."with {$missing} score(s) still missing. You can request an extension from the Open Defence page.",
        ];

        $officers = User::role('college_officer')->where('status', 'active')->where('college_id', $proposal->college_id)->get();
        foreach ($officers as $officer) {
            $this->notify($officer, 'defence_deadline_passed', $data);
        }
    }

    /** Defence reviewer assignments for a proposal that still owe a score. */
    private function outstandingDefenceAssignments(string $proposalId)
    {
        return ReviewAssignment::where('proposal_id', $proposalId)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
            ->whereNotIn('status', ['submitted', 'declined', 'cancelled']);
    }

    /** @return Collection<int, User> */
    private function approversFor(Proposal $proposal): Collection
    {
        $approvers = User::role(self::CENTRAL_ROLES)->where('status', 'active')->get();

        $directorRole = self::DIRECTOR_ROLE_FOR_CATEGORY[$proposal->category] ?? null;
        if ($directorRole) {
            $approvers = $approvers->merge(User::role($directorRole)->where('status', 'active')->get());
        }

        return $approvers->unique('id')->values();
    }

    private function directorLabel(?Proposal $proposal): string
    {
        return match ($proposal?->category) {
            'research' => 'Research Director',
            'community_engagement' => 'Community Engagement Director',
            'technology_transfer' => 'Technology Transfer Director',
            default => 'category director',
        };
    }

    private function notify(User $user, string $event, array $data): void
    {
        try {
            StoreInAppNotificationJob::dispatchSync($user->id, $event, $data);
        } catch (\Throwable $e) {
            Log::error("Failed to store in-app notification [{$event}]: ".$e->getMessage());
        }

        if (! $user->email) {
            return;
        }

        try {
            SendEmailNotificationJob::deliver($user, $event, $data);
        } catch (\Throwable $e) {
            Log::error("Failed to send email notification [{$event}] to {$user->email}: ".$e->getMessage());
        }
    }
}
