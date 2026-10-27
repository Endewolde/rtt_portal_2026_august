<?php

namespace App\Services;

use App\Models\ExternalFundOpportunity;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Matches open funding opportunities to researchers by what they work on: the
 * expertise on their profile and the keywords and focus areas of their own
 * proposals. Used for "recommended for you" and for a one-time alert when an
 * opportunity opens.
 */
class OpportunityMatchService
{
    /** At least this score to recommend or alert: one whole-phrase hit, or two shared words. */
    private const MIN_SCORE = 2;

    private const MAX_ALERTS = 300;

    private const STOPWORDS = ['and', 'the', 'for', 'with', 'from', 'into', 'that', 'this', 'their', 'research', 'project', 'study', 'based', 'using', 'development', 'program', 'programme', 'grant', 'call', 'fund', 'funding'];

    public function __construct(private NotificationService $notifications) {}

    /**
     * Open opportunities ranked for one researcher, best first, with why they match.
     *
     * @return Collection<int, array{opportunity: ExternalFundOpportunity, score: int, reasons: list<string>}>
     */
    public function forUser(User $user, int $limit = 6): Collection
    {
        $interests = $this->interests($user);
        if ($interests->isEmpty()) {
            return collect();
        }

        return $this->openOpportunities()
            ->map(fn ($o) => ['opportunity' => $o] + $this->score($interests, $o))
            ->filter(fn ($m) => $m['score'] >= self::MIN_SCORE)
            ->sortByDesc('score')
            ->take($limit)
            ->values();
    }

    /**
     * Tell every matching researcher about an opportunity once, when it is open.
     * Returns how many were told.
     */
    public function alertFor(ExternalFundOpportunity $opportunity): int
    {
        if ($opportunity->status !== 'open' || $opportunity->match_alerts_sent_at
            || ($opportunity->deadline && $opportunity->deadline->isPast())) {
            return 0;
        }

        $told = 0;
        User::where('status', 'active')
            ->where(fn ($q) => $q->whereNotNull('expertise')->orWhereIn('id', Proposal::select('pi_user_id')))
            ->chunkById(200, function ($users) use ($opportunity, &$told) {
                foreach ($users as $user) {
                    if ($told >= self::MAX_ALERTS) {
                        return false;
                    }
                    $match = $this->score($this->interests($user), $opportunity);
                    if ($match['score'] < self::MIN_SCORE) {
                        continue;
                    }
                    try {
                        $this->notifications->send('opportunity_match', $user, [
                            'opportunity_id' => $opportunity->id,
                            'title' => $opportunity->title,
                            'deadline' => $opportunity->deadline?->toDateString(),
                            'message' => "A funding opportunity matches your work ({$this->reasonText($match['reasons'])}): “{$opportunity->title}”"
                                .($opportunity->deadline ? ' — deadline '.$opportunity->deadline->format('j M Y') : '').'.',
                        ]);
                        $told++;
                    } catch (\Throwable $e) {
                        Log::warning("Opportunity alert failed for {$user->id}: {$e->getMessage()}");
                    }
                }
            });

        $opportunity->forceFill(['match_alerts_sent_at' => now()])->save();

        return $told;
    }

    /** @return Collection<int, ExternalFundOpportunity> */
    private function openOpportunities(): Collection
    {
        return ExternalFundOpportunity::with('agency:id,name,acronym')
            ->where('status', 'open')
            ->where(fn ($q) => $q->whereNull('deadline')->orWhereDate('deadline', '>=', today()))
            ->get();
    }

    /**
     * What a researcher works on, as lower-case phrases: profile expertise, plus
     * keywords and focus areas of their proposals from the last three years.
     *
     * @return Collection<int, string>
     */
    private function interests(User $user): Collection
    {
        $proposals = Proposal::where('pi_user_id', $user->id)->where('created_at', '>=', now()->subYears(3))
            ->get(['keywords', 'focus_area']);

        return collect($user->expertise ?? [])
            ->merge($proposals->flatMap(fn ($p) => explode(',', (string) $p->keywords)))
            ->merge($proposals->pluck('focus_area'))
            ->map(fn ($phrase) => Str::of((string) $phrase)->lower()->squish()->toString())
            ->filter(fn ($phrase) => mb_strlen($phrase) >= 2)
            ->unique()
            ->values();
    }

    /**
     * Whole phrases found in the opportunity count 2 (short acronyms like "ai" only
     * as whole words); each further shared word counts 1.
     *
     * @param  Collection<int, string>  $interests
     * @return array{score: int, reasons: list<string>}
     */
    private function score(Collection $interests, ExternalFundOpportunity $o): array
    {
        $text = Str::of(implode(' ', [$o->title, implode(' ', (array) ($o->keywords ?? [])), $o->description, str_replace('_', ' ', (string) $o->category)]))
            ->lower()->squish()->toString();
        $textWords = collect(preg_split('/[^\p{L}\p{N}]+/u', $text, -1, PREG_SPLIT_NO_EMPTY))->flip();

        $score = 0;
        $reasons = [];
        foreach ($interests as $phrase) {
            if (preg_match('/(?<![\p{L}\p{N}])'.preg_quote($phrase, '/').'(?![\p{L}\p{N}])/u', $text)) {
                $score += 2;
                $reasons[] = $phrase;

                continue;
            }
            foreach (preg_split('/[^\p{L}\p{N}]+/u', $phrase, -1, PREG_SPLIT_NO_EMPTY) as $word) {
                if (mb_strlen($word) > 3 && ! in_array($word, self::STOPWORDS, true) && $textWords->has($word)) {
                    $score += 1;
                    $reasons[] = $word;
                }
            }
        }

        return ['score' => $score, 'reasons' => array_values(array_unique($reasons))];
    }

    /** @param  list<string>  $reasons */
    private function reasonText(array $reasons): string
    {
        return implode(', ', array_slice($reasons, 0, 3));
    }
}
