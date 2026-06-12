<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExternalFundAgency extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ef_agencies';

    protected $fillable = [
        'name', 'acronym', 'type', 'country', 'website',
        'description', 'contact_person', 'contact_email',
        'contact_phone', 'logo_path', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(ExternalFundOpportunity::class, 'agency_id');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(ExternalFundApplication::class, 'agency_id');
    }

    public function awards(): HasMany
    {
        return $this->hasMany(ExternalFundAward::class, 'agency_id');
    }
}
