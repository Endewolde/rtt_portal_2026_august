<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A kind of place at a conference — e.g. Participant, Presenter, Student — with its own seats. */
class ConferenceRegistrationType extends Model
{
    use HasUuids;

    protected $fillable = ['conference_id', 'name', 'description', 'capacity', 'sort_order'];

    protected $casts = ['capacity' => 'integer', 'sort_order' => 'integer'];

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(ConferenceRegistration::class, 'registration_type_id');
    }
}
