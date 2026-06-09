<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => [
                'total_proposals' => DB::table('proposals')->whereNull('deleted_at')->count(),
                'funded'          => DB::table('proposals')
                    ->whereIn('status', ['funded', 'midterm_evaluation', 'completed', 'archived'])
                    ->whereNull('deleted_at')
                    ->count(),
                'colleges'        => DB::table('colleges')->where('status', 'active')->count(),
                'publications'    => DB::table('research_outputs')->where('output_type', 'journal_article')->count(),
                'active_calls'    => DB::table('proposal_calls')->where('status', 'active')->count(),
            ],
            'message' => '',
            'errors'  => [],
            'meta'    => [],
        ]);
    }
}
