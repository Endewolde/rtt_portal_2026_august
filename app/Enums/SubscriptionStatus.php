<?php

namespace App\Enums;

enum SubscriptionStatus: string
{
    case Trial     = 'trial';
    case Active    = 'active';
    case Suspended = 'suspended';
    case Expired   = 'expired';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Trial     => 'Trial',
            self::Active    => 'Active',
            self::Suspended => 'Suspended',
            self::Expired   => 'Expired',
            self::Cancelled => 'Cancelled',
        };
    }

    public function isAccessible(): bool
    {
        return in_array($this, [self::Trial, self::Active]);
    }
}
