<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** The central office's release of one academic year's reviewer certificates, with the rules applied. */
class ReviewCertificateRelease extends Model
{
    use HasUuids;

    protected $fillable = ['academic_year', 'min_reviews', 'on_time_only', 'certificates_issued', 'released_by', 'released_at', 'closed_at', 'closed_by', 'close_reason'];

    protected function casts(): array
    {
        return [
            'min_reviews' => 'integer',
            'on_time_only' => 'boolean',
            'certificates_issued' => 'integer',
            'released_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function releasedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /** Closed years keep their certificates on record, but none of them can be downloaded or verified as valid. */
    public function isClosed(): bool
    {
        return $this->closed_at !== null;
    }
}
