<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ef_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuidMorphs('documentable');
            $table->string('title');
            $table->enum('type', ['proposal', 'budget', 'contract', 'ethics', 'invoice', 'report', 'mou', 'other'])->default('other');
            $table->string('original_filename');
            $table->string('stored_path');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('mime_type')->nullable();
            $table->text('description')->nullable();
            $table->foreignUuid('uploaded_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ef_documents');
    }
};
