<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Award;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Moving a proposal straight to funded (ongoing) outside the normal
 * submit -> review -> award workflow: legacy grants on Ongoing Proposals, and a
 * director confirming a mistaken-approval report that the project is already running.
 *
 * WorkflowService transitions are strictly one-hop and can't jump an arbitrary
 * status to "funded", so this does its own workflow_logs and audit_logs bookkeeping.
 * The workflow step is always recorded as 'grant_legacy', so these projects stay out
 * of review-phase statistics.
 */
class LegacyGrantService
{
    public const ONGOING_STATUSES = ['funded', 'midterm_evaluation', 'completed'];

    private const ACTIVE_REVIEW_STATUSES = ['pending', 'accepted', 'in_progress'];

    public function __construct(private readonly AwardService $awardService) {}

    /** Null when the proposal can be granted, otherwise the reason it can't. */
    public function eligibilityError(Proposal $proposal): ?string
    {
        if (in_array($proposal->status, [...self::ONGOING_STATUSES, 'archived'], true)) {
            return 'This proposal is already funded, ongoing, or archived.';
        }

        if ($proposal->award) {
            return 'This proposal already has an award record.';
        }

        return null;
    }

    /**
     * Mark the proposal funded, log it, create its award, and cancel any review still
     * assigned to it — there is nothing left to review on a running project.
     *
     * @param  array<string, mixed>  $metadata  Extra context for the workflow log.
     */
    public function grant(
        Proposal $proposal,
        User $user,
        string $justification,
        float $amount,
        ?string $grantReference = null,
        ?Carbon $approvedAt = null,
        array $metadata = ['source' => 'ongoing_proposals_legacy_grant'],
    ): Award {
        $cancelled = collect();

        $award = DB::transaction(function () use ($proposal, $user, $justification, $amount, $grantReference, $approvedAt, $metadata, &$cancelled) {
            $fromStage = $proposal->status;

            DB::table('proposals')->where('id', $proposal->id)->update([
                'status' => 'funded',
                'updated_at' => now(),
            ]);

            DB::table('workflow_logs')->insert([
                'id' => (string) Str::uuid(),
                'proposal_id' => $proposal->id,
                'from_stage' => $fromStage,
                'action' => 'grant_legacy',
                'to_stage' => 'funded',
                'actor_id' => $user->id,
                'notes' => $justification,
                'metadata' => json_encode(['override' => true, ...$metadata]),
                'created_at' => now(),
            ]);

            AuditLogger::log(
                'proposal.grant_legacy',
                Proposal::class,
                $proposal->id,
                $user->id,
                ['status' => $fromStage],
                ['status' => 'funded', 'awarded_amount' => $amount, 'justification' => $justification, ...$metadata],
            );

            $cancelled = ReviewAssignment::with('reviewer')
                ->where('proposal_id', $proposal->id)
                ->whereIn('status', self::ACTIVE_REVIEW_STATUSES)
                ->get();
            if ($cancelled->isNotEmpty()) {
                ReviewAssignment::whereIn('id', $cancelled->pluck('id'))->update(['status' => 'cancelled', 'updated_at' => now()]);
            }

            return $this->awardService->createForFundedProposal(
                $proposal->fresh(),
                $user,
                $amount,
                $justification,
                $grantReference,
                $approvedAt,
            );
        });

        $this->notifyCancelledReviewers($proposal, $cancelled);

        return $award;
    }

    /** @param  Collection<int, ReviewAssignment>  $assignments */
    private function notifyCancelledReviewers(Proposal $proposal, $assignments): void
    {
        $data = ['tracker_number' => $proposal->tracker_number, 'title' => $proposal->title];

        foreach ($assignments as $assignment) {
            if (! $assignment->reviewer) {
                continue;
            }

            try {
                SendEmailNotificationJob::deliver($assignment->reviewer, 'review_assignment_cancelled', $data);
                StoreInAppNotificationJob::dispatchSync($assignment->reviewer->id, 'review_assignment_cancelled', $data);
            } catch (\Exception $e) {
                Log::error("Review assignment cancellation notify failed for reviewer {$assignment->reviewer->id}: {$e->getMessage()}");
            }
        }
    }
}
