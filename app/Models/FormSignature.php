<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FormSignature extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'budget_request_id', 'user_id', 'role', 'status',
        'signed_at', 'refused_at', 'refusal_reason', 'ip_address',
    ];

    protected $casts = [
        'signed_at'  => 'datetime',
        'refused_at' => 'datetime',
    ];

    public function budgetRequest(): BelongsTo { return $this->belongsTo(BudgetRequest::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
