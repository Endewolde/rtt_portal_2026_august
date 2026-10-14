<?php

namespace App\Listeners;

use App\Events\ProposalTransitioned;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\ReviewAssignment;
use Illuminate\Support\Facades\Log;

/**
 * A proposal being rejected — from any stage, for any reason — means any reviewer
 * still actively assigned to it (blind review or open defence) has nothing left to
 * review. Without this, those assignments sit forever in 'pending'/'accepted'/
 * 'in_progress', still counting against the reviewer's workload cap and still
 * showing up in their queue for a proposal that's already dead.
 */
class CancelReviewAssignmentsOnRejection
{
    private const ACTIVE_STATUSES = ['pending', 'accepted', 'in_progress'];

    public function handle(ProposalTransitioned $event): void
    {
        if ($event->toStage !== 'rejected') {
            return;
        }

        $assignments = ReviewAssignment::with('reviewer')
            ->where('proposal_id', $event->proposal->id)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->get();

        if ($assignments->isEmpty()) {
            return;
        }

        ReviewAssignment::whereIn('id', $assignments->pluck('id'))->update([
            'status' => 'cancelled',
            'updated_at' => now(),
        ]);

        $data = [
            'tracker_number' => $event->proposal->tracker_number,
            'title' => $event->proposal->title,
        ];

        foreach ($assignments as $assignment) {
            $reviewer = $assignment->reviewer;
            if (! $reviewer) {
                continue;
            }

            try {
                SendEmailNotificationJob::deliver($reviewer, 'review_assignment_cancelled', $data);
                StoreInAppNotificationJob::dispatchSync($reviewer->id, 'review_assignment_cancelled', $data);
            } catch (\Exception $e) {
                Log::error("Review assignment cancellation notify failed for reviewer {$reviewer->id}: {$e->getMessage()}");
            }
        }
    }
}
