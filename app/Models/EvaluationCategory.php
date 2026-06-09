<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EvaluationCategory extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['evaluation_type_id', 'name', 'description', 'order_index', 'weight'];

    protected $casts = [
        'order_index' => 'integer',
        'weight'      => 'float',
    ];

    public function evaluationType(): BelongsTo
    {
        return $this->belongsTo(EvaluationType::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(EvaluationQuestion::class);
    }
}
