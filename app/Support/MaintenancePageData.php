<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * The research figures the maintenance page shows while the platform is down. They are
 * read once, when maintenance is switched on, and baked into the static page — so they
 * are only counts the public site already shows, never names or unpublished work.
 */
class MaintenancePageData
{
    /** Funded and later stages — the projects the public showcase already lists. */
    private const FUNDED = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    /** Validated and being reviewed or decided — not yet funded or rejected. */
    private const IN_REVIEW = ['validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence', 'accepted'];

    /**
     * @return array{academic_year: ?string, stats: array{submitted: int, in_review: int, funded: int, colleges: int}}
     */
    public static function collect(): array
    {
        $year = DB::table('app_settings')->where('key', 'current_academic_year')->value('value');
        $proposals = fn () => DB::table('proposals')->whereNull('deleted_at');

        $countsByStatus = $proposals()
            ->when($year, fn ($q) => $q->where('academic_year', $year))
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'academic_year' => $year,
            'stats' => [
                // Every proposal submitted this year, wherever it stands now — rejected ones included.
                'submitted' => (int) $countsByStatus->except(['draft'])->sum(),
                'in_review' => (int) $countsByStatus->only(self::IN_REVIEW)->sum(),
                'funded' => $proposals()->whereIn('status', self::FUNDED)->count(),
                'colleges' => DB::table('colleges')->where('status', 'active')->where('code', '!=', 'ORTT')->count(),
            ],
        ];
    }
}
