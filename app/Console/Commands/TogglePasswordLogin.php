<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

#[Signature('auth:password-login
    {action : enable, disable, or status}
')]
#[Description('Enable, disable, or check the password login setting.')]
class TogglePasswordLogin extends Command
{
    public function handle(): int
    {
        $action = strtolower($this->argument('action'));

        if ($action === 'status') {
            $value = AppSetting::where('key', 'password_login_enabled')->value('value');
            $enabled = $value !== 'false';
            $this->line('Password login: '.($enabled ? '<fg=green>enabled</>' : '<fg=red>disabled</>'));

            return self::SUCCESS;
        }

        if (! in_array($action, ['enable', 'disable'])) {
            $this->error("Unknown action \"{$action}\". Use enable, disable, or status.");

            return self::FAILURE;
        }

        $newValue = $action === 'enable' ? 'true' : 'false';

        AppSetting::updateOrCreate(
            ['key' => 'password_login_enabled'],
            ['value' => $newValue]
        );

        Cache::forget('inertia_app_settings');

        $this->info('Password login '.($action === 'enable' ? 'enabled' : 'disabled').'.');

        return self::SUCCESS;
    }
}
