<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An invention on its way from the lab to use: disclosed, assessed, protected (patent
 * filed, then granted), and commercialised by licence or spin-off.
 */
class Innovation extends Model
{
    use HasUuids;

    /** In order: an innovation moves forward through these. */
    public const STAGES = ['disclosed', 'assessed', 'filed', 'granted', 'commercialised', 'closed'];

    public const IP_TYPES = ['patent', 'utility_model', 'industrial_design', 'copyright', 'trademark', 'plant_variety', 'trade_secret'];

    public const COMMERCIALISATION = ['licence', 'spin_off', 'assignment', 'in_house'];

    public const INCOME_SOURCES = ['licence_fee', 'royalty', 'equity', 'sale', 'grant', 'other'];

    protected $fillable = [
        'reference', 'title', 'description', 'inventors', 'college_id', 'proposal_id', 'ip_type', 'stage',
        'disclosed_on', 'filing_number', 'filed_on', 'granted_on', 'commercialisation', 'partnership_id',
        'licensee', 'licensed_on', 'spin_off_name', 'notes', 'created_by',
    ];

    protected $casts = ['inventors' => 'array', 'disclosed_on' => 'date', 'filed_on' => 'date', 'granted_on' => 'date', 'licensed_on' => 'date'];

    protected static function booted(): void
    {
        static::creating(function (self $innovation): void {
            // "INV-2026-004": the year's next number.
            if (empty($innovation->reference)) {
                $year = now()->format('Y');
                $count = static::where('reference', 'like', "INV-{$year}-%")->count() + 1;
                $innovation->reference = sprintf('INV-%s-%03d', $year, $count);
            }
        });
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function partnership(): BelongsTo
    {
        return $this->belongsTo(Partnership::class);
    }

    public function incomes(): HasMany
    {
        return $this->hasMany(InnovationIncome::class)->orderByDesc('received_on');
    }
}
