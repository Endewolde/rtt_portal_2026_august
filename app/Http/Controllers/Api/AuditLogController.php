<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('audit_logs.view_any')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $excludeSuperAdmin = function ($q) {
            $q->whereNull('actor_id')
                ->orWhereHas('actor', fn ($a) => $a->whereDoesntHave('roles', fn ($r) => $r->where('name', 'super_admin')));
        };

        $query = AuditLog::with(['actor:id,name,email,avatar', 'actor.roles:id,name'])
            ->orderByDesc('created_at')
            ->where($excludeSuperAdmin);

        if ($event = $request->query('event')) {
            $query->where('event', $event);
        }

        if ($actorId = $request->query('actor_id')) {
            $query->where('actor_id', $actorId);
        }

        if ($type = $request->query('auditable_type')) {
            $query->where('auditable_type', 'like', '%'.$type.'%');
        }

        if ($from = $request->query('date_from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->query('date_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($q = $request->query('q')) {
            $query->where(function ($sub) use ($q) {
                $sub->where('ip_address', 'like', "%{$q}%")
                    ->orWhere('event', 'like', "%{$q}%")
                    ->orWhereHas('actor', fn ($a) => $a
                        ->where('name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%"));
            });
        }

        // per_page: caller may request 25, 50, or 100; default 50
        $perPage = min((int) ($request->query('per_page', 50)), 100);

        // Category-to-prefix map
        $categoryPrefixes = [
            'auth' => ['user.login', 'user.logout', 'user.registered', 'user.impersonation', 'user.session'],
            'proposals' => ['proposal'],
            'people' => ['user.created', 'user.updated', 'user.deleted', 'user.status', 'user.role', 'user.roles', 'user.bulk', 'user.imported', 'role'],
            'finance' => ['budget', 'award', 'settlement', 'disbursement'],
            'system' => ['setting', 'feature', 'college', 'department', 'repository', 'thematic'],
            'monitoring' => ['midterm', 'completion', 'research'],
        ];

        if ($category = $request->query('category')) {
            $prefixes = $categoryPrefixes[$category] ?? [];
            if ($prefixes) {
                $query->where(function ($q) use ($prefixes) {
                    foreach ($prefixes as $prefix) {
                        $q->orWhere('event', 'like', "{$prefix}%");
                    }
                });
            }
        }

        // Lightweight stats (last 30 days, excluding super_admin)
        $statsBase = AuditLog::where('created_at', '>=', now()->subDays(30))
            ->where($excludeSuperAdmin);

        $topActors = (clone $statsBase)
            ->whereNotNull('actor_id')
            ->selectRaw('actor_id, COUNT(*) as total')
            ->groupBy('actor_id')
            ->orderByDesc('total')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                $user = User::select('id', 'name', 'email', 'avatar')
                    ->with('roles:id,name')
                    ->find($row->actor_id);

                return ['user' => $user, 'total' => $row->total];
            });

        $stats = [
            'today' => (clone $statsBase)->whereDate('created_at', today())->count(),
            'this_week' => (clone $statsBase)->where('created_at', '>=', now()->startOfWeek())->count(),
            'unique_actors' => (clone $statsBase)->whereNotNull('actor_id')->distinct('actor_id')->count('actor_id'),
            'by_event' => (clone $statsBase)
                ->selectRaw('event, COUNT(*) as count')
                ->groupBy('event')
                ->orderByDesc('count')
                ->pluck('count', 'event'),
            'top_actors' => $topActors,
            'by_category' => collect($categoryPrefixes)->map(function ($prefixes) use ($statsBase) {
                return (clone $statsBase)->where(function ($q) use ($prefixes) {
                    foreach ($prefixes as $p) {
                        $q->orWhere('event', 'like', "{$p}%");
                    }
                })->count();
            }),
        ];

        return response()->json([
            'data' => $query->paginate($perPage),
            'message' => 'Audit logs retrieved.',
            'errors' => [],
            'meta' => ['stats' => $stats],
        ]);
    }
}
