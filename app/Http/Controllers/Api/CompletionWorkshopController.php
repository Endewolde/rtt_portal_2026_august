<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompletionWorkshop;
use App\Models\Proposal;
use App\Models\WorkshopQuestion;
use App\Services\CompletionWorkshopService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CompletionWorkshopController extends Controller
{
    public function __construct(private CompletionWorkshopService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = CompletionWorkshop::with([
            'proposal:id,tracker_number,title,pi_user_id,college_id,category,duration_months',
            'proposal.college:id,name',
            'proposal.pi:id,name,email',
            'scheduledBy:id,name',
        ])->orderByDesc('scheduled_date');

        $this->scopeToUser($query, $user);

        return response()->json([
            'data' => $query->get(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Same scoping as index() — extracted so stats() can't silently drift out of
     * sync with what a role is actually allowed to see in the list (it previously
     * only scoped college/support officers, leaving category officers unscoped).
     */
    private function scopeToUser($query, $user): void
    {
        // Within the role's data scope; PIs and team members see their own projects.
        $user->accessScope()->constrainThrough($query, 'proposal', fn ($q) => $q->whereHas('proposal', fn ($q) => $q->where('pi_user_id', $user->id)
            ->orWhereHas('members', fn ($sq) => $sq->where('user_id', $user->id)->where('status', 'active'))));
    }

    public function show(string $id): JsonResponse
    {
        $workshop = CompletionWorkshop::with([
            'proposal:id,tracker_number,title,pi_user_id,college_id,category,duration_months,submitted_at',
            'proposal.college:id,name',
            'proposal.pi:id,name,email',
            'proposal.midtermEvaluations',
            'scheduledBy:id,name',
        ])->findOrFail($id);

        return response()->json(['data' => $workshop, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /**
     * Proposals eligible for a completion workshop:
     *   - status = 'midterm_evaluation'
     *   - Passed midterm (recommendation = 'continue', status = scored/completed)
     *   - Final financial settlement (round 2+) is finance_verified
     *   - No existing scheduled or completed workshop
     */
    public function eligibleProposals(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Proposal::where('status', 'midterm_evaluation')
            ->whereHas('midtermEvaluations', fn ($q) => $q->where('recommendation', 'continue')
                ->whereIn('status', ['scored', 'completed'])
            )
            ->whereHas('budgetRequests', fn ($q) => $q->where('funding_round', '>=', 2)
                ->whereHas('settlement', fn ($sq) => $sq->where('status', 'finance_verified')
                )
            )
            ->whereDoesntHave('completionWorkshop', fn ($q) => $q->whereIn('status', ['scheduled', 'completed'])
            )
            ->with(['pi:id,name,email', 'college:id,name'])
            ->orderBy('tracker_number');

        $user->accessScope()->constrain($query, 'proposals', fn ($q) => $q->where('proposals.pi_user_id', $user->id));

        return response()->json([
            'data' => $query->get(['id', 'tracker_number', 'title', 'pi_user_id', 'college_id', 'category', 'duration_months']),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function schedule(Request $request): JsonResponse
    {
        $request->validate([
            'proposal_id' => 'required|uuid|exists:proposals,id',
            'date' => 'required|date|after_or_equal:today',
            'time' => 'required|date_format:H:i',
            'venue' => 'required|string|max:300',
            'online_link' => 'nullable|url|max:500',
        ]);

        $proposal = Proposal::findOrFail($request->proposal_id);

        try {
            $workshop = $this->service->schedule(
                $proposal,
                $request->only('date', 'time', 'venue', 'online_link'),
                $request->user()
            );

            return response()->json([
                'data' => $workshop->load(['proposal:id,tracker_number,title', 'scheduledBy:id,name']),
                'message' => 'Completion workshop scheduled. PI has been notified.',
                'errors' => [],
                'meta' => [],
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    /**
     * Schedule completion workshops for every eligible proposal in the officer's college.
     */
    public function bulkSchedule(Request $request): JsonResponse
    {
        $request->validate([
            'date' => 'required|date|after_or_equal:today',
            'time' => 'required|date_format:H:i',
            'venue' => 'required|string|max:300',
            'online_link' => 'nullable|url|max:500',
        ]);

        $user = $request->user();
        $data = $request->only('date', 'time', 'venue', 'online_link');

        $query = Proposal::where('status', 'midterm_evaluation')
            ->whereHas('midtermEvaluations', fn ($q) => $q->where('recommendation', 'continue')
                ->whereIn('status', ['scored', 'completed'])
            )
            ->whereHas('budgetRequests', fn ($q) => $q->where('funding_round', '>=', 2)
                ->whereHas('settlement', fn ($sq) => $sq->where('status', 'finance_verified')
                )
            )
            ->whereDoesntHave('completionWorkshop', fn ($q) => $q->whereIn('status', ['scheduled', 'completed'])
            );

        $user->accessScope()->constrain($query, 'proposals', fn ($q) => $q->where('proposals.pi_user_id', $user->id));

        $proposals = $query->get();
        $scheduled = 0;
        $skipped = 0;

        foreach ($proposals as $proposal) {
            try {
                $this->service->schedule($proposal, $data, $user);
                $scheduled++;
            } catch (\Exception $e) {
                $skipped++;
                Log::warning("Bulk completion-workshop schedule skipped proposal {$proposal->id}: {$e->getMessage()}");
            }
        }

        return response()->json([
            'data' => ['scheduled' => $scheduled, 'skipped' => $skipped],
            'message' => "{$scheduled} completion workshop(s) scheduled for your college.",
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function storeEvidence(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'remarks' => 'nullable|string',
            'presentation_files' => 'nullable|array',
            'photos' => 'nullable|array',
            'videos' => 'nullable|array',
            'final_report_path' => 'nullable|string',
        ]);

        $workshop = CompletionWorkshop::findOrFail($id);

        try {
            $updated = $this->service->storeEvidence(
                $workshop,
                $request->only('presentation_files', 'photos', 'videos', 'final_report_path'),
                $request->input('remarks', '')
            );

            return response()->json(['data' => $updated, 'message' => 'Evidence saved.', 'errors' => [], 'meta' => []]);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    public function finalizeWorkshop(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'final_score' => 'required|numeric|min:0|max:100',
        ]);

        $workshop = CompletionWorkshop::with('proposal')->findOrFail($id);

        try {
            $proposal = $this->service->finalizeWorkshop(
                $workshop,
                (float) $request->final_score,
                $request->user()
            );

            return response()->json([
                'data' => $proposal,
                'message' => 'Workshop finalized. Proposal is now completed and queued for archival.',
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:cancelled,postponed,scheduled',
        ]);

        $workshop = CompletionWorkshop::findOrFail($id);
        $workshop->update(['status' => $request->status]);

        return response()->json([
            'data' => $workshop->fresh(),
            'message' => 'Workshop status updated.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function uploadFile(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:51200',
            'type' => 'required|in:report,presentation,photo,video',
        ]);

        $workshop = CompletionWorkshop::findOrFail($id);
        $path = $request->file('file')->store("completion-workshops/{$id}/{$request->type}", 'private');

        if ($request->type === 'report') {
            $workshop->update(['final_report_path' => $path]);
        } else {
            $field = match ($request->type) {
                'presentation' => 'presentation_files',
                'photo' => 'photos',
                'video' => 'videos',
            };
            $current = $workshop->{$field} ?? [];
            $workshop->update([$field => [...$current, $path]]);
        }

        return response()->json([
            'data' => ['path' => $path, 'filename' => $request->file('file')->getClientOriginalName()],
            'message' => 'File uploaded.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function getQuestions(string $id): JsonResponse
    {
        $workshop = CompletionWorkshop::findOrFail($id);

        $questions = $workshop->questions()
            ->with([
                'user:id,name',
                'answeredBy:id,name',
            ])
            ->get();

        return response()->json(['data' => $questions, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function postQuestion(Request $request, string $id): JsonResponse
    {
        $workshop = CompletionWorkshop::findOrFail($id);

        if (! in_array($workshop->status, ['scheduled', 'completed'])) {
            return response()->json(['message' => 'Questions can only be posted for scheduled or completed workshops.', 'errors' => [], 'data' => null, 'meta' => []], 422);
        }

        $validated = $request->validate([
            'question' => ['required', 'string', 'max:2000'],
        ]);

        $question = WorkshopQuestion::create([
            'workshop_id' => $workshop->id,
            'user_id' => $request->user()->id,
            'question' => $validated['question'],
        ]);

        $question->load(['user:id,name', 'answeredBy:id,name']);

        return response()->json(['data' => $question, 'message' => 'Question posted.', 'errors' => [], 'meta' => []], 201);
    }

    public function answerQuestion(Request $request, string $id, string $questionId): JsonResponse
    {
        $workshop = CompletionWorkshop::with(['proposal:id,pi_user_id'])->findOrFail($id);
        $question = WorkshopQuestion::where('workshop_id', $id)->findOrFail($questionId);
        $user = $request->user();

        $isPI = $workshop->proposal?->pi_user_id === $user->id;
        $isOfficer = $user->can('completion_workshops.discuss');

        if (! $isPI && ! $isOfficer) {
            abort(403, 'Only the PI or an officer can answer questions.');
        }

        $validated = $request->validate([
            'answer' => ['required', 'string', 'max:5000'],
        ]);

        $question->update([
            'answer' => $validated['answer'],
            'answered_by' => $user->id,
            'answered_at' => now(),
        ]);

        $question->load(['user:id,name', 'answeredBy:id,name']);

        return response()->json(['data' => $question, 'message' => 'Answer posted.', 'errors' => [], 'meta' => []]);
    }

    public function deleteQuestion(Request $request, string $id, string $questionId): JsonResponse
    {
        $question = WorkshopQuestion::where('workshop_id', $id)->findOrFail($questionId);
        $user = $request->user();

        $isOwner = $question->user_id === $user->id;
        $isAdmin = $user->can('completion_workshops.moderate');

        if (! $isOwner && ! $isAdmin) {
            abort(403, 'You can only delete your own questions.');
        }

        $question->delete();

        return response()->json(['data' => null, 'message' => 'Question deleted.', 'errors' => [], 'meta' => []]);
    }

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = CompletionWorkshop::query();
        $this->scopeToUser($query, $user);

        $all = $query->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return response()->json([
            'data' => [
                'total' => $all->sum(),
                'scheduled' => (int) $all->get('scheduled', 0),
                'completed' => (int) $all->get('completed', 0),
                'cancelled' => (int) $all->get('cancelled', 0),
                'postponed' => (int) $all->get('postponed', 0),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
