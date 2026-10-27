<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Role and permission links whose user no longer exists made the Roles page
     * count more holders than there are. Only rows pointing at no user are removed.
     */
    public function up(): void
    {
        foreach (['model_has_roles', 'model_has_permissions'] as $table) {
            DB::table($table)
                ->where('model_type', User::class)
                ->whereNotIn('model_id', DB::table('users')->select('id'))
                ->delete();
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Links to users that no longer exist cannot be restored.
    }
};
