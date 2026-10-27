<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Conference extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'title', 'slug', 'description', 'banner_image', 'thumbnail',
        'start_date', 'end_date', 'timezone', 'location_type',
        'location_address', 'virtual_link', 'status', 'publish_at',
        'max_capacity', 'registration_link', 'is_featured', 'tags', 'created_by',
        'abstract_submission_open', 'abstract_deadline',
    ];

    /** The online join link is for registrants (sent by email) and organisers, not the public. */
    protected $hidden = ['virtual_link'];

    protected $casts = [
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'publish_at' => 'datetime',
        'abstract_deadline' => 'datetime',
        'is_featured' => 'boolean',
        'abstract_submission_open' => 'boolean',
        'tags' => 'array',
        'max_capacity' => 'integer',
    ];

    protected static function booted(): void
    {
        static::creating(function (Conference $conference): void {
            if (empty($conference->slug)) {
                $conference->slug = Str::slug($conference->title).'-'.Str::random(4);
            }
        });
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function speakers(): HasMany
    {
        return $this->hasMany(ConferenceSpeaker::class)->orderBy('sort_order');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ConferenceSession::class)->orderBy('starts_at')->orderBy('sort_order');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(ConferenceRegistration::class);
    }

    public function abstracts(): HasMany
    {
        return $this->hasMany(ConferenceAbstract::class);
    }

    public function getIsUpcomingAttribute(): bool
    {
        return $this->start_date && $this->start_date->isFuture();
    }

    public function getIsPastAttribute(): bool
    {
        $end = $this->end_date ?? $this->start_date;

        return $end && $end->isPast();
    }
}
