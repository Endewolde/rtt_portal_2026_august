<?php

namespace App\Models;

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
}
