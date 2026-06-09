<?php

namespace App\Services;

use App\Exceptions\CannotWithdrawPIException;
use App\Exceptions\MemberAlreadyInactiveException;
use App\Models\FormSignature;
use App\Models\Proposal;
use App\Models\ProposalMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TeamConflictService
{
    /**
     * Withdraw a team member from a proposal.
     * NEVER deletes the proposal_members row.
     *
     * @throws CannotWithdrawPIException
     * @throws MemberAlreadyInactiveException
     */
    public function withdrawMember(
        Proposal $proposal,
        User $member,
        string $reason,
        User $initiatedBy
    ): ProposalMember {
        $memberRecord = ProposalMember::where('proposal_id', $proposal->id)
            ->where('user_id', $member->id)
            ->first();

        if (! $memberRecord) {
            throw new \Exception("User {$member->name} is not a member of this proposal.");
        }

        if ($memberRecord->role === 'pi') {
            throw new CannotWithdrawPIException(
                'The Principal Investigator cannot be withdrawn. Transfer PI role first.'
            );
        }

        if (in_array($memberRecord->status, ['inactive', 'withdrawn'])) {
            throw new MemberAlreadyInactiveException(
                "Member {$member->name} is already inactive."
            );
        }

        return DB::transaction(function () use ($proposal, $member, $memberRecord, $reason, $initiatedBy) {
            $memberRecord->update([
                'status'            => 'withdrawn',
                'withdrawal_reason' => $reason,
                'withdrawn_at'      => now(),
            ]);

            FormSignature::where('user_id', $member->id)
                ->whereHas('budgetRequest', fn ($q) => $q->where('proposal_id', $proposal->id))
                ->where('status', 'pending')
                ->update([
                    'status'         => 'refused',
                    'refused_at'     => now(),
                    'refusal_reason' => 'Member withdrawn from proposal',
                ]);

            $activeMembers = ProposalMember::where('proposal_id', $proposal->id)
                ->where('status', 'active')
                ->get();

            if ($activeMembers->isNotEmpty()) {
                $equalShare = round(100 / $activeMembers->count(), 2);
                foreach ($activeMembers as $activeMember) {
                    $activeMember->update(['contribution_percentage' => $equalShare]);
                }
            }

            DB::table('audit_logs')->insert([
                'id'             => Str::uuid()->toString(),
                'auditable_type' => ProposalMember::class,
                'auditable_id'   => $memberRecord->id,
                'event'          => 'member.withdrawn',
                'actor_id'       => $initiatedBy->id,
                'old_values'     => json_encode(['status' => 'active']),
                'new_values'     => json_encode(['status' => 'withdrawn', 'reason' => $reason]),
                'ip_address'     => request()->ip() ?? '127.0.0.1',
                'user_agent'     => request()->userAgent() ?? '',
                'created_at'     => now(),
            ]);

            return $memberRecord->fresh();
        });
    }
}
