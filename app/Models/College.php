<?php

namespace App\Models;

use App\Enums\Feature;
use App\Services\SubscriptionService;
use Database\Factories\CollegeFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class College extends Model
{
    /** @use HasFactory<CollegeFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['name', 'code', 'dean_name', 'dean_email', 'status'];

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /** The current active or trial subscription, if any. */
    public function activeSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)
            ->whereIn('status', ['trial', 'active'])
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))
            ->latestOfMany('starts_at');
    }

    public function repositoryRecords(): HasMany
    {
        return $this->hasMany(RepositoryRecord::class);
    }

    public function hasFeature(Feature|string $feature): bool
    {
        return app(SubscriptionService::class)->hasFeature($this, $feature);
    }
}
