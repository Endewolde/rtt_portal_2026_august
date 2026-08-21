<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class OngoingProposalsExport implements FromCollection, ShouldAutoSize, WithHeadings, WithStyles
{
    public function __construct(private readonly Collection $proposals) {}

    public function collection(): Collection
    {
        return $this->proposals->map(fn ($p) => [
            $p->tracker_number,
            $p->title,
            ucwords(str_replace('_', ' ', $p->category ?? '')),
            $p->pi?->name,
            $p->college?->name,
            $p->funded_at?->toDateString(),
            $p->midterm_status ? ucwords(str_replace('_', ' ', $p->midterm_status)) : 'Not Scheduled',
            $p->completion_workshop_status ? ucwords(str_replace('_', ' ', $p->completion_workshop_status)) : '—',
            $p->budget_allocated,
            $p->budget_utilized,
        ]);
    }

    public function headings(): array
    {
        return [
            'Tracker Number',
            'Title',
            'Category',
            'PI Name',
            'College',
            'Funded Date',
            'Midterm Status',
            'Completion Workshop Status',
            'Budget Allocated (ETB)',
            'Budget Utilized (ETB)',
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => 'solid', 'startColor' => ['argb' => 'FF065F46']],
            ],
        ];
    }
}
