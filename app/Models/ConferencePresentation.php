<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConferencePresentation extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'research_output_id',
        'conference_name',
        'location',
        'presentation_date',
        'proceedings_isbn',
        'doi',
        'file_path',
    ];

    protected $casts = [
        'presentation_date' => 'date',
    ];

    public function researchOutput(): BelongsTo
    {
        return $this->belongsTo(ResearchOutput::class);
    }
}
