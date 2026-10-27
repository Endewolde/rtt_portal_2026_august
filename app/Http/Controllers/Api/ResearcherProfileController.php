<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ResearchOutput;
use App\Models\User;
use App\Services\ResearchOutputService;
use App\Support\Programmes;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Researcher profile pages on the public site, built from what the platform already
 * holds: funded projects, recorded outputs and research themes. A profile is private
 * until the researcher switches it on, and never shows contact details.
 */
class ResearcherProfileController extends Controller
{
    /** Outputs shown publicly: checked by the college or approved. */
    private const PUBLIC_OUTPUT_STATUSES = ['verified', 'approved'];

    /** The public directory: researchers who have switched their profile on. */
    public function index(Request $request): JsonResponse
    {
        $researchers = $this->publicResearchers()
            ->with(['college:id,name', 'department:id,name'])
            ->when($request->filled('q'), function (Builder $q) use ($request) {
                $term = '%'.Str::lower($request->string('q')->trim()).'%';
                // expertise is JSON, which MySQL compares case-sensitively.
                $q->where(fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', [$term])->orWhereRaw('LOWER(CAST(expertise AS CHAR)) LIKE ?', [$term]));
            })
            ->when($request->filled('college_id'), fn ($q) => $q->where('college_id', $request->college_id))
            ->orderBy('name')
            ->paginate(24, ['id', 'name', 'title', 'avatar', 'college_id', 'department_id', 'expertise', 'profile_slug']);

        $ids = $researchers->getCollection()->pluck('id')->all();
        $projectCounts = $this->projectsOf($ids)
            ->with(['members' => fn ($m) => $m->whereIn('user_id', $ids)->where('status', 'active')->select('id', 'proposal_id', 'user_id')])
            ->get(['proposals.id', 'pi_user_id'])
            ->flatMap(fn (Proposal $p) => $p->members->pluck('user_id')->push($p->pi_user_id)->intersect($ids)->unique())
            ->countBy();

        $researchers->getCollection()->transform(fn (User $u) => [
            'slug' => $u->profile_slug,
            'name' => $u->name,
            'title' => $u->title,
            'avatar' => $u->avatar,
            'college' => $u->college?->name,
            'department' => $u->department?->name,
            'expertise' => array_slice($u->expertise ?? [], 0, 4),
            'projects' => $projectCounts[$u->id] ?? 0,
        ]);

        return response()->json(['data' => $researchers, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** One researcher's public page. */
    public function show(string $slug): JsonResponse
    {
        $user = $this->publicResearchers()->where('profile_slug', $slug)->with(['college:id,name', 'department:id,name'])->first();
        if (! $user) {
            return response()->json(['data' => null, 'message' => 'This profile does not exist or is not public.', 'errors' => [], 'meta' => []], 404);
        }

        $projects = $this->projectsOf([$user->id])
            ->orderByDesc('academic_year')
            ->get(['proposals.id', 'tracker_number', 'title', 'category', 'status', 'academic_year', 'focus_area', 'pi_user_id']);

        $outputs = ResearchOutput::with(['publication:id,research_output_id,doi,journal_name,year,publisher', 'conferencePresentation:id,research_output_id,doi,conference_name'])
            ->whereIn('proposal_id', $projects->pluck('id'))
            ->whereIn('status', self::PUBLIC_OUTPUT_STATUSES)
            ->orderByDesc('created_at')
            ->get(['id', 'proposal_id', 'output_type', 'title']);

        return response()->json(['data' => [
            'name' => $user->name,
            'title' => $user->title,
            'avatar' => $user->avatar,
            'college' => $user->college?->name,
            'department' => $user->department?->name,
            'bio' => $user->bio,
            'orcid' => $user->orcid,
            'expertise' => $user->expertise ?? [],
            'themes' => $projects->pluck('focus_area')->filter()->map(fn ($t) => trim($t))->unique()->values(),
            'stats' => [
                'projects' => $projects->count(),
                'as_pi' => $projects->where('pi_user_id', $user->id)->count(),
                'ongoing' => $projects->whereIn('status', ['funded', 'midterm_evaluation'])->count(),
                'outputs' => $outputs->count(),
            ],
            'projects' => $projects->map(fn (Proposal $p) => [
                'tracker_number' => $p->tracker_number,
                'title' => $p->title,
                'category' => Programmes::label($p->category),
                'academic_year' => $p->academic_year,
                'theme' => $p->focus_area,
                'role' => $p->pi_user_id === $user->id ? 'Principal Investigator' : 'Co-investigator',
                'state' => in_array($p->status, ['funded', 'midterm_evaluation'], true) ? 'Ongoing' : 'Completed',
            ])->values(),
            'outputs' => $outputs->map(function (ResearchOutput $o) use ($projects) {
                $doi = $o->publication?->doi ?? $o->conferencePresentation?->doi;

                return [
                    'type' => $o->output_type,
                    'title' => $o->title,
                    'venue' => $o->publication?->journal_name ?? $o->conferencePresentation?->conference_name ?? $o->publication?->publisher,
                    'year' => $o->publication?->year,
                    'doi' => $doi,
                    'project' => $projects->firstWhere('id', $o->proposal_id)?->tracker_number,
                ];
            })->values(),
        ], 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** The signed-in user's public profile settings. */
    public function settings(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->presentSettings($request->user()), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'public_profile' => ['required', 'boolean'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'orcid' => ['nullable', 'string', 'regex:/^(https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i'],
            'profile_slug' => ['nullable', 'string', 'min:3', 'max:120', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/', Rule::unique('users', 'profile_slug')->ignore($user->id)],
        ], [
            'orcid.regex' => 'An ORCID iD looks like 0000-0002-1825-0097.',
            'profile_slug.regex' => 'Use lowercase letters, numbers and single hyphens only.',
        ]);

        $user->update([
            'public_profile' => $validated['public_profile'],
            'bio' => $validated['bio'] ?? null,
            'orcid' => isset($validated['orcid']) ? Str::upper(Str::afterLast($validated['orcid'], '/')) : null,
            'profile_slug' => $validated['profile_slug'] ?? $user->profile_slug ?? $this->uniqueSlug($user),
        ]);

        return response()->json([
            'data' => $this->presentSettings($user->fresh()),
            'message' => $validated['public_profile'] ? 'Your public profile is on.' : 'Your public profile is off.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** @return array<string, mixed> */
    private function presentSettings(User $user): array
    {
        return [
            'public_profile' => (bool) $user->public_profile,
            'profile_slug' => $user->profile_slug ?? $this->uniqueSlug($user),
            'bio' => $user->bio,
            'orcid' => $user->orcid,
            'has_projects' => $this->projectsOf([$user->id])->exists(),
        ];
    }

    private function publicResearchers(): Builder
    {
        return User::query()
            ->where('public_profile', true)
            ->whereNotNull('profile_slug')
            ->where('status', 'active');
    }

    /**
     * Funded (or later) projects these users lead or are active members of.
     *
     * @param  list<string>  $userIds
     */
    private function projectsOf(array $userIds): Builder
    {
        return Proposal::query()
            ->whereIn('proposals.status', ResearchOutputService::RECORDABLE_STATUSES)
            ->where(fn ($q) => $q->whereIn('pi_user_id', $userIds)
                ->orWhereHas('members', fn ($m) => $m->whereIn('user_id', $userIds)->where('status', 'active')));
    }

    private function uniqueSlug(User $user): string
    {
        $base = Str::slug($user->name) ?: 'researcher';
        $slug = $base;
        for ($i = 2; User::where('profile_slug', $slug)->where('id', '!=', $user->id)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
