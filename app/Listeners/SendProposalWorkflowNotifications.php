<?php

namespace App\Listeners;

use App\Events\ProposalTransitioned;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class SendProposalWorkflowNotifications
{
    public function handle(ProposalTransitioned $event): void
    {
        $proposal = $event->proposal->loadMissing(['pi', 'members.user']);

        match ($event->toStage) {
            'submitted' => $this->onSubmitted($proposal),
            'validated' => $this->onValidated($proposal),
            'accepted' => $this->onDecision($proposal, 'accepted'),
            'rejected' => $this->onDecision($proposal, 'rejected'),
            'funded' => $this->onFunded($proposal),
            'under_blind_review' => $this->onUnderReview($proposal, 'blind review'),
            'under_open_defence' => $this->onUnderReview($proposal, 'open defence'),
            default => null,
        };
    }

    // ── Stage handlers ────────────────────────────────────────────────────────

    private function onSubmitted(Proposal $proposal): void
    {
        $pi = $proposal->pi;
        $coIs = $this->coInvestigators($proposal);

        $baseData = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
        ];

        // PI: submission confirmation
        if ($pi) {
            $this->notify($pi, 'submission_success', $baseData, 'submission_success');
        }

        // Co-investigators: involvement notice
        foreach ($coIs as $coI) {
            $this->notify($coI, 'co_investigator_notified', array_merge($baseData, [
                'pi_name' => $pi?->name ?? 'the PI',
            ]), 'co_investigator_notified');
        }
    }

    private function onValidated(Proposal $proposal): void
    {
        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'decision' => 'validated',
            'reason' => 'Your proposal has passed the initial validation and will now proceed to the blind review phase.',
        ];

        foreach ($this->allRecipients($proposal) as $user) {
            $this->notify($user, 'decision_result', $data, 'decision_result');
        }
    }

    private function onDecision(Proposal $proposal, string $decision): void
    {
        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'decision' => $decision,
            'reason' => $decision === 'rejected' ? ($proposal->rejection_reason ?? null) : null,
        ];

        foreach ($this->allRecipients($proposal) as $user) {
            $this->notify($user, 'decision_result', $data, 'decision_result');
        }
    }

    private function onFunded(Proposal $proposal): void
    {
        // Award may not be created yet (GenerateAwardOnFunding runs in parallel);
        // load it if it exists, otherwise send without grant reference.
        $award = $proposal->load('award')->award;

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'grant_reference' => $award?->grant_reference ?? 'To be assigned',
            'awarded_amount' => $award?->awarded_amount,
        ];

        foreach ($this->allRecipients($proposal) as $user) {
            $this->notify($user, 'award_approval', $data, 'award_approval');
        }
    }

    private function onUnderReview(Proposal $proposal, string $phase): void
    {
        $pi = $proposal->pi;
        if (! $pi) {
            return;
        }

        $this->notify($pi, 'decision_result', [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'decision' => 'under review',
            'reason' => "Your proposal has entered the {$phase} phase. You will be notified of the outcome.",
        ], 'decision_result');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Active co-investigators as User models. */
    private function coInvestigators(Proposal $proposal): array
    {
        return $proposal->members
            ->where('role', 'co_investigator')
            ->where('status', 'active')
            ->map(fn ($m) => $m->user)
            ->filter()
            ->values()
            ->all();
    }

    /** PI + all active co-investigators. */
    private function allRecipients(Proposal $proposal): array
    {
        $recipients = [];

        if ($proposal->pi) {
            $recipients[] = $proposal->pi;
        }

        foreach ($this->coInvestigators($proposal) as $coI) {
            $recipients[] = $coI;
        }

        return $recipients;
    }

    /**
     * Send notification:
     * - Email synchronously (immediate delivery)
     * - In-app stored synchronously (appears in bell right away)
     */
    private function notify(User $user, string $event, array $data, string $template): void
    {
        $this->sendEmailNow($user, $template, $data);
        $this->storeInApp($user->id, $event, $data);
    }

    private function sendEmailNow(User $user, string $template, array $data): void
    {
        if (! $user->email) {
            return;
        }

        try {
            SendEmailNotificationJob::dispatch($user, $template, $data);
        } catch (\Exception $e) {
            Log::error("Failed to dispatch email notification [{$template}] to {$user->email}: ".$e->getMessage());
        }
    }

    private function storeInApp(string $userId, string $event, array $data): void
    {
        try {
            StoreInAppNotificationJob::dispatchSync($userId, $event, $data);
        } catch (\Exception $e) {
            Log::error("Failed to store in-app notification [{$event}]: ".$e->getMessage());
        }
    }

    private function resolveSubject(string $template, array $data): string
    {
        $tracker = $data['tracker_number'] ?? '';
        $title = $data['title'] ?? '';

        return match ($template) {
            'submission_success' => "Proposal Submitted — {$tracker}",
            'co_investigator_notified' => "Co-Investigator Invitation — {$tracker}",
            'decision_result' => match (strtolower($data['decision'] ?? '')) {
                'accepted' => "Proposal Accepted — {$tracker}",
                'rejected' => "Proposal Rejected — {$tracker}",
                'validated' => "Proposal Validated — Proceeding to Review — {$tracker}",
                'under review' => "Proposal Under Review — {$tracker}",
                default => "Proposal Update — {$tracker}",
            },
            'award_approval' => "Congratulations! Proposal Funded — {$tracker}",
            'budget_request_approved' => "Budget Request Approved — {$tracker}",
            'budget_allocated' => "Budget Allocated — {$title}",
            default => "RTT Platform Notification — {$tracker}",
        };
    }
}
