<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceRegistration;
use App\Models\ConferenceRegistrationType;
use App\Models\ConferenceSession;
use App\Models\ConferenceSpeaker;
use App\Models\User;
use App\Services\ConferenceAttendanceService;
use App\Support\AuditLogger;
use App\Support\ConferenceAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConferenceController extends Controller
{
    // ── Public ────────────────────────────────────────────────────────────────

    /** Public listing — only published conferences (or scheduled ones whose publish_at has passed). */
    /** Review settings sent with a conference: who sees whom, its tracks and its scoring rubric. */
    private const REVIEW_SETUP_RULES = [
        'review_mode' => 'sometimes|in:double_blind,single_blind,open',
        'tracks' => 'sometimes|array|max:30',
        'tracks.*.id' => 'nullable|uuid',
        'tracks.*.name' => 'required|string|max:150',
        'tracks.*.description' => 'nullable|string|max:500',
        'review_criteria' => 'sometimes|array|max:12',
        'review_criteria.*.id' => 'nullable|uuid',
        'review_criteria.*.name' => 'required|string|max:150',
        'review_criteria.*.description' => 'nullable|string|max:500',
        'review_criteria.*.weight' => 'required|integer|min:1|max:10',
        'registration_types' => 'sometimes|array|max:12',
        'registration_types.*.id' => 'nullable|uuid',
        'registration_types.*.name' => 'required|string|max:150',
        'registration_types.*.description' => 'nullable|string|max:500',
        'registration_types.*.capacity' => 'nullable|integer|min:1|max:100000',
        'registration_questions' => 'sometimes|nullable|array|max:15',
        'registration_questions.*.id' => 'required|string|max:40',
        'registration_questions.*.label' => 'required|string|max:200',
        'registration_questions.*.type' => 'required|in:text,textarea,select,checkbox',
        'registration_questions.*.options' => 'nullable|array|max:20',
        'registration_questions.*.options.*' => 'string|max:100',
        'registration_questions.*.required' => 'boolean',
        'waitlist_enabled' => 'sometimes|boolean',
        'feedback_open' => 'sometimes|boolean',
        'book_published' => 'sometimes|boolean',
    ];

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
            'sessions.abstracts' => fn ($q) => $q->where('status', 'accepted'),
            'tracks:id,conference_id,name,description,sort_order',
            'registrationTypes' => fn ($q) => $q->withCount(['registrations as taken' => fn ($r) => $r->whereIn('status', ConferenceRegistration::HOLDS_SEAT)]),
        ])
            ->withCount(['registrations as active_registrations_count' => fn ($q) => $q->whereIn('status', ['pending', 'confirmed'])])
            ->where('slug', $slug)
            ->where('status', 'published')
            ->where(fn ($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()))
            ->firstOrFail();

        // The join link goes to registrants by email; the public page only says there is one.
        $data = $conference->toArray();
        // The programme shows each accepted talk by title and presenter only — no emails.
        foreach ($conference->sessions as $i => $session) {
            $data['sessions'][$i]['abstracts'] = $session->abstracts->map(fn (ConferenceAbstract $a) => [
                'id' => $a->id,
                'title' => $a->title,
                'presenter' => $a->presenterName(),
                'authors' => collect($a->authors())->pluck('name')->all(),
                'type' => $a->finalType(),
            ])->values()->all();
        }
        $data['registration_types'] = $conference->registrationTypes->map(fn ($t) => [
            'id' => $t->id, 'name' => $t->name, 'description' => $t->description,
            'is_full' => $t->capacity !== null && $t->taken >= $t->capacity,
            'spots_remaining' => $t->capacity !== null ? max(0, $t->capacity - $t->taken) : null,
        ])->values()->all();
        $data['registration_questions'] = $conference->registration_questions ?? [];
        $data['has_virtual_link'] = filled($conference->virtual_link);
        $data['registration_closed'] = $conference->is_past;
        $data['is_full'] = $conference->max_capacity
            && $conference->active_registrations_count >= $conference->max_capacity;
        $data['spots_remaining'] = $conference->max_capacity
            ? max(0, $conference->max_capacity - $conference->active_registrations_count)
            : null;

        return response()->json(['data' => $data, 'message' => '', 'errors' => []]);
    }

    /**
     * The conference as an iCalendar file: the whole event, plus each programme session
     * that has a time. ?session={id} gives just that one session.
     */
    public function calendar(Request $request, string $slug): Response
    {
        $conference = Conference::with(['sessions' => fn ($q) => $q->whereNotNull('starts_at')->orderBy('starts_at')])
            ->where('slug', $slug)->where('status', 'published')->firstOrFail();

        $sessionId = $request->query('session');
        $stamp = now()->utc()->format('Ymd\THis\Z');
        $utc = fn ($date) => $date->copy()->utc()->format('Ymd\THis\Z');
        $text = fn (?string $v) => str_replace(['\\', ';', ',', "\r\n", "\n"], ['\\\\', '\\;', '\\,', '\\n', '\\n'], (string) $v);
        $url = rtrim(config('app.url'), '/').'/conferences/'.$conference->slug;
        $where = $conference->location_type === 'virtual' ? 'Online' : $conference->location_address;

        $events = [];
        if (! $sessionId) {
            $events[] = [
                'uid' => $conference->id, 'start' => $conference->start_date, 'end' => $conference->end_date ?? $conference->start_date,
                'title' => $conference->title, 'where' => $where, 'description' => Str::limit(strip_tags((string) $conference->description), 500),
            ];
        }
        foreach ($conference->sessions as $session) {
            if ($sessionId && $session->id !== $sessionId) {
                continue;
            }
            $events[] = [
                'uid' => $session->id, 'start' => $session->starts_at, 'end' => $session->ends_at ?? $session->starts_at->copy()->addHour(),
                'title' => $session->title.' — '.$conference->title, 'where' => $session->room ?: $where,
                'description' => trim(($session->chair ? "Chair: {$session->chair}\n" : '').strip_tags((string) $session->description)),
            ];
        }
        abort_if($events === [], 404);

        $lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//'.$text(config('app.name')).'//Conferences//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
        foreach ($events as $e) {
            $lines = [
                ...$lines,
                'BEGIN:VEVENT',
                'UID:'.$e['uid'].'@'.parse_url(config('app.url'), PHP_URL_HOST),
                'DTSTAMP:'.$stamp,
                'DTSTART:'.$utc($e['start']),
                'DTEND:'.$utc($e['end']),
                'SUMMARY:'.$text($e['title']),
                ...($e['where'] ? ['LOCATION:'.$text($e['where'])] : []),
                ...($e['description'] ? ['DESCRIPTION:'.$text($e['description'])] : []),
                'URL:'.$url,
                'END:VEVENT',
            ];
        }
        $lines[] = 'END:VCALENDAR';

        // Lines longer than 75 octets are folded, as RFC 5545 requires.
        $fold = function (string $line): string {
            $out = '';
            $chunk = '';
            foreach (mb_str_split($line) as $char) {
                if (strlen($chunk.$char) > 74) {
                    $out .= $chunk."\r\n ";
                    $chunk = '';
                }
                $chunk .= $char;
            }

            return $out.$chunk;
        };
        $body = collect($lines)->map($fold)->join("\r\n")."\r\n";

        return response($body, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.Str::slug($conference->title).($sessionId ? '-session' : '').'.ics"',
        ]);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        // Committee members see the conferences they serve on; organisers see them all.
        if (! ConferenceAccess::isOrganiser($user) && ConferenceAccess::conferenceIds($user) === []) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $query = Conference::with(['tracks', 'reviewCriteria', 'registrationTypes'])->withCount([
            'speakers',
            'sessions',
            'registrations as registrations_count' => fn ($q) => $q->whereIn('status', ['pending', 'confirmed']),
            'abstracts as abstracts_count' => fn ($q) => $q->where('status', '!=', 'draft'),
        ])->orderByDesc('start_date')
            ->when(! ConferenceAccess::isOrganiser($user), fn ($q) => $q->whereIn('id', ConferenceAccess::conferenceIds($user)));

        if ($search = $request->query('search')) {
            $query->where('title', 'like', "%{$search}%");
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        match ($request->query('when')) {
            'upcoming' => $query->where(fn ($q) => $q->where('start_date', '>=', now())->orWhere('end_date', '>=', now())),
            'past' => $query->where(fn ($q) => $q->where('end_date', '<', now())->orWhere(fn ($q2) => $q2->whereNull('end_date')->where('start_date', '<', now()))),
            default => null,
        };

        $page = $query->paginate(min(200, max(1, (int) $request->query('per_page', 20))))->through(fn (Conference $c) => $c->makeVisible('virtual_link'));

        // Figures for the whole programme, not just this page.
        $stats = [
            'total' => Conference::count(),
            'published' => Conference::where('status', 'published')->count(),
            'upcoming' => Conference::where('status', '!=', 'archived')->where(fn ($q) => $q->where('start_date', '>=', now())->orWhere('end_date', '>=', now()))->count(),
            'registrations' => ConferenceRegistration::whereIn('status', ['pending', 'confirmed'])->count(),
            'abstracts_open' => Conference::where('status', 'published')->where('abstract_submission_open', true)
                ->where(fn ($q) => $q->whereNull('abstract_deadline')->orWhere('abstract_deadline', '>=', now()))->count(),
        ];

        return response()->json(['data' => $page->toArray() + ['stats' => $stats], 'message' => '', 'errors' => []]);
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
            'camera_ready_deadline' => 'nullable|date',
            ...self::REVIEW_SETUP_RULES,
        ]);

        $data['created_by'] = $request->user()->id;
        $data['slug'] = Str::slug($data['title']).'-'.Str::random(4);
        $setup = array_intersect_key($data, array_flip(['tracks', 'review_criteria', 'registration_types']));
        unset($data['tracks'], $data['review_criteria'], $data['registration_types']);

        $conference = Conference::create($data);
        $this->syncReviewSetup($conference, $setup);
        AuditLogger::log('conference.created', 'Conference', $conference->id, $request->user()->id, null, ['target_name' => $conference->title], 201);

        // Notify admins of new conference
        if (($data['status'] ?? 'draft') === 'published') {
            $this->notifyAdminsConferencePublished($conference);
        }

        return response()->json(['data' => $conference->load(['tracks', 'reviewCriteria', 'registrationTypes'])->makeVisible('virtual_link'), 'message' => 'Conference created.', 'errors' => []], 201);
    }

    public function show(string $id, Request $request): JsonResponse
    {
        if (! ConferenceAccess::checksIn($request->user(), $id) && ! ConferenceAccess::roles($request->user())->contains('conference_id', $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::with(['speakers', 'sessions' => fn ($q) => $q->withCount(['abstracts' => fn ($a) => $a->where('status', 'accepted')]), 'sessions.speakers', 'tracks', 'reviewCriteria', 'registrationTypes', 'registrations.type:id,name', 'registrations' => fn ($q) => $q->orderByDesc('registered_at')])
            ->withCount([
                'speakers',
                'sessions',
                'registrations as registrations_count' => fn ($q) => $q->whereIn('status', ['pending', 'confirmed']),
                'abstracts as abstracts_count' => fn ($q) => $q->where('status', '!=', 'draft'),
            ])
            ->findOrFail($id)
            ->makeVisible('virtual_link');

        $user = $request->user();
        // Registrants' details are for the desk and the chairs; a track chair has no need of them.
        if (! ConferenceAccess::checksIn($user, $id)) {
            $conference->setRelation('registrations', collect());
        }

        return response()->json(['data' => $conference->toArray() + [
            'my_access' => [
                'manages' => ConferenceAccess::manages($user, $id),
                'checks_in' => ConferenceAccess::checksIn($user, $id),
                'organiser' => ConferenceAccess::isOrganiser($user),
            ],
        ], 'message' => '', 'errors' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        // A conference's chair runs it as an organiser would.
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::findOrFail($id);

        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'sometimes|date',
            'end_date' => ['nullable', 'date', function ($attr, $value, $fail) use ($request, $conference) {
                $start = $request->input('start_date', $conference->start_date);
                if ($value && $start && strtotime((string) $value) < strtotime((string) $start)) {
                    $fail('The end date must be on or after the start date.');
                }
            }],
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
            'camera_ready_deadline' => 'nullable|date',
            ...self::REVIEW_SETUP_RULES,
        ]);

        $wasPublished = $conference->status === 'published';
        $becomesPublished = isset($data['status']) && $data['status'] === 'published' && ! $wasPublished;
        // Archiving a conference that is over is housekeeping, not a cancellation.
        $becomesArchived = isset($data['status']) && $data['status'] === 'archived' && $wasPublished && ! $conference->is_past;
        $detailsChanged = $wasPublished && array_intersect_key($data, array_flip(['start_date', 'end_date', 'location_type', 'location_address', 'virtual_link', 'title']));

        $setup = array_intersect_key($data, array_flip(['tracks', 'review_criteria', 'registration_types']));
        unset($data['tracks'], $data['review_criteria'], $data['registration_types']);
        $conference->update($data);
        $this->syncReviewSetup($conference, $setup);
        $conference->refresh();
        AuditLogger::log('conference.updated', 'Conference', $conference->id, $request->user()->id, null, ['target_name' => $conference->title, 'fields' => array_keys($data + $setup)], 200);

        if ($becomesPublished) {
            $this->notifyAdminsConferencePublished($conference);
        }

        if ($detailsChanged && ! $becomesPublished) {
            $this->notifyRegistrantsConferenceUpdated($conference);
        }

        if ($becomesArchived) {
            $this->notifyRegistrantsConferenceCancelled($conference);
        }

        return response()->json(['data' => $conference->load(['tracks', 'reviewCriteria', 'registrationTypes'])->makeVisible('virtual_link'), 'message' => 'Conference updated.', 'errors' => []]);
    }

    public function destroy(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::findOrFail($id);

        if ($conference->status === 'published' && ! $conference->is_past) {
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
            'chair' => 'nullable|string|max:150',
            'type' => 'required|in:keynote,talk,workshop,panel,break,other',
            'sort_order' => 'nullable|integer|min:0',
            'speaker_ids' => 'nullable|array',
            'speaker_ids.*' => ['uuid', Rule::exists('conference_speakers', 'id')->where('conference_id', $conference->id)],
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
            'ends_at' => ['nullable', 'date', function ($attr, $value, $fail) use ($request, $session) {
                $start = $request->input('starts_at', $session->starts_at);
                if ($value && $start && strtotime((string) $value) <= strtotime((string) $start)) {
                    $fail('The session must end after it starts.');
                }
            }],
            'room' => 'nullable|string|max:100',
            'chair' => 'nullable|string|max:150',
            'type' => 'sometimes|in:keynote,talk,workshop,panel,break,other',
            'sort_order' => 'nullable|integer|min:0',
            'speaker_ids' => 'nullable|array',
            'speaker_ids.*' => ['uuid', Rule::exists('conference_speakers', 'id')->where('conference_id', $id)],
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
        $conference = Conference::where('slug', $slug)->where('status', 'published')
            ->where(fn ($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()))
            ->firstOrFail();

        if ($conference->is_past) {
            return response()->json(['message' => 'This conference has ended, so registration is closed.', 'errors' => []], 422);
        }

        $conference->load('registrationTypes');
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'organization' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'registration_type_id' => [
                $conference->registrationTypes->isNotEmpty() ? 'required' : 'nullable',
                Rule::in($conference->registrationTypes->pluck('id')->all()),
            ],
            ...$this->answerRules($conference),
        ], ['registration_type_id.required' => 'Choose how you are attending.']);
        $data['email'] = Str::lower(trim($data['email']));
        $data['answers'] = $this->cleanAnswers($conference, $data['answers'] ?? []);

        // One seat at a time: the conference row is held while seats are counted.
        $result = DB::transaction(function () use ($conference, $data) {
            $locked = Conference::whereKey($conference->id)->lockForUpdate()->first();

            $existing = $locked->registrations()->whereRaw('LOWER(email) = ?', [$data['email']])->first();
            if ($existing && $existing->status !== 'cancelled') {
                return $existing->status === 'waitlisted' ? 'You are already on the waiting list for this conference.' : 'You are already registered for this conference.';
            }

            $status = 'confirmed';
            if (! $this->hasSeat($locked, $data['registration_type_id'] ?? null)) {
                if (! $locked->waitlist_enabled) {
                    return 'This conference is fully booked.';
                }
                $status = 'waitlisted';
            }

            if ($existing) {
                $existing->update([...$data, 'status' => $status, 'registered_at' => now(), 'checked_in_at' => null, 'checked_in_by' => null]);

                return $existing->fresh();
            }

            return $locked->registrations()->create([...$data, 'status' => $status, 'registered_at' => now()]);
        });

        if (is_string($result)) {
            return response()->json(['message' => $result, 'errors' => []], 422);
        }
        $reg = $result;

        AuditLogger::log('conference.registration_created', 'Conference', $conference->id, $request->user()?->id, null, [
            'target_name' => $reg->name, 'email' => $reg->email, 'conference' => $conference->title,
        ], 201);

        // Send confirmation to registrant
        $this->sendRegistrationConfirmation($conference, $reg);

        // Alert admins of new registration
        $this->notifyAdminsNewRegistration($conference, $reg);

        return response()->json([
            'data' => $reg->only(['id', 'name', 'email', 'status', 'ticket_code']),
            'message' => $reg->status === 'waitlisted'
                ? 'The conference is full, so you are on the waiting list. We will email you if a place opens up.'
                : 'Registration successful! Your ticket has been emailed to you.',
            'errors' => [],
        ], 201);
    }

    /** Admin — list registrations for a conference. */
    public function registrations(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $conference = Conference::findOrFail($id);

        return response()->json([
            'data' => $conference->registrations()->with('type:id,name')->orderByDesc('registered_at')->get(),
            'message' => '',
            'errors' => [],
        ]);
    }

    /** Admin — confirm, or cancel (freeing the seat), one registration. */
    public function updateRegistration(Request $request, string $id, string $registrationId): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $registration = ConferenceRegistration::where('conference_id', $id)->findOrFail($registrationId);
        $data = $request->validate(['status' => 'required|in:pending,confirmed,waitlisted,cancelled']);
        $conference = Conference::findOrFail($id);
        $before = $registration->status;

        $holds = fn (string $status) => in_array($status, ConferenceRegistration::HOLDS_SEAT, true);
        if ($holds($data['status']) && ! $holds($before) && ! self::hasSeat($conference, $registration->registration_type_id)) {
            return response()->json(['message' => 'There is no free place — cancel another registration first.', 'errors' => []], 422);
        }

        $registration->update($data);
        if ($data['status'] === 'confirmed' && $before === 'waitlisted') {
            self::sendRegistrationConfirmation($conference, $registration, promoted: true);
        }
        // A freed seat goes to the next person waiting.
        $promoted = $holds($before) && ! $holds($data['status']) ? app(ConferenceAttendanceService::class)->promoteFromWaitlist($conference) : 0;

        return response()->json([
            'data' => $registration->fresh('type'),
            'message' => match ($data['status']) {
                'cancelled' => 'Registration cancelled.'.($promoted ? " {$promoted} moved up from the waiting list." : ' The seat is free again.'),
                'waitlisted' => 'Moved to the waiting list.',
                default => $before === 'waitlisted' ? 'Confirmed from the waiting list and emailed.' : 'Registration restored.',
            },
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
        $regs = $conference->registrations()->with('type:id,name')->orderByDesc('registered_at')->get();
        $questions = collect($conference->registration_questions ?? []);

        return response()->stream(function () use ($regs, $questions) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Name', 'Email', 'Organization', 'Phone', 'Type', 'Status', 'Ticket', 'Registered At', 'Checked In At', ...$questions->pluck('label')]);

            foreach ($regs as $reg) {
                $answers = collect($reg->answers ?? [])->keyBy('id');
                fputcsv($handle, [
                    $reg->name,
                    $reg->email,
                    $reg->organization ?? '',
                    $reg->phone ?? '',
                    $reg->type?->name ?? '',
                    $reg->status,
                    $reg->ticket_code,
                    $reg->registered_at?->format('Y-m-d H:i'),
                    $reg->checked_in_at?->format('Y-m-d H:i') ?? '',
                    ...$questions->map(fn ($q) => is_bool($v = $answers[$q['id']]['value'] ?? '') ? ($v ? 'Yes' : 'No') : $v),
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

    /** People who run conferences (anyone with the permission, built-in or custom role). */
    /**
     * Save the conference's tracks and rubric as sent: listed items are kept or added (in
     * the order given), the rest removed. Abstracts on a removed track keep no track.
     *
     * @param  array{tracks?: list<array<string, mixed>>, review_criteria?: list<array<string, mixed>>}  $setup
     */
    private function syncReviewSetup(Conference $conference, array $setup): void
    {
        foreach (['tracks' => $conference->tracks(), 'review_criteria' => $conference->reviewCriteria(), 'registration_types' => $conference->registrationTypes()] as $key => $relation) {
            if (! array_key_exists($key, $setup)) {
                continue;
            }
            $keep = [];
            foreach (array_values($setup[$key] ?? []) as $i => $item) {
                $values = array_intersect_key($item, array_flip(['name', 'description', 'weight', 'capacity'])) + ['sort_order' => $i];
                $model = ! empty($item['id']) ? (clone $relation)->whereKey($item['id'])->first() : null;
                $model ? $model->update($values) : $model = $relation->getRelated()->newQuery()->create($values + ['conference_id' => $conference->id]);
                $keep[] = $model->id;
            }
            (clone $relation)->whereNotIn('id', $keep)->get()->each->delete();
        }
    }

    /**
     * Whether a seat is free — overall and, when given, in that registration type.
     */
    public static function hasSeat(Conference $conference, ?string $typeId): bool
    {
        $holding = fn () => $conference->registrations()->whereIn('status', ConferenceRegistration::HOLDS_SEAT);
        if ($conference->max_capacity && $holding()->count() >= $conference->max_capacity) {
            return false;
        }
        $type = $typeId ? ConferenceRegistrationType::find($typeId) : null;

        return ! ($type?->capacity && $holding()->where('registration_type_id', $type->id)->count() >= $type->capacity);
    }

    /**
     * Validation for the organiser's own registration questions, keyed answers.{question id}.
     *
     * @return array<string, mixed>
     */
    private function answerRules(Conference $conference): array
    {
        $rules = ['answers' => 'nullable|array'];
        foreach ($conference->registration_questions ?? [] as $q) {
            $required = ! empty($q['required']);
            $rules['answers.'.$q['id']] = match ($q['type'] ?? 'text') {
                'select' => [$required ? 'required' : 'nullable', Rule::in($q['options'] ?? [])],
                'checkbox' => [$required ? 'accepted' : 'nullable', 'boolean'],
                default => [$required ? 'required' : 'nullable', 'string', 'max:1000'],
            };
        }

        return $rules;
    }

    /**
     * Keep only answers to questions the conference asks, labelled so they stay readable
     * if a question is later edited.
     *
     * @return list<array{id: string, label: string, value: mixed}>
     */
    private function cleanAnswers(Conference $conference, array $answers): array
    {
        return collect($conference->registration_questions ?? [])
            ->filter(fn ($q) => array_key_exists($q['id'], $answers) && $answers[$q['id']] !== null && $answers[$q['id']] !== '')
            ->map(fn ($q) => ['id' => $q['id'], 'label' => $q['label'], 'value' => ($q['type'] ?? 'text') === 'checkbox' ? (bool) $answers[$q['id']] : $answers[$q['id']]])
            ->values()->all();
    }

    private function organisers(): Collection
    {
        return User::permission('conferences.manage')->where('status', 'active')->whereNotNull('email')->get();
    }

    private function senderName(): string
    {
        return AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name');
    }

    public static function sendRegistrationConfirmation(Conference $conference, ConferenceRegistration $reg, bool $promoted = false): void
    {
        SendRawMailJob::deliver(
            view('emails.conference_registration', [
                'conference' => $conference,
                'registration' => $reg->loadMissing('type'),
                'promoted' => $promoted,
                'senderName' => AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name'),
            ])->render(),
            $reg->email,
            $reg->name,
            match (true) {
                $reg->status === 'waitlisted' => "Waiting list — {$conference->title}",
                $promoted => "A place opened up — {$conference->title}",
                default => "Registration Confirmed — {$conference->title}",
            }
        );
    }

    private function notifyAdminsNewRegistration(Conference $conference, ConferenceRegistration $reg): void
    {
        $admins = $this->organisers();

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
        $admins = $this->organisers();

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
