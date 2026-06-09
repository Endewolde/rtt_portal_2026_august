<?php

namespace App\Events;

use App\Models\BudgetRequest;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MemberRefusedSignature
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public BudgetRequest $request,
        public User $member,
        public string $reason
    ) {}
}
