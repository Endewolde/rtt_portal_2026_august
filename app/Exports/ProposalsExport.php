<?php

namespace App\Exports;

use App\Models\Proposal;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ProposalsExport implements FromCollection, ShouldAutoSize, WithHeadings, WithStyles
{
    public function __construct(private readonly Collection $proposals) {}

    public function collection(): Collection
    {
        return $this->proposals->map(fn ($p) => [
            $p->tracker_number,
            $p->title,
            ucwords(str_replace('_', ' ', $p->category ?? '')),
            Proposal::statusLabel($p->status),
            $p->pi?->name,
            $p->pi?->email,
            ucfirst($p->pi?->gender ?? ''),
            $p->college?->name,
            $p->department?->name,
            $p->academic_year,
            $p->budgets_sum_amount ?? $p->budgets()->sum('amount'),
            $p->submitted_at?->toDateString() ?? $p->created_at?->toDateString(),
            $p->updated_at?->toDateString(),
        ]);
    }

    public function headings(): array
    {
        return [
            'Tracker Number',
            'Title',
            'Category',
            'Status',
            'PI Name',
            'PI Email',
            'PI Gender',
            'College',
            'Department',
            'Academic Year',
            'Budget Total (ETB)',
            'Submitted At',
            'Last Updated',
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => 'solid', 'startColor' => ['argb' => 'FF1E3A8A']],
            ],
        ];
    }
}
