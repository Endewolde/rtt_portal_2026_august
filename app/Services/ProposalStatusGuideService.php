<?php

namespace App\Services;

use App\Models\BudgetAllocation;
use App\Models\BudgetRequest;
use App\Models\DefenceSession;
use App\Models\MidtermEvaluation;
use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use Illuminate\Support\Facades\DB;

/**
 * Plain-language "where is my proposal and what do I do next" for the research team:
 * the journey with the current step, what is happening now, roughly how long it
 * takes, and any action waiting on the team.
 */
class ProposalStatusGuideService
{
    /** The journey shown to researchers — several workflow statuses map to one step. */
    private const JOURNEY = [
        ['key' => 'prepare', 'label' => 'Prepare', 'statuses' => ['draft']],
        ['key' => 'validation', 'label' => 'Validation', 'statuses' => ['submitted']],
        ['key' => 'blind_review', 'label' => 'Blind review', 'statuses' => ['validated', 'under_blind_review']],
        ['key' => 'defence', 'label' => 'Open defence', 'statuses' => ['blind_review_passed', 'under_open_defence']],
        ['key' => 'central', 'label' => 'Central evaluation', 'statuses' => ['accepted']],
        ['key' => 'project', 'label' => 'Project', 'statuses' => ['funded', 'midterm_evaluation']],
        ['key' => 'completed', 'label' => 'Completed', 'statuses' => ['completed', 'archived']],
    ];

    /** @return array<string, mixed> */
    public function guide(Proposal $proposal): array
    {
        $proposal->loadMissing('proposalCall:id,end_date,title');
        $currentIndex = collect(self::JOURNEY)->search(fn ($step) => in_array($proposal->status, $step['statuses'], true));
        $rejectedAt = $proposal->status === 'rejected' ? $this->rejectedAtStep($proposal) : null;

        $steps = collect(self::JOURNEY)->map(function ($step, $i) use ($currentIndex, $rejectedAt) {
            $state = match (true) {
                $rejectedAt !== null && $i === $rejectedAt => 'stopped',
                $rejectedAt !== null && $i > $rejectedAt => 'skipped',
                $rejectedAt !== null => 'done',
                $currentIndex === false => 'upcoming',
                $i < $currentIndex => 'done',
                $i === $currentIndex => 'current',
                default => 'upcoming',
            };

            return ['key' => $step['key'], 'label' => $step['label'], 'state' => $state];
        })->values();

        $target = TurnaroundService::STAGES[$proposal->status]['target'] ?? null;
        $daysInStage = $proposal->status_entered_at ? (int) floor($proposal->status_entered_at->diffInHours(now()) / 24) : null;

        return [
            'status' => $proposal->status,
            'steps' => $steps,
            'headline' => $this->headline($proposal),
            'explanation' => $this->explanation($proposal),
            'days_in_stage' => $daysInStage,
            'typical_days' => $target,
            'taking_longer' => $target !== null && $daysInStage !== null && $daysInStage > $target,
            'actions' => $this->actions($proposal),
        ];
    }

    private function headline(Proposal $proposal): string
    {
        return match ($proposal->status) {
            'draft' => $this->wasReturned($proposal) ? __('Returned to you for corrections') : __('Draft — not yet submitted'),
            'submitted' => __('Submitted — waiting for validation'),
            'validated' => __('Validated — reviewers are being assigned'),
            'under_blind_review' => __('In blind review'),
            'blind_review_passed' => __('Passed blind review — open defence is being scheduled'),
            'under_open_defence' => __('Open defence scheduled'),
            'accepted' => __('In central evaluation'),
            'funded' => __('Funded — your project is under way'),
            'midterm_evaluation' => __('Mid-term evaluation'),
            'completed' => __('Project completed'),
            'archived' => __('Project completed and archived'),
            'rejected' => __('Not selected'),
            default => __('In progress'),
        };
    }

    private function explanation(Proposal $proposal): string
    {
        return match ($proposal->status) {
            'draft' => $this->wasReturned($proposal)
                ? __('The validation office returned your proposal so you can fix a few things. Make the changes and submit it again.')
                : __('Your proposal is saved but nobody can see it until you submit it.'),
            'submitted' => __('The research office is checking that your proposal is complete and fits the call. You do not need to do anything.'),
            'validated' => __('Your proposal passed validation. The office is choosing independent reviewers for it.'),
            'under_blind_review' => __('Independent reviewers are scoring your proposal without knowing who wrote it.').' '
                .$this->reviewProgress($proposal),
            'blind_review_passed' => __('Your proposal scored well enough in blind review. The next step is to present it at an open defence — your college officer will schedule it.'),
            'under_open_defence' => __('You will present your proposal to a panel, who score it on the day.').' '.$this->defenceDetails($proposal),
            'accepted' => __('You passed blind review and open defence. The central evaluation committee is making the final funding decision.'),
            'funded' => __('Congratulations — your project is funded. Keep your progress reports and budget paperwork up to date.'),
            'midterm_evaluation' => __('Your project is at its mid-term review, where you present progress and spending.').' '.$this->midtermDetails($proposal),
            'completed', 'archived' => __('Thank you — your project is complete. Make sure your publications and other outputs are recorded.'),
            'rejected' => $proposal->rejection_reason
                ? __('Reason given: :reason', ['reason' => $proposal->rejection_reason])
                : __('Your proposal was not selected this time.'),
            default => '',
        };
    }

    /** @return list<array{label: string, detail: string, tab: string|null, urgent: bool}> */
    private function actions(Proposal $proposal): array
    {
        $actions = [];

        if ($proposal->status === 'draft') {
            $deadline = $proposal->extended_deadline ?? $proposal->proposalCall?->end_date;
            $actions[] = [
                'label' => $this->wasReturned($proposal) ? __('Make the corrections and resubmit') : __('Complete and submit your proposal'),
                'detail' => $deadline ? __('Deadline: :date', ['date' => $deadline->format('D, M j, Y g:i A')]) : __('Submit before the call closes.'),
                'tab' => null,
                'urgent' => $deadline !== null && $deadline->isFuture() && now()->diffInDays($deadline) <= 3,
            ];
        }

        if ($proposal->status === 'under_open_defence') {
            $actions[] = ['label' => __('Prepare your defence presentation'), 'detail' => $this->defenceDetails($proposal), 'tab' => null, 'urgent' => false];
        }

        if (in_array($proposal->status, ['funded', 'midterm_evaluation'], true)) {
            if ($proposal->contract_status !== 'approved') {
                $actions[] = [
                    'label' => $proposal->contract_status === 'rejected' ? __('Correct and resubmit your research contract') : __('Sign and submit your research contract'),
                    'detail' => $proposal->contract_status === 'submitted'
                        ? __('Submitted — waiting for approval.')
                        : __('Funds are released only after the contract is approved.'),
                    'tab' => 'Overview',
                    'urgent' => $proposal->contract_status !== 'submitted',
                ];
            }

            if ($proposal->ethical_clearance_required && in_array($proposal->ethical_clearance_status, [null, 'rejected', 'expired'], true)) {
                $actions[] = [
                    'label' => __('Upload your ethical clearance certificate'),
                    'detail' => $proposal->ethical_clearance_status === 'expired' ? __('Your clearance has expired.') : __('Required for this study.'),
                    'tab' => 'Documents',
                    'urgent' => true,
                ];
            }

            $nextReport = ProgressReport::where('proposal_id', $proposal->id)
                ->whereIn('status', [ProgressReport::STATUS_DUE, ProgressReport::STATUS_REVISION])
                ->whereDate('period_start', '<=', now())
                ->orderBy('period_number')
                ->first();
            if ($nextReport && ($nextReport->period_end->isPast() || $nextReport->status === ProgressReport::STATUS_REVISION)) {
                $actions[] = [
                    'label' => $nextReport->status === ProgressReport::STATUS_REVISION
                        ? __('Revise your progress report')
                        : ($nextReport->is_final ? __('Submit your final report') : __('Submit your progress report #:number', ['number' => $nextReport->period_number])),
                    'detail' => $nextReport->isOverdue()
                        ? __('Overdue since :date.', ['date' => $nextReport->due_date->format('M j, Y')])
                        : __('Due by :date.', ['date' => $nextReport->due_date->format('M j, Y')]),
                    'tab' => 'Progress',
                    'urgent' => $nextReport->isOverdue(),
                ];
            }

            $allocationApproved = BudgetAllocation::where('proposal_id', $proposal->id)->where('allocation_type', 'proposal')->where('status', 'approved')->exists();
            if ($allocationApproved && $proposal->contract_status === 'approved' && ! BudgetRequest::where('proposal_id', $proposal->id)->exists()) {
                $actions[] = ['label' => __('Request your first budget release'), 'detail' => __('Your budget allocation is approved.'), 'tab' => 'Budget', 'urgent' => false];
            }
        }

        if ($proposal->status === 'rejected') {
            $actions[] = [
                'label' => __('Ask for reconsideration or raise a concern'),
                'detail' => __('If you believe the decision was wrong, you can request reconsideration or file a complaint from this page.'),
                'tab' => 'Complaints',
                'urgent' => false,
            ];
        }

        return $actions;
    }

    private function wasReturned(Proposal $proposal): bool
    {
        return DB::table('workflow_logs')->where('proposal_id', $proposal->id)->where('action', 'return_for_correction')->exists();
    }

    private function reviewProgress(Proposal $proposal): string
    {
        $assignments = ReviewAssignment::where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'blind_review%'))
            ->whereNotIn('status', ['declined', 'cancelled'])
            ->pluck('status');

        return $assignments->isEmpty() ? '' : __(':done of :total reviews are in.', [
            'done' => $assignments->filter(fn ($s) => $s === 'submitted')->count(),
            'total' => $assignments->count(),
        ]);
    }

    private function defenceDetails(Proposal $proposal): string
    {
        $session = DefenceSession::where('proposal_id', $proposal->id)->where('status', 'scheduled')->latest()->first();
        if (! $session) {
            return '';
        }

        return __('Date: :date', ['date' => $session->scheduled_date->format('D, M j, Y')])
            .($session->scheduled_time ? ' '.__('at :time', ['time' => substr((string) $session->scheduled_time, 0, 5)]) : '')
            .($session->venue ? ', '.__('venue: :venue', ['venue' => $session->venue]) : '').'.';
    }

    private function midtermDetails(Proposal $proposal): string
    {
        $midterm = MidtermEvaluation::where('proposal_id', $proposal->id)->latest('evaluation_date')->first();

        return $midterm?->evaluation_date ? __('Scheduled for :date.', ['date' => $midterm->evaluation_date->format('D, M j, Y')]) : '';
    }

    /** Which journey step the proposal was stopped at, from the stage it was rejected out of. */
    private function rejectedAtStep(Proposal $proposal): int
    {
        $from = DB::table('workflow_logs')->where('proposal_id', $proposal->id)->where('to_stage', 'rejected')->orderByDesc('created_at')->value('from_stage');
        $index = collect(self::JOURNEY)->search(fn ($step) => in_array($from, $step['statuses'], true));

        return $index === false ? 1 : $index;
    }
}
