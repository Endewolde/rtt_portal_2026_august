<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $q = $this->filtered($request)
            ->with(['conference:id,title,slug', 'reviews.reviewer:id,name'])
            ->withCount([
                'reviews',
                'reviews as reviews_done_count' => fn ($r) => $r->whereNotNull('submitted_at'),
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
        $statusCounts = ConferenceAbstract::query()
            ->when($request->query('conference_id'), fn ($c, $id) => $c->where('conference_id', $id))
            ->where('status', '!=', 'draft')
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $counts = ['total' => array_sum($statusCounts)];
        // Drafts are the submitters' unfinished work: counted apart, never in "received".
        $counts['draft'] = ConferenceAbstract::query()
            ->when($request->query('conference_id'), fn ($c, $id) => $c->where('conference_id', $id))
            ->where('status', 'draft')->count();
        foreach (['submitted', 'under_review', 'revision_requested', 'accepted', 'rejected', 'withdrawn'] as $s) {
            $counts[$s] = (int) ($statusCounts[$s] ?? 0);
        }
        // Abstracts whose reviewers have all reported — waiting for the committee's decision.
        $counts['ready_for_decision'] = ConferenceAbstract::query()
            ->when($request->query('conference_id'), fn ($c, $id) => $c->where('conference_id', $id))
            ->where('status', 'under_review')
            ->whereHas('reviews')
            ->whereDoesntHave('reviews', fn ($r) => $r->whereNull('submitted_at'))
            ->count();

        return response()->json([
            'data' => array_merge($paginated->toArray(), ['counts' => $counts]),
            'message' => '',
            'errors' => [],
        ]);
    }

    public function show(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $abstract = ConferenceAbstract::with(['conference', 'reviews.reviewer:id,name,email'])->findOrFail($id);
        $done = $abstract->reviews->whereNotNull('submitted_at');

        return response()->json([
            'data' => $abstract->toArray() + [
                'average_score' => $done->isNotEmpty() ? round($done->avg('score'), 1) : null,
                'recommendations' => $done->countBy('recommendation'),
            ],
            'message' => '',
            'errors' => [],
        ]);
    }

    /** The committee's decision. The submitter is told only when the status actually changes. */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $abstract = ConferenceAbstract::with('conference')->findOrFail($id);
        if (in_array($abstract->status, ['draft', 'withdrawn'], true)) {
            return response()->json(['message' => 'Drafts and withdrawn abstracts cannot be decided.', 'errors' => []], 422);
        }

        $status = $request->input('status');
        $data = $request->validate([
            'status' => 'required|in:submitted,under_review,revision_requested,accepted,rejected',
            'admin_notes' => [
                in_array($status, ['accepted', 'revision_requested'], true) ? 'required' : 'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $before = $abstract->status;
        $abstract->update($data);

        if ($before !== $abstract->status) {
            $this->notifySubmitterStatusChange($abstract);
            AuditLogger::log('abstract.decided', ConferenceAbstract::class, $abstract->id, $user->id, ['status' => $before], ['status' => $abstract->status]);
        }

        return response()->json([
            'data' => $abstract->fresh(),
            'message' => $before !== $abstract->status ? 'Status updated — the submitter has been emailed.' : 'Notes saved.',
            'errors' => [],
        ]);
    }

    public function assignReviewer(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $abstract = ConferenceAbstract::findOrFail($id);
        if (in_array($abstract->status, [...self::FINAL, 'draft'], true)) {
            return response()->json(['message' => 'Reviewers can only be assigned to submitted abstracts that are still open.', 'errors' => []], 422);
        }

        $data = $request->validate([
            'reviewer_id' => 'required|uuid|exists:users,id',
            'reset' => 'sometimes|boolean',
        ]);
        $reviewer = User::findOrFail($data['reviewer_id']);

        if ($reviewer->status !== 'active') {
            return response()->json(['data' => null, 'message' => 'This user account is inactive and cannot be assigned as a reviewer.', 'errors' => []], 422);
        }
        if ($reviewer->email && $abstract->submitter_email && strcasecmp($reviewer->email, $abstract->submitter_email) === 0) {
            return response()->json(['data' => null, 'message' => 'This user submitted this abstract and cannot be assigned to review it.', 'errors' => []], 422);
        }

        $existing = ConferenceAbstractReview::where('abstract_id', $abstract->id)->where('reviewer_id', $reviewer->id)->first();
        if ($existing && $existing->submitted_at && ! $request->boolean('reset')) {
            return response()->json(['message' => "{$reviewer->name} has already reviewed this abstract. Ask again only if their review should be cleared.", 'errors' => [], 'meta' => ['code' => 'already_reviewed']], 422);
        }

        $review = ConferenceAbstractReview::updateOrCreate(
            ['abstract_id' => $abstract->id, 'reviewer_id' => $reviewer->id],
            ['score' => null, 'recommendation' => null, 'comments' => null, 'submitted_at' => null],
        );

        if (in_array($abstract->status, ['submitted', 'revision_requested'], true)) {
            $abstract->update(['status' => 'under_review']);
        }

        $this->notifyReviewerAssigned($abstract->load('conference'), $reviewer);

        return response()->json(['data' => $review, 'message' => $existing ? 'Review reopened — the reviewer has been asked again.' : 'Reviewer assigned and notified.', 'errors' => []]);
    }

    /** Take a reviewer off an abstract (their review, if any, is removed with them). */
    public function removeReviewer(Request $request, string $id, string $reviewerId): JsonResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $abstract = ConferenceAbstract::findOrFail($id);
        ConferenceAbstractReview::where('abstract_id', $abstract->id)->where('reviewer_id', $reviewerId)->firstOrFail()->delete();

        if ($abstract->status === 'under_review' && ! $abstract->reviews()->exists()) {
            $abstract->update(['status' => 'submitted']);
        }

        return response()->json(['message' => 'Reviewer removed.', 'errors' => []]);
    }

    public function export(Request $request): StreamedResponse
    {
        if (! $request->user()?->can('conferences.manage')) {
            abort(403);
        }

        $abstracts = $this->filtered($request)
            ->with(['conference:id,title', 'reviews' => fn ($r) => $r->whereNotNull('submitted_at')])
            ->orderByDesc('submitted_at')
            ->get();

        return response()->stream(function () use ($abstracts) {
            $h = fopen('php://output', 'w');
            fwrite($h, "\xEF\xBB\xBF");
            fputcsv($h, ['Conference', 'Title', 'Submitter', 'Email', 'Affiliation', 'Type', 'Status', 'Reviews', 'Average score', 'Words', 'Submitted At']);
            foreach ($abstracts as $a) {
                fputcsv($h, [
                    $a->conference?->title ?? '',
                    $a->title,
                    $a->submitter_name,
                    $a->submitter_email,
                    $a->submitter_affiliation ?? '',
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
        if (! $request->user()?->can('conferences.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $abstract = ConferenceAbstract::with('conference')->findOrFail($id);

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
                'body' => $data['body'],
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

        $abstracts = ConferenceAbstract::with(['conference:id,title,slug', 'reviews' => fn ($q) => $q->where('reviewer_id', $user->id)])
            ->whereHas('reviews', fn ($q) => $q->where('reviewer_id', $user->id))
            ->where('status', '!=', 'withdrawn')
            ->orderByDesc('created_at')
            ->get();

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

        $data = $request->validate([
            'score' => 'required|integer|min:1|max:10',
            'comments' => 'nullable|string|max:3000',
            'recommendation' => 'required|in:accept,reject,revise',
        ]);

        $review->update([...$data, 'submitted_at' => now()]);

        $pending = $abstract->reviews()->whereNull('submitted_at')->count();
        $this->notifyAdminsReviewSubmitted($abstract, $user, $data);

        return response()->json([
            'data' => array_merge($review->fresh()->toArray(), ['abstract_status' => $abstract->status, 'reviews_pending' => $pending]),
            'message' => 'Thank you — your review has been sent to the committee, which makes the final decision.',
            'errors' => [],
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** The committee's list: submitted work only (drafts stay private) unless asked for. */
    private function filtered(Request $request): Builder
    {
        return ConferenceAbstract::query()
            ->when($request->query('conference_id'), fn ($q, $id) => $q->where('conference_id', $id))
            ->when(
                $request->query('status'),
                fn ($q, $status) => $status === 'ready_for_decision'
                    ? $q->where('status', 'under_review')->whereHas('reviews')->whereDoesntHave('reviews', fn ($r) => $r->whereNull('submitted_at'))
                    : $q->where('status', $status),
                fn ($q) => $q->where('status', '!=', 'draft'),
            )
            ->when($request->query('type'), fn ($q, $type) => $q->where('presentation_type', $type))
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
                'senderName' => $this->senderName(),
            ])->render(),
            $reviewer->email,
            $reviewer->name,
            "Review Assignment — {$abstract->conference?->title}"
        );
    }
}
