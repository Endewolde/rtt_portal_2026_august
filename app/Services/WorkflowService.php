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

        // Step 3: Check actor role
        $allowedRoles = is_array($transition->allowed_roles)
            ? $transition->allowed_roles
            : json_decode($transition->allowed_roles, true);

        $actorRoles = $actor->getRoleNames()->toArray();

        if (empty(array_intersect($actorRoles, $allowedRoles))) {
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
     * Get all valid next actions for this proposal given this actor.
     */
    public function availableActions(Proposal $proposal, User $actor): Collection
    {
        $actorRoles = $actor->getRoleNames()->toArray();

        return WorkflowTransition::with(['action', 'toStage'])
            ->whereHas('fromStage', fn ($q) => $q->where('name', $proposal->status))
            ->get()
            ->filter(function ($transition) use ($actorRoles) {
                $allowed = is_array($transition->allowed_roles)
                    ? $transition->allowed_roles
                    : json_decode($transition->allowed_roles, true);

                return count(array_intersect($actorRoles, $allowed)) > 0;
            })
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

            $allowed = is_array($transition->allowed_roles)
                ? $transition->allowed_roles
                : json_decode($transition->allowed_roles, true);

            return count(array_intersect(
                $actor->getRoleNames()->toArray(),
                $allowed
            )) > 0;
        } catch (\Exception) {
            return false;
        }
    }
}
