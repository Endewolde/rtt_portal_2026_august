<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category', 50)->default('other'); // guideline|template|form|report|policy|other
            $table->string('file_path')->nullable();          // storage path (public disk)
            $table->string('file_name')->nullable();          // original filename
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('file_type', 100)->nullable();     // mime type
            $table->string('external_url')->nullable();       // alternative: external link
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resources');
    }
};
