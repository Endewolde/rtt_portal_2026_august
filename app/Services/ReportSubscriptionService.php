<?php

namespace App\Services;

use App\Exports\ReportSnapshotExport;
use App\Models\ReportSubscription;
use App\Support\PdfAssets;
use App\Support\ReportTable;
use App\Support\Terms;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Scheduled report delivery: each subscription's live report, limited to the
 * subscriber's own scope, emailed as a PDF or Excel attachment.
 */
class ReportSubscriptionService
{
    /** Report types whose labels the emails and files use. */
    public const LABELS = [
        'proposal_count_by_category' => 'Proposal Statistics',
        'proposal_count_by_college' => 'Proposals by College',
        'proposal_trend_by_year' => 'Year-over-Year Trends',
        'approval_rate_by_category' => 'Approval Rates',
        'review_progress_pipeline' => 'Review Pipeline',
        'college_performance' => 'College Performance',
        'reviewer_workload' => 'Reviewer Workload',
        'budget_utilization' => 'Budget Utilization',
        'complaint_summary' => 'Complaints Summary',
        'sdg_alignment' => 'SDG Alignment',
    ];

    public function __construct(private ReportService $reports) {}

    /**
     * Subscriptions due today.
     *
     * @return Collection<int, ReportSubscription>
     */
    public function due(?Carbon $day = null): Collection
    {
        $day ??= now();

        return ReportSubscription::with('user')->where('active', true)->get()
            ->filter(fn (ReportSubscription $s) => $s->user?->status === 'active' && $s->isDueOn($day))
            ->values();
    }

    /**
     * The attachment for a subscription, built from today's figures.
     *
     * @return array{content: string, filename: string, mime: string, rows: int}
     */
    public function build(ReportSubscription $subscription): array
    {
        $user = $subscription->user;
        $filters = $this->reports->scopedFilters($user, $subscription->filters ?? []);
        $live = $this->reports->live($subscription->report_type, $filters, true);
        [$rows, $fields] = ReportTable::tabulate($live['rows']);
        $columns = collect($fields)->mapWithKeys(fn ($f) => [$f => ReportTable::label($f)])->all();
        $name = str_replace('_', '-', $subscription->report_type).'-'.now()->format('Y-m-d');

        if ($subscription->format === 'xlsx') {
            return [
                'content' => Excel::raw(new ReportSnapshotExport($rows, $columns), ExcelFormat::XLSX),
                'filename' => "{$name}.xlsx",
                'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'rows' => count($rows),
            ];
        }

        $settings = DB::table('app_settings')->whereIn('key', ['organization_name', 'system_name', 'system_logo'])->pluck('value', 'key');

        return [
            'content' => Pdf::loadView('pdf.live-report', [
                'title' => self::LABELS[$subscription->report_type] ?? $subscription->report_type,
                'scope' => $this->scopeLine($filters),
                'columns' => $columns,
                'rows' => $rows,
                'totals' => $this->totals($rows, array_keys($columns)),
                'orgName' => $settings['organization_name'] ?? 'Research Office',
                'systemName' => $settings['system_name'] ?? 'RTT Platform',
                'logo' => PdfAssets::embeddedImage($settings['system_logo'] ?? null),
                'generatedAt' => now(),
            ])->setPaper('a4', count($columns) > 5 ? 'landscape' : 'portrait')->output(),
            'filename' => "{$name}.pdf",
            'mime' => 'application/pdf',
            'rows' => count($rows),
        ];
    }

    /** Build and email one subscription now, and note when it went out. */
    public function send(ReportSubscription $subscription): void
    {
        app(MailConfigService::class)->applyFromDatabase();

        $file = $this->build($subscription);
        $user = $subscription->user;
        $title = self::LABELS[$subscription->report_type] ?? $subscription->report_type;
        $filters = $this->reports->scopedFilters($user, $subscription->filters ?? []);
        $link = rtrim(config('app.url'), '/').'/reports?'.http_build_query(['type' => $subscription->report_type] + $filters);

        Mail::html(
            view('emails.report_delivery', [
                'recipient' => $user,
                'title' => $title,
                'scope' => $this->scopeLine($filters),
                'frequency' => $subscription->frequency,
                'rows' => $file['rows'],
                'link' => $link,
            ])->render(),
            fn ($msg) => $msg->to($user->email, $user->name)
                ->subject("{$title} — ".now()->format('j M Y'))
                ->attachData($file['content'], $file['filename'], ['mime' => $file['mime']])
        );

        $subscription->forceFill(['last_sent_at' => now()])->save();
    }

    /** @param  array<string, string>  $filters */
    private function scopeLine(array $filters): string
    {
        $college = ! empty($filters['college_id']) ? DB::table('colleges')->where('id', $filters['college_id'])->value('name') : null;

        return implode(' · ', [
            $filters['academic_year'] ?? 'All '.strtolower(Terms::academicYear()).'s',
            $college ?? 'All '.strtolower(Terms::college(true)),
            ! empty($filters['category']) ? ucwords(str_replace('_', ' ', $filters['category'])) : 'All categories',
        ]);
    }

    /**
     * Column totals for count-like columns; rates, averages and text are left blank.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @param  list<string>  $fields
     * @return array<string, mixed>|null
     */
    private function totals(array $rows, array $fields): ?array
    {
        if (count($rows) < 2) {
            return null;
        }

        $totals = [];
        foreach ($fields as $i => $field) {
            $numeric = collect($rows)->every(fn ($r) => $r[$field] === null || is_numeric($r[$field]));
            $summable = $numeric && ! preg_match('/percent|rate|avg|average|days|year/', $field);
            $totals[$field] = $i === 0 ? 'Total' : ($summable ? collect($rows)->sum(fn ($r) => (float) $r[$field]) : null);
        }

        return $totals;
    }
}
