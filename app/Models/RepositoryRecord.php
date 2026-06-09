<?php

namespace App\Models;

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
        'is_featured'        => 'boolean',
        'total_outputs'      => 'integer',
        'publications_count' => 'integer',
        'patents_count'      => 'integer',
    ];

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
