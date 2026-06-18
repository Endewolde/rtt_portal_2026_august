<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
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

    public function toMail(object $notifiable): MailMessage
    {
        $severityLabel = ucfirst($this->severity);
        $isAnomaly = $this->anomalyType !== null;
        $subject = $isAnomaly
            ? "[RTT] Anomaly Detected: {$this->message}"
            : "[RTT] System Alert ({$severityLabel}): {$this->message}";

        return (new MailMessage)->view(
            'emails.system-alert',
            [
                'user' => $notifiable,
                'alertType' => $this->alertType,
                'severity' => $this->severity,
                'severityLabel' => $severityLabel,
                'alertMessage' => $this->message,
                'context' => $this->context,
                'anomalyType' => $this->anomalyType,
                'isAnomaly' => $isAnomaly,
                'dashboardUrl' => url('/admin/system-monitor'),
            ]
        )->subject($subject);
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
