<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ReviewerMatchController extends Controller
{
    public function suggestions(Request $request, string $proposalId): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasPermissionTo('reviewer_match.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $proposal = Proposal::findOrFail($proposalId);

        $proposalTerms = $this->extractTerms($proposal);

        $reviewers = User::with('roles:id,name')
            ->whereNotNull('expertise')
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['staff', 'external_reviewer']))
            ->where('status', 'active')
            ->where('id', '!=', $proposal->pi_user_id)
            ->withCount([
                'reviewAssignments as active_assignments' => fn ($q) => $q->whereIn('status', ['pending', 'accepted', 'in_progress']),
                'reviewAssignments as completed_assignments' => fn ($q) => $q->where('status', 'submitted'),
                'reviewAssignments as on_time_assignments' => fn ($q) => $q->where('status', 'submitted')
                    ->whereColumn('submitted_at', '<=', 'due_date'),
            ])
            ->get(['id', 'name', 'email', 'avatar', 'expertise', 'department_id']);

        $scored = $reviewers->map(function (User $reviewer) use ($proposalTerms) {
            $expertise = collect($reviewer->expertise ?? [])
                ->map(fn ($e) => strtolower(trim($e)))
                ->filter()
                ->values();

            $matched = $expertise->filter(function ($skill) use ($proposalTerms) {
                return $proposalTerms->contains(function ($term) use ($skill) {
                    // Exact match
                    if ($skill === $term) {
                        return true;
                    }
                    // Substring match (either direction)
                    if (str_contains($skill, $term) || str_contains($term, $skill)) {
                        return true;
                    }
                    // Word-level: any word in the expertise tag matches the term
                    $skillWords = preg_split('/[\s&,]+/', $skill);
                    foreach ($skillWords as $word) {
                        if (strlen($word) >= 2 && ($word === $term || str_contains($term, $word) || str_contains($word, $term))) {
                            return true;
                        }
                    }

                    return false;
                });
            });

            // Reliability: on-time rate among completed reviews. Reviewers with no
            // completed history get a neutral 50% factor — neither rewarded nor
            // penalized for being new.
            $onTimeRate = $reviewer->completed_assignments > 0
                ? round(($reviewer->on_time_assignments / $reviewer->completed_assignments) * 100)
                : null;
            $reliabilityFactor = $onTimeRate === null ? 0.5 : $onTimeRate / 100;

            // Current workload discourages piling more reviews onto an already-busy
            // reviewer, capped so it can never fully cancel out a genuine expertise match.
            $workloadPenalty = min($reviewer->active_assignments, 5) * 0.15;

            $matchScore = $matched->count();
            $compositeScore = round($matchScore + ($reliabilityFactor * 0.9) - $workloadPenalty, 3);

            return [
                'id' => $reviewer->id,
                'name' => $reviewer->name,
                'email' => $reviewer->email,
                'avatar' => $reviewer->avatar,
                'expertise' => $reviewer->expertise,
                'roles' => $reviewer->roles->map(fn ($r) => ['id' => $r->id, 'name' => $r->name])->values(),
                'match_score' => $matchScore,
                'matched_terms' => $matched->values()->all(),
                'active_assignments' => $reviewer->active_assignments,
                'completed_assignments' => $reviewer->completed_assignments,
                'on_time_rate' => $onTimeRate,
                'composite_score' => $compositeScore,
            ];
        })
            ->filter(fn ($r) => $r['match_score'] > 0)
            ->sortByDesc('composite_score')
            ->take(10)
            ->values();

        return response()->json([
            'data' => $scored,
            'message' => 'Suggestions retrieved.',
            'errors' => [],
            'meta' => [
                'proposal_terms' => $proposalTerms->take(15)->values(),
                'total_matched' => $scored->count(),
            ],
        ]);
    }

    /** @return Collection<string> */
    private function extractTerms(Proposal $proposal): Collection
    {
        $stopWords = collect(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to',
            'for', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
            'this', 'that', 'it', 'its', 'as', 'has', 'have', 'had', 'will', 'can',
            'may', 'should', 'which', 'their', 'our', 'we', 'i', 'not', 'than']);

        // Keywords get priority — keep even single-char abbreviations (AI, ML, etc.)
        $keywords = collect(explode(',', $proposal->keywords ?? ''))
            ->map(fn ($k) => strtolower(trim($k)))
            ->filter(fn ($k) => strlen($k) >= 1);

        // Also include full multi-word keyword phrases for phrase-level matching
        $keywordPhrases = $keywords->filter(fn ($k) => str_contains($k, ' '));

        // Words from title, abstract, focus_area — min length 2 to catch AI, ML, etc.
        $raw = collect([
            $proposal->title,
            $proposal->abstract,
            $proposal->focus_area,
        ])->filter()->implode(' ');

        $words = collect(preg_split('/[\s,;.:()\[\]]+/', strtolower($raw)))
            ->filter(fn ($w) => strlen($w) >= 2 && ! $stopWords->contains($w));

        return $keywords->merge($keywordPhrases)->merge($words)->unique()->values();
    }
}
