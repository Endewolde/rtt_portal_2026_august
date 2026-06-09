<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EvaluationQuestion extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'evaluation_category_id',
        'question_text',
        'max_score',
        'weight',
        'is_required',
        'order_index',
    ];

    protected $casts = [
        'max_score'   => 'integer',
        'weight'      => 'float',
        'is_required' => 'boolean',
        'order_index' => 'integer',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(EvaluationCategory::class, 'evaluation_category_id');
    }

    public function scores(): HasMany
    {
        return $this->hasMany(ReviewScore::class, 'evaluation_question_id');
    }
}
