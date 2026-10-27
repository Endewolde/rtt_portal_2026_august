<?php

namespace App\Services;

use App\Jobs\SendRawMailJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Broadcast email: who an audience reaches (everyone, roles, colleges, chosen people,
 * or a ready-made group), sending to them in the background, and the record of what
 * was sent.
 */
class BroadcastService
{
    /** Ready-made groups, with what each one means. */
    public const SEGMENTS = [
        'running_pis' => 'PIs of running funded projects',
        'all_pis' => 'Everyone who has submitted a proposal',
        'reviewers_pending' => 'Reviewers with reviews still to do',
        'officers' => 'Office staff (every non-researcher role)',
    ];

    /** Roles that only act on their own work. */
    private const PERSONAL_ROLES = ['staff', 'pi', 'reviewer', 'external_reviewer', 'guest'];

    /**
     * The active users an audience reaches.
     *
     * @param  array<string, mixed>  $audience
     * @return Collection<int, User>
     */
    public function recipients(array $audience): Collection
    {
        $query = User::query()->where('status', 'active')->whereNotNull('email')->where('email', '!=', '');
        $roles = array_values(array_filter((array) ($audience['roles'] ?? ($audience['role'] ?? []))));
        $colleges = array_values(array_filter((array) ($audience['college_ids'] ?? ($audience['college_id'] ?? []))));

        match ($audience['to'] ?? 'all') {
            'all' => null,
            'by_role' => $query->whereHas('roles', fn ($q) => $q->whereIn('name', $roles ?: ['__none__'])),
            'by_college' => $query->whereIn('college_id', $colleges ?: ['__none__']),
            'specific' => $this->specific($query, $audience),
            'segment' => $this->segment($query, (string) ($audience['segment'] ?? '')),
            default => $query->whereRaw('1 = 0'),
        };

        // Roles and groups can be narrowed to colleges too ("college officers of the College of Health").
        if (in_array($audience['to'] ?? 'all', ['by_role', 'segment'], true) && $colleges) {
            $query->whereIn('college_id', $colleges);
        }

        return $query->orderBy('name')->get(['id', 'name', 'email', 'college_id']);
    }

    /**
     * Send the broadcast in the background (queued when the worker runs, otherwise right
     * after the response), optionally also as an in-app notification, and record it.
     *
     * @param  Collection<int, User>  $recipients
     * @param  array<string, mixed>  $audience
     */
    public function send(Collection $recipients, string $subject, string $message, User $sender, array $audience, bool $inApp = false): void
    {
        foreach ($recipients as $user) {
            try {
                SendRawMailJob::deliver(
                    view('emails.broadcast', [
                        'recipientName' => $user->name,
                        'subject' => $subject,
                        'body' => $message,
                        'senderName' => config('mail.from.name'),
                    ])->render(),
                    $user->email,
                    $user->name,
                    $subject,
                );
                if ($inApp) {
                    StoreInAppNotificationJob::dispatchSync($user->id, 'broadcast', [
                        'title' => $subject,
                        'message' => trim(preg_replace('/\s+/', ' ', strip_tags($message))),
                    ]);
                }
            } catch (\Throwable $e) {
                Log::error("Broadcast to {$user->email} failed: {$e->getMessage()}");
            }
        }

        AuditLogger::log('broadcast.sent', User::class, $sender->id, $sender->id, null, [
            'subject' => $subject,
            'audience' => $this->describe($audience),
            'recipients' => $recipients->count(),
            'in_app' => $inApp,
        ]);
    }

    /**
     * The latest broadcasts, newest first.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function history(int $limit = 15): Collection
    {
        return DB::table('audit_logs as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.actor_id')
            ->where('a.event', 'broadcast.sent')
            ->orderByDesc('a.created_at')
            ->limit($limit)
            ->get(['a.id', 'a.new_values', 'a.created_at', 'u.name as sender'])
            ->map(function ($row) {
                $v = json_decode($row->new_values ?? '{}', true) ?: [];

                return [
                    'id' => $row->id,
                    'subject' => $v['subject'] ?? '—',
                    'audience' => $v['audience'] ?? '—',
                    'recipients' => (int) ($v['recipients'] ?? 0),
                    'in_app' => (bool) ($v['in_app'] ?? false),
                    'sender' => $row->sender,
                    'sent_at' => $row->created_at,
                ];
            });
    }

    /** @param array<string, mixed> $audience */
    public function describe(array $audience): string
    {
        $roles = (array) ($audience['roles'] ?? ($audience['role'] ?? []));
        $colleges = (array) ($audience['college_ids'] ?? ($audience['college_id'] ?? []));
        $collegeNames = $colleges ? DB::table('colleges')->whereIn('id', $colleges)->pluck('name')->implode(', ') : null;
        $within = $collegeNames ? " in {$collegeNames}" : '';

        return match ($audience['to'] ?? 'all') {
            'all' => 'All active users',
            'by_role' => 'Roles: '.implode(', ', array_map(fn ($r) => str($r)->headline(), array_filter($roles))).$within,
            'by_college' => 'Colleges: '.($collegeNames ?: '—'),
            'specific' => 'Chosen people',
            'segment' => (self::SEGMENTS[$audience['segment'] ?? ''] ?? 'Group').$within,
            default => '—',
        };
    }

    /** @param array<string, mixed> $audience */
    private function specific(Builder $query, array $audience): void
    {
        $ids = array_values(array_filter((array) ($audience['user_ids'] ?? [])));
        $email = $audience['email'] ?? null;

        $query->where(function ($q) use ($ids, $email) {
            $q->whereIn('id', $ids ?: ['__none__']);
            if ($email) {
                $q->orWhere('email', $email);
            }
        });
    }

    private function segment(Builder $query, string $segment): void
    {
        match ($segment) {
            'running_pis' => $query->whereIn('id', Proposal::whereIn('status', ['funded', 'midterm_evaluation'])->select('pi_user_id')),
            'all_pis' => $query->whereIn('id', Proposal::whereNotIn('status', ['draft'])->whereNotNull('submitted_at')->select('pi_user_id')),
            'reviewers_pending' => $query->whereIn('id', DB::table('review_assignments')->whereIn('status', ['pending', 'accepted', 'in_progress'])->select('reviewer_id')),
            'officers' => $query->whereHas('roles', fn ($q) => $q->whereNotIn('name', self::PERSONAL_ROLES)),
            default => $query->whereRaw('1 = 0'),
        };
    }
}
