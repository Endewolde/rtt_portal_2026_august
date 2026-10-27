<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Public side of conference abstracts: submit, save a draft, resubmit after a revision
 * request, track, withdraw — all keyed by the submitter's private tracking token.
 */
class AbstractController extends Controller
{
    /** Statuses a submitter may still edit through their token. */
    private const EDITABLE = ['draft', 'revision_requested'];

    public function store(Request $request, string $slug): JsonResponse
    {
        $conference = Conference::where('slug', $slug)->where('status', 'published')->firstOrFail();

        $data = $request->validate([
            'submitter_name' => 'required|string|max:255',
            'submitter_email' => 'required|email|max:255',
            'submitter_affiliation' => 'nullable|string|max:255',
            'co_authors' => 'nullable|array|max:20',
            'co_authors.*.name' => 'required|string|max:255',
            'co_authors.*.affiliation' => 'nullable|string|max:255',
            'title' => 'required|string|max:500',
            'body' => 'required|string|min:50|max:5000',
            'keywords' => 'nullable|array|max:10',
            'keywords.*' => 'string|max:80',
            'presentation_type' => 'required|in:oral,poster,workshop,panel,other',
            'action' => 'required|in:draft,submit',
            'revision_token' => 'nullable|string',
            'file' => 'nullable|file|mimes:pdf,doc,docx|max:5120',
        ]);

        $status = $data['action'] === 'submit' ? 'submitted' : 'draft';
        $revisionToken = $data['revision_token'] ?? null;
        unset($data['action'], $data['revision_token'], $data['file']);
        $data['submitter_email'] = Str::lower(trim($data['submitter_email']));
        $data['word_count'] = str_word_count(strip_tags($data['body']));

        $abstract = $revisionToken
            ? ConferenceAbstract::where('submission_token', $revisionToken)->where('conference_id', $conference->id)->first()
            : null;

        if ($revisionToken && (! $abstract || ! in_array($abstract->status, self::EDITABLE, true))) {
            return response()->json([
                'message' => 'This link can no longer be used to edit the abstract — it has been submitted, decided or withdrawn.',
                'errors' => [],
            ], 422);
        }

        // New work (and drafts) respect the call; a requested revision is welcome after the deadline.
        if (! $abstract || $abstract->status === 'draft') {
            if (! $conference->abstract_submission_open) {
                return response()->json(['message' => 'Abstract submissions are not open for this conference.', 'errors' => []], 422);
            }
            if ($conference->abstract_deadline && $conference->abstract_deadline->isPast()) {
                return response()->json(['message' => 'The submission deadline has passed.', 'errors' => []], 422);
            }
        }

        $wasRevision = $abstract?->status === 'revision_requested';

        if ($abstract) {
            $abstract->update([
                ...$data,
                // A resubmitted revision goes straight back to its reviewers.
                'status' => $status === 'submitted' && $wasRevision && $abstract->reviews()->exists() ? 'under_review' : $status,
                'submitted_at' => $status === 'submitted' ? now() : $abstract->submitted_at,
            ]);
        } else {
            $abstract = ConferenceAbstract::create([
                ...$data,
                'conference_id' => $conference->id,
                'status' => $status,
                'submitted_at' => $status === 'submitted' ? now() : null,
            ]);
        }

        if ($request->hasFile('file')) {
            $path = $request->file('file')->store("abstracts/{$conference->id}", 'public');
            $abstract->update(['file_path' => Storage::url($path)]);
        }

        if ($status === 'submitted') {
            if ($wasRevision) {
                // The revised version is reviewed afresh by the same reviewers.
                $abstract->reviews()->update(['score' => null, 'recommendation' => null, 'comments' => null, 'submitted_at' => null]);
            }
            $this->sendSubmissionConfirmation($abstract->refresh(), $conference);
            $this->notifyOrganisers($abstract, $conference, $wasRevision);
        }

        return response()->json([
            'data' => $abstract->fresh()->makeVisible('submission_token'),
            'message' => match (true) {
                $status === 'draft' => 'Draft saved. Keep your tracking token to come back and finish it.',
                $wasRevision => 'Revised abstract resubmitted — the committee will review it again.',
                default => 'Abstract submitted! A confirmation email has been sent.',
            },
            'errors' => [],
        ], $revisionToken ? 200 : 201);
    }

    public function track(string $token): JsonResponse
    {
        $abstract = ConferenceAbstract::with('conference:id,title,slug,start_date')
            ->where('submission_token', $token)
            ->firstOrFail()
            ->makeVisible('submission_token');

        return response()->json(['data' => $abstract->makeHidden('admin_notes')->toArray() + [
            'feedback' => in_array($abstract->status, ['accepted', 'rejected', 'revision_requested'], true) ? $abstract->admin_notes : null,
        ], 'message' => '', 'errors' => []]);
    }

    public function withdraw(string $token): JsonResponse
    {
        $abstract = ConferenceAbstract::where('submission_token', $token)
            ->whereIn('status', ['draft', 'submitted', 'under_review', 'revision_requested'])
            ->firstOrFail();

        $abstract->update(['status' => 'withdrawn']);

        return response()->json(['message' => 'Your abstract has been withdrawn.', 'errors' => []]);
    }

    /**
     * "My abstracts": the list is never shown just for typing an email address. A link
     * is emailed to that address instead, and only the link opens the list.
     */
    public function requestMine(Request $request): JsonResponse
    {
        $email = Str::lower(trim($request->validate(['email' => 'required|email|max:255'])['email']));

        if (ConferenceAbstract::where('submitter_email', $email)->exists()) {
            $key = Str::random(48);
            Cache::put("my-abstracts:{$key}", $email, now()->addDay());

            SendRawMailJob::deliver(
                view('emails.abstracts_access_link', [
                    'url' => rtrim(config('app.url'), '/').'/my-abstracts?key='.$key,
                    'senderName' => $this->senderName(),
                ])->render(),
                $email,
                $email,
                'Your conference abstracts'
            );
        }

        // Same answer either way, so nobody can find out who has submitted.
        return response()->json(['message' => 'If we have abstracts for that address, a link to them is on its way. It works for 24 hours.', 'errors' => []]);
    }

    public function mine(Request $request): JsonResponse
    {
        $key = (string) $request->query('key', '');
        $email = $key !== '' ? Cache::get("my-abstracts:{$key}") : null;
        if (! $email) {
            return response()->json(['data' => null, 'message' => 'This link has expired. Ask for a new one.', 'errors' => []], 403);
        }

        $abstracts = ConferenceAbstract::with('conference:id,title,slug,start_date')
            ->where('submitter_email', $email)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (ConferenceAbstract $a) => $a->makeVisible('submission_token')->makeHidden('admin_notes')->toArray() + [
                'feedback' => in_array($a->status, ['accepted', 'rejected', 'revision_requested'], true) ? $a->admin_notes : null,
            ]);

        return response()->json(['data' => $abstracts, 'meta' => ['email' => $email], 'message' => '', 'errors' => []]);
    }

    private function senderName(): string
    {
        return AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name');
    }

    private function sendSubmissionConfirmation(ConferenceAbstract $abstract, Conference $conference): void
    {
        SendRawMailJob::deliver(
            view('emails.abstract_submission_received', compact('abstract', 'conference') + ['senderName' => $this->senderName()])->render(),
            $abstract->submitter_email,
            $abstract->submitter_name,
            "Abstract Received — {$conference->title}"
        );
    }

    private function notifyOrganisers(ConferenceAbstract $abstract, Conference $conference, bool $revised): void
    {
        foreach (User::permission('conferences.manage')->where('status', 'active')->whereNotNull('email')->get() as $admin) {
            SendRawMailJob::deliver(
                view('emails.abstract_admin_alert', compact('abstract', 'conference', 'admin') + ['senderName' => $this->senderName()])->render(),
                $admin->email,
                $admin->name,
                ($revised ? 'Revised Abstract — ' : 'New Abstract — ').$conference->title
            );
        }
    }
}
