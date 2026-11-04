<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * What the maintenance page shows about proposals while the platform is down. It is read
 * once, when maintenance is switched on, and baked into the static page — so it only uses
 * figures the public site already shows (counts, open calls, titles of funded projects),
 * never applicant names or unpublished work.
 */
class MaintenancePageData
{
    /** Funded and later stages — the projects the public showcase already lists. */
    private const FUNDED = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    /**
     * The proposal journey shown step by step, with the statuses counted at each step.
     *
     * @var list<array{key: string, label: string, statuses: list<string>, text: string}>
     */
    private const JOURNEY = [
        ['key' => 'submitted', 'label' => 'Submission', 'statuses' => ['submitted'], 'text' => 'The PI submits the proposal against an open call. The college RTT office checks it is complete and eligible.'],
        ['key' => 'blind', 'label' => 'Blind review', 'statuses' => ['validated', 'under_blind_review'], 'text' => 'Independent reviewers score the proposal without knowing who wrote it, against the published criteria.'],
        ['key' => 'defence', 'label' => 'Open defence', 'statuses' => ['blind_review_passed', 'under_open_defence'], 'text' => 'Proposals that pass blind review are presented to a panel, which questions the team and scores the defence.'],
        ['key' => 'approval', 'label' => 'Approval', 'statuses' => ['accepted'], 'text' => 'Successful proposals go to the central committee for final approval and a funding decision.'],
        ['key' => 'running', 'label' => 'Funded & running', 'statuses' => ['funded', 'midterm_evaluation'], 'text' => 'Funds are released in milestones while the team reports progress and passes a midterm evaluation.'],
        ['key' => 'completed', 'label' => 'Completed', 'statuses' => ['completed', 'archived'], 'text' => 'Finished projects present their results and join the public research repository.'],
    ];

    /**
     * @return array{
     *     academic_year: ?string,
     *     stats: array{submitted: int, in_review: int, funded: int, colleges: int},
     *     journey: list<array{key: string, label: string, text: string, count: int}>,
     *     open_calls: list<array{title: string, programme: string, color: string, ends: string, days_left: int}>,
     *     recently_funded: list<array{title: string, programme: string, color: string, college: ?string, year: ?string}>
     * }
     */
    public static function collect(): array
    {
        $year = DB::table('app_settings')->where('key', 'current_academic_year')->value('value');
        $proposals = fn () => DB::table('proposals')->whereNull('proposals.deleted_at');
        $programmes = Programmes::all()->keyBy('key');
        $programme = fn (?string $key) => [
            'programme' => $programmes[$key]['name'] ?? Programmes::label($key),
            'color' => $programmes[$key]['color'] ?? '#3b82f6',
        ];

        $countsByStatus = $proposals()
            ->when($year, fn ($q) => $q->where('academic_year', $year))
            ->select('proposals.status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');
        $countOf = fn (array $statuses) => (int) collect($statuses)->sum(fn ($s) => $countsByStatus[$s] ?? 0);

        return [
            'academic_year' => $year,
            'stats' => [
                // Every proposal submitted this year, wherever it stands now — rejected ones included.
                'submitted' => (int) $countsByStatus->except(['draft'])->sum(),
                'in_review' => $countOf(['validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence', 'accepted']),
                'funded' => $proposals()->whereIn('status', self::FUNDED)->count(),
                'colleges' => DB::table('colleges')->where('status', 'active')->where('code', '!=', 'ORTT')->count(),
            ],
            'journey' => array_map(fn (array $step) => [
                'key' => $step['key'],
                'label' => $step['label'],
                'text' => $step['text'],
                'count' => $countOf($step['statuses']),
            ], self::JOURNEY),
            'open_calls' => DB::table('proposal_calls')
                ->where('status', 'active')
                ->where('end_date', '>=', now())
                ->orderBy('end_date')
                ->limit(4)
                ->get(['title', 'category', 'end_date'])
                ->map(fn ($call) => [
                    'title' => $call->title,
                    ...$programme($call->category),
                    'ends' => Carbon::parse($call->end_date)->format('j M Y'),
                    'days_left' => (int) max(0, now()->startOfDay()->diffInDays(Carbon::parse($call->end_date)->startOfDay())),
                ])->all(),
            'recently_funded' => $proposals()
                ->leftJoin('colleges', 'colleges.id', '=', 'proposals.college_id')
                ->whereIn('proposals.status', self::FUNDED)
                ->orderByDesc(DB::raw('coalesce(proposals.status_entered_at, proposals.updated_at)'))
                ->limit(6)
                ->get(['proposals.title', 'proposals.category', 'proposals.academic_year', 'colleges.name as college'])
                ->map(fn ($p) => [
                    'title' => $p->title,
                    ...$programme($p->category),
                    'college' => $p->college,
                    'year' => $p->academic_year,
                ])->all(),
        ];
    }
}
