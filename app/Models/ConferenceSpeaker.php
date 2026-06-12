<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ConferenceSpeaker extends Model
{
    use HasUuids;

    protected $fillable = [
        'conference_id', 'name', 'title', 'bio', 'photo',
        'email', 'website', 'twitter', 'linkedin', 'sort_order',
    ];

    protected $casts = ['sort_order' => 'integer'];

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }

    public function sessions(): BelongsToMany
    {
        return $this->belongsToMany(ConferenceSession::class, 'conference_session_speakers', 'speaker_id', 'session_id');
    }
}
