<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
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

        // Lightweight stats (last 30 days, excluding super_admin)
        $statsBase = AuditLog::where('created_at', '>=', now()->subDays(30))
            ->where($excludeSuperAdmin);

        $stats = [
            'today' => (clone $statsBase)->whereDate('created_at', today())->count(),
            'this_week' => (clone $statsBase)->where('created_at', '>=', now()->startOfWeek())->count(),
            'unique_actors' => (clone $statsBase)->whereNotNull('actor_id')->distinct('actor_id')->count('actor_id'),
            'by_event' => (clone $statsBase)
                ->selectRaw('event, COUNT(*) as count')
                ->groupBy('event')
                ->pluck('count', 'event'),
        ];

        return response()->json([
            'data' => $query->paginate(50),
            'message' => 'Audit logs retrieved.',
            'errors' => [],
            'meta' => ['stats' => $stats],
        ]);
    }
}
