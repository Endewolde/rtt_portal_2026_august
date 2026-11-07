<?php

namespace App\Console\Commands;

use App\Support\PinnedHosts;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('rtt:pin-sign-in-hosts')]
#[Description('Look up the sign-in providers\' addresses now (the scheduler does it every 5 minutes) and show them.')]
class PinSignInHosts extends Command
{
    public function handle(): int
    {
        $started = microtime(true);
        $pinned = PinnedHosts::refresh();

        foreach (array_merge(...array_values(PinnedHosts::HOSTS)) as $host) {
            $this->line(str_pad($host, 32).(isset($pinned[$host]) ? implode(', ', $pinned[$host]) : '<error>not found</error>'));
        }
        $this->info(sprintf('Looked up in %.1f s. Sign-in now uses these addresses.', microtime(true) - $started));

        return isset($pinned['login.microsoftonline.com'], $pinned['graph.microsoft.com']) ? self::SUCCESS : self::FAILURE;
    }
}
