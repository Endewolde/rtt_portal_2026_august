<?php

namespace App\Exceptions;

class InvalidScoreException extends \RuntimeException
{
    public function __construct(string $message = 'The submitted score is outside the valid range for this question.')
    {
        parent::__construct($message);
    }
}
