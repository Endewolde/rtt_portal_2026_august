<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetMilestone;
use App\Models\Disbursement;
use App\Models\Proposal;
use App\Services\ResearchOutputService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * A funded project on one timeline: when it started and should end, its milestones,
 * the progress reports it owes, the midterm evaluation, fund releases and the
 * completion workshop — each marked done, due soon, overdue or later.
 */
class ProjectTimelineController extends Controller
{
    /** Due within this many days counts as "due soon". */
    private const SOON_DAYS = 30;

    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $query = Proposal::with(['award', 'midtermEvaluations', 'completionWorkshop', 'progressReports', 'budgetRequests'])
            ->whereIn('status', ResearchOutputService::RECORDABLE_STATUSES);
        // Same reach as the rest of the project's pages: the team, or officers within their scope.
        $user->accessScope()->constrain($query, 'proposals', fn ($q) => $q->where(fn ($q) => $q->where('pi_user_id', $user->id)
            ->orWhereHas('members', fn ($m) => $m->where('user_id', $user->id)->where('status', 'active'))));
        $proposal = $query->findOrFail($id);

        $start = $proposal->award?->approved_at ?? $proposal->award?->created_at ?? $proposal->updated_at;
        $plannedEnd = $proposal->duration_months ? $start->copy()->addMonths((int) $proposal->duration_months) : null;

        $items = collect()
            ->push(['kind' => 'start', 'label' => 'Project started (award approved)', 'date' => $start, 'done_at' => $start])
            ->merge($this->milestones($proposal))
            ->merge($proposal->progressReports->map(fn ($r) => [
                'kind' => 'report', 'label' => $r->is_final ? 'Final report' : "Progress report {$r->period_number}",
                'start' => $r->period_start, 'date' => $r->due_date,
                'done_at' => in_array($r->status, ['submitted', 'accepted'], true) ? ($r->submitted_at ?? $r->updated_at) : null,
            ]))
            ->merge($proposal->midtermEvaluations->map(fn ($m) => [
                'kind' => 'midterm', 'label' => 'Midterm evaluation'.($m->venue ? " — {$m->venue}" : ''), 'date' => $m->evaluation_date,
                'done_at' => in_array($m->status, ['scored', 'published', 'completed'], true) ? $m->evaluation_date : null,
            ]))
            ->merge($this->releases($proposal))
            ->when($proposal->completionWorkshop, fn ($c) => $c->push([
                'kind' => 'workshop', 'label' => 'Completion workshop', 'date' => $proposal->completionWorkshop->scheduled_date,
                'done_at' => $proposal->completionWorkshop->status === 'completed' ? $proposal->completionWorkshop->scheduled_date : null,
            ]))
            ->when($plannedEnd, fn ($c) => $c->push(['kind' => 'end', 'label' => 'Planned end', 'date' => $plannedEnd, 'done_at' => $proposal->status === 'completed' ? $plannedEnd : null]))
            ->filter(fn ($i) => $i['date'])
            ->map(fn ($i) => $this->present($i))
            ->sortBy('date')
            ->values();

        $dates = $items->pluck('date')->filter();

        return response()->json(['data' => [
            'project' => $proposal->only(['id', 'tracker_number', 'title', 'status', 'duration_months']),
            'from' => $dates->min(),
            'to' => $dates->max(),
            'today' => today()->toDateString(),
            'items' => $items,
            'summary' => $items->countBy('state'),
        ], 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function milestones(Proposal $proposal): Collection
    {
        return BudgetMilestone::where('proposal_id', $proposal->id)->orderBy('sort_order')->get()->map(fn ($m) => [
            'kind' => 'milestone', 'label' => $m->title, 'date' => $m->due_date, 'amount' => (float) $m->amount,
            'done_at' => $m->completed_at ?? ($m->status === 'completed' ? $m->updated_at : null),
        ]);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function releases(Proposal $proposal): Collection
    {
        return Disbursement::whereIn('budget_request_id', $proposal->budgetRequests->pluck('id'))->get()->map(fn ($d) => [
            'kind' => 'release', 'label' => 'Funds released', 'date' => $d->disbursed_at, 'done_at' => $d->disbursed_at, 'amount' => (float) $d->amount,
        ]);
    }

    /** @param  array<string, mixed>  $item */
    private function present(array $item): array
    {
        $date = Carbon::parse($item['date']);

        return [
            'kind' => $item['kind'],
            'label' => $item['label'],
            'start' => isset($item['start']) && $item['start'] ? Carbon::parse($item['start'])->toDateString() : null,
            'date' => $date->toDateString(),
            'done_at' => $item['done_at'] ? Carbon::parse($item['done_at'])->toDateString() : null,
            'amount' => $item['amount'] ?? null,
            'state' => match (true) {
                (bool) $item['done_at'] => 'done',
                $date->lt(today()) => 'overdue',
                $date->lte(today()->addDays(self::SOON_DAYS)) => 'due',
                default => 'later',
            },
        ];
    }
}
