<?php

namespace App\Services;

use App\Models\Conference;
use App\Models\ExternalFundAward;
use App\Models\Innovation;
use App\Models\InnovationIncome;
use App\Models\Partnership;
use App\Models\Proposal;
use App\Models\ResearchOutput;
use App\Models\StrategicTarget;
use Carbon\Carbon;

/**
 * The year's targets beside what was achieved. Proposal measures follow the proposals'
 * own academic year; everything else counts what happened between 1 September and
 * 31 August of that year.
 */
class StrategicTargetsService
{
    /** Funded and the stages after it. */
    private const FUNDED = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    /** @var array<string, array{label: string, how: string, money?: bool}> */
    public const METRICS = [
        'proposals_submitted' => ['label' => 'Proposals submitted', 'how' => 'Proposals of this academic year, drafts left out.'],
        'projects_funded' => ['label' => 'Research projects funded', 'how' => 'Research proposals of this year that were funded (including those now further on).'],
        'community_projects_funded' => ['label' => 'Community engagement projects funded', 'how' => 'Community engagement proposals of this year that were funded.'],
        'publications' => ['label' => 'Publications recorded', 'how' => 'Journal articles, conference papers and books recorded as outputs during the year, rejected ones left out.'],
        'patents_filed' => ['label' => 'Patent and IP applications filed', 'how' => 'Innovations whose protection was applied for during the year.'],
        'innovations_commercialised' => ['label' => 'Innovations commercialised', 'how' => 'Licences, spin-offs and other uses started during the year.'],
        'partnerships_signed' => ['label' => 'Partnership agreements signed', 'how' => 'MoUs and other agreements signed during the year.'],
        'external_grants' => ['label' => 'External grants won', 'how' => 'External funding awards that started during the year.'],
        'innovation_income' => ['label' => 'Income from innovations (ETB)', 'how' => 'Licence fees, royalties and other income in birr received during the year.', 'money' => true],
        'conferences_held' => ['label' => 'Conferences held', 'how' => 'Published conferences that began during the year.'],
    ];

    /**
     * @return array{academic_year: string, window: array{from: string, to: string}, metrics: list<array<string, mixed>>}
     */
    public function report(string $year): array
    {
        [$from, $to] = $this->window($year);
        $targets = StrategicTarget::where('academic_year', $year)->pluck('target', 'metric');
        $elapsed = max(0.0, min(1.0, $from->diffInDays(now()) / max(1, $from->diffInDays($to))));

        $metrics = collect(self::METRICS)->map(function (array $def, string $key) use ($year, $from, $to, $targets, $elapsed) {
            $actual = $this->actual($key, $year, $from, $to);
            $target = $targets[$key] ?? null;
            $progress = $target ? $actual / $target : null;

            return [
                'key' => $key,
                'label' => $def['label'],
                'how' => $def['how'],
                'money' => $def['money'] ?? false,
                'target' => $target,
                'actual' => $actual,
                'progress' => $progress !== null ? round($progress * 100) : null,
                // On track when the share achieved keeps up with the share of the year gone.
                'status' => match (true) {
                    $target === null => 'no_target',
                    $progress >= 1 => 'met',
                    $progress >= $elapsed * 0.9 => 'on_track',
                    default => 'behind',
                },
            ];
        })->values()->all();

        return [
            'academic_year' => $year,
            'window' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'year_elapsed' => (int) round($elapsed * 100),
            'metrics' => $metrics,
        ];
    }

    /** @param  array<string, float|int|null>  $targets */
    public function save(string $year, array $targets, string $userId): void
    {
        foreach ($targets as $metric => $value) {
            if (! array_key_exists($metric, self::METRICS)) {
                continue;
            }
            $value === null || $value === ''
                ? StrategicTarget::where(['academic_year' => $year, 'metric' => $metric])->delete()
                : StrategicTarget::updateOrCreate(['academic_year' => $year, 'metric' => $metric], ['target' => $value, 'updated_by' => $userId]);
        }
    }

    /** "2025-2026" → 1 Sep 2025 to 31 Aug 2026. @return array{0: Carbon, 1: Carbon} */
    public function window(string $year): array
    {
        $start = (int) substr($year, 0, 4);

        return [Carbon::create($start, 9, 1)->startOfDay(), Carbon::create($start + 1, 8, 31)->endOfDay()];
    }

    private function actual(string $key, string $year, Carbon $from, Carbon $to): float
    {
        $between = fn (string $column) => fn ($q) => $q->whereBetween($column, [$from, $to]);

        return (float) match ($key) {
            'proposals_submitted' => Proposal::where('academic_year', $year)->where('status', '!=', 'draft')->count(),
            'projects_funded' => Proposal::where('academic_year', $year)->where('category', 'research')->whereIn('status', self::FUNDED)->count(),
            'community_projects_funded' => Proposal::where('academic_year', $year)->where('category', 'community_engagement')->whereIn('status', self::FUNDED)->count(),
            'publications' => ResearchOutput::whereIn('output_type', ['journal_article', 'conference_paper', 'book'])->where('status', '!=', 'rejected')->tap($between('created_at'))->count(),
            'patents_filed' => Innovation::tap($between('filed_on'))->count(),
            'innovations_commercialised' => Innovation::where('stage', 'commercialised')->tap($between('licensed_on'))->count(),
            'partnerships_signed' => Partnership::tap($between('signed_on'))->count(),
            'external_grants' => ExternalFundAward::tap($between('start_date'))->count(),
            'innovation_income' => InnovationIncome::where('currency', 'ETB')->tap($between('received_on'))->sum('amount'),
            'conferences_held' => Conference::whereIn('status', ['published', 'archived'])->tap($between('start_date'))->count(),
        };
    }
}
