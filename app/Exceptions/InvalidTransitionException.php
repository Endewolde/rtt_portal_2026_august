<?php

namespace App\Exceptions;

class InvalidTransitionException extends \RuntimeException
{
    public function __construct(string $message = 'The requested workflow transition is not valid.')
    {
        parent::__construct($message);
    }
}
