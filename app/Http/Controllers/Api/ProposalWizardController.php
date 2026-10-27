<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\IncompleteProposalException;
use App\Exceptions\InvalidTransitionException;
use App\Exceptions\InvalidWizardStepException;
use App\Exceptions\ProposalNotEditableException;
use App\Exceptions\UnauthorizedTransitionException;
use App\Exceptions\WorkflowGuardException;
use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Services\ProposalService;
use App\Support\ApplicationForm;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProposalWizardController extends Controller
{
    public function __construct(private readonly ProposalService $service) {}

    public function createDraft(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'proposal_call_id' => ['required', 'uuid', 'exists:proposal_calls,id'],
        ]);

        $call = ProposalCall::findOrFail($validated['proposal_call_id']);

        if ($call->status !== 'active') {
            return response()->json([
                'data' => null,
                'message' => 'This proposal call is no longer accepting applications.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        if ($call->end_date && $call->end_date->isPast()) {
            return response()->json([
                'data' => null,
                'message' => 'The deadline for this proposal call has passed.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        // Enforce max proposals per PI for this call
        if ($call->max_proposals_per_pi) {
            $existing = Proposal::where('proposal_call_id', $call->id)
                ->where('pi_user_id', $request->user()->id)
                ->whereNull('deleted_at')
                ->count();

            if ($existing >= $call->max_proposals_per_pi) {
                $limit = $call->max_proposals_per_pi;
                $noun = $limit === 1 ? 'proposal' : 'proposals';

                return response()->json([
                    'data' => null,
                    'message' => "This call limits each PI to {$limit} {$noun}. You have already reached this limit.",
                    'errors' => [],
                    'meta' => [],
                ], 422);
            }
        }

        // Global, cross-call cap on how many active proposals a person can be PI on
        // at once (Settings → Review Thresholds). 0/unset = unlimited.
        $globalPiCap = (int) (AppSetting::where('key', 'max_active_pi_proposals')->value('value') ?? 0);
        if ($globalPiCap > 0) {
            $activePiCount = Proposal::where('pi_user_id', $request->user()->id)
                ->whereNull('deleted_at')
                ->whereNotIn('status', ['archived', 'rejected'])
                ->count();

            if ($activePiCount >= $globalPiCap) {
                $noun = $globalPiCap === 1 ? 'proposal' : 'proposals';

                return response()->json([
                    'data' => null,
                    'message' => "You are already the PI on {$globalPiCap} active {$noun}, the maximum allowed at once. Complete or withdraw from an existing proposal before starting a new one.",
                    'errors' => [],
                    'meta' => [],
                ], 422);
            }
        }

        try {
            $proposal = $this->service->createDraft($request->user(), $validated['proposal_call_id']);
        } catch (\RuntimeException $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        return response()->json([
            'data' => $proposal,
            'message' => 'Draft proposal created.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function saveStep(Request $request, string $id, int $step): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);

        try {
            $proposal = $this->service->saveStep($proposal, $step, $request->all(), $request->user());
        } catch (ProposalNotEditableException|InvalidWizardStepException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json([
            'data' => $proposal,
            'message' => "Step {$step} saved.",
            'errors' => [],
        ]);
    }

    public function getStep(string $id, int $step): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $draftData = $proposal->draft_data ?? [];
        $stepData = $draftData["step_{$step}"] ?? null;

        return response()->json([
            'data' => ['step' => $step, 'data' => $stepData],
            'message' => 'Step data retrieved.',
            'errors' => [],
        ]);
    }

    public function uploadDocument(Request $request, string $id): JsonResponse
    {
        // PHP silently drops files exceeding upload_max_filesize, causing a misleading
        // "file required" 422. Detect this by checking whether a large request arrived
        // with no file attached.
        if (! $request->hasFile('file') && (int) $request->server('CONTENT_LENGTH', 0) > 500_000) {
            return response()->json([
                'message' => 'The file exceeds the maximum upload size allowed by the server (10MB). Please reduce the file size and try again.',
                'errors' => ['file' => ['File too large. Maximum allowed size is 10MB.']],
            ], 422);
        }

        $proposal = Proposal::findOrFail($id);

        // A call's own documents (Calls → Application form) upload as "call_<key>".
        $request->validate([
            'file' => ['required', 'file', 'max:10240'],
            'document_type' => ['required', 'string', function (string $attribute, mixed $value, \Closure $fail) use ($proposal) {
                $standard = ['proposal_document', 'budget_spreadsheet', 'pi_cv', 'supporting_document', 'shared_document', 'ethical_clearance_certificate'];
                if (! in_array($value, $standard, true) && ! ApplicationForm::isCallDocument($proposal->proposalCall, (string) $value)) {
                    $fail('The selected document type is invalid.');
                }
            }],
        ]);

        $file = $request->file('file');
        $path = $file->store("proposals/{$id}/documents", 'private');

        $document = DB::transaction(function () use ($proposal, $request, $file, $path) {
            // Superseding the prior current document of the same type (rather than
            // just adding another unrelated row) is what makes "version 2" mean
            // something — the old file stays on disk and in the list, just no
            // longer flagged current, so reviewers always see the latest by default
            // but nothing is silently lost.
            $previous = ProposalDocument::where('proposal_id', $proposal->id)
                ->where('document_type', $request->document_type)
                ->where('is_current', true)
                ->first();

            if ($previous) {
                $previous->update(['is_current' => false]);
            }

            return ProposalDocument::create([
                'proposal_id' => $proposal->id,
                'document_type' => $request->document_type,
                'version' => ($previous?->version ?? 0) + 1,
                'is_current' => true,
                'original_filename' => $file->getClientOriginalName(),
                'stored_path' => $path,
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'uploaded_by' => $request->user()->id,
            ]);
        });

        return response()->json([
            'data' => ['id' => $document->id, 'filename' => $file->getClientOriginalName(), 'version' => $document->version],
            'message' => $document->version > 1
                ? "Document uploaded as version {$document->version}, replacing the previous one."
                : 'Document uploaded successfully.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function downloadDocument(Request $request, string $proposalId, string $docId): StreamedResponse|Response
    {
        $doc = ProposalDocument::where('proposal_id', $proposalId)
            ->where('id', $docId)
            ->firstOrFail();

        $user = $request->user();
        $isOwner = $user && $user->id === $doc->proposal?->pi_user_id;

        if ($doc->document_type === 'pi_cv' && ! $isOwner && ! $user?->can('proposals.view_cv')) {
            abort(403, 'You are not authorized to view this document.');
        }

        if (! Storage::disk('private')->exists($doc->stored_path)) {
            abort(404, 'Document not found.');
        }

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('private');

        return $disk->download($doc->stored_path, $doc->original_filename);
    }

    public function deleteDocument(Request $request, string $proposalId, string $docId): JsonResponse
    {
        $doc = ProposalDocument::where('proposal_id', $proposalId)
            ->where('id', $docId)
            ->firstOrFail();

        if ($doc->proposal->status !== 'draft') {
            return response()->json([
                'data' => null,
                'message' => 'This proposal has already been submitted — its documents can no longer be deleted.',
                'errors' => [],
                'meta' => [],
            ], 403);
        }

        if ($doc->uploaded_by !== $request->user()->id) {
            return response()->json([
                'data' => null,
                'message' => 'You can only delete documents you uploaded.',
                'errors' => [],
                'meta' => [],
            ], 403);
        }

        DB::transaction(function () use ($doc) {
            $wasCurrent = $doc->is_current;
            Storage::disk('private')->delete($doc->stored_path);
            $doc->delete();

            // Deleting the current version shouldn't leave the type with no
            // current document at all when an older version still exists.
            if ($wasCurrent) {
                ProposalDocument::where('proposal_id', $doc->proposal_id)
                    ->where('document_type', $doc->document_type)
                    ->orderByDesc('version')
                    ->first()
                    ?->update(['is_current' => true]);
            }
        });

        return response()->json([
            'data' => null,
            'message' => 'Document deleted.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);

        try {
            $proposal = $this->service->submit($proposal, $request->user());
        } catch (IncompleteProposalException|InvalidTransitionException|WorkflowGuardException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        } catch (UnauthorizedTransitionException $e) {
            return response()->json(['data' => null, 'message' => 'Your account does not have permission to submit proposals. Please contact your administrator.', 'errors' => []], 403);
        }

        return response()->json([
            'data' => $proposal,
            'message' => 'Proposal submitted successfully.',
            'errors' => [],
        ]);
    }
}
