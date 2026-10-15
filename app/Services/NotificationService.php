<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendTelegramNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    /**
     * Send a notification through all channels enabled for this user.
     * In-app storage is synchronous; email/Telegram are queued when a worker is running,
     * otherwise sent straight after the response (see DispatchesToWorkerWhenAlive).
     *
     * @param  string  $event  e.g. 'submission_success'
     * @param  array  $data  Event-specific payload
     */
    public function send(string $event, User $recipient, array $data): void
    {
        $prefs = DB::table('notification_preferences')
            ->where('user_id', $recipient->id)
            ->first();

        $emailEnabled = $prefs ? (bool) $prefs->email_enabled : true;
        $telegramEnabled = $prefs ? (bool) $prefs->telegram_enabled : true;
        $inAppEnabled = $prefs ? (bool) $prefs->inapp_enabled : true;

        if ($emailEnabled && $recipient->email) {
            SendEmailNotificationJob::deliver($recipient, $event, $data);
        }

        if ($telegramEnabled && $recipient->telegram_chat_id) {
            SendTelegramNotificationJob::deliver($recipient->telegram_chat_id, $event, $data);
        }

        if ($inAppEnabled) {
            StoreInAppNotificationJob::dispatchSync($recipient->id, $event, $data);
        }
    }

    /**
     * Send to multiple recipients at once.
     *
     * @param  array  $recipients  Array of User models
     */
    public function sendToMany(string $event, array $recipients, array $data): void
    {
        foreach ($recipients as $recipient) {
            $this->send($event, $recipient, $data);
        }
    }

    /**
     * Get unread in-app notifications for a user.
     */
    public function getUnread(User $user, int $limit = 20): Collection
    {
        return DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->whereNull('read_at')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * Mark notifications as read. Empty array = mark all as read.
     */
    public function markAsRead(User $user, array $notificationIds = []): void
    {
        $query = DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->whereNull('read_at');

        if (! empty($notificationIds)) {
            $query->whereIn('id', $notificationIds);
        }

        $query->update(['read_at' => now()]);
    }
}
