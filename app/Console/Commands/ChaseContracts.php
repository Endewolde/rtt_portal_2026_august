<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Services\ContractReminderService;
use Illuminate\Console\Command;

class ChaseContracts extends Command
{
    protected $signature = 'rtt:contract-chase';

    protected $description = 'Daily: remind PIs weekly while a funded project\'s signed contract is missing, and alert the officers after three weeks.';

    /** Days after the award before the first reminder, between reminders, and before officers are told. */
    private const FIRST_REMINDER_AFTER = 3;

    private const REMIND_EVERY = 7;

    private const ESCALATE_AFTER = 21;

    public function handle(ContractReminderService $contracts): int
    {
        $reminded = 0;
        $escalated = 0;

        $contracts->waitingQuery()->with(['award:id,proposal_id,approved_at', 'pi'])->get()
            ->each(function (Proposal $p) use ($contracts, &$reminded, &$escalated) {
                $since = $p->contract_status === 'rejected' ? $p->contract_rejected_at : $p->award?->approved_at;
                if (! $since) {
                    return;
                }
                $days = (int) floor($since->diffInDays(now(), true));

                $lastReminder = $contracts->lastLogged('contract.reminder_sent', $p->id);
                if ($days >= self::FIRST_REMINDER_AFTER && (! $lastReminder || now()->diffInDays($lastReminder, true) >= self::REMIND_EVERY)) {
                    $reminded += $contracts->remindPis(collect([$p]));
                }

                $lastEscalation = $contracts->lastLogged('contract.escalated', $p->id);
                if ($days >= self::ESCALATE_AFTER && (! $lastEscalation || now()->diffInDays($lastEscalation, true) >= self::REMIND_EVERY)) {
                    $contracts->escalate($p, $days);
                    $escalated++;
                }
            });

        $this->info("Reminded {$reminded} PI(s); escalated {$escalated} contract(s) to officers.");

        return self::SUCCESS;
    }
}
