<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\DefenceDeadlineException;
use App\Http\Controllers\Controller;
use App\Models\DefenceDeadlineExtension;
use App\Models\DefenceSession;
use App\Services\DefenceDeadlineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DefenceDeadlineController extends Controller
{
    public function __construct(private DefenceDeadlineService $deadlines) {}

    /** College officer: ask for a later score deadline for one proposal's defence. */
    public function requestExtension(Request $request, string $sessionId): JsonResponse
    {
        $validated = $request->validate([
            'requested_until' => 'required|date',
            'reason' => 'required|string|min:10|max:2000',
        ]);

        $session = DefenceSession::with('proposal')->findOrFail($sessionId);

        try {
            $this->deadlines->requestExtension($session, $request->user(), Carbon::parse($validated['requested_until']), $validated['reason']);
        } catch (DefenceDeadlineException $e) {
            return $this->respond(null, $e->getMessage(), $e->status);
        }

        return $this->respond(
            $this->deadlines->present($session->fresh(), $request->user()),
            'Extension request sent for approval. You will be notified once it is decided.',
            201
        );
    }

    /** Requests the viewer may decide: central office sees all, directors their own category. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->deadlines->isApprover($user)) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        $visible = DefenceDeadlineExtension::with([
            'proposal:id,tracker_number,title,category,college_id,status',
            'proposal.college:id,name',
            'defenceSession',
            'requestedBy:id,name',
            'decidedBy:id,name',
        ])
            ->latest()
            ->get()
            ->filter(fn (DefenceDeadlineExtension $e) => $this->deadlines->canApprove($e->proposal, $user))
            ->values();

        $counts = [
            'pending' => $visible->where('status', 'pending')->count(),
            'approved' => $visible->where('status', 'approved')->count(),
            'denied' => $visible->where('status', 'denied')->count(),
        ];

        $filtered = $request->filled('status') ? $visible->where('status', $request->status)->values() : $visible;

        return response()->json([
            'data' => $filtered->map(fn (DefenceDeadlineExtension $e) => array_merge($this->deadlines->presentExtension($e), [
                'proposal' => [
                    'id' => $e->proposal?->id,
                    'tracker_number' => $e->proposal?->tracker_number,
                    'title' => $e->proposal?->title,
                    'category' => $e->proposal?->category,
                    'college_name' => $e->proposal?->college?->name,
                ],
                'defence_date' => $e->defenceSession?->scheduled_date?->toDateString(),
                'current_deadline' => $e->defenceSession?->scoreDeadline()->toIso8601String(),
            ]))->values(),
            'message' => '',
            'errors' => [],
            'meta' => ['counts' => $counts],
        ]);
    }

    public function decide(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'decision' => 'required|in:approved,denied',
            'granted_until' => 'nullable|date',
            'notes' => 'required|string|min:5|max:2000',
        ]);

        $extension = DefenceDeadlineExtension::findOrFail($id);

        try {
            $extension = $this->deadlines->decide(
                $extension,
                $request->user(),
                $validated['decision'],
                isset($validated['granted_until']) ? Carbon::parse($validated['granted_until']) : null,
                $validated['notes']
            );
        } catch (DefenceDeadlineException $e) {
            return $this->respond(null, $e->getMessage(), $e->status);
        }

        return $this->respond(
            $this->deadlines->presentExtension($extension),
            $validated['decision'] === 'approved'
                ? 'Extension approved — reviewers can now submit until '.$extension->granted_until->format('D, M j, Y g:i A').'.'
                : 'Extension request denied.'
        );
    }

    private function respond(mixed $data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }
}
