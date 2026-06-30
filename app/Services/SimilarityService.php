<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SimilarityService
{
    /**
     * Check a newly submitted proposal for similarity against existing proposals.
     * NEVER auto-rejects based on similarity score.
     */
    public function check(Proposal $proposal): void
    {
        $comparisons = Proposal::where('category', $proposal->category)
            ->where('id', '!=', $proposal->id)
            ->whereNotIn('status', ['draft'])
            ->get(['id', 'title', 'abstract', 'keywords']);

        if ($comparisons->isEmpty()) {
            return;
        }

        $threshold = (float) (DB::table('threshold_settings')
            ->where('key', 'similarity_threshold')
            ->value('value') ?? 0.70);

        $corpus = $this->buildCorpus($proposal, $comparisons);
        $proposalText = $this->buildText($proposal);
        $proposalVector = $this->buildTfIdfVector($proposalText, $corpus);

        $scores = [];

        foreach ($comparisons as $comparison) {
            $comparisonText = $this->buildText($comparison);
            $comparisonVector = $this->buildTfIdfVector($comparisonText, $corpus);
            $scores[$comparison->id] = $this->cosineSimilarity($proposalVector, $comparisonVector);
        }

        arsort($scores);
        $top5 = array_slice($scores, 0, 5, true);

        foreach ($top5 as $similarProposalId => $score) {
            $flagged = $score >= $threshold;

            if ($proposal->id === $similarProposalId) {
                continue;
            }

            // Normalize pair so A < B always — prevents bidirectional duplicates during backfill.
            $pairA = $proposal->id < $similarProposalId ? $proposal->id : $similarProposalId;
            $pairB = $proposal->id < $similarProposalId ? $similarProposalId : $proposal->id;

            DB::table('similarity_scores')->upsert(
                [
                    'id' => Str::uuid()->toString(),
                    'proposal_id' => $pairA,
                    'similar_proposal_id' => $pairB,
                    'score' => round($score, 4),
                    'flagged' => $flagged,
                    'checked_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                ['proposal_id', 'similar_proposal_id'],
                ['score', 'flagged', 'checked_at', 'updated_at']
            );

            if ($flagged) {
                $centralOfficer = User::role('central_officer')->first()
                    ?? User::role('super_admin')->first();

                if ($centralOfficer) {
                    app(NotificationService::class)->send('similarity_flagged', $centralOfficer, [
                        'proposal_id' => $proposal->id,
                        'tracker_number' => $proposal->tracker_number,
                        'similar_proposal_id' => $similarProposalId,
                        'score' => round($score * 100, 1).'%',
                    ]);
                }
            }
        }
    }

    private function buildText(Proposal $proposal): string
    {
        return strtolower(
            ($proposal->title ?? '').' '.
            ($proposal->abstract ?? '').' '.
            ($proposal->keywords ?? '')
        );
    }

    /** @param Collection<int, Proposal> $comparisons */
    private function buildCorpus(Proposal $proposal, Collection $comparisons): array
    {
        $corpus = [$proposal->id => $this->buildText($proposal)];

        foreach ($comparisons as $c) {
            $corpus[$c->id] = $this->buildText($c);
        }

        return $corpus;
    }

    private function tokenize(string $text): array
    {
        $stopwords = [
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'this', 'that', 'these', 'those', 'it',
        ];

        $words = preg_split('/\W+/', $text, -1, PREG_SPLIT_NO_EMPTY);

        return array_filter($words, fn ($w) => strlen($w) > 2 && ! in_array($w, $stopwords));
    }

    private function buildTfIdfVector(string $text, array $corpus): array
    {
        $tokens = $this->tokenize($text);
        $docCount = count($corpus);
        $tf = array_count_values($tokens);
        $total = count($tokens) ?: 1;
        $vector = [];

        foreach ($tf as $term => $count) {
            $termFreq = $count / $total;

            $docsWithTerm = 0;
            foreach ($corpus as $docText) {
                if (str_contains($docText, $term)) {
                    $docsWithTerm++;
                }
            }

            $idf = log(($docCount + 1) / ($docsWithTerm + 1)) + 1;
            $vector[$term] = $termFreq * $idf;
        }

        return $vector;
    }

    private function cosineSimilarity(array $v1, array $v2): float
    {
        $allTerms = array_unique(array_merge(array_keys($v1), array_keys($v2)));
        $dotProduct = 0;
        $mag1 = 0;
        $mag2 = 0;

        foreach ($allTerms as $term) {
            $a = $v1[$term] ?? 0;
            $b = $v2[$term] ?? 0;
            $dotProduct += $a * $b;
            $mag1 += $a * $a;
            $mag2 += $b * $b;
        }

        $magnitude = sqrt($mag1) * sqrt($mag2);

        return $magnitude > 0 ? $dotProduct / $magnitude : 0.0;
    }
}
