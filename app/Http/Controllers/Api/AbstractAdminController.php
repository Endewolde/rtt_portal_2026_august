<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AbstractAdminController extends Controller
{
    // ── Admin ─────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $q = ConferenceAbstract::with([
            'conference:id,title,slug',
            'reviews.reviewer:id,name',
        ])->orderByDesc('created_at');

        if ($confId = $request->query('conference_id')) {
            $q->where('conference_id', $confId);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($search = $request->query('search')) {
            $q->where(fn ($s) => $s->where('title', 'like', "%$search%")
                ->orWhere('submitter_name', 'like', "%$search%")
                ->orWhere('submitter_email', 'like', "%$search%"));
        }

        $paginated = $q->paginate(25);

        // Compute status counts (global, not filtered by page)
        $countsQuery = ConferenceAbstract::query();
        if ($confId = $request->query('conference_id')) {
            $countsQuery->where('conference_id', $confId);
        }
        $statusCounts = $countsQuery
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $counts = [
            'total' => array_sum($statusCounts),
            'submitted' => $statusCounts['submitted'] ?? 0,
            'under_review' => $statusCounts['under_review'] ?? 0,
            'revision_requested' => $statusCounts['revision_requested'] ?? 0,
            'accepted' => $statusCounts['accepted'] ?? 0,
            'rejected' => $statusCounts['rejected'] ?? 0,
        ];

        return response()->json([
            'data' => array_merge($paginated->toArray(), ['counts' => $counts]),
            'message' => '',
            'errors' => [],
        ]);
    }

    public function show(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $abstract = ConferenceAbstract::with(['conference', 'reviews.reviewer:id,name,email'])->findOrFail($id);

        return response()->json(['data' => $abstract, 'message' => '', 'errors' => []]);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $abstract = ConferenceAbstract::with('conference')->findOrFail($id);

        $status = $request->input('status');

        $data = $request->validate([
            'status' => 'required|in:submitted,under_review,revision_requested,accepted,rejected',
            'admin_notes' => [
                in_array($status, ['accepted', 'revision_requested']) ? 'required' : 'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $abstract->update($data);

        $this->notifySubmitterStatusChange($abstract);

        return response()->json(['data' => $abstract->fresh(), 'message' => 'Status updated.', 'errors' => []]);
    }

    public function assignReviewer(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $abstract = ConferenceAbstract::findOrFail($id);
        $reviewerId = $request->validate(['reviewer_id' => 'required|uuid|exists:users,id'])['reviewer_id'];
        $reviewer = User::findOrFail($reviewerId);

        if ($reviewer->status !== 'active') {
            return response()->json([
                'data' => null,
                'message' => 'This user account is inactive and cannot be assigned as a reviewer.',
                'errors' => [],
            ], 422);
        }

        if ($reviewer->email && $abstract->submitter_email && strcasecmp($reviewer->email, $abstract->submitter_email) === 0) {
            return response()->json([
                'data' => null,
                'message' => 'This user submitted this abstract and cannot be assigned to review it.',
                'errors' => [],
            ], 422);
        }

        // Create or reset the review so the reviewer can always submit/override
        $review = ConferenceAbstractReview::updateOrCreate(
            ['abstract_id' => $abstract->id, 'reviewer_id' => $reviewerId],
            ['score' => null, 'recommendation' => null, 'comments' => null, 'submitted_at' => null],
        );

        if (in_array($abstract->status, ['submitted', 'revision_requested', 'under_review'])) {
            $abstract->update(['status' => 'under_review']);
        }

        $this->notifyReviewerAssigned($abstract->load('conference'), $reviewer);

        return response()->json(['data' => $review, 'message' => 'Reviewer assigned. Previous review cleared.', 'errors' => []]);
    }

    public function export(Request $request): StreamedResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
            abort(403);
        }

        $abstracts = ConferenceAbstract::with('conference:id,title')
            ->when($request->query('conference_id'), fn ($q, $v) => $q->where('conference_id', $v))
            ->orderByDesc('submitted_at')
            ->get();

        return response()->stream(function () use ($abstracts) {
            $h = fopen('php://output', 'w');
            fwrite($h, "\xEF\xBB\xBF");
            fputcsv($h, ['Conference', 'Title', 'Submitter', 'Email', 'Affiliation', 'Type', 'Status', 'Words', 'Submitted At']);
            foreach ($abstracts as $a) {
                fputcsv($h, [
                    $a->conference?->title ?? '',
                    $a->title,
                    $a->submitter_name,
                    $a->submitter_email,
                    $a->submitter_affiliation ?? '',
                    $a->presentation_type,
                    $a->status,
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
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
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

        SendRawMailJob::dispatchSync(
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
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $abstracts = ConferenceAbstract::with(['conference:id,title,slug', 'reviews' => fn ($q) => $q->where('reviewer_id', $user->id)])
            ->whereHas('reviews', fn ($q) => $q->where('reviewer_id', $user->id))
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $abstracts, 'message' => '', 'errors' => []]);
    }

    public function submitReview(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $abstract = ConferenceAbstract::findOrFail($id);

        // firstOrCreate so a reviewer can always submit even if the record was reset/cleared
        $review = ConferenceAbstractReview::firstOrCreate(
            ['abstract_id' => $id, 'reviewer_id' => $user->id],
        );

        $data = $request->validate([
            'score' => 'required|integer|min:1|max:10',
            'comments' => 'nullable|string|max:3000',
            'recommendation' => 'required|in:accept,reject,revise',
        ]);

        $review->update([...$data, 'submitted_at' => now()]);

        // Map reviewer recommendation → abstract status
        $statusMap = [
            'accept' => 'accepted',
            'reject' => 'rejected',
            'revise' => 'revision_requested',
        ];

        $newStatus = $statusMap[$data['recommendation']] ?? null;

        if ($newStatus) {
            $abstract->update(['status' => $newStatus]);
            // Reload with conference so email templates have the relationship available
            $abstract->refresh()->load('conference');

            // Notify submitter of the decision
            $this->notifySubmitterStatusChange($abstract);

            // Notify all admins that a review was submitted
            $this->notifyAdminsReviewSubmitted($abstract, $user, $data);
        }

        return response()->json([
            'data' => array_merge($review->fresh()->toArray(), ['abstract_status' => $abstract->status]),
            'message' => 'Review submitted. The submitter has been notified.',
            'errors' => [],
        ]);
    }

    // ── Email helpers ─────────────────────────────────────────────────────────

    private function senderName(): string
    {
        return AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name');
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

        SendRawMailJob::dispatchSync(
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
        $admins = User::whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin']))->get();

        foreach ($admins as $admin) {
            if (! $admin->email) {
                continue;
            }

            SendRawMailJob::dispatchSync(
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
        SendRawMailJob::dispatchSync(
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
