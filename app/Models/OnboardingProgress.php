<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A user's onboarding progress for one of their roles. */
class OnboardingProgress extends Model
{
    use HasUuids;

    protected $table = 'onboarding_progress';

    protected $fillable = [
        'user_id', 'role', 'welcome_seen_at', 'dismissed_at',
        'completed_tours', 'completed_tasks', 'active_tour', 'active_step',
    ];

    protected function casts(): array
    {
        return [
            'welcome_seen_at' => 'datetime',
            'dismissed_at' => 'datetime',
            'completed_tours' => 'array',
            'completed_tasks' => 'array',
            'active_step' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
