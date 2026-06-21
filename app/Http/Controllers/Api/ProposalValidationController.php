<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\ProposalValidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProposalValidationController extends Controller
{
    public function __construct(private ProposalValidationService $service) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('proposals.validate')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        return response()->json(['data' => $this->service->getValidationQueue($request->user(), $request->_college_scope)]);
    }

    public function approve(string $id, Request $request): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $validated = $this->service->approve($proposal, $request->user());

        return response()->json(['data' => $validated]);
    }

    public function return(string $id, Request $request): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:10']);
        $proposal = Proposal::findOrFail($id);
        $corrections = $request->input('required_corrections', []);
        $returned = $this->service->returnForCorrection($proposal, $request->user(), $request->reason, $corrections);

        return response()->json(['data' => $returned]);
    }

    public function bulkApprove(Request $request): JsonResponse
    {
        if (! $request->user()?->can('proposals.validate')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|string|uuid',
        ]);

        $user = $request->user();
        $approved = 0;
        $skipped = [];

        foreach ($request->ids as $id) {
            $proposal = Proposal::find($id);
            if (! $proposal) {
                continue;
            }
            try {
                $this->service->approve($proposal, $user);
                $approved++;
            } catch (\Exception) {
                $skipped[] = $proposal->tracker_number ?? $id;
            }
        }

        $message = "{$approved} proposal(s) approved.";
        if (! empty($skipped)) {
            $message .= ' Skipped: '.implode(', ', $skipped).'.';
        }

        return response()->json([
            'message' => $message,
            'errors' => [],
            'meta' => ['approved' => $approved, 'skipped' => count($skipped)],
        ]);
    }

    public function reject(string $id, Request $request): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:10']);
        $proposal = Proposal::findOrFail($id);
        $rejected = $this->service->reject($proposal, $request->user(), $request->reason);

        return response()->json(['data' => $rejected]);
    }
}
