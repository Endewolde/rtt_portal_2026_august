<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::with('permissions:id,name')
            ->withCount('permissions')
            ->get()
            ->map(function (Role $role) {
                $role->users_count = DB::table('model_has_roles')
                    ->where('role_id', $role->id)
                    ->where('model_type', User::class)
                    ->count();

                return $role;
            });

        return response()->json(['data' => $roles, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate(['name' => 'required|string|unique:roles,name']);
        $role = Role::create(['name' => $request->name, 'guard_name' => 'web']);

        return response()->json(['data' => $role, 'message' => 'Role created.', 'errors' => [], 'meta' => []], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $role = Role::findOrFail($id);
        $request->validate(['name' => 'required|string|unique:roles,name,'.$role->id]);
        $role->update(['name' => $request->name]);

        return response()->json(['data' => $role->fresh(), 'message' => 'Role updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $role = Role::findOrFail($id);
        $system = ['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer', 'college_officer', 'support_officer', 'staff'];

        if (in_array($role->name, $system)) {
            return response()->json(['message' => 'Cannot delete system roles.'], 422);
        }

        $role->delete();

        return response()->json(['message' => 'Role deleted.', 'errors' => [], 'meta' => []]);
    }

    public function permissions(string $id): JsonResponse
    {
        $role = Role::with('permissions')->findOrFail($id);

        return response()->json(['data' => $role->permissions->pluck('name'), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function updatePermissions(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate(['permissions' => 'required|array']);
        $role = Role::findOrFail($id);
        $role->syncPermissions($request->permissions);
        Artisan::call('permission:cache-reset');

        return response()->json(['message' => 'Permissions updated.', 'errors' => [], 'meta' => []]);
    }

    public function allPermissions(): JsonResponse
    {
        $permissions = Permission::orderBy('name')->get(['id', 'name']);

        return response()->json(['data' => $permissions, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function refreshPermissions(Request $request): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        Artisan::call('db:seed', ['--class' => 'RolePermissionSeeder', '--force' => true]);
        Artisan::call('permission:cache-reset');

        return response()->json(['message' => 'Permissions refreshed successfully.', 'errors' => [], 'meta' => []]);
    }
}
