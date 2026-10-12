<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DefenceDeadlineExtension;
use App\Models\User;
use App\Services\DefenceDeadlineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActionCountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;
        $roles = $user->getRoleNames()->toArray();

        $isSuperAdmin = in_array('super_admin', $roles);
        $isCentral = $isSuperAdmin || in_array('admin', $roles) || in_array('central_officer', $roles);
        $isResearch = in_array('research_officer', $roles);
        $isCommunity = in_array('community_officer', $roles);
        $isTechnology = in_array('technology_officer', $roles);
        $isOfficer = $isResearch || $isCommunity || $isTechnology;
        $isCollegeStaff = in_array('college_officer', $roles);
        $isFinance = in_array('support_officer', $roles);
        $isPI = in_array('staff', $roles);

        $officerCategories = [];
        if ($isResearch) {
            $officerCategories[] = 'research';
        }
        if ($isCommunity) {
            $officerCategories[] = 'community_engagement';
        }
        if ($isTechnology) {
            $officerCategories[] = 'technology_transfer';
        }

        // ── Helper: scope a proposals query by this user's role ───────────────
        // $alias is the table name or alias used for the proposals table in the query.
        // Always qualify college_id and category with the alias to avoid ambiguity
        // in queries that join proposals with other tables.
        $scopeProposals = function ($q, string $alias = 'proposals') use ($isCentral, $isOfficer, $officerCategories, $isCollegeStaff, $user) {
            if ($isCentral) {
                return $q;
            }
            if ($isOfficer && count($officerCategories)) {
                $q->whereIn("{$alias}.category", $officerCategories);
            }
            if ($isCollegeStaff && $user->college_id) {
                $q->where("{$alias}.college_id", $user->college_id);
            }

            return $q;
        };

        // ── 1. Pending review assignments (reviewer) ──────────────────────────
        $pendingReviews = DB::table('review_assignments')
            ->where('reviewer_id', $userId)
            ->where('status', 'pending')
            ->count();

        // ── 2. Budget request signatures awaiting this user ───────────────────
        $pendingSignatures = DB::table('form_signatures')
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->count();

        // ── 3. Validation queue: submitted proposals awaiting validation ───────
        $validationQueue = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $validationQueue = $scopeProposals(
                DB::table('proposals')->whereNull('deleted_at')->where('status', 'submitted')
            )->count();
        }

        // ── 4. Pending budget allocations awaiting approval ───────────────────
        $pendingAllocations = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $q = DB::table('budget_allocations as ba')
                ->join('proposals as p', 'ba.proposal_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->where('ba.status', 'pending')
                ->where('ba.allocation_type', 'proposal');
            $pendingAllocations = $scopeProposals($q, 'p')->count();
        }

        // ── 5. Budget requests submitted, awaiting college/officer review ──────
        $budgetRequestsReview = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $q = DB::table('budget_requests as br')
                ->join('proposals as p', 'br.proposal_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->whereIn('br.status', ['submitted', 'under_college_review']);
            $budgetRequestsReview = $scopeProposals($q, 'p')->count();
        }

        // ── 6. Approved budget requests awaiting disbursement ─────────────────
        $pendingDisbursements = 0;
        if ($isCentral || $isFinance) {
            $pendingDisbursements = DB::table('budget_requests as br')
                ->where('br.status', 'approved')
                ->whereNotExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('disbursements')
                        ->whereColumn('disbursements.budget_request_id', 'br.id');
                })
                ->count();
        }

        // ── 7. Settlements awaiting finance verification ───────────────────────
        $pendingSettlements = 0;
        if ($isCentral || $isFinance) {
            $pendingSettlements = DB::table('budget_settlements')
                ->where('status', 'college_verified')
                ->count();
        }

        // ── 8. Open complaints in this user's scope ───────────────────────────
        $openComplaints = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $q = DB::table('complaints')->whereIn('status', ['open', 'pending_response', 'escalated']);
            if (! $isCentral) {
                $q->where('assigned_to', $userId);
            }
            $openComplaints = $q->count();
        }

        // ── 9. Unread in-app notifications ────────────────────────────────────
        $unreadNotifications = DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $userId)
            ->whereNull('read_at')
            ->count();

        // ── 10. Active open proposal calls ────────────────────────────────────
        $proposalCallsActive = DB::table('proposal_calls')
            ->where('is_open', 1)
            ->where('end_date', '>=', now())
            ->count();

        // ── 11. My draft proposals (PI/staff: need to be submitted) ───────────
        $myProposalsDraft = 0;
        if ($isPI) {
            $myProposalsDraft = DB::table('proposals')
                ->whereNull('deleted_at')
                ->where('pi_user_id', $userId)
                ->where('status', 'draft')
                ->count();
        }

        // ── 12. Funded proposals without an approved budget allocation ─────────
        // (badge for Awarded Proposals: officer/admin sees newly funded work needing allocation setup)
        $awardedWithoutAllocation = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $q = DB::table('proposals as p')
                ->whereNull('p.deleted_at')
                ->where('p.status', 'funded')
                ->whereNotExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('budget_allocations as ba')
                        ->whereColumn('ba.proposal_id', 'p.id')
                        ->where('ba.allocation_type', 'proposal')
                        ->where('ba.status', 'approved');
                });
            $awardedWithoutAllocation = $scopeProposals($q, 'p')->count();
        }

        // ── 13. Proposals under blind review ──────────────────────────────────
        $blindReviewQueue = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $blindReviewQueue = $scopeProposals(
                DB::table('proposals as p')->whereNull('p.deleted_at')->where('p.status', 'under_blind_review'), 'p'
            )->count();
        }

        // ── 14. Proposals in open defence — includes proposals that have passed
        // blind review and are awaiting a defence session to be scheduled, since
        // that's exactly what the Open Defence page's queue tab shows.
        $openDefenceQueue = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $openDefenceQueue = $scopeProposals(
                DB::table('proposals as p')->whereNull('p.deleted_at')
                    ->whereIn('p.status', ['blind_review_passed', 'under_open_defence']), 'p'
            )->count();
        }

        // ── 15. Proposals awaiting a central evaluation funding decision ───────
        // Must match CentralEvaluationController::index(), which only ever queries
        // status = 'accepted' — 'blind_review_passed' proposals haven't reached
        // central evaluation yet (they're still awaiting defence scheduling, and
        // are already counted in open_defence_queue below).
        $centralEvalQueue = 0;
        if ($isCentral || $isOfficer) {
            $centralEvalQueue = $scopeProposals(
                DB::table('proposals as p')->whereNull('p.deleted_at')->where('p.status', 'accepted'), 'p'
            )->count();
        }

        // ── 16. Funded proposals under management on the Proposal Funding page ─
        // Must match ProposalFunding.jsx, which only ever queries status = 'funded'
        // (it's an admin page for already-funded proposals — edit awarded amount,
        // revoke funding — not a decision queue; that's central_eval_queue above,
        // which already covers "accepted, awaiting a funding decision").
        $proposalFundingQueue = 0;
        if ($isCentral || $isOfficer) {
            $proposalFundingQueue = $scopeProposals(
                DB::table('proposals as p')->whereNull('p.deleted_at')->where('p.status', 'funded'), 'p'
            )->count();
        }

        // ── 17. New/unreviewed similarity flags (admin only) ─────────────────
        $similarityFlagsPending = 0;
        if ($isCentral) {
            $similarityFlagsPending = DB::table('similarity_scores')
                ->where('flagged', 1)
                ->count();
        }

        // ── 18. Midterm evaluations needing action ────────────────────────────
        $midtermPending = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            // Officers/admins: scheduled midterms awaiting scoring
            $q = DB::table('midterm_evaluations as me')
                ->join('proposals as p', 'me.proposal_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->where('me.status', 'scheduled')
                ->whereNull('me.recommendation');
            $midtermPending = $scopeProposals($q, 'p')->count();
        } elseif ($isPI) {
            // PI: their proposals with upcoming scheduled midterms
            $midtermPending = DB::table('midterm_evaluations as me')
                ->join('proposals as p', 'me.proposal_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->where('p.pi_user_id', $userId)
                ->where('me.status', 'scheduled')
                ->count();
        }

        // ── 19. Completion workshops pending ──────────────────────────────────
        $completionWorkshopsPending = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $q = DB::table('completion_workshops as cw')
                ->join('proposals as p', 'cw.proposal_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->where('cw.status', 'scheduled');
            $completionWorkshopsPending = $scopeProposals($q, 'p')->count();
        } elseif ($isPI) {
            $completionWorkshopsPending = DB::table('completion_workshops as cw')
                ->join('proposals as p', 'cw.proposal_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->where('p.pi_user_id', $userId)
                ->where('cw.status', 'scheduled')
                ->count();
        }

        // ── 20. Ongoing proposals awaiting a midterm evaluation to be scheduled ─
        $ongoingAwaitingMidterm = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $q = DB::table('proposals as p')
                ->whereNull('p.deleted_at')
                ->where('p.status', 'funded')
                ->whereNotExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('midterm_evaluations')
                        ->whereColumn('midterm_evaluations.proposal_id', 'p.id');
                });
            $ongoingAwaitingMidterm = $scopeProposals($q, 'p')->count();
        }

        // ── 21. Overdue review assignments (admin + college officer — reviewer nudge dashboard) ─
        $overdueReviews = 0;
        if ($isCentral || $isCollegeStaff) {
            $q = DB::table('review_assignments as ra')
                ->join('proposals as p', 'ra.proposal_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->whereIn('ra.status', ['pending', 'accepted', 'in_progress'])
                ->whereNotNull('ra.due_date')
                ->where('ra.due_date', '<', now()->toDateString());
            $overdueReviews = $scopeProposals($q, 'p')->count();
        }

        // ── 22. Contracts submitted by a PI, awaiting officer approval/rejection ─
        $contractsPendingReview = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $contractsPendingReview = $scopeProposals(
                DB::table('proposals as p')->whereNull('p.deleted_at')->where('p.contract_status', 'pending'), 'p'
            )->count();
        }

        // ── 23. Reported COI conflicts awaiting reviewer reassignment ──────────
        $coiConflictsPending = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $q = DB::table('review_assignments as ra')
                ->join('proposals as p', 'ra.proposal_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->where('ra.coi_has_conflict', true)
                ->whereNull('ra.coi_resolved_at');
            $coiConflictsPending = $scopeProposals($q, 'p')->count();
        }

        // ── 24. Deadline extension requests awaiting an officer decision ───────
        $deadlineExtensionsPending = 0;
        if ($isCentral || $isOfficer) {
            $deadlineExtensionsPending = $scopeProposals(
                DB::table('deadline_extension_requests as der')
                    ->join('proposals as p', 'der.proposal_id', '=', 'p.id')
                    ->whereNull('p.deleted_at')
                    ->where('der.status', 'pending'),
                'p'
            )->count();
        }

        // ── 24b. Open defence score-deadline extensions awaiting approval ──────
        $defenceExtensionsPending = 0;
        if ($isCentral || $isOfficer) {
            $deadlineService = app(DefenceDeadlineService::class);
            $defenceExtensionsPending = DefenceDeadlineExtension::with('proposal:id,category')
                ->where('status', 'pending')
                ->get()
                ->filter(fn (DefenceDeadlineExtension $e) => $deadlineService->canApprove($e->proposal, $user))
                ->count();
        }

        // ── 25. Ethical clearance certificates awaiting an officer decision ────
        $ethicalClearancesPending = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $ethicalClearancesPending = $scopeProposals(
                DB::table('proposals as p')
                    ->whereNull('p.deleted_at')
                    ->where('p.ethical_clearance_status', 'submitted'),
                'p'
            )->count();
        }

        // ── 26. Budget revision requests awaiting an officer decision ──────────
        $budgetRevisionsPending = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff || $isFinance || in_array('finance_officer', $roles)) {
            $budgetRevisionsPending = $scopeProposals(
                DB::table('budget_revision_requests as brr')
                    ->join('proposals as p', 'brr.proposal_id', '=', 'p.id')
                    ->whereNull('p.deleted_at')
                    ->where('brr.status', 'pending'),
                'p'
            )->count();
        }

        // ── 27. No-cost extension requests awaiting an officer decision ────────
        $noCostExtensionsPending = 0;
        if ($isCentral || $isOfficer || $isCollegeStaff) {
            $noCostExtensionsPending = $scopeProposals(
                DB::table('no_cost_extension_requests as ncer')
                    ->join('proposals as p', 'ncer.proposal_id', '=', 'p.id')
                    ->whereNull('p.deleted_at')
                    ->where('ncer.status', 'pending'),
                'p'
            )->count();
        }

        // ── 28. Open approval reports awaiting an officer decision (or, for the
        // college_officer who filed them, still awaiting a response) ───────────
        $approvalReportsOpen = 0;
        if ($isCentral || $isOfficer) {
            $approvalReportsOpen = $scopeProposals(
                DB::table('proposal_approval_reports as par')
                    ->join('proposals as p', 'par.proposal_id', '=', 'p.id')
                    ->whereNull('p.deleted_at')
                    ->where('par.status', 'open'),
                'p'
            )->count();
        } elseif ($isCollegeStaff) {
            $approvalReportsOpen = DB::table('proposal_approval_reports')
                ->where('status', 'open')
                ->where('reported_by', $userId)
                ->count();
        }

        return response()->json([
            'data' => [
                // Existing
                'pending_reviews' => $pendingReviews,
                'pending_signatures' => $pendingSignatures,
                'validation_queue' => $validationQueue,
                'pending_allocations' => $pendingAllocations,
                'budget_requests_review' => $budgetRequestsReview,
                'pending_disbursements' => $pendingDisbursements,
                'pending_settlements' => $pendingSettlements,
                'open_complaints' => $openComplaints,
                'unread_notifications' => $unreadNotifications,
                // New
                'proposal_calls_active' => $proposalCallsActive,
                'my_proposals_draft' => $myProposalsDraft,
                'awarded_without_allocation' => $awardedWithoutAllocation,
                'blind_review_queue' => $blindReviewQueue,
                'open_defence_queue' => $openDefenceQueue,
                'central_eval_queue' => $centralEvalQueue,
                'proposal_funding_queue' => $proposalFundingQueue,
                'similarity_flags_pending' => $similarityFlagsPending,
                'midterm_pending' => $midtermPending,
                'completion_workshops_pending' => $completionWorkshopsPending,
                'ongoing_awaiting_midterm' => $ongoingAwaitingMidterm,
                'overdue_reviews' => $overdueReviews,
                'contracts_pending_review' => $contractsPendingReview,
                'coi_conflicts_pending' => $coiConflictsPending,
                'deadline_extensions_pending' => $deadlineExtensionsPending,
                'defence_extensions_pending' => $defenceExtensionsPending,
                'ethical_clearances_pending' => $ethicalClearancesPending,
                'budget_revisions_pending' => $budgetRevisionsPending,
                'no_cost_extensions_pending' => $noCostExtensionsPending,
                'approval_reports_open' => $approvalReportsOpen,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
