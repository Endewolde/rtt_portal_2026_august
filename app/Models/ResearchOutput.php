<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ResearchOutput extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'output_type',
        'title',
        'description',
        'recorded_by',
        'status',
        'review_notes',
        'verified_by',
        'verified_at',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function publication(): HasOne
    {
        return $this->hasOne(Publication::class);
    }

    public function patent(): HasOne
    {
        return $this->hasOne(Patent::class);
    }

    public function conferencePresentation(): HasOne
    {
        return $this->hasOne(ConferencePresentation::class);
    }

    public function technology(): HasOne
    {
        return $this->hasOne(Technology::class);
    }

    public function communityImpact(): HasOne
    {
        return $this->hasOne(CommunityImpact::class);
    }
}
