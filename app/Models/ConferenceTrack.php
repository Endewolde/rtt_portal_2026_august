<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A topic area of a conference: authors submit to it, reviewers are matched to it. */
class ConferenceTrack extends Model
{
    use HasUuids;

    protected $fillable = ['conference_id', 'name', 'description', 'sort_order'];

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }

    public function abstracts(): HasMany
    {
        return $this->hasMany(ConferenceAbstract::class, 'track_id');
    }
}
