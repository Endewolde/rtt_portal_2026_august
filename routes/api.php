<?php

use App\Http\Controllers\Api\AbstractAdminController;
use App\Http\Controllers\Api\AbstractController;
use App\Http\Controllers\Api\ActionCountController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AnnualReportController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AwardController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\BudgetMilestoneController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CentralEvaluationController;
use App\Http\Controllers\Api\CollegeController;
use App\Http\Controllers\Api\ComplaintController;
use App\Http\Controllers\Api\CompletionWorkshopController;
use App\Http\Controllers\Api\ConferenceController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DisbursementController;
use App\Http\Controllers\Api\ExternalFund\AgencyController as EFAgencyController;
use App\Http\Controllers\Api\ExternalFund\ApplicationController as EFApplicationController;
use App\Http\Controllers\Api\ExternalFund\AwardController as EFAwardController;
use App\Http\Controllers\Api\ExternalFund\BudgetController as EFBudgetController;
use App\Http\Controllers\Api\ExternalFund\DashboardController as EFDashboardController;
use App\Http\Controllers\Api\ExternalFund\DocumentController as EFDocumentController;
use App\Http\Controllers\Api\ExternalFund\ExpenditureController as EFExpenditureController;
use App\Http\Controllers\Api\ExternalFund\MilestoneController as EFMilestoneController;
use App\Http\Controllers\Api\ExternalFund\OpportunityController as EFOpportunityController;
use App\Http\Controllers\Api\ExternalFund\ReviewController as EFReviewController;
use App\Http\Controllers\Api\ExternalFund\TeamMemberController as EFTeamMemberController;
use App\Http\Controllers\Api\FaqController;
use App\Http\Controllers\Api\FeatureController;
use App\Http\Controllers\Api\FeedbackController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\LoginNoticeController;
use App\Http\Controllers\Api\LookupOptionController;
use App\Http\Controllers\Api\MidtermEvaluationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OngoingProposalsController;
use App\Http\Controllers\Api\ProposalAiScoreController;
use App\Http\Controllers\Api\ProposalAppealController;
use App\Http\Controllers\Api\ProposalArchiveController;
use App\Http\Controllers\Api\ProposalCallController;
use App\Http\Controllers\Api\ProposalController;
use App\Http\Controllers\Api\ProposalPipelineController;
use App\Http\Controllers\Api\ProposalValidationController;
use App\Http\Controllers\Api\ProposalWizardController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RepositoryController;
use App\Http\Controllers\Api\ResearcherHubController;
use App\Http\Controllers\Api\ResearchImpactController;
use App\Http\Controllers\Api\ResearchOutputController;
use App\Http\Controllers\Api\ResourceController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ReviewDeadlineController;
use App\Http\Controllers\Api\ReviewerMatchController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SettlementController;
use App\Http\Controllers\Api\SimilarityController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\SystemMonitorController;
use App\Http\Controllers\Api\ThematicAreaController;
use App\Http\Controllers\Api\UserController;
use App\Http\Middleware\AuditCrudMiddleware;
use App\Models\FormTemplate;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // Health check — no auth, no rate limit
    Route::get('/health', [HealthController::class, 'check']);

    // Login notices — public (shown before sign-in, no auth needed)
    Route::get('/login-notices/active', [LoginNoticeController::class, 'active']);

    // ── Public auth — rate limited ────────────────────────────────────────────
    // 30 attempts per minute per IP
    Route::middleware('throttle:30,1')->post('/auth/login', [AuthController::class, 'login']);

    // 2FA verification — 10 attempts per minute per IP
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/auth/2fa/verify', [AuthController::class, 'verify2FA']);
        Route::post('/auth/2fa/resend', [AuthController::class, 'resend2FA']);
    });

    // 30 attempts per hour per IP
    Route::middleware('throttle:30,60')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->name('password.email');
        Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
        Route::post('/auth/resend-verification', [AuthController::class, 'resendVerification']);
    });

    // Email verification (GET — clicked from the email link)
    Route::get('/auth/verify-email', [AuthController::class, 'verifyEmail']);

    // Telegram webhook — 30 per minute per IP
    Route::middleware('throttle:30,1')->post('/auth/telegram/webhook', [AuthController::class, 'telegramWebhook']);

    // ── Public read-only ──────────────────────────────────────────────────────
    // /all must be registered before /{slug} so the static segment wins over the wildcard
    Route::middleware('auth:sanctum')->get('/proposal-calls/all', [ProposalCallController::class, 'allForAdmin']);
    Route::get('/proposal-calls', [ProposalCallController::class, 'index']);
    Route::get('/proposal-calls/{slug}', [ProposalCallController::class, 'show']);

    // Conferences — public
    Route::get('/conferences', [ConferenceController::class, 'publicIndex']);
    Route::get('/conferences/{slug}', [ConferenceController::class, 'publicShow']);
    Route::post('/conferences/{slug}/register', [ConferenceController::class, 'register']);
    // Abstracts — public
    Route::post('/conferences/{slug}/abstracts', [AbstractController::class, 'store']);
    Route::get('/abstracts/mine', [AbstractController::class, 'mine']);
    Route::get('/abstracts/track/{token}', [AbstractController::class, 'track']);
    Route::post('/abstracts/withdraw/{token}', [AbstractController::class, 'withdraw']);
    Route::get('/repository', [RepositoryController::class, 'index']);
    Route::get('/repository/{id}', [RepositoryController::class, 'show']);
    Route::get('/tracker/{number}', [RepositoryController::class, 'tracker']);
    Route::get('/stats', [StatsController::class, 'index']);
    Route::get('/resources', [ResourceController::class, 'publicIndex']);
    Route::get('/proposals/public', [ProposalController::class, 'publicIndex']);
    Route::get('/proposals/public/archive/years', [ProposalController::class, 'publicArchiveYears']);
    Route::get('/colleges/public', [CollegeController::class, 'publicList']);
    Route::get('/colleges/{id}/departments/public', [CollegeController::class, 'publicDepartments']);
    Route::get('/thematic-areas/public', [ThematicAreaController::class, 'publicIndex']);
    Route::get('/faqs/public', [FaqController::class, 'public']);

    // Lookup options — active values for forms (no auth needed for proposal create)
    Route::get('/lookup-options/active', [LookupOptionController::class, 'active']);
    Route::get('/external-funds/opportunities/public', [EFOpportunityController::class, 'publicIndex']);

    // ── Authenticated — 300 requests per minute per user ─────────────────────
    Route::middleware(['auth:sanctum', 'user.active', 'throttle:300,1', 'college.scope', 'category.scope', AuditCrudMiddleware::class])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::post('/auth/avatar', [AuthController::class, 'uploadAvatar']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
        Route::post('/auth/telegram/generate-token', [AuthController::class, 'generateTelegramToken']);
        Route::put('/auth/2fa/toggle', [AuthController::class, 'toggle2FA']);

        // Users
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/stats', [UserController::class, 'stats']);
        Route::post('/users/bulk', [UserController::class, 'bulkAction']);
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users/export', [UserController::class, 'export']);
        Route::get('/users/import-template', [UserController::class, 'importTemplate']);
        Route::post('/users/import', [UserController::class, 'import']);
        Route::get('/users/{id}', [UserController::class, 'show']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
        Route::put('/users/{id}/role', [UserController::class, 'updateRole']);
        Route::put('/users/{id}/roles', [UserController::class, 'updateUserRoles']);
        Route::get('/users/{id}/roles', [UserController::class, 'userRoles']);
        Route::put('/users/{id}/status', [UserController::class, 'updateStatus']);
        Route::post('/users/{id}/impersonate', [UserController::class, 'impersonate']);
        Route::get('/users/{id}/academic-info', [UserController::class, 'academicInfo']);
        Route::get('/users/{id}/proposal-history', [UserController::class, 'proposalHistory']);
        Route::get('/users/{id}/profile-360', [UserController::class, 'profile360']);
        Route::get('/users/{id}/activity-timeline', [UserController::class, 'activityTimeline']);
        Route::get('/users/{id}/activity-heatmap', [UserController::class, 'activityHeatmap']);

        // Roles and permissions
        Route::get('/roles', [RoleController::class, 'index']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::put('/roles/{id}', [RoleController::class, 'update']);
        Route::delete('/roles/{id}', [RoleController::class, 'destroy']);
        Route::get('/roles/{id}/permissions', [RoleController::class, 'permissions']);
        Route::put('/roles/{id}/permissions', [RoleController::class, 'updatePermissions']);
        Route::get('/permissions', [RoleController::class, 'allPermissions']);
        Route::post('/permissions/refresh', [RoleController::class, 'refreshPermissions']);

        // Thematic Areas
        Route::get('/thematic-areas', [ThematicAreaController::class, 'index']);
        Route::post('/thematic-areas', [ThematicAreaController::class, 'store']);
        Route::put('/thematic-areas/{id}', [ThematicAreaController::class, 'update']);
        Route::delete('/thematic-areas/{id}', [ThematicAreaController::class, 'destroy']);

        // Lookup options admin CRUD
        Route::get('/lookup-options', [LookupOptionController::class, 'index']);
        Route::post('/lookup-options', [LookupOptionController::class, 'store']);
        Route::put('/lookup-options/{option}', [LookupOptionController::class, 'update']);
        Route::delete('/lookup-options/{option}', [LookupOptionController::class, 'destroy']);
        Route::post('/lookup-options/reorder', [LookupOptionController::class, 'reorder']);

        // Colleges
        Route::get('/colleges', [CollegeController::class, 'index']);
        Route::post('/colleges', [CollegeController::class, 'store']);
        Route::put('/colleges/{id}', [CollegeController::class, 'update']);
        Route::delete('/colleges/{id}', [CollegeController::class, 'destroy']);
        Route::get('/colleges/{id}/departments', [CollegeController::class, 'departments']);
        Route::get('/departments', [CollegeController::class, 'allDepartments']);
        Route::post('/departments', [CollegeController::class, 'storeDepartment']);
        Route::put('/departments/{id}', [CollegeController::class, 'updateDepartment']);
        Route::delete('/departments/{id}', [CollegeController::class, 'destroyDepartment']);

        // Conferences — admin CRUD
        Route::get('/admin/conferences', [ConferenceController::class, 'index']);
        Route::post('/admin/conferences', [ConferenceController::class, 'store']);
        Route::get('/admin/conferences/{id}', [ConferenceController::class, 'show']);
        Route::put('/admin/conferences/{id}', [ConferenceController::class, 'update']);
        Route::delete('/admin/conferences/{id}', [ConferenceController::class, 'destroy']);
        Route::post('/admin/conferences/{id}/banner', [ConferenceController::class, 'uploadBanner']);
        // Speakers
        Route::post('/admin/conferences/{id}/speakers', [ConferenceController::class, 'storeSpeaker']);
        Route::put('/admin/conferences/{id}/speakers/{speakerId}', [ConferenceController::class, 'updateSpeaker']);
        Route::delete('/admin/conferences/{id}/speakers/{speakerId}', [ConferenceController::class, 'destroySpeaker']);
        Route::post('/admin/conferences/{id}/speakers/{speakerId}/photo', [ConferenceController::class, 'uploadSpeakerPhoto']);
        // Sessions
        Route::post('/admin/conferences/{id}/sessions', [ConferenceController::class, 'storeSession']);
        Route::put('/admin/conferences/{id}/sessions/{sessionId}', [ConferenceController::class, 'updateSession']);
        Route::delete('/admin/conferences/{id}/sessions/{sessionId}', [ConferenceController::class, 'destroySession']);
        // Registrations
        Route::get('/admin/conferences/{id}/registrations', [ConferenceController::class, 'registrations']);
        Route::get('/admin/conferences/{id}/registrations/export', [ConferenceController::class, 'exportRegistrations']);
        // Abstracts — admin
        Route::get('/admin/abstracts', [AbstractAdminController::class, 'index']);
        Route::get('/admin/abstracts/{id}', [AbstractAdminController::class, 'show']);
        Route::patch('/admin/abstracts/{id}/status', [AbstractAdminController::class, 'updateStatus']);
        Route::post('/admin/abstracts/{id}/assign-reviewer', [AbstractAdminController::class, 'assignReviewer']);
        Route::get('/admin/abstracts/export', [AbstractAdminController::class, 'export']);
        // Abstracts — reviewer
        Route::post('/admin/abstracts/{id}/next-steps', [AbstractAdminController::class, 'sendNextSteps']);
        Route::get('/reviewer/abstracts', [AbstractAdminController::class, 'reviewerIndex']);
        Route::post('/reviewer/abstracts/{id}/review', [AbstractAdminController::class, 'submitReview']);

        // Audit logs
        Route::get('/audit-logs', [AuditLogController::class, 'index']);

        // System monitoring
        Route::prefix('system-monitor')->group(function () {
            Route::get('/current', [SystemMonitorController::class, 'current']);
            Route::get('/history', [SystemMonitorController::class, 'history']);
            Route::get('/requests', [SystemMonitorController::class, 'requestStats']);
            Route::get('/alerts', [SystemMonitorController::class, 'alerts']);
            Route::post('/alerts/{id}/resolve', [SystemMonitorController::class, 'resolveAlert']);
            Route::get('/preferences', [SystemMonitorController::class, 'getPreferences']);
            Route::put('/preferences', [SystemMonitorController::class, 'savePreferences']);
            Route::post('/test-alert', [SystemMonitorController::class, 'testAlert']);
            Route::get('/failed-jobs', [SystemMonitorController::class, 'failedJobs']);
            Route::post('/failed-jobs/retry-all', [SystemMonitorController::class, 'retryAllFailedJobs']);
            Route::delete('/failed-jobs/flush', [SystemMonitorController::class, 'flushFailedJobs']);
            Route::post('/failed-jobs/{uuid}/retry', [SystemMonitorController::class, 'retryFailedJob']);
            Route::delete('/failed-jobs/{uuid}', [SystemMonitorController::class, 'forgetFailedJob']);
        });

        // Feature management (super_admin only — no feature gate needed on this route itself)
        Route::get('/features', [FeatureController::class, 'index']);
        Route::post('/features/toggle', [FeatureController::class, 'toggle']);
        Route::put('/features', [FeatureController::class, 'update']);
        Route::get('/features/sub', [FeatureController::class, 'getDisabledSubFeatures']);
        Route::put('/features/sub', [FeatureController::class, 'updateDisabledSubFeatures']);

        // FAQs — admin CRUD
        Route::get('/faqs', [FaqController::class, 'index']);
        Route::post('/faqs', [FaqController::class, 'store']);
        Route::put('/faqs/reorder', [FaqController::class, 'reorder']);
        Route::put('/faqs/{faq}', [FaqController::class, 'update']);
        Route::delete('/faqs/{faq}', [FaqController::class, 'destroy']);

        // Login notices — admin CRUD
        Route::get('/login-notices', [LoginNoticeController::class, 'index']);
        Route::post('/login-notices', [LoginNoticeController::class, 'store']);
        Route::put('/login-notices/{loginNotice}', [LoginNoticeController::class, 'update']);
        Route::delete('/login-notices/{loginNotice}', [LoginNoticeController::class, 'destroy']);

        // Feedback popup — submit (any authenticated user) + admin listing/deletion
        Route::post('/feedback', [FeedbackController::class, 'store']);
        Route::get('/feedback', [FeedbackController::class, 'index']);
        Route::delete('/feedback/{feedback}', [FeedbackController::class, 'destroy']);
        Route::post('/feedback/new-round', [FeedbackController::class, 'newRound']);

        // Settings — static segments must come before {key} wildcard
        Route::get('/settings', [SettingsController::class, 'index']);
        Route::put('/settings', [SettingsController::class, 'update']);
        Route::get('/settings/app', [SettingsController::class, 'appSettings']);
        Route::put('/settings/app/bulk', [SettingsController::class, 'updateBulk']);
        Route::get('/settings/system-info', [SettingsController::class, 'systemInfo']);
        Route::post('/settings/clear-cache', [SettingsController::class, 'clearCache']);
        Route::post('/settings/toggle-maintenance', [SettingsController::class, 'toggleMaintenance']);
        Route::post('/settings/test-email', [SettingsController::class, 'testEmail']);
        Route::post('/settings/upload-asset', [SettingsController::class, 'uploadAsset']);
        Route::post('/settings/upload-editor-image', [SettingsController::class, 'uploadEditorImage']);
        Route::post('/settings/send-email', [SettingsController::class, 'sendBroadcastEmail']);
        Route::post('/settings/run-backup', [SettingsController::class, 'runBackup']);
        Route::put('/settings/app/{key}', [SettingsController::class, 'updateAppSetting']);

        // Proposal Calls — admin actions
        Route::post('/proposal-calls', [ProposalCallController::class, 'store']);
        Route::put('/proposal-calls/{id}', [ProposalCallController::class, 'update']);
        Route::post('/proposal-calls/{id}/activate', [ProposalCallController::class, 'activate']);
        Route::post('/proposal-calls/{id}/close', [ProposalCallController::class, 'close']);
        Route::post('/proposal-calls/{id}/reopen', [ProposalCallController::class, 'reopen']);
        Route::delete('/proposal-calls/{id}', [ProposalCallController::class, 'destroy']);
        Route::post('/proposal-calls/{id}/guidelines', [ProposalCallController::class, 'uploadGuidelines']);
        Route::get('/proposal-calls/{id}/guidelines/download', [ProposalCallController::class, 'downloadGuidelines']);

        // Proposal Wizard — static segments before apiResource to avoid {id} collision
        Route::post('/proposals/draft', [ProposalWizardController::class, 'createDraft']);
        Route::get('/proposals/validation-queue', [ProposalValidationController::class, 'index']);
        Route::get('/proposals/validation-queue/rejected', [ProposalValidationController::class, 'rejected']);
        Route::get('/proposals/involved', [ProposalController::class, 'involved']);
        Route::get('/proposals/my', [ProposalController::class, 'myProposals']);
        Route::get('/proposals/statistics', [ProposalController::class, 'statistics']);

        Route::apiResource('/proposals', ProposalController::class);

        Route::post('/proposals/{id}/steps/{step}', [ProposalWizardController::class, 'saveStep']);
        Route::get('/proposals/{id}/steps/{step}', [ProposalWizardController::class, 'getStep']);
        Route::post('/proposals/{id}/documents', [ProposalWizardController::class, 'uploadDocument']);
        Route::get('/proposals/{id}/documents/{docId}/download', [ProposalWizardController::class, 'downloadDocument']);
        Route::delete('/proposals/{id}/documents/{docId}', [ProposalWizardController::class, 'deleteDocument']);
        Route::post('/proposals/{id}/submit', [ProposalWizardController::class, 'submit']);
        Route::get('/proposals/{id}/workflow-history', [ProposalController::class, 'workflowHistory']);
        Route::get('/proposals/{id}/budget', [ProposalController::class, 'budget']);

        // Validation
        Route::post('/proposals/validation/bulk-approve', [ProposalValidationController::class, 'bulkApprove']);
        Route::post('/proposals/{id}/validation/approve', [ProposalValidationController::class, 'approve']);
        Route::post('/proposals/{id}/validation/return', [ProposalValidationController::class, 'return']);
        Route::post('/proposals/{id}/validation/reject', [ProposalValidationController::class, 'reject']);

        // Review
        Route::get('/proposals/{id}/available-reviewers', [ReviewController::class, 'availableReviewers']);
        Route::post('/proposals/{id}/review/assign', [ReviewController::class, 'assign']);
        // /my must be before /{id} so the static segment wins the route match
        Route::get('/review-assignments/my', [ReviewController::class, 'myAssignments']);
        Route::get('/review-assignments/{id}', [ReviewController::class, 'showAssignment']);
        Route::post('/review-assignments/{id}/score', [ReviewController::class, 'submitScore']);
        Route::post('/proposals/{id}/defence/schedule', [ReviewController::class, 'scheduleDefence']);
        Route::post('/proposals/{id}/defence/process-result', [ReviewController::class, 'processDefenceResultByProposal']);
        Route::post('/defence-sessions/{id}/process-result', [ReviewController::class, 'processDefenceResult']);
        Route::get('/evaluation-types', [ReviewController::class, 'evaluationTypes']);
        Route::post('/evaluation-types', [ReviewController::class, 'storeEvaluationType']);
        Route::put('/evaluation-types/{id}', [ReviewController::class, 'updateEvaluationType']);
        Route::get('/evaluation-types/{id}/categories', [ReviewController::class, 'evaluationCategories']);
        Route::post('/evaluation-types/{id}/categories', [ReviewController::class, 'storeCategory']);
        Route::put('/evaluation-categories/{id}', [ReviewController::class, 'updateCategory']);
        Route::delete('/evaluation-categories/{id}', [ReviewController::class, 'destroyCategory']);
        Route::get('/evaluation-categories/{id}/questions', [ReviewController::class, 'evaluationQuestions']);
        Route::post('/evaluation-categories/{id}/questions', [ReviewController::class, 'storeQuestion']);
        Route::put('/evaluation-questions/{id}', [ReviewController::class, 'updateQuestion']);
        Route::delete('/evaluation-questions/{id}', [ReviewController::class, 'destroyQuestion']);

        // Review management
        // Resources (downloadable files)
        Route::get('/admin/resources', [ResourceController::class, 'index']);
        Route::post('/admin/resources', [ResourceController::class, 'store']);
        Route::put('/admin/resources/{id}', [ResourceController::class, 'update']);
        Route::delete('/admin/resources/{id}', [ResourceController::class, 'destroy']);

        Route::get('/admin/review-management', [ReviewController::class, 'proposalReviewList']);
        Route::get('/admin/reviewer-workload', [ReviewController::class, 'reviewerWorkload']);
        Route::get('/admin/reviewer-analytics', [ReviewController::class, 'reviewerAnalytics']);
        Route::post('/proposals/{id}/review/add-reviewer', [ReviewController::class, 'addReviewer']);
        Route::delete('/review-assignments/{id}/remove', [ReviewController::class, 'removeReviewer']);
        Route::put('/review-assignments/{id}/reassign', [ReviewController::class, 'reassignReviewer']);
        Route::put('/review-assignments/{id}/extend', [ReviewController::class, 'extendDueDate']);
        Route::post('/review-assignments/{id}/declare-coi', [ReviewController::class, 'declareCoi']);
        Route::post('/proposal-members/{id}/respond-invitation', [ReviewController::class, 'respondInvitation']);

        // Overdue reviews dashboard — reminder history is shared with the daily
        // rtt:review-deadline-reminders scheduled command via ReviewReminderService.
        Route::get('/admin/review-deadlines', [ReviewDeadlineController::class, 'index']);
        Route::middleware('throttle:20,1')->post('/review-assignments/{id}/remind', [ReviewDeadlineController::class, 'remind']);
        // One click can remind up to MAX_BULK_IDS (100) reviewers in a single request,
        // so this needs a much higher per-minute ceiling than the single-remind route —
        // the real anti-spam guard is the per-assignment cooldown inside
        // ReviewReminderService::sendReminder(), not this request-rate limit.
        Route::middleware('throttle:30,1')->post('/review-assignments/bulk-remind', [ReviewDeadlineController::class, 'bulkRemind']);

        // Appeals
        Route::post('/proposals/{id}/appeal', [ProposalAppealController::class, 'store']);
        Route::get('/proposals/{id}/appeal', [ProposalAppealController::class, 'show']);
        Route::get('/appeals', [ProposalAppealController::class, 'index']);
        Route::post('/appeals/{id}/resolve', [ProposalAppealController::class, 'resolve']);

        // Proposal pipeline — cross-phase status overview
        Route::get('/proposal-pipeline', [ProposalPipelineController::class, 'index']);
        Route::get('/proposal-pipeline/export', [ProposalPipelineController::class, 'export']);

        // Ongoing proposals — consolidated post-award monitoring view (funded/midterm_evaluation)
        Route::get('/ongoing-proposals', [OngoingProposalsController::class, 'index']);
        Route::get('/ongoing-proposals/export', [OngoingProposalsController::class, 'export']);
        Route::get('/ongoing-proposals/grantable', [OngoingProposalsController::class, 'grantable']);
        Route::get('/ongoing-proposals/grant-legacy/import-template', [OngoingProposalsController::class, 'grantLegacyImportTemplate']);
        Route::post('/ongoing-proposals/grant-legacy/import', [OngoingProposalsController::class, 'grantLegacyImport']);
        Route::post('/ongoing-proposals/grant-legacy/create', [OngoingProposalsController::class, 'createLegacy']);
        Route::get('/ongoing-proposals/grant-legacy/academic-years', [OngoingProposalsController::class, 'academicYears']);
        Route::post('/ongoing-proposals/{id}/archive', [OngoingProposalsController::class, 'archive']);
        Route::post('/ongoing-proposals/{id}/grant-legacy', [OngoingProposalsController::class, 'grantLegacy']);

        // Central evaluation
        Route::get('/central-evaluation', [CentralEvaluationController::class, 'index']);
        Route::get('/central-evaluation/pi/{userId}/funding-history', [CentralEvaluationController::class, 'piFundingHistory']);
        Route::post('/proposals/{id}/central/approve', [CentralEvaluationController::class, 'centralApprove']);
        Route::post('/proposals/{id}/central/reject', [CentralEvaluationController::class, 'centralReject']);
        Route::post('/proposals/{id}/funding/revoke', [CentralEvaluationController::class, 'revokeFunding']);

        // Contract Signing
        Route::post('/proposals/{id}/contract/submit', [ContractController::class, 'submit']);
        Route::delete('/proposals/{id}/contract', [ContractController::class, 'remove']);
        Route::post('/proposals/{id}/contract/approve', [ContractController::class, 'approve']);
        Route::post('/proposals/{id}/contract/reject', [ContractController::class, 'reject']);
        Route::get('/proposals/{id}/contract/download', [ContractController::class, 'download']);

        // Awards
        Route::get('/proposals/awarded/export', [AwardController::class, 'exportAwarded']);
        Route::post('/proposals/{id}/award', [AwardController::class, 'store']);
        Route::get('/proposals/{id}/award', [AwardController::class, 'show']);
        Route::patch('/proposals/{id}/award', [AwardController::class, 'update']);
        Route::get('/proposals/{id}/award-letter/download', [AwardController::class, 'downloadLetter']);
        Route::post('/awards/approve-letters', [AwardController::class, 'approveLetters']);
        Route::get('/proposals/{id}/award-details', [AwardController::class, 'show']);
        Route::put('/proposals/{id}/award-details', [AwardController::class, 'update']);

        // ── Finance module (feature: finance) ─────────────────────────────────
        Route::middleware('feature:finance')->group(function () {
            // Disbursements
            Route::get('/disbursements/pending', [DisbursementController::class, 'pendingApproved']);
            Route::get('/disbursements/stats', [DisbursementController::class, 'stats']);
            Route::get('/disbursements', [DisbursementController::class, 'index']);
            Route::post('/disbursements', [DisbursementController::class, 'store']);
            Route::get('/disbursements/{id}', [DisbursementController::class, 'show']);

            // Budget Allocations
            Route::get('/budget-allocations', [BudgetController::class, 'allocations']);
            Route::get('/budget-allocations/stats', [BudgetController::class, 'allocationStats']);
            Route::get('/budget-allocations/colleges-summary', [BudgetController::class, 'collegesSummary']);
            Route::get('/budget-allocations/proposal-budgets', [BudgetController::class, 'proposalBudgets']);
            Route::get('/budget-allocations/fiscal-years', [BudgetController::class, 'fiscalYears']);
            Route::post('/budget-allocations/bulk-approve', [BudgetController::class, 'bulkApproveAllocations']);
            Route::post('/budget-allocations/{id}/approve', [BudgetController::class, 'approveAllocation']);
            Route::patch('/budget-allocations/{id}', [BudgetController::class, 'updateAllocation']);
            Route::get('/colleges/{id}/funded-proposals-for-allocation', [BudgetController::class, 'fundedProposalsForAllocation']);
            Route::post('/proposals/{id}/quick-allocate', [BudgetController::class, 'quickAllocate']);

            // Budget Requests
            Route::get('/budget-requests', [BudgetController::class, 'index']);
            Route::post('/budget-requests', [BudgetController::class, 'store']);
            Route::get('/budget-requests/{id}', [BudgetController::class, 'show']);
            Route::put('/budget-requests/{id}', [BudgetController::class, 'update']);
            Route::delete('/budget-requests/{id}', [BudgetController::class, 'destroy']);
            Route::post('/colleges/{id}/budget-allocations', [BudgetController::class, 'allocateToCollege']);
            Route::post('/proposals/{id}/budget-allocations', [BudgetController::class, 'allocateToProposal']);
            Route::post('/proposals/{id}/budget-requests', [BudgetController::class, 'createRequest']);
            Route::get('/proposals/{id}/budget-requests', [BudgetController::class, 'listRequests']);
            Route::get('/proposals/{id}/budget-summary', [BudgetController::class, 'budgetSummary']);
            Route::post('/budget-requests/{id}/submit', [BudgetController::class, 'submitRequest']);
            Route::post('/budget-requests/{id}/sign', [BudgetController::class, 'sign']);
            Route::post('/budget-requests/{id}/refuse', [BudgetController::class, 'refuse']);
            Route::post('/budget-requests/{id}/approve', [BudgetController::class, 'approve']);
            Route::post('/budget-requests/{id}/reject', [BudgetController::class, 'rejectByCollege']);
            Route::post('/budget-requests/{id}/finance-return', [BudgetController::class, 'returnByFinance']);
            Route::post('/budget-requests/{id}/disburse', [BudgetController::class, 'disburse']);
            Route::post('/budget-requests/{id}/settle', [BudgetController::class, 'submitSettlement']);

            // Settlements
            Route::get('/settlements/pending', [SettlementController::class, 'pendingSettlements']);
            Route::get('/settlements/stats', [SettlementController::class, 'stats']);
            Route::get('/settlements', [SettlementController::class, 'index']);
            Route::post('/settlements', [SettlementController::class, 'store']);
            Route::get('/settlements/{id}', [SettlementController::class, 'show']);
            Route::post('/settlements/{id}/verify', [SettlementController::class, 'verify']);
            Route::post('/settlements/{id}/finalize', [SettlementController::class, 'finalize']);
            Route::post('/settlements/{id}/upload-report', [SettlementController::class, 'uploadExpenseReport']);
            Route::get('/settlements/{id}/download-report', [SettlementController::class, 'downloadReport']);
            Route::get('/form-templates', fn () => response()->json([
                'data' => FormTemplate::where('is_active', true)->get(['id', 'name', 'description']),
                'message' => '', 'errors' => [], 'meta' => [],
            ]));
        });

        // ── Monitoring module (feature: monitoring) ────────────────────────────
        Route::middleware('feature:monitoring')->group(function () {
            Route::get('/midterm-evaluations/stats', [MidtermEvaluationController::class, 'stats']);
            Route::get('/midterm-evaluations/eligible-proposals', [MidtermEvaluationController::class, 'eligibleProposals']);
            Route::post('/midterm-evaluations/bulk-schedule', [MidtermEvaluationController::class, 'bulkSchedule']);
            Route::get('/midterm-evaluations', [MidtermEvaluationController::class, 'index']);
            Route::post('/midterm-evaluations', [MidtermEvaluationController::class, 'schedule']);
            Route::get('/midterm-evaluations/{id}', [MidtermEvaluationController::class, 'show']);
            Route::post('/midterm-evaluations/{id}/submit-report', [MidtermEvaluationController::class, 'submitReport']);
            Route::post('/midterm-evaluations/{id}/score', [MidtermEvaluationController::class, 'score']);
            Route::post('/midterm-evaluations/{id}/upload-report', [MidtermEvaluationController::class, 'uploadReport']);
            Route::get('/midterm-evaluations/{id}/download-report/{type}', [MidtermEvaluationController::class, 'downloadReport']);

            Route::get('/completion-workshops/stats', [CompletionWorkshopController::class, 'stats']);
            Route::get('/completion-workshops/eligible-proposals', [CompletionWorkshopController::class, 'eligibleProposals']);
            Route::get('/completion-workshops', [CompletionWorkshopController::class, 'index']);
            Route::post('/completion-workshops', [CompletionWorkshopController::class, 'schedule']);
            Route::post('/completion-workshops/bulk-schedule', [CompletionWorkshopController::class, 'bulkSchedule']);
            Route::get('/completion-workshops/{id}', [CompletionWorkshopController::class, 'show']);
            Route::post('/completion-workshops/{id}/evidence', [CompletionWorkshopController::class, 'storeEvidence']);
            Route::post('/completion-workshops/{id}/finalize', [CompletionWorkshopController::class, 'finalizeWorkshop']);
            Route::patch('/completion-workshops/{id}/status', [CompletionWorkshopController::class, 'updateStatus']);
            Route::post('/completion-workshops/{id}/upload', [CompletionWorkshopController::class, 'uploadFile']);
            Route::get('/completion-workshops/{id}/questions', [CompletionWorkshopController::class, 'getQuestions']);
            Route::post('/completion-workshops/{id}/questions', [CompletionWorkshopController::class, 'postQuestion']);
            Route::patch('/completion-workshops/{id}/questions/{questionId}/answer', [CompletionWorkshopController::class, 'answerQuestion']);
            Route::delete('/completion-workshops/{id}/questions/{questionId}', [CompletionWorkshopController::class, 'deleteQuestion']);

            // Research Outputs
            Route::get('/research-outputs/stats', [ResearchOutputController::class, 'stats']);
            Route::get('/research-outputs/eligible-proposals', [ResearchOutputController::class, 'eligibleProposals']);
            Route::get('/research-outputs', [ResearchOutputController::class, 'index']);
            Route::post('/research-outputs', [ResearchOutputController::class, 'store']);
            Route::get('/research-outputs/{id}', [ResearchOutputController::class, 'show']);
            Route::put('/research-outputs/{id}', [ResearchOutputController::class, 'update']);
            Route::delete('/research-outputs/{id}', [ResearchOutputController::class, 'destroy']);
            Route::post('/research-outputs/{id}/verify', [ResearchOutputController::class, 'verify']);
            Route::post('/research-outputs/{id}/approve', [ResearchOutputController::class, 'approve']);

            // Research impact tracker
            Route::get('/research-impacts', [ResearchImpactController::class, 'index']);
            Route::post('/research-impacts', [ResearchImpactController::class, 'store']);
            Route::put('/research-impacts/{researchImpact}', [ResearchImpactController::class, 'update']);
            Route::delete('/research-impacts/{researchImpact}', [ResearchImpactController::class, 'destroy']);

            // AI scoring, reviewer matching, proposal cloning
            Route::get('/proposals/{proposal}/ai-score', [ProposalAiScoreController::class, 'show']);
            Route::post('/proposals/{proposal}/ai-score/generate', [ProposalAiScoreController::class, 'generate']);
            Route::get('/proposals/{id}/review-results', [ReviewController::class, 'proposalReviewResults']);
            Route::get('/proposals/{id}/review-results/recalculate', [ReviewController::class, 'recalculateReviewScore']);
            Route::get('/proposals/{proposal}/reviewer-suggestions', [ReviewerMatchController::class, 'suggestions']);
            Route::post('/proposals/{proposal}/clone', [ProposalController::class, 'clone']);

            // Budget milestones
            Route::get('/proposals/{proposalId}/milestones', [BudgetMilestoneController::class, 'index']);
            Route::post('/proposals/{proposalId}/milestones', [BudgetMilestoneController::class, 'store']);
            Route::put('/proposals/{proposalId}/milestones/{budgetMilestone}', [BudgetMilestoneController::class, 'update']);
            Route::delete('/proposals/{proposalId}/milestones/{budgetMilestone}', [BudgetMilestoneController::class, 'destroy']);

            // Repository admin management
            Route::get('/admin/repository/stats', [RepositoryController::class, 'adminStats']);
            Route::get('/admin/repository/publishable', [RepositoryController::class, 'publishableProposals']);
            Route::get('/admin/repository', [RepositoryController::class, 'adminIndex']);
            Route::post('/admin/repository/{proposalId}/publish', [RepositoryController::class, 'publish']);
            Route::patch('/admin/repository/{id}', [RepositoryController::class, 'update']);
            Route::delete('/admin/repository/{id}', [RepositoryController::class, 'unpublish']);
        });

        Route::get('/admin/analytics', [AnalyticsController::class, 'index']);

        // ── Reports module (feature: reports) ─────────────────────────────────
        Route::middleware('feature:reports')->group(function () {
            Route::get('/reports', [ReportController::class, 'index']);
            Route::post('/reports/generate', [ReportController::class, 'generate']);
            Route::get('/reports/builder-options', [ReportController::class, 'builderOptions']);
            Route::get('/reports/{id}/export', [ReportController::class, 'exportExcel']);
            Route::get('/reports/{id}', [ReportController::class, 'show']);
        });
        Route::get('/reports/proposals/export', [ReportController::class, 'exportProposals']);
        Route::get('/reports/proposals/stats-pdf', [ReportController::class, 'proposalStatsPdf']);

        // ── Complaints module (feature: complaints) ────────────────────────────
        Route::middleware('feature:complaints')->group(function () {
            Route::get('/proposals/{id}/complaints', [ComplaintController::class, 'proposalComplaints']);
            Route::post('/proposals/{id}/complaints', [ComplaintController::class, 'store']);
            Route::post('/proposals/{id}/complaints/officer', [ComplaintController::class, 'storeOfficerComplaint']);
            Route::get('/complaints', [ComplaintController::class, 'index']);
            Route::get('/complaints/{id}', [ComplaintController::class, 'show']);
            Route::put('/complaints/{id}', [ComplaintController::class, 'update']);
            Route::delete('/complaints/{id}', [ComplaintController::class, 'destroy']);
            Route::post('/complaints/{id}/respond', [ComplaintController::class, 'respond']);
            Route::post('/complaints/{id}/escalate', [ComplaintController::class, 'escalate']);
        });

        // ── Similarity module (feature: similarity) ────────────────────────────
        Route::middleware('feature:similarity')->group(function () {
            Route::get('/similarity-scores', [SimilarityController::class, 'index']);
        });

        // ── External Funds module (feature: external_funds) ────────────────────
        Route::middleware('feature:external_funds')->prefix('external-funds')->group(function () {
            Route::get('/dashboard', [EFDashboardController::class, 'metrics']);

            Route::apiResource('agencies', EFAgencyController::class);

            Route::apiResource('opportunities', EFOpportunityController::class);

            Route::apiResource('applications', EFApplicationController::class);
            Route::patch('applications/{id}/status', [EFApplicationController::class, 'updateStatus']);
            Route::get('applications/{id}/reviews', [EFReviewController::class, 'index']);
            Route::post('applications/{id}/reviews', [EFReviewController::class, 'store']);
            Route::get('applications/{id}/documents', [EFDocumentController::class, 'index']);
            Route::post('applications/{id}/documents', [EFDocumentController::class, 'store']);
            Route::get('applications/{id}/budgets', [EFBudgetController::class, 'index']);
            Route::post('applications/{id}/budgets', [EFBudgetController::class, 'store']);
            Route::get('applications/{id}/team-members', [EFTeamMemberController::class, 'index']);
            Route::post('applications/{id}/team-members', [EFTeamMemberController::class, 'store']);
            Route::delete('team-members/{id}', [EFTeamMemberController::class, 'destroy']);

            Route::apiResource('awards', EFAwardController::class);
            Route::get('awards/{id}/expenditures', [EFExpenditureController::class, 'index']);
            Route::post('awards/{id}/expenditures', [EFExpenditureController::class, 'store']);
            Route::get('awards/{id}/milestones', [EFMilestoneController::class, 'index']);
            Route::post('awards/{id}/milestones', [EFMilestoneController::class, 'store']);
            Route::get('awards/{id}/documents', [EFDocumentController::class, 'index']);
            Route::post('awards/{id}/documents', [EFDocumentController::class, 'store']);

            Route::put('budgets/{id}', [EFBudgetController::class, 'update']);
            Route::delete('budgets/{id}', [EFBudgetController::class, 'destroy']);
            Route::put('milestones/{id}', [EFMilestoneController::class, 'update']);
            Route::delete('milestones/{id}', [EFMilestoneController::class, 'destroy']);
            Route::get('documents/{id}/download', [EFDocumentController::class, 'download']);
            Route::delete('documents/{id}', [EFDocumentController::class, 'destroy']);
        });

        // Dashboard
        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::get('/dashboard/widgets/{name}', [DashboardController::class, 'widget']);

        // Researcher Hub
        Route::get('/researcher-hub', [ResearcherHubController::class, 'index']);

        // Calendar export — auth handled in controller (supports ?token= for browser downloads)

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/notifications/read', [NotificationController::class, 'markAsRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::delete('/notifications/read', [NotificationController::class, 'destroyRead']);
        Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

        // Action counts (nav badges)
        Route::get('/action-counts', [ActionCountController::class, 'index']);

        // Annual report
        Route::get('/annual-report/preview', [AnnualReportController::class, 'preview']);
        Route::get('/annual-report/download', [AnnualReportController::class, 'download']);

        Route::get('/proposal-archive', [ProposalArchiveController::class, 'index']);
        Route::get('/proposal-archive/documents/{documentId}/download', [ProposalArchiveController::class, 'downloadDocument']);

        // ── File uploads — 60 per minute per user ─────────────────────────────
        Route::middleware('throttle:60,1')->group(function () {
            Route::post('/proposals/{id}/documents', [ProposalWizardController::class, 'uploadDocument']);
        });
    });

    // Calendar export — outside auth:sanctum so browser downloads work without Authorization header.
    // The controller authenticates via query ?token= param.
    Route::get('/calendar/export', [CalendarController::class, 'export']);
    Route::get('/calendar/events', [CalendarController::class, 'events']);
});
