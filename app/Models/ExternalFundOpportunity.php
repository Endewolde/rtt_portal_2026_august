<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExternalFundOpportunity extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ef_opportunities';

    protected $fillable = [
        'agency_id', 'title', 'ref_number', 'category', 'type',
        'description', 'eligibility', 'amount_min', 'amount_max',
        'currency', 'opening_date', 'deadline', 'expected_notification_date',
        'keywords', 'status', 'is_featured', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'opening_date' => 'date',
            'deadline' => 'date',
            'expected_notification_date' => 'date',
            'keywords' => 'array',
            'is_featured' => 'boolean',
            'amount_min' => 'decimal:2',
            'amount_max' => 'decimal:2',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(ExternalFundAgency::class, 'agency_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(ExternalFundApplication::class, 'opportunity_id');
    }
}
