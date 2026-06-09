<?php

namespace App\Exceptions;

class MemberAlreadyInactiveException extends \RuntimeException
{
    public function __construct(string $message = 'This member is already inactive.')
    {
        parent::__construct($message);
    }
}
