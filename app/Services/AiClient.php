<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * One way to ask the configured AI provider (Anthropic, Gemini or Groq — whichever has a
 * key, or AI_SCORING_PROVIDER) for a JSON answer. Network failures surface as
 * Illuminate\Http\Client\ConnectionException; everything else as \RuntimeException.
 */
class AiClient
{
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

    public function available(): bool
    {
        try {
            $this->provider();

            return true;
        } catch (\RuntimeException) {
            return false;
        }
    }

    /** 'anthropic' | 'gemini' | 'groq': the requested provider if it has a key, else the first with one. */
    public function provider(): string
    {
        $requested = config('services.ai_scoring.provider', '');

        if ($requested && array_key_exists($requested, self::PROVIDERS) && config(self::PROVIDERS[$requested]['key_cfg'], '')) {
            return $requested;
        }

        foreach (self::PROVIDERS as $name => $cfg) {
            if (config($cfg['key_cfg'], '')) {
                return $name;
            }
        }

        throw new \RuntimeException(
            'No AI provider configured. Set AI_SCORING_PROVIDER and one of: ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY in your .env.'
        );
    }

    public function model(): string
    {
        return self::PROVIDERS[$this->provider()]['model'];
    }

    /**
     * @return array<string, mixed> the decoded JSON object ([] if the reply wasn't valid JSON)
     *
     * @throws \RuntimeException
     */
    public function json(string $system, string $user, int $maxTokens = 1024, int $timeout = 60): array
    {
        $provider = $this->provider();
        $model = self::PROVIDERS[$provider]['model'];
        $key = config(self::PROVIDERS[$provider]['key_cfg']);

        $raw = match ($provider) {
            'anthropic' => $this->anthropic($key, $model, $system, $user, $maxTokens, $timeout),
            'gemini' => $this->gemini($key, $model, $system, $user, $maxTokens, $timeout),
            'groq' => $this->groq($key, $model, $system, $user, $maxTokens, $timeout),
        };

        // Strip accidental markdown code fences if the model adds them.
        $clean = preg_replace('/^```(?:json)?\s*/i', '', trim($raw));
        $clean = preg_replace('/\s*```$/', '', (string) $clean);

        return json_decode((string) $clean, true) ?? [];
    }

    private function anthropic(string $key, string $model, string $system, string $user, int $maxTokens, int $timeout): string
    {
        $response = Http::timeout($timeout)->connectTimeout(10)->withHeaders([
            'x-api-key' => $key,
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ])->post('https://api.anthropic.com/v1/messages', [
            'model' => $model,
            'max_tokens' => $maxTokens,
            'system' => $system,
            'messages' => [['role' => 'user', 'content' => $user]],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Anthropic API error: '.$response->status().' '.$response->body());
        }

        return (string) $response->json('content.0.text', '');
    }

    private function gemini(string $key, string $model, string $system, string $user, int $maxTokens, int $timeout): string
    {
        $response = Http::timeout($timeout)->connectTimeout(10)->withHeaders(['content-type' => 'application/json'])
            ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}", [
                'system_instruction' => ['parts' => [['text' => $system]]],
                'contents' => [['role' => 'user', 'parts' => [['text' => $user]]]],
                'generationConfig' => [
                    'response_mime_type' => 'application/json',
                    'max_output_tokens' => $maxTokens,
                    'temperature' => 0.2,
                ],
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Gemini API error: '.$response->status().' '.$response->body());
        }

        return (string) $response->json('candidates.0.content.parts.0.text', '');
    }

    private function groq(string $key, string $model, string $system, string $user, int $maxTokens, int $timeout): string
    {
        $response = Http::timeout($timeout)->connectTimeout(10)->withHeaders([
            'Authorization' => "Bearer {$key}",
            'content-type' => 'application/json',
        ])->post('https://api.groq.com/openai/v1/chat/completions', [
            'model' => $model,
            // gpt-oss "thinks" before answering and that counts toward max_tokens — keep the
            // thinking short and leave it room, or long prompts end before any JSON is written.
            'max_tokens' => $maxTokens + 1500,
            'reasoning_effort' => 'low',
            'response_format' => ['type' => 'json_object'],
            'temperature' => 0.2,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user],
            ],
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Groq API error: '.$response->status().' '.$response->body());
        }

        return (string) $response->json('choices.0.message.content', '');
    }
}
