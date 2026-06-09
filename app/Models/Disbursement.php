<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Disbursement extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'budget_request_id', 'disbursed_by', 'amount', 'transaction_id',
        'cheque_number', 'payment_proof_path', 'notes', 'disbursed_at',
    ];

    protected $casts = ['amount' => 'decimal:2', 'disbursed_at' => 'datetime'];

    public function budgetRequest(): BelongsTo { return $this->belongsTo(BudgetRequest::class); }
    public function disbursedBy(): BelongsTo { return $this->belongsTo(User::class, 'disbursed_by'); }
    public function paymentProofs(): HasMany { return $this->hasMany(PaymentProof::class); }
}
