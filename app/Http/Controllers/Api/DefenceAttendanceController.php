<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DefenceSession;
use App\Models\ReviewAssignment;
use App\Services\DefenceAttendanceService;
use App\Services\DefenceDeadlineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/** Recording whether an open defence took place — see DefenceAttendanceService. */
class DefenceAttendanceController extends Controller
{
    public function __construct(
        private DefenceAttendanceService $attendance,
        private DefenceDeadlineService $deadlines,
    ) {}

    /** College officer: the defence was held, or the team did not appear. */
    public function mark(Request $request, string $sessionId): JsonResponse
    {
        $validated = $request->validate([
            'attendance' => ['required', Rule::in([DefenceAttendanceService::HELD, DefenceAttendanceService::ABSENT])],
            'note' => ['nullable', 'required_if:attendance,'.DefenceAttendanceService::ABSENT, 'string', 'min:10', 'max:2000'],
        ], [
            'note.required_if' => 'Describe what happened — for example who was contacted and when.',
        ]);

        $session = DefenceSession::with('proposal')->findOrFail($sessionId);
        $user = $request->user();

        if (! $this->attendance->canMark($session, $user)) {
            return $this->respond(null, 'Only the college officer running this defence can record its attendance.', 403);
        }

        if ($error = $this->attendance->markError($session)) {
            return $this->respond(null, $error, 422);
        }

        try {
            if ($validated['attendance'] === DefenceAttendanceService::ABSENT) {
                $proposal = $this->attendance->markAbsent($session, $user, $validated['note']);

                return $this->respond(
                    ['proposal_status' => $proposal->status],
                    'Recorded that the team did not appear. The proposal has been rejected, any scores submitted were voided and the team has been notified.'
                );
            }

            $session = $this->attendance->markHeld($session, $user, $validated['note'] ?? null);
        } catch (\Throwable $e) {
            Log::error("Recording defence attendance failed for session {$sessionId}: {$e->getMessage()}");

            return $this->respond(null, 'Attendance could not be recorded. Please try again or contact an administrator.', 422);
        }

        $status = $session->proposal->fresh()->status;

        return $this->respond(
            ['proposal_status' => $status, 'defence' => $this->deadlines->present($session, $user)],
            $status === 'under_open_defence'
                ? 'Defence recorded as held. The result will be decided once every panel score is in.'
                : 'Defence recorded as held, and the result has been decided from the panel\'s scores.'
        );
    }

    /** Panel member: the team did not appear — the college officer is asked to confirm. */
    public function reportAbsence(Request $request, string $assignmentId): JsonResponse
    {
        $validated = $request->validate(['note' => 'nullable|string|max:1000']);

        $assignment = ReviewAssignment::with(['evaluationType', 'proposal'])->findOrFail($assignmentId);
        $user = $request->user();

        if ($assignment->reviewer_id !== $user->id || ! str_starts_with($assignment->evaluationType?->name ?? '', 'open_defence')) {
            return $this->respond(null, 'Only a panel member of this open defence can report this.', 403);
        }

        if (! in_array($assignment->status, ['pending', 'accepted', 'in_progress'], true)) {
            return $this->respond(null, 'Your review for this defence is no longer open.', 422);
        }

        $session = $this->attendance->currentSession($assignment->proposal);
        if ($error = $this->attendance->markError($session)) {
            return $this->respond(null, $error, 422);
        }

        if ($session->absence_reported_at) {
            return $this->respond(null, 'A panel member has already reported this. The college officer has been asked to confirm.', 422);
        }

        $this->attendance->reportAbsence($session, $assignment, $user, $validated['note'] ?? null);

        return $this->respond(null, 'Thank you. The college officer has been asked to confirm, and you don\'t need to submit a score while they do.');
    }

    private function respond(mixed $data, string $message, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }
}
