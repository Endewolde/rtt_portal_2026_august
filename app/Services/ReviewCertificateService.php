<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\ReviewCertificate;
use App\Models\ReviewCertificateRelease;
use App\Models\User;
use App\Support\PdfAssets;
use Barryvdh\DomPDF\Facade\Pdf;
use chillerlan\QRCode\Common\EccLevel;
use chillerlan\QRCode\Output\QRGdImagePNG;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Traits\Localizable;

/**
 * Certificates of review service: how many blind reviews and open-defence evaluations
 * a reviewer completed in an academic year. Never names the proposals — blind review
 * is confidential. The central office releases each year once its reviews are done;
 * reviewers with at least the minimum qualifying reviews then receive a certificate
 * with their counts frozen, which can later be revoked. A released year can be closed
 * (every certificate withdrawn at once) and then reopened or released again.
 */
class ReviewCertificateService
{
    use Localizable;

    public const DEFAULT_SIGNATORY_TITLE = 'Vice President, Research & Technology Transfer';

    /**
     * The signed-in reviewer's years: what they completed, whether the year's
     * certificates are released, and whether they qualified.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function summary(User $reviewer): Collection
    {
        $releases = ReviewCertificateRelease::all()->keyBy('academic_year');
        $certificates = ReviewCertificate::where('user_id', $reviewer->id)->get()->keyBy('academic_year');
        $rules = $this->currentRules();

        return $this->counts(fn ($q) => $q->where('ra.reviewer_id', $reviewer->id))
            ->map(function ($row) use ($releases, $certificates, $rules) {
                $release = $releases[$row['academic_year']] ?? null;
                $minReviews = $release->min_reviews ?? $rules['min_reviews'];
                $onTimeOnly = $release->on_time_only ?? $rules['on_time_only'];
                $certificate = $release ? ($certificates[$row['academic_year']] ?? null) : null;
                $counted = $onTimeOnly ? $row['total'] - $row['late'] : $row['total'];

                return $row + [
                    'counted' => $counted,
                    'min_reviews' => $minReviews,
                    'on_time_only' => $onTimeOnly,
                    'released' => $release !== null,
                    'withdrawn' => (bool) $release?->isClosed(),
                    'eligible' => $release ? $certificate !== null : $counted >= $minReviews,
                    'code' => $certificate?->code,
                    'revoked' => (bool) $certificate?->isRevoked(),
                    'revocation_reason' => $certificate?->revocation_reason,
                ];
            })
            ->values();
    }

    /**
     * Central office view of one academic year: every reviewer with completed
     * reviews, how many count, who qualifies, and the certificates issued.
     *
     * @return array<string, mixed>
     */
    public function overview(?string $academicYear): array
    {
        $years = DB::table('review_assignments as ra')
            ->join('proposals as p', 'p.id', '=', 'ra.proposal_id')
            ->where('ra.status', 'submitted')
            ->whereNotNull('p.academic_year')
            ->distinct()
            ->orderByDesc('p.academic_year')
            ->pluck('p.academic_year');

        $academicYear = $academicYear ?: $years->first();
        $release = $academicYear ? ReviewCertificateRelease::with(['releasedBy:id,name', 'closedBy:id,name'])->where('academic_year', $academicYear)->first() : null;
        $rules = $release
            ? ['min_reviews' => $release->min_reviews, 'on_time_only' => $release->on_time_only]
            : $this->currentRules();

        $rows = $academicYear ? $this->reviewerRows($academicYear, $rules) : collect();
        $certificates = ReviewCertificate::where('academic_year', $academicYear)->get()->keyBy('user_id');

        $reviewers = $rows->map(fn ($row) => $row + [
            'certificate' => ($release && ($c = $certificates[$row['user_id']] ?? null)) ? [
                'id' => $c->id,
                'code' => $c->code,
                'blind_reviews' => $c->blind_reviews,
                'defence_reviews' => $c->defence_reviews,
                'issued_at' => $c->issued_at?->toIso8601String(),
                'revoked_at' => $c->revoked_at?->toIso8601String(),
                'revocation_reason' => $c->revocation_reason,
            ] : null,
        ])->values();

        return [
            'years' => $years->values(),
            'academic_year' => $academicYear,
            'rules' => $rules,
            'release' => $release ? [
                'released_at' => $release->released_at->toIso8601String(),
                'released_by' => $release->releasedBy?->name,
                'certificates_issued' => $release->certificates_issued,
                'closed_at' => $release->closed_at?->toIso8601String(),
                'closed_by' => $release->closedBy?->name,
                'close_reason' => $release->close_reason,
            ] : null,
            'stats' => [
                'reviewers' => $reviewers->count(),
                'eligible' => $reviewers->where('eligible', true)->count(),
                'issued' => $reviewers->filter(fn ($r) => $r['certificate'] && ! $r['certificate']['revoked_at'])->count(),
                'revoked' => $reviewers->filter(fn ($r) => $r['certificate'] && $r['certificate']['revoked_at'])->count(),
            ],
            'reviewers' => $reviewers,
        ];
    }

    /**
     * Release a year: issue a certificate to every reviewer who meets the current
     * rules, with their counts frozen as of now. Once released, a year can only be
     * released again after it has been closed; certificates keep their numbers, and
     * any that no longer qualify are revoked rather than deleted.
     *
     * @throws \RuntimeException
     */
    public function release(string $academicYear, User $actor): ReviewCertificateRelease
    {
        $existing = ReviewCertificateRelease::where('academic_year', $academicYear)->first();
        if ($existing && ! $existing->isClosed()) {
            throw new \RuntimeException("Certificates for {$academicYear} have already been released.");
        }

        $rules = $this->currentRules();
        $eligible = $this->reviewerRows($academicYear, $rules)->where('eligible', true);
        if ($eligible->isEmpty()) {
            throw new \RuntimeException("No reviewer has {$rules['min_reviews']} or more qualifying reviews in {$academicYear}.");
        }

        $release = DB::transaction(function () use ($academicYear, $actor, $rules, $eligible, $existing) {
            $release = ReviewCertificateRelease::updateOrCreate(['academic_year' => $academicYear], [
                'min_reviews' => $rules['min_reviews'],
                'on_time_only' => $rules['on_time_only'],
                'certificates_issued' => $eligible->count(),
                'released_by' => $actor->id,
                'released_at' => now(),
                'closed_at' => null,
                'closed_by' => null,
                'close_reason' => null,
            ]);

            $noLongerEligible = ReviewCertificate::where('academic_year', $academicYear)->whereNotIn('user_id', $eligible->pluck('user_id'));
            if ($existing) {
                // Their numbers were already handed out, so they must keep verifying — as revoked.
                $noLongerEligible->whereNull('revoked_at')->update([
                    'revoked_at' => now(),
                    'revoked_by' => $actor->id,
                    'revocation_reason' => "Did not meet the rules when {$academicYear} certificates were released again.",
                ]);
            } else {
                // Anything issued before releases existed only stands if it qualifies now.
                $noLongerEligible->delete();
            }

            foreach ($eligible as $row) {
                $certificate = ReviewCertificate::firstOrNew(['user_id' => $row['user_id'], 'academic_year' => $academicYear]);
                // Individual revocations survive a re-release; those are separate decisions.
                $certificate->fill([
                    'blind_reviews' => $row['counted_blind'],
                    'defence_reviews' => $row['counted_defence'],
                    'code' => $certificate->code ?? $this->newCode(),
                    'issued_at' => now(),
                ])->save();
            }

            return $release;
        });

        $notified = ReviewCertificate::where('academic_year', $academicYear)->whereIn('user_id', $eligible->pluck('user_id'))->whereNull('revoked_at')->pluck('user_id');
        foreach (User::whereIn('id', $notified)->get() as $reviewer) {
            $this->notify($reviewer, 'review_certificate_released', [
                'academic_year' => $academicYear,
                'message' => "Your certificate of review service for {$academicYear} is ready. Thank you for reviewing — download it from My Reviews.",
            ]);
        }

        return $release;
    }

    /**
     * Close a released year: every certificate of the year is withdrawn at once — no
     * downloads, and verification shows it as withdrawn — until it is reopened.
     *
     * @throws \RuntimeException
     */
    public function close(string $academicYear, User $actor, string $reason): ReviewCertificateRelease
    {
        $release = ReviewCertificateRelease::where('academic_year', $academicYear)->first();
        if (! $release) {
            throw new \RuntimeException("Certificates for {$academicYear} have not been released.");
        }
        if ($release->isClosed()) {
            throw new \RuntimeException("Certificates for {$academicYear} are already closed.");
        }

        $release->update(['closed_at' => now(), 'closed_by' => $actor->id, 'close_reason' => $reason]);

        foreach ($this->activeHolders($academicYear) as $reviewer) {
            $this->notify($reviewer, 'review_certificate_withdrawn', [
                'academic_year' => $academicYear,
                'message' => "Certificates of review service for {$academicYear} have been withdrawn for now, including yours. Reason: {$reason}",
            ]);
        }

        return $release->fresh();
    }

    /**
     * Reopen a closed year exactly as it was released: same certificates, same counts.
     *
     * @throws \RuntimeException
     */
    public function reopen(string $academicYear): ReviewCertificateRelease
    {
        $release = ReviewCertificateRelease::where('academic_year', $academicYear)->first();
        if (! $release?->isClosed()) {
            throw new \RuntimeException("Certificates for {$academicYear} are not closed.");
        }

        $release->update(['closed_at' => null, 'closed_by' => null, 'close_reason' => null]);

        foreach ($this->activeHolders($academicYear) as $reviewer) {
            $this->notify($reviewer, 'review_certificate_released', [
                'academic_year' => $academicYear,
                'message' => "Your certificate of review service for {$academicYear} is available again and can be downloaded from My Reviews.",
            ]);
        }

        return $release->fresh();
    }

    /**
     * Reviewers holding a certificate of the year that is not individually revoked.
     *
     * @return Collection<int, User>
     */
    private function activeHolders(string $academicYear): Collection
    {
        $userIds = ReviewCertificate::where('academic_year', $academicYear)->whereNull('revoked_at')->pluck('user_id');

        return User::whereIn('id', $userIds)->get();
    }

    public function revoke(ReviewCertificate $certificate, User $actor, string $reason): ReviewCertificate
    {
        if ($certificate->isRevoked()) {
            throw new \RuntimeException('This certificate is already revoked.');
        }

        $certificate->update(['revoked_at' => now(), 'revoked_by' => $actor->id, 'revocation_reason' => $reason]);

        $this->notify($certificate->user, 'review_certificate_revoked', [
            'academic_year' => $certificate->academic_year,
            'message' => "Your certificate of review service for {$certificate->academic_year} (no. {$certificate->code}) has been revoked. Reason: {$reason}",
        ]);

        return $certificate->fresh();
    }

    public function reinstate(ReviewCertificate $certificate): ReviewCertificate
    {
        if (! $certificate->isRevoked()) {
            throw new \RuntimeException('This certificate is not revoked.');
        }

        $certificate->update(['revoked_at' => null, 'revoked_by' => null, 'revocation_reason' => null]);

        $this->notify($certificate->user, 'review_certificate_released', [
            'academic_year' => $certificate->academic_year,
            'message' => "Your certificate of review service for {$certificate->academic_year} has been reinstated and can be downloaded again from My Reviews.",
        ]);

        return $certificate->fresh();
    }

    /** The reviewer's downloadable certificate: the year is released, they qualified, it isn't revoked. */
    public function downloadable(User $reviewer, string $academicYear): ReviewCertificate
    {
        $release = ReviewCertificateRelease::where('academic_year', $academicYear)->first();
        if (! $release) {
            throw new \RuntimeException("Certificates for {$academicYear} have not been released yet.");
        }
        if ($release->isClosed()) {
            throw new \RuntimeException("Certificates for {$academicYear} have been withdrawn.");
        }

        $certificate = ReviewCertificate::where('user_id', $reviewer->id)->where('academic_year', $academicYear)->first();
        if (! $certificate) {
            throw new \RuntimeException("You did not meet the minimum number of reviews for a {$academicYear} certificate.");
        }
        if ($certificate->isRevoked()) {
            throw new \RuntimeException('This certificate has been revoked.');
        }

        return $certificate;
    }

    /** @return array{min_reviews: int, on_time_only: bool} */
    public function currentRules(): array
    {
        $settings = DB::table('app_settings')->whereIn('key', ['certificate_min_reviews', 'certificate_on_time_only'])->pluck('value', 'key');

        return [
            'min_reviews' => max(1, (int) ($settings['certificate_min_reviews'] ?? 3)),
            'on_time_only' => filter_var($settings['certificate_on_time_only'] ?? false, FILTER_VALIDATE_BOOLEAN),
        ];
    }

    /**
     * Reviewers with completed reviews in a year, with the counts that qualify under the rules.
     *
     * @param  array{min_reviews: int, on_time_only: bool}  $rules
     * @return Collection<int, array<string, mixed>>
     */
    private function reviewerRows(string $academicYear, array $rules): Collection
    {
        $rows = $this->counts(fn ($q) => $q->where('p.academic_year', $academicYear), byReviewer: true);
        $users = User::whereIn('id', $rows->pluck('user_id'))->get(['id', 'name', 'title', 'email'])->keyBy('id');

        return $rows->map(function ($row) use ($rules, $users) {
            $countedBlind = $rules['on_time_only'] ? $row['blind_reviews'] - $row['late_blind'] : $row['blind_reviews'];
            $countedDefence = $rules['on_time_only'] ? $row['defence_reviews'] - $row['late_defence'] : $row['defence_reviews'];
            $user = $users[$row['user_id']] ?? null;

            return [
                'user_id' => $row['user_id'],
                'name' => $user ? trim(($user->title ? $user->title.' ' : '').$user->name) : 'Unknown user',
                'email' => $user?->email,
                'blind_reviews' => $row['blind_reviews'],
                'defence_reviews' => $row['defence_reviews'],
                'total' => $row['total'],
                'late' => $row['late'],
                'counted_blind' => $countedBlind,
                'counted_defence' => $countedDefence,
                'counted' => $countedBlind + $countedDefence,
                'eligible' => $countedBlind + $countedDefence >= $rules['min_reviews'],
            ];
        })->sortByDesc('counted')->values();
    }

    /**
     * Submitted blind-review and open-defence evaluations, grouped by academic year (and
     * reviewer). Late = submitted after the assignment's due date.
     *
     * @param  callable(Builder): mixed  $scope
     * @return Collection<int, array<string, mixed>>
     */
    private function counts(callable $scope, bool $byReviewer = false): Collection
    {
        $late = 'ra.due_date IS NOT NULL AND DATE(ra.submitted_at) > ra.due_date';

        $query = DB::table('review_assignments as ra')
            ->join('proposals as p', 'p.id', '=', 'ra.proposal_id')
            ->join('evaluation_types as et', 'et.id', '=', 'ra.evaluation_type_id')
            ->where('ra.status', 'submitted')
            ->whereNotNull('p.academic_year')
            ->where(fn ($q) => $q->where('et.name', 'like', 'blind_review%')->orWhere('et.name', 'like', 'open_defence%'))
            ->groupBy('p.academic_year')
            ->orderByDesc('p.academic_year')
            ->selectRaw("p.academic_year,
                SUM(CASE WHEN et.name LIKE 'blind_review%' THEN 1 ELSE 0 END) as blind_reviews,
                SUM(CASE WHEN et.name LIKE 'open_defence%' THEN 1 ELSE 0 END) as defence_reviews,
                SUM(CASE WHEN et.name LIKE 'blind_review%' AND {$late} THEN 1 ELSE 0 END) as late_blind,
                SUM(CASE WHEN et.name LIKE 'open_defence%' AND {$late} THEN 1 ELSE 0 END) as late_defence");

        if ($byReviewer) {
            $query->groupBy('ra.reviewer_id')->addSelect('ra.reviewer_id');
        }
        $scope($query);

        return $query->get()->map(fn ($row) => [
            'user_id' => $row->reviewer_id ?? null,
            'academic_year' => $row->academic_year,
            'blind_reviews' => (int) $row->blind_reviews,
            'defence_reviews' => (int) $row->defence_reviews,
            'total' => (int) $row->blind_reviews + (int) $row->defence_reviews,
            'late' => (int) $row->late_blind + (int) $row->late_defence,
            'late_blind' => (int) $row->late_blind,
            'late_defence' => (int) $row->late_defence,
        ]);
    }

    /** @param array<string, mixed> $data */
    private function notify(User $user, string $event, array $data): void
    {
        try {
            StoreInAppNotificationJob::dispatchSync($user->id, $event, $data);
        } catch (\Throwable $e) {
            Log::error("Certificate notification ({$event}) failed: {$e->getMessage()}");
        }

        try {
            SendEmailNotificationJob::deliver($user, $event, $data);
        } catch (\Throwable $e) {
            Log::error("Certificate email ({$event}) failed: {$e->getMessage()}");
        }
    }

    public function pdf(ReviewCertificate $certificate): Response
    {
        $settings = DB::table('app_settings')
            ->whereIn('key', ['organization_name', 'system_name', 'system_logo', 'certificate_signatory_name', 'certificate_signatory_title'])
            ->pluck('value', 'key');
        $verifyUrl = $this->verifyUrl($certificate);

        // In the reviewer's own language.
        $pdf = $this->withLocale($certificate->user->locale ?: config('app.locale'), fn () => Pdf::loadView('pdf.review_certificate', [
            'certificate' => $certificate,
            'reviewerName' => $certificate->user->name,
            'reviewerTitle' => $certificate->user->title,
            'orgName' => $settings['organization_name'] ?? 'Wolaita Sodo University',
            'systemName' => $settings['system_name'] ?? 'RTT Platform',
            'logo' => PdfAssets::embeddedImage($settings['system_logo'] ?? null),
            'signatoryName' => $settings['certificate_signatory_name'] ?? '',
            'signatoryTitle' => $settings['certificate_signatory_title'] ?? self::DEFAULT_SIGNATORY_TITLE,
            'verifyUrl' => $verifyUrl,
            'qrCode' => $this->qrCode($verifyUrl),
        ])->setPaper('a4', 'landscape'));

        $file = 'review-certificate-'.Str::slug($certificate->academic_year).'.pdf';

        return $pdf->download($file);
    }

    public function verifyUrl(ReviewCertificate $certificate): string
    {
        return rtrim(config('app.url'), '/')."/certificates/verify/{$certificate->code}";
    }

    /** A scannable link to the public verification page, as a PNG data URI for dompdf. */
    public function qrCode(string $url): string
    {
        return (new QRCode(new QROptions([
            'outputInterface' => QRGdImagePNG::class,
            'eccLevel' => EccLevel::M,
            'scale' => 6,
            'quietzoneSize' => 1,
            'outputBase64' => true,
        ])))->render($url);
    }

    private function newCode(): string
    {
        do {
            $code = strtoupper(Str::random(4).'-'.Str::random(4).'-'.Str::random(4));
        } while (ReviewCertificate::where('code', $code)->exists());

        return $code;
    }
}
