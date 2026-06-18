<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SystemAlertMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly object $user,
        public readonly string $alertType,
        public readonly string $severity,
        public readonly string $alertMessage,
        public readonly ?array $context,
        public readonly ?string $anomalyType,
        public readonly bool $isAnomaly,
    ) {}

    public function envelope(): Envelope
    {
        $severityLabel = ucfirst($this->severity);
        $subject = $this->isAnomaly
            ? "[RTT] Anomaly Detected: {$this->alertMessage}"
            : "[RTT] System Alert ({$severityLabel}): {$this->alertMessage}";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.system-alert',
            with: [
                'user' => $this->user,
                'alertType' => $this->alertType,
                'severity' => $this->severity,
                'severityLabel' => ucfirst($this->severity),
                'alertMessage' => $this->alertMessage,
                'context' => $this->context,
                'anomalyType' => $this->anomalyType,
                'isAnomaly' => $this->isAnomaly,
                'dashboardUrl' => url('/admin/system-monitor'),
            ],
        );
    }
}
