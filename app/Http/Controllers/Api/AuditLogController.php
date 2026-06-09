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

        $query = AuditLog::with('actor:id,name,email,avatar')
            ->orderByDesc('created_at');

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
                    ->orWhereHas('actor', fn ($a) => $a
                        ->where('name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%"));
            });
        }

        return response()->json([
            'data' => $query->paginate(50),
            'message' => 'Audit logs retrieved.',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
