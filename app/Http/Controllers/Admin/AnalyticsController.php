<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $filters = [
            'academic_year' => $request->input('academic_year'),
            'college_id' => $request->input('college_id'),
        ];

        return Inertia::render('Admin/Analytics', [
            'filters' => $filters,
            'academicYears' => $this->getAcademicYears(),
            'colleges' => $this->getColleges(),
            'summaryStats' => $this->summaryStats($filters),
            'researchTypes' => Inertia::defer(fn () => $this->researchTypeDistribution($filters)),
            'collegePerf' => Inertia::defer(fn () => $this->collegePerformance($filters)),
            'passRateTrends' => Inertia::defer(fn () => $this->passRateTrends()),
            'appTrends' => Inertia::defer(fn () => $this->applicationTrends()),
            'genderPassRate' => Inertia::defer(fn () => $this->passRateByGender($filters)),
            'yearDistribution' => Inertia::defer(fn () => $this->yearDistribution()),
            'collegeTypeDist' => Inertia::defer(fn () => $this->collegeTypeDistribution($filters)),
            'predictive' => Inertia::defer(fn () => $this->predictiveModel()),
        ]);
    }

    private function getAcademicYears(): array
    {
        return DB::table('proposals')
            ->whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->distinct()
            ->orderByDesc('academic_year')
            ->pluck('academic_year')
            ->toArray();
    }

    private function getColleges(): array
    {
        return DB::table('colleges')
            ->whereNull('deleted_at')
            ->where('status', 'active')
            ->orderBy('name')
            ->select('id', 'name', 'code')
            ->get()
            ->map(fn ($c) => (array) $c)
            ->toArray();
    }

    private function summaryStats(array $filters): array
    {
        $q = DB::table('proposals')->whereNull('deleted_at');

        if (! empty($filters['academic_year'])) {
            $q->where('academic_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $q->where('college_id', $filters['college_id']);
        }

        $total = (clone $q)->count();
        $funded = (clone $q)->whereIn('status', ['funded', 'accepted', 'completed'])->count();
        $rejected = (clone $q)->where('status', 'rejected')->count();
        $active = (clone $q)->whereNotIn('status', ['funded', 'rejected', 'archived', 'completed', 'draft'])->count();

        return [
            'total' => $total,
            'funded' => $funded,
            'rejected' => $rejected,
            'active' => $active,
            'pass_rate' => $total > 0 ? round($funded / $total * 100, 1) : 0,
        ];
    }

    private function researchTypeDistribution(array $filters): array
    {
        $q = DB::table('proposals')
            ->whereNull('deleted_at')
            ->whereNotNull('research_type');

        if (! empty($filters['academic_year'])) {
            $q->where('academic_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $q->where('college_id', $filters['college_id']);
        }

        return $q->select(
            'research_type',
            DB::raw('COUNT(*) as count'),
            DB::raw("SUM(CASE WHEN status IN ('funded','accepted','completed') THEN 1 ELSE 0 END) as funded"),
            DB::raw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected")
        )
            ->groupBy('research_type')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();
    }

    private function collegePerformance(array $filters): array
    {
        $year = $filters['academic_year'] ?? null;

        return DB::table('colleges as c')
            ->leftJoin('proposals as p', function ($join) use ($year) {
                $join->on('p.college_id', '=', 'c.id')
                    ->whereNull('p.deleted_at');
                if ($year) {
                    $join->where('p.academic_year', $year);
                }
            })
            ->whereNull('c.deleted_at')
            ->select(
                'c.name as college',
                'c.code',
                DB::raw('COUNT(DISTINCT p.id) as total'),
                DB::raw("COUNT(DISTINCT CASE WHEN p.status IN ('funded','accepted','completed') THEN p.id END) as funded"),
                DB::raw("COUNT(DISTINCT CASE WHEN p.status = 'rejected' THEN p.id END) as rejected"),
                DB::raw("ROUND(COUNT(DISTINCT CASE WHEN p.status IN ('funded','accepted','completed') THEN p.id END) * 100.0 / NULLIF(COUNT(DISTINCT p.id), 0), 1) as pass_rate")
            )
            ->groupBy('c.id', 'c.name', 'c.code')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();
    }

    private function passRateTrends(): array
    {
        return DB::table('proposals')
            ->whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->select(
                'academic_year',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN status IN ('funded','accepted','completed') THEN 1 ELSE 0 END) as funded"),
                DB::raw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected"),
                DB::raw("ROUND(SUM(CASE WHEN status IN ('funded','accepted','completed') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as pass_rate")
            )
            ->groupBy('academic_year')
            ->orderBy('academic_year')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();
    }

    private function applicationTrends(): array
    {
        return DB::table('proposals')
            ->whereNull('deleted_at')
            ->whereNotNull('submitted_at')
            ->where('submitted_at', '>=', now()->subMonths(24))
            ->select(
                DB::raw("DATE_FORMAT(submitted_at, '%Y-%m') as month"),
                DB::raw('COUNT(*) as submitted'),
                DB::raw("SUM(CASE WHEN status IN ('funded','accepted','completed') THEN 1 ELSE 0 END) as funded")
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();
    }

    private function passRateByGender(array $filters): array
    {
        $q = DB::table('proposals as p')
            ->join('users as u', 'u.id', '=', 'p.pi_user_id')
            ->whereNull('p.deleted_at')
            ->whereNotNull('u.gender');

        if (! empty($filters['academic_year'])) {
            $q->where('p.academic_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $q->where('p.college_id', $filters['college_id']);
        }

        return $q->select(
            'u.gender',
            DB::raw('COUNT(*) as total'),
            DB::raw("SUM(CASE WHEN p.status IN ('funded','accepted','completed') THEN 1 ELSE 0 END) as funded"),
            DB::raw("SUM(CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END) as rejected"),
            DB::raw("ROUND(SUM(CASE WHEN p.status IN ('funded','accepted','completed') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as pass_rate")
        )
            ->groupBy('u.gender')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();
    }

    private function yearDistribution(): array
    {
        return DB::table('proposals')
            ->whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->select(
                'academic_year',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN status IN ('funded','accepted','completed') THEN 1 ELSE 0 END) as funded"),
                DB::raw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected"),
                DB::raw("SUM(CASE WHEN status NOT IN ('funded','accepted','completed','rejected','archived','draft') THEN 1 ELSE 0 END) as in_progress")
            )
            ->groupBy('academic_year')
            ->orderBy('academic_year')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();
    }

    private function collegeTypeDistribution(array $filters): array
    {
        $q = DB::table('proposals as p')
            ->join('colleges as c', 'c.id', '=', 'p.college_id')
            ->whereNull('p.deleted_at')
            ->whereNull('c.deleted_at');

        if (! empty($filters['academic_year'])) {
            $q->where('p.academic_year', $filters['academic_year']);
        }

        return $q->select(
            'c.name as college',
            'c.code',
            DB::raw('COUNT(*) as count'),
            DB::raw("SUM(CASE WHEN p.status IN ('funded','accepted','completed') THEN 1 ELSE 0 END) as funded")
        )
            ->groupBy('c.id', 'c.name', 'c.code')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();
    }

    private function predictiveModel(): array
    {
        $yearlyData = DB::table('proposals')
            ->whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->select('academic_year', DB::raw('COUNT(*) as total'))
            ->groupBy('academic_year')
            ->orderBy('academic_year')
            ->get();

        if ($yearlyData->count() < 2) {
            return [
                'historical' => $yearlyData->map(fn ($r) => ['year' => $r->academic_year, 'actual' => (int) $r->total, 'trend' => (int) $r->total])->toArray(),
                'predictions' => [],
                'equation' => null,
                'r_squared' => null,
            ];
        }

        $firstYear = (int) substr($yearlyData->first()->academic_year, 0, 4);

        $points = $yearlyData->map(fn ($r) => [
            'x' => (int) substr($r->academic_year, 0, 4) - $firstYear,
            'y' => (int) $r->total,
            'year' => $r->academic_year,
        ])->values()->toArray();

        $n = count($points);
        $sumX = array_sum(array_column($points, 'x'));
        $sumY = array_sum(array_column($points, 'y'));
        $sumXY = array_sum(array_map(fn ($p) => $p['x'] * $p['y'], $points));
        $sumX2 = array_sum(array_map(fn ($p) => $p['x'] ** 2, $points));

        $denom = $n * $sumX2 - $sumX ** 2;
        $slope = $denom != 0 ? ($n * $sumXY - $sumX * $sumY) / $denom : 0;
        $intercept = ($sumY - $slope * $sumX) / $n;

        $meanY = $sumY / $n;
        $ssTot = array_sum(array_map(fn ($p) => ($p['y'] - $meanY) ** 2, $points));
        $ssRes = array_sum(array_map(fn ($p) => ($p['y'] - ($slope * $p['x'] + $intercept)) ** 2, $points));
        $rSquared = $ssTot > 0 ? round(1 - ($ssRes / $ssTot), 3) : 1;

        $historical = array_map(fn ($p) => [
            'year' => $p['year'],
            'actual' => $p['y'],
            'trend' => (int) round($slope * $p['x'] + $intercept),
        ], $points);

        $lastYear = (int) substr($yearlyData->last()->academic_year, 0, 4);
        $predictions = [];

        for ($i = 1; $i <= 3; $i++) {
            $yr = $lastYear + $i;
            $x = $yr - $firstYear;
            $pred = max(0, (int) round($slope * $x + $intercept));

            $predictions[] = [
                'year' => "{$yr}-".($yr + 1),
                'predicted' => $pred,
                'trend' => $pred,
            ];
        }

        return [
            'historical' => $historical,
            'predictions' => $predictions,
            'equation' => [
                'slope' => round($slope, 2),
                'intercept' => round($intercept, 2),
            ],
            'r_squared' => $rSquared,
        ];
    }
}
