<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalDocument extends Model
{
    use HasUuids;

    /** The only document types a reviewer needs to score a proposal — PI CVs and other
     *  supporting documents can carry identifying info and aren't relevant to scoring. */
    public const REVIEWER_VISIBLE_TYPES = ['proposal_document', 'budget_spreadsheet'];

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'document_type',
        'version',
        'is_current',
        'original_filename',
        'stored_path',
        'file_size',
        'mime_type',
        'extracted_text',
        'uploaded_by',
    ];

    protected $casts = [
        'is_current' => 'boolean',
    ];

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }
}
