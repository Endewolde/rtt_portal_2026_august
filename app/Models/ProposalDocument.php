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

    /** Officer roles that must never see PI CVs — only central_officer (and super_admin/admin/the PI) may. */
    public const CV_RESTRICTED_ROLES = [
        'research_officer',
        'community_officer',
        'technology_officer',
        'college_officer',
        'finance_officer',
        'support_officer',
    ];

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
