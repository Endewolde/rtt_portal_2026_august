<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One message in a proposal's thread between the research team and the staff handling it. */
class ProposalMessage extends Model
{
    use HasUuids;

    protected $fillable = ['proposal_id', 'user_id', 'body', 'attachment_path', 'attachment_name', 'from_team'];

    protected function casts(): array
    {
        return ['from_team' => 'boolean'];
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
