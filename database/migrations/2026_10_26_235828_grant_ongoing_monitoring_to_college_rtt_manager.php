<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * College RTT Managers fund their college's proposals, so they follow them on
     * Ongoing Proposals too. Production only runs `migrate`, so grant it here.
     */
    public function up(): void
    {
        $roleId = DB::table('roles')->where('name', 'college_rtt_manager')->where('guard_name', 'web')->value('id');
        $permissionId = DB::table('permissions')->where('name', 'monitoring.ongoing')->where('guard_name', 'web')->value('id');

        if ($roleId && $permissionId && ! DB::table('role_has_permissions')->where(['role_id' => $roleId, 'permission_id' => $permissionId])->exists()) {
            DB::table('role_has_permissions')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $roleId = DB::table('roles')->where('name', 'college_rtt_manager')->value('id');
        $permissionId = DB::table('permissions')->where('name', 'monitoring.ongoing')->value('id');

        DB::table('role_has_permissions')->where(['role_id' => $roleId, 'permission_id' => $permissionId])->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
