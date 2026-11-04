<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Services\RevertedBlindReviewService;
use Illuminate\Console\Command;

class AuditRevertedBlindReviews extends Command
{
    protected $signature = 'reviews:audit-reverted-blind-review';

    protected $description = 'Read-only audit: find proposals sent back to validated although a blind reviewer had '
        .'already submitted (removing another reviewer reverted them before 2026-10-15), and what restoring each '
        .'would lead to. Never changes anything — see reviews:restore-reverted-blind-review to correct them.';

    /** @var array<string, string> */
    public const OUTCOMES = [
        'pass' => 'Passes blind review → ready for open defence',
        'fail' => 'Below the pass mark — left for an officer to decide',
        'needs_reviewers' => 'Back under blind review — the call needs more reviewers',
        'disagreement' => 'Back under blind review — flagged for reviewer disagreement',
        'manual' => 'Back under blind review — a second opinion needs an officer',
        'waiting' => 'Back under blind review — waiting for a reviewer',
        'no_reviews' => 'Nothing to restore',
    ];

    public function handle(RevertedBlindReviewService $service): int
    {
        $stuck = $service->stuck();

        if ($stuck->isEmpty()) {
            $this->info('No proposals found — none were sent back to validated with a submitted blind review.');

            return self::SUCCESS;
        }

        $this->table(
            ['Proposal', 'College', 'Submitted reviews', 'Score', 'If restored'],
            $stuck->map(fn (Proposal $p) => $this->row($p, $service->predict($p)))->all(),
        );
        $this->comment($stuck->count().' proposal(s) found. Nothing was changed. '
            .'Run reviews:restore-reverted-blind-review to see the correction, then add --force to apply it.');

        return self::SUCCESS;
    }

    /**
     * @param  array{outcome: string, submitted: int, required: ?int, score_label: ?string, threshold: ?float}  $prediction
     * @return list<string>
     */
    private function row(Proposal $proposal, array $prediction): array
    {
        return [
            $proposal->tracker_number,
            $proposal->college?->name ?? '—',
            $prediction['submitted'].($prediction['required'] ? " of {$prediction['required']} required" : ''),
            $prediction['score_label'] ? "{$prediction['score_label']} (pass mark {$prediction['threshold']})" : '—',
            self::OUTCOMES[$prediction['outcome']] ?? $prediction['outcome'],
        ];
    }
}
