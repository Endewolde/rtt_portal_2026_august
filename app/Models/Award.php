<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Award extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'grant_reference',
        'award_letter_path',
        'budget_approval_path',
        'approval_notes',
        'approved_by',
        'approved_at',
        'awarded_amount',
        'grant_letter_approved_at',
        'grant_letter_approved_by',
        'letter_signatory_name',
        'letter_signatory_title',
        'letter_file_no',
        'letter_date',
        'letter_cc',
        'grant_letter_path',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'awarded_amount' => 'decimal:2',
        'grant_letter_approved_at' => 'datetime',
        'letter_cc' => 'array',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
