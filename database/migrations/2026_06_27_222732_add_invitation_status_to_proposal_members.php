<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('proposal_members', function (Blueprint $table) {
            $table->enum('invitation_status', ['pending', 'accepted', 'declined'])
                ->default('accepted')
                ->after('status');
            $table->timestamp('invitation_responded_at')->nullable()->after('invitation_status');
        });
    }

    public function down(): void
    {
        Schema::table('proposal_members', function (Blueprint $table) {
            $table->dropColumn(['invitation_status', 'invitation_responded_at']);
        });
    }
};
