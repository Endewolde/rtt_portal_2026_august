<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginNotice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LoginNoticeController extends Controller
{
    /** Public — returns notices currently in effect for the login page. */
    public function active(): JsonResponse
    {
        $notices = LoginNotice::active()
            ->orderByDesc('priority')
            ->orderBy('created_at')
            ->get(['id', 'title', 'body', 'type', 'priority', 'icon',
                'link_label', 'link_url', 'is_dismissible']);

        return response()->json(['data' => $notices]);
    }

    /** Admin — paginated list of all notices. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('content.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $notices = LoginNotice::with('creator:id,name')
            ->orderByDesc('priority')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $notices]);
    }

    /** Admin — create a notice. */
    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->can('content.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'type' => ['required', 'in:information,warning,success,maintenance'],
            'priority' => ['integer', 'min:0', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
            'link_label' => ['nullable', 'string', 'max:100'],
            'link_url' => ['nullable', 'url', 'max:500'],
            'is_dismissible' => ['boolean'],
            'is_active' => ['boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ]);

        $notice = LoginNotice::create([
            ...$validated,
            'id' => Str::uuid(),
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $notice, 'message' => 'Notice created.'], 201);
    }

    /** Admin — update a notice. */
    public function update(Request $request, LoginNotice $loginNotice): JsonResponse
    {
        if (! $request->user()?->can('content.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'type' => ['required', 'in:information,warning,success,maintenance'],
            'priority' => ['integer', 'min:0', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
            'link_label' => ['nullable', 'string', 'max:100'],
            'link_url' => ['nullable', 'url', 'max:500'],
            'is_dismissible' => ['boolean'],
            'is_active' => ['boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ]);

        $loginNotice->update($validated);

        return response()->json(['data' => $loginNotice->fresh(), 'message' => 'Notice updated.']);
    }

    /** Admin — delete a notice. */
    public function destroy(Request $request, LoginNotice $loginNotice): JsonResponse
    {
        if (! $request->user()?->can('content.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $loginNotice->delete();

        return response()->json(['message' => 'Notice deleted.']);
    }
}
