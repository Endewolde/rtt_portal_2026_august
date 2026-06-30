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
            ->whereHas('roles', fn ($q) => $q->where('name', 'staff'))
            ->where('status', 'active')
            ->where('id', '!=', $proposal->pi_user_id)
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

            return [
                'id' => $reviewer->id,
                'name' => $reviewer->name,
                'email' => $reviewer->email,
                'avatar' => $reviewer->avatar,
                'expertise' => $reviewer->expertise,
                'match_score' => $matched->count(),
                'matched_terms' => $matched->values()->all(),
            ];
        })
            ->filter(fn ($r) => $r['match_score'] > 0)
            ->sortByDesc('match_score')
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
