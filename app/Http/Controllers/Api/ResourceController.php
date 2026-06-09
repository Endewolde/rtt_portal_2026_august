<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ResourceController extends Controller
{
    // ── Public (no auth required) ─────────────────────────────────────────────

    public function publicIndex(): JsonResponse
    {
        $resources = Resource::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $resources, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    public function index(): JsonResponse
    {
        $resources = Resource::with('creator:id,name')
            ->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $resources, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->can('settings.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'category' => 'required|in:guideline,template,form,report,policy,other',
            'external_url' => 'nullable|url|max:500',
            'sort_order' => 'nullable|integer|min:0',
            'file' => 'nullable|file|max:20480', // 20 MB
        ]);

        $filePath = null;
        $fileName = null;
        $fileSize = null;
        $fileType = null;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $fileName = $file->getClientOriginalName();
            $fileSize = $file->getSize();
            $fileType = $file->getMimeType();
            $filePath = $file->store('resources', 'public');
        }

        $resource = Resource::create([
            'title' => $request->title,
            'description' => $request->description,
            'category' => $request->category,
            'file_path' => $filePath,
            'file_name' => $fileName,
            'file_size' => $fileSize,
            'file_type' => $fileType,
            'external_url' => $request->external_url,
            'is_active' => true,
            'sort_order' => $request->sort_order ?? 0,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'data' => $resource->fresh(),
            'message' => 'Resource created.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('settings.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $resource = Resource::findOrFail($id);

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:1000',
            'category' => 'sometimes|in:guideline,template,form,report,policy,other',
            'external_url' => 'nullable|url|max:500',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'file' => 'nullable|file|max:20480',
        ]);

        if ($request->hasFile('file')) {
            // Delete old file
            if ($resource->file_path) {
                Storage::disk('public')->delete($resource->file_path);
            }
            $file = $request->file('file');
            $resource->file_path = $file->store('resources', 'public');
            $resource->file_name = $file->getClientOriginalName();
            $resource->file_size = $file->getSize();
            $resource->file_type = $file->getMimeType();
        }

        $resource->fill($request->only('title', 'description', 'category', 'external_url', 'is_active', 'sort_order'));
        $resource->save();

        return response()->json([
            'data' => $resource->fresh(),
            'message' => 'Resource updated.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('settings.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $resource = Resource::findOrFail($id);

        if ($resource->file_path) {
            Storage::disk('public')->delete($resource->file_path);
        }

        $resource->delete();

        return response()->json(['message' => 'Resource deleted.', 'errors' => [], 'meta' => []]);
    }
}
