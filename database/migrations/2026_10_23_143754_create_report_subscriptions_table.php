<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A person's standing order for a report: which report and filters, how often,
     * and in which format it is emailed to them.
     */
    public function up(): void
    {
        Schema::create('report_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('report_type', 60);
            $table->json('filters')->nullable();
            $table->string('frequency', 10);
            $table->unsignedTinyInteger('weekday')->nullable();
            $table->unsignedTinyInteger('day_of_month')->nullable();
            $table->string('format', 5)->default('pdf');
            $table->boolean('active')->default(true);
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamps();

            $table->index(['active', 'frequency']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_subscriptions');
    }
};
