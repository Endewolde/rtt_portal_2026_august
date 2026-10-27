<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** One attempt to call a webhook, kept for troubleshooting. */
class WebhookDelivery extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = ['webhook_id', 'event', 'status_code', 'succeeded', 'response', 'duration_ms', 'created_at'];

    protected function casts(): array
    {
        return ['succeeded' => 'boolean', 'created_at' => 'datetime'];
    }
}
