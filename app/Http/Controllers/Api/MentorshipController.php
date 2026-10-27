<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mentorship;
use App\Models\Proposal;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\ProgressReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Mentorship between researchers: anyone who has led a funded project can offer
 * to mentor; others find a mentor whose expertise matches their work and ask,
 * optionally about one of their proposals.
 */
class MentorshipController extends Controller
{
    private const FUNDED = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    public function __construct(private NotificationService $notifications) {}

    /** Mentors who are open to it, best match for the person asking first. */
    public function mentors(Request $request): JsonResponse
    {
        $me = $request->user();
        $term = Str::lower(trim((string) $request->query('q', '')));
        $interests = $this->interests($me);
        $mine = Mentorship::where('mentee_id', $me->id)->whereIn('status', Mentorship::OPEN)->pluck('status', 'mentor_id');

        $mentors = User::with('college:id,name')
            ->where('mentor_available', true)->where('status', 'active')->where('id', '!=', $me->id)
            ->whereIn('id', Proposal::select('pi_user_id')->whereIn('status', self::FUNDED))
            ->get(['id', 'name', 'title', 'college_id', 'expertise', 'mentor_note', 'avatar'])
            ->map(function (User $u) use ($interests, $mine) {
                $expertise = collect($u->expertise ?? []);
                $shared = $expertise->filter(fn ($e) => $interests->contains(Str::lower(trim($e))))->values();

                return [
                    'id' => $u->id,
                    'name' => trim(($u->title ? $u->title.' ' : '').$u->name),
                    'college' => $u->college?->name,
                    'expertise' => $expertise->values(),
                    'note' => $u->mentor_note,
                    'avatar' => $u->avatar,
                    'funded_projects' => Proposal::where('pi_user_id', $u->id)->whereIn('status', self::FUNDED)->count(),
                    'mentees' => Mentorship::where('mentor_id', $u->id)->where('status', 'active')->count(),
                    'shared' => $shared,
                    'my_request' => $mine[$u->id] ?? null,
                ];
            })
            ->filter(fn ($m) => $term === '' || Str::contains(Str::lower($m['name'].' '.$m['college'].' '.collect($m['expertise'])->implode(' ')), $term))
            ->sortByDesc(fn ($m) => count($m['shared']) * 10 + $m['funded_projects'])
            ->values();

        return $this->ok($mentors);
    }

    /** The person's mentorships, as mentee and as mentor, and their own mentor settings. */
    public function index(Request $request): JsonResponse
    {
        $me = $request->user();
        $all = Mentorship::with(['mentee:id,name,title', 'mentor:id,name,title', 'proposal:id,tracker_number,title'])
            ->where(fn ($q) => $q->where('mentee_id', $me->id)->orWhere('mentor_id', $me->id))
            ->latest()->get();

        return $this->ok([
            'as_mentee' => $all->where('mentee_id', $me->id)->map(fn ($m) => $this->present($m, $me))->values(),
            'as_mentor' => $all->where('mentor_id', $me->id)->map(fn ($m) => $this->present($m, $me))->values(),
            'settings' => [
                'mentor_available' => (bool) $me->mentor_available,
                'mentor_note' => $me->mentor_note,
                'eligible' => $this->eligible($me),
            ],
            'my_proposals' => Proposal::where('pi_user_id', $me->id)->whereNotIn('status', ['rejected', 'archived'])
                ->latest()->get(['id', 'tracker_number', 'title']),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $me = $request->user();
        $data = $request->validate([
            'mentor_available' => ['required', 'boolean'],
            'mentor_note' => ['nullable', 'string', 'max:500'],
        ]);

        if ($data['mentor_available'] && ! $this->eligible($me)) {
            return response()->json(['data' => null, 'message' => 'Mentors have led at least one funded project.', 'errors' => []], 422);
        }

        $me->update($data);

        return $this->ok(['mentor_available' => (bool) $me->mentor_available, 'mentor_note' => $me->mentor_note],
            $data['mentor_available'] ? 'You are listed as open to mentoring.' : 'You are no longer listed as a mentor.');
    }

    public function store(Request $request): JsonResponse
    {
        $me = $request->user();
        $data = $request->validate([
            'mentor_id' => ['required', 'string'],
            'proposal_id' => ['nullable', 'string'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $mentor = User::where('id', $data['mentor_id'])->where('mentor_available', true)->where('status', 'active')->first();
        if (! $mentor || $mentor->id === $me->id || ! $this->eligible($mentor)) {
            return response()->json(['data' => null, 'message' => 'This person is not available as a mentor.', 'errors' => []], 422);
        }
        if (Mentorship::where('mentee_id', $me->id)->where('mentor_id', $mentor->id)->whereIn('status', Mentorship::OPEN)->exists()) {
            return response()->json(['data' => null, 'message' => 'You already have an open request or mentorship with this mentor.', 'errors' => []], 422);
        }
        if (! empty($data['proposal_id']) && ! Proposal::where('id', $data['proposal_id'])->where('pi_user_id', $me->id)->exists()) {
            return response()->json(['data' => null, 'message' => 'You can only link a proposal you lead.', 'errors' => []], 422);
        }

        $mentorship = Mentorship::create($data + ['mentee_id' => $me->id, 'status' => 'requested']);
        $this->notify($mentor, 'mentorship_requested', [
            'mentorship_id' => $mentorship->id,
            'message' => "{$me->name} asked you to be their mentor: “".Str::limit($data['message'], 160).'”',
        ]);

        return $this->ok($this->present($mentorship->load(['mentee', 'mentor', 'proposal']), $me), 'Request sent. You will be notified when they reply.', 201);
    }

    public function respond(Request $request, string $id): JsonResponse
    {
        $me = $request->user();
        $mentorship = Mentorship::with(['mentee', 'mentor', 'proposal'])->where('mentor_id', $me->id)->findOrFail($id);
        $data = $request->validate(['accept' => ['required', 'boolean'], 'response' => ['nullable', 'string', 'max:1000']]);

        if ($mentorship->status !== 'requested') {
            return response()->json(['data' => null, 'message' => 'This request has already been answered.', 'errors' => []], 422);
        }

        $mentorship->update(['status' => $data['accept'] ? 'active' : 'declined', 'response' => $data['response'] ?? null, 'responded_at' => now()]);
        $this->notify($mentorship->mentee, $data['accept'] ? 'mentorship_accepted' : 'mentorship_declined', [
            'mentorship_id' => $mentorship->id,
            'message' => $data['accept']
                ? "{$me->name} agreed to mentor you.".($data['response'] ? ' “'.Str::limit($data['response'], 160).'”' : '')
                : "{$me->name} cannot mentor you at the moment.".($data['response'] ? ' “'.Str::limit($data['response'], 160).'”' : ''),
        ]);

        return $this->ok($this->present($mentorship->fresh(['mentee', 'mentor', 'proposal']), $me), $data['accept'] ? 'You are now mentoring '.$mentorship->mentee->name.'.' : 'Request declined.');
    }

    /** Either side ends it; a mentee can also withdraw a request not yet answered. */
    public function end(Request $request, string $id): JsonResponse
    {
        $me = $request->user();
        $mentorship = Mentorship::with(['mentee', 'mentor', 'proposal'])
            ->where(fn ($q) => $q->where('mentee_id', $me->id)->orWhere('mentor_id', $me->id))->findOrFail($id);

        if (! in_array($mentorship->status, Mentorship::OPEN, true)) {
            return response()->json(['data' => null, 'message' => 'This mentorship is already closed.', 'errors' => []], 422);
        }

        $mentorship->update(['status' => 'ended', 'ended_at' => now()]);

        return $this->ok($this->present($mentorship, $me), 'Mentorship ended.');
    }

    /** The active mentor on a proposal, for its page — visible to the team and staff who can open it. */
    public function forProposal(Request $request, string $id, ProgressReportService $access): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user = $request->user();
        if (! $access->isTeamMember($proposal, $user) && ! ($user->can('proposals.view_any') && $user->accessScope()->covers($proposal->college_id, $proposal->category))) {
            return $this->ok(null);
        }

        $mentorship = Mentorship::with('mentor:id,name,title')->where('proposal_id', $proposal->id)->where('status', 'active')->latest()->first();

        return $this->ok($mentorship ? ['name' => trim(($mentorship->mentor->title ? $mentorship->mentor->title.' ' : '').$mentorship->mentor->name), 'since' => $mentorship->responded_at?->toDateString()] : null);
    }

    private function eligible(User $user): bool
    {
        return Proposal::where('pi_user_id', $user->id)->whereIn('status', self::FUNDED)->exists();
    }

    /**
     * What the person works on: profile expertise plus their proposals' keywords.
     *
     * @return Collection<int, string>
     */
    private function interests(User $user): Collection
    {
        return collect($user->expertise ?? [])
            ->merge(Proposal::where('pi_user_id', $user->id)->pluck('keywords')->flatMap(fn ($k) => explode(',', (string) $k)))
            ->map(fn ($v) => Str::lower(trim($v)))->filter()->unique()->values();
    }

    /** @return array<string, mixed> */
    private function present(Mentorship $m, User $viewer): array
    {
        $other = $m->mentee_id === $viewer->id ? $m->mentor : $m->mentee;

        return [
            'id' => $m->id,
            'status' => $m->status,
            'role' => $m->mentee_id === $viewer->id ? 'mentee' : 'mentor',
            'other' => $other ? trim(($other->title ? $other->title.' ' : '').$other->name) : 'Former user',
            'proposal' => $m->proposal ? ['id' => $m->proposal->id, 'tracker_number' => $m->proposal->tracker_number, 'title' => $m->proposal->title] : null,
            'message' => $m->message,
            'response' => $m->response,
            'created_at' => $m->created_at?->toIso8601String(),
            'responded_at' => $m->responded_at?->toIso8601String(),
        ];
    }

    /** @param  array<string, mixed>  $data */
    private function notify(User $user, string $event, array $data): void
    {
        try {
            $this->notifications->send($event, $user, $data);
        } catch (\Throwable $e) {
            Log::warning("Mentorship notification failed: {$e->getMessage()}");
        }
    }

    private function ok(mixed $data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }
}
