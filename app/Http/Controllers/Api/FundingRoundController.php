<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\OverBudgetException;
use App\Http\Controllers\Controller;
use App\Models\CallCollegeBudget;
use App\Models\College;
use App\Models\FundingRound;
use App\Models\FundingRoundItem;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Services\FundingBudgetService;
use App\Services\FundingRoundService;
use App\Support\AuditLogger;
use App\Support\RejectionReasons;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Central Evaluation → Funding round: decide a call's proposals together as drafts,
 * publish them at once, keep a reserve list, and print the decision minutes.
 */
class FundingRoundController extends Controller
{
    public function __construct(private FundingRoundService $rounds, private FundingBudgetService $budget) {}

    /** Calls with proposals waiting (or past rounds) that the user may decide. */
    public function calls(Request $request): JsonResponse
    {
        if ($denied = $this->cannotDecide($request)) {
            return $denied;
        }

        return response()->json(['data' => $this->rounds->callsFor($request->user())->values(), 'message' => '', 'errors' => []]);
    }

    /** The call's draft round (opened on first visit), with its live budget. */
    public function draft(Request $request, string $callId): JsonResponse
    {
        $call = ProposalCall::findOrFail($callId);
        if ($denied = $this->cannotDecide($request, $call)) {
            return $denied;
        }

        $round = $this->rounds->draftFor($call, $request->user(), $this->collegeOf($request));

        return response()->json(['data' => $this->present($request, $round), 'message' => '', 'errors' => []]);
    }

    /**
     * Set the call's funding budget from here. A round cannot be decided without one,
     * so whoever runs it is asked for it the first time they open the call.
     */
    public function setBudget(Request $request, string $callId): JsonResponse
    {
        $call = ProposalCall::findOrFail($callId);
        if ($denied = $this->cannotDecide($request, $call) ?? $this->cannotSetBudget($request)) {
            return $denied;
        }
        // Never below what has already been awarded, nor below what is shared out to colleges.
        $floor = max($this->budget->summary($call)['committed'], (float) CallCollegeBudget::where('proposal_call_id', $call->id)->sum('amount'));
        $data = $request->validate(
            ['funding_budget' => ['required', 'numeric', 'min:'.max(1, $floor), 'max:9999999999999']],
            ['funding_budget.min' => 'The budget cannot be less than '.number_format($floor, 2).' — what is already awarded or shared out to colleges.'],
        );

        $old = $call->funding_budget;
        $call->update(['funding_budget' => $data['funding_budget']]);
        AuditLogger::log('proposal_call.budget_set', ProposalCall::class, $call->id, $request->user()->id, ['funding_budget' => $old], ['funding_budget' => $call->funding_budget]);

        $round = $this->rounds->draftFor($call->fresh(), $request->user(), $this->collegeOf($request));

        return response()->json(['data' => $this->present($request, $round), 'message' => 'Funding budget saved.', 'errors' => []]);
    }

    /**
     * The call's colleges and their shares of its budget: what each has been given,
     * already awarded, and has waiting.
     */
    public function allocations(Request $request, string $callId): JsonResponse
    {
        $call = ProposalCall::findOrFail($callId);
        if ($denied = $this->cannotDecide($request, $call) ?? $this->cannotSetBudget($request)) {
            return $denied;
        }

        return response()->json(['data' => $this->presentAllocations($call), 'message' => '', 'errors' => []]);
    }

    /** Share the call's budget out to its colleges. A blank amount removes a college's share. */
    public function updateAllocations(Request $request, string $callId): JsonResponse
    {
        $call = ProposalCall::findOrFail($callId);
        if ($denied = $this->cannotDecide($request, $call) ?? $this->cannotSetBudget($request)) {
            return $denied;
        }
        $data = $request->validate([
            'allocations' => ['present', 'array'],
            'allocations.*.college_id' => ['required', 'uuid', 'exists:colleges,id'],
            'allocations.*.amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999999'],
        ]);

        if ($call->funding_budget === null) {
            throw ValidationException::withMessages(['allocations' => 'Set the call\'s total funding budget first.']);
        }
        $committed = $this->budget->committedByCollege($call);
        $rows = collect($data['allocations'])->keyBy('college_id');
        $kept = CallCollegeBudget::where('proposal_call_id', $call->id)->whereNotIn('college_id', $rows->keys())->sum('amount');
        $total = (float) $kept + (float) $rows->sum(fn ($r) => (float) ($r['amount'] ?? 0));
        if ($total > (float) $call->funding_budget + 0.005) {
            throw ValidationException::withMessages(['allocations' => 'The shares add up to '.number_format($total, 2).', more than the call\'s budget of '.number_format((float) $call->funding_budget, 2).'.']);
        }
        foreach ($rows as $collegeId => $row) {
            $awarded = $committed[$collegeId] ?? 0;
            if (($row['amount'] ?? null) !== null && (float) $row['amount'] + 0.005 < $awarded) {
                throw ValidationException::withMessages(['allocations' => 'A college\'s share cannot be less than the '.number_format($awarded, 2).' already awarded to it.']);
            }
        }

        $before = CallCollegeBudget::where('proposal_call_id', $call->id)->pluck('amount', 'college_id');
        DB::transaction(function () use ($rows, $call, $request) {
            foreach ($rows as $collegeId => $row) {
                if (($row['amount'] ?? null) === null) {
                    CallCollegeBudget::where('proposal_call_id', $call->id)->where('college_id', $collegeId)->delete();
                } else {
                    CallCollegeBudget::updateOrCreate(
                        ['proposal_call_id' => $call->id, 'college_id' => $collegeId],
                        ['amount' => $row['amount'], 'set_by' => $request->user()->id],
                    );
                }
            }
        });
        AuditLogger::log('proposal_call.college_shares_set', ProposalCall::class, $call->id, $request->user()->id, $before->all(),
            CallCollegeBudget::where('proposal_call_id', $call->id)->pluck('amount', 'college_id')->all());

        return response()->json(['data' => $this->presentAllocations($call), 'message' => 'College shares saved.', 'errors' => []]);
    }

    /** A published round, read-only, with its reserve list. */
    public function show(Request $request, string $id): JsonResponse
    {
        $round = FundingRound::with('call')->findOrFail($id);
        if ($denied = $this->cannotDecide($request, $round->call, $round)) {
            return $denied;
        }

        return response()->json(['data' => $this->present($request, $round), 'message' => '', 'errors' => []]);
    }

    public function updateItem(Request $request, string $id, string $itemId): JsonResponse
    {
        $round = FundingRound::with('call')->findOrFail($id);
        if ($denied = $this->cannotDecide($request, $round->call, $round)) {
            return $denied;
        }
        $item = FundingRoundItem::where('funding_round_id', $round->id)->findOrFail($itemId);

        $data = $request->validate([
            'decision' => ['required', Rule::in(FundingRoundItem::DECISIONS)],
            'amount' => ['nullable', 'numeric', 'min:1', 'max:9999999999999'],
            'reason_code' => ['nullable', Rule::in(array_keys(RejectionReasons::CATALOG['central_evaluation']))],
            'reason' => ['nullable', 'string', 'max:2000'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->rounds->setDecision($round, $item, $data);

        return response()->json(['data' => $this->present($request, $round->fresh()), 'message' => 'Saved.', 'errors' => []]);
    }

    public function updateNotes(Request $request, string $id): JsonResponse
    {
        $round = FundingRound::with('call')->findOrFail($id);
        if ($denied = $this->cannotDecide($request, $round->call, $round)) {
            return $denied;
        }
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:5000']]);
        $round->update(['notes' => $data['notes'] ?? null]);

        return response()->json(['data' => null, 'message' => 'Notes saved.', 'errors' => []]);
    }

    /** Fund the best in full while the money lasts; the rest go on the reserve list. */
    public function autoFill(Request $request, string $id): JsonResponse
    {
        $round = FundingRound::with('call')->findOrFail($id);
        if ($denied = $this->cannotDecide($request, $round->call, $round)) {
            return $denied;
        }

        $this->rounds->autoFill($round, $request->boolean('overwrite'));

        return response()->json(['data' => $this->present($request, $round->fresh()), 'message' => 'Filled from the ranking.', 'errors' => []]);
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        $round = FundingRound::with('call')->findOrFail($id);
        if ($denied = $this->cannotDecide($request, $round->call, $round)) {
            return $denied;
        }

        try {
            $result = $this->rounds->publish($round, $request->user());
        } catch (OverBudgetException $e) {
            return response()->json([
                'data' => ['remaining' => $e->remaining, 'over_by' => $e->overBy],
                'message' => 'The funded total is '.number_format($e->overBy, 2).' more than is left in the call\'s budget. Lower some awards or raise the budget.',
                'errors' => [],
                'meta' => ['code' => 'over_budget'],
            ], 422);
        }

        AuditLogger::log('funding_round.published', FundingRound::class, $round->id, $request->user()->id, null, $result + ['call' => $round->call->title]);

        return response()->json([
            'data' => $this->present($request, $round->fresh()),
            'message' => "Published: {$result['funded']} funded, {$result['reserved']} on the reserve list, {$result['rejected']} not funded. The teams are being told now.",
            'errors' => [],
        ]);
    }

    /** Fund a proposal from a published round's reserve list. */
    public function promote(Request $request, string $id, string $itemId): JsonResponse
    {
        $round = FundingRound::with('call')->findOrFail($id);
        if ($denied = $this->cannotDecide($request, $round->call, $round)) {
            return $denied;
        }
        $item = FundingRoundItem::with('proposal')->where('funding_round_id', $round->id)->findOrFail($itemId);

        if ($round->isDraft() || $item->decision !== 'reserve' || $item->promoted_at || $item->proposal?->status !== 'accepted') {
            return response()->json(['data' => null, 'message' => 'Only a waiting reserve proposal of a published round can be funded here.', 'errors' => []], 422);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $this->rounds->promote($item, $request->user(), (float) $data['amount'], $data['remarks'] ?? null);
        } catch (OverBudgetException $e) {
            return response()->json(['data' => ['remaining' => $e->remaining, 'over_by' => $e->overBy], 'message' => $e->getMessage(), 'errors' => [], 'meta' => ['code' => 'over_budget']], 422);
        }

        return response()->json(['data' => $this->present($request, $round->fresh()), 'message' => 'Funded from the reserve list. The team is being told now.', 'errors' => []]);
    }

    /** The decision minutes of a published round, as a PDF to sign and file. */
    public function minutes(Request $request, string $id): Response|JsonResponse
    {
        $round = FundingRound::with('call')->findOrFail($id);
        if ($denied = $this->cannotDecide($request, $round->call, $round)) {
            return $denied;
        }

        $data = $this->rounds->present($round);
        $reasons = RejectionReasons::CATALOG['central_evaluation'];
        $settings = DB::table('app_settings')->whereIn('key', ['organization_name', 'system_logo'])->pluck('value', 'key');

        return Pdf::loadView('pdf.funding-round-minutes', [
            'round' => $data,
            'reasons' => $reasons,
            'orgName' => $settings['organization_name'] ?? config('app.name'),
            'generatedBy' => $request->user()->name,
        ])->setPaper('a4', 'portrait')->download('funding-decisions-'.str($data['call']['title'])->slug().'.pdf');
    }

    /** @return array<string, mixed> */
    private function present(Request $request, FundingRound $round): array
    {
        return $this->rounds->present($round) + ['can_set_budget' => ! $request->user()->accessScope()->isCollege()];
    }

    /** @return array<string, mixed> */
    private function presentAllocations(ProposalCall $call): array
    {
        $shares = CallCollegeBudget::where('proposal_call_id', $call->id)->pluck('amount', 'college_id');
        $committed = $this->budget->committedByCollege($call);
        $waiting = Proposal::where('proposal_call_id', $call->id)->where('status', 'accepted')->with('budgets:id,proposal_id,amount')->get(['id', 'college_id'])->groupBy('college_id');
        $collegeIds = collect($shares->keys())->merge(array_keys($committed))->merge($waiting->keys())->filter()->unique();

        $rows = College::whereIn('id', $collegeIds)->orderBy('name')->get(['id', 'name'])->map(fn (College $c) => [
            'college_id' => $c->id,
            'college' => $c->name,
            'amount' => isset($shares[$c->id]) ? (float) $shares[$c->id] : null,
            'awarded' => $committed[$c->id] ?? 0.0,
            'waiting' => $waiting->get($c->id)?->count() ?? 0,
            'asked' => round((float) ($waiting->get($c->id)?->sum(fn ($p) => $p->budgets->sum('amount')) ?? 0), 2),
        ])->values();

        $total = $call->funding_budget !== null ? (float) $call->funding_budget : null;
        $allocated = round((float) $shares->sum(), 2);

        return ['total' => $total, 'allocated' => $allocated, 'unallocated' => $total !== null ? round($total - $allocated, 2) : null, 'colleges' => $rows];
    }

    /** The call's total and its college shares are the central office's (or programme director's) to set. */
    private function cannotSetBudget(Request $request): ?JsonResponse
    {
        return $request->user()->accessScope()->isCollege()
            ? response()->json(['data' => null, 'message' => 'The call\'s budget and the college shares are set by the central office.', 'errors' => []], 403)
            : null;
    }

    /**
     * Rounds are for those who make central funding decisions: the central office and
     * the call's programme director across the whole call, and a College RTT Manager
     * for their own college's proposals in every category.
     */
    private function cannotDecide(Request $request, ?ProposalCall $call = null, ?FundingRound $round = null): ?JsonResponse
    {
        $user = $request->user();
        $scope = $user->accessScope();
        $allowed = $user->can('evaluation.central') && match (true) {
            $scope->isAll() => true,
            $scope->isCategory() => ! $call || in_array($call->category, $scope->categories, true),
            $scope->isCollege() => $scope->collegeId !== null && (! $round || $round->college_id === $scope->collegeId),
            default => false,
        };

        return $allowed ? null : response()->json(['data' => null, 'message' => 'Funding rounds are run by the central office, the programme director or the College RTT Manager.', 'errors' => []], 403);
    }

    /** The college a user's rounds cover: their own for college-scoped roles, else the whole call. */
    private function collegeOf(Request $request): ?string
    {
        $scope = $request->user()->accessScope();

        return $scope->isCollege() ? $scope->collegeId : null;
    }
}
