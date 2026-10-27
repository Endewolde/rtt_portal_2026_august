<?php

namespace App\Services;

use App\Models\AiInsight;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\ProposalDocument;
use App\Models\User;
use App\Support\DocumentText;
use App\Support\Terms;
use Illuminate\Support\Str;

/**
 * Private writing feedback for the research team before they submit, measured against
 * the call's real blind-review criteria. Only the team sees it; it is never shown to
 * reviewers and has no effect on scoring.
 */
class ProposalAiCoachService
{
    /** Requests per proposal per day — each one is a paid AI call. */
    public const DAILY_LIMIT = 5;

    private const DOCUMENT_CHARS = 18000;

    private const SYSTEM_PROMPT = <<<'EOT'
You are a supportive research-grant writing coach at a university. A research team will read your feedback privately before they submit. Reviewers will never see it, and it does not affect scoring.

Judge the proposal ONLY against the evaluation criteria provided. Be specific and practical: point to what is missing or unclear and say how to fix it. Do not invent facts about the proposal; if something cannot be judged from the text, say so. Do not give numeric scores. Keep each item to one or two sentences.

Return ONLY valid JSON, no prose or code fences, in exactly this structure:
{
  "readiness": "ready" | "almost" | "needs_work",
  "overall": "<2-3 sentence overall assessment>",
  "criteria": [ { "criterion": "<criterion text as given>", "assessment": "<how well it is met>", "suggestion": "<what to improve, or empty if nothing>" } ],
  "budget": "<whether the budget matches the planned activities, and what to fix>",
  "missing": ["<important missing item>"],
  "strengths": ["<a real strength>"]
}
EOT;

    public function __construct(private AiClient $ai) {}

    public function latest(Proposal $proposal): ?AiInsight
    {
        return AiInsight::where('proposal_id', $proposal->id)->where('type', AiInsight::TYPE_COACH)->latest()->first();
    }

    public function usedToday(Proposal $proposal): int
    {
        return AiInsight::where('proposal_id', $proposal->id)->where('type', AiInsight::TYPE_COACH)->where('created_at', '>=', today())->count();
    }

    /** @throws \RuntimeException */
    public function run(Proposal $proposal, User $requestedBy): AiInsight
    {
        if ($this->usedToday($proposal) >= self::DAILY_LIMIT) {
            throw new \RuntimeException('You have used the writing coach '.self::DAILY_LIMIT.' times today for this proposal. Please try again tomorrow.');
        }

        $criteria = $this->criteria($proposal);
        $prompt = "EVALUATION CRITERIA:\n".($criteria ?: 'No criteria are configured; judge general clarity, feasibility, budget fit and completeness.')
            ."\n\nPROPOSAL:\n".$this->context($proposal)
            .(app()->getLocale() === 'am' ? "\n\nWrite all feedback text in Amharic." : '');

        $result = $this->ai->json(self::SYSTEM_PROMPT, $prompt, 2000, 90);
        if (! isset($result['overall'])) {
            throw new \RuntimeException('The AI reply could not be read. Please try again.');
        }

        return AiInsight::create([
            'proposal_id' => $proposal->id,
            'type' => AiInsight::TYPE_COACH,
            'requested_by' => $requestedBy->id,
            'result' => $this->normalise($result),
            'model' => $this->ai->model(),
        ]);
    }

    /** The blind-review questions reviewers will use for this proposal's category. */
    public function criteria(Proposal $proposal): string
    {
        $type = EvaluationType::with('categories.questions')
            ->where('is_active', true)
            ->where('name', 'like', 'blind_review%')
            ->where(fn ($q) => $q->where('proposal_category', $proposal->category)->orWhereNull('proposal_category'))
            ->orderByRaw('proposal_category IS NULL')
            ->first();

        if (! $type) {
            return '';
        }

        return $type->categories->sortBy('order_index')->map(function ($category) {
            $questions = $category->questions->sortBy('order_index')
                ->map(fn ($q) => '  - '.Str::limit(trim($q->question_text), 400).' (max '.(float) $q->max_score.')')
                ->implode("\n");

            return "{$category->name} (weight {$category->weight}):\n{$questions}";
        })->implode("\n");
    }

    public function context(Proposal $proposal): string
    {
        $proposal->loadMissing('proposalCall:id,title,description,eligibility');
        $budget = ProposalBudget::where('proposal_id', $proposal->id)->get();
        $document = ProposalDocument::where('proposal_id', $proposal->id)
            ->where('document_type', 'proposal_document')
            ->where(fn ($q) => $q->where('is_current', true)->orWhereNull('is_current'))
            ->latest()
            ->first();

        $documentText = '';
        if ($document && DocumentText::supports($document)) {
            try {
                $documentText = Str::limit(trim(DocumentText::for($document)), self::DOCUMENT_CHARS, ' …[truncated]');
            } catch (\Throwable) {
                $documentText = '';
            }
        }

        return implode("\n\n", array_filter([
            "TITLE: {$proposal->title}",
            'CALL: '.($proposal->proposalCall?->title ?? '—'),
            $proposal->proposalCall?->eligibility ? 'CALL ELIGIBILITY: '.Str::limit(strip_tags($proposal->proposalCall->eligibility), 1500) : null,
            "CATEGORY: {$proposal->category}",
            'RESEARCH TYPE: '.($proposal->research_type ?: '—'),
            'FOCUS AREA: '.($proposal->focus_area ?: '—'),
            'DURATION: '.($proposal->duration_months ? "{$proposal->duration_months} months" : '—'),
            'KEYWORDS: '.($proposal->keywords ?: '—'),
            'ABSTRACT: '.($proposal->abstract ?: 'Not provided'),
            'BUDGET ('.Terms::currency().', total '.number_format((float) $budget->sum('amount'), 2)."):\n".($budget->isEmpty() ? 'No budget lines yet.' : $budget->map(
                fn ($b) => "- {$b->category}: {$b->item_description} — ".number_format((float) $b->amount, 2).($b->justification ? " (justification: {$b->justification})" : '')
            )->implode("\n")),
            $documentText ? "FULL PROPOSAL DOCUMENT:\n{$documentText}" : 'FULL PROPOSAL DOCUMENT: not uploaded yet.',
        ]));
    }

    /** Keep only the expected shape, whatever the model returned. */
    private function normalise(array $r): array
    {
        $strings = fn ($v) => collect(is_array($v) ? $v : [])->filter(fn ($x) => is_string($x) && trim($x) !== '')->map(fn ($x) => trim($x))->values()->all();

        return [
            'readiness' => in_array($r['readiness'] ?? null, ['ready', 'almost', 'needs_work'], true) ? $r['readiness'] : 'almost',
            'overall' => trim((string) ($r['overall'] ?? '')),
            'criteria' => collect(is_array($r['criteria'] ?? null) ? $r['criteria'] : [])
                ->filter(fn ($c) => is_array($c) && ! empty($c['criterion']))
                ->map(fn ($c) => [
                    'criterion' => trim((string) $c['criterion']),
                    'assessment' => trim((string) ($c['assessment'] ?? '')),
                    'suggestion' => trim((string) ($c['suggestion'] ?? '')),
                ])->values()->all(),
            'budget' => trim((string) ($r['budget'] ?? '')),
            'missing' => $strings($r['missing'] ?? []),
            'strengths' => $strings($r['strengths'] ?? []),
        ];
    }
}
