<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityImpact extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'research_output_id',
        'beneficiary_count',
        'location',
        'impact_category',
        'evidence_file_path',
    ];

    protected $casts = [
        'beneficiary_count' => 'integer',
    ];

    public function researchOutput(): BelongsTo
    {
        return $this->belongsTo(ResearchOutput::class);
    }
}
