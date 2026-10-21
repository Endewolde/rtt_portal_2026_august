<?php

namespace App\Exports;

use App\Models\ReviewAssignment;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Reviewer payment report: every review assignment with its reviewer's totals,
 * and a one-row-per-reviewer payment summary.
 *
 * "Completed" is a submitted review; "not completed" is one still assigned and
 * outstanding. Declined or cancelled assignments are listed but counted in neither.
 */
class ReviewerPaymentExport implements WithMultipleSheets
{
    public const OUTSTANDING = ['pending', 'accepted', 'in_progress'];

    /** @param Collection<int, ReviewAssignment> $assignments */
    public function __construct(private readonly Collection $assignments, private readonly string $scopeLabel) {}

    public function sheets(): array
    {
        $totals = $this->assignments->groupBy('reviewer_id')->map(fn (Collection $rows) => [
            'completed' => $rows->where('status', 'submitted')->count(),
            'not_completed' => $rows->whereIn('status', self::OUTSTANDING)->count(),
            'blind_completed' => $rows->where('status', 'submitted')->filter(fn ($a) => self::reviewType($a) === 'Blind Review')->count(),
            'defence_completed' => $rows->where('status', 'submitted')->filter(fn ($a) => self::reviewType($a) === 'Open Defence')->count(),
        ]);

        return [
            new ReviewerPaymentDetailSheet($this->assignments, $totals, $this->scopeLabel),
            new ReviewerPaymentSummarySheet($this->assignments, $totals, $this->scopeLabel),
        ];
    }

    public static function reviewType(ReviewAssignment $assignment): string
    {
        $name = (string) $assignment->evaluationType?->name;

        return match (true) {
            str_starts_with($name, 'blind_review') => 'Blind Review',
            str_starts_with($name, 'open_defence') => 'Open Defence',
            default => $assignment->evaluationType?->label ?? 'Review',
        };
    }

    public static function statusLabel(?string $status): string
    {
        return match ($status) {
            'submitted' => 'Completed',
            'pending' => 'Not started',
            'accepted', 'in_progress' => 'In progress',
            'declined' => 'Declined',
            'cancelled' => 'Cancelled',
            'voided' => 'Voided (team did not appear)',
            default => ucfirst(str_replace('_', ' ', (string) $status)),
        };
    }

    public static function isExternal(ReviewAssignment $assignment): bool
    {
        return (bool) $assignment->reviewer?->roles->contains('name', 'external_reviewer');
    }
}
