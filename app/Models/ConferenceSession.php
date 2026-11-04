<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConferenceSession extends Model
{
    use HasUuids;

    protected $fillable = [
        'conference_id', 'track', 'title', 'description',
        'starts_at', 'ends_at', 'room', 'chair', 'type', 'sort_order',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'sort_order' => 'integer',
    ];

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }

    /** Accepted abstracts presented in this session, in running order. */
    public function abstracts(): HasMany
    {
        return $this->hasMany(ConferenceAbstract::class, 'session_id')->orderBy('session_order');
    }

    public function speakers(): BelongsToMany
    {
        return $this->belongsToMany(ConferenceSpeaker::class, 'conference_session_speakers', 'session_id', 'speaker_id');
    }
}
