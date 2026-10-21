<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DataDeletionRequest;
use App\Services\PersonalDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PersonalDataController extends Controller
{
    public function __construct(private PersonalDataService $personalData) {}

    /** Everything the platform holds about the signed-in user, as a JSON file. */
    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();
        $json = json_encode($this->personalData->export($user), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return response()->streamDownload(fn () => print ($json), 'my-data-'.Str::slug($user->name).'-'.now()->format('Y-m-d').'.json', ['Content-Type' => 'application/json']);
    }

    public function myRequest(Request $request): JsonResponse
    {
        $latest = DataDeletionRequest::where('user_id', $request->user()->id)->latest()->first(['id', 'status', 'reason', 'admin_note', 'created_at', 'handled_at']);

        return $this->ok($latest);
    }

    public function requestDeletion(Request $request): JsonResponse
    {
        $reason = $request->validate(['reason' => 'nullable|string|max:1000'])['reason'] ?? null;

        try {
            $deletion = $this->personalData->requestDeletion($request->user(), $reason);
        } catch (\RuntimeException $e) {
            return $this->fail($e->getMessage());
        }

        return $this->ok($deletion, 'Your request was sent to the administrators. You will be told when it has been reviewed.');
    }

    public function cancelRequest(Request $request): JsonResponse
    {
        $pending = DataDeletionRequest::where('user_id', $request->user()->id)->where('status', DataDeletionRequest::STATUS_PENDING)->first();
        if (! $pending) {
            return $this->fail('There is no pending request to cancel.');
        }
        $pending->update(['status' => DataDeletionRequest::STATUS_CANCELLED, 'handled_at' => now()]);

        return $this->ok(null, 'Deletion request cancelled.');
    }

    /** Admin: requests, newest first, each with anything that blocks removal. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('data_requests.manage')) {
            return $this->forbidden();
        }

        $requests = DataDeletionRequest::with(['user:id,name,email,status', 'handler:id,name'])
            ->orderByRaw("status = 'pending' DESC")
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn (DataDeletionRequest $r) => [
                'id' => $r->id,
                'status' => $r->status,
                'reason' => $r->reason,
                'admin_note' => $r->admin_note,
                'created_at' => $r->created_at->toIso8601String(),
                'handled_at' => $r->handled_at?->toIso8601String(),
                'handled_by' => $r->handler?->name,
                'user' => ['id' => $r->user?->id, 'name' => $r->user?->name, 'email' => $r->user?->email],
                'blockers' => $r->status === DataDeletionRequest::STATUS_PENDING && $r->user ? $this->personalData->blockers($r->user) : [],
            ]);

        return $this->ok($requests);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('data_requests.manage')) {
            return $this->forbidden();
        }
        $note = $request->validate(['note' => 'nullable|string|max:1000'])['note'] ?? null;

        try {
            $this->personalData->approve(DataDeletionRequest::with('user')->findOrFail($id), $request->user(), $note);
        } catch (\RuntimeException $e) {
            return $this->fail($e->getMessage());
        }

        return $this->ok(null, 'The account has been anonymised and the person notified by email.');
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('data_requests.manage')) {
            return $this->forbidden();
        }
        $note = (string) $request->validate(['note' => 'required|string|min:10|max:1000'])['note'];

        try {
            $this->personalData->reject(DataDeletionRequest::with('user')->findOrFail($id), $request->user(), $note);
        } catch (\RuntimeException $e) {
            return $this->fail($e->getMessage());
        }

        return $this->ok(null, 'Request declined. The person has been told why.');
    }

    private function ok(mixed $data, string $message = ''): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []]);
    }

    private function fail(string $message): JsonResponse
    {
        return response()->json(['data' => null, 'message' => $message, 'errors' => [], 'meta' => []], 422);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
    }
}
