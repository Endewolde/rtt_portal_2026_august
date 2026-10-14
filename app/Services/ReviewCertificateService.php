<?php

namespace App\Services;

use App\Models\ReviewCertificate;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Certificates of review service: how many blind reviews and open-defence evaluations
 * a reviewer completed in an academic year. Never names the proposals — blind review
 * is confidential.
 */
class ReviewCertificateService
{
    /**
     * Completed reviews per academic year for this reviewer.
     *
     * @return Collection<int, array{academic_year: string, blind_reviews: int, defence_reviews: int, total: int}>
     */
    public function summary(User $reviewer): Collection
    {
        return DB::table('review_assignments as ra')
            ->join('proposals as p', 'p.id', '=', 'ra.proposal_id')
            ->join('evaluation_types as et', 'et.id', '=', 'ra.evaluation_type_id')
            ->where('ra.reviewer_id', $reviewer->id)
            ->where('ra.status', 'submitted')
            ->whereNotNull('p.academic_year')
            ->groupBy('p.academic_year')
            ->orderByDesc('p.academic_year')
            ->selectRaw("p.academic_year,
                SUM(CASE WHEN et.name LIKE 'blind_review%' THEN 1 ELSE 0 END) as blind_reviews,
                SUM(CASE WHEN et.name LIKE 'open_defence%' THEN 1 ELSE 0 END) as defence_reviews")
            ->get()
            ->map(fn ($row) => [
                'academic_year' => $row->academic_year,
                'blind_reviews' => (int) $row->blind_reviews,
                'defence_reviews' => (int) $row->defence_reviews,
                'total' => (int) $row->blind_reviews + (int) $row->defence_reviews,
            ])
            ->filter(fn ($row) => $row['total'] > 0)
            ->values();
    }

    /**
     * Issue (or refresh the counts of) this year's certificate. The verification code
     * stays the same once issued.
     *
     * @throws \RuntimeException when there were no completed reviews that year
     */
    public function issue(User $reviewer, string $academicYear): ReviewCertificate
    {
        $year = $this->summary($reviewer)->firstWhere('academic_year', $academicYear);
        if (! $year) {
            throw new \RuntimeException("You have no completed reviews in {$academicYear}.");
        }

        $certificate = ReviewCertificate::firstOrNew(['user_id' => $reviewer->id, 'academic_year' => $academicYear]);
        $certificate->fill([
            'blind_reviews' => $year['blind_reviews'],
            'defence_reviews' => $year['defence_reviews'],
            'code' => $certificate->code ?? $this->newCode(),
            'issued_at' => $certificate->issued_at ?? now(),
        ])->save();

        return $certificate;
    }

    public function pdf(ReviewCertificate $certificate): Response
    {
        $settings = DB::table('app_settings')
            ->whereIn('key', ['organization_name', 'system_name', 'system_logo', 'certificate_signatory_name', 'certificate_signatory_title'])
            ->pluck('value', 'key');

        $pdf = Pdf::loadView('pdf.review_certificate', [
            'certificate' => $certificate,
            'reviewerName' => $certificate->user->name,
            'reviewerTitle' => $certificate->user->title,
            'orgName' => $settings['organization_name'] ?? 'Wolaita Sodo University',
            'systemName' => $settings['system_name'] ?? 'RTT Platform',
            'logo' => $this->embeddedLogo($settings['system_logo'] ?? null),
            'signatoryName' => $settings['certificate_signatory_name'] ?? '',
            'signatoryTitle' => $settings['certificate_signatory_title'] ?? 'Director, Research & Technology Transfer',
            'verifyUrl' => rtrim(config('app.url'), '/')."/certificates/verify/{$certificate->code}",
        ])->setPaper('a4', 'landscape');

        $file = 'review-certificate-'.Str::slug($certificate->academic_year).'.pdf';

        return $pdf->download($file);
    }

    /** dompdf can't fetch remote images — embed the uploaded logo as a data URI. */
    private function embeddedLogo(?string $logo): ?string
    {
        if (! $logo) {
            return null;
        }

        $path = public_path(ltrim(parse_url($logo, PHP_URL_PATH) ?? '', '/'));
        if (! is_file($path)) {
            return null;
        }

        $mime = mime_content_type($path) ?: 'image/png';

        return "data:{$mime};base64,".base64_encode(file_get_contents($path));
    }

    private function newCode(): string
    {
        do {
            $code = strtoupper(Str::random(4).'-'.Str::random(4).'-'.Str::random(4));
        } while (ReviewCertificate::where('code', $code)->exists());

        return $code;
    }
}
