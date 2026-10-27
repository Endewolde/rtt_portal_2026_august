<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A message thread on each proposal between the research team and the staff
     * handling it, with an optional attachment, and how far each person has read.
     */
    public function up(): void
    {
        Schema::create('proposal_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('proposal_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->boolean('from_team')->default(false);
            $table->timestamps();

            $table->index(['proposal_id', 'created_at']);
        });

        Schema::create('proposal_message_reads', function (Blueprint $table) {
            $table->foreignUuid('proposal_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_read_at');
            $table->primary(['proposal_id', 'user_id']);
        });

        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_message_reads');
        Schema::dropIfExists('proposal_messages');
    }
};
