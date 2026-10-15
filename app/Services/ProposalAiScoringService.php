<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\ProposalAiScore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Log;

class ProposalAiScoringService
{
    private const SYSTEM_PROMPT = <<<'EOT'
You are a research proposal pre-screening assistant. Evaluate the proposal on five criteria and return ONLY valid JSON — no prose, no markdown fences.

Return exactly this structure:
{
  "clarity_score": <0-10>,
  "feasibility_score": <0-10>,
  "budget_alignment_score": <0-10>,
  "innovation_score": <0-10>,
  "completeness_score": <0-10>,
  "overall_score": <0-10>,
  "strengths": "<2-3 key strengths, comma-separated>",
  "weaknesses": "<2-3 key gaps or weaknesses, comma-separated>",
  "recommendations": "<1-2 actionable recommendations for the PI>",
  "summary": "<1-2 sentence neutral summary of this proposal>"
}

Scoring guide:
- clarity_score: How clearly the problem, objectives, and methods are articulated
- feasibility_score: Whether the scope is achievable within the stated timeline and resources
- budget_alignment_score: Whether the budget justification matches the described activities
- innovation_score: Novelty and originality of the approach
- completeness_score: Whether all required sections are substantively filled
- overall_score: Holistic quality (not an average — use your judgment)
EOT;

    public function __construct(private AiClient $ai) {}

    public function score(Proposal $proposal): ProposalAiScore
    {
        $aiScore = ProposalAiScore::firstOrCreate(
            ['proposal_id' => $proposal->id],
            ['status' => 'pending']
        );

        $aiScore->update(['status' => 'pending']);

        try {
            $provider = $this->ai->provider();
            $text = $this->buildProposalText($proposal);
            $result = $this->ai->json(self::SYSTEM_PROMPT, "Please evaluate this research proposal:\n\n{$text}", 512, 45);

            if (empty($result) || ! isset($result['overall_score'])) {
                throw new \RuntimeException(
                    "The {$provider} model returned a response that could not be parsed as the expected JSON scorecard."
                );
            }

            $aiScore->update([
                'clarity_score' => $result['clarity_score'] ?? null,
                'feasibility_score' => $result['feasibility_score'] ?? null,
                'budget_alignment_score' => $result['budget_alignment_score'] ?? null,
                'innovation_score' => $result['innovation_score'] ?? null,
                'completeness_score' => $result['completeness_score'] ?? null,
                'overall_score' => $result['overall_score'] ?? null,
                'strengths' => $result['strengths'] ?? null,
                'weaknesses' => $result['weaknesses'] ?? null,
                'recommendations' => $result['recommendations'] ?? null,
                'summary' => $result['summary'] ?? null,
                'model_used' => $this->ai->model(),
                'status' => 'completed',
                'error_message' => null,
                'scored_at' => now(),
            ]);
        } catch (ConnectionException $e) {
            // The single most common production cause: outbound HTTPS to the AI
            // provider's domain is blocked by a firewall/proxy on the server —
            // surfaced distinctly since "check server logs" won't reveal anything
            // more specific than this for a pure network failure.
            $message = 'Could not reach the AI provider — this server may be blocking outbound HTTPS requests to it. '.$e->getMessage();
            Log::error('AI proposal scoring failed: connection error', ['proposal_id' => $proposal->id, 'error' => $e->getMessage()]);
            $aiScore->update(['status' => 'failed', 'error_message' => $message]);
        } catch (\Throwable $e) {
            Log::error('AI proposal scoring failed', ['proposal_id' => $proposal->id, 'error' => $e->getMessage()]);
            $aiScore->update(['status' => 'failed', 'error_message' => $e->getMessage()]);
        }

        return $aiScore->fresh();
    }

    private function buildProposalText(Proposal $proposal): string
    {
        $proposal->load(['pi:id,name', 'college:id,name', 'department:id,name']);
        $draft = $proposal->draft_data ?? [];

        $parts = [
            "TITLE: {$proposal->title}",
            "CATEGORY: {$proposal->category}",
            'ABSTRACT: '.($proposal->abstract ?? 'Not provided'),
            'KEYWORDS: '.($proposal->keywords ?? 'Not provided'),
        ];

        if (! empty($draft['objectives'])) {
            $parts[] = 'OBJECTIVES: '.(is_array($draft['objectives']) ? implode('; ', $draft['objectives']) : $draft['objectives']);
        }
        if (! empty($draft['methodology'])) {
            $parts[] = "METHODOLOGY: {$draft['methodology']}";
        }
        if (! empty($draft['budget_justification'])) {
            $parts[] = "BUDGET JUSTIFICATION: {$draft['budget_justification']}";
        }
        if (! empty($draft['expected_outcomes'])) {
            $parts[] = "EXPECTED OUTCOMES: {$draft['expected_outcomes']}";
        }
        if ($proposal->duration_months) {
            $parts[] = "DURATION: {$proposal->duration_months} months";
        }

        return implode("\n\n", $parts);
    }
}
