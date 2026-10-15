<?php

namespace App\Services;

use App\Models\ReviewerAgreement;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Reviewers accept a confidentiality agreement once per academic year before opening any
 * proposal to review. The exact wording accepted is stored with the acceptance.
 */
class ReviewerAgreementService
{
    public const DEFAULT_TEXT = "As a reviewer for the Research & Technology Transfer office, I agree that:\n\n"
        ."1. I will keep every proposal, document, score and discussion I see confidential, and will not share, copy or use them for any purpose other than this review.\n"
        ."2. I will not use the ideas, methods or data in any proposal for my own work.\n"
        ."3. I will not try to find out who wrote a blind-review proposal, and will not contact applicants about their proposals.\n"
        ."4. I will declare any conflict of interest as soon as I become aware of it, and withdraw from that review.\n"
        ."5. I will review fairly, on the merits of the proposal and the published criteria, and submit my review on time.\n"
        .'6. I will delete or destroy any copies of proposal documents once my review is complete.';

    public function text(): string
    {
        $custom = trim((string) DB::table('app_settings')->where('key', 'reviewer_agreement_text')->value('value'));

        return $custom !== '' ? $custom : self::DEFAULT_TEXT;
    }

    public function academicYear(): string
    {
        return (string) (DB::table('app_settings')->where('key', 'current_academic_year')->value('value') ?: now()->format('Y'));
    }

    public function current(User $user): ?ReviewerAgreement
    {
        return ReviewerAgreement::where('user_id', $user->id)->where('academic_year', $this->academicYear())->first();
    }

    public function hasAccepted(User $user): bool
    {
        return $this->current($user) !== null;
    }

    public function accept(User $user, ?string $ip): ReviewerAgreement
    {
        return $this->current($user) ?? ReviewerAgreement::create([
            'user_id' => $user->id,
            'academic_year' => $this->academicYear(),
            'agreement_text' => $this->text(),
            'accepted_at' => now(),
            'ip_address' => $ip,
        ]);
    }
}
