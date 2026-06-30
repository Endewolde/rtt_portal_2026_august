<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LookupOption extends Model
{
    use HasUuids;

    protected $fillable = ['group', 'label', 'sort_order', 'is_active'];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public const GROUPS = [
        'research_focus_area' => 'Research Focus Area',
        'community_focus_area' => 'Community Focus Area',
        'technology_focus_area' => 'Technology Focus Area',
        'research_type' => 'Research Type',
    ];
}
