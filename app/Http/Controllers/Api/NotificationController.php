<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function __construct(private NotificationService $service) {}

    public function index(Request $request): JsonResponse
    {
        $notifications = $this->service->getUnread($request->user(), 20);

        return response()->json(['data' => $notifications]);
    }

    public function markAsRead(Request $request): JsonResponse
    {
        $this->service->markAsRead($request->user(), $request->input('ids', []));

        return response()->json(['message' => 'Notifications marked as read.']);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = DB::table('notifications')
            ->where('notifiable_type', \App\Models\User::class)
            ->where('notifiable_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['data' => ['count' => $count]]);
    }
}
