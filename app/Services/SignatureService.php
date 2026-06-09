<?php

namespace App\Services;

use App\Events\AllSignaturesComplete;
use App\Events\MemberRefusedSignature;
use App\Exceptions\AlreadySignedException;
use App\Exceptions\SignatureNotFoundException;
use App\Models\BudgetRequest;
use App\Models\FormSignature;
use App\Models\User;

class SignatureService
{
    /**
     * Sign a budget request.
     *
     * @throws SignatureNotFoundException
     * @throws AlreadySignedException
     */
    public function sign(BudgetRequest $request, User $user, string $ipAddress): FormSignature
    {
        $signature = FormSignature::where('budget_request_id', $request->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $signature) {
            throw new SignatureNotFoundException(
                "No signature record found for user {$user->name} on this budget request."
            );
        }

        if ($signature->status === 'signed') {
            throw new AlreadySignedException(
                "User {$user->name} has already signed this budget request."
            );
        }

        $signature->update([
            'status'     => 'signed',
            'signed_at'  => now(),
            'ip_address' => $ipAddress,
        ]);

        $allSigned = FormSignature::where('budget_request_id', $request->id)
            ->where('status', '!=', 'signed')
            ->doesntExist();

        if ($allSigned) {
            $request->update(['all_signatures_complete' => true]);
            event(new AllSignaturesComplete($request));
        }

        // Invalidate PI's dashboard cache so budget widget reflects new signature state
        app(DashboardService::class)->invalidate($request->proposal->pi_user_id);

        return $signature->fresh();
    }

    /**
     * Refuse to sign a budget request.
     *
     * @throws SignatureNotFoundException
     */
    public function refuse(
        BudgetRequest $request,
        User $user,
        string $reason,
        string $ipAddress
    ): FormSignature {
        $signature = FormSignature::where('budget_request_id', $request->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $signature) {
            throw new SignatureNotFoundException(
                "No signature record found for user {$user->name} on this budget request."
            );
        }

        $signature->update([
            'status'         => 'refused',
            'refused_at'     => now(),
            'refusal_reason' => $reason,
            'ip_address'     => $ipAddress,
        ]);

        event(new MemberRefusedSignature($request, $user, $reason));

        // Invalidate PI's dashboard cache
        app(DashboardService::class)->invalidate($request->proposal->pi_user_id);

        return $signature->fresh();
    }
}
