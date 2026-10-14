<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\AnonymityCheckService;
use App\Services\ProposalValidationService;
use App\Support\RejectionReasons;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

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

    /** Proposals rejected at this validation step — a separate list so a rejection isn't a dead end. */
    public function rejected(Request $request): JsonResponse
    {
        if (! $request->user()?->can('proposals.validate')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        return response()->json(['data' => $this->service->getRejectedQueue($request->user(), $request->_college_scope)]);
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
            } catch (\Exception $e) {
                $skipped[] = $proposal->tracker_number ?? $id;
                Log::warning("Bulk proposal validation-approve skipped {$proposal->id}: {$e->getMessage()}");
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

    /** Re-run the anonymity check (e.g. after the PI uploaded a corrected document). */
    public function anonymityCheck(string $id, Request $request, AnonymityCheckService $anonymity): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('proposals.validate') && ! $user->hasRole('college_officer')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $proposal = Proposal::findOrFail($id);
        $result = $anonymity->check($proposal);

        return response()->json([
            'data' => array_merge($result, ['checked_at' => now()->toIso8601String()]),
            'message' => match ($result['status']) {
                AnonymityCheckService::STATUS_CLEAN => 'No identifying details found.',
                AnonymityCheckService::STATUS_ISSUES => count($result['findings']).' possible identity reveal(s) found.',
                default => 'No reviewer document could be read automatically — please check it by hand.',
            },
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function reject(string $id, Request $request): JsonResponse
    {
        RejectionReasons::apply($request, 'proposal_validation');
        $request->validate(['reason' => 'required|string|min:10']);
        $proposal = Proposal::findOrFail($id);
        $rejected = $this->service->reject($proposal, $request->user(), $request->reason);

        return response()->json(['data' => $rejected]);
    }
}
