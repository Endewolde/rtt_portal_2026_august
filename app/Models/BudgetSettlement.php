<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetSettlement extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'budget_request_id', 'submitted_by', 'status', 'expense_report_path',
        'total_spent', 'unspent_amount', 'college_verified_by', 'college_verified_at',
        'college_notes', 'finance_verified_by', 'finance_verified_at', 'finance_notes',
    ];

    protected $casts = [
        'total_spent'          => 'decimal:2',
        'unspent_amount'       => 'decimal:2',
        'college_verified_at'  => 'datetime',
        'finance_verified_at'  => 'datetime',
    ];

    public function budgetRequest(): BelongsTo { return $this->belongsTo(BudgetRequest::class); }
    public function submittedBy(): BelongsTo { return $this->belongsTo(User::class, 'submitted_by'); }
    public function collegeVerifiedByUser(): BelongsTo { return $this->belongsTo(User::class, 'college_verified_by'); }
    public function financeVerifiedByUser(): BelongsTo { return $this->belongsTo(User::class, 'finance_verified_by'); }
}
