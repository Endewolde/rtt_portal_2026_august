<?php

namespace App\Exports;

use App\Models\ReviewAssignment;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** One row per review assignment, with the reviewer's completed / not-completed totals. */
class ReviewerPaymentDetailSheet implements FromCollection, ShouldAutoSize, WithHeadings, WithStrictNullComparison, WithStyles, WithTitle
{
    /**
     * @param  Collection<int, ReviewAssignment>  $assignments
     * @param  Collection<string, array{completed: int, not_completed: int}>  $totals
     */
    public function __construct(
        private readonly Collection $assignments,
        private readonly Collection $totals,
        private readonly string $scopeLabel,
    ) {}

    public function title(): string
    {
        return 'Review details';
    }

    public function collection(): Collection
    {
        return $this->assignments
            ->sortBy([fn ($a, $b) => strcasecmp((string) $a->reviewer?->name, (string) $b->reviewer?->name), fn ($a, $b) => strcmp((string) $a->assigned_at, (string) $b->assigned_at)])
            ->map(fn (ReviewAssignment $a) => [
                $a->reviewer?->name ?? '—',
                $a->proposal?->title ?? '—',
                ReviewerPaymentExport::reviewType($a),
                ReviewerPaymentExport::statusLabel($a->status),
                $a->proposal?->college?->name ?? '—',
                $this->totals[$a->reviewer_id]['completed'] ?? 0,
                $this->totals[$a->reviewer_id]['not_completed'] ?? 0,
                $a->proposal?->tracker_number ?? '',
                $a->reviewer?->email ?? '',
                ReviewerPaymentExport::isExternal($a) ? 'External' : 'Internal',
                $a->submitted_at?->toDateString() ?? '',
            ])
            ->values();
    }

    public function headings(): array
    {
        return [
            ['Reviewer payment report — '.$this->scopeLabel.' — generated '.now()->format('d M Y H:i')],
            [
                'Reviewer Name', 'Proposal Title', 'Review Type', 'Review Status', 'College',
                'Total Reviews Completed', 'Total Reviews Not Completed',
                'Tracker Number', 'Reviewer Email', 'Reviewer Type', 'Submitted On',
            ],
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        $sheet->freezePane('A3');

        return [
            1 => ['font' => ['bold' => true, 'size' => 12]],
            2 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => 'solid', 'startColor' => ['argb' => 'FF4338CA']],
            ],
        ];
    }
}
