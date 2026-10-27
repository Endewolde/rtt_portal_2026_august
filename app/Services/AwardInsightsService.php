<?php

namespace App\Services;

use App\Models\Proposal;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * What happened after an award: money paid and settled, how long the contract has
 * waited, the timeline from award to completion, the next step, and whether the PI
 * holds other running awards. Shared by the office's Awarded Proposals page and the
 * PI's own Funded Proposals page.
 */
class AwardInsightsService
{
    public const RUNNING = ['funded', 'midterm_evaluation'];

    /**
     * @param  Collection<int, Proposal>  $proposals  with award loaded
     * @return Collection<string, array<string, mixed>> keyed by proposal id
     */
    public function forProposals(Collection $proposals): Collection
    {
        $proposals->loadMissing('award');
        $ids = $proposals->pluck('id');
        if ($ids->isEmpty()) {
            return collect();
        }

        $disbursed = DB::table('disbursements as d')
            ->join('budget_requests as r', 'r.id', '=', 'd.budget_request_id')
            ->whereIn('r.proposal_id', $ids)
            ->groupBy('r.proposal_id')
            ->selectRaw('r.proposal_id, SUM(d.amount) as total, MIN(d.disbursed_at) as first_at, MAX(d.disbursed_at) as last_at, COUNT(*) as payments')
            ->get()->keyBy('proposal_id');

        $settled = DB::table('budget_settlements as s')
            ->join('budget_requests as r', 'r.id', '=', 's.budget_request_id')
            ->whereIn('r.proposal_id', $ids)
            ->whereNotNull('s.finance_verified_at')
            ->groupBy('r.proposal_id')
            ->selectRaw('r.proposal_id, SUM(s.total_spent) as total')
            ->pluck('total', 'proposal_id');

        $midterms = DB::table('midterm_evaluations')->whereIn('proposal_id', $ids)
            ->groupBy('proposal_id')
            ->selectRaw('proposal_id, MAX(COALESCE(scored_at, evaluation_date)) as at')
            ->pluck('at', 'proposal_id');

        $workshops = DB::table('completion_workshops')->whereIn('proposal_id', $ids)->where('status', 'completed')
            ->groupBy('proposal_id')
            ->selectRaw('proposal_id, MAX(scheduled_date) as at')
            ->pluck('at', 'proposal_id');

        $reminded = DB::table('audit_logs')->where('event', 'contract.reminder_sent')->whereIn('auditable_id', $ids)
            ->groupBy('auditable_id')
            ->selectRaw('auditable_id, MAX(created_at) as at')
            ->pluck('at', 'auditable_id');

        // Running awards per PI across the whole platform, so a second one shows up.
        $runningByPi = Proposal::whereIn('status', self::RUNNING)
            ->whereIn('pi_user_id', $proposals->pluck('pi_user_id')->filter()->unique())
            ->get(['id', 'pi_user_id', 'tracker_number'])
            ->groupBy('pi_user_id');

        return $proposals->mapWithKeys(function (Proposal $p) use ($disbursed, $settled, $midterms, $workshops, $reminded, $runningByPi) {
            $awardedAt = $p->award?->approved_at;
            $awarded = (float) ($p->award?->awarded_amount ?? 0);
            $paid = round((float) ($disbursed[$p->id]->total ?? 0), 2);
            $contractOpen = $p->status === 'funded' && $p->contract_status !== 'approved';
            $waitingSince = $p->contract_status === 'rejected' ? $p->contract_rejected_at : $awardedAt;
            $others = in_array($p->status, self::RUNNING, true)
                ? ($runningByPi->get($p->pi_user_id) ?? collect())->where('id', '!=', $p->id)->pluck('tracker_number')->values()
                : collect();

            $timeline = [
                ['key' => 'awarded', 'label' => 'Awarded', 'at' => $awardedAt?->toIso8601String()],
                ['key' => 'letter', 'label' => 'Grant letter issued', 'at' => $p->award?->grant_letter_approved_at?->toIso8601String()],
                ['key' => 'contract', 'label' => 'Contract signed', 'at' => $p->contract_signed_at?->toIso8601String()],
                ['key' => 'paid', 'label' => 'First payment', 'at' => $disbursed[$p->id]->first_at ?? null],
                ['key' => 'midterm', 'label' => 'Midterm evaluation', 'at' => $midterms[$p->id] ?? null],
                ['key' => 'completed', 'label' => 'Completion workshop', 'at' => $workshops[$p->id] ?? null],
            ];

            return [$p->id => [
                'awarded' => $awarded,
                'disbursed' => $paid,
                'payments' => (int) ($disbursed[$p->id]->payments ?? 0),
                'last_paid_at' => $disbursed[$p->id]->last_at ?? null,
                'settled' => round((float) ($settled[$p->id] ?? 0), 2),
                'to_pay' => round(max(0, $awarded - $paid), 2),
                'contract_waiting_days' => $contractOpen && $waitingSince ? (int) floor(now()->diffInDays($waitingSince, true)) : null,
                'last_reminded_at' => $reminded[$p->id] ?? null,
                'other_running_awards' => $others,
                'timeline' => $timeline,
                'next_step' => $this->nextStep($p, $timeline),
            ]];
        });
    }

    /**
     * The one thing that should happen next, in words a PI understands.
     *
     * @param  list<array{key: string, label: string, at: ?string}>  $timeline
     * @return array{key: string, label: string, action: ?string}|null
     */
    private function nextStep(Proposal $p, array $timeline): ?array
    {
        if (in_array($p->status, ['completed', 'archived'], true)) {
            return null;
        }
        if ($p->status === 'funded' && $p->contract_status !== 'approved') {
            return match ($p->contract_status) {
                'pending' => ['key' => 'contract_review', 'label' => 'Your contract is being reviewed by the office.', 'action' => null],
                'rejected' => ['key' => 'contract_fix', 'label' => 'Your contract was returned — upload a corrected, signed copy.', 'action' => 'upload_contract'],
                default => ['key' => 'contract_upload', 'label' => 'Upload your signed research contract so payments can start.', 'action' => 'upload_contract'],
            };
        }
        $done = collect($timeline)->filter(fn ($s) => $s['at'])->pluck('key');
        if (! $done->contains('paid')) {
            return ['key' => 'budget_request', 'label' => 'Submit your first budget request to receive funds.', 'action' => 'budget_request'];
        }
        if (! $done->contains('midterm')) {
            return ['key' => 'midterm', 'label' => 'Keep your progress reports up to date — the midterm evaluation comes next.', 'action' => null];
        }

        return ['key' => 'completion', 'label' => 'Prepare your final report for the completion workshop.', 'action' => null];
    }
}
