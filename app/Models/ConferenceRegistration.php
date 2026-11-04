<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ConferenceRegistration extends Model
{
    use HasUuids;

    protected $fillable = [
        'conference_id', 'registration_type_id', 'name', 'email', 'organization', 'phone', 'answers',
        'ticket_code', 'status', 'registered_at', 'checked_in_at', 'checked_in_by',
    ];

    protected $casts = ['registered_at' => 'datetime', 'checked_in_at' => 'datetime', 'answers' => 'array'];

    /** Statuses that hold a seat. */
    public const HOLDS_SEAT = ['pending', 'confirmed'];

    protected static function booted(): void
    {
        static::creating(function (self $registration): void {
            $registration->ticket_code ??= static::newTicketCode();
        });
    }

    /** Ten unambiguous characters, e.g. "K7M3QX9PRA" — the attendee's key to their ticket. */
    public static function newTicketCode(): string
    {
        do {
            $code = collect(range(1, 10))->map(fn () => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[random_int(0, 31)])->join('');
        } while (static::where('ticket_code', $code)->exists());

        return $code;
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(ConferenceRegistrationType::class, 'registration_type_id');
    }

    public function feedback(): HasOne
    {
        return $this->hasOne(ConferenceFeedback::class, 'registration_id');
    }

    public function ticketUrl(): string
    {
        return rtrim(config('app.url'), '/').'/conferences/ticket/'.$this->ticket_code;
    }

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }
}
