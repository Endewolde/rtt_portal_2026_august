<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExternalFundTeamMember extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ef_team_members';

    protected $fillable = [
        'application_id', 'user_id', 'name', 'email',
        'affiliation', 'role', 'is_external',
    ];

    protected function casts(): array
    {
        return [
            'is_external' => 'boolean',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(ExternalFundApplication::class, 'application_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
