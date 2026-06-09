<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Publication extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'research_output_id',
        'doi',
        'journal_name',
        'volume',
        'issue',
        'pages',
        'year',
        'publisher',
        'is_scopus_indexed',
        'is_wos_indexed',
        'file_path',
    ];

    protected $casts = [
        'year'              => 'integer',
        'is_scopus_indexed' => 'boolean',
        'is_wos_indexed'    => 'boolean',
    ];

    public function researchOutput(): BelongsTo
    {
        return $this->belongsTo(ResearchOutput::class);
    }
}
