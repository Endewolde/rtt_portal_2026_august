<?php

namespace App\Exceptions;

class AlreadySignedException extends \RuntimeException
{
    public function __construct(string $message = 'This user has already signed the budget request.')
    {
        parent::__construct($message);
    }
}
