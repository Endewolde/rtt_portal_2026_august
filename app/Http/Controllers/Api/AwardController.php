<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Award;
use App\Models\Proposal;
use App\Services\AwardService;
use App\Support\AuditLogger;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

            AuditLogger::log(
                'award.issued',
                Proposal::class,
                $proposal->id,
                $request->user()->id,
                null,
                ['grant_reference' => $award->grant_reference, 'awarded_amount' => $request->awarded_amount, 'tracker' => $proposal->tracker_number],
            );

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
            $old = $award->only(array_keys($updates));
            $award->update($updates);
            AuditLogger::log(
                'award.updated',
                Award::class,
                $award->id,
                $request->user()->id,
                $old,
                $updates,
            );
        }

        return response()->json([
            'data' => $award->fresh()->load('approvedBy:id,name'),
            'message' => 'Award updated successfully.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function exportAwarded(Request $request): StreamedResponse
    {
        $user = $request->user();

        $roleCategories = [
            'research_officer' => 'research',
            'community_officer' => 'community_engagement',
            'technology_officer' => 'technology_transfer',
        ];

        // Determine which categories this user may export
        $allowedCategories = null; // null = all
        foreach ($roleCategories as $role => $cat) {
            if ($user->hasRole($role)) {
                $allowedCategories = [$cat];
                break;
            }
        }

        // Admin/super_admin/central_officer can optionally filter by a specific category
        $requestedCategory = $request->query('category');
        if ($allowedCategories !== null && $requestedCategory && ! in_array($requestedCategory, $allowedCategories)) {
            abort(403, 'You are not allowed to export this category.');
        }

        $fundedStatuses = ['funded', 'midterm_evaluation', 'completed', 'archived'];

        $query = Proposal::with([
            'pi:id,name,email',
            'college:id,name',
            'department:id,name',
            'award',
            'activeMembers.user:id,name,email',
        ])
            ->whereIn('status', $fundedStatuses)
            ->orderBy('academic_year', 'desc')
            ->orderBy('created_at', 'desc');

        if ($allowedCategories !== null) {
            $query->whereIn('category', $allowedCategories);
        } elseif ($requestedCategory) {
            $query->where('category', $requestedCategory);
        }

        if ($year = $request->query('year')) {
            $query->where('academic_year', $year);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $proposals = $query->get();

        $categoryLabels = [
            'research' => 'Research',
            'community_engagement' => 'Community Engagement',
            'technology_transfer' => 'Technology Transfer',
            'innovation' => 'Innovation',
            'other' => 'Other',
        ];

        $categorySlug = $requestedCategory
            ? ($categoryLabels[$requestedCategory] ?? $requestedCategory)
            : ($allowedCategories ? ($categoryLabels[$allowedCategories[0]] ?? $allowedCategories[0]) : 'All');

        $filename = 'awarded_proposals_'.strtolower(str_replace(' ', '_', $categorySlug)).'_'.date('Y-m-d').'.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-cache',
        ];

        return response()->stream(function () use ($proposals, $categoryLabels) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Grant Reference', 'Title', 'Category', 'Principal Investigator', 'PI Email',
                'Co-Investigators', 'Co-Investigator Emails',
                'College', 'Department', 'Academic Year', 'Status',
                'Awarded Amount (ETB)', 'Award Date', 'Approval Notes',
            ]);

            foreach ($proposals as $p) {
                $award = $p->award;
                $coIs = $p->activeMembers->where('role', 'co_investigator');

                fputcsv($handle, [
                    $award?->grant_reference ?? '',
                    $p->title,
                    $categoryLabels[$p->category] ?? $p->category,
                    $p->pi?->name ?? '',
                    $p->pi?->email ?? '',
                    $coIs->pluck('user.name')->filter()->implode('; '),
                    $coIs->pluck('user.email')->filter()->implode('; '),
                    $p->college?->name ?? '',
                    $p->department?->name ?? '',
                    $p->academic_year ?? '',
                    ucfirst(str_replace('_', ' ', $p->status)),
                    $award ? number_format((float) $award->awarded_amount, 2) : '',
                    $award?->approved_at?->format('Y-m-d') ?? '',
                    $award?->approval_notes ?? '',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
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
