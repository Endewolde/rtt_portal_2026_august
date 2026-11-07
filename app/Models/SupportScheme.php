<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A small grant staff apply for directly — a publication incentive, article processing
 * charges, conference travel — decided and paid by the research office.
 */
class SupportScheme extends Model
{
    use HasUuids;

    public const KINDS = ['publication_incentive', 'article_fee', 'travel', 'thesis', 'other'];

    protected $fillable = ['name', 'kind', 'description', 'academic_year', 'budget', 'max_award', 'max_per_person', 'opens_on', 'closes_on', 'active', 'created_by'];

    protected $casts = ['budget' => 'float', 'max_award' => 'float', 'max_per_person' => 'integer', 'opens_on' => 'date', 'closes_on' => 'date', 'active' => 'boolean'];

    public function applications(): HasMany
    {
        return $this->hasMany(SupportApplication::class, 'scheme_id');
    }

    public function isOpen(): bool
    {
        return $this->active
            && (! $this->opens_on || $this->opens_on->lte(today()))
            && (! $this->closes_on || $this->closes_on->gte(today()));
    }

    /** Money approved so far (approved and paid), against the budget. */
    public function committed(): float
    {
        return (float) $this->applications()->whereIn('status', ['approved', 'paid'])->sum('amount_approved');
    }
}
