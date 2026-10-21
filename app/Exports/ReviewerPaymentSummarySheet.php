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

/** One row per reviewer — what finance pays against — with a totals row. */
class ReviewerPaymentSummarySheet implements FromCollection, ShouldAutoSize, WithHeadings, WithStrictNullComparison, WithStyles, WithTitle
{
    /** @var Collection<int, array<int, mixed>> */
    private Collection $rows;

    /**
     * @param  Collection<int, ReviewAssignment>  $assignments
     * @param  Collection<string, array{completed: int, not_completed: int, blind_completed: int, defence_completed: int}>  $totals
     */
    public function __construct(
        Collection $assignments,
        Collection $totals,
        private readonly string $scopeLabel,
    ) {
        $this->rows = $assignments->groupBy('reviewer_id')
            ->map(function (Collection $items, string $reviewerId) use ($totals) {
                $first = $items->first();
                $t = $totals[$reviewerId];

                return [
                    $first->reviewer?->name ?? '—',
                    $first->reviewer?->email ?? '',
                    ReviewerPaymentExport::isExternal($first) ? 'External' : 'Internal',
                    $items->map(fn ($a) => $a->proposal?->college?->name)->filter()->unique()->sort()->implode(', '),
                    $t['blind_completed'],
                    $t['defence_completed'],
                    $t['completed'],
                    $t['not_completed'],
                ];
            })
            ->sortBy(fn ($row) => mb_strtolower($row[0]))
            ->values();
    }

    public function title(): string
    {
        return 'Payment summary';
    }

    public function collection(): Collection
    {
        return $this->rows->concat([[
            'Total', '', '', '',
            $this->rows->sum(4), $this->rows->sum(5), $this->rows->sum(6), $this->rows->sum(7),
        ]]);
    }

    public function headings(): array
    {
        return [
            ['Reviewer payment summary — '.$this->scopeLabel],
            [
                'Reviewer Name', 'Reviewer Email', 'Reviewer Type', 'College(s)',
                'Blind Reviews Completed', 'Open Defences Completed',
                'Total Reviews Completed', 'Total Reviews Not Completed',
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
            $this->rows->count() + 3 => [
                'font' => ['bold' => true],
                'fill' => ['fillType' => 'solid', 'startColor' => ['argb' => 'FFEEF2FF']],
            ],
        ];
    }
}
