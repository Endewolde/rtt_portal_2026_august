<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalTemplate extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'category', 'name', 'template_data',
    ];

    protected $casts = [
        'template_data' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
