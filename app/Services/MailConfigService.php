<?php

namespace App\Services;

use App\Models\AppSetting;

class MailConfigService
{
    /**
     * Read mail_* keys from app_settings and push them into the running
     * Laravel config so the Mail facade uses the admin-saved values instead
     * of the .env values that were baked in at boot time.
     */
    public function applyFromDatabase(): void
    {
        $settings = AppSetting::whereIn('key', [
            'mail_driver',
            'mail_host',
            'mail_port',
            'mail_username',
            'mail_password',
            'mail_encryption',
            'mail_from_address',
            'mail_from_name',
        ])->pluck('value', 'key');

        if ($settings->isEmpty()) {
            return;
        }

        $driver = $settings->get('mail_driver', 'smtp');
        config(['mail.default' => $driver]);

        if ($driver === 'smtp') {
            if ($host = $settings->get('mail_host')) {
                config(['mail.mailers.smtp.host' => $host]);
            }
            if ($port = $settings->get('mail_port')) {
                config(['mail.mailers.smtp.port' => (int) $port]);
            }
            if ($username = $settings->get('mail_username')) {
                config(['mail.mailers.smtp.username' => $username]);
            }
            // Password may be empty string — only override if set
            $password = $settings->get('mail_password');
            if ($password !== null) {
                config(['mail.mailers.smtp.password' => $password]);
            }
            $encryption = $settings->get('mail_encryption', 'tls');
            config(['mail.mailers.smtp.encryption' => $encryption ?: null]);
        }

        if ($from = $settings->get('mail_from_address')) {
            config(['mail.from.address' => $from]);
        }
        if ($name = $settings->get('mail_from_name')) {
            config(['mail.from.name' => $name]);
        }
    }
}
