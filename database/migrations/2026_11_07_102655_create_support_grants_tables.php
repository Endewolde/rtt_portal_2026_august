<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_schemes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('kind', 30);
            $table->text('description')->nullable();
            $table->string('academic_year', 9)->nullable();
            $table->decimal('budget', 14, 2)->nullable();
            $table->decimal('max_award', 14, 2)->nullable();
            $table->unsignedTinyInteger('max_per_person')->nullable();
            $table->date('opens_on')->nullable();
            $table->date('closes_on')->nullable();
            $table->boolean('active')->default(true);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('support_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('reference', 20)->unique();
            $table->foreignUuid('scheme_id')->constrained('support_schemes')->cascadeOnDelete();
            $table->foreignUuid('applicant_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('venue')->nullable();
            $table->string('doi', 200)->nullable();
            $table->text('justification')->nullable();
            $table->decimal('amount_requested', 14, 2);
            $table->decimal('amount_approved', 14, 2)->nullable();
            $table->string('evidence_path')->nullable();
            $table->string('status', 20)->default('submitted');
            $table->text('decision_note')->nullable();
            $table->foreignUuid('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->date('paid_on')->nullable();
            $table->timestamps();
        });

        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::dropIfExists('support_applications');
        Schema::dropIfExists('support_schemes');
    }
};
