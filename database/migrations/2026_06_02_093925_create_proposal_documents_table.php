<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proposal_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->string('document_type', 100);
            $table->string('original_filename', 500);
            $table->string('stored_path', 1000);
            $table->bigInteger('file_size');
            $table->string('mime_type', 100);
            $table->char('uploaded_by', 36);
            $table->timestamps();

            $table->index('proposal_id');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('uploaded_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_documents');
    }
};
