<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReviewReminder extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'review_assignment_id',
        'type',
        'sent_at',
        'sent_by',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    public function reviewAssignment(): BelongsTo
    {
        return $this->belongsTo(ReviewAssignment::class);
    }

    public function sentBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
