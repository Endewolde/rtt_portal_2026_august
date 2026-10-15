<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A reviewer's signed-off confidentiality agreement for an academic year, with the exact text they accepted. */
class ReviewerAgreement extends Model
{
    use HasUuids;

    protected $fillable = ['user_id', 'academic_year', 'agreement_text', 'accepted_at', 'ip_address'];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
