<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Proposal;
use App\Support\PdfAssets;
use App\Support\Terms;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CollegePhaseCompletionController extends Controller
{
    /**
     * Per-phase config: which proposals belong to the phase at all (`entered` — the
     * stage a proposal must have reached: validated for blind review, passed blind
     * review for open defence — and `passed`, the stage after the phase), which
     * evaluation-type name prefix a proposal must have a review assignment against
     * to count as "assigned", which status means "still awaiting a decision", and
     * which workflow_logs action means the rejection happened AT this phase.
     *
     * @var array<string, array{label: string, entered: string, passed: string, eval_prefix: string, undecided_status: string, reject_action: string}>
     */
    private const PHASES = [
        'blind_review' => [
            'label' => 'Blind Review',
            'entered' => 'validated',
            'passed' => 'blind_review_passed',
            'eval_prefix' => 'blind_review',
            'undecided_status' => 'under_blind_review',
            'reject_action' => 'fail_blind_review',
        ],
        'open_defence' => [
            'label' => 'Open Defence',
            'entered' => 'blind_review_passed',
            'passed' => 'accepted',
            'eval_prefix' => 'open_defence',
            'undecided_status' => 'under_open_defence',
            'reject_action' => 'fail_defence',
        ],
    ];

    /** Workflow order of the stages a proposal moves through after validation. */
    private const STAGE_ORDER = [
        'validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence',
        'accepted', 'funded', 'midterm_evaluation', 'completed', 'archived',
    ];

    /**
     * Per-college, per-phase completion: of the proposals that reached a phase
     * (validated ones for blind review, ones that passed blind review for open
     * defence), what share have a decision there (passed or rejected) vs. are
     * still outstanding — either no reviewer assigned yet, or assigned but not
     * decided. Proposals still awaiting validation, rejected before the phase, or
     * granted as legacy projects without review are not part of the phase.
     * College and category officers are scoped via the college.scope / category.scope
     * middleware (_college_scope / _category_scope) exactly like ProposalPipelineController
     * — client-supplied college_id/category filters can only narrow further.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('phase_completion.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $academicYear = $this->resolveAcademicYear($request);
        $colleges = $this->collegeRows($request, $academicYear);

        $academicYears = Proposal::whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->where('status', '!=', 'draft')
            ->distinct()
            ->orderByDesc('academic_year')
            ->pluck('academic_year');

        return response()->json([
            'data' => [
                'academic_year' => $academicYear,
                'academic_years' => $academicYears,
                'phase_labels' => collect(self::PHASES)->map(fn ($c) => $c['label']),
                'colleges' => $colleges,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * The same report as a printable PDF — the filters on the page (academic year,
     * college, category) and the phase tab shown, colleges ordered as on screen.
     */
    public function export(Request $request): Response|JsonResponse
    {
        if (! $request->user()?->can('phase_completion.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $filters = $request->validate([
            'phase' => 'nullable|in:both,blind_review,open_defence',
            'academic_year' => 'nullable|string|max:20',
            'college_id' => 'nullable|string',
            'category' => 'nullable|string|max:50',
        ]);

        $academicYear = $this->resolveAcademicYear($request);
        $phaseKeys = match ($filters['phase'] ?? 'both') {
            'blind_review' => ['blind_review'],
            'open_defence' => ['open_defence'],
            default => array_keys(self::PHASES),
        };

        $colleges = $this->collegeRows($request, $academicYear)
            ->sortByDesc(fn (array $c) => collect($phaseKeys)
                ->map(fn ($key) => $c['phases'][$key]['completion_pct'])
                ->filter(fn ($pct) => $pct !== null)
                ->min() ?? -1)
            ->values();

        $overall = collect($phaseKeys)->mapWithKeys(function (string $key) use ($colleges) {
            $sum = fn (string $field) => $colleges->sum(fn ($c) => $c['phases'][$key][$field]);
            $total = $sum('total');

            return [$key => [
                'label' => self::PHASES[$key]['label'],
                'total' => $total,
                'reviewed' => $sum('reviewed'),
                'rejected' => $sum('rejected'),
                'pending' => $sum('pending'),
                'unassigned' => $sum('unassigned'),
                'completion_pct' => $total > 0 ? round((($sum('reviewed') + $sum('rejected')) / $total) * 100, 1) : null,
                'colleges_done' => $colleges->filter(fn ($c) => $c['phases'][$key]['completion_pct'] == 100)->count(),
            ]];
        });

        $collegeId = $request->_college_scope ?: ($filters['college_id'] ?? null);
        $category = $request->_category_scope ?: ($filters['category'] ?? null);
        $settings = DB::table('app_settings')->whereIn('key', ['organization_name', 'system_name', 'system_logo'])->pluck('value', 'key');

        return Pdf::loadView('pdf.college-phase-completion', [
            'colleges' => $colleges,
            'overall' => $overall,
            'phaseKeys' => $phaseKeys,
            'phaseLabels' => collect(self::PHASES)->map(fn ($c) => $c['label']),
            'scope' => [
                Terms::academicYear() => $academicYear ?? 'All years',
                Terms::college() => $collegeId ? (College::whereKey($collegeId)->value('name') ?? '—') : 'All '.strtolower(Terms::college(true)),
                'Category' => $category ? ucwords(str_replace('_', ' ', $category)) : 'All categories',
            ],
            'orgName' => $settings['organization_name'] ?? 'Wolaita Sodo University',
            'systemName' => $settings['system_name'] ?? 'RTT Platform',
            'logo' => PdfAssets::embeddedImage($settings['system_logo'] ?? null),
            'generatedAt' => now(),
        ])->setPaper('a4', 'portrait')->download('college-phase-completion-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * One row per active college in scope, with its breakdown for every phase.
     *
     * @return Collection<int, array{college_id: string, college_name: string, total_proposals: int, phases: array<string, array<string, mixed>>}>
     */
    private function collegeRows(Request $request, ?string $academicYear): Collection
    {
        $collegesQuery = College::query()->where('status', 'active')->select('id', 'name')->orderBy('name');
        if ($request->_college_scope) {
            $collegesQuery->where('id', $request->_college_scope);
        } elseif ($request->filled('college_id')) {
            $collegesQuery->where('id', $request->college_id);
        }

        return $collegesQuery->get()->map(function (College $college) use ($request, $academicYear) {
            $base = $this->scopedProposalsQuery($request, $academicYear, $college->id);
            $total = (clone $base)->count();

            $phases = [];
            foreach (self::PHASES as $key => $config) {
                $inPhase = $this->reachedPhase((clone $base), $config);
                $phases[$key] = $this->phaseBreakdown($inPhase, (clone $inPhase)->count(), $config);
            }

            return [
                'college_id' => $college->id,
                'college_name' => $college->name,
                'total_proposals' => $total,
                'phases' => $phases,
            ];
        })->values();
    }

    private function resolveAcademicYear(Request $request): ?string
    {
        return $request->filled('academic_year')
            ? $request->academic_year
            : (DB::table('app_settings')->where('key', 'current_academic_year')->value('value') ?? null);
    }

    private function scopedProposalsQuery(Request $request, ?string $academicYear, string $collegeId): Builder
    {
        $base = Proposal::query()
            ->whereNull('proposals.deleted_at')
            ->where('proposals.status', '!=', 'draft')
            ->where('proposals.college_id', $collegeId);

        if ($academicYear) {
            $base->where('proposals.academic_year', $academicYear);
        }

        if ($request->_category_scope) {
            $base->where('proposals.category', $request->_category_scope);
        } elseif ($request->filled('category')) {
            $base->where('proposals.category', $request->category);
        }

        return $base;
    }

    /**
     * Proposals that took part in this phase: currently at or beyond the stage that
     * opens it, or rejected after reaching it — either at this phase or after
     * passing it. Rejections before the phase (validation, a confirmed mistaken
     * approval, failing blind review for open defence) and legacy grants are left out.
     *
     * @param  array{label: string, entered: string, passed: string, eval_prefix: string, undecided_status: string, reject_action: string}  $config
     */
    private function reachedPhase(Builder $proposals, array $config): Builder
    {
        $atOrBeyond = array_slice(self::STAGE_ORDER, array_search($config['entered'], self::STAGE_ORDER, true));

        return $proposals
            ->where(function (Builder $q) use ($atOrBeyond, $config) {
                $q->whereIn('proposals.status', $atOrBeyond)
                    ->orWhere(fn (Builder $rejected) => $rejected->where('proposals.status', 'rejected')
                        ->where(fn (Builder $why) => $why
                            ->whereExists(fn ($log) => $log->from('workflow_logs')
                                ->whereColumn('workflow_logs.proposal_id', 'proposals.id')
                                ->where('workflow_logs.to_stage', $config['passed']))
                            ->orWhereRaw(
                                '(select wl.action from workflow_logs wl where wl.proposal_id = proposals.id and wl.to_stage = ? order by wl.created_at desc limit 1) = ?',
                                ['rejected', $config['reject_action']]
                            )));
            })
            ->whereNotExists(fn ($log) => $log->from('workflow_logs')
                ->whereColumn('workflow_logs.proposal_id', 'proposals.id')
                ->where('workflow_logs.action', 'grant_legacy'));
    }

    /**
     * @param  array{label: string, entered: string, passed: string, eval_prefix: string, undecided_status: string, reject_action: string}  $config
     * @return array{total: int, assigned: int, unassigned: int, reviewed: int, rejected: int, pending: int, completion_pct: float|null}
     */
    private function phaseBreakdown(Builder $scopedProposals, int $total, array $config): array
    {
        if ($total === 0) {
            return ['total' => 0, 'assigned' => 0, 'unassigned' => 0, 'reviewed' => 0, 'rejected' => 0, 'pending' => 0, 'completion_pct' => null];
        }

        // Undecided proposals are split by whether a reviewer is assigned for this phase.
        // Decided ones (passed or rejected here) are judged by where they stand, not by
        // their assignments — a no-show defence removes its panel's assignments yet is
        // still a decision, not a proposal waiting for a panel.
        $undecided = (clone $scopedProposals)
            ->whereIn('proposals.status', [$config['entered'], $config['undecided_status']])
            ->withExists(['reviewAssignments as has_phase_assignment' => fn (Builder $q) => $q->whereHas(
                'evaluationType', fn (Builder $q2) => $q2->where('name', 'like', $config['eval_prefix'].'%')
            )])
            ->get(['proposals.id', 'proposals.status']);

        $pending = $undecided->filter(fn (Proposal $p) => $p->status === $config['undecided_status'] && $p->has_phase_assignment)->count();
        // Never assigned a reviewer for this phase yet — still counts against
        // completion, it just hasn't even started, let alone finished.
        $unassigned = $undecided->count() - $pending;
        $assigned = $total - $unassigned;

        $rejectedIds = (clone $scopedProposals)->where('proposals.status', 'rejected')->pluck('proposals.id');

        $rejected = 0;
        if ($rejectedIds->isNotEmpty()) {
            // A proposal may have been rejected, reopened, and rejected again — only
            // the LATEST rejection log determines which phase actually caused the
            // current 'rejected' status (mirrors the rejectedVia pattern used on the
            // proposal detail page's workflow history).
            $latestRejectionActions = DB::table('workflow_logs')
                ->whereIn('proposal_id', $rejectedIds)
                ->where('to_stage', 'rejected')
                ->orderBy('created_at')
                ->get(['proposal_id', 'action'])
                ->groupBy('proposal_id')
                ->map(fn ($group) => $group->last()->action);

            $rejected = $latestRejectionActions->filter(fn ($action) => $action === $config['reject_action'])->count();
        }

        $reviewed = $assigned - $pending - $rejected;

        return [
            'total' => $total,
            'assigned' => $assigned,
            'unassigned' => $unassigned,
            'reviewed' => $reviewed,
            'rejected' => $rejected,
            'pending' => $pending,
            'completion_pct' => round((($reviewed + $rejected) / $total) * 100, 1),
        ];
    }
}
