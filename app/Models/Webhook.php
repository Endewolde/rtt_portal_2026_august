<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** An address in another system that is called when something changes here. */
class Webhook extends Model
{
    use HasUuids;

    public const EVENTS = [
        'proposal.status_changed' => 'A proposal moves to a new stage (submitted, validated, funded, rejected…)',
        'award.created' => 'A proposal is funded and its award recorded',
        'research_output.created' => 'A research output (article, patent, software…) is recorded',
    ];

    /** Switched off automatically after this many failed deliveries in a row. */
    public const MAX_FAILURES = 20;

    protected $fillable = ['name', 'url', 'secret', 'events', 'active', 'consecutive_failures', 'last_delivered_at', 'created_by'];

    protected $hidden = ['secret'];

    protected function casts(): array
    {
        return ['events' => 'array', 'active' => 'boolean', 'last_delivered_at' => 'datetime'];
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class)->latest('created_at');
    }
}
