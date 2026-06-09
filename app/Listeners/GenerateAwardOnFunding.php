<?php

namespace App\Listeners;

use App\Events\ProposalTransitioned;
use App\Models\Award;
use App\Models\User;
use App\Services\AwardService;
use Illuminate\Support\Facades\Log;

class GenerateAwardOnFunding
{
    public function __construct(private AwardService $awardService) {}

    public function handle(ProposalTransitioned $event): void
    {
        if ($event->toStage !== 'funded') {
            return;
        }

        if (Award::where('proposal_id', $event->proposal->id)->exists()) {
            return;
        }

        $approver = User::role('central_officer')->first()
            ?? User::role('super_admin')->first();

        if (! $approver) {
            return;
        }

        try {
            $this->awardService->createForFundedProposal($event->proposal, $approver);
        } catch (\Exception $e) {
            Log::error('Failed to auto-generate award: '.$e->getMessage(), [
                'proposal_id' => $event->proposal->id,
            ]);
        }
    }
}
