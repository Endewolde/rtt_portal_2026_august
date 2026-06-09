<?php

namespace App\Exceptions;

class ProposalNotEditableException extends \RuntimeException
{
    public function __construct(string $message = 'This proposal cannot be edited in its current state.')
    {
        parent::__construct($message);
    }
}
