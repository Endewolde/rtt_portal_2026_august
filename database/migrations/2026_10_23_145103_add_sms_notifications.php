<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * SMS notifications through Africa's Talking: the gateway settings (Settings →
     * Email & Notifications), which events are worth a text, and each person's
     * own on/off switch.
     */
    private const SETTINGS = [
        'sms_enabled' => ['false', 'boolean', 'Send text messages for the most important events.'],
        'africastalking_username' => ['', 'string', 'Africa\'s Talking username ("sandbox" for testing).'],
        'africastalking_api_key' => ['', 'password', 'Africa\'s Talking API key.'],
        'africastalking_sender_id' => ['', 'string', 'Approved sender ID or short code (optional).'],
        'sms_events' => ['award_approval,decision_result,review_assignment,review_deadline_reminder,budget_request_approved,signature_requested,deadline_extension_resolved,project_health_warning', 'textarea', 'Events that also send an SMS, separated by commas.'],
    ];

    public function up(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            $table->boolean('sms_enabled')->default(true)->after('telegram_enabled');
        });

        foreach (self::SETTINGS as $key => [$value, $type, $description]) {
            if (! DB::table('app_settings')->where('key', $key)->exists()) {
                DB::table('app_settings')->insert([
                    'id' => (string) Str::uuid(), 'key' => $key, 'value' => $value, 'type' => $type,
                    'group' => 'email', 'description' => $description, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            $table->dropColumn('sms_enabled');
        });
        DB::table('app_settings')->whereIn('key', array_keys(self::SETTINGS))->delete();
    }
};
