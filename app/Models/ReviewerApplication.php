<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An outside expert's application to join the reviewer pool. */
class ReviewerApplication extends Model
{
    use HasUuids;

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const QUALIFICATIONS = ['PhD', "Master's", "Bachelor's", 'Other'];

    protected $fillable = [
        'id', 'name', 'title', 'email', 'phone', 'organization', 'position', 'qualification',
        'expertise', 'bio', 'orcid', 'cv_path', 'status', 'reviewed_by', 'reviewed_at',
        'review_note', 'user_id',
    ];

    protected $hidden = ['cv_path'];

    protected $casts = [
        'expertise' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
