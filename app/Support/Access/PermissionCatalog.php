<?php

namespace App\Support\Access;

use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * The permission catalogue in config/access.php, and keeping the database in
 * line with it without ever undoing changes made on the Roles page.
 */
class PermissionCatalog
{
    /** @return array<string, array{label: string, description: string, roles?: list<string>, group: string}> */
    public static function all(): array
    {
        $flat = [];
        foreach (config('access.groups') as $group => $permissions) {
            foreach ($permissions as $name => $meta) {
                $flat[$name] = [...$meta, 'group' => $group];
            }
        }

        return $flat;
    }

    /** @return list<string> */
    public static function systemRoles(): array
    {
        return array_keys(config('access.roles'));
    }

    /**
     * Create catalogue permissions that don't exist yet, granting each to its
     * default roles. With $resetDefaults (fresh installs and the role seeder),
     * defaults are also granted for permissions that already exist. Super admin
     * always holds every permission. Nothing is ever revoked.
     *
     * @return array{created: list<string>}
     */
    public static function sync(bool $resetDefaults = false): array
    {
        $now = now();
        $catalogue = self::all();
        $existing = DB::table('permissions')->where('guard_name', 'web')->pluck('id', 'name');

        $created = array_values(array_diff(array_keys($catalogue), $existing->keys()->all()));
        if ($created) {
            DB::table('permissions')->insert(array_map(fn ($name) => [
                'name' => $name, 'guard_name' => 'web', 'created_at' => $now, 'updated_at' => $now,
            ], $created));
        }

        $permissionIds = DB::table('permissions')->where('guard_name', 'web')->pluck('id', 'name');
        $roleIds = DB::table('roles')->where('guard_name', 'web')->pluck('id', 'name');

        // Default grants: for new permissions always, for all of them on a reset.
        $wanted = [];
        foreach ($catalogue as $name => $meta) {
            if (empty($meta['roles']) || (! $resetDefaults && ! in_array($name, $created, true))) {
                continue;
            }
            foreach ($meta['roles'] as $roleName) {
                if (isset($roleIds[$roleName])) {
                    $wanted[] = [$roleIds[$roleName], $permissionIds[$name]];
                }
            }
        }
        // Super admin holds every permission.
        if (isset($roleIds['super_admin'])) {
            foreach ($permissionIds as $id) {
                $wanted[] = [$roleIds['super_admin'], $id];
            }
        }

        $have = DB::table('role_has_permissions')->get(['role_id', 'permission_id'])
            ->map(fn ($r) => $r->role_id.'|'.$r->permission_id)->flip();
        $rows = collect($wanted)
            ->unique(fn ($pair) => $pair[0].'|'.$pair[1])
            ->reject(fn ($pair) => $have->has($pair[0].'|'.$pair[1]))
            ->map(fn ($pair) => ['role_id' => $pair[0], 'permission_id' => $pair[1]])
            ->values();
        foreach ($rows->chunk(500) as $chunk) {
            DB::table('role_has_permissions')->insert($chunk->all());
        }

        self::syncRoleMetadata();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return ['created' => $created];
    }

    /**
     * Make the built-in roles hold exactly the catalogue defaults for the given
     * permissions — for permissions that existed but were never enforced and are now
     * checked, so the defaults match what those roles could actually do before.
     * Custom roles are left untouched; super admin always keeps every permission.
     *
     * @param  list<string>  $names
     */
    public static function alignBuiltInRoles(array $names): void
    {
        $catalogue = self::all();
        $roleIds = DB::table('roles')->where('guard_name', 'web')->whereIn('name', self::systemRoles())->pluck('id', 'name');

        foreach ($names as $name) {
            $permissionId = DB::table('permissions')->where('guard_name', 'web')->where('name', $name)->value('id');
            if (! $permissionId || ! isset($catalogue[$name])) {
                continue;
            }

            $wanted = array_unique([...($catalogue[$name]['roles'] ?? []), 'super_admin']);
            foreach ($roleIds as $roleName => $roleId) {
                $query = DB::table('role_has_permissions')->where('role_id', $roleId)->where('permission_id', $permissionId);
                if (in_array($roleName, $wanted, true)) {
                    if (! $query->exists()) {
                        DB::table('role_has_permissions')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
                    }
                } else {
                    $query->delete();
                }
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** Fill in label, description and scope for built-in roles that don't have them yet. */
    public static function syncRoleMetadata(): void
    {
        if (! DB::getSchemaBuilder()->hasColumn('roles', 'scope')) {
            return;
        }

        foreach (config('access.roles') as $name => $meta) {
            DB::table('roles')->where('name', $name)->whereNull('label')->update([
                'label' => $meta['label'],
                'description' => $meta['description'],
                'scope' => $meta['scope'],
                'scope_category' => $meta['category'] ?? null,
            ]);
        }
    }
}
