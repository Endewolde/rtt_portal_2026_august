<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ConferenceAbstract extends Model
{
    use HasUuids;

    protected $fillable = [
        'conference_id', 'submitter_name', 'submitter_email', 'submitter_affiliation',
        'co_authors', 'title', 'body', 'keywords', 'presentation_type',
        'file_path', 'word_count', 'status', 'submission_token',
        'submitted_at', 'admin_notes',
    ];

    /** The tracking token is the submitter's key to edit or withdraw — never sent unless asked for. */
    protected $hidden = ['submission_token'];

    protected $casts = [
        'co_authors' => 'array',
        'keywords' => 'array',
        'submitted_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $abstract): void {
            if (empty($abstract->submission_token)) {
                $abstract->submission_token = Str::random(32);
            }
        });
    }

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ConferenceAbstractReview::class, 'abstract_id');
    }

    public function averageScore(): ?float
    {
        $scores = $this->reviews()->whereNotNull('score')->pluck('score');

        return $scores->isNotEmpty() ? round($scores->avg(), 1) : null;
    }
}
