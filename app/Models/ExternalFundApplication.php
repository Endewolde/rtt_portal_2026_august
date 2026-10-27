<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class ExternalFundApplication extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ef_applications';

    /** The review stages, in order; every one must approve before the application can go to the donor. */
    public const STAGES = ['department', 'college', 'research_office', 'management'];

    /**
     * Where each status may move next. "awarded" is reached only by recording the award itself.
     *
     * @var array<string, list<string>>
     */
    public const TRANSITIONS = [
        'draft' => ['under_internal_review', 'withdrawn'],
        'under_internal_review' => ['approved_for_submission', 'draft', 'withdrawn'],
        'approved_for_submission' => ['submitted', 'under_internal_review', 'withdrawn'],
        'submitted' => ['under_review', 'rejected', 'withdrawn'],
        'under_review' => ['rejected', 'withdrawn'],
        'awarded' => [],
        'rejected' => [],
        'withdrawn' => ['draft'],
    ];

    protected $fillable = [
        'agency_id', 'opportunity_id', 'college_id', 'department_id',
        'pi_user_id', 'ref_number', 'donor_ref_number', 'title',
        'category', 'theme', 'abstract', 'goals_objectives',
        'target_beneficiaries', 'remarks', 'status',
        'partner_institutions', 'lead_institution', 'partner_logo_path',
        'location', 'hu_contribution',
        'amount_requested', 'annual_budget', 'currency',
        'start_date', 'end_date', 'keywords', 'submitted_at', 'created_by',
        'pi_name', 'pi_phone', 'pi_email', 'staff_count',
        'co_investigator_names', 'co_investigator_phones', 'co_investigator_emails',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'submitted_at' => 'datetime',
            'keywords' => 'array',
            'amount_requested' => 'decimal:2',
            'annual_budget' => 'decimal:2',
            'hu_contribution' => 'decimal:2',
            'staff_count' => 'integer',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(ExternalFundAgency::class, 'agency_id');
    }

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(ExternalFundOpportunity::class, 'opportunity_id');
    }

    public function principalInvestigator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pi_user_id');
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class, 'college_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function teamMembers(): HasMany
    {
        return $this->hasMany(ExternalFundTeamMember::class, 'application_id');
    }

    public function budgets(): HasMany
    {
        return $this->hasMany(ExternalFundBudget::class, 'application_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ExternalFundReview::class, 'application_id');
    }

    public function award(): HasOne
    {
        return $this->hasOne(ExternalFundAward::class, 'application_id');
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(ExternalFundDocument::class, 'documentable');
    }

    /** Managers and module viewers see every application; anyone else only the ones they created or lead. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('external_funds.manage') || $user->can('external_funds.view_any')) {
            return $query;
        }

        return $query->where(fn (Builder $q) => $q->where('created_by', $user->id)->orWhere('pi_user_id', $user->id));
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('external_funds.manage') || $user->can('external_funds.view_any')
            || $this->created_by === $user->id || $this->pi_user_id === $user->id;
    }

    /**
     * The current decision at each stage: the most recent review there wins, so a later
     * "revision required" overrides an earlier approval.
     *
     * @return array<string, string>
     */
    public function stageDecisions(): array
    {
        return $this->reviews()->orderBy('reviewed_at')->orderBy('updated_at')->get()
            ->groupBy('stage')
            ->map(fn ($reviews) => $reviews->last()->status)
            ->all();
    }

    /** @return list<string> */
    public function approvedStages(): array
    {
        return array_values(array_intersect(self::STAGES, array_keys(array_filter($this->stageDecisions(), fn ($s) => $s === 'approved'))));
    }
}
