<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\MailConfigService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendEmailNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        public User $recipient,
        public string $event,
        public array $data
    ) {
        $this->onQueue('notifications');
    }

    public function handle(): void
    {
        app(MailConfigService::class)->applyFromDatabase();

        $subject = $this->getSubject();
        $template = $this->getTemplate();

        try {
            Mail::send(
                "emails.notifications.{$template}",
                array_merge($this->data, ['recipient' => $this->recipient]),
                function ($message) use ($subject) {
                    $message->to($this->recipient->email, $this->recipient->name)
                        ->subject($subject);
                }
            );
        } catch (\Exception $e) {
            Log::error("Email notification failed for event {$this->event}", [
                'recipient' => $this->recipient->email,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function getSubject(): string
    {
        return match ($this->event) {
            'submission_success' => 'Proposal Submitted Successfully — '.($this->data['tracker_number'] ?? ''),
            'deadline_reminder' => 'Proposal Call Deadline Reminder — '.($this->data['days_remaining'] ?? '').' days remaining',
            'review_assignment' => 'New Review Assignment — Action Required',
            'decision_result' => 'Proposal Decision: '.ucfirst($this->data['decision'] ?? ''),
            'complaint_response' => 'Your Complaint Has Been Responded To',
            'award_approval' => 'Congratulations — Your Proposal Has Been Funded',
            'budget_allocated' => 'Budget Allocated to Your Proposal',
            'settlement_verified' => 'Settlement Verified — Next Round Available',
            'signature_requested' => 'Signature Required — Budget Request Round '.($this->data['round_number'] ?? ''),
            'team_restructured' => 'Team Update — Proposal '.($this->data['tracker_number'] ?? ''),
            'co_investigator_notified' => 'Co-Investigator Invitation — '.($this->data['tracker_number'] ?? ''),
            'budget_request_approved' => 'Budget Request Approved — '.($this->data['tracker_number'] ?? ''),
            default => 'RTT Platform Notification',
        };
    }

    private function getTemplate(): string
    {
        return match ($this->event) {
            'submission_success' => 'submission_success',
            'deadline_reminder' => 'deadline_reminder',
            'review_assignment' => 'review_assignment',
            'decision_result' => 'decision_result',
            'complaint_response' => 'complaint_response',
            'award_approval' => 'award_approval',
            'budget_allocated' => 'budget_allocated',
            'settlement_verified' => 'settlement_verified',
            'signature_requested' => 'signature_requested',
            'team_restructured' => 'team_restructured',
            'co_investigator_notified' => 'co_investigator_notified',
            'budget_request_approved' => 'budget_request_approved',
            default => 'generic',
        };
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Email notification job permanently failed', [
            'event' => $this->event,
            'recipient' => $this->recipient->email,
            'error' => $exception->getMessage(),
        ]);
    }
}
