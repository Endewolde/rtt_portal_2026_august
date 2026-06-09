<?php

namespace App\Exceptions;

class IncompleteProposalException extends \RuntimeException
{
    public function __construct(string $message = 'The proposal is missing required information and cannot be submitted.')
    {
        parent::__construct($message);
    }
}
