<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackSubmission extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'round',
        'type',
        'rating',
        'message',
        'page_url',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The round currently accepting submissions. */
    public static function currentRound(): int
    {
        return (int) (AppSetting::where('key', 'feedback_current_round')->value('value') ?? 1);
    }

    public static function hasSubmittedCurrentRound(string $userId): bool
    {
        return static::where('user_id', $userId)->where('round', static::currentRound())->exists();
    }
}
