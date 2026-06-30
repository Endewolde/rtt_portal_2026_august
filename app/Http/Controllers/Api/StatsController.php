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

        return response()->json([
            'data' => [
                'total_proposals' => DB::table('proposals')
                    ->whereNull('deleted_at')
                    ->where('academic_year', $currentYear)
                    ->where('status', 'submitted')
                    ->count(),
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
