<?php

namespace App\Services;

use App\Jobs\SendRawMailJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\DataDeletionRequest;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Personal data: a user can download what the system holds about them and ask for it to
 * be removed. Removal anonymises the account — proposals, reviews and decisions stay as
 * institutional records but no longer identify the person. Retention rules clean up
 * stale data automatically once an admin switches them on.
 */
class PersonalDataService
{
    /** Proposal statuses where a person still has obligations, so they can't be removed yet. */
    private const OPEN_STATUSES = ['submitted', 'validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence', 'accepted', 'funded', 'midterm_evaluation'];

    private const ADMIN_ROLES = ['super_admin', 'admin'];

    /** @return array<string, mixed> */
    public function export(User $user): array
    {
        $user->loadMissing(['roles:name', 'college:id,name', 'department:id,name']);

        $memberships = DB::table('proposal_members as m')
            ->join('proposals as p', 'p.id', '=', 'm.proposal_id')
            ->where('m.user_id', $user->id)
            ->whereNull('p.deleted_at')
            ->get(['p.tracker_number', 'p.title', 'p.status', 'm.role', 'm.status as membership_status', 'm.joined_at']);

        return [
            'exported_at' => now()->toIso8601String(),
            'profile' => [
                'name' => $user->name,
                'title' => $user->title,
                'email' => $user->email,
                'phone' => $user->phone,
                'gender' => $user->gender,
                'employee_id' => $user->employee_id,
                'college' => $user->college?->name,
                'department' => $user->department?->name,
                'expertise' => $user->expertise,
                'roles' => $user->roles->pluck('name')->all(),
                'status' => $user->status,
                'two_factor_enabled' => (bool) $user->two_factor_enabled,
                'telegram_linked' => (bool) $user->telegram_chat_id,
                'registration_method' => $user->registration_method,
                'created_at' => $user->created_at?->toIso8601String(),
                'last_login_at' => $user->last_login_at?->toIso8601String(),
            ],
            'proposals_as_pi' => Proposal::where('pi_user_id', $user->id)
                ->get(['tracker_number', 'title', 'status', 'category', 'academic_year', 'submitted_at', 'created_at'])
                ->toArray(),
            'proposal_memberships' => $memberships->toArray(),
            // Which proposals they reviewed is not exported to keep blind review confidential
            // for the research teams; the reviewer's own scores and comments are theirs.
            'reviews' => DB::table('review_assignments as ra')
                ->join('evaluation_types as et', 'et.id', '=', 'ra.evaluation_type_id')
                ->where('ra.reviewer_id', $user->id)
                ->get(['et.label as review_type', 'ra.status', 'ra.assigned_at', 'ra.due_date', 'ra.submitted_at'])
                ->toArray(),
            'notifications' => DB::table('notifications')
                ->where('notifiable_id', $user->id)
                ->orderByDesc('created_at')
                ->limit(1000)
                ->get(['type', 'data', 'read_at', 'created_at'])
                ->map(fn ($n) => ['type' => $n->type, 'data' => json_decode((string) $n->data, true), 'read_at' => $n->read_at, 'created_at' => $n->created_at])
                ->toArray(),
            'deletion_requests' => DataDeletionRequest::where('user_id', $user->id)->get(['reason', 'status', 'created_at', 'handled_at', 'admin_note'])->toArray(),
        ];
    }

    /** @throws \RuntimeException */
    public function requestDeletion(User $user, ?string $reason): DataDeletionRequest
    {
        if (DataDeletionRequest::where('user_id', $user->id)->where('status', DataDeletionRequest::STATUS_PENDING)->exists()) {
            throw new \RuntimeException('You already have a deletion request waiting for review.');
        }

        $request = DataDeletionRequest::create(['user_id' => $user->id, 'reason' => $reason, 'status' => DataDeletionRequest::STATUS_PENDING]);

        foreach (User::role(self::ADMIN_ROLES)->where('status', 'active')->get() as $admin) {
            $this->notify($admin, 'data_deletion_requested', "{$user->name} asked for their personal data to be deleted.");
        }

        return $request;
    }

    /**
     * What has to be finished before someone's data can be removed.
     *
     * @return list<string>
     */
    public function blockers(User $user): array
    {
        $blockers = [];

        $open = Proposal::where('status', '!=', 'draft')
            ->whereIn('status', self::OPEN_STATUSES)
            ->where(fn ($q) => $q->where('pi_user_id', $user->id)
                ->orWhereIn('id', DB::table('proposal_members')->where('user_id', $user->id)->where('status', 'active')->select('proposal_id')))
            ->pluck('tracker_number');
        if ($open->isNotEmpty()) {
            $blockers[] = 'On proposals still in progress: '.$open->take(5)->implode(', ').($open->count() > 5 ? ' and '.($open->count() - 5).' more' : '');
        }

        $reviews = DB::table('review_assignments')->where('reviewer_id', $user->id)->whereIn('status', ['pending', 'accepted', 'in_progress'])->count();
        if ($reviews > 0) {
            $blockers[] = "{$reviews} review".($reviews === 1 ? '' : 's').' not finished';
        }

        $unsettled = DB::table('budget_requests as br')
            ->join('proposals as p', 'p.id', '=', 'br.proposal_id')
            ->where('p.pi_user_id', $user->id)
            ->where('br.status', 'disbursed')
            ->count();
        if ($unsettled > 0) {
            $blockers[] = "{$unsettled} budget release".($unsettled === 1 ? '' : 's').' not settled';
        }

        if ($user->hasRole('super_admin') && User::role('super_admin')->where('status', 'active')->count() <= 1) {
            $blockers[] = 'The only super admin';
        }

        return $blockers;
    }

    /** @throws \RuntimeException */
    public function approve(DataDeletionRequest $request, User $admin, ?string $note): DataDeletionRequest
    {
        $this->ensurePending($request);
        $user = $request->user;

        if ($blockers = $this->blockers($user)) {
            throw new \RuntimeException('This account cannot be removed yet: '.implode('; ', $blockers).'.');
        }

        $originalEmail = $user->email;
        $originalName = $user->name;

        DB::transaction(function () use ($user, $request, $admin, $note) {
            $this->anonymise($user);
            $request->update(['status' => DataDeletionRequest::STATUS_APPROVED, 'handled_by' => $admin->id, 'handled_at' => now(), 'admin_note' => $note]);
        });

        // The confirmation goes to the address they used, before it was removed.
        if ($originalEmail) {
            try {
                SendRawMailJob::deliver(
                    '<p>Dear '.e($originalName).',</p><p>As you requested, your personal data has been removed from the research platform. '
                    .'Records of proposals and reviews you took part in are kept by the university but no longer identify you.</p>',
                    $originalEmail,
                    $originalName,
                    'Your personal data has been removed',
                );
            } catch (\Throwable $e) {
                Log::error("Deletion confirmation email failed: {$e->getMessage()}");
            }
        }

        return $request->fresh();
    }

    /** @throws \RuntimeException */
    public function reject(DataDeletionRequest $request, User $admin, string $note): DataDeletionRequest
    {
        $this->ensurePending($request);
        $request->update(['status' => DataDeletionRequest::STATUS_REJECTED, 'handled_by' => $admin->id, 'handled_at' => now(), 'admin_note' => $note]);
        $this->notify($request->user, 'data_deletion_reviewed', "Your request to delete your personal data was not approved: {$note}");

        return $request->fresh();
    }

    /**
     * Remove what identifies the person; keep the row so proposals, reviews and decisions
     * they were part of stay intact (shown as "Deleted User").
     */
    public function anonymise(User $user): void
    {
        $user->forceFill([
            'name' => 'Deleted User',
            'title' => null,
            'email' => 'deleted-'.Str::lower(Str::random(12)).'@deleted.invalid',
            'phone' => null,
            'gender' => null,
            'avatar' => null,
            'expertise' => null,
            'employee_id' => null,
            'telegram_chat_id' => null,
            'telegram_link_token' => null,
            'oauth_provider' => null,
            'oauth_id' => null,
            'two_factor_enabled' => false,
            'alert_preferences' => null,
            'password' => Hash::make(Str::random(64)),
            'remember_token' => null,
            'status' => 'inactive',
        ])->save();

        $user->tokens()->delete();
        DB::table('notifications')->where('notifiable_id', $user->id)->delete();
        DB::table('notification_preferences')->where('user_id', $user->id)->delete();
        Proposal::where('pi_user_id', $user->id)->where('status', 'draft')->get()->each->delete();
    }

    /**
     * Apply the retention settings. Each rule is off (0) until an admin sets a number of days.
     *
     * @return array{drafts: int, notifications: int, accounts: int}
     */
    public function applyRetention(bool $dryRun = false): array
    {
        $days = DB::table('app_settings')
            ->whereIn('key', ['retention_draft_days', 'retention_read_notification_days', 'retention_inactive_account_days'])
            ->pluck('value', 'key')
            ->map(fn ($v) => max(0, (int) $v));

        $result = ['drafts' => 0, 'notifications' => 0, 'accounts' => 0];

        // Drafts that can no longer be submitted: their call closed N days ago and there's no extension.
        if ($draftDays = $days['retention_draft_days'] ?? 0) {
            $drafts = Proposal::where('status', 'draft')
                ->whereHas('proposalCall', fn ($q) => $q->whereDate('end_date', '<', now()->subDays($draftDays)))
                ->where(fn ($q) => $q->whereNull('extended_deadline')->orWhere('extended_deadline', '<', now()))
                ->where('tracker_number', 'like', 'DRAFT-%');
            $result['drafts'] = $drafts->count();
            if (! $dryRun) {
                $drafts->get()->each->delete();
            }
        }

        if ($notificationDays = $days['retention_read_notification_days'] ?? 0) {
            $notifications = DB::table('notifications')->whereNotNull('read_at')->where('created_at', '<', now()->subDays($notificationDays));
            $result['notifications'] = $dryRun ? $notifications->count() : $notifications->delete();
        }

        // Accounts nobody has used in N days are deactivated (an admin can reactivate them) — never admins.
        if ($accountDays = $days['retention_inactive_account_days'] ?? 0) {
            $cutoff = now()->subDays($accountDays);
            $accounts = User::where('status', 'active')
                ->whereDoesntHave('roles', fn ($q) => $q->whereIn('name', self::ADMIN_ROLES))
                ->where(fn ($q) => $q->where('last_activity_at', '<', $cutoff)
                    ->orWhere(fn ($q) => $q->whereNull('last_activity_at')->where('last_login_at', '<', $cutoff))
                    ->orWhere(fn ($q) => $q->whereNull('last_activity_at')->whereNull('last_login_at')->where('created_at', '<', $cutoff)));
            $result['accounts'] = $dryRun ? $accounts->count() : $accounts->update(['status' => 'inactive']);
        }

        return $result;
    }

    private function ensurePending(DataDeletionRequest $request): void
    {
        if ($request->status !== DataDeletionRequest::STATUS_PENDING) {
            throw new \RuntimeException('This request has already been handled.');
        }
    }

    private function notify(User $user, string $event, string $message): void
    {
        try {
            StoreInAppNotificationJob::dispatchSync($user->id, $event, ['message' => $message]);
        } catch (\Throwable $e) {
            Log::error("Personal data notification ({$event}) failed: {$e->getMessage()}");
        }
    }
}
