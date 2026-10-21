<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\Conference;
use App\Models\ConferenceRegistration;
use App\Models\ConferenceSession;
use App\Models\ConferenceSpeaker;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConferenceController extends Controller
{
    // ── Public ────────────────────────────────────────────────────────────────

    /** Public listing — only published conferences (or scheduled ones whose publish_at has passed). */
    public function publicIndex(Request $request): JsonResponse
    {
        $query = Conference::with(['speakers:id,conference_id,name,title,photo'])
            ->where('status', 'published')
            ->where(fn ($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()));

        if ($search = $request->query('search')) {
            $query->where(fn ($q) => $q
                ->where('title', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")
            );
        }

        if ($type = $request->query('location_type')) {
            $query->where('location_type', $type);
        }

        if ($tag = $request->query('tag')) {
            $query->whereJsonContains('tags', $tag);
        }

        $scope = $request->query('scope', 'upcoming'); // upcoming | past | all
        if ($scope === 'upcoming') {
            // Include both future AND ongoing (started but not yet ended) conferences
            $query->where(fn ($q) => $q
                ->where('start_date', '>=', now())
                ->orWhere(fn ($q2) => $q2->whereNotNull('end_date')->where('end_date', '>=', now()))
            )->orderBy('start_date');
        } elseif ($scope === 'past') {
            $query->where(fn ($q) => $q
                ->where('end_date', '<', now())
                ->orWhere(fn ($q2) => $q2->whereNull('end_date')->where('start_date', '<', now()))
            )->orderByDesc('start_date');
        } else {
            $query->orderByDesc('start_date');
        }

        return response()->json([
            'data' => $query->paginate(12),
            'message' => '',
            'errors' => [],
        ]);
    }

    /** Public detail by slug. */
    public function publicShow(string $slug): JsonResponse
    {
        $conference = Conference::with([
            'speakers' => fn ($q) => $q->orderBy('sort_order'),
            'sessions' => fn ($q) => $q->orderBy('starts_at')->orderBy('sort_order'),
            'sessions.speakers:id,name,photo,title',
        ])
            ->withCount(['registrations as active_registrations_count' => fn ($q) => $q->whereIn('status', ['pending', 'confirmed'])])
            ->where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();

        $data = $conference->toArray();
        $data['is_full'] = $conference->max_capacity
            && $conference->active_registrations_count >= $conference->max_capacity;
        $data['spots_remaining'] = $conference->max_capacity
            ? max(0, $conference->max_capacity - $conference->active_registrations_count)
            : null;

        return response()->json(['data' => $data, 'message' => '', 'errors' => []]);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $query = Conference::withCount(['speakers', 'sessions', 'registrations'])
            ->orderByDesc('created_at');

        if ($search = $request->query('search')) {
            $query->where('title', 'like', "%{$search}%");
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        return response()->json(['data' => $query->paginate(20), 'message' => '', 'errors' => []]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'timezone' => 'nullable|string|max:50',
            'location_type' => 'required|in:physical,virtual,hybrid',
            'location_address' => 'nullable|string',
            'virtual_link' => 'nullable|url',
            'status' => 'nullable|in:draft,published,archived',
            'publish_at' => 'nullable|date',
            'max_capacity' => 'nullable|integer|min:1',
            'registration_link' => 'nullable|url',
            'is_featured' => 'nullable|boolean',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'abstract_submission_open' => 'nullable|boolean',
            'abstract_deadline' => 'nullable|date',
        ]);

        $data['created_by'] = $request->user()->id;
        $data['slug'] = Str::slug($data['title']).'-'.Str::random(4);

        $conference = Conference::create($data);

        // Notify admins of new conference
        if (($data['status'] ?? 'draft') === 'published') {
            $this->notifyAdminsConferencePublished($conference);
        }

        return response()->json(['data' => $conference, 'message' => 'Conference created.', 'errors' => []], 201);
    }

    public function show(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::with(['speakers', 'sessions.speakers', 'registrations'])
            ->withCount(['speakers', 'sessions', 'registrations'])
            ->findOrFail($id);

        return response()->json(['data' => $conference, 'message' => '', 'errors' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::findOrFail($id);

        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'sometimes|date',
            'end_date' => 'nullable|date',
            'timezone' => 'nullable|string|max:50',
            'location_type' => 'sometimes|in:physical,virtual,hybrid',
            'location_address' => 'nullable|string',
            'virtual_link' => 'nullable|url',
            'status' => 'sometimes|in:draft,published,archived',
            'publish_at' => 'nullable|date',
            'max_capacity' => 'nullable|integer|min:1',
            'registration_link' => 'nullable|url',
            'is_featured' => 'nullable|boolean',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'abstract_submission_open' => 'nullable|boolean',
            'abstract_deadline' => 'nullable|date',
        ]);

        $wasPublished = $conference->status === 'published';
        $becomesPublished = isset($data['status']) && $data['status'] === 'published' && ! $wasPublished;
        $becomesArchived = isset($data['status']) && $data['status'] === 'archived' && $wasPublished;
        $detailsChanged = $wasPublished && array_intersect_key($data, array_flip(['start_date', 'end_date', 'location_type', 'location_address', 'virtual_link', 'title']));

        $conference->update($data);
        $conference->refresh();

        if ($becomesPublished) {
            $this->notifyAdminsConferencePublished($conference);
        }

        if ($detailsChanged && ! $becomesPublished) {
            $this->notifyRegistrantsConferenceUpdated($conference);
        }

        if ($becomesArchived) {
            $this->notifyRegistrantsConferenceCancelled($conference);
        }

        return response()->json(['data' => $conference, 'message' => 'Conference updated.', 'errors' => []]);
    }

    public function destroy(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::findOrFail($id);

        if ($conference->status === 'published') {
            $this->notifyRegistrantsConferenceCancelled($conference);
        }

        $conference->delete();

        return response()->json(['message' => 'Conference deleted.', 'errors' => []]);
    }

    public function uploadBanner(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $request->validate(['file' => 'required|image|max:4096']);

        $conference = Conference::findOrFail($id);
        $path = $request->file('file')->store('conferences/banners', 'public');
        $conference->update(['banner_image' => Storage::url($path)]);

        return response()->json(['data' => ['url' => $conference->banner_image], 'message' => 'Banner uploaded.', 'errors' => []]);
    }

    // ── Speakers ──────────────────────────────────────────────────────────────

    public function storeSpeaker(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::findOrFail($id);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'title' => 'nullable|string|max:255',
            'bio' => 'nullable|string',
            'email' => 'nullable|email',
            'website' => 'nullable|url',
            'twitter' => 'nullable|string|max:100',
            'linkedin' => 'nullable|string|max:100',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $speaker = $conference->speakers()->create($data);

        return response()->json(['data' => $speaker, 'message' => 'Speaker added.', 'errors' => []], 201);
    }

    public function updateSpeaker(Request $request, string $id, string $speakerId): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $speaker = ConferenceSpeaker::where('conference_id', $id)->findOrFail($speakerId);

        $speaker->update($request->validate([
            'name' => 'sometimes|string|max:255',
            'title' => 'nullable|string|max:255',
            'bio' => 'nullable|string',
            'email' => 'nullable|email',
            'website' => 'nullable|url',
            'twitter' => 'nullable|string|max:100',
            'linkedin' => 'nullable|string|max:100',
            'sort_order' => 'nullable|integer|min:0',
        ]));

        return response()->json(['data' => $speaker->fresh(), 'message' => 'Speaker updated.', 'errors' => []]);
    }

    public function destroySpeaker(string $id, string $speakerId, Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ConferenceSpeaker::where('conference_id', $id)->findOrFail($speakerId)->delete();

        return response()->json(['message' => 'Speaker removed.', 'errors' => []]);
    }

    public function uploadSpeakerPhoto(Request $request, string $id, string $speakerId): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $request->validate(['file' => 'required|image|max:2048']);

        $speaker = ConferenceSpeaker::where('conference_id', $id)->findOrFail($speakerId);
        $path = $request->file('file')->store('conferences/speakers', 'public');
        $speaker->update(['photo' => Storage::url($path)]);

        return response()->json(['data' => ['url' => $speaker->photo], 'message' => 'Photo uploaded.', 'errors' => []]);
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    public function storeSession(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::findOrFail($id);

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'track' => 'nullable|string|max:100',
            'starts_at' => 'required|date',
            'ends_at' => 'nullable|date|after:starts_at',
            'room' => 'nullable|string|max:100',
            'type' => 'required|in:keynote,talk,workshop,panel,break,other',
            'sort_order' => 'nullable|integer|min:0',
            'speaker_ids' => 'nullable|array',
            'speaker_ids.*' => 'uuid|exists:conference_speakers,id',
        ]);

        $speakerIds = $data['speaker_ids'] ?? [];
        unset($data['speaker_ids']);

        $session = $conference->sessions()->create($data);

        if ($speakerIds) {
            $session->speakers()->sync($speakerIds);
        }

        return response()->json(['data' => $session->load('speakers'), 'message' => 'Session added.', 'errors' => []], 201);
    }

    public function updateSession(Request $request, string $id, string $sessionId): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $session = ConferenceSession::where('conference_id', $id)->findOrFail($sessionId);

        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'track' => 'nullable|string|max:100',
            'starts_at' => 'sometimes|date',
            'ends_at' => 'nullable|date',
            'room' => 'nullable|string|max:100',
            'type' => 'sometimes|in:keynote,talk,workshop,panel,break,other',
            'sort_order' => 'nullable|integer|min:0',
            'speaker_ids' => 'nullable|array',
            'speaker_ids.*' => 'uuid|exists:conference_speakers,id',
        ]);

        $speakerIds = $data['speaker_ids'] ?? null;
        unset($data['speaker_ids']);

        $session->update($data);

        if ($speakerIds !== null) {
            $session->speakers()->sync($speakerIds);
        }

        return response()->json(['data' => $session->fresh()->load('speakers'), 'message' => 'Session updated.', 'errors' => []]);
    }

    public function destroySession(string $id, string $sessionId, Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ConferenceSession::where('conference_id', $id)->findOrFail($sessionId)->delete();

        return response()->json(['message' => 'Session removed.', 'errors' => []]);
    }

    // ── Registrations ─────────────────────────────────────────────────────────

    /** Public registration form submit. */
    public function register(Request $request, string $slug): JsonResponse
    {
        $conference = Conference::where('slug', $slug)->where('status', 'published')->firstOrFail();

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'organization' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
        ]);

        if ($conference->max_capacity) {
            $count = $conference->registrations()->whereIn('status', ['pending', 'confirmed'])->count();
            if ($count >= $conference->max_capacity) {
                return response()->json(['message' => 'This conference is fully booked.', 'errors' => []], 422);
            }
        }

        $existing = $conference->registrations()->where('email', $data['email'])->first();
        if ($existing) {
            return response()->json(['message' => 'You are already registered for this conference.', 'errors' => []], 422);
        }

        $reg = $conference->registrations()->create([...$data, 'registered_at' => now()]);

        // Send confirmation to registrant
        $this->sendRegistrationConfirmation($conference, $reg);

        // Alert admins of new registration
        $this->notifyAdminsNewRegistration($conference, $reg);

        return response()->json(['data' => $reg, 'message' => 'Registration successful! A confirmation email has been sent to you.', 'errors' => []], 201);
    }

    /** Admin — list registrations for a conference. */
    public function registrations(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::findOrFail($id);

        return response()->json([
            'data' => $conference->registrations()->orderByDesc('registered_at')->get(),
            'message' => '',
            'errors' => [],
        ]);
    }

    /** Admin — export registrations as CSV. */
    public function exportRegistrations(string $id, Request $request): StreamedResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            abort(403);
        }

        $conference = Conference::findOrFail($id);
        $regs = $conference->registrations()->orderByDesc('registered_at')->get();

        return response()->stream(function () use ($regs) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Name', 'Email', 'Organization', 'Phone', 'Status', 'Registered At']);

            foreach ($regs as $reg) {
                fputcsv($handle, [
                    $reg->name,
                    $reg->email,
                    $reg->organization ?? '',
                    $reg->phone ?? '',
                    $reg->status,
                    $reg->registered_at?->format('Y-m-d H:i'),
                ]);
            }

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.Str::slug($conference->title).'-registrations.csv"',
            'Cache-Control' => 'no-cache',
        ]);
    }

    // ── Email helpers ─────────────────────────────────────────────────────────

    private function senderName(): string
    {
        return AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name');
    }

    private function sendRegistrationConfirmation(Conference $conference, ConferenceRegistration $reg): void
    {
        SendRawMailJob::deliver(
            view('emails.conference_registration', [
                'conference' => $conference,
                'registration' => $reg,
                'senderName' => $this->senderName(),
            ])->render(),
            $reg->email,
            $reg->name,
            "Registration Confirmed — {$conference->title}"
        );
    }

    private function notifyAdminsNewRegistration(Conference $conference, ConferenceRegistration $reg): void
    {
        $admins = User::whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin']))->get();

        foreach ($admins as $admin) {
            if (! $admin->email) {
                continue;
            }

            SendRawMailJob::deliver(
                view('emails.conference_registration_admin', [
                    'conference' => $conference,
                    'registration' => $reg,
                    'admin' => $admin,
                    'senderName' => $this->senderName(),
                ])->render(),
                $admin->email,
                $admin->name,
                "New Registration — {$conference->title}"
            );
        }
    }

    private function notifyAdminsConferencePublished(Conference $conference): void
    {
        $admins = User::whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin']))->get();

        foreach ($admins as $admin) {
            if (! $admin->email) {
                continue;
            }

            SendRawMailJob::deliver(
                view('emails.conference_published', [
                    'conference' => $conference,
                    'admin' => $admin,
                    'senderName' => $this->senderName(),
                ])->render(),
                $admin->email,
                $admin->name,
                "Conference Published — {$conference->title}"
            );
        }
    }

    private function notifyRegistrantsConferenceUpdated(Conference $conference): void
    {
        $registrants = $conference->registrations()
            ->whereIn('status', ['pending', 'confirmed'])
            ->get();

        foreach ($registrants as $reg) {
            SendRawMailJob::deliver(
                view('emails.conference_updated', [
                    'conference' => $conference,
                    'registration' => $reg,
                    'senderName' => $this->senderName(),
                ])->render(),
                $reg->email,
                $reg->name,
                "Conference Update — {$conference->title}"
            );
        }
    }

    private function notifyRegistrantsConferenceCancelled(Conference $conference): void
    {
        $registrants = $conference->registrations()
            ->whereIn('status', ['pending', 'confirmed'])
            ->get();

        foreach ($registrants as $reg) {
            SendRawMailJob::deliver(
                view('emails.conference_cancelled', [
                    'conference' => $conference,
                    'registration' => $reg,
                    'senderName' => $this->senderName(),
                ])->render(),
                $reg->email,
                $reg->name,
                "Conference Cancelled — {$conference->title}"
            );
        }
    }
}
