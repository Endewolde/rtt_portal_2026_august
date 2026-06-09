<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetRequestItem extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['budget_request_id', 'category', 'description', 'amount', 'justification'];
    protected $casts = ['amount' => 'decimal:2'];

    public function budgetRequest(): BelongsTo { return $this->belongsTo(BudgetRequest::class); }
}
