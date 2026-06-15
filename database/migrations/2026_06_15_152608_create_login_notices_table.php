<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_notices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('body');
            $table->enum('type', ['information', 'warning', 'success', 'maintenance'])->default('information');
            $table->unsignedSmallInteger('priority')->default(0);
            $table->string('icon', 50)->nullable();
            $table->string('link_label', 100)->nullable();
            $table->string('link_url', 500)->nullable();
            $table->boolean('is_dismissible')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_notices');
    }
};
