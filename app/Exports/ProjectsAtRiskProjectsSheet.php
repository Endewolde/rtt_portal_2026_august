<?php

namespace App\Exports;

use App\Models\Proposal;
use App\Services\ProjectRiskService;
use App\Support\Terms;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomCsvSettings;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** One row per project with its timeline, money, progress and warnings. Also the CSV download on its own. */
class ProjectsAtRiskProjectsSheet implements FromCollection, ShouldAutoSize, WithCustomCsvSettings, WithHeadings, WithStrictNullComparison, WithStyles, WithTitle
{
    private const LEVEL_FILLS = ['high' => 'FEE2E2', 'watch' => 'FEF3C7', 'on_track' => 'D1FAE5'];

    /** @param  Collection<int, array<string, mixed>>  $projects */
    public function __construct(private readonly Collection $projects, private readonly bool $forCsv = false) {}

    /** A byte-order mark so Excel opens Amharic names correctly. */
    public function getCsvSettings(): array
    {
        return ['use_bom' => true];
    }

    public function title(): string
    {
        return 'Projects';
    }

    public function collection(): Collection
    {
        return $this->projects->map(fn (array $p) => [
            ProjectRiskService::LEVEL_LABELS[$p['level']],
            $p['tracker_number'],
            $p['title'],
            ucwords(str_replace('_', ' ', (string) $p['category'])),
            Proposal::statusLabel($p['status']),
            $p['pi'],
            $p['college'],
            $p['start_date'],
            $p['end_date'],
            $p['duration_months'],
            $p['days_left'],
            $p['elapsed_pct'],
            $p['budget'],
            $p['released'],
            $p['released_pct'],
            $p['reported_progress'],
            $p['reported_spent_pct'],
            $p['last_report_at'] ? substr($p['last_report_at'], 0, 10) : null,
            $p['overdue_reports'],
            count($p['signals']),
            collect($p['signals'])->map(fn ($s) => $s['label'].($s['level'] === 'high' ? ' (serious)' : '').': '.$s['detail'])->implode("\n"),
        ]);
    }

    public function headings(): array
    {
        return [
            'Risk Level', 'Tracker Number', 'Title', 'Category', 'Status', 'PI', Terms::college(),
            'Start Date', 'Planned End Date', 'Duration (months)', 'Days Left', 'Time Used (%)',
            'Budget ('.Terms::currency().')', 'Released ('.Terms::currency().')', 'Released (%)', 'Reported Progress (%)', 'Reported Spending (%)',
            'Last Report', 'Overdue Reports', 'Warnings', 'Warning Details',
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        $sheet->freezePane('C2');
        $last = max(2, $sheet->getHighestRow());
        $sheet->setAutoFilter("A1:U{$last}");
        // A CSV carries the formatted text, so it keeps plain numbers.
        if (! $this->forCsv) {
            $sheet->getStyle("M2:N{$last}")->getNumberFormat()->setFormatCode('#,##0.00');
        }
        $sheet->getStyle("U2:U{$last}")->getAlignment()->setWrapText(true);

        foreach ($this->projects->values() as $i => $p) {
            $sheet->getStyle('A'.($i + 2))->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(self::LEVEL_FILLS[$p['level']]);
        }

        return [1 => ['font' => ['bold' => true]]];
    }
}
