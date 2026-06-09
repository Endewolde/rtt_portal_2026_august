<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Maps legacy role name → replacement role name.
     * Users with old roles get re-assigned to the closest new role.
     *
     * @var array<string, string>
     */
    private const ROLE_MAP = [
        'central_office'  => 'central_officer',
        'college_admin'   => 'college_officer',
        'department_head' => 'college_officer',
        'finance'         => 'support_officer',
        'reviewer'        => 'staff',
        'pi'              => 'staff',
        'guest'           => 'staff',
    ];

    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Ensure new roles exist before reassigning users
        foreach (array_unique(array_values(self::ROLE_MAP)) as $newRole) {
            Role::updateOrCreate(
                ['name' => $newRole, 'guard_name' => 'web'],
                ['name' => $newRole, 'guard_name' => 'web'],
            );
        }

        foreach (self::ROLE_MAP as $oldName => $newName) {
            $oldRole = DB::table('roles')->where('name', $oldName)->where('guard_name', 'web')->first();
            $newRole = DB::table('roles')->where('name', $newName)->where('guard_name', 'web')->first();

            if (! $oldRole || ! $newRole) {
                continue;
            }

            // Move all users who have the old role to the new role (avoid duplicates)
            $userIds = DB::table('model_has_roles')
                ->where('role_id', $oldRole->id)
                ->where('model_type', 'App\\Models\\User')
                ->pluck('model_id');

            foreach ($userIds as $userId) {
                $alreadyHasNew = DB::table('model_has_roles')
                    ->where('role_id', $newRole->id)
                    ->where('model_id', $userId)
                    ->exists();

                if (! $alreadyHasNew) {
                    DB::table('model_has_roles')->insert([
                        'role_id'    => $newRole->id,
                        'model_type' => 'App\\Models\\User',
                        'model_id'   => $userId,
                    ]);
                }
            }

            // Remove the old role assignment
            DB::table('model_has_roles')->where('role_id', $oldRole->id)->delete();

            // Delete old role and its permission mappings
            DB::table('role_has_permissions')->where('role_id', $oldRole->id)->delete();
            DB::table('roles')->where('id', $oldRole->id)->delete();
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Irreversible — old role names are gone.
        // Restore from a database backup if needed.
    }
};
