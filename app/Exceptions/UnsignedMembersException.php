<?php

namespace App\Exceptions;

class UnsignedMembersException extends \RuntimeException
{
    public function __construct(string $message = 'All team members must sign before the budget request can be submitted.')
    {
        parent::__construct($message);
    }
}
