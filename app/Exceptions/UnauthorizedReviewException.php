<?php

namespace App\Exceptions;

class UnauthorizedReviewException extends \RuntimeException
{
    public function __construct(string $message = 'You are not the reviewer assigned to this review.')
    {
        parent::__construct($message);
    }
}
