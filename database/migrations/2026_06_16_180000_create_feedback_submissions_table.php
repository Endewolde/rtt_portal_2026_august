<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedback_submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('user_id', 36);
            $table->string('type', 30); // feedback | feature_request | bug_report | survey
            $table->unsignedTinyInteger('rating')->nullable(); // 1-5, optional satisfaction rating
            $table->text('message');
            $table->string('page_url')->nullable();
            $table->timestamps();

            // A user may only submit the popup once — enforced at the DB level.
            $table->unique('user_id');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        $exists = DB::table('app_settings')->where('key', 'feedback_popup_enabled')->exists();
        if (! $exists) {
            DB::table('app_settings')->insert([
                'id' => Str::uuid()->toString(),
                'key' => 'feedback_popup_enabled',
                'value' => 'false',
                'type' => 'boolean',
                'group' => 'general',
                'description' => 'Show the feedback/feature-request popup to users who have not yet submitted it',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_submissions');

        DB::table('app_settings')->where('key', 'feedback_popup_enabled')->delete();
    }
};
