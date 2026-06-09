<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_signatures', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('budget_request_id', 36);
            $table->char('user_id', 36);
            $table->string('role', 50);
            $table->string('status', 20)->default('pending');
            $table->timestamp('signed_at')->nullable();
            $table->timestamp('refused_at')->nullable();
            $table->text('refusal_reason')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['budget_request_id', 'user_id']);
            $table->foreign('budget_request_id')->references('id')->on('budget_requests');
            $table->foreign('user_id')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE form_signatures ADD CONSTRAINT chk_sig_role CHECK (role IN ('co_investigator','pi'))");
        DB::statement("ALTER TABLE form_signatures ADD CONSTRAINT chk_sig_status CHECK (status IN ('pending','signed','refused'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('form_signatures');
    }
};
