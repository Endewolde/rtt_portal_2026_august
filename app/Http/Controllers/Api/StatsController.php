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

        return response()->json([
            'data' => [
                'total_proposals' => DB::table('proposals')
                    ->whereNull('deleted_at')
                    ->where('academic_year', $currentYear)
                    ->count(),
                'funded' => DB::table('proposals')
                    ->whereIn('status', ['funded', 'midterm_evaluation', 'completed', 'archived'])
                    ->whereNull('deleted_at')
                    ->where('academic_year', $currentYear)
                    ->count(),
                'colleges' => DB::table('colleges')->where('status', 'active')->count(),
                'publications' => DB::table('research_outputs')->where('output_type', 'journal_article')->count(),
                'active_calls' => DB::table('proposal_calls')->where('status', 'active')->count(),
                'academic_year' => $currentYear,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
