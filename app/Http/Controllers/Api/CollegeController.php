<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollegeController extends Controller
{
    /** Public, unauthenticated — returns id, name, code only. */
    public function publicList(): JsonResponse
    {
        return response()->json([
            'data' => College::orderBy('name')->get(['id', 'name', 'code']),
        ]);
    }

    public function index(): JsonResponse
    {
        $colleges = College::withCount('departments')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $colleges,
            'message' => 'Colleges retrieved.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->can('colleges.create')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:colleges,name'],
            'code' => ['required', 'string', 'max:20', 'unique:colleges,code'],
            'dean_name' => ['nullable', 'string', 'max:255'],
            'dean_email' => ['nullable', 'email', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $college = College::create($validated + ['status' => $validated['status'] ?? 'active']);

        return response()->json([
            'data' => $college,
            'message' => 'College created.',
            'errors' => [],
        ], 201);
    }

    public function update(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('colleges.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $college = College::findOrFail($id);
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', 'unique:colleges,name,'.$college->id],
            'code' => ['sometimes', 'string', 'max:20', 'unique:colleges,code,'.$college->id],
            'dean_name' => ['nullable', 'string', 'max:255'],
            'dean_email' => ['nullable', 'email', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $college->update($validated);

        return response()->json([
            'data' => $college->fresh(),
            'message' => 'College updated.',
            'errors' => [],
        ]);
    }

    public function departments(string $id): JsonResponse
    {
        $departments = Department::where('college_id', $id)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'status']);

        return response()->json([
            'data' => $departments,
            'message' => 'Departments retrieved.',
            'errors' => [],
        ]);
    }

    public function allDepartments(Request $request): JsonResponse
    {
        $departments = Department::with('college:id,name')
            ->when($request->college_id, fn ($q) => $q->where('college_id', $request->college_id))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $departments, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        $request->validate([
            'college_id' => 'required|uuid|exists:colleges,id',
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:20|unique:departments,code',
        ]);

        $dept = Department::create([
            'college_id' => $request->college_id,
            'name' => $request->name,
            'code' => $request->code,
            'status' => 'active',
        ]);

        return response()->json(['data' => $dept->load('college'), 'message' => 'Department created.', 'errors' => [], 'meta' => []], 201);
    }

    public function updateDepartment(Request $request, string $id): JsonResponse
    {
        $dept = Department::findOrFail($id);
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'sometimes|string|max:20|unique:departments,code,'.$dept->id,
            'status' => 'sometimes|in:active,inactive',
        ]);

        $dept->update($request->only('name', 'code', 'status'));

        return response()->json(['data' => $dept->fresh()->load('college'), 'message' => 'Department updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $college = College::withCount('departments')->findOrFail($id);

        if ($college->departments_count > 0) {
            return response()->json(['data' => null, 'message' => 'Cannot delete a college that has departments. Remove all departments first.', 'errors' => []], 422);
        }

        $college->forceDelete();

        return response()->json(['data' => null, 'message' => 'College deleted.', 'errors' => [], 'meta' => []]);
    }

    public function destroyDepartment(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $dept = Department::findOrFail($id);
        $dept->forceDelete();

        return response()->json(['data' => null, 'message' => 'Department deleted.', 'errors' => [], 'meta' => []]);
    }
}
