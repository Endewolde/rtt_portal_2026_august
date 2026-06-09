<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

#[Signature('users:deactivate-expired-guests')]
#[Description('Deactivate guest accounts that are older than two weeks without a role change.')]
class DeactivateExpiredGuestUsers extends Command
{
    public function handle(): int
    {
        $expired = User::role('guest')
            ->where('status', 'active')
            ->where('created_at', '<=', now()->subWeeks(2))
            ->get();

        if ($expired->isEmpty()) {
            $this->info('No expired guest accounts found.');

            return self::SUCCESS;
        }

        foreach ($expired as $user) {
            $user->update(['status' => 'inactive']);
            $user->tokens()->delete();

            DB::table('audit_logs')->insert([
                'id' => Str::uuid()->toString(),
                'auditable_type' => User::class,
                'auditable_id' => $user->id,
                'event' => 'user.auto_deactivated',
                'actor_id' => null,
                'old_values' => json_encode(['status' => 'active', 'role' => 'guest']),
                'new_values' => json_encode(['status' => 'inactive', 'reason' => 'Guest account expired after 2 weeks']),
                'ip_address' => null,
                'user_agent' => 'system',
                'created_at' => now(),
            ]);
        }

        $this->info("Deactivated {$expired->count()} expired guest account(s).");

        return self::SUCCESS;
    }
}
