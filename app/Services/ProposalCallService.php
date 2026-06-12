<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

class ProposalCallService
{
    /**
     * Create a new proposal call.
     */
    public function create(array $data, User $createdBy): ProposalCall
    {
        $data['created_by'] = $createdBy->id;
        $data['slug'] = Str::slug($data['title']).'-'.time();
        $data['status'] = 'draft';
        $data['is_open'] = false;

        return ProposalCall::create($data);
    }

    /**
     * Update a proposal call.
     *
     * @throws \Exception if call is active and has submissions with category change
     */
    public function update(ProposalCall $call, array $data, User $_updatedBy): ProposalCall
    {
        if ($call->status === 'active') {
            $hasSubmissions = Proposal::where('proposal_call_id', $call->id)
                ->where('status', '!=', 'draft')
                ->exists();

            if ($hasSubmissions && isset($data['category']) && $data['category'] !== $call->category) {
                throw new \Exception('Cannot change category of an active call that has submissions.');
            }
        }

        $call->update($data);

        return $call->fresh();
    }

    /**
     * Activate a proposal call.
     *
     * @throws \Exception if end_date is in the past
     */
    public function activate(ProposalCall $call): ProposalCall
    {
        if ($call->end_date->isPast()) {
            throw new \Exception('Cannot activate a call whose end date is in the past.');
        }

        $call->update(['status' => 'active', 'is_open' => true]);

        return $call->fresh();
    }

    /**
     * Close a proposal call.
     */
    public function close(ProposalCall $call): ProposalCall
    {
        $call->update(['status' => 'closed', 'is_open' => false]);

        return $call->fresh();
    }

    /**
     * Reopen a closed proposal call.
     *
     * @throws \Exception if call is expired, already active, or deadline has passed
     */
    public function reopen(ProposalCall $call): ProposalCall
    {
        // Always refresh so we see the deadline just saved by the caller.
        $call = $call->fresh();

        // Block only when the call is genuinely active (status=active AND deadline in the future).
        // A call whose DB status is still 'active' but whose deadline has passed is effectively
        // expired (ProposalCallResource returns 'expired' for it), so it should be reopenable.
        if ($call->status === 'active' && ! $call->end_date->isPast()) {
            throw new \Exception('This call is already active.');
        }

        // Block reopen if the (freshly saved) deadline is still in the past.
        if ($call->end_date->isPast()) {
            throw new \Exception(
                'Cannot reopen: the deadline '.$call->end_date->format('d M Y H:i').
                ' has already passed. Please update the deadline to a future date first.'
            );
        }

        $call->update(['status' => 'active', 'is_open' => true]);

        return $call->fresh();
    }

    /**
     * List active proposal calls with optional filters.
     */
    public function listActive(array $filters = []): LengthAwarePaginator
    {
        $query = ProposalCall::where('status', 'active')
            ->where('is_open', true);

        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (! empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }

        return $query->orderBy('end_date', 'asc')
            ->paginate($filters['per_page'] ?? 15);
    }
}
