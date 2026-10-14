<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** What a proposal looked like when it was submitted (see ProposalVersionService). */
class ProposalVersion extends Model
{
    use HasUuids;

    protected $fillable = ['proposal_id', 'version_number', 'submitted_by', 'submitted_at', 'snapshot'];

    protected function casts(): array
    {
        return [
            'version_number' => 'integer',
            'submitted_at' => 'datetime',
            'snapshot' => 'array',
        ];
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
