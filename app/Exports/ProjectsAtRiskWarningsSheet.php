<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** One row per warning, so they can be filtered and followed up one by one. */
class ProjectsAtRiskWarningsSheet implements FromCollection, ShouldAutoSize, WithHeadings, WithStyles, WithTitle
{
    /** @param  Collection<int, array<string, mixed>>  $projects */
    public function __construct(private readonly Collection $projects) {}

    public function title(): string
    {
        return 'Warnings';
    }

    public function collection(): Collection
    {
        return $this->projects->flatMap(fn (array $p) => collect($p['signals'])->map(fn (array $s) => [
            $p['tracker_number'],
            $p['title'],
            $p['pi'],
            $p['college'],
            $s['label'],
            $s['level'] === 'high' ? 'Serious' : 'Watch',
            $s['detail'],
        ]))->values();
    }

    public function headings(): array
    {
        return ['Tracker Number', 'Title', 'PI', 'College', 'Warning', 'Severity', 'Details'];
    }

    public function styles(Worksheet $sheet): array
    {
        $sheet->freezePane('A2');
        $sheet->setAutoFilter('A1:G'.max(2, $sheet->getHighestRow()));

        return [1 => ['font' => ['bold' => true]]];
    }
}
