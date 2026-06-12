<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundAward;
use App\Models\ExternalFundMilestone;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function metrics(): JsonResponse
    {
        // Application counts by status
        $applicationCounts = ExternalFundApplication::query()
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        // Award totals
        $awardStats = ExternalFundAward::query()
            ->selectRaw('
                COUNT(*) as total_awards,
                SUM(amount_awarded) as total_secured,
                SUM(CASE WHEN status = "active" THEN amount_awarded ELSE 0 END) as active_amount,
                COUNT(CASE WHEN status = "active" THEN 1 END) as active_count,
                COUNT(CASE WHEN status = "completed" THEN 1 END) as completed_count
            ')
            ->first();

        // Total expenditures across all awards
        $totalSpent = DB::table('ef_expenditures')->sum('amount');

        // Success rate: awarded / (awarded + rejected)
        $awarded = $applicationCounts['awarded'] ?? 0;
        $rejected = $applicationCounts['rejected'] ?? 0;
        $decided = $awarded + $rejected;
        $successRate = $decided > 0 ? round(($awarded / $decided) * 100, 1) : 0;

        // Funding by agency (top 5)
        $byAgency = ExternalFundAward::query()
            ->join('ef_agencies', 'ef_awards.agency_id', '=', 'ef_agencies.id')
            ->selectRaw('ef_agencies.name, ef_agencies.acronym, SUM(ef_awards.amount_awarded) as total, COUNT(*) as count')
            ->groupBy('ef_agencies.id', 'ef_agencies.name', 'ef_agencies.acronym')
            ->orderByDesc('total')
            ->limit(5)
            ->get();

        // Funding by college (top 5)
        $byCollege = ExternalFundApplication::query()
            ->join('ef_awards', 'ef_applications.id', '=', 'ef_awards.application_id')
            ->join('colleges', 'ef_applications.college_id', '=', 'colleges.id')
            ->selectRaw('colleges.name, SUM(ef_awards.amount_awarded) as total, COUNT(*) as count')
            ->groupBy('colleges.id', 'colleges.name')
            ->orderByDesc('total')
            ->limit(5)
            ->get();

        // Upcoming milestones (next 30 days)
        $upcomingMilestones = ExternalFundMilestone::query()
            ->with('award:id,title,award_number')
            ->whereIn('status', ['pending', 'in_progress'])
            ->whereBetween('due_date', [now(), now()->addDays(30)])
            ->orderBy('due_date')
            ->limit(10)
            ->get();

        // Applications by category
        $byCategory = ExternalFundApplication::query()
            ->selectRaw('category, COUNT(*) as count')
            ->groupBy('category')
            ->pluck('count', 'category')
            ->toArray();

        return response()->json([
            'data' => [
                'applications' => [
                    'total' => array_sum($applicationCounts),
                    'by_status' => $applicationCounts,
                    'pending' => ($applicationCounts['draft'] ?? 0)
                        + ($applicationCounts['under_internal_review'] ?? 0)
                        + ($applicationCounts['approved_for_submission'] ?? 0)
                        + ($applicationCounts['submitted'] ?? 0)
                        + ($applicationCounts['under_review'] ?? 0),
                ],
                'awards' => [
                    'total_count' => (int) $awardStats->total_awards,
                    'total_secured' => (float) $awardStats->total_secured,
                    'active_count' => (int) $awardStats->active_count,
                    'active_amount' => (float) $awardStats->active_amount,
                    'completed_count' => (int) $awardStats->completed_count,
                    'total_spent' => (float) $totalSpent,
                    'utilization_pct' => $awardStats->total_secured > 0
                        ? round(($totalSpent / (float) $awardStats->total_secured) * 100, 1)
                        : 0,
                ],
                'success_rate' => $successRate,
                'by_agency' => $byAgency,
                'by_college' => $byCollege,
                'by_category' => $byCategory,
                'upcoming_milestones' => $upcomingMilestones,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
