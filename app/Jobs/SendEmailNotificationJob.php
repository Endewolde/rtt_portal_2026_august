<?php

namespace App\Jobs;

use App\Models\EmailLog;
use App\Models\NotificationPreference;
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
        // Users who opted into a digest get this notification summarized later
        // (see SendNotificationDigests) instead of an individual real-time email —
        // it was already stored as an in-app notification regardless of this setting.
        $digestFrequency = NotificationPreference::where('user_id', $this->recipient->id)
            ->value('digest_frequency');

        if (in_array($digestFrequency, ['daily', 'weekly'], true)) {
            return;
        }

        app(MailConfigService::class)->applyFromDatabase();

        $subject = $this->getSubject();
        $template = $this->getTemplate();

        try {
            Mail::send(
                "emails.notifications.{$template}",
                // 'message' is reserved by Mail::send() for the Message object.
                array_merge($this->data, [
                    'recipient' => $this->recipient,
                    'notification_message' => $this->data['message'] ?? null,
                ]),
                function ($message) use ($subject) {
                    $message->to($this->recipient->email, $this->recipient->name)
                        ->subject($subject);
                    $message->getSymfonyMessage()->getHeaders()->addTextHeader(EmailLog::SOURCE_HEADER, $this->event);
                }
            );
        } catch (\Exception $e) {
            EmailLog::failed($this->recipient->email, $subject, $this->event, $e);
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
            'review_deadline_reminder' => (($this->data['days_remaining'] ?? 0) < 0
                ? 'Review Overdue — '.($this->data['tracker_number'] ?? '')
                : 'Review Due Soon — '.($this->data['tracker_number'] ?? '')),
            'decision_result' => 'Proposal Decision: '.ucfirst($this->data['decision'] ?? ''),
            'complaint_response' => 'Your Complaint Has Been Responded To',
            'award_approval' => 'Congratulations — Your Proposal Has Been Funded',
            'budget_allocated' => 'Budget Allocated to Your Proposal',
            'settlement_verified' => 'Settlement Verified — Next Round Available',
            'signature_requested' => 'Signature Required — Budget Request Round '.($this->data['round_number'] ?? ''),
            'team_restructured' => 'Team Update — Proposal '.($this->data['tracker_number'] ?? ''),
            'co_investigator_notified' => 'Co-Investigator Invitation — '.($this->data['tracker_number'] ?? ''),
            'budget_request_approved' => 'Budget Request Approved — '.($this->data['tracker_number'] ?? ''),
            'central_eval_approved' => 'Proposal Advanced to Central Evaluation — '.($this->data['tracker_number'] ?? ''),
            'blind_review_passed_officer' => 'Open Defence Needed — '.($this->data['tracker_number'] ?? ''),
            'proposal_submitted_officer' => 'New Proposal Submitted — '.($this->data['tracker_number'] ?? ''),
            'appeal_submitted' => 'Appeal Received — '.($this->data['tracker_number'] ?? ''),
            'appeal_resolved' => 'Your Appeal Has Been Resolved — '.($this->data['tracker_number'] ?? ''),
            'deadline_extension_requested' => 'Deadline Extension Requested — '.($this->data['tracker_number'] ?? ''),
            'deadline_extension_resolved' => 'Your Deadline Extension Request Was '.ucfirst($this->data['decision'] ?? '').' — '.($this->data['tracker_number'] ?? ''),
            'ethical_clearance_submitted' => 'Ethical Clearance Submitted for Review — '.($this->data['tracker_number'] ?? ''),
            'ethical_clearance_resolved' => 'Ethical Clearance '.ucfirst($this->data['decision'] ?? '').' — '.($this->data['tracker_number'] ?? ''),
            'ethical_clearance_expiring' => 'Ethical Clearance Expiring Soon — '.($this->data['tracker_number'] ?? ''),
            'ethical_clearance_expired' => 'Ethical Clearance Has Expired — '.($this->data['tracker_number'] ?? ''),
            'budget_revision_requested' => 'Budget Revision Requested — '.($this->data['tracker_number'] ?? ''),
            'budget_revision_resolved' => 'Budget Revision '.ucfirst($this->data['decision'] ?? '').' — '.($this->data['tracker_number'] ?? ''),
            'no_cost_extension_requested' => 'No-Cost Extension Requested — '.($this->data['tracker_number'] ?? ''),
            'no_cost_extension_resolved' => 'No-Cost Extension '.ucfirst($this->data['decision'] ?? '').' — '.($this->data['tracker_number'] ?? ''),
            'review_assignment_cancelled' => 'Review Assignment Cancelled — '.($this->data['tracker_number'] ?? ''),
            'approval_report_submitted' => 'Possible Mistaken Approval Reported — '.($this->data['tracker_number'] ?? ''),
            'progress_report_due' => 'Progress Report Due Soon — '.($this->data['tracker_number'] ?? ''),
            'progress_report_overdue' => 'Progress Report Overdue — '.($this->data['tracker_number'] ?? ''),
            'progress_report_submitted' => 'Progress Report Submitted for Review — '.($this->data['tracker_number'] ?? ''),
            'progress_report_reviewed' => 'Your Progress Report Was Reviewed — '.($this->data['tracker_number'] ?? ''),
            'review_certificate_released' => 'Your Certificate of Review Service — '.($this->data['academic_year'] ?? ''),
            'review_certificate_revoked' => 'Certificate of Review Service Revoked — '.($this->data['academic_year'] ?? ''),
            'stage_reminder' => 'Action Needed — '.($this->data['tracker_number'] ?? '').' Is Waiting On You',
            'review_disagreement' => 'Blind Reviewers Disagree — Decision On Hold — '.($this->data['tracker_number'] ?? ''),
            'approval_report_resolved' => 'Your Mistaken-Approval Report Was Reviewed — '.($this->data['tracker_number'] ?? ''),
            'budget_request_submitted' => 'New Budget Request Submitted — '.($this->data['tracker_number'] ?? ''),
            'funding_revoked' => 'Funding Revoked — '.($this->data['tracker_number'] ?? ''),
            'contract_submitted' => 'Contract Submitted for Review — '.($this->data['tracker_number'] ?? ''),
            'contract_approved' => 'Research Contract Approved — '.($this->data['tracker_number'] ?? ''),
            'contract_rejected' => 'Contract Submission Returned — '.($this->data['tracker_number'] ?? ''),
            'defence_extension_requested' => 'Defence Score Deadline Extension Requested — '.($this->data['tracker_number'] ?? ''),
            'defence_extension_resolved' => 'Defence Deadline Extension '.ucfirst($this->data['decision'] ?? '').' — '.($this->data['tracker_number'] ?? ''),
            'defence_deadline_extended' => 'Defence Score Deadline Extended — '.($this->data['tracker_number'] ?? ''),
            'defence_deadline_reminder' => 'Defence Score Due Today — '.($this->data['tracker_number'] ?? ''),
            'defence_deadline_passed' => 'Defence Score Deadline Passed — '.($this->data['tracker_number'] ?? ''),
            default => 'RTT Platform Notification',
        };
    }

    private function getTemplate(): string
    {
        return match ($this->event) {
            'submission_success' => 'submission_success',
            'deadline_reminder' => 'deadline_reminder',
            'review_assignment' => 'review_assignment',
            'review_deadline_reminder' => 'review_deadline_reminder',
            'decision_result' => 'decision_result',
            'complaint_response' => 'complaint_response',
            'award_approval' => 'award_approval',
            'budget_allocated' => 'budget_allocated',
            'settlement_verified' => 'settlement_verified',
            'signature_requested' => 'signature_requested',
            'team_restructured' => 'team_restructured',
            'co_investigator_notified' => 'co_investigator_notified',
            'budget_request_approved' => 'budget_request_approved',
            'central_eval_approved' => 'decision_result',
            'proposal_submitted_officer' => 'decision_result',
            'blind_review_passed_officer' => 'generic',
            'appeal_submitted' => 'generic',
            'appeal_resolved' => 'decision_result',
            'deadline_extension_requested' => 'generic',
            'deadline_extension_resolved' => 'generic',
            'ethical_clearance_submitted' => 'generic',
            'ethical_clearance_resolved' => 'generic',
            'ethical_clearance_expiring' => 'generic',
            'ethical_clearance_expired' => 'generic',
            'budget_revision_requested' => 'generic',
            'budget_revision_resolved' => 'generic',
            'no_cost_extension_requested' => 'generic',
            'no_cost_extension_resolved' => 'generic',
            'review_assignment_cancelled' => 'generic',
            'approval_report_submitted' => 'generic',
            'budget_request_submitted' => 'generic',
            'funding_revoked' => 'decision_result',
            'contract_submitted' => 'generic',
            'contract_approved' => 'generic',
            'contract_rejected' => 'generic',
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
