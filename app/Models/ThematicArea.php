<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ThematicArea extends Model
{
    protected $fillable = [
        'name',
        'description',
        'sub_topics',
        'icon',
        'color',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'sub_topics' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopeActive($query): void
    {
        $query->where('is_active', true);
    }

    public function scopeOrdered($query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
