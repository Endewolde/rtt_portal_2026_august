<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Proposal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProposalPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        // Guest visitors: return empty shell — client-side useAuth redirects to login.
        if (! $user) {
            return Inertia::render('Proposals/Index', [
                'proposals' => collect(),
                'stats' => null,
                'colleges' => collect(),
                'availableYears' => collect(),
                'filters' => ['academic_year' => '', 'status' => '', 'category' => '', 'college_id' => '', 'search' => ''],
                'currentAcademicYear' => '',
            ]);
        }

        $currentAcademicYear = DB::table('app_settings')
            ->where('key', 'current_academic_year')
            ->value('value') ?? date('Y').'-'.(date('Y') + 1);

        $academicYear = $request->filled('academic_year')
            ? $request->academic_year
            : $currentAcademicYear;

        // ── Proposals ────────────────────────────────────────────────────────────
        // SoftDeletes global scope already adds `proposals.deleted_at IS NULL` — no manual whereNull needed.
        $query = Proposal::with(['pi:id,name,email', 'college:id,name', 'proposalCall:id,title,academic_year']);

        if ($user->hasRole('college_officer')) {
            $query->where('proposals.college_id', $user->college_id);
        } elseif ($user->hasRole('staff')) {
            $query->where('proposals.pi_user_id', $user->id);
        }

        if ($request->filled('category')) {
            $query->where('proposals.category', $request->category);
        }

        if ($request->filled('status')) {
            $statuses = array_filter(array_map('trim', explode(',', $request->status)));
            count($statuses) === 1
                ? $query->where('proposals.status', $statuses[0])
                : $query->whereIn('proposals.status', $statuses);
        }

        if ($request->filled('college_id')) {
            $query->where('proposals.college_id', $request->college_id);
        }

        $query->where('proposals.academic_year', $academicYear);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(fn ($q) => $q
                ->where('proposals.title', 'LIKE', "%{$search}%")
                ->orWhere('proposals.tracker_number', 'LIKE', "%{$search}%")
            );
        }

        // ── Statistics (submitted only, same year scope) ─────────────────────────
        // Qualify all columns to avoid ambiguity when clones are joined.
        $statsBase = Proposal::query()
            ->whereNotIn('proposals.status', ['draft'])
            ->where('proposals.academic_year', $academicYear);

        if ($user->hasRole('college_officer')) {
            $statsBase->where('proposals.college_id', $user->college_id);
        }

        // Directors see their own programme(s) — built-in or custom programme-scoped roles.
        if ($user->accessScope()->isCategory() && $user->accessScope()->categories) {
            $statsBase->whereIn('proposals.category', $user->accessScope()->categories);
        }

        $byStatus = (clone $statsBase)
            ->selectRaw('proposals.status as status, COUNT(*) as count')
            ->groupBy('proposals.status')
            ->pluck('count', 'status');

        $byCategory = (clone $statsBase)
            ->selectRaw('proposals.category as category, COUNT(*) as total')
            ->groupBy('proposals.category')
            ->pluck('total', 'category');

        $byCollege = (clone $statsBase)
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->selectRaw('colleges.id, colleges.name as college_name, colleges.code,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN ("funded","midterm_evaluation","completed","archived") THEN 1 ELSE 0 END) as funded,
                         SUM(CASE WHEN proposals.status = "rejected" THEN 1 ELSE 0 END) as rejected,
                         SUM(CASE WHEN proposals.status NOT IN ("draft","rejected","archived") THEN 1 ELSE 0 END) as active')
            ->groupBy('colleges.id', 'colleges.name', 'colleges.code')
            ->orderByDesc('total')
            ->get();

        $byDepartment = (clone $statsBase)
            ->join('departments', 'proposals.department_id', '=', 'departments.id')
            ->join('colleges', 'departments.college_id', '=', 'colleges.id')
            ->selectRaw('departments.id, departments.name as department_name, departments.code,
                         colleges.name as college_name,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN ("funded","midterm_evaluation","completed","archived") THEN 1 ELSE 0 END) as funded')
            ->groupBy('departments.id', 'departments.name', 'departments.code', 'colleges.name')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $byGender = (clone $statsBase)
            ->join('users', 'proposals.pi_user_id', '=', 'users.id')
            ->selectRaw('COALESCE(users.gender, "not_specified") as gender,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN ("funded","midterm_evaluation","completed","archived") THEN 1 ELSE 0 END) as funded')
            ->groupBy('users.gender')
            ->get();

        $totals = [
            'submitted' => (clone $statsBase)->count(),
            'funded' => (clone $statsBase)->whereIn('proposals.status', ['funded', 'midterm_evaluation', 'completed', 'archived'])->count(),
            'rejected' => (clone $statsBase)->where('proposals.status', 'rejected')->count(),
            'under_review' => (clone $statsBase)->whereIn('proposals.status', ['under_blind_review', 'under_open_defence', 'accepted'])->count(),
            'draft' => Proposal::where('proposals.academic_year', $academicYear)
                ->where('proposals.status', 'draft')
                ->when($user->hasRole('college_officer'), fn ($q) => $q->where('proposals.college_id', $user->college_id))
                ->count(),
        ];

        $availableYears = Proposal::whereNotNull('proposals.academic_year')
            ->distinct()
            ->orderByDesc('proposals.academic_year')
            ->pluck('proposals.academic_year');

        return Inertia::render('Proposals/Index', [
            'proposals' => $query->orderByDesc('created_at')->paginate(20)->withQueryString(),
            'stats' => [
                'totals' => $totals,
                'by_college' => $byCollege,
                'by_department' => $byDepartment,
                'by_gender' => $byGender,
                'by_status' => $byStatus,
                'by_category' => $byCategory,
            ],
            'colleges' => College::orderBy('name')->get(['id', 'name']),
            'availableYears' => $availableYears,
            'filters' => [
                'academic_year' => $academicYear,
                'status' => $request->status ?? '',
                'category' => $request->category ?? '',
                'college_id' => $request->college_id ?? '',
                'search' => $request->search ?? '',
            ],
            'currentAcademicYear' => $currentAcademicYear,
        ]);
    }
}
