<?php

namespace App\Exceptions;

use App\Support\Terms;
use RuntimeException;

/** An award would take more than is left in the call's funding budget. */
class OverBudgetException extends RuntimeException
{
    public function __construct(public readonly float $remaining, public readonly float $overBy, string $of = 'the call\'s funding budget')
    {
        parent::__construct($remaining > 0.005
            ? 'Insufficient budget: only '.number_format($remaining, 2).' '.Terms::currency().' is left in '.$of.'.'
            : 'Insufficient budget: nothing is left in '.$of.'.');
    }
}
