<?php

namespace App\Exceptions;

class LogImmutableException extends \RuntimeException
{
    public function __construct(string $message = 'Log records are immutable and cannot be modified or deleted.')
    {
        parent::__construct($message);
    }
}
