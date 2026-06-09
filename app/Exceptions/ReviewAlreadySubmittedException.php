<?php

namespace App\Exceptions;

class ReviewAlreadySubmittedException extends \RuntimeException
{
    public function __construct(string $message = 'This review has already been submitted and cannot be modified.')
    {
        parent::__construct($message);
    }
}
