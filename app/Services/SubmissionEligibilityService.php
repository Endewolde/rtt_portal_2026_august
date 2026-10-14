<?php

namespace App\Services;

use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Whether a PI may submit a new proposal, given their record on existing funded work.
 * Each rule is a setting: an overdue progress report (on by default), a cap on active
 * grants (0 = no cap) and money disbursed but not accounted for after N days (0 = off).
 * Drafting is always allowed; only the first submission is held back.
 */
class SubmissionEligibilityService
{
    /** @return array{eligible: bool, reasons: list<array{type: string, message: string, proposal_id: string|null}>} */
    public function check(User $pi, ?Proposal $excluding = null): array
    {
        $rules = $this->rules();
        $reasons = [];

        if ($rules['block_overdue_reports']) {
            ProgressReport::with('proposal:id,tracker_number,status')
                ->whereHas('proposal', fn ($q) => $q->where('pi_user_id', $pi->id)->whereIn('status', ProgressReportService::REPORTING_STATUSES))
                ->whereIn('status', [ProgressReport::STATUS_DUE, ProgressReport::STATUS_REVISION])
                ->whereDate('due_date', '<', today())
                ->get()
                ->each(function (ProgressReport $report) use (&$reasons) {
                    $label = $report->is_final ? 'final report' : "progress report #{$report->period_number}";
                    $reasons[] = [
                        'type' => 'overdue_report',
                        'message' => "Your {$label} for {$report->proposal->tracker_number} was due on {$report->due_date->format('M j, Y')}. Submit it first.",
                        'proposal_id' => $report->proposal_id,
                    ];
                });
        }

        if ($rules['max_active_grants'] > 0) {
            $active = Proposal::where('pi_user_id', $pi->id)
                ->whereIn('status', ProgressReportService::REPORTING_STATUSES)
                ->when($excluding, fn ($q) => $q->where('id', '!=', $excluding->id))
                ->count();
            if ($active >= $rules['max_active_grants']) {
                $reasons[] = [
                    'type' => 'active_grants',
                    'message' => "You already lead {$active} active funded project".($active === 1 ? '' : 's').'; the limit is '.$rules['max_active_grants'].'. Complete one before applying again.',
                    'proposal_id' => null,
                ];
            }
        }

        if ($rules['unsettled_days'] > 0) {
            DB::table('budget_requests as br')
                ->join('proposals as p', 'p.id', '=', 'br.proposal_id')
                ->join('disbursements as d', 'd.budget_request_id', '=', 'br.id')
                ->where('p.pi_user_id', $pi->id)
                ->whereNull('p.deleted_at')
                ->where('br.status', 'disbursed')
                ->groupBy('br.id', 'p.id', 'p.tracker_number')
                ->havingRaw('MAX(d.disbursed_at) < ?', [now()->subDays($rules['unsettled_days'])])
                ->get(['p.id', 'p.tracker_number'])
                ->unique('id')
                ->each(function ($row) use (&$reasons, $rules) {
                    $reasons[] = [
                        'type' => 'unsettled_budget',
                        'message' => "Funds released for {$row->tracker_number} more than {$rules['unsettled_days']} days ago have not been settled. Submit the settlement first.",
                        'proposal_id' => $row->id,
                    ];
                });
        }

        return ['eligible' => $reasons === [], 'reasons' => $reasons];
    }

    /** @return array{block_overdue_reports: bool, max_active_grants: int, unsettled_days: int} */
    public function rules(): array
    {
        $s = DB::table('app_settings')
            ->whereIn('key', ['eligibility_block_overdue_reports', 'eligibility_max_active_grants', 'eligibility_unsettled_days'])
            ->pluck('value', 'key');

        return [
            'block_overdue_reports' => filter_var($s['eligibility_block_overdue_reports'] ?? 'true', FILTER_VALIDATE_BOOLEAN),
            'max_active_grants' => max(0, (int) ($s['eligibility_max_active_grants'] ?? 0)),
            'unsettled_days' => max(0, (int) ($s['eligibility_unsettled_days'] ?? 0)),
        ];
    }
}
