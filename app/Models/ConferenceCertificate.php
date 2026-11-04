<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A certificate of attendance, presentation or reviewing at one conference, verifiable by its code. */
class ConferenceCertificate extends Model
{
    use HasUuids;

    public const KINDS = ['attendance', 'presentation', 'reviewer'];

    protected $fillable = ['conference_id', 'kind', 'source_key', 'recipient_name', 'recipient_email', 'detail', 'code', 'issued_at', 'revoked_at'];

    protected $casts = ['issued_at' => 'datetime', 'revoked_at' => 'datetime'];

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }
}
