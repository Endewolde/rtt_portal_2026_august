<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundTeamMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamMemberController extends Controller
{
    public function index(Request $request, string $applicationId): JsonResponse
    {
        $application = ExternalFundApplication::findOrFail($applicationId);
        if (! $application->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json([
            'data' => $application->teamMembers()->with('user:id,name,email')->get(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function store(Request $request, string $applicationId): JsonResponse
    {
        $application = ExternalFundApplication::findOrFail($applicationId);
        if (! $this->canEditTeam($request->user(), $application)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'affiliation' => 'nullable|string|max:255',
            'role' => 'required|in:pi,co_pi,collaborator,partner',
            'is_external' => 'boolean',
        ]);

        $data['application_id'] = $application->id;

        $member = ExternalFundTeamMember::create($data);

        return response()->json([
            'data' => $member,
            'message' => 'Team member added.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $member = ExternalFundTeamMember::with('application')->findOrFail($id);
        if (! $member->application || ! $this->canEditTeam($request->user(), $member->application)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $member->delete();

        return response()->json(['data' => null, 'message' => 'Team member removed.', 'errors' => [], 'meta' => []]);
    }

    /** The office (and college officers) manage any team; the PI manages their own while it is still a draft. */
    private function canEditTeam(User $user, ExternalFundApplication $application): bool
    {
        return $user->can('external_funds.team')
            || ($application->status === 'draft' && ($application->created_by === $user->id || $application->pi_user_id === $user->id));
    }
}
