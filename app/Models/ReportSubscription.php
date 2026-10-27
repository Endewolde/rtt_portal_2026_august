<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/** A person's standing order for a report, emailed weekly or monthly. */
class ReportSubscription extends Model
{
    use HasUuids;

    public const FREQUENCIES = ['weekly', 'monthly'];

    public const FORMATS = ['pdf', 'xlsx'];

    protected $fillable = ['user_id', 'report_type', 'filters', 'frequency', 'weekday', 'day_of_month', 'format', 'active', 'last_sent_at'];

    protected function casts(): array
    {
        return [
            'filters' => 'array',
            'weekday' => 'integer',
            'day_of_month' => 'integer',
            'active' => 'boolean',
            'last_sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Whether it should go out on this day. Monthly orders for the 29th–31st go out
     * on the last day of shorter months; nothing is sent twice on the same day.
     */
    public function isDueOn(Carbon $day): bool
    {
        if (! $this->active || ($this->last_sent_at && $this->last_sent_at->isSameDay($day))) {
            return false;
        }

        return match ($this->frequency) {
            'weekly' => $day->dayOfWeekIso === ($this->weekday ?: 1),
            'monthly' => $day->day === min($this->day_of_month ?: 1, $day->daysInMonth),
            default => false,
        };
    }

    /** The next day it will be sent, from today. */
    public function nextRun(?Carbon $from = null): ?Carbon
    {
        if (! $this->active) {
            return null;
        }

        $day = ($from ?? now())->copy()->startOfDay();
        for ($i = 0; $i < 62; $i++) {
            if ($this->isDueOn($day)) {
                return $day;
            }
            $day->addDay();
        }

        return null;
    }
}
