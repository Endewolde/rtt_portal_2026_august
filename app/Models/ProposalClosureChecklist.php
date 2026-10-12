<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalClosureChecklist extends Model
{
    use HasUuids;

    /** Standard close-out items every funded project must confirm before completion. */
    public const ITEM_KEYS = [
        'final_report_submitted',
        'financial_settlement_verified',
        'research_outputs_recorded',
        'equipment_returned',
        'ip_disclosures_filed',
    ];

    protected $fillable = [
        'proposal_id', 'items', 'updated_by',
    ];

    protected $casts = [
        'items' => 'array',
    ];

    public static function defaultItems(): array
    {
        return array_fill_keys(self::ITEM_KEYS, false);
    }

    public function isComplete(): bool
    {
        $items = array_merge(self::defaultItems(), $this->items ?? []);

        foreach (self::ITEM_KEYS as $key) {
            if (empty($items[$key])) {
                return false;
            }
        }

        return true;
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
