<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetTransaction extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'budget_request_id', 'transaction_type', 'amount',
        'description', 'reference_number', 'transacted_by', 'transacted_at',
    ];

    protected $casts = ['amount' => 'decimal:2', 'transacted_at' => 'datetime'];

    public function budgetRequest(): BelongsTo { return $this->belongsTo(BudgetRequest::class); }
    public function transactedBy(): BelongsTo { return $this->belongsTo(User::class, 'transacted_by'); }
}
