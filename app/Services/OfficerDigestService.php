<?php

namespace App\Services;

use App\Http\Controllers\Api\ActionCountController;
use App\Jobs\SendRawMailJob;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * The officers' morning email: everything waiting on them today, with a link to each
 * queue — the same counts as the sidebar badges, so nobody has to log in to find out.
 */
class OfficerDigestService
{
    /** Roles that only act on their own work; they get no officer digest. */
    private const PERSONAL_ROLES = ['staff', 'pi', 'reviewer', 'external_reviewer', 'guest'];

    /** @var array<string, array{0: string, 1: string}> count key => [what is waiting, page] */
    private const QUEUES = [
        'validation_queue' => ['Proposals to validate', '/admin/validation-queue'],
        'blind_review_queue' => ['Proposals waiting for blind reviewers', '/admin/blind-review'],
        'open_defence_queue' => ['Open defences to schedule or confirm', '/admin/open-defence'],
        'central_eval_queue' => ['Proposals waiting for the funding decision', '/admin/central-evaluation'],
        'proposal_funding_queue' => ['Funded proposals to set up', '/admin/funding'],
        'contracts_pending_review' => ['Contracts to review', '/admin/contracts'],
        'budget_requests_review' => ['Budget requests to review', '/budget-requests'],
        'pending_allocations' => ['Budgets to allocate', '/budget-allocations'],
        'pending_disbursements' => ['Payments to disburse', '/disbursements'],
        'pending_settlements' => ['Settlements to verify', '/settlements'],
        'overdue_reviews' => ['Reviews past their deadline', '/admin/review-deadlines'],
        'coi_conflicts_pending' => ['Conflicts of interest to reassign', '/admin/coi-conflicts'],
        'similarity_flags_pending' => ['Similarity flags to check', '/admin/similarity-flags'],
        'midterm_pending' => ['Midterm evaluations to schedule or score', '/midterm-evaluations'],
        'completion_workshops_pending' => ['Completion workshops to hold', '/completion-workshops'],
        'deadline_extensions_pending' => ['Deadline extension requests', '/admin/deadline-extensions'],
        'defence_extensions_pending' => ['Defence score extension requests', '/admin/defence-extensions'],
        'ethical_clearances_pending' => ['Ethical clearances to check', '/admin/ethical-clearance'],
        'budget_revisions_pending' => ['Budget revision requests', '/admin/budget-revisions'],
        'no_cost_extensions_pending' => ['No-cost extension requests', '/admin/no-cost-extensions'],
        'approval_reports_open' => ['Mistaken-approval reports', '/admin/approval-reports'],
        'open_complaints' => ['Complaints to answer', '/complaints'],
        'pending_reviews' => ['Reviews assigned to you', '/reviews'],
    ];

    /**
     * What is waiting on this user, biggest first.
     *
     * @return list<array{key: string, label: string, count: int, url: string}>
     */
    public function itemsFor(User $user): array
    {
        $request = Request::create('/api/v1/action-counts');
        $request->setUserResolver(fn () => $user);
        $counts = app(ActionCountController::class)->index($request)->getData(true)['data'] ?? [];

        return collect(self::QUEUES)
            ->map(fn ($queue, $key) => ['key' => $key, 'label' => $queue[0], 'count' => (int) ($counts[$key] ?? 0), 'url' => rtrim(config('app.url'), '/').$queue[1]])
            ->filter(fn ($item) => $item['count'] > 0)
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    /**
     * Email every officer with something waiting. Returns how many were sent.
     *
     * @return array{sent: int, nothing: int}
     */
    public function sendAll(): array
    {
        $sent = 0;
        $nothing = 0;
        $emailOff = DB::table('notification_preferences')->where('email_enabled', false)->pluck('user_id')->flip();

        User::where('status', 'active')
            ->whereNotNull('email')
            ->whereHas('roles', fn ($q) => $q->whereNotIn('name', self::PERSONAL_ROLES))
            ->get()
            ->each(function (User $user) use (&$sent, &$nothing, $emailOff) {
                if ($emailOff->has($user->id)) {
                    return;
                }
                $items = $this->itemsFor($user);
                if (! $items) {
                    $nothing++;

                    return;
                }
                $total = array_sum(array_column($items, 'count'));
                try {
                    SendRawMailJob::deliver(
                        view('emails.officer-digest', ['user' => $user, 'items' => $items, 'total' => $total])->render(),
                        $user->email,
                        $user->name,
                        "Today: {$total} item".($total === 1 ? '' : 's').' waiting on you'
                    );
                    $sent++;
                } catch (\Throwable $e) {
                    Log::error("Officer digest failed for {$user->id}: {$e->getMessage()}");
                }
            });

        return ['sent' => $sent, 'nothing' => $nothing];
    }
}
