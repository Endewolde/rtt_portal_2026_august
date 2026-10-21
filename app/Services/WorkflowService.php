<?php

namespace App\Services;

use App\Events\ProposalTransitioned;
use App\Exceptions\InvalidTransitionException;
use App\Exceptions\UnauthorizedTransitionException;
use App\Exceptions\WorkflowGuardException;
use App\Models\Proposal;
use App\Models\User;
use App\Models\WorkflowTransition;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

class WorkflowService
{
    /**
     * Execute a proposal state transition.
     * This is the ONLY method permitted to change proposal.status.
     * Never write $proposal->status = anywhere else in the codebase.
     *
     * @throws InvalidTransitionException
     * @throws UnauthorizedTransitionException
     * @throws WorkflowGuardException
     */
    public function transition(
        Proposal $proposal,
        string $action,
        User $actor,
        ?string $notes = null,
        array $metadata = []
    ): Proposal {
        // Step 1: Find the transition
        $transition = WorkflowTransition::with(['fromStage', 'action', 'toStage'])
            ->whereHas('fromStage', fn ($q) => $q->where('name', $proposal->status))
            ->whereHas('action', fn ($q) => $q->where('name', $action))
            ->first();

        if (! $transition) {
            throw new InvalidTransitionException(
                "No valid transition from '{$proposal->status}' via action '{$action}'."
            );
        }

        // Step 2: Check if current stage is terminal
        if ($transition->fromStage->is_terminal) {
            throw new InvalidTransitionException(
                "Proposal is in terminal stage '{$proposal->status}' and cannot be transitioned."
            );
        }

        // Step 3: Check the actor may take this step
        $allowedRoles = $this->allowedRoles($transition);
        $actorRoles = $actor->getRoleNames()->toArray();

        if (! $this->mayTake($transition, $action, $actor, $proposal)) {
            throw new UnauthorizedTransitionException(
                'User role(s) ['.implode(',', $actorRoles)."] not authorized for action '{$action}'. Allowed: [".implode(',', $allowedRoles).'].'
            );
        }

        // Step 4: Run guard class if present
        if ($transition->guard_class) {
            $guard = app($transition->guard_class);
            if (! $guard->check($proposal, $actor)) {
                throw new WorkflowGuardException($guard->message());
            }
        }

        // Step 5: Execute inside DB transaction
        return DB::transaction(function () use ($proposal, $action, $actor, $notes, $metadata, $transition) {
            $fromStage = $proposal->status;
            $toStage = $transition->toStage->name;

            // Update proposal status — direct DB update to avoid triggering model events
            DB::table('proposals')
                ->where('id', $proposal->id)
                ->update([
                    'status' => $toStage,
                    'status_entered_at' => now(),
                    'updated_at' => now(),
                ]);

            // Step 6: Write immutable workflow_log using direct DB insert
            DB::table('workflow_logs')->insert([
                'id' => Str::uuid()->toString(),
                'proposal_id' => $proposal->id,
                'from_stage' => $fromStage,
                'action' => $action,
                'to_stage' => $toStage,
                'actor_id' => $actor->id,
                'notes' => $notes,
                'metadata' => $metadata ? json_encode($metadata) : null,
                'created_at' => now(),
            ]);

            // Step 7: Write audit_log using direct DB insert
            DB::table('audit_logs')->insert([
                'id' => Str::uuid()->toString(),
                'auditable_type' => Proposal::class,
                'auditable_id' => $proposal->id,
                'event' => 'proposal.transitioned',
                'actor_id' => $actor->id,
                'old_values' => json_encode(['status' => $fromStage]),
                'new_values' => json_encode(['status' => $toStage, 'action' => $action]),
                'ip_address' => Request::ip() ?? '127.0.0.1',
                'user_agent' => Request::userAgent() ?? '',
                'created_at' => now(),
            ]);

            // Step 8: Fire event
            $refreshed = $proposal->refresh();

            event(new ProposalTransitioned(
                $refreshed,
                $fromStage,
                $toStage,
                $action,
                $actor,
                now()
            ));

            // Step 9: Invalidate PI's dashboard cache so widget data stays fresh
            app(DashboardService::class)->invalidate($proposal->pi_user_id);

            return $refreshed;
        });
    }

    /**
     * Reopen a rejected proposal for reconsideration — sends it back to whichever
     * stage it was rejected FROM (looked up from workflow_logs), so it can be
     * re-decided with current settings/data without losing already-submitted review
     * scores or forcing the PI to restart (unlike an Appeal, which always returns to
     * draft). Used when a rejection is later found to have been decided under
     * thresholds/settings that have since changed.
     *
     * Bypasses the WorkflowTransition table (its single from-stage -> single to-stage
     * shape can't express "wherever it came from"), but — per the rule at the top of
     * this class — this remains the only method allowed to touch proposal.status.
     *
     * @throws InvalidTransitionException if the proposal isn't currently rejected, or
     *                                    its rejection origin can't be determined
     */
    public function reopenRejectedProposal(Proposal $proposal, User $actor, string $reason): Proposal
    {
        if ($proposal->status !== 'rejected') {
            throw new InvalidTransitionException(
                "Proposal is not currently rejected. Current status: '{$proposal->status}'."
            );
        }

        $lastRejection = DB::table('workflow_logs')
            ->where('proposal_id', $proposal->id)
            ->where('to_stage', 'rejected')
            ->orderByDesc('created_at')
            ->first();

        if (! $lastRejection || ! $lastRejection->from_stage) {
            throw new InvalidTransitionException(
                'Could not determine which stage this proposal was rejected from — cannot reopen safely.'
            );
        }

        return $this->leaveRejectedStage($proposal, $lastRejection->from_stage, $actor, $reason, notify: true);
    }

    /**
     * Used only by ReviewScoreService::recalculateAllDecisions for the fully-automatic
     * correction path: bypasses 'rejected' straight to a KNOWN target stage (the pair's
     * pre-decision stage — under_blind_review or under_open_defence — not looked up from
     * history, since the caller already knows exactly which decision is being redone).
     * Fires no notification: the immediately-following pass_blind_review/pass_defence
     * transition (a normal transition() call) sends the real, accurate "you passed"
     * notice — sending one here too would just double the email for no reason.
     */
    public function bypassRejectedStageSilently(Proposal $proposal, string $toStage, User $actor, string $reason): Proposal
    {
        if ($proposal->status !== 'rejected') {
            throw new InvalidTransitionException(
                "Proposal is not currently rejected. Current status: '{$proposal->status}'."
            );
        }

        return $this->leaveRejectedStage($proposal, $toStage, $actor, $reason, notify: false);
    }

    private function leaveRejectedStage(Proposal $proposal, string $toStage, User $actor, string $reason, bool $notify): Proposal
    {
        return DB::transaction(function () use ($proposal, $actor, $reason, $toStage, $notify) {
            DB::table('proposals')
                ->where('id', $proposal->id)
                ->update([
                    'status' => $toStage,
                    'status_entered_at' => now(),
                    'updated_at' => now(),
                ]);

            DB::table('workflow_logs')->insert([
                'id' => Str::uuid()->toString(),
                'proposal_id' => $proposal->id,
                'from_stage' => 'rejected',
                'action' => 'reopen',
                'to_stage' => $toStage,
                'actor_id' => $actor->id,
                'notes' => $reason,
                // notify=false only ever comes from the fully-automatic recalculation
                // path (bypassRejectedStageSilently) — the manual "Reopen for
                // Reconsideration" button always notifies, so this distinguishes them
                // for the workflow-history display without a separate parameter.
                'metadata' => $notify ? null : json_encode(['automatic' => true]),
                'created_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'id' => Str::uuid()->toString(),
                'auditable_type' => Proposal::class,
                'auditable_id' => $proposal->id,
                'event' => 'proposal.reopened',
                'actor_id' => $actor->id,
                'old_values' => json_encode(['status' => 'rejected']),
                'new_values' => json_encode(['status' => $toStage, 'action' => 'reopen']),
                'ip_address' => Request::ip() ?? '127.0.0.1',
                'user_agent' => Request::userAgent() ?? '',
                'created_at' => now(),
            ]);

            $refreshed = $proposal->refresh();

            if ($notify) {
                event(new ProposalTransitioned($refreshed, 'rejected', $toStage, 'reopen', $actor, now()));
            }

            app(DashboardService::class)->invalidate($proposal->pi_user_id);

            return $refreshed;
        });
    }

    /**
     * Get all valid next actions for this proposal given this actor.
     */
    public function availableActions(Proposal $proposal, User $actor): Collection
    {
        return WorkflowTransition::with(['action', 'toStage'])
            ->whereHas('fromStage', fn ($q) => $q->where('name', $proposal->status))
            ->get()
            ->filter(fn ($transition) => $this->mayTake($transition, $transition->action?->name, $actor, $proposal))
            ->values();
    }

    /**
     * Check if a transition is valid without executing it.
     */
    public function canTransition(Proposal $proposal, string $action, User $actor): bool
    {
        try {
            $transition = WorkflowTransition::whereHas('fromStage', fn ($q) => $q->where('name', $proposal->status))
                ->whereHas('action', fn ($q) => $q->where('name', $action))
                ->first();

            if (! $transition) {
                return false;
            }

            return $this->mayTake($transition, $action, $actor, $proposal);
        } catch (\Exception) {
            return false;
        }
    }

    /**
     * The permission that lets a role take each workflow step, besides the roles
     * listed on the transition itself. Ticking it on a role (built-in or custom)
     * on the Roles page is enough.
     */
    public const ACTION_PERMISSIONS = [
        'submit' => 'proposals.submit',
        'validate' => 'proposals.validate',
        'return_for_correction' => 'proposals.validate',
        'reject' => 'proposals.validate',
        'assign_for_review' => 'reviews.manage',
        'unassign_reviewers' => 'reviews.manage',
        'schedule_defence' => 'reviews.manage',
        'return_for_investigation' => 'approval_reports.file',
        'withdraw_report_resume_review' => 'approval_reports.file',
        'withdraw_report_restore_passed' => 'approval_reports.file',
        'reopen' => 'proposals.reopen',
        'pass_blind_review' => 'review_decisions.correct',
        'fail_blind_review' => 'review_decisions.correct',
        'pass_defence' => 'review_decisions.correct',
        'fail_defence' => 'review_decisions.correct',
        'accept' => 'evaluation.central',
        'central_approve' => 'evaluation.central',
        'central_reject' => 'evaluation.central',
        'fund' => 'evaluation.central',
        'revoke_funding' => 'funding.revoke',
        'start_midterm' => 'midterm_evaluations.create',
        'complete' => 'completion_workshops.create',
        'archive' => 'monitoring.archive',
    ];

    /** @return list<string> */
    private function allowedRoles(WorkflowTransition $transition): array
    {
        return is_array($transition->allowed_roles)
            ? $transition->allowed_roles
            : (json_decode($transition->allowed_roles ?? '[]', true) ?: []);
    }

    /**
     * A user may take a step if one of their roles is listed on the transition, or
     * they hold the step's permission and the proposal is within their data scope
     * (submitting needs no scope — only the proposal's own team can reach it).
     */
    private function mayTake(WorkflowTransition $transition, ?string $action, User $actor, Proposal $proposal): bool
    {
        if (array_intersect($actor->getRoleNames()->toArray(), $this->allowedRoles($transition)) !== []) {
            return true;
        }

        $permission = self::ACTION_PERMISSIONS[$action] ?? null;
        if (! $permission || ! $actor->can($permission)) {
            return false;
        }

        return $action === 'submit' || $actor->accessScope()->covers($proposal->college_id, $proposal->category);
    }
}
