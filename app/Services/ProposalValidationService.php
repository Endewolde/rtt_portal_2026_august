<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class ProposalValidationService
{
    public function __construct(private readonly WorkflowService $workflowService) {}

    private function checkCategoryPermission(User $validator, Proposal $proposal): void
    {
        foreach (self::ROLE_CATEGORY_MAP as $role => $category) {
            if ($validator->hasRole($role)) {
                if ($proposal->category !== $category) {
                    throw new AuthorizationException(
                        "As {$role} you can only validate {$category} proposals."
                    );
                }

                return;
            }
        }
    }

    /**
     * Approve a proposal for review.
     *
     * @throws AuthorizationException
     */
    public function approve(Proposal $proposal, User $validator): Proposal
    {
        if (! $validator->can('proposals.validate')) {
            throw new AuthorizationException('You do not have permission to validate proposals.');
        }

        $this->checkCategoryPermission($validator, $proposal);

        $proposal = $this->workflowService->transition(
            $proposal,
            'validate',
            $validator,
            'Proposal approved for review by Central Office'
        );

        DB::table('proposals')
            ->where('id', $proposal->id)
            ->update(['validated_at' => now()]);

        return $proposal->fresh();
    }

    /**
     * Return a proposal to the PI for correction.
     *
     * @throws AuthorizationException
     */
    public function returnForCorrection(
        Proposal $proposal,
        User $validator,
        string $reason,
        array $requiredCorrections = []
    ): Proposal {
        if (! $validator->can('proposals.validate')) {
            throw new AuthorizationException('You do not have permission to validate proposals.');
        }

        $this->checkCategoryPermission($validator, $proposal);

        DB::table('proposals')
            ->where('id', $proposal->id)
            ->update(['rejection_reason' => $reason]);

        return $this->workflowService->transition(
            $proposal->fresh(),
            'return_for_correction',
            $validator,
            $reason,
            ['required_corrections' => $requiredCorrections]
        );
    }

    /**
     * Reject a proposal outright.
     *
     * @throws AuthorizationException
     */
    public function reject(Proposal $proposal, User $validator, string $reason): Proposal
    {
        if (! $validator->can('proposals.validate')) {
            throw new AuthorizationException('You do not have permission to validate proposals.');
        }

        $this->checkCategoryPermission($validator, $proposal);

        DB::table('proposals')
            ->where('id', $proposal->id)
            ->update([
                'rejected_at' => now(),
                'rejection_reason' => $reason,
            ]);

        return $this->workflowService->transition(
            $proposal->fresh(),
            'reject',
            $validator,
            $reason
        );
    }

    private const ROLE_CATEGORY_MAP = [
        'research_officer' => 'research',
        'community_officer' => 'community_engagement',
        'technology_officer' => 'technology_transfer',
    ];

    /**
     * Get proposals awaiting validation, scoped by the validator's role category and optionally by college.
     */
    public function getValidationQueue(User $validator, ?string $collegeScope = null): LengthAwarePaginator
    {
        $query = Proposal::where('status', 'submitted')
            ->with(['pi', 'college', 'proposalCall'])
            ->orderBy('submitted_at', 'asc');

        foreach (self::ROLE_CATEGORY_MAP as $role => $category) {
            if ($validator->hasRole($role)) {
                $query->where('category', $category);
                break;
            }
        }

        if ($collegeScope) {
            $query->where('college_id', $collegeScope);
        }

        return $query->paginate(25);
    }
}
