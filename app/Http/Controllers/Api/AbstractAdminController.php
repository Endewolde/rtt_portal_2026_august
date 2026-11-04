<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\User;
use App\Support\AbstractAcceptanceLetter;
use App\Support\AuditLogger;
use App\Support\ConferenceAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Conference abstracts for the committee and its reviewers. Reviewers recommend;
 * the committee decides — the submitter only hears the committee's decision.
 */
class AbstractAdminController extends Controller
{
    /** Final states: no more reviews or changes from the submitter. */
    private const FINAL = ['accepted', 'rejected', 'withdrawn'];

    // ── Admin ─────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        if (! ConferenceAccess::handlesAnyAbstracts($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $q = $this->filtered($request)
            ->with(['conference:id,title,slug', 'track:id,name', 'reviews.reviewer:id,name'])
            ->withCount([
                'reviews',
                'reviews as reviews_done_count' => fn ($r) => $r->whereNotNull('submitted_at'),
                'reviews as reviews_conflict_count' => fn ($r) => $r->whereNotNull('conflict_declared_at'),
            ])
            ->withAvg(['reviews as average_score' => fn ($r) => $r->whereNotNull('submitted_at')], 'score');

        $sort = $request->query('sort', 'newest');
        match ($sort) {
            'oldest' => $q->orderBy('submitted_at'),
            'score' => $q->orderByDesc('average_score'),
            'title' => $q->orderBy('title'),
            default => $q->orderByDesc('submitted_at')->orderByDesc('created_at'),
        };

        $paginated = $q->paginate(25);

        // Status counts for the summary, for the same conference but not the other filters.
        $statusCounts = ConferenceAccess::scopeAbstracts(ConferenceAbstract::query(), $request->user())
            ->when($request->query('conference_id'), fn ($c, $id) => $c->where('conference_id', $id))
            ->where('status', '!=', 'draft')
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $counts = ['total' => array_sum($statusCounts)];
        // Drafts are the submitters' unfinished work: counted apart, never in "received".
        $counts['draft'] = ConferenceAccess::scopeAbstracts(ConferenceAbstract::query(), $request->user())
            ->when($request->query('conference_id'), fn ($c, $id) => $c->where('conference_id', $id))
            ->where('status', 'draft')->count();
        foreach (['submitted', 'under_review', 'revision_requested', 'accepted', 'rejected', 'withdrawn'] as $s) {
            $counts[$s] = (int) ($statusCounts[$s] ?? 0);
        }
        // Abstracts whose reviewers have all reported — waiting for the committee's decision.
        $counts['ready_for_decision'] = ConferenceAccess::scopeAbstracts(ConferenceAbstract::query(), $request->user())
            ->when($request->query('conference_id'), fn ($c, $id) => $c->where('conference_id', $id))
            ->where('status', 'under_review')
            ->whereHas('reviews', fn ($r) => $r->whereNotNull('submitted_at'))
            ->whereDoesntHave('reviews', fn ($r) => $r->whereNull('submitted_at')->whereNull('conflict_declared_at'))
            ->count();

        return response()->json([
            'data' => array_merge($paginated->toArray(), ['counts' => $counts]),
            'message' => '',
            'errors' => [],
        ]);
    }

    public function show(string $id, Request $request): JsonResponse
    {
        $abstract = ConferenceAbstract::with(['conference.reviewCriteria', 'conference.tracks', 'conference.sessions' => fn ($q) => $q->orderBy('starts_at')->orderBy('sort_order'), 'track:id,name', 'session:id,title,starts_at,room', 'reviews.reviewer:id,name,email'])->findOrFail($id);
        if (! ConferenceAccess::handlesAbstract($request->user(), $abstract)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $done = $abstract->reviews->whereNotNull('submitted_at');

        return response()->json([
            'data' => $abstract->toArray() + [
                'authors' => $abstract->authors(),
                'can_decide' => ConferenceAccess::manages($request->user(), $abstract->conference_id),
                'average_score' => $done->isNotEmpty() ? round($done->avg('score'), 1) : null,
                'recommendations' => $done->countBy('recommendation'),
                'conflicts' => $abstract->reviews->whereNotNull('conflict_declared_at')->count(),
            ],
            'message' => '',
            'errors' => [],
        ]);
    }

    /** The committee's decision. The submitter is told only when the status actually changes. */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $abstract = ConferenceAbstract::with('conference')->findOrFail($id);
        if (! ConferenceAccess::manages($user, $abstract->conference_id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if (in_array($abstract->status, ['draft', 'withdrawn'], true)) {
            return response()->json(['message' => 'Drafts and withdrawn abstracts cannot be decided.', 'errors' => []], 422);
        }

        $data = $request->validate($this->decisionRules($request->input('status'), true));
        $changed = $this->applyDecision($abstract, $data, $user);

        return response()->json([
            'data' => $abstract->fresh(),
            'message' => $changed ? 'Status updated — the submitter has been emailed.' : 'Notes saved.',
            'errors' => [],
        ]);
    }

    /**
     * One decision for many abstracts, e.g. reject everything left below the cut. The
     * message may use merge fields ({name}, {title}…), filled in for each submitter.
     */
    public function bulkDecision(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! ConferenceAccess::handlesAnyAbstracts($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'ids' => 'required|array|min:1|max:500',
            'ids.*' => 'uuid',
            ...$this->decisionRules($request->input('status'), false),
        ]);

        $abstracts = ConferenceAbstract::with(['conference', 'track', 'session'])
            ->whereIn('id', $data['ids'])
            ->whereNotIn('status', ['draft', 'withdrawn'])
            ->get()
            // Only conferences this user may decide for; the rest count as skipped.
            ->filter(fn (ConferenceAbstract $a) => ConferenceAccess::manages($user, $a->conference_id));

        $changed = $abstracts->filter(fn (ConferenceAbstract $a) => $this->applyDecision($a, $data, $user))->count();
        $skipped = count($data['ids']) - $abstracts->count();

        return response()->json([
            'data' => ['changed' => $changed, 'unchanged' => $abstracts->count() - $changed, 'skipped' => $skipped],
            'message' => $changed === 0
                ? 'Nothing changed — the selected abstracts already have this decision.'
                : "{$changed} abstract".($changed === 1 ? '' : 's').' decided and the submitters emailed.'.($skipped ? " {$skipped} draft or withdrawn skipped." : ''),
            'errors' => [],
        ]);
    }

    /** The committee's letter of acceptance as a PDF, the same one the author downloads. */
    public function letter(Request $request, string $id): Response|JsonResponse
    {
        $abstract = ConferenceAbstract::findOrFail($id);
        if (! ConferenceAccess::manages($request->user(), $abstract->conference_id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if ($abstract->status !== 'accepted') {
            return response()->json(['message' => 'Only accepted abstracts have a letter of acceptance.', 'errors' => []], 422);
        }

        return AbstractAcceptanceLetter::download($abstract);
    }

    /** Place an accepted abstract in a programme session, or take it out (session_id null). */
    public function schedule(Request $request, string $id): JsonResponse
    {
        $abstract = ConferenceAbstract::findOrFail($id);
        if (! ConferenceAccess::manages($request->user(), $abstract->conference_id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if ($abstract->status !== 'accepted') {
            return response()->json(['message' => 'Only accepted abstracts can be placed in the programme.', 'errors' => []], 422);
        }

        $data = $request->validate([
            'session_id' => ['nullable', 'uuid', Rule::exists('conference_sessions', 'id')->where('conference_id', $abstract->conference_id)],
            'session_order' => 'nullable|integer|min:1|max:500',
        ]);

        $sessionId = $data['session_id'] ?? null;
        $abstract->update([
            'session_id' => $sessionId,
            'session_order' => $sessionId
                ? ($data['session_order'] ?? (int) ConferenceAbstract::where('session_id', $sessionId)->where('id', '!=', $abstract->id)->max('session_order') + 1)
                : null,
        ]);

        return response()->json(['data' => $abstract->fresh('session'), 'message' => $sessionId ? 'Placed in the session.' : 'Taken out of the programme.', 'errors' => []]);
    }

    /**
     * @return array<string, mixed>
     */
    private function decisionRules(?string $status, bool $allowReopen): array
    {
        return [
            'status' => 'required|in:'.($allowReopen ? 'submitted,under_review,' : '').'revision_requested,accepted,rejected',
            'accepted_type' => 'nullable|in:oral,poster,workshop,panel,other',
            'admin_notes' => [
                in_array($status, ['accepted', 'revision_requested'], true) ? 'required' : 'nullable',
                'string',
                'max:2000',
            ],
        ];
    }

    /**
     * Record a decision on one abstract and email the submitter when its status changes.
     *
     * @param  array{status: string, accepted_type?: ?string, admin_notes?: ?string}  $data
     */
    private function applyDecision(ConferenceAbstract $abstract, array $data, User $user): bool
    {
        $before = $abstract->status;
        $accepted = $data['status'] === 'accepted';
        $abstract->fill([
            'status' => $data['status'],
            // Accepted in another format than asked for, e.g. an oral request offered a poster.
            'accepted_type' => $accepted && ($data['accepted_type'] ?? null) !== $abstract->presentation_type ? ($data['accepted_type'] ?? null) : null,
            'decided_at' => in_array($data['status'], ['accepted', 'rejected', 'revision_requested'], true) ? ($before === $data['status'] ? $abstract->decided_at : now()) : null,
            // Out of the programme if it is no longer accepted.
            ...($accepted ? [] : ['session_id' => null, 'session_order' => null]),
        ]);
        // Merge fields are filled after the format is set, so {type} reads the accepted one.
        $abstract->admin_notes = filled($data['admin_notes'] ?? null) ? $abstract->mergeFields($data['admin_notes']) : null;
        $abstract->save();

        if ($before === $abstract->status) {
            return false;
        }

        $this->notifySubmitterStatusChange($abstract);
        AuditLogger::log('abstract.decided', ConferenceAbstract::class, $abstract->id, $user->id, ['status' => $before], ['status' => $abstract->status]);

        return true;
    }

    public function assignReviewer(Request $request, string $id): JsonResponse
    {
        $abstract = ConferenceAbstract::findOrFail($id);
        if (! ConferenceAccess::handlesAbstract($request->user(), $abstract)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if (in_array($abstract->status, [...self::FINAL, 'draft'], true)) {
            return response()->json(['message' => 'Reviewers can only be assigned to submitted abstracts that are still open.', 'errors' => []], 422);
        }

        $data = $request->validate([
            'reviewer_id' => 'required|uuid|exists:users,id',
            'reset' => 'sometimes|boolean',
            'acknowledge_conflict' => 'sometimes|boolean',
        ]);
        $reviewer = User::with('college:id,name')->findOrFail($data['reviewer_id']);

        if ($reviewer->status !== 'active') {
            return response()->json(['data' => null, 'message' => 'This user account is inactive and cannot be assigned as a reviewer.', 'errors' => []], 422);
        }
        $authorEmails = collect($abstract->authors())->pluck('email')->filter()->map(fn ($e) => Str::lower($e));
        if ($reviewer->email && $authorEmails->contains(Str::lower($reviewer->email))) {
            return response()->json(['data' => null, 'message' => 'This user is an author of this abstract and cannot review it.', 'errors' => []], 422);
        }
        // Same institution as an author is a likely conflict: the committee must confirm it knowingly.
        $shared = $this->sharedInstitution($abstract, $reviewer);
        if ($shared && ! $request->boolean('acknowledge_conflict')) {
            return response()->json([
                'data' => null,
                'message' => "{$reviewer->name} is at the same institution as an author ({$shared}). Assign anyway only if there is no conflict of interest.",
                'errors' => [],
                'meta' => ['code' => 'possible_conflict', 'institution' => $shared],
            ], 422);
        }

        $existing = ConferenceAbstractReview::where('abstract_id', $abstract->id)->where('reviewer_id', $reviewer->id)->first();
        if ($existing && $existing->submitted_at && ! $request->boolean('reset')) {
            return response()->json(['message' => "{$reviewer->name} has already reviewed this abstract. Ask again only if their review should be cleared.", 'errors' => [], 'meta' => ['code' => 'already_reviewed']], 422);
        }

        $review = ConferenceAbstractReview::updateOrCreate(
            ['abstract_id' => $abstract->id, 'reviewer_id' => $reviewer->id],
            ['score' => null, 'criteria_scores' => null, 'recommendation' => null, 'comments' => null, 'confidential_comments' => null, 'submitted_at' => null, 'conflict_declared_at' => null, 'conflict_reason' => null],
        );

        if (in_array($abstract->status, ['submitted', 'revision_requested'], true)) {
            $abstract->update(['status' => 'under_review']);
        }

        $this->notifyReviewerAssigned($abstract->load('conference'), $reviewer);
        AuditLogger::log('abstract.reviewer_assigned', ConferenceAbstract::class, $abstract->id, $request->user()->id, null, ['reviewer' => $reviewer->name, 'reset' => (bool) $existing]);

        return response()->json(['data' => $review, 'message' => $existing ? 'Review reopened — the reviewer has been asked again.' : 'Reviewer assigned and notified.', 'errors' => []]);
    }

    /** Take a reviewer off an abstract (their review, if any, is removed with them). */
    public function removeReviewer(Request $request, string $id, string $reviewerId): JsonResponse
    {
        $abstract = ConferenceAbstract::findOrFail($id);
        if (! ConferenceAccess::handlesAbstract($request->user(), $abstract)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $review = ConferenceAbstractReview::with('reviewer:id,name')->where('abstract_id', $abstract->id)->where('reviewer_id', $reviewerId)->firstOrFail();
        $review->delete();
        AuditLogger::log('abstract.reviewer_removed', ConferenceAbstract::class, $abstract->id, $request->user()->id, ['reviewer' => $review->reviewer?->name], null);

        if ($abstract->status === 'under_review' && ! $abstract->reviews()->exists()) {
            $abstract->update(['status' => 'submitted']);
        }

        return response()->json(['message' => 'Reviewer removed.', 'errors' => []]);
    }

    public function export(Request $request): StreamedResponse
    {
        if (! ConferenceAccess::handlesAnyAbstracts($request->user())) {
            abort(403);
        }

        $abstracts = $this->filtered($request)
            ->with(['conference:id,title', 'track:id,name', 'reviews' => fn ($r) => $r->whereNotNull('submitted_at')])
            ->orderByDesc('submitted_at')
            ->get();

        return response()->stream(function () use ($abstracts) {
            $h = fopen('php://output', 'w');
            fwrite($h, "\xEF\xBB\xBF");
            fputcsv($h, ['Conference', 'Track', 'Title', 'Submitter', 'Email', 'Affiliation', 'Country', 'ORCID', 'Presenting author', 'Co-authors', 'Type', 'Status', 'Reviews', 'Average score', 'Words', 'Submitted At']);
            foreach ($abstracts as $a) {
                $authors = collect($a->authors());
                fputcsv($h, [
                    $a->conference?->title ?? '',
                    $a->track?->name ?? '',
                    $a->title,
                    $a->submitter_name,
                    $a->submitter_email,
                    $a->submitter_affiliation ?? '',
                    $a->submitter_country ?? '',
                    $a->submitter_orcid ?? '',
                    $authors->where('presenting', true)->pluck('name')->implode('; '),
                    $authors->slice(1)->map(fn ($x) => trim($x['name'].($x['affiliation'] ? " ({$x['affiliation']})" : '')))->implode('; '),
                    $a->presentation_type,
                    str_replace('_', ' ', $a->status),
                    $a->reviews->count(),
                    $a->reviews->isNotEmpty() ? round($a->reviews->avg('score'), 1) : '',
                    $a->word_count ?? '',
                    $a->submitted_at?->format('Y-m-d H:i') ?? '',
                ]);
            }
            fclose($h);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="abstracts.csv"',
            'Cache-Control' => 'no-cache',
        ]);
    }

    public function sendNextSteps(Request $request, string $id): JsonResponse
    {
        $abstract = ConferenceAbstract::with('conference')->findOrFail($id);
        if (! ConferenceAccess::manages($request->user(), $abstract->conference_id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($abstract->status !== 'accepted') {
            return response()->json(['message' => 'Next-steps emails can only be sent for accepted abstracts.', 'errors' => []], 422);
        }

        $data = $request->validate([
            'subject' => 'required|string|max:255',
            'body' => 'required|string|max:5000',
        ]);

        SendRawMailJob::deliver(
            view('emails.abstract_what_next', [
                'abstract' => $abstract,
                'conference' => $abstract->conference,
                'body' => $abstract->mergeFields($data['body']),
                'senderName' => $this->senderName(),
            ])->render(),
            $abstract->submitter_email,
            $abstract->submitter_name,
            $data['subject']
        );

        return response()->json(['message' => "Email queued for {$abstract->submitter_email}.", 'errors' => []]);
    }

    // ── Reviewer ──────────────────────────────────────────────────────────────

    public function reviewerIndex(Request $request): JsonResponse
    {
        $user = $request->user();

        $abstracts = ConferenceAbstract::with([
            'conference:id,title,slug,review_mode', 'conference.reviewCriteria', 'track:id,name',
            'reviews' => fn ($q) => $q->where('reviewer_id', $user->id),
        ])
            ->whereHas('reviews', fn ($q) => $q->where('reviewer_id', $user->id))
            ->where('status', '!=', 'withdrawn')
            ->orderByDesc('created_at')
            ->get()
            // Blind review: reviewers get the work, never who wrote it (the attached file can carry names too).
            ->map(fn (ConferenceAbstract $a) => $a->conference?->hidesAuthorsFromReviewers()
                ? array_diff_key($a->toArray(), array_flip(ConferenceAbstract::AUTHOR_FIELDS)) + ['blind' => true]
                : $a->toArray() + ['blind' => false, 'authors' => $a->authors()]);

        return response()->json(['data' => $abstracts, 'message' => '', 'errors' => []]);
    }

    /**
     * A reviewer's recommendation. Only an assigned reviewer may review, once, while the
     * abstract is still open; the decision itself stays with the committee.
     */
    public function submitReview(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $abstract = ConferenceAbstract::with('conference')->findOrFail($id);

        $review = ConferenceAbstractReview::where('abstract_id', $abstract->id)->where('reviewer_id', $user->id)->first();
        if (! $review) {
            return response()->json(['message' => 'You have not been asked to review this abstract.', 'errors' => []], 403);
        }
        if ($review->submitted_at) {
            return response()->json(['message' => 'You have already reviewed this abstract. Contact the committee if it needs correcting.', 'errors' => []], 422);
        }
        if (in_array($abstract->status, self::FINAL, true)) {
            return response()->json(['message' => 'This abstract has already been decided.', 'errors' => []], 422);
        }
        if ($review->conflict_declared_at) {
            return response()->json(['message' => 'You declared a conflict of interest on this abstract, so you cannot review it.', 'errors' => []], 422);
        }

        $criteria = $abstract->conference?->reviewCriteria ?? collect();
        $data = $request->validate([
            // With a rubric the overall score comes from the criteria; without one it is given directly.
            'score' => [$criteria->isEmpty() ? 'required' : 'nullable', 'integer', 'min:1', 'max:10'],
            'criteria_scores' => [$criteria->isEmpty() ? 'nullable' : 'required', 'array'],
            'criteria_scores.*' => 'integer|min:1|max:5',
            'comments' => 'nullable|string|max:3000',
            'confidential_comments' => 'nullable|string|max:3000',
            'recommendation' => 'required|in:accept,reject,revise',
        ]);

        if ($criteria->isNotEmpty()) {
            $missing = $criteria->reject(fn ($c) => isset($data['criteria_scores'][$c->id]));
            if ($missing->isNotEmpty()) {
                return response()->json(['message' => 'Score every criterion: '.$missing->pluck('name')->implode(', ').'.', 'errors' => ['criteria_scores' => ['Score every criterion.']]], 422);
            }
            // Kept with names and weights, so the review still reads right if the rubric changes later.
            $data['criteria_scores'] = $criteria->map(fn ($c) => [
                'criterion_id' => $c->id, 'name' => $c->name, 'weight' => $c->weight, 'score' => (int) $data['criteria_scores'][$c->id],
            ])->values()->all();
            $weighted = collect($data['criteria_scores'])->sum(fn ($c) => $c['score'] * $c['weight']) / max(1, $criteria->sum('weight'));
            $data['score'] = max(1, (int) round($weighted / 5 * 10));
        }

        $review->update([...$data, 'submitted_at' => now()]);

        $pending = $abstract->reviews()->whereNull('submitted_at')->whereNull('conflict_declared_at')->count();
        $this->notifyAdminsReviewSubmitted($abstract, $user, $data);
        AuditLogger::log('abstract.review_submitted', ConferenceAbstract::class, $abstract->id, $user->id, null, ['reviewer' => $user->name]);

        return response()->json([
            'data' => array_merge($review->fresh()->toArray(), ['abstract_status' => $abstract->status, 'reviews_pending' => $pending]),
            'message' => 'Thank you — your review has been sent to the committee, which makes the final decision.',
            'errors' => [],
        ]);
    }

    /** A reviewer steps aside: they know the authors or have another conflict of interest. */
    public function declareConflict(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $abstract = ConferenceAbstract::with('conference')->findOrFail($id);
        $review = ConferenceAbstractReview::where('abstract_id', $abstract->id)->where('reviewer_id', $user->id)->first();
        if (! $review) {
            return response()->json(['message' => 'You have not been asked to review this abstract.', 'errors' => []], 403);
        }
        if ($review->submitted_at) {
            return response()->json(['message' => 'You have already reviewed this abstract.', 'errors' => []], 422);
        }

        $data = $request->validate(['reason' => 'required|string|min:5|max:1000']);
        $review->update(['conflict_declared_at' => now(), 'conflict_reason' => $data['reason']]);
        AuditLogger::log('abstract.conflict_declared', ConferenceAbstract::class, $abstract->id, $user->id, null, ['reason' => $data['reason']]);

        foreach ($this->organisers() as $admin) {
            SendRawMailJob::deliver(
                '<p>'.e($user->name).' declared a conflict of interest on the abstract <strong>'.e($abstract->title).'</strong> ('.e($abstract->conference?->title).') and will not review it.</p>'
                .'<p>Reason: '.e($data['reason']).'</p><p>Assign another reviewer from the Abstracts page.</p>',
                $admin->email, $admin->name, "Conflict declared — {$abstract->title}",
            );
        }

        return response()->json(['data' => $review->fresh(), 'message' => 'Thank you — the committee will assign someone else.', 'errors' => []]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** An author's institution the reviewer shares (by college or stated affiliation), if any. */
    private function sharedInstitution(ConferenceAbstract $abstract, User $reviewer): ?string
    {
        $mine = collect([$reviewer->college?->name, $reviewer->affiliation])->filter()->map(fn ($v) => Str::lower(trim($v)));
        if ($mine->isEmpty()) {
            return null;
        }
        foreach ($abstract->authors() as $author) {
            $theirs = Str::lower(trim((string) $author['affiliation']));
            if ($theirs !== '' && $mine->contains(fn ($m) => str_contains($theirs, $m) || str_contains($m, $theirs))) {
                return $author['affiliation'];
            }
        }

        return null;
    }

    /** The committee's list: submitted work only (drafts stay private) unless asked for. */
    private function filtered(Request $request): Builder
    {
        return ConferenceAccess::scopeAbstracts(ConferenceAbstract::query(), $request->user())
            ->when($request->query('conference_id'), fn ($q, $id) => $q->where('conference_id', $id))
            ->when(
                $request->query('status'),
                fn ($q, $status) => $status === 'ready_for_decision'
                    ? $q->where('status', 'under_review')->whereHas('reviews', fn ($r) => $r->whereNotNull('submitted_at'))->whereDoesntHave('reviews', fn ($r) => $r->whereNull('submitted_at')->whereNull('conflict_declared_at'))
                    : $q->where('status', $status),
                fn ($q) => $q->where('status', '!=', 'draft'),
            )
            ->when($request->query('type'), fn ($q, $type) => $q->where('presentation_type', $type))
            ->when($request->query('track_id'), fn ($q, $track) => $q->where('track_id', $track))
            ->when($request->query('search'), fn ($q, $search) => $q->where(fn ($s) => $s
                ->where('title', 'like', "%{$search}%")
                ->orWhere('submitter_name', 'like', "%{$search}%")
                ->orWhere('submitter_email', 'like', "%{$search}%")));
    }

    private function senderName(): string
    {
        return AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name');
    }

    /** People who run conferences (anyone with the permission, built-in or custom role). */
    private function organisers(): Collection
    {
        return User::permission('conferences.manage')->where('status', 'active')->whereNotNull('email')->get();
    }

    private function notifySubmitterStatusChange(ConferenceAbstract $abstract): void
    {
        $templateMap = [
            'accepted' => 'emails.abstract_accepted',
            'rejected' => 'emails.abstract_rejected',
            'revision_requested' => 'emails.abstract_revision_requested',
        ];

        $template = $templateMap[$abstract->status] ?? null;
        if (! $template) {
            return;
        }

        $resubmitUrl = $abstract->status === 'revision_requested'
            ? config('app.url').'/conferences/'.$abstract->conference?->slug.'/submit-abstract?token='.$abstract->submission_token
            : null;

        SendRawMailJob::deliver(
            view($template, [
                'abstract' => $abstract,
                'conference' => $abstract->conference,
                'senderName' => $this->senderName(),
                'resubmitUrl' => $resubmitUrl,
            ])->render(),
            $abstract->submitter_email,
            $abstract->submitter_name,
            match ($abstract->status) {
                'accepted' => "Abstract Accepted — {$abstract->conference?->title}",
                'rejected' => "Abstract Decision — {$abstract->conference?->title}",
                'revision_requested' => "Revision Required — {$abstract->conference?->title}",
                default => "Abstract Update — {$abstract->conference?->title}",
            }
        );
    }

    private function notifyAdminsReviewSubmitted(ConferenceAbstract $abstract, User $reviewer, array $reviewData): void
    {
        foreach ($this->organisers() as $admin) {
            SendRawMailJob::deliver(
                view('emails.abstract_review_submitted', [
                    'abstract' => $abstract,
                    'conference' => $abstract->conference,
                    'reviewer' => $reviewer,
                    'reviewData' => $reviewData,
                    'admin' => $admin,
                    'senderName' => $this->senderName(),
                ])->render(),
                $admin->email,
                $admin->name,
                "Review Submitted — {$abstract->title}"
            );
        }
    }

    private function notifyReviewerAssigned(ConferenceAbstract $abstract, User $reviewer): void
    {
        if (! $reviewer->email) {
            return;
        }
        SendRawMailJob::deliver(
            view('emails.abstract_reviewer_assigned', [
                'abstract' => $abstract,
                'conference' => $abstract->conference,
                'reviewer' => $reviewer,
                'blind' => (bool) $abstract->conference?->hidesAuthorsFromReviewers(),
                'senderName' => $this->senderName(),
            ])->render(),
            $reviewer->email,
            $reviewer->name,
            "Review Assignment — {$abstract->conference?->title}"
        );
    }
}
