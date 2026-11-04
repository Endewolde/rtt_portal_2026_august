<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\ConferenceCommitteeMember;
use App\Models\ConferenceRegistration;
use App\Support\AuditLogger;
use App\Support\ConferenceAccess;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * One conference as a whole: its figures, committee, history, the book of abstracts,
 * and copying it for next year.
 */
class ConferenceWorkspaceController extends Controller
{
    /** Audit events that belong to a conference's history, with the words shown for them. */
    private const EVENTS = [
        'conference.created' => 'Conference created',
        'conference.updated' => 'Conference edited',
        'conference.duplicated' => 'Copied from another conference',
        'conference.registration_created' => 'Registered',
        'conference.registration_cancelled' => 'Registration cancelled',
        'conference.certificates_issued' => 'Certificates issued',
        'conference.committee_added' => 'Added to the committee',
        'conference.committee_removed' => 'Removed from the committee',
        'abstract.submitted' => 'Abstract submitted',
        'abstract.resubmitted' => 'Revision resubmitted',
        'abstract.withdrawn' => 'Abstract withdrawn',
        'abstract.decided' => 'Decision recorded',
        'abstract.camera_ready' => 'Final version uploaded',
        'abstract.reviewer_assigned' => 'Reviewer assigned',
        'abstract.reviewer_removed' => 'Reviewer removed',
        'abstract.review_submitted' => 'Review submitted',
        'abstract.conflict_declared' => 'Conflict of interest declared',
    ];

    // ── Overview ──────────────────────────────────────────────────────────────

    public function overview(Request $request, string $id): JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $conference = Conference::with(['tracks', 'registrationTypes'])->findOrFail($id);

        $abstracts = $conference->abstracts()->where('status', '!=', 'draft')->get(['id', 'status', 'presentation_type', 'accepted_type', 'track_id', 'submitter_country', 'co_authors', 'submitted_at', 'session_id']);
        $reviews = ConferenceAbstractReview::with('reviewer:id,name')->whereIn('abstract_id', $abstracts->pluck('id'))->get();
        $regs = $conference->registrations()->get(['id', 'status', 'registration_type_id', 'registered_at', 'checked_in_at']);
        $decided = $abstracts->whereIn('status', ['accepted', 'rejected'])->count();

        // Authors' countries, every author counted once per abstract.
        $countries = $abstracts->flatMap(fn ($a) => collect([$a->submitter_country])
            ->merge(collect($a->co_authors ?? [])->pluck('country'))->filter()->map(fn ($c) => Str::title(trim($c)))->unique())
            ->countBy()->sortDesc()->take(8);

        return response()->json(['data' => [
            'abstracts' => [
                'total' => $abstracts->count(),
                'by_status' => $abstracts->countBy('status'),
                'by_type' => $abstracts->countBy(fn ($a) => $a->accepted_type ?: $a->presentation_type),
                'by_track' => $conference->tracks->map(fn ($t) => ['name' => $t->name, 'count' => $abstracts->where('track_id', $t->id)->count()])->values(),
                'acceptance_rate' => $decided ? (int) round($abstracts->where('status', 'accepted')->count() / $decided * 100) : null,
                'accepted_unscheduled' => $abstracts->where('status', 'accepted')->whereNull('session_id')->count(),
                'per_day' => $this->perDay($abstracts->pluck('submitted_at')),
                'countries' => $countries->map(fn ($n, $c) => ['country' => $c, 'count' => $n])->values(),
            ],
            'reviews' => [
                'assigned' => $reviews->count(),
                'submitted' => $reviews->whereNotNull('submitted_at')->count(),
                'conflicts' => $reviews->whereNotNull('conflict_declared_at')->count(),
                'pending' => $reviews->whereNull('submitted_at')->whereNull('conflict_declared_at')->count(),
                'average_score' => ($done = $reviews->whereNotNull('submitted_at'))->isNotEmpty() ? round($done->avg('score'), 1) : null,
                // Who carries the reviewing, most outstanding first.
                'load' => $reviews->groupBy('reviewer_id')->map(fn ($r) => [
                    'name' => $r->first()->reviewer?->name ?? 'Former user',
                    'assigned' => $r->count(),
                    'done' => $r->whereNotNull('submitted_at')->count(),
                ])->sortByDesc(fn ($x) => $x['assigned'] - $x['done'])->take(8)->values(),
            ],
            'registrations' => [
                'confirmed' => $regs->where('status', 'confirmed')->count(),
                'waitlisted' => $regs->where('status', 'waitlisted')->count(),
                'cancelled' => $regs->where('status', 'cancelled')->count(),
                'checked_in' => $regs->whereNotNull('checked_in_at')->count(),
                'capacity' => $conference->max_capacity,
                'by_type' => $conference->registrationTypes->map(fn ($t) => ['name' => $t->name, 'count' => $regs->where('registration_type_id', $t->id)->whereIn('status', ConferenceRegistration::HOLDS_SEAT)->count(), 'capacity' => $t->capacity])->values(),
                'per_day' => $this->perDay($regs->where('status', '!=', 'cancelled')->pluck('registered_at')),
            ],
            'certificates' => $conference->certificates()->whereNull('revoked_at')->count(),
            'feedback' => ['responses' => $conference->feedback()->count(), 'average' => ($avg = $conference->feedback()->avg('rating')) ? round($avg, 1) : null],
        ], 'message' => '', 'errors' => []]);
    }

    // ── Committee ─────────────────────────────────────────────────────────────

    public function committee(Request $request, string $id): JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json([
            'data' => ConferenceCommitteeMember::with(['user:id,name,email', 'track:id,name'])->where('conference_id', $id)->orderBy('role')->get(),
            'message' => '',
            'errors' => [],
        ]);
    }

    public function addMember(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        if (! ConferenceAccess::manages($actor, $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $conference = Conference::findOrFail($id);

        $data = $request->validate([
            'user_id' => ['required', 'uuid', Rule::exists('users', 'id')->where('status', 'active')],
            'role' => ['required', Rule::in(ConferenceCommitteeMember::ROLES)],
            'track_id' => [
                Rule::requiredIf($request->input('role') === 'track_chair'),
                'nullable', 'uuid', Rule::exists('conference_tracks', 'id')->where('conference_id', $id),
            ],
        ], ['track_id.required' => 'Choose the track this person chairs.', 'user_id.exists' => 'Choose an active user.']);
        if ($data['role'] !== 'track_chair') {
            $data['track_id'] = null;
        }

        $member = ConferenceCommitteeMember::firstOrCreate(['conference_id' => $id, ...$data]);
        if (! $member->wasRecentlyCreated) {
            return response()->json(['message' => 'This person already has that role.', 'errors' => []], 422);
        }
        $member->load(['user:id,name,email', 'track:id,name']);

        $this->emailMember($conference, $member);
        AuditLogger::log('conference.committee_added', 'Conference', $id, $actor->id, null, ['target_name' => $member->user->name, 'role' => $member->role, 'track' => $member->track?->name], 201);

        return response()->json(['data' => $member, 'message' => "{$member->user->name} added and emailed.", 'errors' => []], 201);
    }

    public function removeMember(Request $request, string $id, string $memberId): JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $member = ConferenceCommitteeMember::with('user:id,name')->where('conference_id', $id)->findOrFail($memberId);
        $member->delete();
        AuditLogger::log('conference.committee_removed', 'Conference', $id, $request->user()->id, ['target_name' => $member->user?->name, 'role' => $member->role], null, 200);

        return response()->json(['message' => 'Removed from the committee.', 'errors' => []]);
    }

    // ── History ───────────────────────────────────────────────────────────────

    /**
     * What happened to this conference and its abstracts, newest first. Super-admin
     * activity stays out, as on the audit log screen.
     */
    public function history(Request $request, string $id): JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $abstractIds = ConferenceAbstract::where('conference_id', $id)->pluck('id');
        $titles = ConferenceAbstract::whereIn('id', $abstractIds)->pluck('title', 'id');

        $page = AuditLog::query()
            ->with('actor:id,name')
            ->whereIn('event', array_keys(self::EVENTS))
            ->where(fn ($q) => $q
                ->where(fn ($c) => $c->whereIn('auditable_type', ['Conference', Conference::class])->where('auditable_id', $id))
                ->orWhere(fn ($a) => $a->whereIn('auditable_type', ['ConferenceAbstract', ConferenceAbstract::class])->whereIn('auditable_id', $abstractIds)))
            ->where(fn ($q) => $q->whereNull('actor_id')
                ->orWhereHas('actor', fn ($a) => $a->whereDoesntHave('roles', fn ($r) => $r->where('name', 'super_admin'))))
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json(['data' => $page->through(fn (AuditLog $log) => [
            'id' => $log->id,
            'event' => $log->event,
            'label' => self::EVENTS[$log->event] ?? $log->event,
            'actor' => $log->actor?->name,
            'subject' => $titles[$log->auditable_id] ?? ($log->new_values['target_name'] ?? $log->old_values['target_name'] ?? null),
            'change' => $this->describe($log),
            'at' => $log->created_at,
        ]), 'message' => '', 'errors' => []]);
    }

    // ── Copy ──────────────────────────────────────────────────────────────────

    /**
     * A new draft set up like this conference — tracks, rubric, registration types and
     * questions, speakers, sessions and committee — without its submissions or attendees.
     */
    public function duplicate(Request $request, string $id): JsonResponse
    {
        $actor = $request->user();
        if (! ConferenceAccess::isOrganiser($actor)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $source = Conference::with(['tracks', 'reviewCriteria', 'registrationTypes', 'speakers', 'sessions.speakers', 'committee'])->findOrFail($id);
        $data = $request->validate(['title' => 'nullable|string|max:255', 'shift_years' => 'nullable|integer|min:0|max:5']);
        $shift = fn ($date) => $date?->copy()->addYears((int) ($data['shift_years'] ?? 0));

        $copy = DB::transaction(function () use ($source, $data, $shift, $actor) {
            $copy = $source->replicate(['slug', 'status', 'publish_at', 'feedback_open', 'book_published', 'banner_image', 'thumbnail']);
            $copy->fill([
                'title' => $data['title'] ?? $source->title.' (copy)',
                'status' => 'draft',
                'created_by' => $actor->id,
                'start_date' => $shift($source->start_date),
                'end_date' => $shift($source->end_date),
                'abstract_deadline' => $shift($source->abstract_deadline),
                'camera_ready_deadline' => $shift($source->camera_ready_deadline),
                'feedback_open' => false,
                'book_published' => false,
            ]);
            $copy->slug = null;
            $copy->save();

            $trackMap = [];
            foreach ($source->tracks as $t) {
                $trackMap[$t->id] = $copy->tracks()->create($t->only(['name', 'description', 'sort_order']))->id;
            }
            foreach ($source->reviewCriteria as $c) {
                $copy->reviewCriteria()->create($c->only(['name', 'description', 'weight', 'sort_order']));
            }
            foreach ($source->registrationTypes as $t) {
                $copy->registrationTypes()->create($t->only(['name', 'description', 'capacity', 'sort_order']));
            }
            $speakerMap = [];
            foreach ($source->speakers as $s) {
                $speakerMap[$s->id] = $copy->speakers()->create($s->only(['name', 'title', 'bio', 'photo', 'email', 'website', 'twitter', 'linkedin', 'sort_order']))->id;
            }
            foreach ($source->sessions as $s) {
                $session = $copy->sessions()->create([
                    ...$s->only(['track', 'title', 'description', 'room', 'chair', 'type', 'sort_order']),
                    'starts_at' => $shift($s->starts_at), 'ends_at' => $shift($s->ends_at),
                ]);
                $session->speakers()->sync($s->speakers->pluck('id')->map(fn ($sid) => $speakerMap[$sid] ?? null)->filter()->all());
            }
            foreach ($source->committee as $m) {
                $copy->committee()->create(['user_id' => $m->user_id, 'role' => $m->role, 'track_id' => $m->track_id ? ($trackMap[$m->track_id] ?? null) : null]);
            }

            return $copy;
        });

        AuditLogger::log('conference.duplicated', 'Conference', $copy->id, $actor->id, null, ['target_name' => $copy->title, 'from' => $source->title], 201);

        return response()->json(['data' => $copy->fresh(), 'message' => "Copied as a draft: {$copy->title}.", 'errors' => []], 201);
    }

    // ── Book of abstracts ─────────────────────────────────────────────────────

    public function book(Request $request, string $id): Response|JsonResponse
    {
        if (! ConferenceAccess::manages($request->user(), $id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $this->bookPdf(Conference::findOrFail($id));
    }

    /** The published book, for everyone, once the organisers release it. */
    public function publicBook(string $slug): Response
    {
        $conference = Conference::where('slug', $slug)->where('status', 'published')->where('book_published', true)->firstOrFail();

        return $this->bookPdf($conference);
    }

    /**
     * Every accepted abstract, grouped by track and numbered, with an author index.
     * Emails never appear; affiliations do, as in a printed book of abstracts.
     */
    private function bookPdf(Conference $conference): Response
    {
        $conference->load('tracks');
        $abstracts = $conference->abstracts()->with(['track', 'session'])->where('status', 'accepted')->get()
            ->sortBy(fn ($a) => [$a->track?->sort_order ?? 9999, $a->session?->starts_at?->timestamp ?? PHP_INT_MAX, $a->session_order ?? 999, $a->title])
            ->values();

        $groups = $abstracts->groupBy(fn ($a) => $a->track?->name ?? ($conference->tracks->isEmpty() ? '' : 'Other contributions'));
        $number = 0;
        $entries = $groups->map(fn ($items) => $items->map(function (ConferenceAbstract $a) use (&$number) {
            $number++;
            $authors = collect($a->authors());
            $affiliations = $authors->pluck('affiliation')->filter()->unique()->values();

            return [
                'number' => $number,
                'abstract' => $a,
                'authors' => $authors->map(fn ($au) => $au + ['aff' => $au['affiliation'] ? $affiliations->search($au['affiliation']) + 1 : null]),
                'affiliations' => $affiliations,
                'type' => $a->finalType(),
            ];
        }));

        $index = $entries->flatten(1)->flatMap(fn ($e) => $e['authors']->map(fn ($au) => ['name' => $au['name'], 'number' => $e['number']]))
            ->groupBy(fn ($x) => Str::lower(trim($x['name'])))
            ->map(fn ($rows) => ['name' => $rows->first()['name'], 'numbers' => $rows->pluck('number')->unique()->sort()->values()->all()])
            ->sortBy(fn ($x) => Str::lower(Str::afterLast(trim($x['name']), ' ')).' '.Str::lower($x['name']))
            ->values();

        $orgName = DB::table('app_settings')->where('key', 'organization_name')->value('value') ?? config('app.name');

        return Pdf::loadView('pdf.book_of_abstracts', compact('conference', 'entries', 'index', 'orgName') + ['total' => $number])
            ->setPaper('a4', 'portrait')
            ->download('book-of-abstracts-'.Str::slug($conference->title).'.pdf');
    }

    /** @param  Collection<int, mixed>  $dates */
    private function perDay($dates): array
    {
        return $dates->filter()->countBy(fn ($d) => $d->format('Y-m-d'))->sortKeys()
            ->map(fn ($n, $day) => ['day' => $day, 'count' => $n])->values()->all();
    }

    private function describe(AuditLog $log): ?string
    {
        $old = $log->old_values ?? [];
        $new = $log->new_values ?? [];

        return match ($log->event) {
            'abstract.decided' => isset($old['status'], $new['status']) ? str_replace('_', ' ', $old['status']).' → '.str_replace('_', ' ', $new['status']) : null,
            'conference.committee_added' => trim(str_replace('_', ' ', $new['role'] ?? '').' '.(($new['track'] ?? null) ? "({$new['track']})" : '')),
            'conference.committee_removed' => str_replace('_', ' ', $old['role'] ?? ''),
            'conference.certificates_issued' => collect($new)->only(['attendance', 'presentation', 'reviewer'])->filter()->map(fn ($n, $k) => "{$n} {$k}")->join(', ') ?: 'none new',
            'conference.duplicated' => isset($new['from']) ? "from {$new['from']}" : null,
            'abstract.reviewer_assigned', 'abstract.review_submitted' => $new['reviewer'] ?? null,
            'abstract.reviewer_removed' => $old['reviewer'] ?? null,
            'conference.updated' => isset($new['fields']) ? 'changed '.collect($new['fields'])->map(fn ($f) => str_replace('_', ' ', $f))->take(4)->join(', ').(count($new['fields']) > 4 ? '…' : '') : null,
            default => null,
        };
    }

    private function emailMember(Conference $conference, ConferenceCommitteeMember $member): void
    {
        if (! $member->user?->email) {
            return;
        }
        $role = ['chair' => 'Conference chair', 'track_chair' => 'Track chair — '.($member->track?->name ?? ''), 'checkin' => 'Check-in desk'][$member->role];
        $link = rtrim(config('app.url'), '/').($member->role === 'track_chair' ? '/admin/abstracts?conference_id='.$conference->id : "/admin/conferences/{$conference->id}/attendance");

        SendRawMailJob::deliver(
            view('emails.conference_committee_added', [
                'conference' => $conference, 'name' => $member->user->name, 'role' => $role, 'roleKey' => $member->role, 'link' => $link,
                'senderName' => AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name'),
            ])->render(),
            $member->user->email,
            $member->user->name,
            "You're on the committee — {$conference->title}"
        );
    }
}
