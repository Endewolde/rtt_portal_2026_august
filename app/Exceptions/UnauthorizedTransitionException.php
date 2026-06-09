<?php

namespace App\Exceptions;

class UnauthorizedTransitionException extends \RuntimeException
{
    public function __construct(string $message = 'The actor is not authorized to perform this workflow transition.')
    {
        parent::__construct($message);
    }
}
