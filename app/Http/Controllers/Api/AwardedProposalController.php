<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Services\AwardInsightsService;
use App\Services\ContractReminderService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Awarded Proposals: the money, contract and progress behind each award, contract
 * reminders to PIs, spend forecasts per call, the printable award register, and the
 * PI's own view of their awards.
 */
class AwardedProposalController extends Controller
{
    private const FUNDED = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    public function __construct(private AwardInsightsService $insights, private ContractReminderService $contracts) {}

    /** Per awarded proposal in scope (keyed by id): money, contract wait, timeline, other running awards. */
    public function insights(Request $request): JsonResponse
    {
        if (! $request->user()->can('awards.list')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $proposals = $this->scoped($request)->get();

        return response()->json(['data' => $this->insights->forProposals($proposals), 'message' => '', 'errors' => []]);
    }

    /** The signed-in PI's own funded projects, with their money, timeline and next step. */
    public function mine(Request $request): JsonResponse
    {
        $proposals = Proposal::whereIn('status', self::FUNDED)
            ->where('pi_user_id', $request->user()->id)
            ->with(['award', 'college:id,name'])
            ->orderByDesc('updated_at')
            ->get();
        $info = $this->insights->forProposals($proposals);

        return response()->json([
            'data' => $proposals->map(fn (Proposal $p) => [
                'id' => $p->id,
                'tracker_number' => $p->tracker_number,
                'title' => $p->title,
                'status' => $p->status,
                'category' => $p->category,
                'academic_year' => $p->academic_year,
                'college' => $p->college?->name,
                'grant_reference' => $p->award?->grant_reference,
                'contract_status' => $p->contract_status,
                'contract_rejection_reason' => $p->contract_rejection_reason,
            ] + $info[$p->id])->values(),
            'message' => '',
            'errors' => [],
        ]);
    }

    /**
     * Overlap with existing funding for proposals being checked: the PI's other running
     * awards, and funded proposals that the similarity check flagged as very similar.
     */
    public function overlap(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('proposals.validate') && ! $user->can('evaluation.central')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }
        $data = $request->validate(['ids' => ['required', 'array', 'max:300'], 'ids.*' => ['uuid']]);

        $proposals = $user->accessScope()->constrain(Proposal::query())->whereIn('id', $data['ids'])->get(['id', 'pi_user_id']);
        $running = Proposal::whereIn('status', AwardInsightsService::RUNNING)
            ->whereIn('pi_user_id', $proposals->pluck('pi_user_id')->filter()->unique())
            ->get(['id', 'pi_user_id', 'tracker_number'])
            ->groupBy('pi_user_id');
        $similar = DB::table('similarity_scores as s')
            ->join('proposals as other', 'other.id', '=', 's.similar_proposal_id')
            ->whereIn('s.proposal_id', $proposals->pluck('id'))
            ->where('s.flagged', true)
            ->whereIn('other.status', self::FUNDED)
            ->whereNull('other.deleted_at')
            ->orderByDesc('s.score')
            ->get(['s.proposal_id', 'other.id', 'other.tracker_number', 'other.title', 's.score'])
            ->groupBy('proposal_id');

        return response()->json([
            'data' => $proposals->mapWithKeys(fn (Proposal $p) => [$p->id => [
                'pi_running_awards' => ($running->get($p->pi_user_id) ?? collect())->where('id', '!=', $p->id)->pluck('tracker_number')->values(),
                'similar_funded' => ($similar->get($p->id) ?? collect())->take(3)->map(fn ($row) => [
                    'id' => $row->id, 'tracker_number' => $row->tracker_number, 'title' => $row->title, 'score' => round((float) $row->score, 2),
                ])->values(),
            ]]),
            'message' => '',
            'errors' => [],
        ]);
    }

    /** Remind the PIs of funded proposals whose contract is not uploaded, or was returned. */
    public function remindContracts(Request $request): JsonResponse
    {
        if (! $request->user()->can('contracts.review')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }
        $data = $request->validate([
            'proposal_ids' => ['required', 'array', 'min:1', 'max:200'],
            'proposal_ids.*' => ['uuid'],
        ]);

        $waiting = $request->user()->accessScope()->constrain($this->contracts->waitingQuery())
            ->whereIn('id', $data['proposal_ids'])
            ->get();
        $sent = $this->contracts->remindPis($waiting, $request->user());
        $skipped = count($data['proposal_ids']) - $sent;

        return response()->json([
            'data' => ['sent' => $sent, 'skipped' => $skipped],
            'message' => $sent
                ? "Reminder sent to {$sent} PI".($sent === 1 ? '' : 's').($skipped ? " ({$skipped} skipped — their contract is already in or approved)." : '.')
                : 'No reminder was needed — the selected contracts are already uploaded or approved.',
            'errors' => [],
        ]);
    }

    /**
     * Spend and forecast per call: what was awarded, paid and settled, the pace of
     * payments, where that pace leads in a year, and the projects that are idle (money
     * awarded, contract in, nothing paid) or spending unusually fast.
     */
    public function burn(Request $request): JsonResponse
    {
        if (! $request->user()->can('awards.list')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $proposals = $this->scoped($request)
            ->when($request->filled('year'), fn ($q) => $q->where('academic_year', $request->year))
            ->whereNotNull('proposal_call_id')
            ->get();
        $info = $this->insights->forProposals($proposals);
        $calls = ProposalCall::whereIn('id', $proposals->pluck('proposal_call_id')->unique())->get(['id', 'title', 'academic_year', 'funding_budget'])->keyBy('id');

        $rows = $proposals->groupBy('proposal_call_id')->map(function (Collection $group, string $callId) use ($info, $calls) {
            $awarded = $group->sum(fn ($p) => $info[$p->id]['awarded']);
            $paid = $group->sum(fn ($p) => $info[$p->id]['disbursed']);
            $settled = $group->sum(fn ($p) => $info[$p->id]['settled']);
            $firstAward = $group->map(fn ($p) => $p->award?->approved_at)->filter()->min();
            $months = $firstAward ? max(1, $firstAward->diffInMonths(now(), true)) : 1;
            $pace = $paid / $months;
            $projected = min($awarded, $paid + $pace * max(0, 12 - $months));

            $running = $group->whereIn('status', AwardInsightsService::RUNNING);
            $idle = $running->filter(fn ($p) => $p->contract_status === 'approved'
                && $info[$p->id]['disbursed'] <= 0
                && $p->award?->approved_at?->lt(now()->subDays(60)));
            $fast = $running->filter(fn ($p) => $p->status === 'funded'
                && $info[$p->id]['awarded'] > 0
                && $info[$p->id]['disbursed'] / $info[$p->id]['awarded'] >= 0.8);

            $call = $calls[$callId] ?? null;

            return [
                'call_id' => $callId,
                'title' => $call?->title,
                'academic_year' => $call?->academic_year,
                'budget' => $call?->funding_budget !== null ? (float) $call->funding_budget : null,
                'projects' => $group->count(),
                'awarded' => round($awarded, 2),
                'paid' => round($paid, 2),
                'settled' => round($settled, 2),
                'months' => (int) $months,
                'monthly_pace' => round($pace, 2),
                'projected_12m' => round($projected, 2),
                'idle' => $idle->map(fn ($p) => ['id' => $p->id, 'tracker_number' => $p->tracker_number])->values(),
                'fast' => $fast->map(fn ($p) => ['id' => $p->id, 'tracker_number' => $p->tracker_number])->values(),
            ];
        })->sortByDesc('awarded')->values();

        return response()->json(['data' => $rows, 'message' => '', 'errors' => []]);
    }

    /** The award register as a PDF: every award in scope (or the chosen ones), to sign and file. */
    public function register(Request $request): Response|JsonResponse
    {
        if (! $request->user()->can('awards.list')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }
        $request->validate([
            'year' => ['nullable', 'string', 'max:20'],
            'ids' => ['nullable', 'array', 'max:500'],
            'ids.*' => ['uuid'],
        ]);

        $proposals = $this->scoped($request)
            ->when($request->filled('year'), fn ($q) => $q->where('academic_year', $request->year))
            ->when($request->filled('ids'), fn ($q) => $q->whereIn('id', $request->ids))
            ->with(['pi:id,name', 'college:id,name', 'award:id,proposal_id,grant_reference,awarded_amount,approved_at'])
            ->get(['id', 'tracker_number', 'title', 'category', 'academic_year', 'status', 'pi_user_id', 'college_id'])
            ->sortBy(fn (Proposal $p) => [$p->college?->name, $p->award?->grant_reference])
            ->values();

        $settings = DB::table('app_settings')->whereIn('key', ['organization_name'])->pluck('value', 'key');

        return Pdf::loadView('pdf.award-register', [
            'proposals' => $proposals,
            'byCollege' => $this->totalsBy($proposals, fn (Proposal $p) => $p->college?->name ?? '—'),
            'year' => $request->year,
            'orgName' => $settings['organization_name'] ?? config('app.name'),
            'generatedBy' => $request->user()->name,
        ])->setPaper('a4', 'landscape')->download('award-register'.($request->year ? '-'.$request->year : '').'.pdf');
    }

    /** Funded proposals the user may see. */
    private function scoped(Request $request): Builder
    {
        $query = Proposal::query()->whereIn('proposals.status', self::FUNDED)->with('award');

        return $request->user()->accessScope()->constrain($query);
    }

    /** @return Collection<string, array{count: int, total: float}> */
    private function totalsBy(Collection $proposals, callable $key): Collection
    {
        return $proposals->groupBy($key)->map(fn (Collection $g) => [
            'count' => $g->count(),
            'total' => round((float) $g->sum(fn (Proposal $p) => (float) ($p->award?->awarded_amount ?? 0)), 2),
        ])->sortKeys();
    }
}
