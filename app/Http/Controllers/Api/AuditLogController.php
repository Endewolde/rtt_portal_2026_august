<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Proposal;
use App\Models\User;
use App\Support\AuditPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    /**
     * Each tab is a set of event patterns (SQL LIKE). A pattern without a wildcard
     * matches as a prefix, so "proposal" covers proposal.created, proposal.approved…
     */
    private const CATEGORIES = [
        'auth' => ['user.login', 'user.logout', 'user.registered', 'user.impersonation', 'user.session', 'user.2fa', 'user.password', 'user.account_locked'],
        'security' => ['%.denied', 'user.login_failed', 'user.login_blocked', 'user.account_locked', 'user.2fa_failed', 'user.impersonation', 'role.permissions'],
        'data' => ['%.exported', '%.downloaded'],
        'proposals' => ['proposal', 'review', 'defence', 'appeal', 'validation', 'abstract', 'conference'],
        'people' => ['user.created', 'user.updated', 'user.deleted', 'user.status', 'user.role', 'user.roles', 'user.bulk', 'user.imported', 'user.super_admin', 'role'],
        'finance' => ['budget', 'award', 'settlement', 'disbursement', 'funding', 'external_fund', 'call_college_budget'],
        'system' => ['setting', 'feature', 'college', 'department', 'repository', 'thematic', 'programme', 'integration'],
        'monitoring' => ['midterm', 'completion', 'research', 'ongoing', 'no_cost', 'deadline_extension'],
    ];

    /**
     * Super-admin activity is recorded like everyone else's but, by design, kept out
     * of this screen and its export for every viewer (super admins included).
     */
    private function visible(Request $request): Builder
    {
        return AuditLog::query()->where(fn ($q) => $q->whereNull('actor_id')
            ->orWhereHas('actor', fn ($a) => $a->whereDoesntHave('roles', fn ($r) => $r->where('name', 'super_admin'))));
    }

    /** @param  list<string>  $patterns */
    private function matchingEvents(Builder $query, array $patterns): Builder
    {
        return $query->where(function ($q) use ($patterns) {
            foreach ($patterns as $pattern) {
                $q->orWhere('event', 'like', str_contains($pattern, '%') ? $pattern : "{$pattern}%");
            }
        });
    }

    /**
     * Shared filtering for the list and the export, so a download always holds
     * exactly the rows on screen.
     */
    private function filteredQuery(Request $request): Builder
    {
        $query = $this->visible($request)
            ->with(['actor:id,name,email,avatar', 'actor.roles:id,name'])
            ->orderByDesc('created_at');

        if ($event = $request->query('event')) {
            $query->where('event', $event);
        }

        // "proposal" → every proposal.* event
        if ($resource = $request->query('resource')) {
            $query->where('event', 'like', $resource.'.%');
        }

        if ($actorId = $request->query('actor_id')) {
            $query->where('actor_id', $actorId);
        }

        if ($type = $request->query('auditable_type')) {
            $query->where('auditable_type', 'like', '%'.$type.'%');
        }

        if ($recordId = $request->query('auditable_id')) {
            $query->where('auditable_id', $recordId);
        }

        if ($from = $request->query('date_from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->query('date_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($q = trim((string) $request->query('q'))) {
            $query->where(function ($sub) use ($q) {
                $sub->where('ip_address', 'like', "%{$q}%")
                    ->orWhere('event', 'like', "%{$q}%")
                    ->orWhere('auditable_id', $q)
                    ->orWhere('url', 'like', "%{$q}%")
                    ->orWhere('new_values', 'like', "%{$q}%")
                    // Typing a proposal title or a person finds everything done to them too.
                    ->orWhereIn('auditable_id', Proposal::withTrashed()->where('title', 'like', "%{$q}%")->limit(200)->pluck('id'))
                    ->orWhereIn('auditable_id', User::withTrashed()->where(fn ($u) => $u->where('name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%"))->limit(200)->pluck('id'))
                    ->orWhereHas('actor', fn ($a) => $a
                        ->where('name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%"));
            });
        }

        if (($category = $request->query('category')) && isset(self::CATEGORIES[$category])) {
            $this->matchingEvents($query, self::CATEGORIES[$category]);
        }

        return $query;
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('audit_logs.view_any')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $perPage = in_array((int) $request->query('per_page'), [25, 50, 100], true) ? (int) $request->query('per_page') : 50;

        // Last 30 days, with the same visibility as the list.
        $recent = fn () => $this->visible($request)->where('created_at', '>=', now()->subDays(30));

        $top = $recent()->whereNotNull('actor_id')
            ->selectRaw('actor_id, COUNT(*) as total')
            ->groupBy('actor_id')
            ->orderByDesc('total')
            ->limit(5)
            ->get();
        $people = User::select('id', 'name', 'email', 'avatar')->with('roles:id,name')
            ->whereIn('id', $top->pluck('actor_id'))->get()->keyBy('id');

        $byEvent = $recent()->selectRaw('event, COUNT(*) as count')->groupBy('event')->orderByDesc('count')->pluck('count', 'event');

        $stats = [
            'today' => $recent()->whereDate('created_at', today())->count(),
            'this_week' => $recent()->where('created_at', '>=', now()->startOfWeek())->count(),
            'total_30d' => (int) $byEvent->sum(),
            'unique_actors' => $recent()->whereNotNull('actor_id')->distinct('actor_id')->count('actor_id'),
            'denied_30d' => $this->matchingEvents($recent(), ['%.denied'])->count(),
            'failed_logins_30d' => $this->matchingEvents($recent(), ['user.login_failed', 'user.2fa_failed', 'user.account_locked'])->count(),
            'exports_30d' => $this->matchingEvents($recent(), self::CATEGORIES['data'])->count(),
            'by_event' => $byEvent,
            // For the "type of record" filter: proposal, user, setting…
            'resources' => $byEvent->keys()->map(fn ($e) => explode('.', $e)[0])->unique()->sort()->values(),
            'top_actors' => $top->map(fn ($row) => ['user' => $people->get($row->actor_id), 'total' => (int) $row->total])
                ->filter(fn ($row) => $row['user'])->values(),
            'by_category' => collect(self::CATEGORIES)->map(fn ($patterns) => $this->matchingEvents($recent(), $patterns)->count()),
        ];

        $actor = $request->query('actor_id')
            ? User::withTrashed()->select('id', 'name', 'email', 'avatar', 'last_login_at')->with('roles:id,name')->find($request->query('actor_id'))
            : null;

        $page = $this->filteredQuery($request)->paginate($perPage);
        (new AuditPresenter)->present($page->getCollection());

        return response()->json([
            'data' => $page,
            'message' => 'Audit logs retrieved.',
            'errors' => [],
            'meta' => [
                'stats' => $stats,
                'actor' => $actor,
                'includes_super_admins' => false,
            ],
        ]);
    }

    /**
     * CSV of the filtered log. The export itself is recorded (audit_logs.exported)
     * by the audit middleware, like every other export.
     */
    public function export(Request $request): StreamedResponse
    {
        abort_unless($request->user()?->can('audit_logs.view_any'), 403, 'Forbidden.');

        $query = $this->filteredQuery($request);

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['When', 'Who', 'Email', 'What happened', 'Record', 'Details', 'Outcome', 'Event', 'IP Address', 'Device']);

            // Streamed in batches so a large log never has to fit in memory; each batch is
            // translated into names and plain language like the screen.
            $query->chunk(500, function ($batch) use ($handle): void {
                (new AuditPresenter)->present($batch);
                foreach ($batch as $log) {
                    fputcsv($handle, [
                        $log->created_at?->format('Y-m-d H:i:s'),
                        $log->actor?->name ?? 'System',
                        $log->actor?->email ?? '',
                        $log->description,
                        trim(Str::ucfirst($log->subject['type']).' '.($log->subject['name'] ?? '')),
                        collect($log->changes)->map(fn ($c) => $c['field'].': '.($c['from'] !== null ? $c['from'].' → ' : '').($c['to'] ?? '—'))->implode(' | '),
                        $log->status_code,
                        $log->event,
                        $log->ip_address,
                        $log->user_agent,
                    ]);
                }
            });

            fclose($handle);
        }, 'audit_log_'.now()->format('Y-m-d_His').'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-cache',
        ]);
    }
}
