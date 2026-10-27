<?php

namespace App\Models;

use App\Support\Programmes;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A funding programme proposals are submitted under (stored on proposals as `category`). */
class Programme extends Model
{
    use HasUuids;

    protected $fillable = ['key', 'name', 'tracker_prefix', 'description', 'color', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saved(fn () => Programmes::forget());
        static::deleted(fn () => Programmes::forget());
    }
}
