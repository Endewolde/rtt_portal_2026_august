<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReviewScore extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'review_assignment_id',
        'evaluation_question_id',
        'score',
        'comment',
        'recommendation',
    ];

    protected $casts = ['score' => 'integer'];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(ReviewAssignment::class, 'review_assignment_id');
    }

    public function evaluationQuestion(): BelongsTo
    {
        return $this->belongsTo(EvaluationQuestion::class, 'evaluation_question_id');
    }
}
