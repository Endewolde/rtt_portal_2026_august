<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Award;
use App\Models\Proposal;
use App\Services\AwardService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AwardController extends Controller
{
    public function __construct(private AwardService $service) {}

    public function store(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('awards.create')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'awarded_amount' => 'required|numeric|min:0',
            'approval_notes' => 'nullable|string',
        ]);

        $proposal = Proposal::findOrFail($id);

        // If award already exists, update it instead of failing
        $existing = Award::where('proposal_id', $id)->first();
        if ($existing) {
            $existing->update([
                'awarded_amount' => (float) $request->awarded_amount,
                'approval_notes' => $request->approval_notes ?? $existing->approval_notes,
            ]);

            return response()->json([
                'data' => $existing->fresh()->load('approvedBy:id,name'),
                'message' => 'Award updated.',
                'errors' => [],
                'meta' => [],
            ]);
        }

        try {
            $award = $this->service->generate($proposal, $request->user(), (float) $request->awarded_amount);

            if ($request->filled('approval_notes')) {
                $award->update(['approval_notes' => $request->approval_notes]);
            }

            return response()->json([
                'data' => $award->fresh()->load('approvedBy:id,name'),
                'message' => 'Award generated. Grant: '.$award->grant_reference,
                'errors' => [],
                'meta' => [],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
            ], 422);
        }
    }

    public function show(string $id): JsonResponse
    {
        $award = Award::where('proposal_id', $id)
            ->with('approvedBy:id,name')
            ->first();

        if (! $award) {
            return response()->json([
                'data' => null,
                'message' => '',
                'errors' => [],
                'meta' => [],
            ]);
        }

        return response()->json([
            'data' => $award,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function update(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('awards.update')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'awarded_amount' => 'nullable|numeric|min:0',
            'approval_notes' => 'nullable|string',
        ]);

        $award = Award::where('proposal_id', $id)->firstOrFail();

        $updates = [];
        if ($request->has('awarded_amount')) {
            $updates['awarded_amount'] = (float) $request->awarded_amount;
        }
        if ($request->has('approval_notes')) {
            $updates['approval_notes'] = $request->approval_notes;
        }

        if (! empty($updates)) {
            $award->update($updates);
        }

        return response()->json([
            'data' => $award->fresh()->load('approvedBy:id,name'),
            'message' => 'Award updated successfully.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function downloadLetter(string $id): Response
    {
        $proposal = Proposal::with([
            'pi:id,name,email',
            'college:id,name',
            'department:id,name',
            'proposalCall:id,title',
        ])->findOrFail($id);

        $award = Award::where('proposal_id', $id)
            ->with('approvedBy:id,name')
            ->firstOrFail();

        $universityName = \DB::table('app_settings')->where('key', 'site_name')->value('value')
            ?? config('app.name');
        $academicYear = $proposal->academic_year
            ?? \DB::table('app_settings')->where('key', 'current_academic_year')->value('value')
            ?? now()->year.'-'.(now()->year + 1);

        $department = $proposal->college?->name ?? '—';
        $callTitle = $proposal->proposalCall?->title ?? 'Research Grant Call';
        $letterDate = ($award->approved_at ?? now())->format('d F Y');
        $returnDeadline = ($award->approved_at ?? now())->addDays(14)->format('d F Y');
        $formattedAmount = 'ETB '.number_format((float) $award->awarded_amount, 2);

        $pdf = Pdf::loadView('pdf.award_letter', [
            'proposal' => $proposal,
            'award' => $award,
            'pi' => $proposal->pi,
            'department' => $department,
            'callTitle' => $callTitle,
            'universityName' => $universityName,
            'academicYear' => $academicYear,
            'letterDate' => $letterDate,
            'returnDeadline' => $returnDeadline,
            'formattedAmount' => $formattedAmount,
            'approvedBy' => $award->approvedBy,
        ])->setPaper('a4', 'portrait');

        $filename = 'Award-Letter-'.$award->grant_reference.'.pdf';

        return $pdf->download($filename);
    }
}
