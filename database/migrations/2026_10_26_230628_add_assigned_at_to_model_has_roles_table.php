<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When each role was given to a user, so pages can show someone's latest role
     * first. Earlier assignments have no time and sort after dated ones.
     */
    public function up(): void
    {
        Schema::table(config('permission.table_names.model_has_roles'), function (Blueprint $table) {
            $table->timestamp('assigned_at')->nullable()->useCurrent();
        });

        // Existing assignments have no known time; the role's own age orders them.
        DB::table(config('permission.table_names.model_has_roles'))->update(['assigned_at' => null]);
    }

    public function down(): void
    {
        Schema::table(config('permission.table_names.model_has_roles'), function (Blueprint $table) {
            $table->dropColumn('assigned_at');
        });
    }
};
