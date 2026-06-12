<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class ExternalFundAward extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ef_awards';

    protected $fillable = [
        'application_id', 'agency_id', 'award_number', 'title',
        'amount_awarded', 'currency', 'start_date', 'end_date',
        'status', 'conditions', 'signed_at', 'approved_by', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'signed_at' => 'datetime',
            'amount_awarded' => 'decimal:2',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(ExternalFundApplication::class, 'application_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(ExternalFundAgency::class, 'agency_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function expenditures(): HasMany
    {
        return $this->hasMany(ExternalFundExpenditure::class, 'award_id');
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(ExternalFundMilestone::class, 'award_id');
    }

    public function budgets(): HasMany
    {
        return $this->hasMany(ExternalFundBudget::class, 'award_id');
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(ExternalFundDocument::class, 'documentable');
    }

    public function getTotalSpentAttribute(): float
    {
        return (float) $this->expenditures()->sum('amount');
    }

    public function getRemainingBudgetAttribute(): float
    {
        return (float) $this->amount_awarded - $this->total_spent;
    }

    public function getUtilizationPercentAttribute(): float
    {
        if ($this->amount_awarded <= 0) {
            return 0;
        }

        return round(($this->total_spent / (float) $this->amount_awarded) * 100, 1);
    }
}
