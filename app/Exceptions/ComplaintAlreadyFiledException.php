<?php

namespace App\Exceptions;

class ComplaintAlreadyFiledException extends \RuntimeException
{
    public function __construct(string $message = 'An open complaint already exists for this proposal at this stage.')
    {
        parent::__construct($message);
    }
}
