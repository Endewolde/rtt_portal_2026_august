<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExternalFundBudget extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ef_budgets';

    protected $fillable = [
        'application_id', 'award_id', 'category', 'description',
        'proposed_amount', 'approved_amount', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'proposed_amount' => 'decimal:2',
            'approved_amount' => 'decimal:2',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(ExternalFundApplication::class, 'application_id');
    }

    public function award(): BelongsTo
    {
        return $this->belongsTo(ExternalFundAward::class, 'award_id');
    }

    public function expenditures(): HasMany
    {
        return $this->hasMany(ExternalFundExpenditure::class, 'budget_id');
    }
}
