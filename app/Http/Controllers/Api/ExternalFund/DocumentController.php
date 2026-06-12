<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundAward;
use App\Models\ExternalFundDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    private const MANAGERS = ['super_admin', 'admin', 'research_officer', 'central_officer'];

    public function index(Request $request, string $ownerId): JsonResponse
    {
        // Try application first, then award
        $owner = ExternalFundApplication::find($ownerId)
            ?? ExternalFundAward::findOrFail($ownerId);

        $documents = $owner->documents()
            ->with('uploadedBy:id,name')
            ->latest()
            ->get();

        return response()->json(['data' => $documents, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request, string $ownerId): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:20480',
            'title' => 'required|string|max:255',
            'type' => 'required|in:proposal,budget,contract,ethics,invoice,report,mou,other',
            'description' => 'nullable|string|max:500',
        ]);

        $owner = ExternalFundApplication::find($ownerId)
            ?? ExternalFundAward::findOrFail($ownerId);

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

    public function download(string $id): StreamedResponse
    {
        $document = ExternalFundDocument::findOrFail($id);

        abort_unless(Storage::disk('private')->exists($document->stored_path), 404, 'File not found.');

        return Storage::disk('private')->download($document->stored_path, $document->original_filename);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(self::MANAGERS)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $document = ExternalFundDocument::findOrFail($id);
        Storage::disk('private')->delete($document->stored_path);
        $document->delete();

        return response()->json(['data' => null, 'message' => 'Document deleted.', 'errors' => [], 'meta' => []]);
    }
}
