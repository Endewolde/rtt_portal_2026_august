<?php

namespace App\Services;

use App\Exceptions\ReviewerConflictWarningException;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Possible conflicts of interest beyond being on the team (which is always blocked):
 * the reviewer is in the proposal's department, or worked with the PI or a team member
 * on another proposal recently. These are warnings an officer can override for blind
 * review, with the override recorded on the assignment.
 */
class ReviewerConflictService
{
    /** How far back working together on another proposal counts as a conflict. */
    private const COLLABORATION_YEARS = 3;

    /** @return Collection<int, string> the PI and active team members */
    public function teamIds(Proposal $proposal): Collection
    {
        return DB::table('proposal_members')
            ->where('proposal_id', $proposal->id)
            ->where('status', 'active')
            ->pluck('user_id')
            ->push($proposal->pi_user_id)
            ->filter()
            ->unique()
            ->values();
    }

    /**
     * @param  iterable<string>  $reviewerIds
     * @return array<string, list<string>> reviewer id => reasons (only reviewers with a conflict)
     */
    public function forProposal(Proposal $proposal, iterable $reviewerIds): array
    {
        $reviewerIds = collect($reviewerIds)->filter()->unique()->values();
        if ($reviewerIds->isEmpty()) {
            return [];
        }

        $team = $this->teamIds($proposal);
        $conflicts = [];

        if ($proposal->department_id) {
            User::whereIn('id', $reviewerIds)->where('department_id', $proposal->department_id)->pluck('id')
                ->each(function ($id) use (&$conflicts) {
                    $conflicts[$id][] = 'Same department as the proposal';
                });
        }

        // Other recent proposals the PI or any team member worked on…
        $sharedProposals = DB::table('proposals as p')
            ->leftJoin('proposal_members as m', fn ($j) => $j->on('m.proposal_id', '=', 'p.id')->where('m.status', 'active'))
            ->whereNull('p.deleted_at')
            ->where('p.id', '!=', $proposal->id)
            ->where('p.status', '!=', 'draft')
            ->where('p.created_at', '>=', now()->subYears(self::COLLABORATION_YEARS))
            ->where(fn ($q) => $q->whereIn('p.pi_user_id', $team)->orWhereIn('m.user_id', $team))
            ->distinct()
            ->pluck('p.tracker_number', 'p.id');

        if ($sharedProposals->isNotEmpty()) {
            // …and which candidate reviewers were on them too.
            $onThem = DB::table('proposals')->whereIn('id', $sharedProposals->keys())->whereIn('pi_user_id', $reviewerIds)
                ->get(['id', 'pi_user_id as user_id'])
                ->merge(DB::table('proposal_members')->whereIn('proposal_id', $sharedProposals->keys())->where('status', 'active')
                    ->whereIn('user_id', $reviewerIds)->get(['proposal_id as id', 'user_id']));

            $onThem->groupBy('user_id')->each(function ($rows, $userId) use (&$conflicts, $sharedProposals, $team) {
                if ($team->contains($userId)) {
                    return;
                }
                $trackers = $rows->pluck('id')->unique()->map(fn ($id) => $sharedProposals[$id])->take(3)->implode(', ');
                $conflicts[$userId][] = "Worked with the research team on {$trackers}";
            });
        }

        return $conflicts;
    }

    /**
     * Blind review only: refuse flagged reviewers unless the officer confirmed them.
     *
     * @param  list<string>  $reviewerIds
     * @return array<string, list<string>> the conflicts that were acknowledged
     *
     * @throws ReviewerConflictWarningException
     */
    public function ensureAcknowledged(Proposal $proposal, array $reviewerIds, bool $acknowledged): array
    {
        $conflicts = $this->forProposal($proposal, $reviewerIds);
        if ($conflicts === [] || $acknowledged) {
            return $conflicts;
        }

        $names = User::whereIn('id', array_keys($conflicts))->pluck('name', 'id');
        $detail = collect($conflicts)->map(fn ($reasons, $id) => ($names[$id] ?? 'Reviewer').' ('.implode('; ', $reasons).')')->implode(', ');

        throw new ReviewerConflictWarningException("Possible conflict of interest: {$detail}. Blind review should be independent — confirm to assign anyway.");
    }
}
