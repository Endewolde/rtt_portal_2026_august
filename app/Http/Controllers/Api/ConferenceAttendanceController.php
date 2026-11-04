<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conference;
use App\Models\ConferenceCertificate;
use App\Models\ConferenceRegistration;
use App\Services\ConferenceAttendanceService;
use App\Services\ReviewCertificateService;
use App\Support\AuditLogger;
use App\Support\ConferenceAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

/**
 * The attendee's side after registering — ticket, cancelling, feedback, certificates —
 * and the organisers' check-in desk, certificate issuing and feedback results.
 */
class ConferenceAttendanceController extends Controller
{
    public function __construct(private ConferenceAttendanceService $attendance) {}

    // ── Attendee (by ticket code) ─────────────────────────────────────────────

    public function ticket(string $code, ReviewCertificateService $qr): JsonResponse
    {
        $reg = $this->registration($code);
        $conference = $reg->conference;

        $position = $reg->status === 'waitlisted'
            ? $conference->registrations()->where('status', 'waitlisted')->where('registered_at', '<', $reg->registered_at)->count() + 1
            : null;

        return response()->json(['data' => [
            'name' => $reg->name,
            'email' => $reg->email,
            'organization' => $reg->organization,
            'status' => $reg->status,
            'type' => $reg->type?->name,
            'ticket_code' => $reg->ticket_code,
            'qr' => $reg->status === 'confirmed' ? $qr->qrCode($reg->ticket_code) : null,
            'checked_in_at' => $reg->checked_in_at,
            'waitlist_position' => $position,
            'conference' => [
                'title' => $conference->title, 'slug' => $conference->slug, 'start_date' => $conference->start_date,
                'end_date' => $conference->end_date, 'location_type' => $conference->location_type,
                'location_address' => $conference->location_address, 'is_past' => $conference->is_past,
                // The join link is for confirmed attendees only.
                'virtual_link' => $reg->status === 'confirmed' ? $conference->virtual_link : null,
            ],
            'feedback' => [
                'open' => $conference->feedback_open && $reg->status === 'confirmed',
                'submitted' => $reg->feedback()->exists(),
            ],
            'certificates' => $conference->certificates()->whereNull('revoked_at')
                ->whereRaw('LOWER(recipient_email) = ?', [Str::lower($reg->email)])->get()
                ->map(fn (ConferenceCertificate $c) => ['kind' => $c->kind, 'code' => $c->code, 'url' => $this->attendance->downloadUrl($c)]),
        ], 'message' => '', 'errors' => []]);
    }

    /** The attendee gives up their place; the next person waiting gets it. */
    public function cancel(string $code): JsonResponse
    {
        $reg = $this->registration($code);
        if (! in_array($reg->status, ['pending', 'confirmed', 'waitlisted'], true) || $reg->checked_in_at) {
            return response()->json(['message' => 'This registration can no longer be cancelled.', 'errors' => []], 422);
        }

        $held = $reg->status !== 'waitlisted';
        $reg->update(['status' => 'cancelled']);
        if ($held) {
            $this->attendance->promoteFromWaitlist($reg->conference);
        }
        AuditLogger::log('conference.registration_cancelled', 'Conference', $reg->conference_id, null, null, ['target_name' => $reg->name, 'by' => 'attendee'], 200);

        return response()->json(['message' => 'Your registration has been cancelled.', 'errors' => []]);
    }

    public function feedback(Request $request, string $code): JsonResponse
    {
        $reg = $this->registration($code);
        if (! $reg->conference->feedback_open || $reg->status !== 'confirmed') {
            return response()->json(['message' => 'Feedback is not open for this conference.', 'errors' => []], 422);
        }

        $data = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'would_recommend' => 'nullable|boolean',
            'liked' => 'nullable|string|max:2000',
            'improve' => 'nullable|string|max:2000',
        ]);

        $reg->feedback()->updateOrCreate([], $data + ['conference_id' => $reg->conference_id]);

        return response()->json(['message' => 'Thank you for your feedback.', 'errors' => []]);
    }

    /** A certificate's PDF — its number is the key, as on the printed certificate. */
    public function certificatePdf(string $code): Response
    {
        $certificate = ConferenceCertificate::where('code', strtoupper($code))->whereNull('revoked_at')->firstOrFail();

        return $this->attendance->pdf($certificate);
    }

    // ── Organisers ────────────────────────────────────────────────────────────

    /** Check an attendee in at the desk by ticket code (scanned or typed), or undo it. */
    public function checkIn(Request $request, string $id): JsonResponse
    {
        if (! ConferenceAccess::checksIn($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate(['code' => 'required|string|max:300', 'undo' => 'sometimes|boolean']);
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', Str::afterLast($data['code'], '/')));
        $reg = ConferenceRegistration::with('type')->where('conference_id', $id)->where('ticket_code', $code)->first();

        if (! $reg) {
            return response()->json(['message' => "No ticket {$code} for this conference.", 'errors' => [], 'meta' => ['code' => 'not_found']], 404);
        }
        $summary = ['name' => $reg->name, 'organization' => $reg->organization, 'type' => $reg->type?->name, 'ticket_code' => $reg->ticket_code];

        if (! empty($data['undo'])) {
            $reg->update(['checked_in_at' => null, 'checked_in_by' => null]);

            return response()->json(['data' => $summary + ['checked_in_at' => null], 'message' => "Check-in undone for {$reg->name}.", 'errors' => []]);
        }
        if ($reg->status !== 'confirmed') {
            return response()->json(['data' => $summary, 'message' => "{$reg->name}'s registration is {$reg->status} — not a valid ticket.", 'errors' => [], 'meta' => ['code' => 'not_confirmed']], 422);
        }
        if ($reg->checked_in_at) {
            return response()->json(['data' => $summary + ['checked_in_at' => $reg->checked_in_at], 'message' => "{$reg->name} already checked in at ".$reg->checked_in_at->format('H:i, j M').'.', 'errors' => [], 'meta' => ['code' => 'already']], 200);
        }

        $reg->update(['checked_in_at' => now(), 'checked_in_by' => $request->user()->id]);

        return response()->json(['data' => $summary + ['checked_in_at' => $reg->checked_in_at], 'message' => "Welcome, {$reg->name}!", 'errors' => [], 'meta' => ['code' => 'checked_in']]);
    }

    /** Attendance at a glance for the check-in desk: seats, check-ins and the waiting list. */
    public function attendance(Request $request, string $id): JsonResponse
    {
        if (! ConferenceAccess::checksIn($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $conference = Conference::with('registrationTypes')->findOrFail($id);
        $regs = $conference->registrations()->get(['id', 'registration_type_id', 'status', 'checked_in_at']);

        return response()->json(['data' => [
            'conference' => $conference->only(['id', 'title', 'slug', 'start_date', 'end_date', 'max_capacity']),
            'confirmed' => $regs->where('status', 'confirmed')->count(),
            'checked_in' => $regs->whereNotNull('checked_in_at')->count(),
            'waitlisted' => $regs->where('status', 'waitlisted')->count(),
            'types' => $conference->registrationTypes->map(fn ($t) => [
                'name' => $t->name, 'capacity' => $t->capacity,
                'confirmed' => $regs->where('registration_type_id', $t->id)->where('status', 'confirmed')->count(),
                'checked_in' => $regs->where('registration_type_id', $t->id)->whereNotNull('checked_in_at')->count(),
            ]),
            'recent' => $conference->registrations()->whereNotNull('checked_in_at')->orderByDesc('checked_in_at')->limit(8)
                ->get(['name', 'organization', 'ticket_code', 'checked_in_at']),
        ], 'message' => '', 'errors' => []]);
    }

    public function certificates(Request $request, string $id): JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $conference = Conference::findOrFail($id);

        return response()->json([
            'data' => $conference->certificates()->orderBy('kind')->orderBy('recipient_name')->get(),
            'meta' => [
                // What issuing now would cover, so the organiser knows before pressing the button.
                'eligible' => [
                    'attendance' => $conference->registrations()->where('status', 'confirmed')->whereNotNull('checked_in_at')->count(),
                    'presentation' => $conference->abstracts()->where('status', 'accepted')->count(),
                    'reviewer' => $conference->abstracts()->join('conference_abstract_reviews as r', 'r.abstract_id', '=', 'conference_abstracts.id')
                        ->whereNotNull('r.submitted_at')->distinct()->count('r.reviewer_id'),
                ],
            ],
            'message' => '',
            'errors' => [],
        ]);
    }

    public function issueCertificates(Request $request, string $id): JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $conference = Conference::findOrFail($id);
        $data = $request->validate(['kinds' => 'required|array|min:1', 'kinds.*' => 'in:'.implode(',', ConferenceCertificate::KINDS)]);

        $issued = $this->attendance->issue($conference, $data['kinds']);
        $total = array_sum($issued);
        AuditLogger::log('conference.certificates_issued', 'Conference', $conference->id, $request->user()->id, null, $issued + ['target_name' => $conference->title], 200);

        return response()->json([
            'data' => $issued,
            'message' => $total ? "{$total} certificate".($total === 1 ? '' : 's').' issued and emailed.' : 'Everyone eligible already has their certificate.',
            'errors' => [],
        ]);
    }

    public function revokeCertificate(Request $request, string $id, string $certificateId): JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $certificate = ConferenceCertificate::where('conference_id', $id)->findOrFail($certificateId);
        $revoke = $request->boolean('revoked', true);
        $certificate->update(['revoked_at' => $revoke ? now() : null]);

        return response()->json(['data' => $certificate, 'message' => $revoke ? 'Certificate revoked — it now verifies as revoked.' : 'Certificate reinstated.', 'errors' => []]);
    }

    public function feedbackSummary(Request $request, string $id): JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $conference = Conference::findOrFail($id);
        $rows = $conference->feedback()->latest()->get();
        $recommend = $rows->whereNotNull('would_recommend');

        return response()->json(['data' => [
            'responses' => $rows->count(),
            'attendees' => $conference->registrations()->where('status', 'confirmed')->count(),
            'average' => $rows->isNotEmpty() ? round($rows->avg('rating'), 1) : null,
            'distribution' => collect(range(1, 5))->mapWithKeys(fn ($n) => [$n => $rows->where('rating', $n)->count()]),
            'recommend_pct' => $recommend->isNotEmpty() ? (int) round($recommend->where('would_recommend', true)->count() / $recommend->count() * 100) : null,
            // Comments without names: feedback is collected as anonymous to organisers.
            'comments' => $rows->filter(fn ($f) => filled($f->liked) || filled($f->improve))
                ->map(fn ($f) => ['rating' => $f->rating, 'liked' => $f->liked, 'improve' => $f->improve, 'at' => $f->created_at])->values(),
        ], 'message' => '', 'errors' => []]);
    }

    private function registration(string $code): ConferenceRegistration
    {
        return ConferenceRegistration::with(['conference', 'type'])->where('ticket_code', strtoupper($code))->firstOrFail();
    }
}
