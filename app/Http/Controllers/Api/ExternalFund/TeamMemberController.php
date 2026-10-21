<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundTeamMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamMemberController extends Controller
{
    public function index(string $applicationId): JsonResponse
    {
        $application = ExternalFundApplication::findOrFail($applicationId);

        return response()->json([
            'data' => $application->teamMembers()->with('user:id,name,email')->get(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function store(Request $request, string $applicationId): JsonResponse
    {
        if (! $request->user()?->can('external_funds.team')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $application = ExternalFundApplication::findOrFail($applicationId);

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
        if (! $request->user()?->can('external_funds.team')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ExternalFundTeamMember::findOrFail($id)->delete();

        return response()->json(['data' => null, 'message' => 'Team member removed.', 'errors' => [], 'meta' => []]);
    }
}
