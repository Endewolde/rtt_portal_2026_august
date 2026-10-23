<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendRawMailJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\ReviewerApplication;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Reviewer recruitment: experts outside the university apply on the public site with
 * their expertise and CV; an officer approves them into the reviewer pool, which
 * creates an external reviewer account and emails them a link to set a password.
 */
class ReviewerApplicationController extends Controller
{
    private const PERMISSION = 'reviewers.recruit';

    /** Public: apply to review proposals. */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'title' => ['nullable', 'string', 'max:50'],
            'email' => ['required', 'email:rfc', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'organization' => ['required', 'string', 'max:200'],
            'position' => ['nullable', 'string', 'max:150'],
            'qualification' => ['required', Rule::in(ReviewerApplication::QUALIFICATIONS)],
            'expertise' => ['required', 'array', 'min:1', 'max:15'],
            'expertise.*' => ['required', 'string', 'max:80'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'orcid' => ['nullable', 'string', 'regex:/^(https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i'],
            'cv' => ['required', 'file', 'mimes:pdf', 'max:5120'],
            'consent' => ['accepted'],
            // Spam trap: a field people never see.
            'website' => ['nullable', 'max:0'],
        ], [
            'cv.required' => 'Please attach your CV as a PDF.',
            'cv.mimes' => 'Your CV must be a PDF file.',
            'consent.accepted' => 'Please agree to the terms to apply.',
            'expertise.required' => 'Add at least one area of expertise.',
            'orcid.regex' => 'An ORCID iD looks like 0000-0002-1825-0097.',
        ]);

        $email = Str::lower($validated['email']);

        $existing = User::where('email', $email)->first();
        if ($existing && $existing->hasAnyRole(['staff', 'external_reviewer'])) {
            return $this->respond(null, 'You already have reviewer access with this email. Sign in and keep your expertise up to date in your profile.', 422);
        }

        if (ReviewerApplication::where('email', $email)->where('status', ReviewerApplication::PENDING)->exists()) {
            return $this->respond(null, 'An application with this email is already being considered. You will hear from us by email.', 422);
        }

        $application = DB::transaction(function () use ($validated, $email, $request) {
            $id = (string) Str::orderedUuid();
            $path = $request->file('cv')->storeAs('reviewer-applications', "{$id}.pdf", 'private');

            return ReviewerApplication::create([
                'id' => $id,
                'name' => trim($validated['name']),
                'title' => $validated['title'] ?? null,
                'email' => $email,
                'phone' => $validated['phone'] ?? null,
                'organization' => trim($validated['organization']),
                'position' => $validated['position'] ?? null,
                'qualification' => $validated['qualification'],
                'expertise' => collect($validated['expertise'])->map(fn ($e) => trim($e))->filter()->unique()->values()->all(),
                'bio' => $validated['bio'] ?? null,
                'orcid' => isset($validated['orcid']) ? Str::upper(Str::afterLast($validated['orcid'], '/')) : null,
                'cv_path' => $path,
                'status' => ReviewerApplication::PENDING,
            ]);
        });

        $this->mailApplicant($application, 'Your Reviewer Application Was Received',
            'Thank you for applying to review proposals for us. Your application and CV have been received, and the research office will review them. You will hear from us by email.');

        foreach (User::whoCan(self::PERMISSION) as $officer) {
            $this->notifyUser($officer, 'reviewer_application_received', [
                'message' => "{$application->name} ({$application->organization}) applied to join the reviewer pool. Expertise: ".implode(', ', $application->expertise).'.',
            ]);
        }

        return $this->respond(['id' => $application->id], 'Thank you — your application has been received. We will email you once it has been reviewed.', 201);
    }

    /** Officers: applications, newest first, with counts per status. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can(self::PERMISSION)) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        $status = in_array($request->query('status'), [ReviewerApplication::PENDING, ReviewerApplication::APPROVED, ReviewerApplication::REJECTED], true)
            ? $request->query('status')
            : ReviewerApplication::PENDING;

        $applications = ReviewerApplication::with(['reviewedBy:id,name'])
            ->where('status', $status)
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = '%'.Str::lower($request->string('q')->trim()).'%';
                $q->where(fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(organization) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(CAST(expertise AS CHAR)) LIKE ?', [$term]));
            })
            ->orderByDesc('created_at')
            ->paginate(20);

        return $this->respond($applications, '', 200, [
            'counts' => ReviewerApplication::selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
        ]);
    }

    /** Officers: the applicant's CV. */
    public function cv(Request $request, string $id): StreamedResponse|JsonResponse
    {
        if (! $request->user()->can(self::PERMISSION)) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        $application = ReviewerApplication::findOrFail($id);
        if (! Storage::disk('private')->exists($application->cv_path)) {
            return $this->respond(null, 'The CV file could not be found.', 404);
        }

        return Storage::disk('private')->download($application->cv_path, Str::slug($application->name).'-cv.pdf');
    }

    /** Officers: approve into the reviewer pool — creates the external reviewer account. */
    public function approve(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->can(self::PERMISSION)) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        $validated = $request->validate([
            'expertise' => ['nullable', 'array', 'min:1', 'max:15'],
            'expertise.*' => ['required', 'string', 'max:80'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $application = ReviewerApplication::findOrFail($id);
        if ($application->status !== ReviewerApplication::PENDING) {
            return $this->respond(null, 'This application has already been decided.', 422);
        }

        $expertise = $validated['expertise'] ?? $application->expertise;

        [$user, $isNew] = DB::transaction(function () use ($application, $expertise, $validated, $request) {
            $user = User::withTrashed()->where('email', $application->email)->first();
            $isNew = ! $user;

            if ($isNew) {
                $user = User::create([
                    'name' => $application->name,
                    'title' => $application->title,
                    'email' => $application->email,
                    'phone' => $application->phone,
                    'password' => Hash::make(Str::random(40)),
                    'status' => 'active',
                    'registration_method' => 'reviewer_application',
                    'expertise' => $expertise,
                    'affiliation' => $application->organization,
                    'bio' => $application->bio,
                    'orcid' => $application->orcid,
                    'email_verified_at' => null,
                ]);
            } else {
                if ($user->trashed()) {
                    $user->restore();
                }
                $user->forceFill([
                    'status' => 'active',
                    'affiliation' => $user->affiliation ?: $application->organization,
                    'expertise' => collect($user->expertise ?? [])->merge($expertise)->unique()->values()->all(),
                ])->save();
            }

            $user->assignRole('external_reviewer');

            $application->update([
                'status' => ReviewerApplication::APPROVED,
                'expertise' => $expertise,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'review_note' => $validated['note'] ?? null,
                'user_id' => $user->id,
            ]);

            return [$user, $isNew];
        });

        AuditLogger::log('reviewer_application.approved', ReviewerApplication::class, $application->id, $request->user()->id, null, [
            'user_id' => $user->id,
            'new_account' => $isNew,
        ]);

        if ($isNew) {
            $link = $this->passwordLink($user);
            $this->mailApplicant($application, 'Welcome to the Reviewer Pool',
                "Your application to review proposals has been approved — welcome to the reviewer pool. Set your password to sign in: {$link} (the link works for 7 days; after that use \"Forgot password\" on the sign-in page). Before your first review you will be asked to accept the reviewer confidentiality agreement.");
        } else {
            $this->mailApplicant($application, 'Welcome to the Reviewer Pool',
                'Your application to review proposals has been approved — welcome to the reviewer pool. Sign in with your existing account; review invitations will appear under My Reviews.');
        }

        return $this->respond($application->fresh(['reviewedBy:id,name']), $isNew
            ? "{$application->name} is now in the reviewer pool. They have been emailed a link to set their password."
            : "{$application->name}'s existing account now has reviewer access.");
    }

    /** Officers: decline, with a reason the applicant is told. */
    public function reject(Request $request, string $id): JsonResponse
    {
        if (! $request->user()->can(self::PERMISSION)) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        $validated = $request->validate(['note' => ['required', 'string', 'min:10', 'max:1000']]);

        $application = ReviewerApplication::findOrFail($id);
        if ($application->status !== ReviewerApplication::PENDING) {
            return $this->respond(null, 'This application has already been decided.', 422);
        }

        $application->update([
            'status' => ReviewerApplication::REJECTED,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'review_note' => $validated['note'],
        ]);

        AuditLogger::log('reviewer_application.rejected', ReviewerApplication::class, $application->id, $request->user()->id, null, [
            'note' => $validated['note'],
        ]);

        $this->mailApplicant($application, 'Your Reviewer Application',
            "Thank you for your interest in reviewing proposals for us. We are not able to add you to the reviewer pool at this time. {$validated['note']}");

        return $this->respond($application->fresh(['reviewedBy:id,name']), 'Application declined. The applicant has been told.');
    }

    /** A link to set a first password, valid 7 days for an account like this. */
    private function passwordLink(User $user): string
    {
        $token = Str::random(64);
        DB::table('password_reset_tokens')->upsert(
            ['email' => $user->email, 'token' => hash('sha256', $token), 'created_at' => now()],
            ['email'],
            ['token', 'created_at'],
        );

        return config('app.url').'/reset-password?token='.$token.'&email='.urlencode($user->email);
    }

    /** Applicants have no account yet, so they get a plain notification email. */
    private function mailApplicant(ReviewerApplication $application, string $subject, string $message): void
    {
        try {
            SendRawMailJob::deliver(
                view('emails.notifications.generic', [
                    'recipient' => (object) ['name' => $application->name],
                    'notification_message' => $message,
                ])->render(),
                $application->email,
                $application->name,
                $subject,
            );
        } catch (\Throwable $e) {
            Log::error("Reviewer application email failed for {$application->email}: {$e->getMessage()}");
        }
    }

    private function notifyUser(User $user, string $event, array $data): void
    {
        try {
            StoreInAppNotificationJob::dispatchSync($user->id, $event, $data);
        } catch (\Throwable $e) {
            Log::error("Reviewer application notification failed: {$e->getMessage()}");
        }

        try {
            SendEmailNotificationJob::deliver($user, $event, $data);
        } catch (\Throwable $e) {
            Log::error("Reviewer application email failed: {$e->getMessage()}");
        }
    }

    private function respond(mixed $data, string $message, int $status = 200, array $meta = []): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => $meta], $status);
    }
}
