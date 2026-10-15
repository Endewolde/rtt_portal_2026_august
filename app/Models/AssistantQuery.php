<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One question asked to the assistant, and how it was answered. */
class AssistantQuery extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'query', 'page', 'answer_type', 'intent', 'help_article_id', 'helpful'];

    protected function casts(): array
    {
        return ['helpful' => 'boolean'];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(HelpArticle::class, 'help_article_id');
    }
}
