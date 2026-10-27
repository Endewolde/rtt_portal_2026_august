<?php

namespace App\Services;

use App\Exceptions\OverBudgetException;
use App\Models\CallCollegeBudget;
use App\Models\FundingRound;
use App\Models\FundingRoundItem;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Support\RejectionReasons;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Funding rounds: a call's proposals awaiting the central decision are ranked and
 * decided together as drafts (fund / reserve / reject) that nobody is told about,
 * then published at once. Reserve proposals stay waiting and can be funded later.
 */
class FundingRoundService
{
    public function __construct(
        private ReviewScoreService $scores,
        private FundingBudgetService $budget,
        private FundingDecisionService $decisions,
    ) {}

    /**
     * The open draft round for the call — the whole call, or one college's proposals
     * when $collegeId is given — created if needed and kept in step with the proposals waiting.
     */
    public function draftFor(ProposalCall $call, User $user, ?string $collegeId = null): FundingRound
    {
        $round = FundingRound::where('proposal_call_id', $call->id)->where('college_id', $collegeId)->where('status', 'draft')->first()
            ?? FundingRound::create(['proposal_call_id' => $call->id, 'college_id' => $collegeId, 'status' => 'draft', 'created_by' => $user->id]);

        $this->sync($round);

        return $round->fresh();
    }

    /**
     * Bring the draft's list up to date: proposals that arrived are added, ones that
     * left the stage (decided one at a time, withdrawn) are dropped, and everyone is
     * re-ranked on the current scores. Reserve choices from the last published round
     * carry over so the waiting list keeps its order. A proposal already decided in
     * another open round of the call (a college's, or the whole call's) belongs to that one.
     */
    public function sync(FundingRound $round): void
    {
        $waiting = Proposal::where('proposal_call_id', $round->proposal_call_id)
            ->where('status', 'accepted')
            ->when($round->college_id, fn ($q, $id) => $q->where('college_id', $id))
            ->whereNotIn('id', $this->otherDraftItems($round)->where('decision', '!=', 'pending')->select('proposal_id'))
            ->with(['budgets', 'proposalCall'])
            ->get()
            ->map(function (Proposal $p) {
                $snap = $this->scores->recalculateSnapshot($p);

                return [
                    'proposal' => $p,
                    'score' => (float) $snap['combined'],
                    'max' => (float) $snap['combined_max'],
                    'requested' => round((float) $p->budgets->sum('amount'), 2),
                ];
            })
            // Best first, by share of the maximum, so different scoring forms compare fairly.
            ->sortByDesc(fn ($r) => $r['max'] > 0 ? $r['score'] / $r['max'] : 0)
            ->values();

        $previousReserve = FundingRoundItem::whereHas('round', fn ($q) => $q->where('proposal_call_id', $round->proposal_call_id)->where('status', 'published'))
            ->where('decision', 'reserve')
            ->pluck('proposal_id')
            ->flip();

        DB::transaction(function () use ($round, $waiting, $previousReserve) {
            $ids = $waiting->pluck('proposal.id');
            $round->items()->whereNotIn('proposal_id', $ids)->delete();

            foreach ($waiting as $i => $row) {
                $item = FundingRoundItem::firstOrNew(['funding_round_id' => $round->id, 'proposal_id' => $row['proposal']->id]);
                if (! $item->exists && $previousReserve->has($row['proposal']->id)) {
                    $item->decision = 'reserve';
                }
                $item->fill([
                    'rank' => $i + 1,
                    'score' => $row['score'],
                    'score_max' => $row['max'],
                    'requested' => $row['requested'],
                ]);
                $item->decision ??= 'pending';
                $item->save();
            }
        });
    }

    /**
     * Record one draft choice. Funding needs an amount (the request by default);
     * rejecting needs a reason, from the standard list or written.
     *
     * @param  array{decision: string, amount?: ?float, reason_code?: ?string, reason?: ?string, remarks?: ?string}  $data
     */
    public function setDecision(FundingRound $round, FundingRoundItem $item, array $data): FundingRoundItem
    {
        $this->ensureDraft($round);

        $decision = $data['decision'];
        $update = ['decision' => $decision, 'remarks' => $data['remarks'] ?? $item->remarks];

        if ($decision !== 'pending' && $this->otherDraftItems($round)->where('proposal_id', $item->proposal_id)->where('decision', '!=', 'pending')->exists()) {
            throw ValidationException::withMessages(['decision' => 'This proposal has already been decided in another open round of the call.']);
        }

        if ($decision === 'fund') {
            $update['amount'] = isset($data['amount']) && $data['amount'] !== null ? round((float) $data['amount'], 2) : ($item->amount ?? $item->requested);

            // Never more than the budget: what is awarded, plus every open round's plans, plus this.
            if ($round->college_id && $this->share($round)['budget'] === null) {
                throw ValidationException::withMessages(['amount' => 'The central office has not yet allocated your college\'s share of this call\'s budget.']);
            }
            $available = $this->available($round);
            if ($available !== null) {
                $others = (float) $round->items()->where('decision', 'fund')->whereKeyNot($item->id)->sum('amount');
                $left = round($available - $others, 2);
                if ($update['amount'] > $left + 0.005) {
                    throw ValidationException::withMessages(['amount' => $left > 0
                        ? 'Insufficient budget: only '.number_format($left, 2).' is left in '.$this->budgetName($round).'. Lower the amount or raise the budget.'
                        : 'Insufficient budget: nothing is left in '.$this->budgetName($round).'. Raise the budget, or move this proposal to the reserve list.']);
                }
            }
        }
        if ($decision === 'reject') {
            $update['reason_code'] = $data['reason_code'] ?? $item->reason_code;
            $update['reason'] = $data['reason'] ?? $item->reason;
        }

        $item->update($update);

        return $item->fresh();
    }

    /**
     * Fill the draft the usual way: fund the best proposals in full while the money
     * lasts, put the rest on the reserve list. Choices already made are kept unless
     * $overwrite is set.
     */
    public function autoFill(FundingRound $round, bool $overwrite = false): void
    {
        $this->ensureDraft($round);
        if ($round->college_id && $this->share($round)['budget'] === null) {
            throw ValidationException::withMessages(['round' => 'The central office has not yet allocated your college\'s share of this call\'s budget.']);
        }
        $remaining = $this->available($round);

        DB::transaction(function () use ($round, $remaining, $overwrite) {
            $left = $remaining;
            foreach ($round->items()->get() as $item) {
                $kept = ! $overwrite && $item->decision !== 'pending';
                if ($kept) {
                    if ($item->decision === 'fund' && $left !== null) {
                        $left -= (float) $item->amount;
                    }

                    continue;
                }
                $need = (float) $item->requested;
                if ($left === null || $need <= $left + 0.005) {
                    $item->update(['decision' => 'fund', 'amount' => $need]);
                    if ($left !== null) {
                        $left -= $need;
                    }
                } else {
                    $item->update(['decision' => 'reserve']);
                }
            }
        });
    }

    /**
     * Apply every choice at once: awards for the funded, rejections with their
     * reasons, reserves left waiting. Nothing is applied if any choice is missing,
     * or if the total is more than is left in the call's budget.
     *
     * @return array{funded: int, rejected: int, reserved: int, awarded: float}
     *
     * @throws OverBudgetException
     */
    public function publish(FundingRound $round, User $user): array
    {
        $this->ensureDraft($round);
        $this->sync($round);
        $items = $round->items()->with('proposal')->get();

        if ($round->call->funding_budget === null) {
            throw ValidationException::withMessages(['round' => 'Set the call\'s funding budget before publishing.']);
        }
        if ($round->college_id && $this->share($round)['budget'] === null) {
            throw ValidationException::withMessages(['round' => 'The central office has not yet allocated your college\'s share of this call\'s budget.']);
        }
        if ($items->isEmpty()) {
            throw ValidationException::withMessages(['round' => 'There is nothing to decide in this round.']);
        }
        if ($pending = $items->where('decision', 'pending')->count()) {
            throw ValidationException::withMessages(['round' => "{$pending} proposal(s) still have no decision."]);
        }
        foreach ($items->where('decision', 'reject') as $item) {
            if (! $item->reason_code && blank($item->reason)) {
                throw ValidationException::withMessages(['round' => "Give a reason for rejecting {$item->proposal?->tracker_number}."]);
            }
        }

        return DB::transaction(function () use ($round, $user, $items) {
            // One publish at a time per call: the call row is held for the whole round.
            $call = ProposalCall::whereKey($round->proposal_call_id)->lockForUpdate()->firstOrFail();
            $before = $this->budget->summary($call);
            $awarding = (float) $items->where('decision', 'fund')->sum('amount');

            if ($before['remaining'] !== null && $awarding > $before['remaining'] + 0.005) {
                throw new OverBudgetException($before['remaining'], round($awarding - $before['remaining'], 2));
            }
            $share = $round->college_id ? $this->share($round) : null;
            if ($share) {
                if ($awarding > $share['remaining'] + 0.005) {
                    throw new OverBudgetException($share['remaining'], round($awarding - $share['remaining'], 2), 'your college\'s share of the call\'s budget');
                }
            }

            $round->update([
                'status' => 'published',
                'published_by' => $user->id,
                'published_at' => now(),
                // A college's round is recorded against the college's share.
                'budget_at_publish' => ($share ?? $before)['budget'],
                'committed_before' => ($share ?? $before)['committed'],
            ]);

            foreach ($items as $item) {
                if ($item->decision === 'fund') {
                    $this->decisions->approve($item->proposal, $user, (float) $item->amount, $item->remarks);
                } elseif ($item->decision === 'reject') {
                    $reason = $item->reason_code
                        ? RejectionReasons::compose('central_evaluation', $item->reason_code, $item->reason)
                        : trim((string) $item->reason);
                    $this->decisions->reject($item->proposal, $user, $reason);
                }
            }

            return [
                'funded' => $items->where('decision', 'fund')->count(),
                'rejected' => $items->where('decision', 'reject')->count(),
                'reserved' => $items->where('decision', 'reserve')->count(),
                'awarded' => round($awarding, 2),
            ];
        });
    }

    /** Fund a reserve proposal from a published round (money freed up later). */
    public function promote(FundingRoundItem $item, User $user, float $amount, ?string $remarks): void
    {
        $this->decisions->approve($item->proposal, $user, $amount, $remarks);
        $item->update(['promoted_at' => now(), 'amount' => $amount]);
    }

    /**
     * Everything the page needs for one round: the call, its budget, the ranked
     * proposals with their choices, and the totals of what is being proposed.
     *
     * @return array<string, mixed>
     */
    public function present(FundingRound $round): array
    {
        $round->loadMissing(['call', 'college:id,name', 'publisher:id,name', 'creator:id,name']);
        $items = $round->items()->with(['proposal:id,tracker_number,title,category,college_id,pi_user_id,status', 'proposal.pi:id,name', 'proposal.college:id,name'])->get();
        $summary = $round->isDraft()
            ? ($round->college_id ? $this->share($round) : $this->budget->summary($round->call))
            : ['budget' => (float) $round->budget_at_publish, 'committed' => (float) $round->committed_before, 'remaining' => $round->budget_at_publish !== null ? (float) $round->budget_at_publish - (float) $round->committed_before : null];

        $funding = (float) $items->where('decision', 'fund')->sum('amount');
        // Money other open rounds plan to award from the same pot (for a college, its proposals in the call's round).
        $otherDrafts = $round->isDraft() ? round((float) $this->otherDraftFunding($round), 2) : 0.0;
        $available = $round->isDraft() ? $this->available($round) : $summary['remaining'];

        return [
            'id' => $round->id,
            'status' => $round->status,
            'notes' => $round->notes,
            'published_at' => $round->published_at?->toIso8601String(),
            'published_by' => $round->publisher?->name,
            'created_by' => $round->creator?->name,
            'call' => ['id' => $round->call->id, 'title' => $round->call->title, 'academic_year' => $round->call->academic_year, 'category' => $round->call->category],
            'college' => $round->college?->name,
            'budget' => $summary + [
                'other_drafts' => $otherDrafts,
                'funding' => round($funding, 2),
                'after' => $available !== null ? round($available - $funding, 2) : null,
                'scope' => $round->college_id ? 'college' : 'call',
                'call_total' => $round->call->funding_budget !== null ? (float) $round->call->funding_budget : null,
                'allocated' => round((float) CallCollegeBudget::where('proposal_call_id', $round->proposal_call_id)->sum('amount'), 2),
            ],
            'counts' => collect(FundingRoundItem::DECISIONS)->mapWithKeys(fn ($d) => [$d => $items->where('decision', $d)->count()]),
            'items' => $items->map(fn (FundingRoundItem $i) => [
                'id' => $i->id,
                'proposal_id' => $i->proposal_id,
                'tracker_number' => $i->proposal?->tracker_number,
                'title' => $i->proposal?->title,
                'category' => $i->proposal?->category,
                'pi' => $i->proposal?->pi?->name,
                'pi_id' => $i->proposal?->pi_user_id,
                'college' => $i->proposal?->college?->name,
                'proposal_status' => $i->proposal?->status,
                'rank' => $i->rank,
                'score' => $i->score !== null ? (float) $i->score : null,
                'score_max' => $i->score_max !== null ? (float) $i->score_max : null,
                'requested' => (float) $i->requested,
                'decision' => $i->decision,
                'amount' => $i->amount !== null ? (float) $i->amount : null,
                'reason_code' => $i->reason_code,
                'reason' => $i->reason,
                'remarks' => $i->remarks,
                'promoted_at' => $i->promoted_at?->toIso8601String(),
            ])->values(),
        ];
    }

    /**
     * Calls the user can run rounds for: those with proposals waiting, or with rounds.
     * A college-scoped user sees only their college's proposals and rounds.
     */
    public function callsFor(User $user): Collection
    {
        $scope = $user->accessScope();
        $college = $scope->isCollege() ? $scope->collegeId : null;
        $waiting = fn ($q) => $q->where('status', 'accepted')->when($college, fn ($w, $id) => $w->where('college_id', $id));

        return ProposalCall::query()
            ->where(fn ($q) => $q->whereHas('proposals', $waiting)->orWhereExists(
                fn ($e) => $e->selectRaw(1)->from('funding_rounds')->whereColumn('funding_rounds.proposal_call_id', 'proposal_calls.id')
                    ->when($college, fn ($w, $id) => $w->where('funding_rounds.college_id', $id))
            ))
            ->when($scope->isCategory(), fn ($q) => $q->whereIn('category', $scope->categories))
            ->orderByDesc('academic_year')
            ->get(['id', 'title', 'academic_year', 'category', 'funding_budget'])
            ->map(fn (ProposalCall $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'academic_year' => $c->academic_year,
                'category' => $c->category,
                'budget_scope' => $college ? 'college' : 'call',
                'budget' => $college
                    ? $this->budget->collegeSummary($c, $college)['budget']
                    : ($c->funding_budget !== null ? (float) $c->funding_budget : null),
                'waiting' => $waiting(Proposal::where('proposal_call_id', $c->id))->count(),
                'rounds' => FundingRound::with('college:id,name')->where('proposal_call_id', $c->id)
                    ->when($college, fn ($q, $id) => $q->where('college_id', $id))
                    ->orderByDesc('created_at')
                    ->get(['id', 'college_id', 'status', 'published_at'])
                    ->map(fn ($r) => ['id' => $r->id, 'status' => $r->status, 'college' => $r->college?->name, 'published_at' => $r->published_at?->toIso8601String()]),
            ]);
    }

    /** Items of the call's other open draft rounds. */
    private function otherDraftItems(FundingRound $round): Builder
    {
        return FundingRoundItem::query()
            ->where('funding_round_id', '!=', $round->id)
            ->whereHas('round', fn ($q) => $q->where('proposal_call_id', $round->proposal_call_id)->where('status', 'draft'));
    }

    /**
     * What this round may award: the call's budget less what is already awarded and what
     * the call's other open rounds plan to award — and for a college's round, also no more
     * than is left of the college's share. Null when there is no limit.
     */
    private function available(FundingRound $round): ?float
    {
        $remaining = $this->budget->summary($round->call)['remaining'];
        $callLeft = $remaining === null ? null : round($remaining - (float) $this->otherDraftItems($round)->where('decision', 'fund')->sum('amount'), 2);

        if (! $round->college_id) {
            return $callLeft;
        }

        $share = $this->share($round)['remaining'];
        $collegeLeft = $share === null ? 0.0 : round($share - $this->otherDraftFunding($round), 2);

        return $callLeft === null ? $collegeLeft : min($callLeft, $collegeLeft);
    }

    /** What other open rounds plan to award from this round's pot. */
    private function otherDraftFunding(FundingRound $round): float
    {
        return (float) $this->otherDraftItems($round)
            ->where('decision', 'fund')
            ->when($round->college_id, fn ($q, $id) => $q->whereHas('proposal', fn ($p) => $p->where('college_id', $id)))
            ->sum('amount');
    }

    /** @return array{budget: float|null, committed: float, remaining: float|null, awards: int} */
    private function share(FundingRound $round): array
    {
        return $this->budget->collegeSummary($round->call, $round->college_id);
    }

    private function budgetName(FundingRound $round): string
    {
        return $round->college_id ? 'your college\'s share of the call\'s budget' : 'the call\'s funding budget';
    }

    private function ensureDraft(FundingRound $round): void
    {
        if (! $round->isDraft()) {
            throw ValidationException::withMessages(['round' => 'This round has already been published.']);
        }
    }
}
