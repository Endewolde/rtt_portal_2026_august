<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\DefenceSession;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalMember;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use App\Services\DefenceSessionService;
use App\Services\MailConfigService;
use App\Services\ReviewAssignmentService;
use App\Services\ReviewScoreService;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ReviewController extends Controller
{
    public function __construct(
        private ReviewAssignmentService $assignmentService,
        private ReviewScoreService $scoreService,
        private DefenceSessionService $defenceService,
        private MailConfigService $mailConfig
    ) {}

    public function availableReviewers(string $id, Request $request): JsonResponse
    {
        $filters = $request->only(['search', 'expertise', 'department_id', 'college_id']);
        $reviewers = $this->assignmentService->getAvailableReviewers($id, $filters);

        return response()->json(['data' => $reviewers]);
    }

    public function assign(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'reviewer_ids' => 'required|array|min:1',
            'evaluation_type_id' => 'required|string',
            'due_date' => 'required|date|after:today',
        ]);

        $proposal = Proposal::findOrFail($id);
        $assignments = $this->assignmentService->assign(
            $proposal,
            $request->reviewer_ids,
            $request->evaluation_type_id,
            $request->user(),
            [],
            $request->due_date
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
        $request->validate([
            'name' => 'required|string|unique:evaluation_types,name',
            'label' => 'required|string',
            'proposal_category' => 'required|in:research,community_engagement,technology_transfer,innovation,other',
            'description' => 'nullable|string',
        ]);

        $type = EvaluationType::create($request->only('name', 'label', 'proposal_category', 'description') + ['is_active' => true]);

        return response()->json(['data' => $type, 'message' => 'Evaluation type created.', 'errors' => [], 'meta' => []]);
    }

    public function updateEvaluationType(Request $request, string $id): JsonResponse
    {
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
        $category = EvaluationCategory::findOrFail($id);
        $category->update($request->only('name', 'description', 'weight', 'order_index'));

        return response()->json(['data' => $category->fresh(), 'message' => 'Updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroyCategory(string $id): JsonResponse
    {
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
        $question = EvaluationQuestion::findOrFail($id);
        $question->update($request->only('question_text', 'max_score', 'weight', 'is_required', 'order_index'));

        return response()->json(['data' => $question->fresh(), 'message' => 'Updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroyQuestion(string $id): JsonResponse
    {
        EvaluationQuestion::findOrFail($id)->delete();

        return response()->json(['data' => null, 'message' => 'Question deleted.', 'errors' => [], 'meta' => []]);
    }

    public function proposalReviewList(Request $request): JsonResponse
    {
        $rawStatus = $request->input('status', 'under_blind_review');
        $statuses = array_filter(array_map('trim', explode(',', $rawStatus)));

        $query = Proposal::with([
            'pi:id,name,email',
            'college:id,name',
            'reviewAssignments.reviewer:id,name,email',
            'reviewAssignments.evaluationType:id,name,label',
            'reviewAssignments.scores',
        ])->orderByDesc('updated_at');

        count($statuses) === 1
            ? $query->where('status', $statuses[0])
            : $query->whereIn('status', $statuses);

        // College officers only see their own college's proposals
        if ($request->_college_scope) {
            $query->where('college_id', $request->_college_scope);
        }

        return response()->json(['data' => $query->get(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function reviewerWorkload(Request $request): JsonResponse
    {
        $assignments = ReviewAssignment::with([
            'proposal:id,title,tracker_number,college_id',
            'proposal.college:id,name',
            'reviewer:id,name,email',
            'evaluationType:id,name,label',
        ])
            ->when($request->college_id, fn ($q) => $q->whereHas(
                'proposal',
                fn ($p) => $p->where('college_id', $request->college_id)
            ))
            ->orderBy('assigned_at', 'desc')
            ->get();

        return response()->json(['data' => $assignments, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function reviewerAnalytics(Request $request): JsonResponse
    {
        $query = ReviewAssignment::with([
            'reviewer:id,name,email',
            'scores:id,review_assignment_id,score',
        ])
            ->when($request->college_id, fn ($q) => $q->whereHas(
                'proposal',
                fn ($p) => $p->where('college_id', $request->college_id)
            ));

        $assignments = $query->get([
            'id', 'reviewer_id', 'status', 'assigned_at', 'due_date', 'submitted_at',
        ]);

        $grouped = $assignments->groupBy('reviewer_id');

        $stats = $grouped->map(function ($items) {
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

            return [
                'reviewer_id' => $reviewer?->id,
                'reviewer' => $reviewer ? ['id' => $reviewer->id, 'name' => $reviewer->name, 'email' => $reviewer->email] : null,
                'total' => $total,
                'completed' => $completed,
                'pending' => $pending,
                'overdue' => $overdue,
                'declined' => $declined,
                'avg_days' => $avgDays,
                'on_time_rate' => $onTimeRate,
                'avg_score' => $avgScore,
            ];
        })->values();

        $totalReviewers = $stats->count();
        $avgCompletionRate = $stats->isNotEmpty()
            ? round($stats->avg(fn ($s) => $s['total'] > 0 ? ($s['completed'] / $s['total']) * 100 : 0))
            : 0;
        $totalOverdue = $stats->sum('overdue');
        $avgDaysAll = $stats->filter(fn ($s) => $s['avg_days'] !== null);
        $avgDaysGlobal = $avgDaysAll->isNotEmpty() ? round($avgDaysAll->avg('avg_days')) : null;

        return response()->json([
            'data' => [
                'summary' => [
                    'total_reviewers' => $totalReviewers,
                    'avg_completion_rate' => $avgCompletionRate,
                    'total_overdue' => $totalOverdue,
                    'avg_days_to_complete' => $avgDaysGlobal,
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

        $oldReviewerId = $assignment->reviewer_id;
        $assignment->update([
            'reviewer_id' => $request->new_reviewer_id,
            'status' => 'pending',
            'due_date' => $request->due_date,
            'submitted_at' => null,
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
                SendRawMailJob::dispatchSync(
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

    public function addReviewer(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'reviewer_id' => 'required|uuid|exists:users,id',
            'due_date' => 'required|date|after:today',
        ]);

        $proposal = Proposal::findOrFail($id);

        if (! in_array($proposal->status, ['under_blind_review', 'under_open_defence'])) {
            return response()->json([
                'data' => null,
                'message' => 'Reviewers can only be added while the proposal is under blind review or open defence.',
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

        $evalType = ReviewAssignment::where('proposal_id', $id)->value('evaluation_type_id');

        $assignment = ReviewAssignment::create([
            'proposal_id' => $id,
            'reviewer_id' => $request->reviewer_id,
            'evaluation_type_id' => $evalType,
            'assigned_by' => $request->user()->id,
            'status' => 'pending',
            'assigned_at' => now(),
            'due_date' => $request->due_date ?? now()->addDays(14)->toDateString(),
        ]);

        $reviewer = User::find($request->reviewer_id);
        if ($reviewer) {
            $reviewType = $proposal->status === 'under_open_defence' ? 'Open Defence' : 'Blind Review';
            $data = [
                'tracker_number' => $proposal->tracker_number,
                'proposal_title' => $proposal->title,
                'review_type' => $reviewType,
                'due_date' => $assignment->due_date,
            ];

            if ($reviewer->email) {
                SendRawMailJob::dispatchSync(
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

    public function removeReviewer(string $id): JsonResponse
    {
        $assignment = ReviewAssignment::with('proposal')->findOrFail($id);

        if (in_array($assignment->status, ['submitted'])) {
            return response()->json([
                'data' => null,
                'message' => 'Cannot remove a reviewer who has already submitted their review.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $assignment->delete();

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
        $assignments = ReviewAssignment::with(['proposal.college', 'evaluationType'])
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

    public function showAssignment(string $id): JsonResponse
    {
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
            ] : null;
        }

        return response()->json(['data' => $data]);
    }
}
