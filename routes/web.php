<?php

use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Auth\OAuthController;
use App\Models\AppSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

// ── Public ────────────────────────────────────────────────────────────────────
Route::get('/', fn () => Inertia::render('Public/Home'));
Route::get('/download', fn () => Inertia::render('Public/Download'));
Route::get('/explore', fn () => Inertia::render('Public/Explore'));
Route::get('/funding-opportunities', fn () => Inertia::render('Public/FundingOpportunities'));
Route::get('/repository', fn () => Inertia::render('Public/Repository'));
Route::get('/tracker', fn () => Inertia::render('Public/Tracker'));
Route::get('/conferences', fn () => Inertia::render('Public/Conferences'));
Route::get('/conferences/{slug}', fn () => Inertia::render('Public/ConferenceDetail'));
Route::get('/conferences/{slug}/submit-abstract', fn () => Inertia::render('Public/AbstractSubmit'));
Route::get('/my-abstracts', fn () => Inertia::render('Public/MyAbstracts'));
// Authenticated users get the admin/PI view; AppLayout redirects guests to /login.
// Token-based auth (Sanctum) doesn't set a session, so server-side auth()->check()
// would always be false — the client handles auth entirely via useAuth.
Route::get('/proposal-calls', fn () => Inertia::render('Admin/ProposalCallsAdmin'));
Route::get('/proposal-calls/public', fn () => Inertia::render('Public/ProposalCalls'));

// ── Auth ──────────────────────────────────────────────────────────────────────
Route::get('/login', fn () => Inertia::render('Auth/Login'));
Route::get('/register', function () {
    abort_if(
        AppSetting::where('key', 'self_registration')->value('value') === 'false',
        403,
        'Self-registration is currently disabled. Please contact the system administrator for more information or visit the administration office for assistance.'
    );

    return Inertia::render('Auth/Register');
});
Route::get('/auth/oauth/{provider}', [OAuthController::class, 'redirect'])->name('oauth.redirect');
Route::get('/auth/oauth/{provider}/callback', [OAuthController::class, 'callback'])->name('oauth.callback');
Route::get('/forgot-password', fn () => Inertia::render('Auth/ForgotPassword'));
Route::get('/reset-password', fn () => Inertia::render('Auth/ResetPassword'));
Route::get('/verify-email', fn () => Inertia::render('Auth/VerifyEmail'));

// ── Protected (auth handled client-side via useAuth hook) ────────────────────
Route::get('/dashboard', fn () => Inertia::render('Dashboard/Index'));
Route::get('/researcher-hub', fn () => Inertia::render('ResearcherHub/Index'));
Route::get('/proposals', fn () => Inertia::render('Proposals/Index'));
Route::get('/proposals/create', fn () => Inertia::render('Proposals/Create'));
Route::get('/proposals/{id}', fn () => Inertia::render('Proposals/Show'));
Route::get('/proposals/{id}/assign-reviewers', fn () => Inertia::render('Admin/AssignReviewers'));
Route::get('/proposals/{id}/defence', fn () => Inertia::render('Admin/ScheduleDefence'));
Route::get('/proposals/{id}/award', fn () => Inertia::render('Admin/GenerateAward'));
Route::get('/admin/assign-reviewers', fn () => Inertia::render('Admin/AssignReviewersList'));
Route::get('/reviews', fn () => Inertia::render('Reviews/Index'));
Route::get('/reviews/{id}/score', fn () => Inertia::render('Reviews/Score'));
Route::get('/budget-requests', fn () => Inertia::render('Finance/BudgetRequests'));
Route::get('/budget-requests/{id}', fn () => Inertia::render('Finance/BudgetRequestDetail'));
Route::get('/admin/validation-queue', fn () => Inertia::render('Admin/ValidationQueue'));
Route::get('/admin/appeals', fn () => Inertia::render('Admin/Appeals'));
Route::get('/admin/grant-letters', fn () => Inertia::render('Admin/GrantLetters'));
Route::get('/my-proposals', fn () => Inertia::render('Proposals/MyProposals'));
Route::get('/admin/departments', fn () => Inertia::render('Admin/Departments'));
Route::get('/admin/roles', fn () => Inertia::render('Admin/Roles'));
Route::get('/admin/permissions', fn () => Inertia::render('Admin/Permissions'));
Route::get('/admin/evaluation-criteria', fn () => Inertia::render('Admin/EvaluationCriteria'));
Route::get('/admin/blind-review', fn () => Inertia::render('Admin/BlindReview'));
Route::get('/admin/open-defence', fn () => Inertia::render('Admin/OpenDefence'));
Route::get('/admin/central-evaluation', fn () => Inertia::render('Admin/CentralEvaluation'));
Route::get('/admin/funding', fn () => Inertia::render('Admin/ProposalFunding'));
Route::get('/admin/awarded', fn () => Inertia::render('Admin/AwardedProposals'));
Route::get('/admin/completed-archive', fn () => Inertia::render('Admin/CompletedArchive'));
Route::get('/admin/review-assignment/{id}', fn () => Inertia::render('Admin/ReviewAssignment'));
Route::get('/reports', fn () => Inertia::render('Reports/Index'));
Route::get('/admin/analytics', [AnalyticsController::class, 'index'])->name('admin.analytics');
Route::get('/admin/login-notices', fn () => Inertia::render('Admin/LoginNotices'));
Route::get('/admin/feedback', fn () => Inertia::render('Admin/Feedback'));
Route::get('/complaints', fn () => Inertia::render('Complaints/Index'));
Route::get('/admin/conferences', fn () => Inertia::render('Admin/Conferences'));
Route::get('/admin/abstracts', fn () => Inertia::render('Admin/Abstracts'));
Route::get('/admin/external-funds', fn () => Inertia::render('Admin/ExternalFunds'));
Route::get('/admin/users', fn () => Inertia::render('Admin/Users'));
Route::get('/admin/users/{id}', fn () => Inertia::render('Admin/UserShow'));
Route::get('/admin/colleges', fn () => Inertia::render('Admin/Colleges'));
Route::get('/admin/thematic-areas', fn () => Inertia::render('Admin/ThematicAreas'));
Route::get('/admin/dropdown-options', fn () => Inertia::render('Admin/DropdownOptions'));
Route::get('/admin/audit-logs', fn () => Inertia::render('Admin/AuditLogs'));
Route::get('/admin/system-monitor', fn () => Inertia::render('Admin/SystemMonitor'));
Route::get('/admin/settings', fn () => Inertia::render('Admin/Settings'));
Route::get('/admin/similarity-flags', fn () => Inertia::render('Admin/SimilarityFlags'));
Route::get('/admin/features', fn () => Inertia::render('Admin/FeatureManagement'));
Route::get('/admin/repository', fn () => Inertia::render('Admin/Repository'));
Route::get('/admin/public-site', fn () => Inertia::render('Admin/PublicSite'));
Route::get('/admin/reviewer-workload', fn () => Inertia::render('Admin/ReviewerWorkload'));
Route::get('/admin/resources', fn () => Inertia::render('Admin/Resources'));

Route::get('/budget-allocations', fn () => Inertia::render('Finance/BudgetAllocations'));
Route::get('/disbursements', fn () => Inertia::render('Finance/Disbursements'));
Route::get('/settlements', fn () => Inertia::render('Finance/Settlements'));
Route::get('/midterm-evaluations', fn () => Inertia::render('Monitoring/MidtermEvaluations'));
Route::get('/completion-workshops', fn () => Inertia::render('Monitoring/CompletionWorkshops'));
Route::get('/research-outputs', fn () => Inertia::render('Monitoring/ResearchOutputs'));
Route::get('/research-impact', fn () => Inertia::render('Monitoring/ResearchImpact'));
Route::get('/calendar', fn () => Inertia::render('Calendar/Index'));
Route::get('/reports/college-dashboard', fn () => Inertia::render('Reports/CollegeDashboard'));
Route::get('/reports/annual', fn () => Inertia::render('Reports/AnnualReport'));
Route::get('/admin/proposal-archive', fn () => Inertia::render('Admin/ProposalArchive'));
Route::get('/research/showcase', fn () => Inertia::render('Public/ResearchShowcase'));
Route::get('/finance/milestones', fn () => Inertia::render('Finance/BudgetMilestones'));
Route::get('/notifications', fn () => Inertia::render('Notifications/Index'));
Route::get('/profile', fn () => Inertia::render('Profile/Edit'));

// ── Private file download (signed + time-limited) ─────────────────────────────
Route::get('/files/download', function (Request $request) {
    $path = base64_decode($request->path);
    $expires = (int) $request->expires;
    $expected = hash_hmac('sha256', $path.'|'.$expires, config('app.key'));

    if (! hash_equals($expected, (string) $request->signature)) {
        abort(403, 'Invalid signature.');
    }

    if (now()->timestamp > $expires) {
        abort(403, 'Download link has expired.');
    }

    if (! Storage::disk('private')->exists($path)) {
        abort(404);
    }

    return Storage::disk('private')->download($path);
})->name('files.download');
