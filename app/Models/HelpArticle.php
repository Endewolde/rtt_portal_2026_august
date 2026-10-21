<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A help centre article — the assistant's only source for "how do I…" answers. */
class HelpArticle extends Model
{
    use HasUuids;

    protected $fillable = [
        'slug', 'title', 'summary', 'body', 'category', 'roles', 'keywords', 'questions', 'page_paths',
        'action_label', 'action_url', 'is_published', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'roles' => 'array',
            'page_paths' => 'array',
            'is_published' => 'boolean',
            'sort_order' => 'integer',
            'views' => 'integer',
            'helpful_yes' => 'integer',
            'helpful_no' => 'integer',
        ];
    }

    /** @return list<string> the common questions, one per line */
    public function questionList(): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\R/', (string) $this->questions))));
    }

    /** Published articles meant for this user's roles (or for everyone). Help editors see all — they support every role. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('help.manage')) {
            return $query->where('is_published', true);
        }

        $roles = $user->getRoleNames()->all();

        return $query->where('is_published', true)->where(function ($q) use ($roles) {
            $q->whereNull('roles')->orWhereJsonLength('roles', 0);
            foreach ($roles as $role) {
                $q->orWhereJsonContains('roles', $role);
            }
        });
    }
}
