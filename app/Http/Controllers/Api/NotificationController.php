<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function __construct(private NotificationService $service) {}

    /**
     * Paginated list of all notifications (read + unread).
     * Pass ?unread=1 to filter to unread only.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $perPage = min((int) $request->get('per_page', 20), 50);

        $query = DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->orderByDesc('created_at');

        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $paginated = $query->paginate($perPage);

        $items = collect($paginated->items())->map(function ($n) {
            $n->data = is_string($n->data) ? json_decode($n->data, true) : $n->data;

            return $n;
        });

        $unreadCount = DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => $items,
            'meta' => [
                'total' => $paginated->total(),
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    public function markAsRead(Request $request): JsonResponse
    {
        $this->service->markAsRead($request->user(), $request->input('ids', []));

        return response()->json(['message' => 'Notifications marked as read.']);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $this->service->markAsRead($request->user(), []);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['data' => ['count' => $count]]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        DB::table('notifications')
            ->where('id', $id)
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Notification deleted.']);
    }

    public function destroyRead(Request $request): JsonResponse
    {
        DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $request->user()->id)
            ->whereNotNull('read_at')
            ->delete();

        return response()->json(['message' => 'Read notifications cleared.']);
    }

    public function preferences(Request $request): JsonResponse
    {
        // firstOrCreate()'s in-memory instance won't reflect column defaults (e.g.
        // digest_frequency) on a freshly inserted row — refresh from the DB to be sure.
        $prefs = NotificationPreference::firstOrCreate(['user_id' => $request->user()->id])->fresh();

        return response()->json(['data' => $prefs]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email_enabled' => ['sometimes', 'boolean'],
            'inapp_enabled' => ['sometimes', 'boolean'],
            'sms_enabled' => ['sometimes', 'boolean'],
            'digest_frequency' => ['sometimes', 'in:realtime,daily,weekly'],
        ]);

        $prefs = NotificationPreference::firstOrCreate(['user_id' => $request->user()->id]);
        $prefs->update($validated);

        return response()->json(['data' => $prefs->fresh(), 'message' => 'Notification preferences updated.']);
    }
}
