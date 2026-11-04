<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Someone's part in running one conference, without the platform-wide conferences
 * permission: a chair runs it all, a track chair handles the abstracts of one track,
 * check-in staff work the registration desk.
 */
class ConferenceCommitteeMember extends Model
{
    use HasUuids;

    public const ROLES = ['chair', 'track_chair', 'checkin'];

    protected $fillable = ['conference_id', 'user_id', 'role', 'track_id'];

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(ConferenceTrack::class, 'track_id');
    }
}
