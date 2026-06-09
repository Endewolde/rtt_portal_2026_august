<?php

namespace App\Exceptions;

class ConflictingReviewerException extends \RuntimeException
{
    public function __construct(string $message = 'One or more reviewers have a conflict of interest with this proposal.')
    {
        parent::__construct($message);
    }
}
