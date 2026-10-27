<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\BlindReviewPhaseIncompleteException;
use App\Exceptions\UnauthorizedTransitionException;
use App\Exports\ReviewerPaymentExport;
use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendRawMailJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\College;
use App\Models\ConferenceAbstractReview;
use App\Models\DefenceSession;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalDocument;
use App\Models\ProposalMember;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use App\Services\DefenceDeadlineService;
use App\Services\DefenceSessionService;
use App\Services\MailConfigService;
use App\Services\ReviewAssignmentService;
use App\Services\ReviewerAgreementService;
use App\Services\ReviewerConflictService;
use App\Services\ReviewerMatchService;
use App\Services\ReviewScoreService;
use App\Services\WorkflowService;
use App\Support\AuditLogger;
use App\Support\Programmes;
use App\Support\RejectionReasons;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReviewController extends Controller
{
    public function __construct(
        private ReviewAssignmentService $assignmentService,
        private ReviewScoreService $scoreService,
        private DefenceSessionService $defenceService,
        private MailConfigService $mailConfig,
        private WorkflowService $workflowService
    ) {}

    public function availableReviewers(string $id, Request $request): JsonResponse
    {
        $filters = $request->only(['search', 'expertise', 'department_id', 'college_id', 'reviewer_type']);
        $reviewers = $this->assignmentService->getAvailableReviewers($id, $filters);

        return response()->json(['data' => $reviewers]);
    }

    public function assign(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'reviewer_ids' => 'required|array|min:1',
            'evaluation_type_id' => 'required|string',
            'due_date' => 'required|date|after:today',
            'override_workload_cap' => 'sometimes|boolean',
            'acknowledge_conflicts' => 'sometimes|boolean',
        ]);

        $proposal = Proposal::findOrFail($id);
        $assignments = $this->assignmentService->assign(
            $proposal,
            $request->reviewer_ids,
            $request->evaluation_type_id,
            $request->user(),
            [],
            $request->due_date,
            $request->boolean('override_workload_cap'),
            $request->boolean('acknowledge_conflicts')
        );

        AuditLogger::log(
            'review.assigned',
            Proposal::class,
            $proposal->id,
            $request->user()->id,
            null,
            ['tracker' => $proposal->tracker_number, 'reviewers' => count($request->reviewer_ids), 'due_date' => $request->due_date],
        );

        return response()->json(['data' => $assignments], 201);
    }

    public function submitScore(string $id, Request $request): JsonResponse
    {
        $request->validate(['answers' => 'required|array']);

        if ($blocked = $this->agreementRequired($request->user())) {
            return $blocked;
        }

        $assignment = ReviewAssignment::findOrFail($id);
        $result = $this->scoreService->submitScore($assignment, $request->answers, $request->user());

        AuditLogger::log(
            'review.score_submitted',
            ReviewAssignment::class,
            $assignment->id,
            $request->user()->id,
            null,
            ['proposal_id' => $assignment->proposal_id],
        );

        return response()->json(['data' => $result]);
    }

    /**
     * Manual admin action: reject a proposal currently under_blind_review or
     * blind_review_passed — for issues noticed during review that mean it should
     * never have reached this stage (duplicate, ineligible, etc.), not a scoring
     * problem (that's reviews:correct-blind-review's job).
     */
    /** Decide a proposal held for reviewer disagreement using the scores it has, with a moderation note. */
    public function decideDespiteDisagreement(string $id, Request $request): JsonResponse
    {
        if (! $request->user()->can('review_decisions.correct')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $validated = $request->validate(['notes' => 'required|string|min:10|max:2000']);
        $proposal = Proposal::findOrFail($id);

        if ($request->_category_scope && $proposal->category !== $request->_category_scope) {
            return response()->json(['data' => null, 'message' => 'You can only decide proposals in your own category.', 'errors' => [], 'meta' => []], 403);
        }

        try {
            $proposal = $this->scoreService->decideDespiteDisagreement($proposal, $request->user(), $validated['notes']);
        } catch (\RuntimeException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        return response()->json([
            'data' => ['status' => $proposal->status],
            'message' => 'Decided with the current scores — the proposal is now '.Proposal::statusLabel($proposal->status).'.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function rejectFromBlindReview(string $id, Request $request): JsonResponse
    {
        RejectionReasons::apply($request, 'blind_review');
        $request->validate(['reason' => 'required|string|min:10']);

        $proposal = Proposal::findOrFail($id);

        try {
            $result = $this->scoreService->rejectFromBlindReview($proposal, $request->user(), $request->reason);

            AuditLogger::log(
                'review.rejected_from_blind_review',
                Proposal::class,
                $proposal->id,
                $request->user()->id,
                null,
                ['reason' => $request->reason],
            );

            return response()->json(['data' => $result, 'message' => 'Proposal rejected and removed from blind review.', 'errors' => [], 'meta' => []]);
        } catch (UnauthorizedTransitionException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 403);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    /**
     * Reopen a rejected proposal for reconsideration — e.g. it was auto-rejected
     * under thresholds/decision-mode settings that have since changed. Sends it back
     * to whichever stage it was actually rejected from (see
     * WorkflowService::reopenRejectedProposal), preserving already-submitted scores.
     */
    public function reopen(string $id, Request $request): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:10|max:2000']);

        if (! $request->user()?->can('proposals.reopen')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $proposal = Proposal::findOrFail($id);

        try {
            $reopened = $this->workflowService->reopenRejectedProposal($proposal, $request->user(), $request->reason);

            AuditLogger::log('proposal.reopened', Proposal::class, $proposal->id, $request->user()->id, null, [
                'reason' => $request->reason,
                'returned_to' => $reopened->status,
            ]);

            return response()->json([
                'data' => $reopened,
                'message' => "Proposal reopened and returned to '{$reopened->status}' for reconsideration.",
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    /**
     * Read-only pre-check for the Schedule Defence page: tells a college officer up
     * front whether their college still has proposals in blind review, so the form
     * can explain why scheduling is on hold instead of failing on submit.
     */
    public function defenceReadiness(string $id, Request $request): JsonResponse
    {
        $proposal = Proposal::with('college:id,name')->findOrFail($id);
        $isGated = $this->defenceService->isBoundByCollegeBlindReviewGate($request->user());
        $pending = $isGated ? $this->defenceService->pendingBlindReviewProposals($proposal) : collect();

        return response()->json([
            'data' => [
                'can_schedule' => $pending->isEmpty(),
                'college_name' => $proposal->college?->name,
                'pending_blind_review' => $pending,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * College-wide pre-check for a college officer opening Open Defence: whether
     * their college (in the current academic year) still has proposals in blind
     * review. Never blocks roles that aren't held to the college gate.
     */
    public function collegeDefenceReadiness(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('college:id,name');
        $pending = collect();

        if ($this->defenceService->isBoundByCollegeBlindReviewGate($user)) {
            $academicYear = DB::table('app_settings')->where('key', 'current_academic_year')->value('value');
            $pending = $this->defenceService->pendingBlindReviewForCollege($user->college_id, $academicYear);
        }

        return response()->json([
            'data' => [
                'can_schedule' => $pending->isEmpty(),
                'college_name' => $user->college?->name,
                'pending_blind_review' => $pending,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** The active defence session and its reviewer panel (Schedule Defence page, edit mode). */
    public function defenceSession(string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $current = $this->defenceService->current($proposal);

        return response()->json([
            'data' => [
                'session' => $current['session'],
                'assignments' => $current['assignments']->map(fn (ReviewAssignment $a) => [
                    'id' => $a->id,
                    'reviewer_id' => $a->reviewer_id,
                    'reviewer' => $a->reviewer,
                    'status' => $a->status,
                    'evaluation_type_id' => $a->evaluation_type_id,
                ])->values(),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Update an open defence already under way: date, venue and reviewer panel. */
    public function updateDefence(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'scheduled_date' => 'required|date|after_or_equal:today',
            'scheduled_time' => 'required',
            'venue' => 'required|string|max:300',
            'online_link' => 'nullable|url',
            'reviewer_ids' => 'nullable|array',
            'reviewer_ids.*' => 'uuid|exists:users,id',
            'evaluation_type_id' => 'nullable|uuid|exists:evaluation_types,id',
            'override_workload_cap' => 'sometimes|boolean',
        ]);

        if (! $request->user()->can('open_defence.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $proposal = Proposal::findOrFail($id);

        try {
            $result = $this->defenceService->update($proposal, $validated, $request->user());
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        AuditLogger::log('defence.updated', Proposal::class, $proposal->id, $request->user()->id, null, [
            'scheduled_date' => $validated['scheduled_date'],
            'venue' => $validated['venue'],
            'reviewers_added' => $result['added'],
            'reviewers_removed' => $result['removed'],
        ]);

        $parts = array_filter([
            $result['added'] ? "{$result['added']} reviewer(s) added" : null,
            $result['removed'] ? "{$result['removed']} removed" : null,
        ]);
        $message = 'Open defence updated'.($parts ? ' — '.implode(', ', $parts) : '').'.';
        if ($result['kept_submitted'] !== []) {
            $message .= ' Kept '.implode(', ', $result['kept_submitted']).' — they already submitted a score.';
        }

        return response()->json(['data' => $result['session'], 'message' => $message, 'errors' => [], 'meta' => []]);
    }

    public function scheduleDefence(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'scheduled_date' => 'required|date|after:today',
            'scheduled_time' => 'required',
            'venue' => 'required|string|max:300',
            'online_link' => 'nullable|url',
            'reviewer_ids' => 'nullable|array',
            'reviewer_ids.*' => 'uuid|exists:users,id',
            'evaluation_type_id' => 'nullable|uuid|exists:evaluation_types,id',
        ]);

        $proposal = Proposal::findOrFail($id);

        try {
            $session = $this->defenceService->schedule($proposal, $request->all(), $request->user());

            return response()->json([
                'data' => $session,
                'message' => 'Open defence scheduled successfully.',
                'errors' => [],
                'meta' => [],
            ], 201);
        } catch (BlindReviewPhaseIncompleteException $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [
                    'reason' => 'blind_review_incomplete',
                    'college_name' => $e->collegeName,
                    'pending_blind_review' => $e->pendingProposals,
                ],
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
            ], 422);
        }
    }

    public function processDefenceResult(string $id, Request $request): JsonResponse
    {
        $session = DefenceSession::findOrFail($id);
        $proposal = $this->defenceService->processDefenceResult($session, $request->user());

        return response()->json(['data' => $proposal]);
    }

    public function processDefenceResultByProposal(string $id, Request $request): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);

        $session = DefenceSession::where('proposal_id', $proposal->id)
            ->where('status', 'scheduled')
            ->latest()
            ->first();

        if (! $session) {
            return response()->json([
                'data' => null,
                'message' => 'No active defence session found for this proposal.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        try {
            $updated = $this->defenceService->processDefenceResult($session, $request->user());

            return response()->json([
                'data' => ['status' => $updated->status],
                'message' => 'Defence result processed. New status: '.$updated->status,
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
            ], 422);
        }
    }

    public function evaluationTypes(Request $request): JsonResponse
    {
        $types = EvaluationType::withCount('categories')
            ->when(! $request->all_statuses, fn ($q) => $q->where('is_active', true))
            ->when($request->category, fn ($q) => $q->where('proposal_category', $request->category))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $types]);
    }

    public function storeEvaluationType(Request $request): JsonResponse
    {
        if (! $request->user()?->can('evaluation_criteria.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $request->validate([
            'name' => 'required|string|unique:evaluation_types,name',
            'label' => 'required|string',
            'proposal_category' => ['required', Rule::in(Programmes::keys())],
            'description' => 'nullable|string',
        ]);

        $type = EvaluationType::create($request->only('name', 'label', 'proposal_category', 'description') + ['is_active' => true]);

        return response()->json(['data' => $type, 'message' => 'Evaluation type created.', 'errors' => [], 'meta' => []]);
    }

    public function updateEvaluationType(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('evaluation_criteria.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $type = EvaluationType::findOrFail($id);
        $type->update($request->only('label', 'description', 'is_active'));

        return response()->json(['data' => $type->fresh(), 'message' => 'Updated.', 'errors' => [], 'meta' => []]);
    }

    public function evaluationCategories(string $id): JsonResponse
    {
        $categories = EvaluationCategory::where('evaluation_type_id', $id)
            ->withCount('questions')
            ->orderBy('order_index')
            ->get();

        return response()->json(['data' => $categories, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function storeCategory(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('evaluation_criteria.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $request->validate([
            'name' => 'required|string',
            'weight' => 'required|numeric|min:0|max:100',
        ]);

        $category = EvaluationCategory::create([
            'evaluation_type_id' => $id,
            'name' => $request->name,
            'description' => $request->description,
            'weight' => $request->weight,
            'order_index' => EvaluationCategory::where('evaluation_type_id', $id)->count(),
        ]);

        return response()->json(['data' => $category, 'message' => 'Category created.', 'errors' => [], 'meta' => []]);
    }

    public function updateCategory(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('evaluation_criteria.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $category = EvaluationCategory::findOrFail($id);
        $category->update($request->only('name', 'description', 'weight', 'order_index'));

        return response()->json(['data' => $category->fresh(), 'message' => 'Updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroyCategory(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('evaluation_criteria.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $category = EvaluationCategory::findOrFail($id);

        if ($category->questions()->count() > 0) {
            return response()->json([
                'data' => null,
                'message' => 'Cannot delete category with questions. Delete questions first.',
                'errors' => [],
            ], 422);
        }

        $category->delete();

        return response()->json(['data' => null, 'message' => 'Category deleted.', 'errors' => [], 'meta' => []]);
    }

    public function evaluationQuestions(string $id): JsonResponse
    {
        $questions = EvaluationQuestion::where('evaluation_category_id', $id)
            ->orderBy('order_index')
            ->get();

        return response()->json(['data' => $questions, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function storeQuestion(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('evaluation_criteria.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $request->validate([
            'question_text' => 'required|string',
            'max_score' => 'required|integer|min:1|max:10',
            'weight' => 'nullable|numeric|min:0',
            'is_required' => 'boolean',
        ]);

        $question = EvaluationQuestion::create([
            'evaluation_category_id' => $id,
            'question_text' => $request->question_text,
            'max_score' => $request->max_score,
            'weight' => $request->weight ?? 1,
            'is_required' => $request->is_required ?? true,
            'order_index' => EvaluationQuestion::where('evaluation_category_id', $id)->count(),
        ]);

        return response()->json(['data' => $question, 'message' => 'Question created.', 'errors' => [], 'meta' => []]);
    }

    public function updateQuestion(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('evaluation_criteria.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $question = EvaluationQuestion::findOrFail($id);
        $question->update($request->only('question_text', 'max_score', 'weight', 'is_required', 'order_index'));

        return response()->json(['data' => $question->fresh(), 'message' => 'Updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroyQuestion(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('evaluation_criteria.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        EvaluationQuestion::findOrFail($id)->delete();

        return response()->json(['data' => null, 'message' => 'Question deleted.', 'errors' => [], 'meta' => []]);
    }

    public function proposalReviewResults(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::with(['reviewAssignments.scores.evaluationQuestion'])->findOrFail($id);

        $isOwner = $user->id === $proposal->pi_user_id
            || $proposal->members()->where('user_id', $user->id)->where('status', 'active')->exists();
        $isStaff = $user->can('review_results.view');

        if (! $isOwner && ! $isStaff) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $submitted = $proposal->reviewAssignments->filter(fn ($a) => $a->status === 'submitted');
        // Only the office rates reviews; the research team never sees who wrote which.
        $canRate = $user->can('reviews.rate_quality') && $user->accessScope()->covers($proposal->college_id, $proposal->category);

        $reviews = $submitted->map(function ($assignment) use ($canRate) {
            $scores = $assignment->scores;
            $display = $this->scoreService->calculateWeightedDisplay($assignment);
            $recommendation = $scores->whereNotNull('recommendation')->last()?->recommendation;

            $comments = $scores->map(fn ($s) => [
                'question' => $s->evaluationQuestion?->question_text ?? null,
                'comment' => $s->comment,
                'score' => $s->score,
            ])->filter(fn ($c) => $c['comment'])->values();

            return [
                // Set aside after a second opinion: shown, but not counted in the blind score.
                'set_aside' => (bool) $assignment->set_aside_at,
                'second_opinion' => (bool) $assignment->is_second_opinion,
                'overall_score' => $scores->isNotEmpty() ? $display['score'] : null,
                'overall_max' => $scores->isNotEmpty() ? $display['max'] : null,
                'recommendation' => $recommendation,
                'comments' => $comments,
            ] + ($canRate ? ['assignment_id' => $assignment->id, 'quality_rating' => $assignment->quality_rating] : []);
        })->values();

        $scored = $reviews->whereNotNull('overall_score')->where('set_aside', false);

        // The phase scores the decisions are made on: blind (out of its weight sum),
        // defence, and combined (blind + defence, out of 100 with the standard weights).
        $snapshot = $this->scoreService->recalculateSnapshot($proposal);

        return response()->json([
            'data' => [
                'total_reviews' => $proposal->reviewAssignments->count(),
                'submitted_reviews' => $submitted->count(),
                'scores' => [
                    'blind' => $snapshot['blind'],
                    'defence' => $snapshot['defence'],
                    'combined' => $snapshot['defence'] !== null ? round((float) $snapshot['combined'], 2) : null,
                    'combined_max' => $snapshot['defence'] !== null ? round((float) $snapshot['combined_max'], 2) : null,
                ],
                'average_score' => $scored->isNotEmpty() ? min(round($scored->avg('overall_score'), 2), (float) $scored->first()['overall_max']) : null,
                'average_max' => $scored->isNotEmpty() ? $scored->first()['overall_max'] : null,
                'reviews' => $reviews,
                'can_rate' => $canRate,
            ],
            'message' => '',
            'errors' => [],
        ]);
    }

    /** The office rates a submitted review: 3 useful, 2 adequate, 1 thin, or null to clear. */
    public function rateQuality(Request $request, string $id): JsonResponse
    {
        $assignment = ReviewAssignment::with('proposal:id,college_id,category')->findOrFail($id);
        $user = $request->user();

        if (! $user->can('reviews.rate_quality') || ! $user->accessScope()->covers($assignment->proposal?->college_id, $assignment->proposal?->category)) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }
        if ($assignment->status !== 'submitted') {
            return response()->json(['data' => null, 'message' => 'Only submitted reviews can be rated.', 'errors' => []], 422);
        }

        $rating = $request->validate(['rating' => ['nullable', 'integer', 'between:1,3']])['rating'] ?? null;
        $assignment->update([
            'quality_rating' => $rating,
            'quality_rated_by' => $rating ? $user->id : null,
            'quality_rated_at' => $rating ? now() : null,
        ]);

        return response()->json(['data' => ['assignment_id' => $assignment->id, 'quality_rating' => $rating], 'message' => $rating ? 'Review rated.' : 'Rating cleared.', 'errors' => []]);
    }

    /** The signed-in reviewer's own quality record: how their reviews were rated. */
    public function myQuality(Request $request): JsonResponse
    {
        $ratings = ReviewAssignment::where('reviewer_id', $request->user()->id)->whereNotNull('quality_rating')->pluck('quality_rating');

        return response()->json(['data' => [
            'rated' => $ratings->count(),
            'average' => $ratings->isEmpty() ? null : round($ratings->avg(), 2),
            'useful' => $ratings->filter(fn ($r) => $r === 3)->count(),
            'adequate' => $ratings->filter(fn ($r) => $r === 2)->count(),
            'thin' => $ratings->filter(fn ($r) => $r === 1)->count(),
        ], 'message' => '', 'errors' => []]);
    }

    /**
     * Live, read-only recalculation of a proposal's blind/defence/combined scores
     * against the CURRENT threshold settings and CURRENT evaluation-criteria weights.
     * Never cached — lets staff confirm a proposal's numbers (and its pass/fail
     * verdicts) are correct at any time, including after thresholds or evaluation
     * criteria were edited following an earlier automatic decision. Does not mutate
     * anything; it does not re-run the workflow transition.
     */
    public function recalculateReviewScore(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::findOrFail($id);

        if (! $user->can('review_results.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $request->validate(['phase' => 'nullable|in:blind_review,open_defence']);
        $snapshot = $this->scoreService->recalculateSnapshot($proposal);

        return response()->json([
            'data' => array_merge($snapshot, [
                'phase' => $request->phase,
                'proposal_status' => $proposal->status,
                'recalculated_at' => now()->toIso8601String(),
                'corrections' => $this->scoreService->previewDecisionCorrections($proposal, $request->phase),
                'can_apply_corrections' => $user->can('review_decisions.correct'),
            ]),
            'message' => '',
            'errors' => [],
        ]);
    }

    /**
     * Apply the corrections the recalculation found for this one proposal — the
     * manual, per-proposal counterpart of the automatic recalculation that runs when
     * thresholds are saved. Limited to roles allowed to run the pass/fail transitions.
     */
    public function applyRecalculatedDecision(string $id, Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->can('review_decisions.correct')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $request->validate(['phase' => 'nullable|in:blind_review,open_defence']);
        $proposal = Proposal::findOrFail($id);
        $result = $this->scoreService->applyDecisionCorrections($proposal, $user, $request->phase);

        AuditLogger::log(
            'proposal.decision_recalculated',
            Proposal::class,
            $proposal->id,
            $user->id,
            null,
            ['corrected' => $result['corrected'], 'needs_review' => $result['needs_review']],
        );

        $message = match (true) {
            ! empty($result['corrected']) => 'Decision corrected: '.collect($result['corrected'])->pluck('change')->implode(', ').'.',
            ! empty($result['needs_review']) => 'The decision could not be corrected automatically — '.$result['needs_review'][0]['reason'].'.',
            default => 'The recorded decision already matches the current thresholds — nothing to correct.',
        };

        return response()->json([
            'data' => array_merge($result, ['proposal_status' => $proposal->fresh()->status]),
            'message' => $message,
            'errors' => [],
            'meta' => [],
        ], empty($result['needs_review']) ? 200 : 422);
    }

    public function proposalReviewList(Request $request): JsonResponse
    {
        $rawStatus = $request->input('status', 'under_blind_review');
        $statuses = array_filter(array_map('trim', explode(',', $rawStatus)));

        // Only what the Blind Review / Open Defence pages show — no abstracts, wizard
        // drafts or per-question scores, which made these lists slow to load.
        $query = Proposal::select([
            'id', 'tracker_number', 'title', 'category', 'status', 'academic_year', 'college_id', 'pi_user_id',
            'proposal_call_id', 'submitted_at', 'validated_at', 'status_entered_at', 'updated_at',
            'review_disagreement_flagged_at', 'review_disagreement_resolved_at',
        ])->with([
            'pi:id,name,email',
            'college:id,name',
            'proposalCall:id,title,end_date',
            'reviewAssignments' => fn ($q) => $q->select([
                'id', 'proposal_id', 'reviewer_id', 'evaluation_type_id', 'status', 'assigned_at', 'due_date',
                'submitted_at', 'is_second_opinion', 'set_aside_at', 'is_external',
            ]),
            'reviewAssignments.reviewer:id,name,email',
            'reviewAssignments.reviewer.roles:id,name',
            'reviewAssignments.evaluationType:id,name,label',
        ])->orderByDesc('updated_at');

        count($statuses) === 1
            ? $query->where('status', $statuses[0])
            : $query->whereIn('status', $statuses);

        // College officers only see their own college's proposals
        if ($request->_college_scope) {
            $query->where('college_id', $request->_college_scope);
        }

        // Research/community/technology officers only see their own category's proposals
        if ($request->_category_scope) {
            $query->where('category', $request->_category_scope);
        }

        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $proposals = $query->get();

        // Open defence score deadline (end of the day after the defence, or an
        // approved extension) + extension state, for the Open Defence page.
        if (in_array('under_open_defence', $statuses, true)) {
            $deadlines = app(DefenceDeadlineService::class);
            $sessions = DefenceSession::whereIn('proposal_id', $proposals->where('status', 'under_open_defence')->pluck('id'))
                ->where('status', 'scheduled')
                ->latest()
                ->get()
                ->unique('proposal_id')
                ->keyBy('proposal_id');

            $proposals->each(fn (Proposal $p) => $p->setAttribute(
                'defence_deadline',
                $deadlines->present($sessions->get($p->id), $request->user())
            ));
        }

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** College officers can only ever see their own college — overrides whatever the client sends. */
    private function resolveCollegeScope(Request $request): ?string
    {
        $scope = $request->user()->accessScope();

        return $scope->isCollege() ? $scope->collegeId : $request->college_id;
    }

    public function reviewerWorkload(Request $request): JsonResponse
    {
        if (! $request->user()?->can('reviewer_workload.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $collegeId = $this->resolveCollegeScope($request);

        $assignments = ReviewAssignment::with([
            'proposal:id,title,tracker_number,college_id,academic_year',
            'proposal.college:id,name',
            'reviewer:id,name,email',
            'reviewer.roles:id,name',
            'evaluationType:id,name,label',
        ])
            ->when($collegeId, fn ($q) => $q->whereHas(
                'proposal',
                fn ($p) => $p->where('college_id', $collegeId)
            ))
            ->orderBy('assigned_at', 'desc')
            ->get();

        return response()->json(['data' => $assignments, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /**
     * Reviewer payment report (Excel): every review assignment with the reviewer's
     * completed / not-completed totals, plus a per-reviewer payment summary. Uses the
     * Reviewer Workload filters; college officers only ever get their own college.
     */
    public function reviewerPaymentReport(Request $request): BinaryFileResponse|JsonResponse
    {
        if (! $request->user()?->can('reviewer_workload.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $request->validate([
            'college_id' => 'nullable|uuid',
            'academic_year' => 'nullable|string|max:20',
            'review_type' => 'nullable|in:all,blind,open',
            'reviewer_type' => 'nullable|in:all,internal,external',
        ]);

        $collegeId = $this->resolveCollegeScope($request);
        $reviewType = $request->input('review_type', 'all');
        $reviewerType = $request->input('reviewer_type', 'all');
        $year = $request->input('academic_year');

        $assignments = ReviewAssignment::with([
            'proposal:id,title,tracker_number,college_id,academic_year',
            'proposal.college:id,name',
            'reviewer:id,name,email',
            'reviewer.roles:id,name',
            'evaluationType:id,name,label',
        ])
            ->when($collegeId, fn ($q) => $q->whereHas('proposal', fn ($p) => $p->where('college_id', $collegeId)))
            ->when($year, fn ($q) => $q->whereHas('proposal', fn ($p) => $p->where('academic_year', $year)))
            ->when($reviewType !== 'all', fn ($q) => $q->whereHas(
                'evaluationType',
                fn ($t) => $t->where('name', 'like', ($reviewType === 'blind' ? 'blind_review' : 'open_defence').'%')
            ))
            ->when($reviewerType !== 'all', fn ($q) => $reviewerType === 'external'
                ? $q->whereHas('reviewer.roles', fn ($r) => $r->where('name', 'external_reviewer'))
                : $q->whereDoesntHave('reviewer.roles', fn ($r) => $r->where('name', 'external_reviewer')))
            ->get();

        $scope = collect([
            $collegeId ? (College::find($collegeId)?->name ?? 'College') : 'All colleges',
            $year ? "Academic year {$year}" : 'All years',
            ['all' => 'All review types', 'blind' => 'Blind review', 'open' => 'Open defence'][$reviewType],
            ['all' => 'All reviewers', 'internal' => 'Internal reviewers', 'external' => 'External reviewers'][$reviewerType],
        ])->implode(' · ');

        AuditLogger::log('report.reviewer_payment_exported', User::class, $request->user()->id, $request->user()->id, null, [
            'scope' => $scope, 'rows' => $assignments->count(),
        ]);

        return Excel::download(
            new ReviewerPaymentExport($assignments, $scope),
            'reviewer_payment_report_'.now()->format('Ymd_His').'.xlsx'
        );
    }

    public function reviewerAnalytics(Request $request): JsonResponse
    {
        if (! $request->user()?->can('reviewer_workload.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $collegeId = $this->resolveCollegeScope($request);

        $query = ReviewAssignment::with([
            'reviewer:id,name,email',
            'reviewer.roles:id,name',
            'scores:id,review_assignment_id,score,evaluation_question_id',
            'evaluationType.categories.questions',
        ])
            ->when($collegeId, fn ($q) => $q->whereHas(
                'proposal',
                fn ($p) => $p->where('college_id', $collegeId)
            ));

        $assignments = $query->get([
            'id', 'reviewer_id', 'status', 'assigned_at', 'due_date', 'submitted_at', 'evaluation_type_id',
        ]);

        // Weighted score % per submitted assignment, grouped by evaluation type — the
        // baseline for "normal" varies a lot between e.g. blind review and open defence,
        // so leniency is measured against peers scoring the SAME evaluation type, not a
        // single global average.
        $weightedPctByAssignment = [];
        $peerPctsByEvaluationType = [];
        foreach ($assignments->where('status', 'submitted') as $a) {
            $display = $this->scoreService->calculateWeightedDisplay($a);
            if ($display['max'] <= 0) {
                continue;
            }
            $pct = round(($display['score'] / $display['max']) * 100, 1);
            $weightedPctByAssignment[$a->id] = $pct;
            $peerPctsByEvaluationType[$a->evaluation_type_id][] = $pct;
        }
        $peerAvgByEvaluationType = collect($peerPctsByEvaluationType)
            ->map(fn ($pcts) => round(array_sum($pcts) / count($pcts), 1));

        $grouped = $assignments->groupBy('reviewer_id');

        // Abstracts have no college, so they're only folded in for the unfiltered view.
        $abstractGrouped = $collegeId
            ? collect()
            : ConferenceAbstractReview::query()->get(['id', 'reviewer_id', 'score', 'submitted_at', 'created_at'])->groupBy('reviewer_id');

        $stats = $grouped->map(function ($items) use ($abstractGrouped, $weightedPctByAssignment, $peerAvgByEvaluationType) {
            $reviewer = $items->first()->reviewer;
            $total = $items->count();
            $completed = $items->where('status', 'submitted')->count();
            $declined = $items->where('status', 'declined')->count();
            $pending = $items->whereIn('status', ['pending', 'in_progress'])->count();
            $overdue = $items->filter(fn ($a) => ! in_array($a->status, ['submitted', 'declined'])
                && $a->due_date
                && now()->greaterThan($a->due_date)
            )->count();

            $completedItems = $items->where('status', 'submitted')->filter(fn ($a) => $a->submitted_at && $a->assigned_at);
            $avgDays = $completedItems->isNotEmpty()
                ? round($completedItems->avg(fn ($a) => $a->assigned_at->diffInDays($a->submitted_at)))
                : null;

            $onTimeCount = $items->where('status', 'submitted')->filter(fn ($a) => $a->submitted_at && $a->due_date && $a->submitted_at->lte($a->due_date)
            )->count();
            $onTimeRate = $completed > 0 ? round(($onTimeCount / $completed) * 100) : null;

            $allScores = $items->flatMap(fn ($a) => $a->scores)->pluck('score')->filter();
            $avgScore = $allScores->isNotEmpty() ? round($allScores->avg(), 1) : null;

            // Weighted % (normalized against each question's max score) — a fairer
            // basis for cross-reviewer comparison than the raw avg_score above, which
            // is skewed by differing question max scores between evaluation types.
            $pcts = $completedItems
                ->map(fn ($a) => $weightedPctByAssignment[$a->id] ?? null)
                ->filter(fn ($p) => $p !== null);
            $avgScorePct = $pcts->isNotEmpty() ? round($pcts->avg(), 1) : null;

            // Leniency: average of (this reviewer's % − the peer average % for the same
            // evaluation type) across their scored assignments. Positive = scores higher
            // than peers on the same rubric; negative = scores lower (stricter).
            $deltas = $completedItems
                ->filter(fn ($a) => isset($weightedPctByAssignment[$a->id], $peerAvgByEvaluationType[$a->evaluation_type_id]))
                ->map(fn ($a) => $weightedPctByAssignment[$a->id] - $peerAvgByEvaluationType[$a->evaluation_type_id]);
            $leniencyDelta = $deltas->isNotEmpty() ? round($deltas->avg(), 1) : null;

            // A reviewer needs at least a few data points before a rate is meaningful —
            // one missed deadline out of one assignment shouldn't read the same as a
            // pattern. "At risk" = missing over 30% of deadlines, or declining over a
            // fifth of assignments, once there's enough history to judge that from.
            $riskFlag = ($completed >= 3 && $onTimeRate !== null && $onTimeRate < 70)
                || ($total >= 3 && ($declined / $total) > 0.2);

            $bucketLabels = ['0-19', '20-39', '40-59', '60-79', '80-100'];
            $buckets = array_fill_keys($bucketLabels, 0);
            foreach ($pcts as $pct) {
                $index = min((int) floor($pct / 20), 4);
                $buckets[$bucketLabels[$index]]++;
            }

            // Abstract reviews have no due date, so "overdue"/"on-time" don't apply to them —
            // kept as a separate block rather than blended into the proposal-review numbers above.
            $abstractItems = $abstractGrouped->get($reviewer?->id, collect());
            $abstractTotal = $abstractItems->count();
            $abstractCompleted = $abstractItems->whereNotNull('submitted_at')->count();
            $abstractPending = $abstractTotal - $abstractCompleted;
            $abstractScores = $abstractItems->pluck('score')->filter();
            $abstractAvgScore = $abstractScores->isNotEmpty() ? round($abstractScores->avg(), 1) : null;

            return [
                'reviewer_id' => $reviewer?->id,
                'reviewer' => $reviewer ? [
                    'id' => $reviewer->id,
                    'name' => $reviewer->name,
                    'email' => $reviewer->email,
                    'roles' => $reviewer->roles->map(fn ($r) => ['id' => $r->id, 'name' => $r->name])->values(),
                ] : null,
                'total' => $total,
                'completed' => $completed,
                'pending' => $pending,
                'overdue' => $overdue,
                'declined' => $declined,
                'avg_days' => $avgDays,
                'on_time_rate' => $onTimeRate,
                'avg_score' => $avgScore,
                'avg_score_pct' => $avgScorePct,
                'leniency_delta' => $leniencyDelta,
                'risk_flag' => $riskFlag,
                'score_distribution' => $buckets,
                'abstract_reviews' => [
                    'total' => $abstractTotal,
                    'completed' => $abstractCompleted,
                    'pending' => $abstractPending,
                    'avg_score' => $abstractAvgScore,
                ],
                'combined_total' => $total + $abstractTotal,
                'combined_pending' => $pending + $abstractPending,
                'combined_completed' => $completed + $abstractCompleted,
            ];
        })->values();

        // Reviewers who only have abstract assignments (no proposal reviews at all) still
        // need a row, since combined_pending should reflect all their outstanding work.
        $proposalReviewerIds = $grouped->keys();
        $abstractOnlyGroups = $abstractGrouped
            ->reject(fn ($items, $reviewerId) => $proposalReviewerIds->contains($reviewerId));
        $abstractOnlyReviewers = User::with('roles:id,name')
            ->whereIn('id', $abstractOnlyGroups->keys())
            ->get()
            ->keyBy('id');
        $abstractOnlyStats = $abstractOnlyGroups
            ->map(function ($items) use ($abstractOnlyReviewers) {
                $reviewer = $abstractOnlyReviewers->get($items->first()->reviewer_id);
                $abstractTotal = $items->count();
                $abstractCompleted = $items->whereNotNull('submitted_at')->count();
                $abstractPending = $abstractTotal - $abstractCompleted;
                $abstractScores = $items->pluck('score')->filter();
                $abstractAvgScore = $abstractScores->isNotEmpty() ? round($abstractScores->avg(), 1) : null;

                return [
                    'reviewer_id' => $reviewer?->id,
                    'reviewer' => $reviewer ? [
                        'id' => $reviewer->id,
                        'name' => $reviewer->name,
                        'email' => $reviewer->email,
                        'roles' => $reviewer->roles->map(fn ($r) => ['id' => $r->id, 'name' => $r->name])->values(),
                    ] : null,
                    'total' => 0,
                    'completed' => 0,
                    'pending' => 0,
                    'overdue' => 0,
                    'declined' => 0,
                    'avg_days' => null,
                    'on_time_rate' => null,
                    'avg_score' => null,
                    'avg_score_pct' => null,
                    'leniency_delta' => null,
                    'risk_flag' => false,
                    'score_distribution' => null,
                    'abstract_reviews' => [
                        'total' => $abstractTotal,
                        'completed' => $abstractCompleted,
                        'pending' => $abstractPending,
                        'avg_score' => $abstractAvgScore,
                    ],
                    'combined_total' => $abstractTotal,
                    'combined_pending' => $abstractPending,
                    'combined_completed' => $abstractCompleted,
                ];
            })
            ->values();

        $stats = $stats->concat($abstractOnlyStats)->values();

        $totalReviewers = $stats->count();
        $avgCompletionRate = $stats->isNotEmpty()
            ? round($stats->avg(fn ($s) => $s['total'] > 0 ? ($s['completed'] / $s['total']) * 100 : 0))
            : 0;
        $totalOverdue = $stats->sum('overdue');
        $avgDaysAll = $stats->filter(fn ($s) => $s['avg_days'] !== null);
        $avgDaysGlobal = $avgDaysAll->isNotEmpty() ? round($avgDaysAll->avg('avg_days')) : null;
        $totalAbstractPending = $stats->sum(fn ($s) => $s['abstract_reviews']['pending']);
        $totalAtRisk = $stats->where('risk_flag', true)->count();

        return response()->json([
            'data' => [
                'summary' => [
                    'total_reviewers' => $totalReviewers,
                    'avg_completion_rate' => $avgCompletionRate,
                    'total_overdue' => $totalOverdue,
                    'avg_days_to_complete' => $avgDaysGlobal,
                    'total_abstract_pending' => $totalAbstractPending,
                    'total_at_risk' => $totalAtRisk,
                ],
                'reviewers' => $stats,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function reassignReviewer(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'new_reviewer_id' => 'required|uuid|exists:users,id',
            'due_date' => 'required|date|after:today',
            'override_workload_cap' => 'sometimes|boolean',
            'acknowledge_conflicts' => 'sometimes|boolean',
        ]);

        $assignment = ReviewAssignment::with('evaluationType')->findOrFail($id);
        $proposal = Proposal::findOrFail($assignment->proposal_id);

        $isTeamMember = ProposalMember::where('proposal_id', $assignment->proposal_id)
            ->where('user_id', $request->new_reviewer_id)
            ->where('status', 'active')
            ->exists();

        $isPrincipalInvestigator = $proposal->pi_user_id === $request->new_reviewer_id;

        if ($isTeamMember || $isPrincipalInvestigator) {
            return response()->json([
                'data' => null,
                'message' => 'This user is the Principal Investigator or a team member and cannot review this proposal.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $this->assignmentService->ensureWithinWorkloadCap([$request->new_reviewer_id], $request->boolean('override_workload_cap'));

        $acknowledged = str_starts_with((string) $assignment->evaluationType?->name, 'blind_review')
            ? app(ReviewerConflictService::class)->ensureAcknowledged($proposal, [$request->new_reviewer_id], $request->boolean('acknowledge_conflicts'))
            : [];

        $oldReviewerId = $assignment->reviewer_id;
        $assignment->update([
            'acknowledged_conflicts' => $acknowledged[$request->new_reviewer_id] ?? null,
            'reviewer_id' => $request->new_reviewer_id,
            'status' => 'pending',
            'due_date' => $request->due_date,
            'submitted_at' => null,
            // Reassigning a reviewer who declared a conflict is how officers resolve it —
            // mark it resolved so it drops off the COI conflicts dashboard.
            'coi_resolved_at' => $assignment->coi_has_conflict && ! $assignment->coi_resolved_at
                ? now()
                : $assignment->coi_resolved_at,
        ]);

        ReviewScore::where('review_assignment_id', $assignment->id)->delete();

        AuditLogger::log(
            'review.reassigned',
            ReviewAssignment::class,
            $assignment->id,
            $request->user()->id,
            ['reviewer_id' => $oldReviewerId],
            ['reviewer_id' => $request->new_reviewer_id, 'due_date' => $request->due_date],
        );

        // Notify the newly assigned reviewer
        $newReviewer = User::find($request->new_reviewer_id);
        if ($newReviewer) {
            $reviewType = str_contains($assignment->evaluationType?->name ?? '', 'open_defence')
                ? 'Open Defence'
                : 'Blind Review';

            $data = [
                'tracker_number' => $proposal->tracker_number,
                'proposal_title' => $proposal->title,
                'review_type' => $reviewType,
                'due_date' => $assignment->due_date,
                'reassigned' => true,
            ];

            if ($newReviewer->email) {
                SendRawMailJob::deliver(
                    view('emails.notifications.review_assignment', array_merge($data, ['recipient' => $newReviewer]))->render(),
                    $newReviewer->email,
                    $newReviewer->name,
                    "{$reviewType} Assignment (Reassigned) — {$proposal->tracker_number}"
                );
            }

            try {
                StoreInAppNotificationJob::dispatchSync($newReviewer->id, 'review_assignment', $data);
            } catch (\Exception $e) {
                Log::error("In-app reassignment notification failed for {$newReviewer->id}: ".$e->getMessage());
            }
        }

        return response()->json([
            'data' => $assignment->fresh()->load('reviewer'),
            'message' => 'Reviewer reassigned successfully.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Running blind review or open defence for this proposal's college or category. */
    private function canAddReviewers(User $user, Proposal $proposal): bool
    {
        return $user->canAny(['reviews.manage', 'review_decisions.correct'])
            && $user->accessScope()->covers($proposal->college_id, $proposal->category);
    }

    /**
     * Reviewers suggested for a second opinion while the blind reviewers disagree:
     * best expertise match first, leaving out everyone already reviewing it and
     * flagging possible conflicts and full workloads.
     */
    public function secondOpinionSuggestions(Request $request, string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);

        if (! $this->canAddReviewers($request->user(), $proposal)) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $assigned = ReviewAssignment::where('proposal_id', $id)->whereNotIn('status', ['declined'])->pluck('reviewer_id')->all();
        ['reviewers' => $ranked] = app(ReviewerMatchService::class)->rank($proposal, $assigned, 8);

        // Clean matches with room in their workload first; external reviewers break ties.
        $ranked = $ranked->sortBy([
            fn ($a, $b) => (count($a['conflicts']) > 0 || $a['at_capacity']) <=> (count($b['conflicts']) > 0 || $b['at_capacity']),
            fn ($a, $b) => $b['composite_score'] <=> $a['composite_score'],
            fn ($a, $b) => $b['is_external'] <=> $a['is_external'],
        ])->values();

        return response()->json(['data' => $ranked, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function addReviewer(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'reviewer_id' => 'required|uuid|exists:users,id',
            'due_date' => 'required|date|after:today',
            'override_workload_cap' => 'sometimes|boolean',
            'acknowledge_conflicts' => 'sometimes|boolean',
        ]);

        $proposal = Proposal::findOrFail($id);

        if (! $this->canAddReviewers($request->user(), $proposal)) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        // Asked for while the blind reviewers disagree: this reviewer is the second opinion.
        $isSecondOpinion = $proposal->status === 'under_blind_review'
            && $proposal->review_disagreement_flagged_at
            && ! $proposal->review_disagreement_resolved_at;

        if ($isSecondOpinion) {
            $pending = ReviewAssignment::where('proposal_id', $id)->where('is_second_opinion', true)
                ->whereIn('status', ['pending', 'accepted', 'in_progress'])->with('reviewer:id,name')->first();
            if ($pending) {
                return response()->json([
                    'data' => null,
                    'message' => "A second opinion has already been requested from {$pending->reviewer?->name}. Remove that reviewer first to ask someone else.",
                    'errors' => [],
                    'meta' => [],
                ], 422);
            }
        }

        if (! in_array($proposal->status, ['under_blind_review', 'under_open_defence'])) {
            return response()->json([
                'data' => null,
                'message' => 'Reviewers can only be added while the proposal is under blind review or open defence.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $reviewer = User::find($request->reviewer_id);
        if (! $reviewer || $reviewer->status !== 'active') {
            return response()->json([
                'data' => null,
                'message' => 'This user account is inactive and cannot be assigned as a reviewer.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $isTeamMember = ProposalMember::where('proposal_id', $id)
            ->where('user_id', $request->reviewer_id)
            ->where('status', 'active')
            ->exists();

        if ($isTeamMember || $proposal->pi_user_id === $request->reviewer_id) {
            return response()->json([
                'data' => null,
                'message' => 'This user is the Principal Investigator or a team member and cannot review this proposal.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $this->assignmentService->ensureWithinWorkloadCap([$request->reviewer_id], $request->boolean('override_workload_cap'));

        $acknowledgedConflicts = $proposal->status === 'under_blind_review'
            ? app(ReviewerConflictService::class)->ensureAcknowledged($proposal, [$request->reviewer_id], $request->boolean('acknowledge_conflicts'))
            : [];

        $alreadyAssigned = ReviewAssignment::where('proposal_id', $id)
            ->where('reviewer_id', $request->reviewer_id)
            ->whereNotIn('status', ['declined'])
            ->exists();

        if ($alreadyAssigned) {
            return response()->json([
                'data' => null,
                'message' => 'This reviewer is already assigned to this proposal.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        // Same phase as the proposal is in — a proposal in open defence also has blind
        // review assignments, and copying one of those would add a "defence" reviewer
        // who never counts toward the defence.
        $phasePrefix = $proposal->status === 'under_open_defence' ? 'open_defence' : 'blind_review';
        $evalType = ReviewAssignment::where('proposal_id', $id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', $phasePrefix.'%'))
            ->value('evaluation_type_id');

        if (! $evalType) {
            return response()->json([
                'data' => null,
                'message' => 'No '.str_replace('_', ' ', $phasePrefix).' evaluation type is set for this proposal yet — use Schedule Defence to choose one.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $assignment = ReviewAssignment::create([
            'proposal_id' => $id,
            'reviewer_id' => $request->reviewer_id,
            'evaluation_type_id' => $evalType,
            'assigned_by' => $request->user()->id,
            'status' => 'pending',
            'assigned_at' => now(),
            'due_date' => $request->due_date ?? now()->addDays(14)->toDateString(),
            'acknowledged_conflicts' => $acknowledgedConflicts[$request->reviewer_id] ?? null,
            'is_second_opinion' => $isSecondOpinion,
        ]);

        if ($isSecondOpinion) {
            $proposal->forceFill(['review_disagreement' => array_merge($proposal->review_disagreement ?? [], [
                'second_opinion' => [
                    'reviewer' => $reviewer->name,
                    'requested_by' => $request->user()->name,
                    'requested_at' => now()->toIso8601String(),
                    'due_date' => $assignment->due_date?->toDateString(),
                ],
            ])])->saveQuietly();
        }

        $reviewType = $proposal->status === 'under_open_defence' ? 'Open Defence' : 'Blind Review';
        if ($reviewer) {
            $data = [
                'tracker_number' => $proposal->tracker_number,
                'proposal_title' => $proposal->title,
                'review_type' => $reviewType,
                'due_date' => $assignment->due_date,
            ];

            if ($reviewer->email) {
                SendRawMailJob::deliver(
                    view('emails.notifications.review_assignment', array_merge($data, ['recipient' => $reviewer]))->render(),
                    $reviewer->email,
                    $reviewer->name,
                    "{$reviewType} Assignment — {$proposal->tracker_number}"
                );
            }

            try {
                StoreInAppNotificationJob::dispatchSync($reviewer->id, 'review_assignment', $data);
            } catch (\Exception $e) {
                Log::error("Add reviewer notification failed for {$reviewer->id}: ".$e->getMessage());
            }
        }

        return response()->json([
            'data' => $assignment->fresh()->load('reviewer'),
            'message' => 'Reviewer added successfully.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function removeReviewer(string $id, Request $request): JsonResponse
    {
        $assignment = ReviewAssignment::with(['proposal', 'evaluationType:id,name'])->findOrFail($id);

        if (in_array($assignment->status, ['submitted'])) {
            return response()->json([
                'data' => null,
                'message' => 'Cannot remove a reviewer who has already submitted their review.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $proposal = $assignment->proposal;
        $isDefence = str_starts_with((string) $assignment->evaluationType?->name, 'open_defence');

        // An open defence can't be left without a panel: there would be no one to score it.
        if ($isDefence && $proposal?->status === 'under_open_defence') {
            $othersOnPanel = ReviewAssignment::where('proposal_id', $proposal->id)
                ->where('id', '!=', $assignment->id)
                ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
                ->whereNotIn('status', ['declined', 'cancelled'])
                ->exists();

            if (! $othersOnPanel) {
                return response()->json([
                    'data' => null,
                    'message' => 'This is the last panel member. Add another reviewer before removing this one.',
                    'errors' => [],
                    'meta' => [],
                ], 422);
            }
        }

        $assignment->delete();

        // Removing the last blind reviewer would otherwise leave the proposal stuck at
        // under_blind_review with nobody assigned — revert it so it can be assigned again.
        // If others have already submitted, the removal may instead complete the review.
        if ($proposal && $proposal->status === 'under_blind_review') {
            $remaining = ReviewAssignment::where('proposal_id', $proposal->id)
                ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'blind_review%'))
                ->whereIn('status', ['pending', 'accepted', 'in_progress', 'submitted'])
                ->exists();

            if (! $remaining) {
                try {
                    $this->workflowService->transition(
                        $proposal,
                        'unassign_reviewers',
                        $request->user(),
                        'All reviewers removed — reverted to validated.'
                    );
                } catch (\Exception $e) {
                    Log::error("Failed to revert proposal to validated after last reviewer removed: {$e->getMessage()}");
                }
            }
        }

        // The removed reviewer may have been the only one still to score.
        try {
            if ($proposal) {
                $this->scoreService->processBlindReviewResult($proposal->fresh());
                $this->scoreService->processOpenDefenceResultIfComplete($proposal->fresh());
            }
        } catch (\Throwable $e) {
            Log::error("Automatic result after reviewer removal failed: {$e->getMessage()}");
        }

        return response()->json([
            'data' => null,
            'message' => 'Reviewer removed successfully.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function extendDueDate(Request $request, string $id): JsonResponse
    {
        $request->validate(['due_date' => 'required|date|after:today']);
        $assignment = ReviewAssignment::findOrFail($id);
        $oldDue = $assignment->due_date;
        $assignment->update(['due_date' => $request->due_date]);

        AuditLogger::log(
            'review.due_extended',
            ReviewAssignment::class,
            $assignment->id,
            $request->user()->id,
            ['due_date' => $oldDue],
            ['due_date' => $request->due_date],
        );

        return response()->json([
            'data' => $assignment->fresh(),
            'message' => 'Due date extended.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function myAssignments(Request $request): JsonResponse
    {
        $assignments = ReviewAssignment::with([
            'proposal.college',
            'evaluationType',
            'scores.evaluationQuestion.category',
        ])
            ->where('reviewer_id', $request->user()->id)
            ->orderByDesc('assigned_at')
            ->get()
            ->map(function ($a) {
                if ($a->proposal) {
                    $a->proposal->setRelation('pi', null);
                    unset($a->proposal->pi_user_id);
                }

                return $a;
            });

        return response()->json(['data' => $assignments]);
    }

    public function showAssignment(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $isOwnReview = ReviewAssignment::whereKey($id)->where('reviewer_id', $user->id)->exists();

        // Only the assigned reviewer, or the officers who manage reviews, may open an assignment.
        if (! $isOwnReview && ! $user->can('review_results.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }
        if ($isOwnReview && ($blocked = $this->agreementRequired($user))) {
            return $blocked;
        }

        $assignment = ReviewAssignment::with([
            'proposal.college',
            'proposal.documents',
            'proposal.budgets',
            'proposal.members',
            'evaluationType.categories.questions',
            'scores',
        ])->findOrFail($id);

        // Blind review — hide PI identity from the reviewer
        if ($assignment->proposal) {
            $proposal = $assignment->proposal;
            $proposal->makeHidden(['pi_user_id']);
            $proposal->setRelation('pi', (object) ['name' => 'Anonymous Researcher', 'email' => null]);
            $memberCount = $proposal->members->count();
            $proposal->makeHidden(['members']);
            $proposal->setAttribute('members_count', $memberCount);

            // Reviewers only need the proposal document and budget spreadsheet to
            // score — other uploads (PI CV, supporting docs) aren't relevant to
            // scoring and can carry identifying info.
            $proposal->setRelation(
                'documents',
                $proposal->documents->whereIn('document_type', ProposalDocument::REVIEWER_VISIBLE_TYPES)->values()
            );
        }

        // Attach defence session for open-defence assignments so the frontend
        // can gate access until the scheduled date is reached.
        $data = $assignment->toArray();
        if (str_starts_with($assignment->evaluationType?->name ?? '', 'open_defence')) {
            $session = DefenceSession::where('proposal_id', $assignment->proposal_id)
                ->where('status', 'scheduled')
                ->latest()
                ->first();

            $data['defence_session'] = $session ? [
                'scheduled_date' => $session->scheduled_date?->toDateString(),
                'scheduled_time' => $session->scheduled_time,
                'venue' => $session->venue,
                'score_deadline' => $session->scoreDeadline()->toIso8601String(),
                'deadline_extended' => $session->score_deadline_extended_until !== null,
                'deadline_passed' => now()->gt($session->scoreDeadline()),
                'deadline_passed_message' => ReviewScoreService::DEFENCE_DEADLINE_PASSED_MESSAGE,
                'attendance' => $session->attendance,
                'absence_reported' => $session->absence_reported_at !== null,
                'absence_reported_by_me' => $session->absence_reported_by === $request->user()?->id,
            ] : null;
        }

        return response()->json(['data' => $data]);
    }

    /** A reviewer must accept this year's confidentiality agreement before opening or scoring a proposal. */
    private function agreementRequired(User $user): ?JsonResponse
    {
        if (app(ReviewerAgreementService::class)->hasAccepted($user)) {
            return null;
        }

        return response()->json([
            'data' => null,
            'message' => 'Please accept the reviewer confidentiality agreement for this academic year before opening proposals to review.',
            'errors' => [],
            'meta' => ['code' => 'agreement_required'],
        ], 403);
    }

    public function declareCoi(string $id, Request $request): JsonResponse
    {
        $assignment = ReviewAssignment::with(['proposal:id,tracker_number,title', 'assignedBy'])->findOrFail($id);

        if ($assignment->reviewer_id !== $request->user()->id) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        if ($assignment->coi_declared_at) {
            return response()->json(['data' => $assignment, 'message' => 'COI already declared.']);
        }

        $validated = $request->validate([
            'has_conflict' => ['sometimes', 'boolean'],
            'reason' => ['required_if:has_conflict,true', 'nullable', 'string', 'max:1000'],
        ]);

        $hasConflict = $validated['has_conflict'] ?? false;

        $assignment->update([
            'coi_declared_at' => now(),
            'coi_has_conflict' => $hasConflict,
            'coi_reason' => $hasConflict ? $validated['reason'] : null,
        ]);

        if ($hasConflict) {
            $this->notifyConflictDeclared($assignment->fresh(['proposal', 'assignedBy']), $request->user());
        }

        return response()->json([
            'data' => $assignment->fresh(),
            'message' => $hasConflict
                ? 'Conflict reported. The assigning officer has been notified to reassign this review.'
                : 'Conflict of interest declaration recorded.',
        ]);
    }

    /**
     * Officer-facing dashboard: review assignments with a reported, unresolved COI —
     * awaiting a reviewer reassignment. Resolved automatically when the assignment is
     * reassigned (see reassignReviewer()).
     */
    public function coiConflicts(Request $request): JsonResponse
    {
        if (! $request->user()->can('conflicts.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $query = ReviewAssignment::with([
            'proposal:id,tracker_number,title,category,college_id',
            'proposal.college:id,name',
            'reviewer:id,name,email',
            'assignedBy:id,name',
        ])
            ->where('coi_has_conflict', true)
            ->whereNull('coi_resolved_at')
            ->whereHas('proposal', function ($q) use ($request) {
                if ($request->_college_scope) {
                    $q->where('college_id', $request->_college_scope);
                }
                if ($request->_category_scope) {
                    $q->where('category', $request->_category_scope);
                }
            })
            ->orderBy('coi_declared_at');

        return response()->json(['data' => $query->get(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    private function notifyConflictDeclared(ReviewAssignment $assignment, User $reviewer): void
    {
        $officer = $assignment->assignedBy;
        if (! $officer?->email) {
            return;
        }

        $data = [
            'tracker_number' => $assignment->proposal?->tracker_number,
            'title' => $assignment->proposal?->title,
            'reviewer_name' => $reviewer->name,
            'reason' => $assignment->coi_reason,
        ];

        try {
            StoreInAppNotificationJob::dispatchSync($officer->id, 'review_coi_conflict', $data);
            SendRawMailJob::deliver(
                "<p>Dear {$officer->name},</p><p><strong>{$reviewer->name}</strong> has declared a conflict of interest reviewing <strong>{$assignment->proposal?->title}</strong> ({$assignment->proposal?->tracker_number}) and will not be scoring it.</p><p><strong>Reason given:</strong> ".e($assignment->coi_reason).'</p><p>Please reassign this review to another reviewer.</p>',
                $officer->email,
                $officer->name,
                "Reviewer Conflict of Interest — {$assignment->proposal?->tracker_number}"
            );
        } catch (\Exception $e) {
            Log::error("COI conflict notify failed: {$e->getMessage()}");
        }
    }

    public function respondInvitation(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'response' => ['required', 'in:accepted,declined'],
        ]);

        $member = ProposalMember::with(['proposal.pi', 'user'])->findOrFail($id);

        if ($member->user_id !== $request->user()->id) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        if ($member->invitation_status !== 'pending') {
            return response()->json(['data' => null, 'message' => 'Invitation already responded to.'], 422);
        }

        $member->update([
            'invitation_status' => $validated['response'],
            'invitation_responded_at' => now(),
        ]);

        $response = $validated['response'];
        $coPI = $member->user;
        $proposal = $member->proposal;
        $pi = $proposal?->pi;
        $verb = $response === 'accepted' ? 'accepted' : 'declined';
        $verbLabel = $response === 'accepted' ? 'Accepted' : 'Declined';

        // Notify PI via email
        if ($pi && $pi->email) {
            $emailData = [
                'recipient' => $pi,
                'message' => "{$coPI->name} has {$verb} their co-investigator invitation on proposal \"{$proposal->title}\" ({$proposal->tracker_number}).",
            ];

            try {
                SendRawMailJob::deliver(
                    view('emails.notifications.generic', $emailData)->render(),
                    $pi->email,
                    $pi->name,
                    "Co-Investigator Invitation {$verbLabel} — {$proposal->tracker_number}"
                );
            } catch (\Exception $e) {
                Log::warning("Could not send co-PI response email to PI {$pi->id}: {$e->getMessage()}");
            }
        }

        // In-app notification to PI
        if ($pi) {
            try {
                StoreInAppNotificationJob::dispatchSync($pi->id, 'co_pi_response', [
                    'co_pi_name' => $coPI->name,
                    'response' => $response,
                    'proposal_id' => $proposal->id,
                    'tracker_number' => $proposal->tracker_number,
                    'proposal_title' => $proposal->title,
                ]);
            } catch (\Exception $e) {
                Log::warning("Could not send co-PI in-app notification to PI {$pi->id}: {$e->getMessage()}");
            }
        }

        return response()->json(['data' => $member->fresh(), 'message' => 'Invitation response recorded.']);
    }

    /** PI resends an invitation to a co-investigator who previously declined. */
    public function resendInvitation(string $id, Request $request): JsonResponse
    {
        $member = ProposalMember::with(['proposal.pi', 'user'])->findOrFail($id);
        $proposal = $member->proposal;

        if (! $proposal || $proposal->pi_user_id !== $request->user()->id) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        if ($member->role !== 'co_investigator' || $member->status !== 'active') {
            return response()->json(['data' => null, 'message' => 'This person is not an active co-investigator on this proposal.'], 422);
        }

        if ($member->invitation_status !== 'declined') {
            return response()->json(['data' => null, 'message' => 'Only a declined invitation can be resent.'], 422);
        }

        $member->update([
            'invitation_status' => 'pending',
            'invitation_responded_at' => null,
        ]);

        $coI = $member->user;
        if ($coI) {
            $data = [
                'tracker_number' => $proposal->tracker_number,
                'title' => $proposal->title,
                'pi_name' => $proposal->pi?->name ?? 'the PI',
            ];

            if ($coI->email) {
                try {
                    SendEmailNotificationJob::deliver($coI, 'co_investigator_notified', $data);
                } catch (\Exception $e) {
                    Log::warning("Could not resend co-investigator invitation email to {$coI->email}: {$e->getMessage()}");
                }
            }

            try {
                StoreInAppNotificationJob::dispatchSync($coI->id, 'co_investigator_notified', $data);
            } catch (\Exception $e) {
                Log::warning("Could not store resent co-investigator invitation notification for {$coI->id}: {$e->getMessage()}");
            }
        }

        return response()->json(['data' => $member->fresh(), 'message' => 'Invitation resent.']);
    }
}
