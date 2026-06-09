<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\DashboardService;
use Illuminate\Console\Command;

class WarmDashboardCache extends Command
{
    protected $signature   = 'cache:warm-dashboard';
    protected $description = 'Pre-warm dashboard cache for all active users';

    public function handle(DashboardService $service): void
    {
        $users = User::where('status', 'active')
            ->whereNotNull('email_verified_at')
            ->get();

        $this->info("Warming dashboard cache for {$users->count()} users...");

        foreach ($users as $user) {
            $service->invalidate($user->id);
            $service->getWidgets($user);
        }

        $this->info('Dashboard cache warmed successfully.');
    }
}
