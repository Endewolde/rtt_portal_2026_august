<?php

namespace App\Exceptions;

class ReminderCooldownException extends \InvalidArgumentException
{
    public function __construct(string $message = 'A reminder was already sent for this assignment in the last few minutes.')
    {
        parent::__construct($message);
    }
}
