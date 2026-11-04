<?php

namespace App\Services;

use App\Http\Controllers\Api\ConferenceController;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\ConferenceCertificate;
use App\Models\ConferenceRegistration;
use App\Support\PdfAssets;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * After registration: the waiting list, certificates for attendees, presenters and
 * reviewers, and the certificate PDF.
 */
class ConferenceAttendanceService
{
    public function __construct(private ReviewCertificateService $reviewCertificates) {}

    /**
     * Give freed seats to the waiting list, oldest first, and email each person promoted.
     * Someone waiting for a full registration type stays waiting while others move up.
     *
     * @return int how many were promoted
     */
    public function promoteFromWaitlist(Conference $conference): int
    {
        $promoted = DB::transaction(function () use ($conference) {
            $locked = Conference::whereKey($conference->id)->lockForUpdate()->first();
            $moved = collect();

            $locked->registrations()->where('status', 'waitlisted')->orderBy('registered_at')->get()
                ->each(function (ConferenceRegistration $reg) use ($locked, $moved) {
                    if (ConferenceController::hasSeat($locked, $reg->registration_type_id)) {
                        $reg->update(['status' => 'confirmed']);
                        $moved->push($reg);
                    }
                });

            return $moved;
        });

        $promoted->each(fn (ConferenceRegistration $reg) => ConferenceController::sendRegistrationConfirmation($conference, $reg, promoted: true));

        return $promoted->count();
    }

    /**
     * Issue the certificates people have earned — attendance for everyone checked in,
     * presentation for each accepted abstract's presenter, reviewer for everyone who
     * submitted a review. Running it again issues only the new ones.
     *
     * @param  list<string>  $kinds
     * @return array<string, int> new certificates per kind
     */
    public function issue(Conference $conference, array $kinds): array
    {
        $earned = collect();

        if (in_array('attendance', $kinds, true)) {
            $conference->registrations()->with('type')->whereNotNull('checked_in_at')->where('status', 'confirmed')->get()
                ->each(fn (ConferenceRegistration $r) => $earned->push([
                    'kind' => 'attendance', 'source_key' => 'registration:'.$r->id,
                    'recipient_name' => $r->name, 'recipient_email' => $r->email, 'detail' => $r->type?->name,
                ]));
        }
        if (in_array('presentation', $kinds, true)) {
            $conference->abstracts()->where('status', 'accepted')->get()
                ->each(function (ConferenceAbstract $a) use ($earned) {
                    $presenter = collect($a->authors())->firstWhere('presenting', true) ?? $a->authors()[0];
                    $earned->push([
                        'kind' => 'presentation', 'source_key' => 'abstract:'.$a->id,
                        'recipient_name' => $presenter['name'], 'recipient_email' => $presenter['email'] ?: $a->submitter_email,
                        'detail' => Str::limit($a->title, 480).' ('.$a->finalType().')',
                    ]);
                });
        }
        if (in_array('reviewer', $kinds, true)) {
            ConferenceAbstractReview::with('reviewer:id,name,email')
                ->whereNotNull('submitted_at')
                ->whereHas('abstract', fn ($q) => $q->where('conference_id', $conference->id))
                ->get()
                ->groupBy('reviewer_id')
                ->each(fn ($reviews) => $reviews->first()->reviewer && $earned->push([
                    'kind' => 'reviewer', 'source_key' => 'user:'.$reviews->first()->reviewer_id,
                    'recipient_name' => $reviews->first()->reviewer->name, 'recipient_email' => $reviews->first()->reviewer->email,
                    'detail' => $reviews->count().' abstract'.($reviews->count() === 1 ? '' : 's').' reviewed',
                ]));
        }

        $existing = $conference->certificates()->get(['kind', 'source_key'])->map(fn ($c) => $c->kind.'|'.$c->source_key)->flip();
        $issued = array_fill_keys($kinds, 0);

        foreach ($earned as $item) {
            if ($existing->has($item['kind'].'|'.$item['source_key'])) {
                continue;
            }
            $certificate = $conference->certificates()->create($item + ['code' => $this->newCode(), 'issued_at' => now()]);
            $issued[$item['kind']]++;
            $this->emailCertificate($conference, $certificate);
        }

        return $issued;
    }

    public function pdf(ConferenceCertificate $certificate): Response
    {
        $certificate->loadMissing('conference');
        $settings = DB::table('app_settings')
            ->whereIn('key', ['organization_name', 'system_logo', 'certificate_signatory_name', 'certificate_signatory_title'])
            ->pluck('value', 'key');
        $verifyUrl = rtrim(config('app.url'), '/')."/certificates/verify/{$certificate->code}";

        return Pdf::loadView('pdf.conference_certificate', [
            'certificate' => $certificate,
            'conference' => $certificate->conference,
            'orgName' => $settings['organization_name'] ?? 'Wolaita Sodo University',
            'logo' => PdfAssets::embeddedImage($settings['system_logo'] ?? null),
            'signatoryName' => $settings['certificate_signatory_name'] ?? '',
            'signatoryTitle' => $settings['certificate_signatory_title'] ?? ReviewCertificateService::DEFAULT_SIGNATORY_TITLE,
            'qrCode' => $this->reviewCertificates->qrCode($verifyUrl),
        ])->setPaper('a4', 'landscape')->download("certificate-{$certificate->kind}-".Str::slug($certificate->recipient_name).'.pdf');
    }

    public function downloadUrl(ConferenceCertificate $certificate): string
    {
        return rtrim(config('app.url'), '/')."/api/v1/conference-certificates/{$certificate->code}/pdf";
    }

    private function emailCertificate(Conference $conference, ConferenceCertificate $certificate): void
    {
        if (! $certificate->recipient_email) {
            return;
        }

        SendRawMailJob::deliver(
            view('emails.conference_certificate', [
                'conference' => $conference,
                'certificate' => $certificate,
                'url' => $this->downloadUrl($certificate),
                'senderName' => AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name'),
            ])->render(),
            $certificate->recipient_email,
            $certificate->recipient_name,
            "Your certificate — {$conference->title}"
        );
    }

    /** "CNF-" and eight unambiguous characters, e.g. "CNF-7KQM-3XPA". */
    private function newCode(): string
    {
        $chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        do {
            $code = 'CNF-'.collect(range(1, 8))->map(fn () => $chars[random_int(0, 31)])->join('');
            $code = substr($code, 0, 8).'-'.substr($code, 8);
        } while (ConferenceCertificate::where('code', $code)->exists());

        return $code;
    }
}
