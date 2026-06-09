<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use Database\Factories\SubscriptionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    /** @use HasFactory<SubscriptionFactory> */
    use HasFactory, HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'college_id',
        'subscription_plan_id',
        'status',
        'trial_ends_at',
        'starts_at',
        'ends_at',
        'cancelled_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status'        => SubscriptionStatus::class,
            'trial_ends_at' => 'datetime',
            'starts_at'     => 'datetime',
            'ends_at'       => 'datetime',
            'cancelled_at'  => 'datetime',
        ];
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }

    public function isAccessible(): bool
    {
        return $this->status->isAccessible()
            && ($this->ends_at === null || $this->ends_at->isFuture());
    }
}
