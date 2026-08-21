<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Generic tabular export for any report-builder/report-snapshot result: rows + headings. */
class ReportSnapshotExport implements FromCollection, ShouldAutoSize, WithHeadings, WithStyles
{
    /**
     * @param  array<int, array<string, mixed>>  $rows  Row data keyed by field name.
     * @param  array<string, string>  $columns  Ordered map of field name => display heading.
     */
    public function __construct(private readonly array $rows, private readonly array $columns) {}

    public function collection(): Collection
    {
        $keys = array_keys($this->columns);

        return collect($this->rows)->map(
            fn (array $row) => collect($keys)->map(fn (string $key) => $row[$key] ?? '')->toArray()
        );
    }

    public function headings(): array
    {
        return array_values($this->columns);
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true]],
        ];
    }
}
