<?php

namespace App\Services;

use App\Models\BudgetRequest;
use App\Models\Disbursement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DisbursementService
{
    /**
     * Disburse funds for an approved budget request (supports partial disbursement).
     *
     * @param  array  $data  transaction_id, cheque_number, notes
     * @throws \Exception
     */
    public function disburse(
        BudgetRequest $request,
        float $amount,
        array $data,
        User $financeUser
    ): Disbursement {
        if ($request->status !== 'approved') {
            throw new \Exception(
                "Budget request must be approved before disbursement. Current: {$request->status}"
            );
        }

        $alreadyDisbursed = Disbursement::where('budget_request_id', $request->id)->sum('amount');
        $remaining = $request->total_amount - $alreadyDisbursed;

        if ($amount > $remaining) {
            throw new \Exception(
                "Disbursement amount {$amount} exceeds remaining undisbursed amount of {$remaining}."
            );
        }

        return DB::transaction(function () use ($request, $amount, $data, $financeUser, $alreadyDisbursed) {
            $disbursement = Disbursement::create([
                'budget_request_id' => $request->id,
                'disbursed_by'      => $financeUser->id,
                'amount'            => $amount,
                'transaction_id'    => $data['transaction_id'] ?? null,
                'cheque_number'     => $data['cheque_number'] ?? null,
                'notes'             => $data['notes'] ?? null,
                'disbursed_at'      => now(),
            ]);

            DB::table('budget_transactions')->insert([
                'id'                => Str::uuid()->toString(),
                'budget_request_id' => $request->id,
                'transaction_type'  => 'disbursement',
                'amount'            => $amount,
                'description'       => 'Disbursement by Finance',
                'reference_number'  => $data['transaction_id'] ?? null,
                'transacted_by'     => $financeUser->id,
                'transacted_at'     => now(),
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);

            $totalDisbursed = $alreadyDisbursed + $amount;
            if ($totalDisbursed >= $request->total_amount) {
                $request->update(['status' => 'disbursed']);
            }

            return $disbursement;
        });
    }
}
