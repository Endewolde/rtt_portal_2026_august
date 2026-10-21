<?php

namespace App\Services;

use App\Models\OnboardingProgress;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Per-user, per-role onboarding: the welcome, guided tours finished, checklist
 * tasks done (by hand or detected from what the user has actually done), and
 * where an interrupted tour resumes.
 */
class OnboardingService
{
    /** Roles with their own onboarding, highest first — a user's onboarding role is the first one they hold. */
    public const ROLE_PRIORITY = [
        'super_admin', 'admin', 'central_officer',
        'research_officer', 'community_officer', 'technology_officer',
        'college_rtt_manager', 'college_officer', 'finance_officer', 'support_officer',
        'proposal_archivist', 'external_reviewer', 'staff', 'pi',
    ];

    /** Fallback onboarding for any role without its own. */
    public const GENERAL = 'general';

    public function __construct(private ReviewerAgreementService $agreements) {}

    /** Roles this user may keep onboarding progress for. */
    public function rolesFor(User $user): array
    {
        $held = $user->getRoleNames()->all();
        $ordered = array_values(array_intersect(self::ROLE_PRIORITY, $held));

        return [...$ordered, self::GENERAL];
    }

    public function defaultRole(User $user): string
    {
        return $this->rolesFor($user)[0];
    }

    public function progress(User $user, string $role): OnboardingProgress
    {
        return OnboardingProgress::firstOrCreate(
            ['user_id' => $user->id, 'role' => $role],
            ['completed_tours' => [], 'completed_tasks' => []],
        );
    }

    /**
     * Checklist tasks the system can see the user has already done, so the
     * checklist reflects real work, not only tours watched.
     *
     * @return array<string, bool>
     */
    public function signals(User $user): array
    {
        $id = $user->id;
        $logged = fn (array $actions) => DB::table('workflow_logs')->where('actor_id', $id)->whereIn('action', $actions)->exists();

        return [
            'profile_complete' => filled($user->phone) && filled($user->department_id) && filled($user->title),
            'notifications_configured' => DB::table('notification_preferences')->where('user_id', $id)->whereColumn('updated_at', '>', 'created_at')->exists(),
            'proposal_started' => DB::table('proposals')->where('pi_user_id', $id)->whereNull('deleted_at')->exists(),
            'proposal_submitted' => DB::table('proposals')->where('pi_user_id', $id)->whereNull('deleted_at')->where('status', '!=', 'draft')->exists(),
            'budget_requested' => DB::table('budget_requests')->where('requested_by', $id)->exists(),
            'agreement_accepted' => $this->agreements->hasAccepted($user),
            'review_submitted' => DB::table('review_assignments')->where('reviewer_id', $id)->where('status', 'submitted')->exists(),
            'proposal_validated' => $logged(['validate', 'return_for_correction']),
            'reviewers_assigned' => DB::table('review_assignments')->where('assigned_by', $id)->exists(),
            'defence_scheduled' => DB::table('defence_sessions')->where('scheduled_by', $id)->exists(),
            'funding_decided' => $logged(['central_approve', 'central_reject']),
            'progress_report_reviewed' => DB::table('progress_reports')->where('reviewed_by', $id)->exists(),
            'report_generated' => DB::table('report_snapshots')->where('requested_by', $id)->exists(),
            'funds_disbursed' => DB::table('disbursements')->where('disbursed_by', $id)->exists(),
        ];
    }

    /** @return array<string, mixed> */
    public function present(User $user, OnboardingProgress $progress): array
    {
        return [
            'role' => $progress->role,
            'roles' => $this->rolesFor($user),
            'welcome_seen' => $progress->welcome_seen_at !== null,
            'dismissed' => $progress->dismissed_at !== null,
            'completed_tours' => array_values($progress->completed_tours ?? []),
            'completed_tasks' => array_values($progress->completed_tasks ?? []),
            'active_tour' => $progress->active_tour,
            'active_step' => $progress->active_step,
            'signals' => $this->signals($user),
        ];
    }

    /**
     * Apply one change from the client.
     *
     * @param  array<string, mixed>  $change
     */
    public function update(OnboardingProgress $progress, array $change): OnboardingProgress
    {
        $tours = collect($progress->completed_tours ?? []);
        $tasks = collect($progress->completed_tasks ?? []);

        if (! empty($change['welcome_seen'])) {
            $progress->welcome_seen_at ??= now();
        }
        if (array_key_exists('dismissed', $change)) {
            $progress->dismissed_at = $change['dismissed'] ? now() : null;
            $progress->welcome_seen_at ??= now();
        }
        if (array_key_exists('active_tour', $change)) {
            $progress->active_tour = $change['active_tour'];
            $progress->active_step = $change['active_tour'] ? (int) ($change['active_step'] ?? 0) : null;
        }
        if (! empty($change['completed_tour'])) {
            $tours = $tours->push($change['completed_tour'])->unique();
            if ($progress->active_tour === $change['completed_tour']) {
                $progress->active_tour = null;
                $progress->active_step = null;
            }
        }
        foreach ($change['completed_tasks'] ?? [] as $task) {
            $tasks->push($task);
        }
        if (! empty($change['uncompleted_task'])) {
            $tasks = $tasks->reject(fn ($t) => $t === $change['uncompleted_task']);
        }

        $progress->completed_tours = $tours->unique()->values()->all();
        $progress->completed_tasks = $tasks->unique()->values()->all();
        $progress->save();

        return $progress;
    }

    /** Start over: welcome, tours and checklist all fresh. */
    public function reset(OnboardingProgress $progress): OnboardingProgress
    {
        $progress->update([
            'welcome_seen_at' => null, 'dismissed_at' => null,
            'completed_tours' => [], 'completed_tasks' => [],
            'active_tour' => null, 'active_step' => null,
        ]);

        return $progress;
    }
}
