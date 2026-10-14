<?php

namespace App\Models;

use App\Support\TitleCase;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class RepositoryRecord extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'title',
        'abstract',
        'keywords',
        'category',
        'college_id',
        'pi_name',
        'academic_year',
        'status',
        'total_outputs',
        'publications_count',
        'patents_count',
        'is_featured',
    ];

    protected $casts = [
        'is_featured' => 'boolean',
        'total_outputs' => 'integer',
        'publications_count' => 'integer',
        'patents_count' => 'integer',
    ];

    /**
     * Repository titles (copied from the proposal) are stored and shown in one standard form — Title Case
     * (see App\Support\TitleCase) — however the researcher typed them.
     */
    protected function title(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => TitleCase::format($value),
            set: fn (?string $value) => TitleCase::format($value),
        );
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function outputs(): HasManyThrough
    {
        return $this->hasManyThrough(ResearchOutput::class, Proposal::class, 'id', 'proposal_id', 'proposal_id', 'id');
    }
}
