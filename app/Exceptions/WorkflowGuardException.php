<?php

namespace App\Exceptions;

class WorkflowGuardException extends \RuntimeException
{
    public function __construct(string $message = 'A workflow guard condition was not satisfied.')
    {
        parent::__construct($message);
    }
}
