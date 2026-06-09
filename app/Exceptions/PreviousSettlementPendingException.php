<?php

namespace App\Exceptions;

class PreviousSettlementPendingException extends \RuntimeException
{
    public function __construct(string $message = 'A previous settlement must be finance-verified before creating a new budget request.')
    {
        parent::__construct($message);
    }
}
