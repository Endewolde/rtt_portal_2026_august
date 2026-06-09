<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Patent extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'research_output_id',
        'patent_number',
        'jurisdiction',
        'filing_date',
        'grant_date',
        'status',
        'technical_specs',
        'file_path',
    ];

    protected $casts = [
        'filing_date' => 'date',
        'grant_date'  => 'date',
    ];

    public function researchOutput(): BelongsTo
    {
        return $this->belongsTo(ResearchOutput::class);
    }
}
