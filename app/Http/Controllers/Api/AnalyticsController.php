<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    private const CATEGORIES = ['research', 'community_engagement', 'technology_transfer'];

    /** Sent as academic_year to see every year; leaving it out means the current year. */
    private const ALL_YEARS = 'all';

    public function __construct(private AnalyticsService $analytics) {}

    /**
     * Full analytics payload in one request. College officers are always limited to their
     * own college and category directors to their own category, whatever the client sends.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('analytics.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $currentYear = DB::table('app_settings')->where('key', 'current_academic_year')->value('value');
        $requestedYear = $request->input('academic_year');
        $academicYear = $requestedYear === self::ALL_YEARS ? null : ($requestedYear ?: $currentYear);

        $category = $request->_category_scope ?: (in_array($request->input('category'), self::CATEGORIES, true) ? $request->input('category') : null);

        $filters = [
            'academic_year' => $academicYear,
            'college_id' => $user->accessScope()->isCollege() ? $user->accessScope()->collegeId : ($request->input('college_id') ?: null),
            'category' => $category,
        ];

        return response()->json([
            'data' => [
                'filters' => $filters + [
                    'current_academic_year' => $currentYear,
                    'college_locked' => $user->accessScope()->isCollege(),
                    'category_locked' => (bool) $request->_category_scope,
                ],
                'academicYears' => DB::table('proposals')->whereNull('deleted_at')->whereNotNull('academic_year')
                    ->distinct()->orderByDesc('academic_year')->pluck('academic_year'),
                'college_options' => DB::table('colleges')->whereNull('deleted_at')->where('status', 'active')
                    ->orderBy('name')->get(['id', 'name', 'code']),
                ...$this->analytics->dashboard($filters),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
