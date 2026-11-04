<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\RevertedBlindReviewService;
use App\Support\AuditLogger;
use App\Support\Programmes;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RejectedProposalController extends Controller
{
    /**
     * How a proposal can end up rejected, keyed by the workflow action that rejected it.
     *
     * @var array<string, string>
     */
    private const KINDS = [
        'validation' => 'Rejected at validation',
        'before_review' => 'Rejected before review',
        'blind_review' => 'Failed blind review',
        'open_defence' => 'Failed open defence',
        'no_show' => 'Team did not appear for defence',
        'central' => 'Rejected by central committee',
        'funding_revoked' => 'Funding revoked',
        'unknown' => 'No rejection on record',
    ];

    /**
     * Where Reopen takes a proposal back to, and what an officer may need to do next.
     *
     * @var array<string, array{label: string, next: ?string}>
     */
    private const RESTORE_TO = [
        'submitted' => ['label' => 'Submitted — awaiting validation', 'next' => null],
        'validated' => ['label' => 'Validated — awaiting reviewers', 'next' => 'Assign blind reviewers.'],
        'under_blind_review' => ['label' => 'Blind review', 'next' => 'Check its reviewers — unfinished ones were cancelled.'],
        'blind_review_passed' => ['label' => 'Passed blind review', 'next' => 'Schedule the open defence.'],
        'under_open_defence' => ['label' => 'Open defence', 'next' => 'Check the panel — unfinished scores were cancelled.'],
        'accepted' => ['label' => 'Accepted — awaiting funding decision', 'next' => null],
        'funded' => ['label' => 'Funded', 'next' => 'Check the contract and disbursements.'],
    ];

    /**
     * Every rejected proposal in the user's scope, with how, when and by whom it was
     * rejected and where reopening would take it back to. Restoring goes through the
     * existing POST /proposals/{id}/reopen, which needs proposals.reopen.
     * College and category officers are scoped by the college.scope / category.scope
     * middleware; client filters can only narrow further.
     */
    public function index(Request $request, RevertedBlindReviewService $blindReviews): JsonResponse
    {
        $user = $request->user();
        if (! $user?->can('proposals.reopen') && ! $user?->can('pipeline.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $academicYear = $request->filled('academic_year')
            ? $request->academic_year
            : DB::table('app_settings')->where('key', 'current_academic_year')->value('value');

        $proposals = Proposal::query()
            ->with(['pi:id,name', 'college:id,name'])
            ->where('status', 'rejected')
            ->when($academicYear && $academicYear !== 'all', fn ($q) => $q->where('academic_year', $academicYear))
            ->when($request->_college_scope ?: $request->college_id, fn ($q, $id) => $q->where('college_id', $id))
            ->when($request->_category_scope ?: $request->category, fn ($q, $category) => $q->where('category', $category))
            ->get(['id', 'tracker_number', 'title', 'category', 'academic_year', 'pi_user_id', 'college_id', 'rejection_reason', 'rejected_at', 'updated_at']);

        // The latest rejection of each proposal decides how it was rejected and where it goes back to.
        $rejections = DB::table('workflow_logs')
            ->leftJoin('users', 'users.id', '=', 'workflow_logs.actor_id')
            ->whereIn('workflow_logs.proposal_id', $proposals->pluck('id'))
            ->where('workflow_logs.to_stage', 'rejected')
            ->orderBy('workflow_logs.created_at')
            ->get(['workflow_logs.proposal_id', 'workflow_logs.from_stage', 'workflow_logs.action', 'workflow_logs.notes', 'workflow_logs.metadata', 'workflow_logs.created_at', 'users.name as actor'])
            ->keyBy('proposal_id');

        $rows = $proposals->map(function (Proposal $p) use ($rejections) {
            $log = $rejections[$p->id] ?? null;
            $meta = $log?->metadata ? (json_decode($log->metadata, true) ?: []) : [];
            $kind = $this->kind($log?->action, $log?->from_stage, $meta);
            $restore = $log?->from_stage ? (self::RESTORE_TO[$log->from_stage] ?? ['label' => ucwords(str_replace('_', ' ', $log->from_stage)), 'next' => null]) : null;

            return [
                'id' => $p->id,
                'tracker_number' => $p->tracker_number,
                'title' => $p->title,
                'category' => $p->category,
                'programme' => Programmes::label($p->category),
                'academic_year' => $p->academic_year,
                'pi' => $p->pi?->name,
                'college' => $p->college?->name,
                'kind' => $kind,
                'kind_label' => self::KINDS[$kind],
                'automatic' => (bool) ($meta['automatic'] ?? false),
                'rejected_at' => $log?->created_at ?? $p->rejected_at?->toDateTimeString(),
                'rejected_by' => ($meta['automatic'] ?? false) ? 'System (score below pass mark)' : $log?->actor,
                'reason' => $log?->notes ?: $p->rejection_reason,
                'restorable' => $restore !== null,
                'restore_to' => $log?->from_stage,
                'restore_to_label' => $restore['label'] ?? null,
                'restore_next' => $restore['next'] ?? null,
            ];
        })->sortByDesc('rejected_at')->values();

        return response()->json([
            'data' => [
                'academic_year' => $academicYear ?: 'all',
                'academic_years' => Proposal::whereNotNull('academic_year')->where('status', '!=', 'draft')->distinct()->orderByDesc('academic_year')->pluck('academic_year'),
                'kinds' => self::KINDS,
                'counts' => $rows->countBy('kind'),
                'can_restore' => $user->can('proposals.reopen'),
                'proposals' => $rows,
                'unapplied' => $this->unapplied($request, $academicYear, $blindReviews),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Apply a blind review result that was never applied: the proposal was sent back to
     * validated while a reviewer had already submitted. It returns to blind review and the
     * normal decision runs on the submitted reviews — so it passes on to open defence, waits
     * for an officer (more reviewers or a disagreement), or is rejected below the pass mark.
     */
    public function restoreBlindReview(Request $request, string $id, RevertedBlindReviewService $blindReviews): JsonResponse
    {
        $user = $request->user();
        if (! $user?->can('proposals.reopen')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $proposal = $blindReviews->stuck(fn ($q) => $this->scoped($q, $request)->whereKey($id))->first();
        if (! $proposal) {
            return response()->json(['data' => null, 'message' => 'This proposal has no blind review result waiting to be applied.', 'errors' => [], 'meta' => []], 422);
        }

        try {
            $restored = $blindReviews->restore($proposal, $user);
        } catch (\Throwable $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        AuditLogger::log('proposal.blind_review_restored', Proposal::class, $proposal->id, $user->id, ['status' => 'validated'], ['status' => $restored->status]);

        return response()->json([
            'data' => ['status' => $restored->status],
            'message' => match ($restored->status) {
                'blind_review_passed' => 'Blind review result applied — the proposal passed and is ready for open defence.',
                'rejected' => 'Blind review result applied — the proposal was below the pass mark and has been rejected.',
                default => 'Returned to blind review — an officer needs to add reviewers or settle a disagreement.',
            },
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Validated proposals holding a submitted blind review that was never applied.
     *
     * @return list<array<string, mixed>>
     */
    private function unapplied(Request $request, ?string $academicYear, RevertedBlindReviewService $blindReviews): array
    {
        $outcomes = [
            'pass' => 'Passes → ready for open defence',
            'fail' => 'Below the pass mark → will be rejected',
            'needs_reviewers' => 'Back to blind review — the call needs more reviewers',
            'disagreement' => 'Back to blind review — reviewers disagree',
            'manual' => 'Back to blind review — a second opinion needs an officer',
            'waiting' => 'Back to blind review — waiting for a reviewer',
        ];

        return $blindReviews
            ->stuck(fn ($q) => $this->scoped($q, $request)
                ->when($academicYear && $academicYear !== 'all', fn ($q) => $q->where('academic_year', $academicYear))
                ->with(['pi:id,name', 'college:id,name']))
            ->map(function (Proposal $p) use ($blindReviews, $outcomes) {
                $prediction = $blindReviews->predict($p);
                $revert = DB::table('workflow_logs')->leftJoin('users', 'users.id', '=', 'workflow_logs.actor_id')
                    ->where('workflow_logs.proposal_id', $p->id)->where('workflow_logs.to_stage', 'validated')
                    ->orderByDesc('workflow_logs.created_at')->first(['workflow_logs.created_at', 'users.name as actor']);

                return [
                    'id' => $p->id,
                    'tracker_number' => $p->tracker_number,
                    'title' => $p->title,
                    'programme' => Programmes::label($p->category),
                    'academic_year' => $p->academic_year,
                    'pi' => $p->pi?->name,
                    'college' => $p->college?->name,
                    'submitted' => $prediction['submitted'],
                    'required' => $prediction['required'],
                    'score_label' => $prediction['score_label'],
                    'threshold' => $prediction['threshold'],
                    'outcome' => $prediction['outcome'],
                    'outcome_label' => $outcomes[$prediction['outcome']] ?? $prediction['outcome'],
                    'reverted_at' => $revert?->created_at,
                    'reverted_by' => $revert?->actor,
                ];
            })->values()->all();
    }

    /**
     * @param  Builder<Proposal>  $query
     * @return Builder<Proposal>
     */
    private function scoped($query, Request $request)
    {
        return $query
            ->when($request->_college_scope ?: $request->college_id, fn ($q, $id) => $q->where('college_id', $id))
            ->when($request->_category_scope ?: $request->category, fn ($q, $category) => $q->where('category', $category));
    }

    /** @param  array<string, mixed>  $meta */
    private function kind(?string $action, ?string $fromStage, array $meta): string
    {
        return match (true) {
            $action === null => 'unknown',
            $action === 'reject' => $fromStage === 'submitted' ? 'validation' : 'before_review',
            $action === 'fail_blind_review' => 'blind_review',
            $action === 'fail_defence' => ($meta['no_show'] ?? false) ? 'no_show' : 'open_defence',
            $action === 'central_reject' => 'central',
            $action === 'revoke_funding' => 'funding_revoked',
            default => 'unknown',
        };
    }
}
