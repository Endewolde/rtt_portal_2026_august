<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_proofs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('disbursement_id', 36);
            $table->string('file_path', 500);
            $table->string('original_filename', 500);
            $table->bigInteger('file_size');
            $table->string('mime_type', 100);
            $table->char('uploaded_by', 36);
            $table->timestamps();

            $table->foreign('disbursement_id')->references('id')->on('disbursements');
            $table->foreign('uploaded_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_proofs');
    }
};
