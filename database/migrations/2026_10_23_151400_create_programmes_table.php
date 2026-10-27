<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Funding programmes (what proposals are called "categories" internally): each
     * organisation defines its own instead of the three built in. Proposals keep
     * their short code in `category`, so nothing existing has to move.
     */
    public function up(): void
    {
        Schema::create('programmes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('key', 50)->unique();
            $table->string('name', 120);
            $table->string('tracker_prefix', 6);
            $table->string('description', 500)->nullable();
            $table->string('color', 9)->default('#6366f1');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $builtIn = [
            ['research', 'Research', 'RES', 'Applied and basic research proposals.', '#3b82f6'],
            ['community_engagement', 'Community Engagement', 'COM', 'Projects that serve and work with communities.', '#10b981'],
            ['technology_transfer', 'Technology Transfer', 'TECH', 'Moving technologies and innovations into use.', '#8b5cf6'],
        ];
        foreach ($builtIn as $i => [$key, $name, $prefix, $description, $color]) {
            DB::table('programmes')->insert([
                'id' => (string) Str::uuid(), 'key' => $key, 'name' => $name, 'tracker_prefix' => $prefix,
                'description' => $description, 'color' => $color, 'is_active' => true, 'sort_order' => $i,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        if (! DB::table('permissions')->where('name', 'programmes.manage')->exists()) {
            PermissionCatalog::sync();
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('programmes');
    }
};
