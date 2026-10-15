<?php

namespace App\Services;

use App\Models\AiInsight;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * For the central committee: every reviewer's and panel member's comments condensed into
 * strengths, concerns and disagreements, each traced to who raised it. Advisory only —
 * the committee still reads the reviews and makes the decision.
 */
class ReviewSummaryService
{
    private const SYSTEM_PROMPT = <<<'EOT'
You summarise expert reviews of a research proposal for a university funding committee.

Use ONLY what the reviewers wrote and scored. Do not add your own opinion of the proposal. Every point must name the reviewer labels it comes from (for example "Blind reviewer 1"), using exactly the labels given. Merge points several reviewers share. Note real disagreements between reviewers. Be concise and neutral.

Return ONLY valid JSON, no prose or code fences, in exactly this structure:
{
  "summary": "<2-3 sentence neutral overview of what the reviewers concluded>",
  "strengths": [ { "point": "<strength>", "sources": ["<label>"] } ],
  "concerns": [ { "point": "<concern or weakness>", "sources": ["<label>"] } ],
  "disagreements": [ { "topic": "<what they disagree on>", "detail": "<how views differ>", "sources": ["<label>"] } ]
}
EOT;

    public function __construct(private AiClient $ai, private ReviewScoreService $scores) {}

    /** @return array{insight: AiInsight|null, stale: bool, reviews: int} */
    public function latest(Proposal $proposal): array
    {
        $reviews = $this->reviews($proposal);
        $insight = AiInsight::where('proposal_id', $proposal->id)->where('type', AiInsight::TYPE_REVIEW_SUMMARY)->latest()->first();

        return [
            'insight' => $insight,
            'stale' => $insight !== null && $insight->fingerprint !== $this->fingerprint($reviews),
            'reviews' => $reviews->count(),
        ];
    }

    /** @throws \RuntimeException */
    public function run(Proposal $proposal, User $requestedBy): AiInsight
    {
        $reviews = $this->reviews($proposal);
        if ($reviews->isEmpty()) {
            throw new \RuntimeException('There are no submitted reviews to summarise yet.');
        }

        $labels = $reviews->pluck('label')->all();
        $result = $this->ai->json(self::SYSTEM_PROMPT, "PROPOSAL: {$proposal->title}\n\nREVIEWS:\n\n".$reviews->pluck('text')->implode("\n\n---\n\n")
            .(app()->getLocale() === 'am' ? "\n\nWrite all summary text in Amharic, but keep the reviewer labels exactly as given." : ''), 1800, 90);

        if (! isset($result['summary'])) {
            throw new \RuntimeException('The AI reply could not be read. Please try again.');
        }

        return AiInsight::create([
            'proposal_id' => $proposal->id,
            'type' => AiInsight::TYPE_REVIEW_SUMMARY,
            'requested_by' => $requestedBy->id,
            'result' => $this->normalise($result, $labels) + ['recommendations' => $this->tally($reviews)],
            'model' => $this->ai->model(),
            'fingerprint' => $this->fingerprint($reviews),
        ]);
    }

    /**
     * Submitted reviews, labelled by phase and order (no reviewer names are sent).
     *
     * @return Collection<int, array{label: string, recommendation: string|null, text: string, id: string, submitted_at: string|null}>
     */
    private function reviews(Proposal $proposal): Collection
    {
        $counters = ['blind' => 0, 'defence' => 0];

        return ReviewAssignment::with(['evaluationType:id,name', 'scores.evaluationQuestion:id,question_text,max_score'])
            ->where('proposal_id', $proposal->id)
            ->where('status', 'submitted')
            ->orderBy('submitted_at')
            ->get()
            ->filter(fn ($a) => Str::startsWith((string) $a->evaluationType?->name, ['blind_review', 'open_defence']))
            ->map(function (ReviewAssignment $a) use (&$counters) {
                $phase = Str::startsWith($a->evaluationType->name, 'blind_review') ? 'blind' : 'defence';
                $label = ($phase === 'blind' ? 'Blind reviewer ' : 'Defence panelist ').(++$counters[$phase]);
                $display = $this->scores->calculateWeightedDisplay($a);
                $recommendation = $a->scores->pluck('recommendation')->filter()->last();

                $lines = $a->scores->map(fn ($s) => '- '.Str::limit(trim((string) $s->evaluationQuestion?->question_text), 160)
                    .': '.(float) $s->score.'/'.(float) $s->evaluationQuestion?->max_score
                    .($s->comment ? ' — "'.Str::limit(trim($s->comment), 800).'"' : ''))->implode("\n");

                return [
                    'id' => $a->id,
                    'submitted_at' => $a->submitted_at?->toIso8601String(),
                    'label' => $label,
                    'recommendation' => $recommendation,
                    'text' => "{$label} — total ".round($display['score'], 2).'/'.round($display['max'], 2)
                        .($recommendation ? ", recommendation: {$recommendation}" : '')."\n{$lines}",
                ];
            })
            ->values();
    }

    private function fingerprint(Collection $reviews): string
    {
        return sha1($reviews->map(fn ($r) => $r['id'].'@'.$r['submitted_at'])->implode('|'));
    }

    /** @return array<string, int> recommendation => how many reviewers gave it (counted, not AI) */
    private function tally(Collection $reviews): array
    {
        return $reviews->pluck('recommendation')->filter()->countBy()->all();
    }

    /** Keep the expected shape, and only sources that are real reviewer labels. */
    private function normalise(array $r, array $labels): array
    {
        $points = function ($items, string $key) use ($labels) {
            return collect(is_array($items) ? $items : [])
                ->filter(fn ($i) => is_array($i) && ! empty($i[$key]))
                ->map(fn ($i) => array_filter([
                    $key => trim((string) $i[$key]),
                    'detail' => isset($i['detail']) ? trim((string) $i['detail']) : null,
                    'sources' => array_values(array_intersect($labels, (array) ($i['sources'] ?? []))),
                ], fn ($v) => $v !== null))
                // A point nobody actually made is dropped rather than shown unattributed.
                ->filter(fn ($i) => $i['sources'] !== [])
                ->values()
                ->all();
        };

        return [
            'summary' => trim((string) ($r['summary'] ?? '')),
            'strengths' => $points($r['strengths'] ?? [], 'point'),
            'concerns' => $points($r['concerns'] ?? [], 'point'),
            'disagreements' => $points($r['disagreements'] ?? [], 'topic'),
        ];
    }
}
