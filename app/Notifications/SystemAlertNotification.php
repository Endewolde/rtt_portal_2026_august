<?php

namespace App\Notifications;

use App\Mail\SystemAlertMail;
use Illuminate\Notifications\Notification;

class SystemAlertNotification extends Notification
{
    public function __construct(
        public readonly string $alertType,
        public readonly string $severity,
        public readonly string $message,
        public readonly ?array $context = null,
        public readonly ?string $anomalyType = null,
    ) {}

    public function via(object $notifiable): array
    {
        $prefs = $notifiable->alert_preferences ?? [];
        $channels = ['database'];

        $emailEnabled = $prefs['email_enabled'] ?? true;
        if ($emailEnabled && $notifiable->email) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail(object $notifiable): SystemAlertMail
    {
        return new SystemAlertMail(
            user: $notifiable,
            alertType: $this->alertType,
            severity: $this->severity,
            alertMessage: $this->message,
            context: $this->context,
            anomalyType: $this->anomalyType,
            isAnomaly: $this->anomalyType !== null,
        );
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'system_alert',
            'alert_type' => $this->alertType,
            'severity' => $this->severity,
            'message' => $this->message,
            'context' => $this->context,
            'anomaly_type' => $this->anomalyType,
            'url' => '/admin/system-monitor',
        ];
    }
}
