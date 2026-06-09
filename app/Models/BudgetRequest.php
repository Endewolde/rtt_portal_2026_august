<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class BudgetRequest extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id', 'form_template_id', 'requested_by', 'total_amount',
        'status', 'funding_round', 'all_signatures_complete',
        'college_review_notes', 'rejection_reason', 'submitted_at', 'approved_at',
    ];

    protected $casts = [
        'total_amount'            => 'decimal:2',
        'funding_round'           => 'integer',
        'all_signatures_complete' => 'boolean',
        'submitted_at'            => 'datetime',
        'approved_at'             => 'datetime',
    ];

    public function proposal(): BelongsTo { return $this->belongsTo(Proposal::class); }
    public function formTemplate(): BelongsTo { return $this->belongsTo(FormTemplate::class); }
    public function requestedBy(): BelongsTo { return $this->belongsTo(User::class, 'requested_by'); }
    public function items(): HasMany { return $this->hasMany(BudgetRequestItem::class); }
    public function signatures(): HasMany { return $this->hasMany(FormSignature::class); }
    public function disbursements(): HasMany { return $this->hasMany(Disbursement::class); }
    public function settlement(): HasOne { return $this->hasOne(BudgetSettlement::class); }
}
