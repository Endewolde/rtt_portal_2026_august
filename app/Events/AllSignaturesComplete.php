<?php

namespace App\Events;

use App\Models\BudgetRequest;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AllSignaturesComplete
{
    use Dispatchable, SerializesModels;

    public function __construct(public BudgetRequest $request) {}
}
