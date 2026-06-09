<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'email_enabled',
        'telegram_enabled',
        'inapp_enabled',
        'events_config',
    ];

    protected $casts = [
        'email_enabled'    => 'boolean',
        'telegram_enabled' => 'boolean',
        'inapp_enabled'    => 'boolean',
        'events_config'    => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
