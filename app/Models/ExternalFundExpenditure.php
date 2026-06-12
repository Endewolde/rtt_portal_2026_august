<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExternalFundExpenditure extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ef_expenditures';

    protected $fillable = [
        'award_id', 'budget_id', 'description', 'amount',
        'expense_date', 'category', 'receipt_path',
        'recorded_by', 'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function award(): BelongsTo
    {
        return $this->belongsTo(ExternalFundAward::class, 'award_id');
    }

    public function budget(): BelongsTo
    {
        return $this->belongsTo(ExternalFundBudget::class, 'budget_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
