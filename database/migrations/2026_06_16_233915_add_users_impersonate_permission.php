<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * RolePermissionSeeder.php grants `users.impersonate` to super_admin, but that
     * only takes effect on environments where the seeder is re-run. Deployments
     * that only run `php artisan migrate` never get the permission, so the
     * impersonation feature silently 403s there. This migration seeds it directly
     * so it self-heals on any environment without requiring a reseed.
     */
    public function up(): void
    {
        $permissionId = DB::table('permissions')
            ->where('name', 'users.impersonate')
            ->where('guard_name', 'web')
            ->value('id');

        if (! $permissionId) {
            $permissionId = DB::table('permissions')->insertGetId([
                'name' => 'users.impersonate',
                'guard_name' => 'web',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $superAdminRoleId = DB::table('roles')->where('name', 'super_admin')->value('id');

        if ($superAdminRoleId) {
            $alreadyAssigned = DB::table('role_has_permissions')
                ->where('role_id', $superAdminRoleId)
                ->where('permission_id', $permissionId)
                ->exists();

            if (! $alreadyAssigned) {
                DB::table('role_has_permissions')->insert([
                    'role_id' => $superAdminRoleId,
                    'permission_id' => $permissionId,
                ]);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')
            ->where('name', 'users.impersonate')
            ->where('guard_name', 'web')
            ->value('id');

        if ($permissionId) {
            DB::table('role_has_permissions')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }
    }
};
