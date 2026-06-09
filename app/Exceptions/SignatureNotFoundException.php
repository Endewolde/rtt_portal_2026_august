<?php

namespace App\Exceptions;

class SignatureNotFoundException extends \RuntimeException
{
    public function __construct(string $message = 'No signature record found for this user on the budget request.')
    {
        parent::__construct($message);
    }
}
