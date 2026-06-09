<?php

namespace App\Events;

use App\Models\Proposal;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ProposalTransitioned
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Proposal $proposal,
        public string $fromStage,
        public string $toStage,
        public string $action,
        public User $actor,
        public Carbon $occurredAt
    ) {}
}
