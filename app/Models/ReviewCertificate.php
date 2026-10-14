<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A reviewer's certificate of service for one academic year, verifiable by its code. */
class ReviewCertificate extends Model
{
    use HasUuids;

    protected $fillable = ['user_id', 'academic_year', 'blind_reviews', 'defence_reviews', 'code', 'issued_at', 'revoked_at', 'revoked_by', 'revocation_reason'];

    protected function casts(): array
    {
        return [
            'blind_reviews' => 'integer',
            'defence_reviews' => 'integer',
            'issued_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function release(): BelongsTo
    {
        return $this->belongsTo(ReviewCertificateRelease::class, 'academic_year', 'academic_year');
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    public function total(): int
    {
        return $this->blind_reviews + $this->defence_reviews;
    }
}
