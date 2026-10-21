<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Access\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $userCounts = DB::table('model_has_roles')
            ->where('model_type', User::class)
            ->selectRaw('role_id, count(*) as total')
            ->groupBy('role_id')
            ->pluck('total', 'role_id');
        $systemRoles = PermissionCatalog::systemRoles();

        $roles = Role::with('permissions:id,name')
            ->withCount('permissions')
            ->orderBy('id')
            ->get()
            ->map(function (Role $role) use ($userCounts, $systemRoles) {
                $role->users_count = (int) ($userCounts[$role->id] ?? 0);
                $role->is_system = in_array($role->name, $systemRoles, true);
                $role->label ??= Str::headline($role->name);

                return $role;
            });

        return response()->json(['data' => $roles, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /**
     * The permission catalogue as the Roles page shows it: groups of permissions
     * with labels and descriptions, then any permission outside the catalogue,
     * plus the data scopes and categories a role can be limited to.
     */
    public function catalog(Request $request): JsonResponse
    {
        if (! $request->user()->can('roles.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $catalogue = PermissionCatalog::all();
        $groups = [];
        foreach (config('access.groups') as $group => $permissions) {
            $groups[] = [
                'name' => $group,
                'permissions' => collect($permissions)->map(fn ($meta, $name) => [
                    'name' => $name,
                    'label' => $meta['label'],
                    'description' => $meta['description'] ?? '',
                ])->values(),
            ];
        }

        $other = Permission::where('guard_name', 'web')
            ->whereNotIn('name', array_keys($catalogue))
            ->orderBy('name')
            ->pluck('name')
            ->map(fn ($name) => [
                'name' => $name,
                'label' => Str::headline(str_replace('.', ' ', $name)),
                'description' => 'Not used by any page or action at the moment.',
            ])
            ->values();
        if ($other->isNotEmpty()) {
            $groups[] = ['name' => 'Other (not in use)', 'permissions' => $other];
        }

        return response()->json(['data' => [
            'groups' => $groups,
            'scopes' => collect(config('access.scopes'))->map(fn ($meta, $key) => ['value' => $key, ...$meta])->values(),
            'categories' => collect(config('access.categories'))->map(fn ($label, $key) => ['value' => $key, 'label' => $label])->values(),
        ], 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->can('roles.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $this->validateRole($request);
        $request->validate([
            'name' => ['nullable', 'string', 'max:64', 'regex:/^[a-z][a-z0-9_]*$/', 'unique:roles,name'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'name')->where('guard_name', 'web')],
            'clone_from' => ['nullable', 'integer', 'exists:roles,id'],
        ]);

        $name = $request->input('name') ?: Str::snake(Str::lower($data['label']));
        if (Role::where('name', $name)->exists()) {
            return response()->json(['message' => 'A role with this name already exists.', 'errors' => ['label' => ['A role with this name already exists.']]], 422);
        }

        $role = DB::transaction(function () use ($request, $data, $name) {
            $role = Role::create(['name' => $name, 'guard_name' => 'web']);
            $role->forceFill($data)->save();

            $permissions = $request->input('permissions');
            if ($permissions === null && $request->filled('clone_from')) {
                $permissions = Role::findOrFail($request->integer('clone_from'))->permissions->pluck('name')->all();
            }
            $role->syncPermissions($permissions ?? []);

            return $role;
        });
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['data' => $role->fresh(), 'message' => 'Role created.', 'errors' => [], 'meta' => []], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->can('roles.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $role = Role::findOrFail($id);
        $data = $this->validateRole($request);

        // Super admin always covers everything; built-in roles keep their system names.
        if ($role->name === 'super_admin') {
            $data['scope'] = 'all';
            $data['scope_category'] = null;
        }

        $role->forceFill($data)->save();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['data' => $role->fresh(), 'message' => 'Role updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->can('roles.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $role = Role::findOrFail($id);

        if (in_array($role->name, PermissionCatalog::systemRoles(), true)) {
            return response()->json(['message' => 'Built-in roles cannot be deleted.'], 422);
        }

        $role->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['message' => 'Role deleted.', 'errors' => [], 'meta' => []]);
    }

    public function permissions(string $id): JsonResponse
    {
        $role = Role::with('permissions')->findOrFail($id);

        return response()->json(['data' => $role->permissions->pluck('name'), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function updatePermissions(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->can('roles.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'name')->where('guard_name', 'web')],
        ]);
        $role = Role::findOrFail($id);

        if ($role->name === 'super_admin') {
            return response()->json(['message' => 'Super Admin always holds every permission.'], 422);
        }

        $role->syncPermissions($request->permissions);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['message' => 'Permissions updated.', 'errors' => [], 'meta' => []]);
    }

    public function allPermissions(): JsonResponse
    {
        $permissions = Permission::orderBy('name')->get(['id', 'name']);

        return response()->json(['data' => $permissions, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /**
     * Add any catalogue permissions missing from the database. Never removes a
     * permission or undoes a change made on this page.
     */
    public function refreshPermissions(Request $request): JsonResponse
    {
        if (! $request->user()->can('roles.manage')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $result = PermissionCatalog::sync();
        $count = count($result['created']);

        return response()->json([
            'data' => $result,
            'message' => $count ? "Added {$count} new permission(s)." : 'Permissions are up to date.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** @return array{label: string, description: ?string, scope: string, scope_category: ?string} */
    private function validateRole(Request $request): array
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'scope' => ['required', Rule::in(array_keys(config('access.scopes')))],
            'scope_category' => ['nullable', 'required_if:scope,category', Rule::in(array_keys(config('access.categories')))],
        ]);

        return [
            'label' => $data['label'],
            'description' => $data['description'] ?? null,
            'scope' => $data['scope'],
            'scope_category' => $data['scope'] === 'category' ? $data['scope_category'] : null,
        ];
    }
}
