<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** One row per call: applications, how far they got, money and gender — for year-end reporting. */
class CallOutcomesExport implements FromCollection, ShouldAutoSize, WithHeadings, WithStrictNullComparison, WithStyles, WithTitle
{
    private const CATEGORIES = [
        'research' => 'Research',
        'community_engagement' => 'Community Engagement',
        'technology_transfer' => 'Technology Transfer',
    ];

    /** @param  list<array<string, mixed>>  $calls  AnalyticsService::calls() */
    public function __construct(
        private readonly array $calls,
        private readonly string $scopeLabel,
    ) {}

    public function title(): string
    {
        return 'Call outcomes';
    }

    public function collection(): Collection
    {
        $rows = collect($this->calls)->map(function (array $call) {
            $stage = collect($call['stages'])->pluck('count', 'key');

            return [
                $call['title'].($call['is_legacy'] ? ' (legacy grants)' : ''),
                $call['academic_year'],
                self::CATEGORIES[$call['category']] ?? $call['category'],
                $call['submitted'],
                $stage['validated'] ?? 0,
                $stage['blind_passed'] ?? 0,
                $stage['defence_passed'] ?? 0,
                $call['funded'],
                $call['rejected'],
                $call['in_progress'],
                $call['pass_rate'],
                $call['awarded'],
                $call['budget'],
                $call['budget_used_pct'],
                $call['gender']['female'],
                $call['gender']['male'],
                $call['gender']['not_specified'],
                $call['gender']['female_funded'],
                $call['gender']['male_funded'],
            ];
        });

        $sum = fn (int $i) => $rows->sum(fn ($r) => (float) $r[$i]);

        return $rows->push([
            'Total', '', '',
            $sum(3), $sum(4), $sum(5), $sum(6), $sum(7), $sum(8), $sum(9),
            '', $sum(11), '', '',
            $sum(14), $sum(15), $sum(16), $sum(17), $sum(18),
        ]);
    }

    public function headings(): array
    {
        return [
            ['Call outcomes — '.$this->scopeLabel],
            [
                'Call', 'Academic Year', 'Category',
                'Applications', 'Validated', 'Passed Blind Review', 'Passed Open Defence', 'Funded', 'Not Selected', 'Still in Review',
                'Success Rate (%)', 'Awarded (ETB)', 'Call Budget (ETB)', 'Budget Used (%)',
                'Female PIs', 'Male PIs', 'Gender Not Specified', 'Female PIs Funded', 'Male PIs Funded',
            ],
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        $sheet->freezePane('B3');
        $last = $sheet->getHighestRow();
        $sheet->getStyle("L3:M{$last}")->getNumberFormat()->setFormatCode('#,##0.00');

        return [
            1 => ['font' => ['bold' => true, 'size' => 12]],
            2 => ['font' => ['bold' => true]],
            $last => ['font' => ['bold' => true]],
        ];
    }
}
