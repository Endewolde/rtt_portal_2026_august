<?php

namespace App\Listeners;

use App\Events\ProposalTransitioned;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\User;
use App\Support\Programmes;
use Illuminate\Support\Facades\Log;

class SendProposalWorkflowNotifications
{
    public function handle(ProposalTransitioned $event): void
    {
        $proposal = $event->proposal->loadMissing(['pi', 'members.user']);

        $fromStage = $event->fromStage ?? null;

        // Reopening a rejected proposal can land on any prior stage depending on where
        // it was rejected from — none of the toStage handlers below describe what
        // actually happened ("reconsideration", not a fresh pass/entry), so this gets
        // its own accurate notification instead of falling into the generic match.
        if ($event->action === 'reopen') {
            $this->onReopened($proposal);

            return;
        }

        // A withdrawn mistaken-approval report just undoes a silent pull-back to
        // validated — the proposal resumes where it was, so there is nothing new to
        // tell the PI or the officers.
        if (in_array($event->action, ['withdraw_report_resume_review', 'withdraw_report_restore_passed'], true)) {
            return;
        }

        match ($event->toStage) {
            'submitted' => $this->onSubmitted($proposal),
            // Only the genuine first-time validation (submitted -> validated) is a
            // "you passed" moment worth notifying the PI about. Landing on validated
            // from under_blind_review/blind_review_passed is always a step BACK —
            // reviewers unassigned, or a mistaken-approval report pulled it back for
            // the officer to reconsider — and sending "passed initial validation" in
            // that case would be actively misleading.
            'validated' => $fromStage === 'submitted'
                ? $this->onValidated($proposal)
                : null,
            'accepted' => $this->onAccepted($proposal),
            'rejected' => $fromStage === 'funded'
                ? $this->onFundingRevoked($proposal)
                : $this->onDecision($proposal, 'rejected'),
            'funded' => $this->onFunded($proposal),
            'under_blind_review' => $this->onUnderReview($proposal, 'blind review'),
            'blind_review_passed' => $this->onBlindReviewPassed($proposal),
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

        // Category officers: notify that a new proposal is in their queue
        $this->notifyCategoryOfficers($proposal, array_merge($baseData, [
            'pi_name' => $pi?->name ?? 'Unknown',
            'category' => ucwords(str_replace('_', ' ', (string) $proposal->category)),
        ]));
    }

    private function notifyCategoryOfficers(Proposal $proposal, array $data): void
    {
        $role = Programmes::directorRoles($proposal->category);
        $officers = ($role ? User::role($role)->where('status', 'active')->get() : collect())
            ->merge(User::customRoleHolders('proposals.validate', $proposal->college_id, $proposal->category))
            ->unique('id');
        foreach ($officers as $officer) {
            $this->notify($officer, 'proposal_submitted_officer', $data, 'proposal_submitted_officer');
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

    /**
     * Passing open defence lands the proposal at `accepted`, which is the Central
     * Evaluation phase — it is NOT yet approved or funded, so only the proposal team
     * is told it has advanced, and the wording must never imply a final decision.
     */
    private function onAccepted(Proposal $proposal): void
    {
        $data = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'decision' => 'central_eval_approved',
            'reason' => 'Your proposal has passed both the Blind Review and Open Defence phases and has been forwarded to the Central Evaluation Committee. You will receive a separate notification once the final funding decision has been made.',
        ];

        foreach ($this->allRecipients($proposal) as $user) {
            $this->notify($user, 'central_eval_approved', $data, 'central_eval_approved');
        }

        // The college's RTT manager takes the central evaluation decision for it.
        $officerData = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'message' => "Proposal {$proposal->tracker_number} ({$proposal->title}) passed open defence and is ready for central evaluation.",
        ];
        $managers = $proposal->college_id
            ? User::role('college_rtt_manager')->where('status', 'active')->where('college_id', $proposal->college_id)->get()
                ->merge(User::customRoleHolders('evaluation.central', $proposal->college_id, $proposal->category))->unique('id')
            : collect();
        foreach ($managers as $manager) {
            $this->notify($manager, 'central_eval_ready_officer', $officerData, 'central_eval_ready_officer');
        }
    }

    private function onFundingRevoked(Proposal $proposal): void
    {
        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'decision' => 'funding_revoked',
            'reason' => $proposal->rejection_reason
                ?? 'The funding previously awarded to your proposal has been revoked. Please contact the RTT Office for further information.',
        ];

        foreach ($this->allRecipients($proposal) as $user) {
            $this->notify($user, 'funding_revoked', $data, 'funding_revoked');
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

    private function onReopened(Proposal $proposal): void
    {
        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'decision' => 'reopened',
            'reason' => 'Your proposal\'s earlier rejection is being reconsidered. It has been returned to the review stage it was rejected from — you\'ll be notified again once a new decision is made.',
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

    /** Notify the officers who can schedule an open-defence session that one is now needed. */
    private function onBlindReviewPassed(Proposal $proposal): void
    {
        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'message' => "Proposal {$proposal->tracker_number} ({$proposal->title}) has passed blind review and is awaiting an open defence session.",
        ];

        foreach ($this->defenceSchedulers($proposal) as $officer) {
            $this->notify($officer, 'blind_review_passed_officer', $data, 'blind_review_passed_officer');
        }
    }

    /** Officers allowed to run the `schedule_defence` transition for this proposal (see WorkflowStageSeeder). */
    private function defenceSchedulers(Proposal $proposal): array
    {
        $recipients = User::role('central_officer')->where('status', 'active')->get();

        $categoryRole = Programmes::directorRoles($proposal->category);
        if ($categoryRole) {
            $recipients = $recipients->merge(User::role($categoryRole)->where('status', 'active')->get());
        }

        if ($proposal->college_id) {
            $recipients = $recipients->merge(
                User::role('college_officer')->where('status', 'active')->where('college_id', $proposal->college_id)->get()
            );
        }

        $recipients = $recipients->merge(User::customRoleHolders('reviews.manage', $proposal->college_id, $proposal->category));

        return $recipients->unique('id')->values()->all();
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
            SendEmailNotificationJob::deliver($user, $template, $data);
        } catch (\Exception $e) {
            Log::error("Failed to send email notification [{$template}] to {$user->email}: ".$e->getMessage());
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
}
