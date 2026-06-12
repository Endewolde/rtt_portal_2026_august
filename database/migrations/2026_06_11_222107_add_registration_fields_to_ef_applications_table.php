<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ef_applications', function (Blueprint $table) {
            // Donor reference
            $table->string('donor_ref_number')->nullable()->after('ref_number');

            // Partner & institutional info
            $table->text('partner_institutions')->nullable()->after('agency_id');
            $table->string('theme', 255)->nullable()->after('category');
            $table->string('location', 500)->nullable()->after('theme');
            $table->string('lead_institution', 255)->nullable()->after('location');
            $table->string('partner_logo_path', 500)->nullable()->after('lead_institution');

            // Budget (annual separate from total)
            $table->decimal('annual_budget', 15, 2)->nullable()->after('amount_requested');
            $table->decimal('hu_contribution', 15, 2)->nullable()->after('annual_budget');

            // PI contact (explicit, independent of pi_user relation)
            $table->string('pi_name', 255)->nullable()->after('pi_user_id');
            $table->string('pi_phone', 50)->nullable()->after('pi_name');
            $table->string('pi_email', 255)->nullable()->after('pi_phone');
            $table->unsignedInteger('staff_count')->nullable()->after('pi_email');

            // Co-investigators (comma-separated per template)
            $table->text('co_investigator_names')->nullable()->after('staff_count');
            $table->text('co_investigator_phones')->nullable()->after('co_investigator_names');
            $table->text('co_investigator_emails')->nullable()->after('co_investigator_phones');

            // Narrative fields
            $table->text('goals_objectives')->nullable()->after('abstract');
            $table->text('target_beneficiaries')->nullable()->after('goals_objectives');
            $table->text('remarks')->nullable()->after('target_beneficiaries');
        });
    }

    public function down(): void
    {
        Schema::table('ef_applications', function (Blueprint $table) {
            $table->dropColumn([
                'donor_ref_number',
                'partner_institutions',
                'theme',
                'location',
                'lead_institution',
                'partner_logo_path',
                'annual_budget',
                'hu_contribution',
                'pi_name',
                'pi_phone',
                'pi_email',
                'staff_count',
                'co_investigator_names',
                'co_investigator_phones',
                'co_investigator_emails',
                'goals_objectives',
                'target_beneficiaries',
                'remarks',
            ]);
        });
    }
};
