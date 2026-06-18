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
use Illuminate\Support\Facades\Storage;

class AbstractController extends Controller
{
    public function store(Request $request, string $slug): JsonResponse
    {
        $conference = Conference::where('slug', $slug)->where('status', 'published')->firstOrFail();

        if (! $conference->abstract_submission_open) {
            return response()->json(['message' => 'Abstract submissions are not open for this conference.', 'errors' => []], 422);
        }

        if ($conference->abstract_deadline && $conference->abstract_deadline->isPast()) {
            return response()->json(['message' => 'The submission deadline has passed.', 'errors' => []], 422);
        }

        $data = $request->validate([
            'submitter_name' => 'required|string|max:255',
            'submitter_email' => 'required|email|max:255',
            'submitter_affiliation' => 'nullable|string|max:255',
            'co_authors' => 'nullable|array',
            'co_authors.*.name' => 'required|string|max:255',
            'co_authors.*.affiliation' => 'nullable|string|max:255',
            'title' => 'required|string|max:500',
            'body' => 'required|string|min:50|max:5000',
            'keywords' => 'nullable|array',
            'keywords.*' => 'string|max:80',
            'presentation_type' => 'required|in:oral,poster,workshop,panel,other',
            'action' => 'required|in:draft,submit',
            'revision_token' => 'nullable|string',
        ]);

        $status = $data['action'] === 'submit' ? 'submitted' : 'draft';
        $revisionToken = $data['revision_token'] ?? null;
        unset($data['action'], $data['revision_token']);

        $data['word_count'] = str_word_count(strip_tags($data['body']));

        // Resubmission path — update existing abstract via token (any non-final status allowed)
        if ($revisionToken) {
            $abstract = ConferenceAbstract::where('submission_token', $revisionToken)
                ->where('conference_id', $conference->id)
                ->whereNotIn('status', ['accepted', 'withdrawn'])
                ->first();

            if (! $abstract) {
                return response()->json([
                    'message' => 'Resubmission link is invalid, expired, or the abstract has already been accepted.',
                    'errors' => [],
                ], 422);
            }

            $abstract->update([
                ...$data,
                'status' => $status,
                'submitted_at' => $status === 'submitted' ? now() : $abstract->submitted_at,
            ]);

            if ($request->hasFile('file')) {
                $request->validate(['file' => 'file|mimes:pdf,doc,docx|max:5120']);
                $path = $request->file('file')->store("abstracts/{$conference->id}", 'public');
                $abstract->update(['file_path' => Storage::url($path)]);
            }

            // Clear all previous reviews so reviewers can evaluate the revised version fresh
            if ($status === 'submitted') {
                $abstract->reviews()->update([
                    'score' => null,
                    'recommendation' => null,
                    'comments' => null,
                    'submitted_at' => null,
                ]);
                $this->sendSubmissionConfirmation($abstract->refresh(), $conference);
            }

            return response()->json([
                'data' => $abstract->fresh(),
                'message' => $status === 'submitted'
                    ? 'Revised abstract resubmitted! Previous reviews have been cleared and the committee will re-evaluate.'
                    : 'Draft saved.',
                'errors' => [],
            ]);
        }

        // New submission path
        $data['conference_id'] = $conference->id;
        $data['status'] = $status;

        if ($status === 'submitted') {
            $data['submitted_at'] = now();
        }

        $abstract = ConferenceAbstract::create($data);

        if ($request->hasFile('file')) {
            $request->validate(['file' => 'file|mimes:pdf,doc,docx|max:5120']);
            $path = $request->file('file')->store("abstracts/{$conference->id}", 'public');
            $abstract->update(['file_path' => Storage::url($path)]);
        }

        if ($status === 'submitted') {
            $this->sendSubmissionConfirmation($abstract, $conference);
            $this->notifyAdminsNewAbstract($abstract, $conference);
        }

        return response()->json([
            'data' => $abstract,
            'message' => $status === 'submitted'
                ? 'Abstract submitted! A confirmation email has been sent.'
                : 'Draft saved.',
            'errors' => [],
        ], 201);
    }

    public function track(string $token): JsonResponse
    {
        $abstract = ConferenceAbstract::with('conference:id,title,slug,start_date')
            ->where('submission_token', $token)
            ->firstOrFail();

        return response()->json(['data' => $abstract, 'message' => '', 'errors' => []]);
    }

    public function withdraw(string $token): JsonResponse
    {
        $abstract = ConferenceAbstract::where('submission_token', $token)
            ->whereIn('status', ['draft', 'submitted', 'under_review', 'revision_requested'])
            ->firstOrFail();

        $abstract->update(['status' => 'withdrawn']);

        return response()->json(['message' => 'Your abstract has been withdrawn.', 'errors' => []]);
    }

    public function mine(Request $request): JsonResponse
    {
        $email = $request->validate(['email' => 'required|email'])['email'];

        $abstracts = ConferenceAbstract::with('conference:id,title,slug,start_date')
            ->where('submitter_email', $email)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $abstracts, 'message' => '', 'errors' => []]);
    }

    private function senderName(): string
    {
        return AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name');
    }

    private function sendSubmissionConfirmation(ConferenceAbstract $abstract, Conference $conference): void
    {
        SendRawMailJob::dispatchSync(
            view('emails.abstract_submission_received', compact('abstract', 'conference') + ['senderName' => $this->senderName()])->render(),
            $abstract->submitter_email,
            $abstract->submitter_name,
            "Abstract Received — {$conference->title}"
        );
    }

    private function notifyAdminsNewAbstract(ConferenceAbstract $abstract, Conference $conference): void
    {
        foreach (User::whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin']))->get() as $admin) {
            if (! $admin->email) {
                continue;
            }
            SendRawMailJob::dispatchSync(
                view('emails.abstract_admin_alert', compact('abstract', 'conference', 'admin') + ['senderName' => $this->senderName()])->render(),
                $admin->email,
                $admin->name,
                "New Abstract — {$conference->title}"
            );
        }
    }
}
