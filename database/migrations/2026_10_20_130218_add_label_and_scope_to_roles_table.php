<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A role's display name, description and data scope. The scope decides which
     * records a role's permissions apply to — every college and category, the
     * user's own college, one category, or only their own records — so a custom
     * role can be scoped the same way the built-in ones are.
     */
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('label', 100)->nullable()->after('name');
            $table->text('description')->nullable()->after('label');
            $table->string('scope', 20)->default('own')->after('description');
            $table->string('scope_category', 50)->nullable()->after('scope');
        });

        foreach (config('access.roles') as $name => $role) {
            DB::table('roles')->where('name', $name)->update([
                'label' => $role['label'],
                'description' => $role['description'],
                'scope' => $role['scope'],
                'scope_category' => $role['category'] ?? null,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['label', 'description', 'scope', 'scope_category']);
        });
    }
};
