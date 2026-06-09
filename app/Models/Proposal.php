<?php

namespace App\Models;

use App\Models\BudgetAllocation;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Proposal extends Model
{
    use HasUuids, SoftDeletes;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'tracker_number',
        'proposal_call_id',
        'category',
        'title',
        'abstract',
        'keywords',
        'status',
        'pi_user_id',
        'college_id',
        'department_id',
        'academic_year',
        'current_wizard_step',
        'wizard_completed_steps',
        'draft_data',
        'focus_area',
        'duration_months',
        'research_type',
        'submitted_at',
        'validated_at',
        'rejected_at',
        'rejection_reason',
        'created_by',
    ];

    protected $casts = [
        'wizard_completed_steps' => 'array',
        'draft_data'             => 'array',
        'submitted_at'           => 'datetime',
        'validated_at'           => 'datetime',
        'rejected_at'            => 'datetime',
        'current_wizard_step'    => 'integer',
    ];

    public function proposalCall(): BelongsTo
    {
        return $this->belongsTo(ProposalCall::class);
    }

    public function pi(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pi_user_id');
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(ProposalMember::class);
    }

    public function activeMembers(): HasMany
    {
        return $this->hasMany(ProposalMember::class)->where('status', 'active');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ProposalDocument::class);
    }

    public function budgets(): HasMany
    {
        return $this->hasMany(ProposalBudget::class);
    }

    public function workflowLogs(): HasMany
    {
        return $this->hasMany(WorkflowLog::class);
    }

    public function reviewAssignments(): HasMany
    {
        return $this->hasMany(ReviewAssignment::class);
    }

    public function award(): HasOne
    {
        return $this->hasOne(Award::class);
    }

    public function midtermEvaluations(): HasMany
    {
        return $this->hasMany(MidtermEvaluation::class);
    }

    public function budgetAllocations(): HasMany
    {
        return $this->hasMany(BudgetAllocation::class);
    }

    public function completionWorkshop(): HasOne
    {
        return $this->hasOne(CompletionWorkshop::class);
    }

    public function outputs(): HasMany
    {
        return $this->hasMany(ResearchOutput::class);
    }

    public function repositoryRecord(): HasOne
    {
        return $this->hasOne(RepositoryRecord::class);
    }
}
