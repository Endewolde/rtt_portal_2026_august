<?php

namespace App\Exceptions;

class ReviewerOverloadedException extends \InvalidArgumentException
{
    public function __construct(string $message = 'One or more reviewers are at or above the maximum active review workload.')
    {
        parent::__construct($message);
    }
}
