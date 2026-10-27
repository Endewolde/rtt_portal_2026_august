<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundAward;
use App\Models\ExternalFundDocument;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function index(Request $request, string $ownerId): JsonResponse
    {
        $owner = $this->owner($ownerId);
        if (! $owner->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $documents = $owner->documents()
            ->with('uploadedBy:id,name')
            ->latest()
            ->get();

        return response()->json(['data' => $documents, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request, string $ownerId): JsonResponse
    {
        $owner = $this->owner($ownerId);
        if (! $this->canUpload($request->user(), $owner)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,csv,txt,jpg,jpeg,png,zip|max:20480',
            'title' => 'required|string|max:255',
            'type' => 'required|in:proposal,budget,contract,ethics,invoice,report,mou,other',
            'description' => 'nullable|string|max:500',
        ]);

        $file = $request->file('file');
        $storedPath = $file->store("external-funds/{$ownerId}/documents", 'private');

        $document = ExternalFundDocument::create([
            'documentable_type' => get_class($owner),
            'documentable_id' => $owner->id,
            'title' => $request->title,
            'type' => $request->type,
            'description' => $request->description,
            'original_filename' => $file->getClientOriginalName(),
            'stored_path' => $storedPath,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json([
            'data' => $document->load('uploadedBy:id,name'),
            'message' => 'Document uploaded.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function download(Request $request, string $id): StreamedResponse
    {
        $document = ExternalFundDocument::with('documentable')->findOrFail($id);
        abort_unless($document->documentable?->isVisibleTo($request->user()), 403);

        abort_unless(Storage::disk('private')->exists($document->stored_path), 404, 'File not found.');

        return Storage::disk('private')->download($document->stored_path, $document->original_filename);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $document = ExternalFundDocument::findOrFail($id);
        Storage::disk('private')->delete($document->stored_path);
        $document->delete();

        return response()->json(['data' => null, 'message' => 'Document deleted.', 'errors' => [], 'meta' => []]);
    }

    /** Documents hang off either an application or an award. */
    private function owner(string $id): ExternalFundApplication|ExternalFundAward
    {
        return ExternalFundApplication::find($id) ?? ExternalFundAward::with('application')->findOrFail($id);
    }

    /** The office uploads anywhere; the PI adds files to their own application (or its award). */
    private function canUpload(User $user, ExternalFundApplication|ExternalFundAward $owner): bool
    {
        if ($user->can('external_funds.manage') || $user->can('external_funds.expenditure')) {
            return true;
        }
        $application = $owner instanceof ExternalFundAward ? $owner->application : $owner;

        return $application && ($application->created_by === $user->id || $application->pi_user_id === $user->id);
    }
}
