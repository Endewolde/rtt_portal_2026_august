<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProposalCallResource;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Services\ProposalCallService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProposalCallController extends Controller
{
    public function __construct(private readonly ProposalCallService $service) {}

    /**
     * All calls for admin dashboard — includes drafts and expired, with submission counts.
     * Requires proposal_calls.view_any permission.
     */
    public function allForAdmin(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection|\Illuminate\Http\JsonResponse
    {
        if (! $request->user()?->can('proposal_calls.view_any')) {
            return response()->json(['data' => [], 'message' => 'Forbidden.', 'errors' => [], 'meta' => []], 403);
        }

        $calls = ProposalCall::withCount('proposals')
            ->when($request->search, fn ($q) => $q->where('title', 'like', '%'.$request->search.'%'))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->category, fn ($q) => $q->where('category', $request->category))
            ->orderByDesc('created_at')
            ->paginate(25);

        return ProposalCallResource::collection($calls);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && ($user->hasRole(['super_admin', 'central_officer', 'college_officer']))) {
            // Admins see all calls including drafts/expired, with submission counts
            $calls = ProposalCall::withCount('proposals')
                ->orderByDesc('created_at')
                ->paginate(20);
        } else {
            // PIs, reviewers, guests — only active calls that haven't expired
            $calls = ProposalCall::where('status', 'active')
                ->where('end_date', '>=', now())
                ->when($request->category, fn ($q) => $q->where('category', $request->category))
                ->when($request->academic_year, fn ($q) => $q->where('academic_year', $request->academic_year))
                ->orderBy('end_date', 'asc')
                ->get();
        }

        return response()->json([
            'data'    => ProposalCallResource::collection($calls),
            'message' => 'Proposal calls retrieved.',
            'errors'  => [],
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $call = ProposalCall::where('slug', $slug)->firstOrFail();

        return response()->json([
            'data'    => new ProposalCallResource($call),
            'message' => 'Proposal call retrieved.',
            'errors'  => [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.create')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'academic_year'        => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'category'             => ['required', 'string', 'max:50'],
            'title'                => ['required', 'string', 'max:500'],
            'description'          => ['nullable', 'string'],
            'eligibility'          => ['nullable', 'string'],
            'start_date'           => ['required', 'date_format:Y-m-d\TH:i'],
            'end_date'             => ['required', 'date_format:Y-m-d\TH:i', 'after:start_date'],
            'max_proposals_per_pi' => ['nullable', 'integer', 'min:1'],
        ]);

        $call = $this->service->create($validated, $user);

        return response()->json([
            'data'    => new ProposalCallResource($call),
            'message' => 'Proposal call created.',
            'errors'  => [],
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call      = ProposalCall::findOrFail($id);
        $validated = $request->validate([
            'title'                => ['sometimes', 'string', 'max:500'],
            'description'          => ['sometimes', 'nullable', 'string'],
            'eligibility'          => ['sometimes', 'nullable', 'string'],
            'start_date'           => ['sometimes', 'date_format:Y-m-d\TH:i'],
            'end_date'             => ['sometimes', 'date_format:Y-m-d\TH:i', 'after:start_date'],
            'category'             => ['sometimes', 'string', 'max:50'],
            'academic_year'        => ['sometimes', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'max_proposals_per_pi' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ]);

        try {
            $call = $this->service->update($call, $validated, $user);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json([
            'data'    => new ProposalCallResource($call),
            'message' => 'Proposal call updated.',
            'errors'  => [],
        ]);
    }

    public function activate(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);

        try {
            $call = $this->service->activate($call);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json([
            'data'    => new ProposalCallResource($call),
            'message' => 'Proposal call activated.',
            'errors'  => [],
        ]);
    }

    public function close(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = $this->service->close(ProposalCall::findOrFail($id));

        return response()->json([
            'data'    => new ProposalCallResource($call),
            'message' => 'Proposal call closed.',
            'errors'  => [],
        ]);
    }

    public function reopen(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);

        try {
            $call = $this->service->reopen($call);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json([
            'data'    => new ProposalCallResource($call),
            'message' => 'Proposal call reopened successfully.',
            'errors'  => [],
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $call = ProposalCall::findOrFail($id);

        if (! $request->user()?->can('proposal_calls.delete')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        if ($call->status !== 'draft') {
            return response()->json([
                'data'    => null,
                'message' => 'Only draft proposal calls can be deleted.',
                'errors'  => [],
            ], 422);
        }

        $submissionsCount = Proposal::where('proposal_call_id', $call->id)
            ->whereNotIn('status', ['draft'])
            ->count();

        if ($submissionsCount > 0) {
            return response()->json([
                'data'    => null,
                'message' => "Cannot delete — this call has {$submissionsCount} submitted proposal(s).",
                'errors'  => [],
            ], 422);
        }

        $call->delete();

        return response()->json([
            'data'    => null,
            'message' => 'Proposal call deleted successfully.',
            'errors'  => [],
        ]);
    }

    public function uploadGuidelines(Request $request, string $id): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:pdf|max:10240']);

        if (! $request->user()?->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);
        $path = $request->file('file')->store("proposal-calls/{$id}/guidelines", 'private');

        $call->update(['guidelines_file' => $path]);

        return response()->json([
            'data'    => [
                'guidelines_file'     => $path,
                'guidelines_filename' => $request->file('file')->getClientOriginalName(),
            ],
            'message' => 'Guidelines uploaded successfully.',
            'errors'  => [],
        ]);
    }

    public function downloadGuidelines(string $id)
    {
        $call = ProposalCall::findOrFail($id);

        if (! $call->guidelines_file || ! Storage::disk('private')->exists($call->guidelines_file)) {
            abort(404, 'Guidelines file not found.');
        }

        return Storage::disk('private')->download(
            $call->guidelines_file,
            'guidelines-'.$call->slug.'.pdf'
        );
    }
}
