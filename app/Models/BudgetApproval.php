<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetApproval extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['budget_request_id', 'approved_by', 'approval_type', 'notes', 'approved_at'];
    protected $casts = ['approved_at' => 'datetime'];

    public function budgetRequest(): BelongsTo { return $this->belongsTo(BudgetRequest::class); }
    public function approvedBy(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
}
