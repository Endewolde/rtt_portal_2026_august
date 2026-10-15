<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The help centre's articles (the assistant's only source for "how do I" answers) and
     * a log of what people ask, so the office can see which questions go unanswered.
     */
    public function up(): void
    {
        Schema::create('help_articles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 120)->unique();
            $table->string('title', 200);
            $table->string('summary', 500);
            $table->text('body');
            $table->string('category', 60);
            // Roles that see it (null = everyone signed in).
            $table->json('roles')->nullable();
            // Other words people use for this topic, to widen search.
            $table->text('keywords')->nullable();
            // Pages where this article is suggested, e.g. ["/admin/blind-review"].
            $table->json('page_paths')->nullable();
            $table->string('action_label', 80)->nullable();
            $table->string('action_url', 200)->nullable();
            $table->boolean('is_published')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->unsignedInteger('views')->default(0);
            $table->unsignedInteger('helpful_yes')->default(0);
            $table->unsignedInteger('helpful_no')->default(0);
            $table->timestamps();
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE help_articles ADD FULLTEXT help_articles_search (title, summary, body, keywords)');
        }

        Schema::create('assistant_queries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('query', 500);
            $table->string('page', 200)->nullable();
            // intent | article | none
            $table->string('answer_type', 20);
            $table->string('intent', 40)->nullable();
            $table->foreignUuid('help_article_id')->nullable()->constrained('help_articles')->nullOnDelete();
            $table->boolean('helpful')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['answer_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_queries');
        Schema::dropIfExists('help_articles');
    }
};
