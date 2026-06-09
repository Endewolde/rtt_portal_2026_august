<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\IncompleteProposalException;
use App\Exceptions\InvalidWizardStepException;
use App\Exceptions\ProposalNotEditableException;
use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Services\ProposalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
                'data'    => null,
                'message' => 'This proposal call is no longer accepting applications.',
                'errors'  => [],
                'meta'    => [],
            ], 422);
        }

        if ($call->end_date && $call->end_date->isPast()) {
            return response()->json([
                'data'    => null,
                'message' => 'The deadline for this proposal call has passed.',
                'errors'  => [],
                'meta'    => [],
            ], 422);
        }

        $proposal = $this->service->createDraft($request->user(), $validated['proposal_call_id']);

        return response()->json([
            'data'    => $proposal,
            'message' => 'Draft proposal created.',
            'errors'  => [],
            'meta'    => [],
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
            'data'    => $proposal,
            'message' => "Step {$step} saved.",
            'errors'  => [],
        ]);
    }

    public function getStep(string $id, int $step): JsonResponse
    {
        $proposal  = Proposal::findOrFail($id);
        $draftData = $proposal->draft_data ?? [];
        $stepData  = $draftData["step_{$step}"] ?? null;

        return response()->json([
            'data'    => ['step' => $step, 'data' => $stepData],
            'message' => 'Step data retrieved.',
            'errors'  => [],
        ]);
    }

    public function uploadDocument(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'file'          => ['required', 'file', 'max:10240'],
            'document_type' => ['required', 'string', 'in:proposal_document,budget_spreadsheet,pi_cv,supporting_document,shared_document'],
        ]);

        $proposal = Proposal::findOrFail($id);
        $file     = $request->file('file');
        $path     = $file->store("proposals/{$id}/documents", 'private');

        $document = ProposalDocument::create([
            'proposal_id'       => $proposal->id,
            'document_type'     => $request->document_type,
            'original_filename' => $file->getClientOriginalName(),
            'stored_path'       => $path,
            'file_size'         => $file->getSize(),
            'mime_type'         => $file->getMimeType(),
            'uploaded_by'       => $request->user()->id,
        ]);

        return response()->json([
            'data'    => ['id' => $document->id, 'filename' => $file->getClientOriginalName()],
            'message' => 'Document uploaded successfully.',
            'errors'  => [],
            'meta'    => [],
        ], 201);
    }

    public function downloadDocument(string $proposalId, string $docId): \Symfony\Component\HttpFoundation\StreamedResponse|\Illuminate\Http\Response
    {
        $doc = ProposalDocument::where('proposal_id', $proposalId)
            ->where('id', $docId)
            ->firstOrFail();

        if (! \Illuminate\Support\Facades\Storage::disk('private')->exists($doc->stored_path)) {
            abort(404, 'Document not found.');
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = \Illuminate\Support\Facades\Storage::disk('private');

        return $disk->download($doc->stored_path, $doc->original_filename);
    }

    public function deleteDocument(Request $request, string $proposalId, string $docId): JsonResponse
    {
        $doc = ProposalDocument::where('proposal_id', $proposalId)
            ->where('id', $docId)
            ->firstOrFail();

        if ($doc->uploaded_by !== $request->user()->id) {
            return response()->json([
                'data'    => null,
                'message' => 'You can only delete documents you uploaded.',
                'errors'  => [],
                'meta'    => [],
            ], 403);
        }

        \Illuminate\Support\Facades\Storage::disk('private')->delete($doc->stored_path);
        $doc->delete();

        return response()->json([
            'data'    => null,
            'message' => 'Document deleted.',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);

        try {
            $proposal = $this->service->submit($proposal, $request->user());
        } catch (IncompleteProposalException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json([
            'data'    => $proposal,
            'message' => 'Proposal submitted successfully.',
            'errors'  => [],
        ]);
    }
}
