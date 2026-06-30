<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rogue = ['Research Office', 'guest'];

        $ids = DB::table('roles')->whereIn('name', $rogue)->pluck('id');

        if ($ids->isEmpty()) {
            return;
        }

        DB::table('role_has_permissions')->whereIn('role_id', $ids)->delete();
        DB::table('model_has_roles')->whereIn('role_id', $ids)->delete();
        DB::table('roles')->whereIn('id', $ids)->delete();
    }

    public function down(): void
    {
        // Intentionally left empty — re-creating rogue roles is not desired.
    }
};
