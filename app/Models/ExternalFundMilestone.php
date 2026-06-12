<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExternalFundMilestone extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ef_milestones';

    protected $fillable = [
        'award_id', 'title', 'description',
        'due_date', 'completed_at', 'status',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function award(): BelongsTo
    {
        return $this->belongsTo(ExternalFundAward::class, 'award_id');
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->status !== 'completed' && $this->due_date?->isPast();
    }
}
