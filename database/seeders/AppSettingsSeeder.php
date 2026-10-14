<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AppSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            // General
            ['key' => 'system_name',          'value' => 'RTT Platform',        'type' => 'string',   'group' => 'general'],
            ['key' => 'organization_name',     'value' => 'University',           'type' => 'string',   'group' => 'general'],
            ['key' => 'system_logo',           'value' => '',                     'type' => 'file',     'group' => 'appearance'],
            ['key' => 'favicon',               'value' => '',                     'type' => 'file',     'group' => 'appearance'],
            ['key' => 'default_language',      'value' => 'en',                   'type' => 'select',   'group' => 'general'],
            ['key' => 'default_timezone',      'value' => 'Africa/Addis_Ababa',   'type' => 'select',   'group' => 'general'],
            ['key' => 'date_format',           'value' => 'DD/MM/YYYY',           'type' => 'select',   'group' => 'general'],
            ['key' => 'time_format',           'value' => '24h',                  'type' => 'select',   'group' => 'general'],
            ['key' => 'currency_format',       'value' => 'ETB',                  'type' => 'string',   'group' => 'general'],
            ['key' => 'current_academic_year', 'value' => '2026-2027',            'type' => 'select',   'group' => 'general'],

            // Authentication & Security
            ['key' => 'password_min_length',          'value' => '8',      'type' => 'number',   'group' => 'security'],
            ['key' => 'password_require_uppercase',    'value' => 'true',   'type' => 'boolean',  'group' => 'security'],
            ['key' => 'password_require_numbers',      'value' => 'true',   'type' => 'boolean',  'group' => 'security'],
            ['key' => 'password_require_symbols',      'value' => 'false',  'type' => 'boolean',  'group' => 'security'],
            ['key' => 'password_expiration_days',      'value' => '90',     'type' => 'number',   'group' => 'security'],
            ['key' => 'mfa_enabled',                   'value' => 'false',  'type' => 'boolean',  'group' => 'security'],
            ['key' => 'session_timeout_minutes',       'value' => '60',     'type' => 'number',   'group' => 'security'],
            ['key' => 'max_login_attempts',            'value' => '5',      'type' => 'number',   'group' => 'security'],
            ['key' => 'max_concurrent_sessions',       'value' => '1',      'type' => 'number',   'group' => 'security'],
            ['key' => 'account_lockout_minutes',       'value' => '30',     'type' => 'number',   'group' => 'security'],
            ['key' => 'force_password_on_first_login', 'value' => 'true',   'type' => 'boolean',  'group' => 'security'],
            ['key' => 'captcha_enabled',               'value' => 'false',  'type' => 'boolean',  'group' => 'security'],
            ['key' => 'allowed_ips',                   'value' => '',       'type' => 'textarea', 'group' => 'security'],
            ['key' => 'password_login_enabled',        'value' => 'true',   'type' => 'boolean',  'group' => 'integration'],

            // User Management
            ['key' => 'default_user_role',           'value' => 'guest',        'type' => 'select',  'group' => 'users'],
            ['key' => 'self_registration',           'value' => 'true',         'type' => 'boolean', 'group' => 'users'],
            ['key' => 'email_verification_required', 'value' => 'true',         'type' => 'boolean', 'group' => 'users'],
            ['key' => 'default_import_password',     'value' => 'Password@123', 'type' => 'string',  'group' => 'users'],
            ['key' => 'account_activation_method',   'value' => 'email',        'type' => 'select',  'group' => 'users'],

            // Email & Notifications
            ['key' => 'mail_driver',          'value' => 'smtp',           'type' => 'select',   'group' => 'email'],
            ['key' => 'mail_host',            'value' => 'smtp.gmail.com', 'type' => 'string',   'group' => 'email'],
            ['key' => 'mail_port',            'value' => '587',            'type' => 'number',   'group' => 'email'],
            ['key' => 'mail_username',        'value' => '',               'type' => 'string',   'group' => 'email'],
            ['key' => 'mail_password',        'value' => '',               'type' => 'password', 'group' => 'email'],
            ['key' => 'mail_encryption',      'value' => 'tls',            'type' => 'select',   'group' => 'email'],
            ['key' => 'mail_from_address',    'value' => '',               'type' => 'string',   'group' => 'email'],
            ['key' => 'mail_from_name',       'value' => 'RTT Platform',   'type' => 'string',   'group' => 'email'],
            ['key' => 'sms_gateway',          'value' => '',               'type' => 'string',   'group' => 'email'],
            ['key' => 'telegram_bot_token',   'value' => '',               'type' => 'password', 'group' => 'email'],
            ['key' => 'announcement_message', 'value' => '',               'type' => 'textarea', 'group' => 'email'],
            ['key' => 'announcement_active',  'value' => 'false',          'type' => 'boolean',  'group' => 'email'],

            // File Management
            ['key' => 'max_upload_size_mb',  'value' => '20',                            'type' => 'number',  'group' => 'files'],
            ['key' => 'allowed_file_types',  'value' => 'pdf,doc,docx,xls,xlsx,jpg,png', 'type' => 'string',  'group' => 'files'],
            ['key' => 'file_storage',        'value' => 'local',                          'type' => 'select',  'group' => 'files'],
            ['key' => 'file_retention_days', 'value' => '365',                            'type' => 'number',  'group' => 'files'],

            // System Configuration
            ['key' => 'maintenance_mode', 'value' => 'false',     'type' => 'boolean', 'group' => 'system'],
            ['key' => 'debug_mode',       'value' => 'false',     'type' => 'boolean', 'group' => 'system'],
            ['key' => 'cache_driver',     'value' => 'redis',     'type' => 'select',  'group' => 'system'],
            ['key' => 'queue_driver',     'value' => 'redis',     'type' => 'select',  'group' => 'system'],
            ['key' => 'redis_host',       'value' => '127.0.0.1', 'type' => 'string',  'group' => 'system'],
            ['key' => 'redis_port',       'value' => '6379',      'type' => 'number',  'group' => 'system'],

            // Appearance
            ['key' => 'primary_color',   'value' => '#2563EB',                                 'type' => 'color',    'group' => 'appearance'],
            ['key' => 'secondary_color', 'value' => '#7C3AED',                                 'type' => 'color',    'group' => 'appearance'],
            ['key' => 'footer_text',     'value' => '© 2026 RTT Platform. All rights reserved.', 'type' => 'string', 'group' => 'appearance'],
            ['key' => 'custom_css',      'value' => '',                                         'type' => 'code',     'group' => 'appearance'],
            ['key' => 'homepage_banner', 'value' => '',                                         'type' => 'textarea', 'group' => 'appearance'],
            ['key' => 'theme',           'value' => 'light',                                    'type' => 'select',   'group' => 'appearance'],

            // Review Thresholds — raw point minimums against each evaluation type's
            // category-weight sum (blind=80, defence=20, combined=100), not percentages.
            ['key' => 'blind_threshold',      'value' => '60',   'type' => 'number', 'group' => 'thresholds'],
            ['key' => 'defence_threshold',    'value' => '10',   'type' => 'number', 'group' => 'thresholds'],
            ['key' => 'combined_threshold',   'value' => '70',   'type' => 'number', 'group' => 'thresholds'],
            ['key' => 'combined_decision_mode', 'value' => 'combined_only', 'type' => 'select', 'group' => 'thresholds'],
            ['key' => 'similarity_threshold', 'value' => '0.70', 'type' => 'number', 'group' => 'thresholds'],
            ['key' => 'max_reviewer_active_assignments', 'value' => '5', 'type' => 'number', 'group' => 'thresholds'],
            ['key' => 'overdue_reminder_interval_days', 'value' => '3', 'type' => 'number', 'group' => 'thresholds'],
            ['key' => 'ongoing_midterm_overdue_days', 'value' => '90', 'type' => 'number', 'group' => 'thresholds'],
            // Global, cross-call caps on how many active proposals one person can be
            // involved in at once. 0 = unlimited (same convention as max_concurrent_sessions).
            // "Active" = any status except archived/rejected (WorkflowStage.is_terminal).
            ['key' => 'max_active_pi_proposals', 'value' => '0', 'type' => 'number', 'group' => 'thresholds'],
            ['key' => 'max_active_coinvestigator_proposals', 'value' => '0', 'type' => 'number', 'group' => 'thresholds'],
            // Hold the automatic blind-review decision when reviewers' scores differ by more
            // than this % of the maximum (or fall on both sides of the pass mark). 0 = off.
            ['key' => 'review_disagreement_threshold_pct', 'value' => '25', 'type' => 'number', 'group' => 'thresholds'],
            // Funded projects report progress every N months; the last period is the final report.
            ['key' => 'progress_report_interval_months', 'value' => '3', 'type' => 'number', 'group' => 'thresholds'],
            // Who signs reviewer certificates of service.
            ['key' => 'certificate_signatory_name', 'value' => '', 'type' => 'string', 'group' => 'general'],
            // Reviewer certificates: completed reviews needed in a year, and whether late ones count.
            ['key' => 'certificate_min_reviews', 'value' => '3', 'type' => 'number', 'group' => 'general'],
            ['key' => 'certificate_on_time_only', 'value' => 'false', 'type' => 'boolean', 'group' => 'general'],
            ['key' => 'certificate_signatory_title', 'value' => 'Vice President, Research & Technology Transfer', 'type' => 'string', 'group' => 'general'],

            // Audit & Logging
            ['key' => 'audit_log_retention_days', 'value' => '365',  'type' => 'number',  'group' => 'audit'],
            ['key' => 'activity_logging',         'value' => 'true', 'type' => 'boolean', 'group' => 'audit'],
            ['key' => 'error_logging',            'value' => 'true', 'type' => 'boolean', 'group' => 'audit'],
            ['key' => 'login_history_enabled',    'value' => 'true', 'type' => 'boolean', 'group' => 'audit'],

            // Backup
            ['key' => 'backup_schedule',       'value' => 'daily', 'type' => 'select',  'group' => 'backup'],
            ['key' => 'backup_retention_days', 'value' => '30',    'type' => 'number',  'group' => 'backup'],
            ['key' => 'auto_backup_enabled',   'value' => 'true',  'type' => 'boolean', 'group' => 'backup'],

            // Integration
            ['key' => 'ldap_enabled',            'value' => 'false', 'type' => 'boolean', 'group' => 'integration'],
            ['key' => 'ldap_host',               'value' => '',      'type' => 'string',  'group' => 'integration'],
            ['key' => 'oauth_enabled',           'value' => 'false', 'type' => 'boolean', 'group' => 'integration'],
            ['key' => 'google_sso_enabled',      'value' => 'false', 'type' => 'boolean', 'group' => 'integration'],
            ['key' => 'google_client_id',        'value' => '',      'type' => 'string',  'group' => 'integration'],
            ['key' => 'google_client_secret',    'value' => '',      'type' => 'password', 'group' => 'integration'],
            ['key' => 'microsoft_sso_enabled',   'value' => 'false', 'type' => 'boolean', 'group' => 'integration'],
            ['key' => 'microsoft_client_id',     'value' => '',      'type' => 'string',  'group' => 'integration'],
            ['key' => 'microsoft_client_secret', 'value' => '',      'type' => 'password', 'group' => 'integration'],
            ['key' => 'microsoft_tenant_id',     'value' => '',      'type' => 'string',  'group' => 'integration'],
            ['key' => 'webhook_url',             'value' => '',      'type' => 'string',  'group' => 'integration'],
        ];

        foreach ($settings as $setting) {
            $existing = DB::table('app_settings')->where('key', $setting['key'])->first();
            DB::table('app_settings')->updateOrInsert(
                ['key' => $setting['key']],
                [
                    'id' => $existing->id ?? Str::uuid()->toString(),
                    'value' => $existing->value ?? $setting['value'],
                    'type' => $setting['type'],
                    'group' => $setting['group'],
                    'description' => $setting['group'],
                    'created_at' => $existing->created_at ?? now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
