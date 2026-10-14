<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * "Login as" another user is super_admin-only. Earlier migrations and the seeder
     * also granted it to the plain admin role; take it back so it applies on every
     * environment with a normal `migrate`, without reseeding.
     */
    public function up(): void
    {
        $permissionId = DB::table('permissions')->where('name', 'users.impersonate')->where('guard_name', 'web')->value('id');
        $adminRoleId = DB::table('roles')->where('name', 'admin')->where('guard_name', 'web')->value('id');

        if ($permissionId && $adminRoleId) {
            DB::table('role_has_permissions')->where('role_id', $adminRoleId)->where('permission_id', $permissionId)->delete();
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('name', 'users.impersonate')->where('guard_name', 'web')->value('id');
        $adminRoleId = DB::table('roles')->where('name', 'admin')->where('guard_name', 'web')->value('id');

        if ($permissionId && $adminRoleId) {
            DB::table('role_has_permissions')->insertOrIgnore(['role_id' => $adminRoleId, 'permission_id' => $permissionId]);
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }
};
