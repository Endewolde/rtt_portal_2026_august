<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConferenceRegistration extends Model
{
    use HasUuids;

    protected $fillable = [
        'conference_id', 'name', 'email', 'organization', 'phone', 'status', 'registered_at',
    ];

    protected $casts = ['registered_at' => 'datetime'];

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }
}
