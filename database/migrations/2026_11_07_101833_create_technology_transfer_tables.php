<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partnerships', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('partner_name');
            $table->string('partner_type', 20);
            $table->string('country', 80)->nullable();
            $table->string('agreement_type', 20);
            $table->string('title')->nullable();
            $table->text('scope')->nullable();
            $table->date('signed_on')->nullable();
            $table->date('expires_on')->nullable();
            $table->boolean('terminated')->default(false);
            $table->foreignUuid('college_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('focal_person_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('partner_contact_name')->nullable();
            $table->string('partner_contact_email')->nullable();
            $table->string('document_path')->nullable();
            $table->date('reminded_on')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index('expires_on');
        });

        Schema::create('partnership_proposal', function (Blueprint $table) {
            $table->foreignUuid('partnership_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('proposal_id')->constrained()->cascadeOnDelete();
            $table->primary(['partnership_id', 'proposal_id']);
        });

        Schema::create('innovations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('reference', 20)->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('inventors')->nullable();
            $table->foreignUuid('college_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('proposal_id')->nullable()->constrained()->nullOnDelete();
            $table->string('ip_type', 30)->default('patent');
            $table->string('stage', 20)->default('disclosed');
            $table->date('disclosed_on')->nullable();
            $table->string('filing_number', 100)->nullable();
            $table->date('filed_on')->nullable();
            $table->date('granted_on')->nullable();
            $table->string('commercialisation', 20)->nullable();
            $table->foreignUuid('partnership_id')->nullable()->constrained()->nullOnDelete();
            $table->string('licensee')->nullable();
            $table->date('licensed_on')->nullable();
            $table->string('spin_off_name')->nullable();
            $table->text('notes')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('innovation_incomes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('innovation_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('currency', 3)->default('ETB');
            $table->date('received_on');
            $table->string('source', 30);
            $table->string('note')->nullable();
            $table->foreignUuid('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::dropIfExists('innovation_incomes');
        Schema::dropIfExists('innovations');
        Schema::dropIfExists('partnership_proposal');
        Schema::dropIfExists('partnerships');
    }
};
