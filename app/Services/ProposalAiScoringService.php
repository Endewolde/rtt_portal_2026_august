<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\ProposalAiScore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
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

    private const PROVIDERS = [
        'anthropic' => [
            'model' => 'claude-haiku-4-5-20251001',
            'key_cfg' => 'services.anthropic.api_key',
        ],
        'gemini' => [
            'model' => 'gemini-2.0-flash',
            'key_cfg' => 'services.gemini.api_key',
        ],
        'groq' => [
            // llama-4-scout-17b-16e-instruct was retired from Groq's production
            // catalog (calls now 404 with model_not_found) — gpt-oss-120b is Groq's
            // current general-purpose production model.
            'model' => 'openai/gpt-oss-120b',
            'key_cfg' => 'services.groq.api_key',
        ],
    ];

    public function score(Proposal $proposal): ProposalAiScore
    {
        $aiScore = ProposalAiScore::firstOrCreate(
            ['proposal_id' => $proposal->id],
            ['status' => 'pending']
        );

        $aiScore->update(['status' => 'pending']);

        try {
            $provider = $this->resolveProvider();
            $text = $this->buildProposalText($proposal);
            $result = $this->dispatch($provider, $text);

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
                'model_used' => self::PROVIDERS[$provider]['model'],
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

    /** Returns 'anthropic' | 'gemini' | 'groq', picking the first that has a key configured. */
    private function resolveProvider(): string
    {
        $requested = config('services.ai_scoring.provider', '');

        if ($requested && array_key_exists($requested, self::PROVIDERS)) {
            $key = config(self::PROVIDERS[$requested]['key_cfg'], '');
            if ($key) {
                return $requested;
            }
        }

        // Auto-detect: use whichever key is set
        foreach (self::PROVIDERS as $name => $cfg) {
            if (config($cfg['key_cfg'], '')) {
                return $name;
            }
        }

        throw new \RuntimeException(
            'No AI scoring provider configured. Set AI_SCORING_PROVIDER and one of: '.
            'ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY in your .env.'
        );
    }

    private function dispatch(string $provider, string $proposalText): array
    {
        return match ($provider) {
            'anthropic' => $this->callAnthropic($proposalText),
            'gemini' => $this->callGemini($proposalText),
            'groq' => $this->callGroq($proposalText),
            default => throw new \RuntimeException("Unknown AI provider: {$provider}"),
        };
    }

    // ── Providers ──────────────────────────────────────────────────────────────

    private function callAnthropic(string $proposalText): array
    {
        $apiKey = config('services.anthropic.api_key');

        $response = Http::timeout(45)->connectTimeout(10)->withHeaders([
            'x-api-key' => $apiKey,
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ])->post('https://api.anthropic.com/v1/messages', [
            'model' => self::PROVIDERS['anthropic']['model'],
            'max_tokens' => 512,
            'system' => self::SYSTEM_PROMPT,
            'messages' => [
                ['role' => 'user', 'content' => "Please evaluate this research proposal:\n\n{$proposalText}"],
            ],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Anthropic API error: '.$response->status().' '.$response->body());
        }

        return $this->parseJson($response->json('content.0.text', ''));
    }

    private function callGemini(string $proposalText): array
    {
        $apiKey = config('services.gemini.api_key');
        $model = self::PROVIDERS['gemini']['model'];

        $response = Http::timeout(45)->connectTimeout(10)->withHeaders(['content-type' => 'application/json'])
            ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
                'system_instruction' => [
                    'parts' => [['text' => self::SYSTEM_PROMPT]],
                ],
                'contents' => [
                    ['role' => 'user', 'parts' => [['text' => "Please evaluate this research proposal:\n\n{$proposalText}"]]],
                ],
                'generationConfig' => [
                    'response_mime_type' => 'application/json',
                    'max_output_tokens' => 512,
                    'temperature' => 0.2,
                ],
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Gemini API error: '.$response->status().' '.$response->body());
        }

        $text = $response->json('candidates.0.content.parts.0.text', '');

        return $this->parseJson($text);
    }

    private function callGroq(string $proposalText): array
    {
        $apiKey = config('services.groq.api_key');

        $response = Http::timeout(45)->connectTimeout(10)->withHeaders([
            'Authorization' => "Bearer {$apiKey}",
            'content-type' => 'application/json',
        ])->post('https://api.groq.com/openai/v1/chat/completions', [
            'model' => self::PROVIDERS['groq']['model'],
            'max_tokens' => 512,
            'temperature' => 0.2,
            'messages' => [
                ['role' => 'system', 'content' => self::SYSTEM_PROMPT],
                ['role' => 'user',   'content' => "Please evaluate this research proposal:\n\n{$proposalText}"],
            ],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Groq API error: '.$response->status().' '.$response->body());
        }

        $text = $response->json('choices.0.message.content', '');

        return $this->parseJson($text);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function parseJson(string $raw): array
    {
        // Strip accidental markdown code fences if the model adds them
        $clean = preg_replace('/^```(?:json)?\s*/i', '', trim($raw));
        $clean = preg_replace('/\s*```$/', '', $clean);

        return json_decode($clean, true) ?? [];
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
