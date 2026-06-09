<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetAllocation extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'college_id', 'proposal_id', 'fiscal_year', 'total_amount',
        'allocated_amount', 'remaining_balance', 'allocation_type',
        'status', 'approved_by', 'approved_at', 'rejection_reason',
        'allocated_by', 'notes',
    ];

    protected $casts = [
        'total_amount'      => 'decimal:2',
        'allocated_amount'  => 'decimal:2',
        'remaining_balance' => 'decimal:2',
        'approved_at'       => 'datetime',
    ];

    public function college(): BelongsTo { return $this->belongsTo(College::class); }
    public function proposal(): BelongsTo { return $this->belongsTo(Proposal::class); }
    public function allocatedBy(): BelongsTo { return $this->belongsTo(User::class, 'allocated_by'); }
    public function approvedBy(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
}
