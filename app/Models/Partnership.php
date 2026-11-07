<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** An agreement with an outside organisation — an MoU, MoA, contract or collaboration. */
class Partnership extends Model
{
    use HasUuids;

    public const PARTNER_TYPES = ['university', 'industry', 'government', 'ngo', 'international', 'community'];

    public const AGREEMENT_TYPES = ['mou', 'moa', 'contract', 'collaboration', 'licence'];

    /** An agreement ending within this many days is "expiring". */
    public const EXPIRING_DAYS = 90;

    protected $fillable = [
        'partner_name', 'partner_type', 'country', 'agreement_type', 'title', 'scope', 'signed_on', 'expires_on',
        'terminated', 'college_id', 'focal_person_id', 'partner_contact_name', 'partner_contact_email',
        'document_path', 'reminded_on', 'created_by',
    ];

    protected $casts = ['signed_on' => 'date', 'expires_on' => 'date', 'reminded_on' => 'date', 'terminated' => 'boolean'];

    protected $appends = ['state'];

    protected $hidden = ['document_path'];

    /** active, expiring (within EXPIRING_DAYS), expired or terminated. */
    protected function state(): Attribute
    {
        return Attribute::get(fn () => match (true) {
            $this->terminated => 'terminated',
            $this->expires_on?->isPast() && ! $this->expires_on->isToday() => 'expired',
            $this->expires_on && $this->expires_on->lte(now()->addDays(self::EXPIRING_DAYS)) => 'expiring',
            default => 'active',
        });
    }

    /** @param  Builder<self>  $query */
    public function scopeInState(Builder $query, string $state): Builder
    {
        $today = now()->toDateString();
        $soon = now()->addDays(self::EXPIRING_DAYS)->toDateString();

        return match ($state) {
            'terminated' => $query->where('terminated', true),
            'expired' => $query->where('terminated', false)->where('expires_on', '<', $today),
            'expiring' => $query->where('terminated', false)->whereBetween('expires_on', [$today, $soon]),
            'active' => $query->where('terminated', false)->where(fn ($q) => $q->whereNull('expires_on')->orWhere('expires_on', '>', $soon)),
            default => $query,
        };
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function focalPerson(): BelongsTo
    {
        return $this->belongsTo(User::class, 'focal_person_id');
    }

    public function proposals(): BelongsToMany
    {
        return $this->belongsToMany(Proposal::class);
    }
}
