<?php

use App\Http\Controllers\Api\ActionCountController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\FeatureController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AwardController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\CentralEvaluationController;
use App\Http\Controllers\Api\CollegeController;
use App\Http\Controllers\Api\ComplaintController;
use App\Http\Controllers\Api\CompletionWorkshopController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DisbursementController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\MidtermEvaluationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProposalCallController;
use App\Http\Controllers\Api\ProposalController;
use App\Http\Controllers\Api\ProposalValidationController;
use App\Http\Controllers\Api\ProposalWizardController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RepositoryController;
use App\Http\Controllers\Api\ResearchOutputController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SettlementController;
use App\Http\Controllers\Api\SimilarityController;
use App\Http\Controllers\Api\StatsController;

use App\Http\Controllers\Api\UserController;
use App\Models\FormTemplate;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // Health check — no auth, no rate limit
    Route::get('/health', [HealthController::class, 'check']);

    // ── Public auth — strictly rate limited ───────────────────────────────────
    // 5 attempts per minute per IP
    Route::middleware('throttle:5,1')->post('/auth/login', [AuthController::class, 'login']);

    // 3 attempts per hour per IP
    Route::middleware('throttle:3,60')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->name('password.email');
    });

    // Telegram webhook — 30 per minute per IP
    Route::middleware('throttle:30,1')->post('/auth/telegram/webhook', [AuthController::class, 'telegramWebhook']);

    // ── Public read-only ──────────────────────────────────────────────────────
    // /all must be registered before /{slug} so the static segment wins over the wildcard
    Route::middleware('auth:sanctum')->get('/proposal-calls/all', [ProposalCallController::class, 'allForAdmin']);
    Route::get('/proposal-calls', [ProposalCallController::class, 'index']);
    Route::get('/proposal-calls/{slug}', [ProposalCallController::class, 'show']);
    Route::get('/repository', [RepositoryController::class, 'index']);
    Route::get('/repository/{id}', [RepositoryController::class, 'show']);
    Route::get('/tracker/{number}', [RepositoryController::class, 'tracker']);
    Route::get('/stats', [StatsController::class, 'index']);

    // ── Authenticated — 300 requests per minute per user ─────────────────────
    Route::middleware(['auth:sanctum', 'user.active', 'throttle:300,1', 'college.scope', 'category.scope'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::post('/auth/avatar', [AuthController::class, 'uploadAvatar']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
        Route::post('/auth/telegram/generate-token', [AuthController::class, 'generateTelegramToken']);

        // Users
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users/{id}', [UserController::class, 'show']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
        Route::put('/users/{id}/role', [UserController::class, 'updateRole']);
        Route::put('/users/{id}/roles', [UserController::class, 'updateUserRoles']);
        Route::get('/users/{id}/roles', [UserController::class, 'userRoles']);
        Route::put('/users/{id}/status', [UserController::class, 'updateStatus']);
        Route::get('/users/{id}/academic-info', [UserController::class, 'academicInfo']);

        // Roles and permissions
        Route::get('/roles', [RoleController::class, 'index']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::put('/roles/{id}', [RoleController::class, 'update']);
        Route::delete('/roles/{id}', [RoleController::class, 'destroy']);
        Route::get('/roles/{id}/permissions', [RoleController::class, 'permissions']);
        Route::put('/roles/{id}/permissions', [RoleController::class, 'updatePermissions']);
        Route::get('/permissions', [RoleController::class, 'allPermissions']);
        Route::post('/permissions/refresh', [RoleController::class, 'refreshPermissions']);

        // Colleges
        Route::get('/colleges', [CollegeController::class, 'index']);
        Route::post('/colleges', [CollegeController::class, 'store']);
        Route::put('/colleges/{id}', [CollegeController::class, 'update']);
        Route::get('/colleges/{id}/departments', [CollegeController::class, 'departments']);
        Route::get('/departments', [CollegeController::class, 'allDepartments']);
        Route::post('/departments', [CollegeController::class, 'storeDepartment']);
        Route::put('/departments/{id}', [CollegeController::class, 'updateDepartment']);

        // Audit logs
        Route::get('/audit-logs', [AuditLogController::class, 'index']);

        // Feature management (super_admin only — no feature gate needed on this route itself)
        Route::get('/features', [FeatureController::class, 'index']);
        Route::post('/features/toggle', [FeatureController::class, 'toggle']);
        Route::put('/features', [FeatureController::class, 'update']);

        // Settings — static segments must come before {key} wildcard
        Route::get('/settings',                    [SettingsController::class, 'index']);
        Route::put('/settings',                    [SettingsController::class, 'update']);
        Route::get('/settings/app',                [SettingsController::class, 'appSettings']);
        Route::put('/settings/app/bulk',           [SettingsController::class, 'updateBulk']);
        Route::get('/settings/system-info',        [SettingsController::class, 'systemInfo']);
        Route::post('/settings/clear-cache',       [SettingsController::class, 'clearCache']);
        Route::post('/settings/toggle-maintenance',[SettingsController::class, 'toggleMaintenance']);
        Route::post('/settings/test-email',        [SettingsController::class, 'testEmail']);
        Route::post('/settings/upload-asset',      [SettingsController::class, 'uploadAsset']);
        Route::post('/settings/send-email',        [SettingsController::class, 'sendBroadcastEmail']);
        Route::put('/settings/app/{key}',          [SettingsController::class, 'updateAppSetting']);

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
        Route::get('/admin/review-management', [ReviewController::class, 'proposalReviewList']);
        Route::put('/review-assignments/{id}/reassign', [ReviewController::class, 'reassignReviewer']);
        Route::put('/review-assignments/{id}/extend', [ReviewController::class, 'extendDueDate']);

        // Central evaluation
        Route::get('/central-evaluation', [CentralEvaluationController::class, 'index']);
        Route::post('/proposals/{id}/central/approve', [CentralEvaluationController::class, 'centralApprove']);
        Route::post('/proposals/{id}/central/reject', [CentralEvaluationController::class, 'centralReject']);

        // Awards
        Route::post('/proposals/{id}/award', [AwardController::class, 'store']);
        Route::get('/proposals/{id}/award', [AwardController::class, 'show']);
        Route::patch('/proposals/{id}/award', [AwardController::class, 'update']);
        Route::get('/proposals/{id}/award-letter/download', [AwardController::class, 'downloadLetter']);
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

            // Research Outputs
            Route::get('/research-outputs/stats', [ResearchOutputController::class, 'stats']);
            Route::get('/research-outputs/eligible-proposals', [ResearchOutputController::class, 'eligibleProposals']);
            Route::get('/research-outputs', [ResearchOutputController::class, 'index']);
            Route::post('/research-outputs', [ResearchOutputController::class, 'store']);
            Route::get('/research-outputs/{id}', [ResearchOutputController::class, 'show']);
            Route::put('/research-outputs/{id}', [ResearchOutputController::class, 'update']);
            Route::delete('/research-outputs/{id}', [ResearchOutputController::class, 'destroy']);

            // Repository admin management
            Route::get('/admin/repository/stats', [RepositoryController::class, 'adminStats']);
            Route::get('/admin/repository/publishable', [RepositoryController::class, 'publishableProposals']);
            Route::get('/admin/repository', [RepositoryController::class, 'adminIndex']);
            Route::post('/admin/repository/{proposalId}/publish', [RepositoryController::class, 'publish']);
            Route::patch('/admin/repository/{id}', [RepositoryController::class, 'update']);
            Route::delete('/admin/repository/{id}', [RepositoryController::class, 'unpublish']);
        });

        // ── Reports module (feature: reports) ─────────────────────────────────
        Route::middleware('feature:reports')->group(function () {
            Route::get('/reports', [ReportController::class, 'index']);
            Route::post('/reports/generate', [ReportController::class, 'generate']);
            Route::get('/reports/{id}', [ReportController::class, 'show']);
        });

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

        // Dashboard
        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::get('/dashboard/widgets/{name}', [DashboardController::class, 'widget']);

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/read', [NotificationController::class, 'markAsRead']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);

        // Action counts (nav badges)
        Route::get('/action-counts', [ActionCountController::class, 'index']);

        // ── File uploads — 60 per minute per user ─────────────────────────────
        Route::middleware('throttle:60,1')->group(function () {
            Route::post('/proposals/{id}/documents', [ProposalWizardController::class, 'uploadDocument']);
        });
    });
});
