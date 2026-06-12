<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ConferenceSession extends Model
{
    use HasUuids;

    protected $fillable = [
        'conference_id', 'track', 'title', 'description',
        'starts_at', 'ends_at', 'room', 'type', 'sort_order',
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

    public function speakers(): BelongsToMany
    {
        return $this->belongsToMany(ConferenceSpeaker::class, 'conference_session_speakers', 'session_id', 'speaker_id');
    }
}
