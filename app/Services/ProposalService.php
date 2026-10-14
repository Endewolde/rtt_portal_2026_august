<?php

namespace App\Services;

use App\Exceptions\IncompleteProposalException;
use App\Exceptions\InvalidWizardStepException;
use App\Exceptions\ProposalNotEditableException;
use App\Exceptions\WorkflowGuardException;
use App\Models\AppSetting;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Models\ProposalMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProposalService
{
    public function __construct(
        private readonly WorkflowService $workflowService,
        private readonly FeatureService $featureService,
        private readonly TrackerNumberService $trackerNumberService,
    ) {}

    /**
     * Create a new proposal draft.
     */
    public function createDraft(User $pi, string $proposalCallId): Proposal
    {
        if (! $pi->college_id) {
            if ($pi->hasAnyRole(['super_admin', 'central_officer'])) {
                $fallbackCollege = College::where('status', 'active')->first();
                $fallbackDept = $fallbackCollege
                    ? Department::where('college_id', $fallbackCollege->id)->first()
                    : null;

                if ($fallbackCollege) {
                    $pi->college_id = $fallbackCollege->id;
                    $pi->department_id = $fallbackDept?->id;
                } else {
                    throw new \Exception(
                        'No colleges found in the system. Please create a college first.'
                    );
                }
            } else {
                throw new \RuntimeException(
                    'Your profile is missing a college assignment. '.
                    'Please contact the administrator to assign your college before submitting a proposal.'
                );
            }
        }

        if (! $pi->department_id) {
            $fallbackDept = Department::where('college_id', $pi->college_id)->first();
            if ($fallbackDept) {
                $pi->department_id = $fallbackDept->id;
            } else {
                throw new \RuntimeException(
                    'Your college has no departments. '.
                    'Please contact the administrator to add a department before submitting a proposal.'
                );
            }
        }

        $call = ProposalCall::findOrFail($proposalCallId);

        return DB::transaction(function () use ($pi, $call) {
            $proposal = Proposal::create([
                'tracker_number' => 'DRAFT-'.Str::upper(Str::random(8)),
                'proposal_call_id' => $call->id,
                'category' => $call->category,
                'title' => '',
                'status' => 'draft',
                'pi_user_id' => $pi->id,
                'college_id' => $pi->college_id,
                'department_id' => $pi->department_id,
                'academic_year' => $call->academic_year,
                'current_wizard_step' => 1,
                'wizard_completed_steps' => [],
                'created_by' => $pi->id,
            ]);

            ProposalMember::create([
                'proposal_id' => $proposal->id,
                'user_id' => $pi->id,
                'role' => 'pi',
                'contribution_percentage' => 100,
                'status' => 'active',
                'joined_at' => now(),
            ]);

            return $proposal;
        });
    }

    /**
     * Save a single wizard step.
     * Persists step data even if incomplete — never loses user input.
     *
     * @throws ProposalNotEditableException if proposal is not in draft status
     * @throws InvalidWizardStepException if step is more than 1 ahead of current
     */
    public function saveStep(Proposal $proposal, int $step, array $data, User $actor): Proposal
    {
        if ($proposal->status !== 'draft') {
            throw new ProposalNotEditableException(
                "Proposal {$proposal->tracker_number} is not editable. Current status: {$proposal->status}"
            );
        }

        // Allow re-saving any already-completed step (edit), or advancing to the next step.
        $completedSteps = $proposal->wizard_completed_steps ?? [];
        $maxAllowed = ($proposal->current_wizard_step ?? 1) + 1;

        if ($step > $maxAllowed && ! in_array($step, $completedSteps)) {
            throw new InvalidWizardStepException(
                "Cannot jump to step {$step}. Current step is {$proposal->current_wizard_step}."
            );
        }

        return DB::transaction(function () use ($proposal, $step, $data, $actor, $completedSteps) {
            $draftData = $proposal->draft_data ?? [];
            $draftData["step_{$step}"] = $data;

            if (! in_array($step, $completedSteps)) {
                $completedSteps[] = $step;
                sort($completedSteps);
            }

            $updates = [
                'draft_data' => $draftData,
                'wizard_completed_steps' => $completedSteps,
                'current_wizard_step' => max($proposal->current_wizard_step ?? 1, $step),
            ];

            switch ($step) {
                case 1:
                    $updates['title'] = $data['title'] ?? $proposal->title;
                    $updates['abstract'] = $data['abstract'] ?? null;
                    $updates['keywords'] = $data['keywords'] ?? null;
                    $updates['focus_area'] = $data['focus_area'] ?? null;
                    $updates['duration_months'] = isset($data['duration_months']) && $data['duration_months'] !== ''
                        ? (int) $data['duration_months']
                        : null;
                    // Only persist research_type for research proposals
                    if ($proposal->category === 'research') {
                        $updates['research_type'] = $data['research_type'] ?? null;
                    }
                    if (array_key_exists('ethical_clearance_required', $data)) {
                        $required = (bool) $data['ethical_clearance_required'];
                        $updates['ethical_clearance_required'] = $required;
                        $updates['ethical_clearance_number'] = $required
                            ? ($data['ethical_clearance_number'] ?? null)
                            : null;
                        // Track this proposal for compliance once flagged as requiring
                        // clearance — status stays until the PI formally submits a
                        // certificate for verification (see EthicalClearanceController).
                        if ($required && ! $proposal->ethical_clearance_status) {
                            $updates['ethical_clearance_status'] = 'pending';
                        } elseif (! $required) {
                            $updates['ethical_clearance_status'] = null;
                        }
                    }
                    break;

                case 3:
                    if (! empty($data['co_investigators'])) {
                        $this->saveCoInvestigators($proposal, $data['co_investigators'], $actor);
                    }
                    break;

                case 4:
                    if (! empty($data['items'])) {
                        $this->saveBudgetItems($proposal, $data['items']);
                    }
                    break;

                case 5:
                    // File uploads handled by uploadDocument() — just marks step complete here
                    break;
            }

            $proposal->update($updates);

            return $proposal->fresh();
        });
    }

    /**
     * Submit a completed proposal.
     * Validates all required steps are complete, generates tracker number,
     * calls WorkflowService::transition('submit').
     *
     * @throws IncompleteProposalException if required steps are missing
     */
    public function submit(Proposal $proposal, User $pi): Proposal
    {
        $call = $proposal->proposalCall;
        $deadlinePassed = $call && ($call->status === 'expired' || ($call->end_date && $call->end_date->isPast()));
        $hasApprovedExtension = $proposal->extended_deadline && $proposal->extended_deadline->isFuture();

        if ($deadlinePassed && ! $hasApprovedExtension) {
            throw new WorkflowGuardException('The submission deadline for this proposal call has passed. Your draft has been saved but can no longer be submitted.');
        }

        // A PI behind on existing funded work can draft but not submit something new.
        // Resubmitting a proposal returned for corrections is never held back.
        if (str_starts_with((string) $proposal->tracker_number, 'DRAFT-')) {
            $eligibility = app(SubmissionEligibilityService::class)->check($pi, $proposal);
            if (! $eligibility['eligible']) {
                throw new WorkflowGuardException(collect($eligibility['reasons'])->pluck('message')->implode(' '));
            }
        }

        // Enforce max proposals per PI at submit time too
        if ($call && $call->max_proposals_per_pi) {
            $alreadySubmitted = Proposal::where('proposal_call_id', $call->id)
                ->where('pi_user_id', $pi->id)
                ->whereNotIn('status', ['draft'])
                ->whereNull('deleted_at')
                ->where('id', '!=', $proposal->id)
                ->count();

            if ($alreadySubmitted >= $call->max_proposals_per_pi) {
                $limit = $call->max_proposals_per_pi;
                $noun = $limit === 1 ? 'proposal' : 'proposals';
                throw new WorkflowGuardException(
                    "This call limits each PI to {$limit} {$noun}. You already have a submitted proposal for this call."
                );
            }
        }

        // Co-PI acceptance gate (requires workflow.co_pi_acceptance feature)
        if ($this->featureService->hasFeature('workflow')) {
            $pendingCoPIs = ProposalMember::where('proposal_id', $proposal->id)
                ->where('role', 'co_investigator')
                ->where('status', 'active')
                ->where('invitation_status', 'pending')
                ->count();

            if ($pendingCoPIs > 0) {
                throw new WorkflowGuardException(
                    "You have {$pendingCoPIs} co-investigator(s) who have not yet accepted their invitation. Please wait for their confirmation before submitting."
                );
            }

            $declinedCoPIs = ProposalMember::where('proposal_id', $proposal->id)
                ->where('role', 'co_investigator')
                ->where('status', 'active')
                ->where('invitation_status', 'declined')
                ->count();

            if ($declinedCoPIs > 0) {
                throw new WorkflowGuardException(
                    "{$declinedCoPIs} co-investigator(s) declined their invitation. Please remove or replace them before submitting."
                );
            }
        }

        if (empty(trim($proposal->title ?? ''))) {
            throw new IncompleteProposalException('Proposal title is required.');
        }

        $draftData = $proposal->draft_data ?? [];
        $abstract = trim($draftData['step_1']['abstract'] ?? $proposal->abstract ?? '');
        if (empty($abstract)) {
            throw new IncompleteProposalException('Proposal abstract is required.');
        }

        $budgetCount = ProposalBudget::where('proposal_id', $proposal->id)->count();
        if ($budgetCount === 0) {
            throw new IncompleteProposalException(
                'Please add at least one budget item before submitting.'
            );
        }

        $docCount = ProposalDocument::where('proposal_id', $proposal->id)->count();
        if ($docCount === 0) {
            throw new IncompleteProposalException(
                'Please upload the required documents before submitting.'
            );
        }

        $coInvestigatorCount = ProposalMember::where('proposal_id', $proposal->id)
            ->where('role', 'co_investigator')
            ->where('status', 'active')
            ->count();

        if ($coInvestigatorCount < 1) {
            throw new IncompleteProposalException(
                'At least one Co-Investigator is required. Please go back to Step 3 and add a team member.'
            );
        }

        $submitted = DB::transaction(function () use ($proposal, $pi) {
            // A proposal returned for corrections keeps the tracker number it was first given.
            $trackerNumber = str_starts_with((string) $proposal->tracker_number, 'DRAFT-')
                ? $this->trackerNumberService->generate($proposal->category, $proposal->academic_year)
                : $proposal->tracker_number;

            $proposal->update([
                'tracker_number' => $trackerNumber,
                'submitted_at' => now(),
            ]);

            $submitted = $this->workflowService->transition(
                $proposal->fresh(),
                'submit',
                $pi,
                'Proposal submitted by PI'
            );

            app(ProposalVersionService::class)->capture($submitted, $pi);

            return $submitted;
        });

        try {
            app(SimilarityService::class)->check($submitted);
        } catch (\Throwable $e) {
            Log::warning("Could not run similarity check for proposal {$submitted->id}: {$e->getMessage()}");
        }

        return $submitted;
    }

    private function saveCoInvestigators(Proposal $proposal, array $coInvestigators, User $pi): void
    {
        $incomingUserIds = array_column($coInvestigators, 'user_id');

        // Snapshot existing responded statuses before deactivating
        $existingStatuses = ProposalMember::where('proposal_id', $proposal->id)
            ->where('role', 'co_investigator')
            ->where('status', 'active')
            ->get()
            ->keyBy('user_id')
            ->map(fn ($m) => $m->invitation_status);

        ProposalMember::where('proposal_id', $proposal->id)
            ->where('role', '!=', 'pi')
            ->where('status', 'active')
            ->update([
                'status' => 'inactive',
                'withdrawn_at' => now(),
                'withdrawal_reason' => 'Replaced in wizard step 3',
            ]);

        $count = count($coInvestigators);
        $totalContrib = 0;
        $workflowOn = $this->featureService->hasFeature('workflow');

        // Global, cross-call cap on how many active proposals a person can be a
        // co-investigator on at once (Settings → Review Thresholds). 0/unset = unlimited.
        $globalCoiCap = (int) (AppSetting::where('key', 'max_active_coinvestigator_proposals')->value('value') ?? 0);

        foreach ($coInvestigators as $coI) {
            $coUser = User::findOrFail($coI['user_id']);

            if ($coUser->status !== 'active') {
                throw new \InvalidArgumentException(
                    "{$coUser->name}'s account is inactive and cannot be added as a co-investigator."
                );
            }

            if ($globalCoiCap > 0) {
                // Excludes this proposal itself — its co-investigator rows were just
                // deactivated above and are about to be recreated, so re-adding the
                // same person to a proposal they're already on must not double-count.
                $otherActiveCount = ProposalMember::where('user_id', $coUser->id)
                    ->where('role', 'co_investigator')
                    ->where('status', 'active')
                    ->where('proposal_id', '!=', $proposal->id)
                    ->whereHas('proposal', fn ($q) => $q->whereNull('deleted_at')->whereNotIn('status', ['archived', 'rejected']))
                    ->count();

                if ($otherActiveCount >= $globalCoiCap) {
                    $noun = $globalCoiCap === 1 ? 'proposal' : 'proposals';
                    throw new \InvalidArgumentException(
                        "{$coUser->name} is already a co-investigator on {$globalCoiCap} active {$noun}, the maximum allowed at once."
                    );
                }
            }

            $contrib = $coI['contribution_percentage'] ?? ($count > 0 ? round(80 / $count, 2) : 0);

            // Preserve the invitation status if the co-PI already responded; only
            // set 'pending' for new additions (or when the workflow feature is off).
            $priorStatus = $existingStatuses[$coUser->id] ?? null;
            if (! $workflowOn) {
                $invitationStatus = 'accepted';
            } elseif ($priorStatus === 'accepted' || $priorStatus === 'declined') {
                $invitationStatus = $priorStatus;
            } else {
                $invitationStatus = 'pending';
            }

            ProposalMember::create([
                'proposal_id' => $proposal->id,
                'user_id' => $coUser->id,
                'role' => 'co_investigator',
                'contribution_percentage' => $contrib,
                'status' => 'active',
                'invitation_status' => $invitationStatus,
                'joined_at' => now(),
            ]);

            $totalContrib += $contrib;
        }

        ProposalMember::where('proposal_id', $proposal->id)
            ->where('user_id', $pi->id)
            ->update(['contribution_percentage' => max(0, 100 - $totalContrib)]);
    }

    private function saveBudgetItems(Proposal $proposal, array $items): void
    {
        ProposalBudget::where('proposal_id', $proposal->id)->delete();

        foreach ($items as $item) {
            ProposalBudget::create([
                'proposal_id' => $proposal->id,
                'category' => $item['category'],
                'item_description' => $item['description'],
                'amount' => $item['amount'],
                'justification' => $item['item_justification'] ?? null,
            ]);
        }
    }
}
