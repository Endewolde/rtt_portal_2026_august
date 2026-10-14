<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * How long proposals spend in each workflow stage, where they get stuck, and how
 * quickly reviewers return their scores — the turnaround dashboard.
 */
class TurnaroundService
{
    /**
     * Active stages, who has to act next, and the target number of days in each.
     *
     * @var array<string, array{label: string, target: int, owner: string}>
     */
    public const STAGES = [
        'submitted' => ['label' => 'Awaiting validation', 'target' => 7, 'owner' => 'validators'],
        'validated' => ['label' => 'Awaiting reviewers', 'target' => 7, 'owner' => 'assigners'],
        'under_blind_review' => ['label' => 'Blind review', 'target' => 21, 'owner' => 'reviewers'],
        'blind_review_passed' => ['label' => 'Awaiting defence', 'target' => 14, 'owner' => 'defence_schedulers'],
        'under_open_defence' => ['label' => 'Open defence', 'target' => 7, 'owner' => 'reviewers'],
        'accepted' => ['label' => 'Central evaluation', 'target' => 14, 'owner' => 'central'],
    ];

    private const DIRECTOR_ROLES = [
        'research' => 'research_officer',
        'community_engagement' => 'community_officer',
        'technology_transfer' => 'technology_officer',
    ];

    private const REMINDER_COOLDOWN_HOURS = 24;

    /**
     * @param  array{academic_year?: string|null, college_id?: string|null, category?: string|null}  $filters
     * @return array<string, mixed>
     */
    public function report(array $filters): array
    {
        $proposals = $this->scoped($filters)
            ->where('status', '!=', 'draft')
            ->with('college:id,name')
            ->get(['id', 'tracker_number', 'title', 'status', 'category', 'college_id', 'status_entered_at', 'submitted_at']);

        $logs = DB::table('workflow_logs')
            ->whereIn('proposal_id', $proposals->pluck('id'))
            ->orderBy('created_at')
            ->get(['proposal_id', 'from_stage', 'to_stage', 'created_at'])
            ->groupBy('proposal_id');

        $durations = $this->stageDurations($proposals, $logs);

        return [
            'stages' => $this->stageSummary($durations),
            'colleges' => $this->collegeMatrix($durations, $proposals),
            'stuck' => $this->stuck($proposals),
            'reviewers' => $this->reviewerTurnaround($proposals->pluck('id')),
            'kpis' => $this->kpis($proposals, $logs),
        ];
    }

    /**
     * Notify whoever has to act next on a proposal stuck in its stage.
     *
     * @return array{sent: int, cooldown_until: string|null}
     */
    public function remind(Proposal $proposal, User $sender): array
    {
        $key = "turnaround-reminder:{$proposal->id}:{$proposal->status}";
        if ($until = Cache::get($key)) {
            return ['sent' => 0, 'cooldown_until' => $until];
        }

        $stage = self::STAGES[$proposal->status] ?? null;
        if (! $stage) {
            return ['sent' => 0, 'cooldown_until' => null];
        }

        $days = $this->daysInStage($proposal);
        $recipients = $this->responsible($proposal, $stage['owner']);
        $data = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'message' => "{$proposal->tracker_number} has been at \"{$stage['label']}\" for {$days} days (target {$stage['target']}). "
                ."{$sender->name} asked you to take the next step.",
        ];

        foreach ($recipients as $user) {
            try {
                StoreInAppNotificationJob::dispatchSync($user->id, 'stage_reminder', $data);
            } catch (\Throwable $e) {
                Log::error("Stage reminder (in-app) failed: {$e->getMessage()}");
            }

            try {
                SendEmailNotificationJob::deliver($user, 'stage_reminder', $data);
            } catch (\Throwable $e) {
                Log::error("Stage reminder (email) failed: {$e->getMessage()}");
            }
        }

        $until = now()->addHours(self::REMINDER_COOLDOWN_HOURS);
        Cache::put($key, $until->toIso8601String(), $until);

        return ['sent' => $recipients->count(), 'cooldown_until' => null];
    }

    /** @param array{academic_year?: string|null, college_id?: string|null, category?: string|null} $filters */
    public function scoped(array $filters): Builder
    {
        return Proposal::query()
            ->when($filters['academic_year'] ?? null, fn ($q, $year) => $q->where('academic_year', $year))
            ->when($filters['college_id'] ?? null, fn ($q, $id) => $q->where('college_id', $id))
            ->when($filters['category'] ?? null, fn ($q, $category) => $q->where('category', $category));
    }

    /**
     * Completed and ongoing time per stage, per proposal, in days.
     *
     * @return Collection<int, array{proposal_id: string, college: string, stage: string, days: float, ongoing: bool}>
     */
    private function stageDurations(Collection $proposals, Collection $logs): Collection
    {
        $rows = collect();
        $byId = $proposals->keyBy('id');

        foreach ($logs as $proposalId => $entries) {
            $proposal = $byId->get($proposalId);
            $entries = $entries->values();

            foreach ($entries as $i => $log) {
                if (! isset(self::STAGES[$log->to_stage])) {
                    continue;
                }

                $enteredAt = Carbon::parse($log->created_at);
                $next = $entries->get($i + 1);
                $leftAt = $next ? Carbon::parse($next->created_at) : null;

                // Still in that stage only if it's the proposal's current status.
                if (! $leftAt && $proposal?->status !== $log->to_stage) {
                    continue;
                }

                $rows->push([
                    'proposal_id' => $proposalId,
                    'college' => $proposal?->college?->name ?? 'Unassigned',
                    'stage' => $log->to_stage,
                    'days' => round($enteredAt->diffInHours($leftAt ?? now()) / 24, 1),
                    'ongoing' => $leftAt === null,
                ]);
            }
        }

        return $rows;
    }

    /** @return list<array<string, mixed>> */
    private function stageSummary(Collection $durations): array
    {
        return collect(self::STAGES)->map(function ($stage, $key) use ($durations) {
            $days = $durations->where('stage', $key)->pluck('days')->sort()->values();
            $median = $days->isEmpty() ? null : round($days->median(), 1);

            return [
                'stage' => $key,
                'label' => $stage['label'],
                'target' => $stage['target'],
                'average' => $days->isEmpty() ? null : round($days->avg(), 1),
                'median' => $median,
                'count' => $days->count(),
                'over_target' => $days->filter(fn ($d) => $d > $stage['target'])->count(),
            ];
        })->values()->all();
    }

    /** @return list<array{college: string, stages: array<string, float|null>}> */
    private function collegeMatrix(Collection $durations, Collection $proposals): array
    {
        return $durations->groupBy('college')
            ->map(fn ($rows, $college) => [
                'college' => $college,
                'proposals' => $rows->pluck('proposal_id')->unique()->count(),
                'stages' => collect(self::STAGES)->mapWithKeys(function ($stage, $key) use ($rows) {
                    $days = $rows->where('stage', $key)->pluck('days');

                    return [$key => $days->isEmpty() ? null : round($days->avg(), 1)];
                })->all(),
            ])
            ->sortBy('college')
            ->values()
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function stuck(Collection $proposals): array
    {
        return $proposals
            ->filter(fn (Proposal $p) => isset(self::STAGES[$p->status]) && $p->status_entered_at)
            ->map(function (Proposal $p) {
                $stage = self::STAGES[$p->status];
                $days = $this->daysInStage($p);

                return [
                    'id' => $p->id,
                    'tracker_number' => $p->tracker_number,
                    'title' => $p->title,
                    'college' => $p->college?->name,
                    'status' => $p->status,
                    'stage_label' => $stage['label'],
                    'days' => $days,
                    'target' => $stage['target'],
                    'overdue_by' => $days - $stage['target'],
                    'reminder_cooldown_until' => Cache::get("turnaround-reminder:{$p->id}:{$p->status}"),
                ];
            })
            ->filter(fn ($row) => $row['overdue_by'] > 0)
            ->sortByDesc('overdue_by')
            ->values()
            ->all();
    }

    /** @return array{average_days: float|null, overdue: int, slowest: list<array<string, mixed>>} */
    private function reviewerTurnaround(Collection $proposalIds): array
    {
        $assignments = ReviewAssignment::whereIn('proposal_id', $proposalIds)
            ->whereNotIn('status', ['declined', 'cancelled'])
            ->with('reviewer:id,name')
            ->get(['id', 'reviewer_id', 'status', 'assigned_at', 'submitted_at', 'due_date']);

        $done = $assignments->filter(fn ($a) => $a->status === 'submitted' && $a->assigned_at && $a->submitted_at);
        $overdue = $assignments->filter(fn ($a) => $a->status !== 'submitted' && $a->due_date && $a->due_date->isPast());

        $slowest = $assignments->groupBy('reviewer_id')->map(function ($rows) {
            $finished = $rows->filter(fn ($a) => $a->status === 'submitted' && $a->assigned_at && $a->submitted_at);

            return [
                'name' => $rows->first()->reviewer?->name ?? 'Unknown reviewer',
                'completed' => $finished->count(),
                'average_days' => $finished->isEmpty() ? null : round($finished->avg(fn ($a) => $a->assigned_at->diffInHours($a->submitted_at) / 24), 1),
                'overdue' => $rows->filter(fn ($a) => $a->status !== 'submitted' && $a->due_date && $a->due_date->isPast())->count(),
            ];
        })
            ->filter(fn ($r) => $r['overdue'] > 0 || $r['average_days'] !== null)
            ->sortByDesc(fn ($r) => [$r['overdue'], $r['average_days'] ?? 0])
            ->take(10)
            ->values()
            ->all();

        return [
            'average_days' => $done->isEmpty() ? null : round($done->avg(fn ($a) => $a->assigned_at->diffInHours($a->submitted_at) / 24), 1),
            'overdue' => $overdue->count(),
            'slowest' => $slowest,
        ];
    }

    /** @return array<string, float|int|null> */
    private function kpis(Collection $proposals, Collection $logs): array
    {
        $spans = fn (array $endActions) => $logs->map(function ($entries) use ($endActions) {
            $submitted = $entries->firstWhere('to_stage', 'submitted');
            $end = $entries->first(fn ($l) => in_array($l->to_stage, $endActions, true));

            return $submitted && $end ? Carbon::parse($submitted->created_at)->diffInHours(Carbon::parse($end->created_at)) / 24 : null;
        })->filter(fn ($d) => $d !== null);

        $toDecision = $spans(['blind_review_passed', 'rejected']);
        $toFunding = $spans(['funded']);

        return [
            'in_progress' => $proposals->filter(fn ($p) => isset(self::STAGES[$p->status]))->count(),
            'median_days_to_blind_decision' => $toDecision->isEmpty() ? null : round($toDecision->median(), 1),
            'median_days_to_funding' => $toFunding->isEmpty() ? null : round($toFunding->median(), 1),
        ];
    }

    private function daysInStage(Proposal $proposal): int
    {
        return (int) floor(($proposal->status_entered_at ?? now())->diffInHours(now()) / 24);
    }

    /** @return Collection<int, User> */
    private function responsible(Proposal $proposal, string $owner): Collection
    {
        $active = fn (string $role) => User::role($role)->where('status', 'active');
        $director = self::DIRECTOR_ROLES[$proposal->category] ?? null;

        $users = match ($owner) {
            'validators', 'central' => $active('central_officer')->get()
                ->merge($director ? $active($director)->get() : collect()),
            'assigners', 'defence_schedulers' => $active('college_officer')->where('college_id', $proposal->college_id)->get()
                ->merge($active('central_officer')->get()),
            'reviewers' => User::whereIn('id', ReviewAssignment::where('proposal_id', $proposal->id)
                ->whereNotIn('status', ['submitted', 'declined', 'cancelled'])
                ->pluck('reviewer_id'))->get(),
            default => collect(),
        };

        return $users->unique('id')->values();
    }
}
