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
        'conference_id', 'track_id', 'submitter_name', 'submitter_email', 'submitter_affiliation',
        'submitter_orcid', 'submitter_country', 'submitter_presenting',
        'co_authors', 'title', 'body', 'keywords', 'presentation_type', 'accepted_type',
        'file_path', 'camera_ready_path', 'camera_ready_at', 'word_count', 'status', 'submission_token',
        'submitted_at', 'decided_at', 'admin_notes', 'session_id', 'session_order',
    ];

    /** The tracking token is the submitter's key to edit or withdraw — never sent unless asked for. */
    protected $hidden = ['submission_token'];

    protected $casts = [
        'co_authors' => 'array',
        'keywords' => 'array',
        'submitted_at' => 'datetime',
        'decided_at' => 'datetime',
        'camera_ready_at' => 'datetime',
        'session_order' => 'integer',
        'submitter_presenting' => 'boolean',
    ];

    /** Who wrote it — removed from what reviewers receive when review is blind. */
    public const AUTHOR_FIELDS = ['submitter_name', 'submitter_email', 'submitter_affiliation', 'submitter_orcid', 'submitter_country', 'submitter_presenting', 'co_authors', 'file_path', 'camera_ready_path'];

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

    /**
     * Words separated by spaces — so Amharic and other non-Latin text is counted too,
     * which PHP's str_word_count does not do.
     */
    public static function countWords(string $text): int
    {
        $text = trim(strip_tags($text));

        return $text === '' ? 0 : count(preg_split('/\s+/u', $text));
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ConferenceSession::class, 'session_id');
    }

    /** The format it was accepted for, which the committee may change from the one asked for. */
    public function finalType(): string
    {
        return $this->accepted_type ?: $this->presentation_type;
    }

    /** The presenting author's name: the first author marked presenting, else the submitter. */
    public function presenterName(): string
    {
        return collect($this->authors())->firstWhere('presenting', true)['name'] ?? $this->submitter_name;
    }

    /**
     * Fill a committee message's merge fields for this abstract, e.g. "Dear {name}".
     */
    public function mergeFields(string $text): string
    {
        $session = $this->session;

        return strtr($text, [
            '{name}' => $this->submitter_name,
            '{title}' => $this->title,
            '{conference}' => $this->conference?->title ?? '',
            '{type}' => ucfirst($this->finalType()),
            '{track}' => $this->track?->name ?? '',
            '{session}' => $session?->title ?? '',
            '{session_time}' => $session?->starts_at?->format('l j F Y, H:i') ?? '',
            '{room}' => $session?->room ?? '',
        ]);
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(ConferenceTrack::class, 'track_id');
    }

    /**
     * Everyone on the abstract, submitter first: name, email, affiliation, country, ORCID and
     * whether they present.
     *
     * @return list<array{name: string, email: ?string, affiliation: ?string, country: ?string, orcid: ?string, presenting: bool}>
     */
    public function authors(): array
    {
        $first = [
            'name' => $this->submitter_name, 'email' => $this->submitter_email, 'affiliation' => $this->submitter_affiliation,
            'country' => $this->submitter_country, 'orcid' => $this->submitter_orcid, 'presenting' => (bool) $this->submitter_presenting,
        ];
        $others = collect($this->co_authors ?? [])->map(fn ($a) => [
            'name' => $a['name'] ?? '', 'email' => $a['email'] ?? null, 'affiliation' => $a['affiliation'] ?? null,
            'country' => $a['country'] ?? null, 'orcid' => $a['orcid'] ?? null, 'presenting' => (bool) ($a['presenting'] ?? false),
        ]);

        return [$first, ...$others->all()];
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
