<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** The ways people actually ask about each topic — shown on the article and weighted heavily in search. */
    public function up(): void
    {
        Schema::table('help_articles', function (Blueprint $table) {
            $table->text('questions')->nullable()->after('keywords');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE help_articles DROP INDEX help_articles_search');
            DB::statement('ALTER TABLE help_articles ADD FULLTEXT help_articles_search (title, summary, body, keywords, questions)');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE help_articles DROP INDEX help_articles_search');
            DB::statement('ALTER TABLE help_articles ADD FULLTEXT help_articles_search (title, summary, body, keywords)');
        }

        Schema::table('help_articles', function (Blueprint $table) {
            $table->dropColumn('questions');
        });
    }
};
