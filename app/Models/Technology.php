<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Technology extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'research_output_id',
        'version',
        'repository_url',
        'license',
        'demo_url',
        'technical_specs',
        'file_path',
    ];

    public function researchOutput(): BelongsTo
    {
        return $this->belongsTo(ResearchOutput::class);
    }
}
