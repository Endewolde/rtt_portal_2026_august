<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\RepositoryRecord;
use App\Models\User;
use App\Models\WorkflowLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class RepositoryService
{
    /**
     * Search the public research repository. No authentication required.
     */
    public function search(array $filters = []): LengthAwarePaginator
    {
        $query = RepositoryRecord::with(['college'])
            ->where('status', 'published');

        if (! empty($filters['q'])) {
            $term = '%'.$filters['q'].'%';
            $query->where(function ($q) use ($term) {
                $q->where('title', 'LIKE', $term)
                    ->orWhere('abstract', 'LIKE', $term)
                    ->orWhere('keywords', 'LIKE', $term);
            });
        }

        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (! empty($filters['college_id'])) {
            $query->where('college_id', $filters['college_id']);
        }

        if (! empty($filters['year_from'])) {
            $query->where('academic_year', '>=', $filters['year_from']);
        }

        if (! empty($filters['year_to'])) {
            $query->where('academic_year', '<=', $filters['year_to']);
        }

        if (! empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }

        if (isset($filters['is_featured']) && $filters['is_featured']) {
            $query->where('is_featured', true);
        }

        return $query
            ->orderByDesc('created_at')
            ->paginate($filters['per_page'] ?? 15);
    }

    /**
     * Public tracker lookup — returns anonymized workflow history.
     * Reviewer names replaced with Reviewer A, Reviewer B, etc.
     *
     * @throws \Exception if not found
     */
    public function getTrackerStatus(string $trackerNumber): array
    {
        $proposal = Proposal::where('tracker_number', $trackerNumber)
            ->with(['college', 'proposalCall'])
            ->first();

        if (! $proposal) {
            throw new \Exception("Tracker number {$trackerNumber} not found.");
        }

        $history = WorkflowLog::where('proposal_id', $proposal->id)
            ->orderBy('created_at', 'asc')
            ->get();

        $reviewerMap = [];
        $reviewerCounter = 'A';

        $reviewerIds = $proposal->reviewAssignments()->pluck('reviewer_id')->flip();

        $anonymizedHistory = $history->map(function ($log) use (&$reviewerMap, &$reviewerCounter, $reviewerIds, $proposal) {
            $actor = User::find($log->actor_id);
            $actorLabel = 'System';

            if ($actor) {
                if ($reviewerIds->has($actor->id)) {
                    if (! isset($reviewerMap[$actor->id])) {
                        $reviewerMap[$actor->id] = 'Reviewer '.$reviewerCounter++;
                    }
                    $actorLabel = $reviewerMap[$actor->id];
                } elseif ($actor->id === $proposal->pi_user_id) {
                    $actorLabel = 'Principal Investigator';
                } else {
                    $actorLabel = 'RTT Office';
                }
            }

            return [
                'from_stage' => $log->from_stage,
                'action' => $log->action,
                'to_stage' => $log->to_stage,
                'actor' => $actorLabel,
                'notes' => $log->notes,
                'occurred_at' => $log->created_at,
            ];
        });

        return [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'category' => $proposal->category,
            'current_status' => $proposal->status,
            'submitted_at' => $proposal->submitted_at,
            'academic_year' => $proposal->academic_year,
            'college' => $proposal->college?->name,
            'history' => $anonymizedHistory,
            'is_terminal' => in_array($proposal->status, ['archived', 'rejected']),
            'final_decision' => in_array($proposal->status, ['accepted', 'funded', 'completed', 'archived'])
                ? 'accepted'
                : (in_array($proposal->status, ['rejected']) ? 'rejected' : null),
        ];
    }
}
