<?php

namespace App\Exceptions;

class InvalidWizardStepException extends \RuntimeException
{
    public function __construct(string $message = 'The requested wizard step is not valid.')
    {
        parent::__construct($message);
    }
}
