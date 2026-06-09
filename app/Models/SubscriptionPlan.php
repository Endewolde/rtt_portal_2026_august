<?php

namespace App\Models;

use App\Enums\Feature;
use Database\Factories\SubscriptionPlanFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubscriptionPlan extends Model
{
    /** @use HasFactory<SubscriptionPlanFactory> */
    use HasFactory, HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'slug',
        'name',
        'description',
        'features',
        'price',
        'billing_period',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'features'  => 'array',
            'price'     => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class, 'subscription_plan_id');
    }

    public function hasFeature(Feature|string $feature): bool
    {
        $slug = $feature instanceof Feature ? $feature->value : $feature;

        return in_array($slug, $this->features ?? []);
    }
}
