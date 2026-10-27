<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Chasing signed contracts after an award: reminders to the PI, and — when a contract
 * has waited too long — a heads-up to the officers who can follow it up.
 */
class ContractReminderService
{
    /** Funded proposals whose contract is not in: never uploaded, or returned for correction. */
    public function waitingQuery(): Builder
    {
        return Proposal::query()
            ->where('status', 'funded')
            ->where(fn ($q) => $q->whereNull('contract_status')->orWhere('contract_status', 'rejected'));
    }

    /**
     * Remind each proposal's PI. Returns how many were sent.
     *
     * @param  Collection<int, Proposal>  $proposals
     */
    public function remindPis(Collection $proposals, ?User $sender = null): int
    {
        $sent = 0;
        foreach (EloquentCollection::make($proposals->all())->loadMissing('pi') as $p) {
            if (! $p->pi) {
                continue;
            }
            $payload = [
                'tracker_number' => $p->tracker_number,
                'title' => $p->title,
                'proposal_id' => $p->id,
                'message' => $p->contract_status === 'rejected'
                    ? "Your research contract for {$p->tracker_number} was returned for correction. Please upload the corrected, signed contract so the project can start receiving funds."
                    : "Your proposal {$p->tracker_number} has been funded, but its signed research contract has not been uploaded yet. Please upload it so the project can start receiving funds.",
            ];
            try {
                SendEmailNotificationJob::deliver($p->pi, 'contract_reminder', $payload);
                StoreInAppNotificationJob::dispatchSync($p->pi->id, 'contract_reminder', $payload);
                AuditLogger::log('contract.reminder_sent', Proposal::class, $p->id, $sender?->id ?? $p->pi->id, null, ['pi' => $p->pi->email, 'automatic' => $sender === null]);
                $sent++;
            } catch (\Throwable $e) {
                Log::error("Contract reminder failed for {$p->tracker_number}: {$e->getMessage()}");
            }
        }

        return $sent;
    }

    /** Tell the officers who can follow up that a contract has waited too long. */
    public function escalate(Proposal $proposal, int $days): int
    {
        $officers = $this->officersFor($proposal);
        $payload = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'proposal_id' => $proposal->id,
            'message' => "The signed contract for {$proposal->tracker_number} (\"{$proposal->title}\") has been waiting {$days} days. "
                .'The PI has been reminded. Please follow up — no money can be paid until it is in.',
        ];

        foreach ($officers as $officer) {
            try {
                SendEmailNotificationJob::deliver($officer, 'contract_escalation', $payload);
                StoreInAppNotificationJob::dispatchSync($officer->id, 'contract_escalation', $payload);
            } catch (\Throwable $e) {
                Log::error("Contract escalation failed for {$proposal->tracker_number}: {$e->getMessage()}");
            }
        }
        AuditLogger::log('contract.escalated', Proposal::class, $proposal->id, $officers->first()?->id ?? $proposal->pi_user_id, null, ['officers' => $officers->pluck('email')->all(), 'days' => $days]);

        return $officers->count();
    }

    /** When something about this proposal was last logged, e.g. the last reminder. */
    public function lastLogged(string $event, string $proposalId): ?string
    {
        return DB::table('audit_logs')->where('event', $event)->where('auditable_id', $proposalId)->max('created_at');
    }

    /**
     * Who follows up a proposal's contract: the closest reviewers of contracts — its
     * college's officers first, then its programme's director, then the central office.
     *
     * @return Collection<int, User>
     */
    private function officersFor(Proposal $proposal): Collection
    {
        $candidates = User::permission('contracts.review')->where('status', 'active')->get()
            ->filter(fn (User $u) => $u->accessScope()->covers($proposal->college_id, $proposal->category));

        foreach (['isCollege', 'isCategory', 'isAll'] as $level) {
            $closest = $candidates->filter(fn (User $u) => $u->accessScope()->{$level}());
            if ($closest->isNotEmpty()) {
                return $closest->values();
            }
        }

        return collect();
    }
}
