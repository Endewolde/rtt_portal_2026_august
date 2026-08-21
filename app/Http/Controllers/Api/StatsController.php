<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    public function index(): JsonResponse
    {
        $currentYear = DB::table('app_settings')
            ->where('key', 'current_academic_year')
            ->value('value') ?? date('Y').'-'.(date('Y') + 1);

        $funded = DB::table('proposals')
            ->whereIn('status', ['funded', 'midterm_evaluation', 'completed', 'archived'])
            ->whereNull('deleted_at')
            ->count();

        $allNonDraft = DB::table('proposals')
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['draft'])
            ->count();

        $fundedRate = $allNonDraft > 0 ? round(($funded / $allNonDraft) * 100) : 0;

        $totalProposals = DB::table('proposals')
            ->whereNull('deleted_at')
            ->where('academic_year', $currentYear)
            ->whereNotNull('submitted_at')
            ->count();

        $validated = DB::table('proposals')
            ->whereNull('deleted_at')
            ->where('academic_year', $currentYear)
            ->whereNotNull('validated_at')
            ->count();

        $validatedRate = $totalProposals > 0 ? round(($validated / $totalProposals) * 100) : 0;

        $validatedByCategory = DB::table('proposals')
            ->whereNull('deleted_at')
            ->where('academic_year', $currentYear)
            ->whereNotNull('validated_at')
            ->select('category', DB::raw('count(*) as count'))
            ->groupBy('category')
            ->pluck('count', 'category');

        $categoryLabels = [
            'research' => 'Research',
            'community_engagement' => 'Community Engagement',
            'technology_transfer' => 'Technology Transfer',
        ];

        $validatedByCategoryData = collect(array_keys($categoryLabels))
            ->merge($validatedByCategory->keys())
            ->unique()
            ->map(fn (string $category) => [
                'category' => $category,
                'label' => $categoryLabels[$category] ?? ucwords(str_replace('_', ' ', $category)),
                'count' => (int) ($validatedByCategory[$category] ?? 0),
            ])
            ->values();

        return response()->json([
            'data' => [
                'total_proposals' => $totalProposals,
                'validated' => $validated,
                'validated_rate' => $validatedRate,
                'validated_by_category' => $validatedByCategoryData,
                'funded' => $funded,
                'funded_rate' => $fundedRate,
                'colleges' => DB::table('colleges')->where('status', 'active')->where('code', '!=', 'ORTT')->count(),
                'departments' => DB::table('departments')->count(),
                'active_calls' => DB::table('proposal_calls')->where('status', 'active')->count(),
                'academic_year' => $currentYear,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
