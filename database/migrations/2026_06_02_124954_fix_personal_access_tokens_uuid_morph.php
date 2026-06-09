<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop existing index and column, then recreate with char(36) to support UUID tokenable_id
        Schema::table('personal_access_tokens', function ($table) {
            $table->dropIndex('personal_access_tokens_tokenable_type_tokenable_id_index');
        });

        DB::statement('ALTER TABLE personal_access_tokens MODIFY tokenable_id char(36) NOT NULL');

        Schema::table('personal_access_tokens', function ($table) {
            $table->index(['tokenable_type', 'tokenable_id']);
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function ($table) {
            $table->dropIndex('personal_access_tokens_tokenable_type_tokenable_id_index');
        });

        DB::statement('ALTER TABLE personal_access_tokens MODIFY tokenable_id bigint unsigned NOT NULL');

        Schema::table('personal_access_tokens', function ($table) {
            $table->index(['tokenable_type', 'tokenable_id']);
        });
    }
};
