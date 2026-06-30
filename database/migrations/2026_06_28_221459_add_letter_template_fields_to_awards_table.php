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
        Schema::table('awards', function (Blueprint $table) {
            $table->string('letter_signatory_name')->nullable()->after('grant_letter_approved_by');
            $table->string('letter_signatory_title')->nullable()->after('letter_signatory_name');
            $table->string('letter_file_no')->nullable()->after('letter_signatory_title');
            $table->string('letter_date')->nullable()->after('letter_file_no');
            $table->json('letter_cc')->nullable()->after('letter_date');
        });
    }

    public function down(): void
    {
        Schema::table('awards', function (Blueprint $table) {
            $table->dropColumn([
                'letter_signatory_name',
                'letter_signatory_title',
                'letter_file_no',
                'letter_date',
                'letter_cc',
            ]);
        });
    }
};
