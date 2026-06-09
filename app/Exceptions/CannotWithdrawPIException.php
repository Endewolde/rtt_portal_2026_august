<?php

namespace App\Exceptions;

class CannotWithdrawPIException extends \RuntimeException
{
    public function __construct(string $message = 'The Principal Investigator cannot be withdrawn. Transfer PI role first.')
    {
        parent::__construct($message);
    }
}
