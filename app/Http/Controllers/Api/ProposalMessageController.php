<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ProposalMessage;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\ProgressReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The message thread on a proposal: the research team and the staff handling it
 * ask for and give clarifications, with attachments, all kept on the record.
 * Reviewers never see it — blind review stays blind.
 */
class ProposalMessageController extends Controller
{
    public function __construct(private ProgressReportService $access, private NotificationService $notifications) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user = $request->user();
        if (! $this->canSee($proposal, $user)) {
            return $this->forbidden();
        }

        $lastRead = DB::table('proposal_message_reads')->where('proposal_id', $proposal->id)->where('user_id', $user->id)->value('last_read_at');
        $messages = ProposalMessage::with('user:id,name,title')->where('proposal_id', $proposal->id)->orderBy('created_at')->get();
        $this->markRead($proposal, $user);

        return response()->json(['data' => $messages->map(fn ($m) => $this->present($m, $user, $lastRead))->values(), 'message' => '', 'errors' => [], 'meta' => [
            'can_post' => true,
            'is_team' => $this->access->isTeamMember($proposal, $user),
        ]]);
    }

    public function unread(Request $request, string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user = $request->user();
        if (! $this->canSee($proposal, $user)) {
            return response()->json(['data' => ['count' => 0, 'can_see' => false]]);
        }

        $lastRead = DB::table('proposal_message_reads')->where('proposal_id', $proposal->id)->where('user_id', $user->id)->value('last_read_at');
        $count = ProposalMessage::where('proposal_id', $proposal->id)
            ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', '!=', $user->id))
            ->when($lastRead, fn ($q) => $q->where('created_at', '>', $lastRead))
            ->count();

        return response()->json(['data' => ['count' => $count, 'can_see' => true]]);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user = $request->user();
        if (! $this->canSee($proposal, $user)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:10240', 'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,png,jpg,jpeg,txt,csv,zip'],
        ]);

        $fromTeam = $this->access->isTeamMember($proposal, $user);
        $message = new ProposalMessage([
            'proposal_id' => $proposal->id,
            'user_id' => $user->id,
            'body' => trim($validated['body']),
            'from_team' => $fromTeam,
        ]);

        if ($file = $request->file('attachment')) {
            $message->attachment_path = $file->storeAs("proposal-messages/{$proposal->id}", Str::uuid().'.'.$file->getClientOriginalExtension(), 'private');
            $message->attachment_name = Str::limit($file->getClientOriginalName(), 200, '');
        }
        $message->save();
        $this->markRead($proposal, $user);

        $this->notifyOtherSide($proposal, $message->load('user:id,name,title'), $user, $fromTeam);

        return response()->json(['data' => $this->present($message, $user, now()), 'message' => 'Message sent.', 'errors' => [], 'meta' => []], 201);
    }

    public function attachment(Request $request, string $messageId): StreamedResponse|JsonResponse
    {
        $message = ProposalMessage::with('proposal')->findOrFail($messageId);
        if (! $this->canSee($message->proposal, $request->user())) {
            return $this->forbidden();
        }
        if (! $message->attachment_path || ! Storage::disk('private')->exists($message->attachment_path)) {
            abort(404, 'Attachment not found.');
        }

        return Storage::disk('private')->download($message->attachment_path, $message->attachment_name ?: basename($message->attachment_path));
    }

    /** The research team, and staff allowed to message teams in this proposal's college and category. */
    private function canSee(Proposal $proposal, User $user): bool
    {
        return $this->access->isTeamMember($proposal, $user)
            || ($user->can('proposal_messages.staff') && $user->accessScope()->covers($proposal->college_id, $proposal->category));
    }

    private function markRead(Proposal $proposal, User $user): void
    {
        DB::table('proposal_message_reads')->updateOrInsert(
            ['proposal_id' => $proposal->id, 'user_id' => $user->id],
            ['last_read_at' => now()],
        );
    }

    /**
     * The team hears from staff; staff hear from the team — those already in the
     * conversation, otherwise the college-level staff for this proposal, otherwise
     * everyone who may message teams about it.
     */
    private function notifyOtherSide(Proposal $proposal, ProposalMessage $message, User $author, bool $fromTeam): void
    {
        $recipients = $this->teamOf($proposal);

        if ($fromTeam) {
            $participants = User::whereIn('id', ProposalMessage::where('proposal_id', $proposal->id)->where('from_team', false)->whereNotNull('user_id')->pluck('user_id'))
                ->where('status', 'active')->get();
            $candidates = User::whoCan('proposal_messages.staff', $proposal->college_id, $proposal->category);
            $college = $candidates->filter(fn (User $u) => $u->accessScope()->isCollege());
            $recipients = $participants->isNotEmpty() ? $participants : ($college->isNotEmpty() ? $college : $candidates);
        }

        $preview = Str::limit(preg_replace('/\s+/', ' ', $message->body), 160);
        foreach ($recipients->unique('id')->reject(fn ($u) => $u->id === $author->id) as $recipient) {
            try {
                $this->notifications->send('proposal_message', $recipient, [
                    'proposal_id' => $proposal->id,
                    'tracker_number' => $proposal->tracker_number,
                    'author' => $author->name,
                    'message' => "{$author->name} wrote about {$proposal->tracker_number}: “{$preview}”",
                ]);
            } catch (\Throwable $e) {
                Log::warning("Proposal message notification failed: {$e->getMessage()}");
            }
        }
    }

    /** @return Collection<int, User> */
    private function teamOf(Proposal $proposal): Collection
    {
        $ids = $proposal->activeMembers()->pluck('user_id')->push($proposal->pi_user_id)->filter()->unique();

        return User::whereIn('id', $ids)->where('status', 'active')->get();
    }

    /** @return array<string, mixed> */
    private function present(ProposalMessage $m, User $viewer, mixed $lastRead): array
    {
        return [
            'id' => $m->id,
            'body' => $m->body,
            'author' => $m->user ? trim(($m->user->title ? $m->user->title.' ' : '').$m->user->name) : 'Former user',
            'mine' => $m->user_id === $viewer->id,
            'from_team' => $m->from_team,
            'attachment_name' => $m->attachment_name,
            'has_attachment' => (bool) $m->attachment_path,
            'created_at' => $m->created_at->toIso8601String(),
            'new' => $m->user_id !== $viewer->id && $lastRead !== null && $m->created_at->gt($lastRead),
        ];
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'You cannot see this conversation.', 'errors' => []], 403);
    }
}
