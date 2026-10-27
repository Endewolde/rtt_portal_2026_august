<?php

namespace App\Exports;

use App\Models\Proposal;
use App\Support\Terms;
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
            Proposal::statusLabel($p->status),
            $p->pi?->name,
            $p->college?->name,
            $p->funded_at?->toDateString(),
            $p->midterm_status ? ucwords(str_replace('_', ' ', $p->midterm_status)) : 'Not Scheduled',
            $p->completion_workshop_status ? ucwords(str_replace('_', ' ', $p->completion_workshop_status)) : '—',
            $p->contract_status ? ucwords($p->contract_status) : 'Not Submitted',
            $p->needs_disbursement ? 'Yes' : 'No',
            $p->outputs_count,
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
            'Status',
            'PI Name',
            Terms::college(),
            'Funded Date',
            'Midterm Status',
            'Completion Workshop Status',
            'Contract Status',
            'Awaiting Disbursement',
            'Research Outputs',
            'Budget Allocated ('.Terms::currency().')',
            'Budget Utilized ('.Terms::currency().')',
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
