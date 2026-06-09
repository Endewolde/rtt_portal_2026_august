<?php

namespace App\Exceptions;

class UnauthorizedResolutionException extends \RuntimeException
{
    public function __construct(string $message = 'You are not authorized to resolve this complaint.')
    {
        parent::__construct($message);
    }
}
