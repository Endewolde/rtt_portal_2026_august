<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One person's request under a support scheme: submitted → approved or rejected → paid. */
class SupportApplication extends Model
{
    use HasUuids;

    public const STATUSES = ['submitted', 'approved', 'rejected', 'paid', 'withdrawn'];

    protected $fillable = [
        'reference', 'scheme_id', 'applicant_id', 'title', 'venue', 'doi', 'justification', 'amount_requested', 'amount_approved',
        'evidence_path', 'status', 'decision_note', 'decided_by', 'decided_at', 'paid_on',
    ];

    protected $casts = ['amount_requested' => 'float', 'amount_approved' => 'float', 'decided_at' => 'datetime', 'paid_on' => 'date'];

    protected $hidden = ['evidence_path'];

    protected static function booted(): void
    {
        static::creating(function (self $app): void {
            if (empty($app->reference)) {
                $year = now()->format('Y');
                $app->reference = sprintf('SG-%s-%04d', $year, static::where('reference', 'like', "SG-{$year}-%")->count() + 1);
            }
        });
    }

    public function scheme(): BelongsTo
    {
        return $this->belongsTo(SupportScheme::class, 'scheme_id');
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applicant_id');
    }
}
