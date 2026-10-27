<?php

namespace App\Exports;

use App\Services\ProjectRiskService;
use App\Support\Terms;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Headline counts: by risk level, by warning and by college. */
class ProjectsAtRiskSummarySheet implements FromArray, ShouldAutoSize, WithStrictNullComparison, WithStyles, WithTitle
{
    /** @var list<int> Rows to print bold (section headings). */
    private array $boldRows = [];

    /**
     * @param  Collection<int, array<string, mixed>>  $projects
     * @param  array<string, mixed>  $summary
     * @param  list<string>  $scope
     */
    public function __construct(
        private readonly Collection $projects,
        private readonly array $summary,
        private readonly array $scope,
    ) {}

    public function title(): string
    {
        return 'Summary';
    }

    public function array(): array
    {
        $rows = [['Projects at Risk'], ['Generated '.now()->format('j M Y, H:i')]];
        foreach ($this->scope as $line) {
            $rows[] = [$line];
        }

        $section = function (array $heading) use (&$rows) {
            $rows[] = [];
            $rows[] = $heading;
            $this->boldRows[] = count($rows);
        };

        $section(['Risk level', 'Projects']);
        $rows[] = ['All running projects', $this->summary['total']];
        foreach (ProjectRiskService::LEVEL_LABELS as $key => $label) {
            $rows[] = [$label, $this->summary[$key]];
        }

        $section(['Warning', 'Projects']);
        foreach (ProjectRiskService::SIGNAL_LABELS as $key => $label) {
            $rows[] = [$label, $this->summary['by_signal'][$key] ?? 0];
        }

        $section([Terms::college(), 'Projects', 'High risk', 'Watch', 'On track', 'Budget ('.Terms::currency().')', 'Released ('.Terms::currency().')']);
        foreach ($this->projects->groupBy(fn ($p) => $p['college'] ?? '—')->sortKeys() as $college => $group) {
            $rows[] = [
                $college,
                $group->count(),
                $group->where('level', 'high')->count(),
                $group->where('level', 'watch')->count(),
                $group->where('level', 'on_track')->count(),
                $group->sum('budget'),
                $group->sum('released'),
            ];
        }

        return $rows;
    }

    public function styles(Worksheet $sheet): array
    {
        $styles = [1 => ['font' => ['bold' => true, 'size' => 14]]];
        foreach ($this->boldRows as $row) {
            $styles[$row] = ['font' => ['bold' => true]];
        }
        $sheet->getStyle('F1:G'.$sheet->getHighestRow())->getNumberFormat()->setFormatCode('#,##0.00');

        return $styles;
    }
}
