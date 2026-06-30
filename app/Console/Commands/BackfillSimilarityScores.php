<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Services\SimilarityService;
use Illuminate\Console\Command;

class BackfillSimilarityScores extends Command
{
    protected $signature = 'similarity:backfill
                            {--chunk=50 : Number of proposals to process per batch}
                            {--category= : Limit to a specific category}
                            {--force : Re-score proposals that already have scores}';

    protected $description = 'Backfill similarity scores for all submitted proposals';

    public function handle(SimilarityService $service): int
    {
        $query = Proposal::whereNotIn('status', ['draft']);

        if ($this->option('category')) {
            $query->where('category', $this->option('category'));
        }

        if (! $this->option('force')) {
            $query->whereDoesntHave('similarityScores');
        }

        $total = $query->count();

        if ($total === 0) {
            $this->info('No proposals to process.');

            return self::SUCCESS;
        }

        $this->info("Processing {$total} proposals in chunks of {$this->option('chunk')}…");

        $bar = $this->output->createProgressBar($total);
        $done = 0;
        $errs = 0;

        $bar->start();

        $query->chunkById((int) $this->option('chunk'), function ($proposals) use ($service, $bar, &$done, &$errs) {
            foreach ($proposals as $proposal) {
                try {
                    $service->check($proposal);
                    $done++;
                } catch (\Throwable $e) {
                    $errs++;
                    $this->newLine();
                    $this->warn("  Skip {$proposal->tracker_number}: {$e->getMessage()}");
                }
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->info("Done. Scored: {$done} · Skipped: {$errs}");

        return self::SUCCESS;
    }
}
