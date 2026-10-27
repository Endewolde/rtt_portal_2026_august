<?php

namespace App\Models;

use App\Support\TitleCase;
use Illuminate\Database\Eloquent\Casts\Attribute;
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
        'sdgs',
        'call_answers',
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
        'ethical_clearance_required',
        'ethical_clearance_number',
        'ethical_clearance_status',
        'ethical_clearance_expiry',
        'ethical_clearance_submitted_at',
        'ethical_clearance_verified_by',
        'ethical_clearance_verified_at',
        'ethical_clearance_rejection_reason',
        'status_entered_at',
        'contract_signed_at',
        'contract_signed_by',
        'contract_signed_ip',
        'contract_document_path',
        'contract_status',
        'contract_submitted_at',
        'contract_submitted_by',
        'contract_submitted_ip',
        'contract_rejection_reason',
        'contract_rejected_at',
        'contract_rejected_by',
        'contract_rejected_ip',
        'submitted_at',
        'validated_at',
        'rejected_at',
        'rejection_reason',
        'extended_deadline',
        'created_by',
    ];

    protected $casts = [
        'wizard_completed_steps' => 'array',
        'draft_data' => 'array',
        'sdgs' => 'array',
        'call_answers' => 'array',
        'ethical_clearance_required' => 'boolean',
        'ethical_clearance_expiry' => 'date',
        'ethical_clearance_submitted_at' => 'datetime',
        'ethical_clearance_verified_at' => 'datetime',
        'status_entered_at' => 'datetime',
        'contract_signed_at' => 'datetime',
        'contract_submitted_at' => 'datetime',
        'contract_rejected_at' => 'datetime',
        'submitted_at' => 'datetime',
        'validated_at' => 'datetime',
        'rejected_at' => 'datetime',
        'extended_deadline' => 'datetime',
        'current_wizard_step' => 'integer',
        'anonymity_findings' => 'array',
        'anonymity_checked_at' => 'datetime',
        'review_disagreement' => 'array',
        'review_disagreement_flagged_at' => 'datetime',
        'review_disagreement_resolved_at' => 'datetime',
    ];

    /**
     * Human-readable label for a proposal status. `accepted` is the Central Evaluation
     * phase (passed open defence, awaiting the funding decision) — never shown as
     * "Accepted", which would read as a final decision.
     */
    public static function statusLabel(?string $status): string
    {
        return match ($status) {
            null, '' => '',
            'accepted' => 'Central Evaluation',
            default => ucwords(str_replace('_', ' ', $status)),
        };
    }

    /**
     * Proposal titles are stored and shown in one standard form — Title Case
     * (see App\Support\TitleCase) — however the researcher typed them.
     */
    protected function title(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => TitleCase::format($value),
            set: fn (?string $value) => TitleCase::format($value),
        );
    }

    public function proposalCall(): BelongsTo
    {
        return $this->belongsTo(ProposalCall::class);
    }

    public function pi(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pi_user_id');
    }

    public function contractSignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'contract_signed_by');
    }

    public function ethicalClearanceVerifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ethical_clearance_verified_by');
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

    public function budgetRequests(): HasMany
    {
        return $this->hasMany(BudgetRequest::class);
    }

    public function researchOutputs(): HasMany
    {
        return $this->hasMany(ResearchOutput::class);
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

    public function budgetMilestones(): HasMany
    {
        return $this->hasMany(BudgetMilestone::class);
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

    public function similarityScores(): HasMany
    {
        return $this->hasMany(SimilarityScore::class);
    }

    public function deadlineExtensionRequests(): HasMany
    {
        return $this->hasMany(DeadlineExtensionRequest::class);
    }

    public function progressReports(): HasMany
    {
        return $this->hasMany(ProgressReport::class);
    }
}
