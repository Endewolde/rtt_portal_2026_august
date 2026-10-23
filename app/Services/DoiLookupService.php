<?php

namespace App\Services;

use App\Models\Award;
use App\Models\ConferencePresentation;
use App\Models\Proposal;
use App\Models\Publication;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Fills in a research output from its DOI using Crossref, and works out which funded
 * project it belongs to: the project whose grant reference the paper acknowledges, or
 * failing that the closest title among the projects the person can record outputs for.
 */
class DoiLookupService
{
    private const ENDPOINT = 'https://api.crossref.org/works/';

    private const CACHE_HOURS = 24;

    /** Crossref work types → output types on this platform. */
    private const TYPES = [
        'journal-article' => 'journal_article',
        'proceedings-article' => 'conference_paper',
        'book' => 'book',
        'monograph' => 'book',
        'edited-book' => 'book',
        'book-chapter' => 'book',
        'reference-book' => 'book',
        'posted-content' => 'journal_article',
    ];

    /** Minimum title-word overlap before a project is suggested on title alone. */
    private const MIN_TITLE_MATCH = 0.25;

    /** "https://doi.org/10.1/x", "doi:10.1/X" → "10.1/x"; null if it isn't a DOI. */
    public static function normalize(?string $doi): ?string
    {
        $doi = trim((string) $doi);
        $doi = preg_replace('~^(https?://)?(dx\.)?doi\.org/~i', '', $doi);
        $doi = preg_replace('~^doi:\s*~i', '', $doi);
        $doi = Str::lower(trim($doi));

        return preg_match('~^10\.\d{4,9}/\S+$~', $doi) ? $doi : null;
    }

    /**
     * @return array{found: bool, message?: string, doi?: string, fields?: array<string, mixed>, authors?: list<string>, url?: string|null}
     */
    public function lookup(string $doi): array
    {
        $doi = self::normalize($doi);
        if (! $doi) {
            return ['found' => false, 'message' => 'That doesn\'t look like a DOI. It starts with 10. — for example 10.1016/j.jenvman.2024.120345.'];
        }

        $work = Cache::remember('crossref:'.md5($doi), now()->addHours(self::CACHE_HOURS), function () use ($doi) {
            try {
                $response = Http::withHeaders(['User-Agent' => 'RTT Platform (mailto:'.config('mail.from.address').')'])
                    ->timeout(10)
                    ->retry(2, 300, throw: false)
                    ->get(self::ENDPOINT.rawurlencode($doi));
            } catch (\Throwable $e) {
                Log::warning("Crossref lookup failed for {$doi}: {$e->getMessage()}");

                return ['error' => 'unreachable'];
            }

            if ($response->status() === 404) {
                return ['error' => 'not_found'];
            }

            return $response->successful() ? ($response->json('message') ?? ['error' => 'unreachable']) : ['error' => 'unreachable'];
        });

        if (($work['error'] ?? null) === 'not_found') {
            Cache::forget('crossref:'.md5($doi));

            return ['found' => false, 'message' => 'No publication was found with this DOI. Check it, or enter the details by hand.'];
        }

        if (isset($work['error'])) {
            Cache::forget('crossref:'.md5($doi));

            return ['found' => false, 'message' => 'The DOI service could not be reached just now. Try again in a moment, or enter the details by hand.'];
        }

        $type = self::TYPES[$work['type'] ?? ''] ?? 'journal_article';
        $container = $work['container-title'][0] ?? null;

        return [
            'found' => true,
            'doi' => $doi,
            'url' => $work['URL'] ?? "https://doi.org/{$doi}",
            'authors' => collect($work['author'] ?? [])->map(fn ($a) => trim(($a['given'] ?? '').' '.($a['family'] ?? $a['name'] ?? '')))->filter()->values()->all(),
            'funding' => collect($work['funder'] ?? [])->flatMap(fn ($f) => $f['award'] ?? [])->filter()->values()->all(),
            'fields' => array_filter([
                'output_type' => $type,
                'title' => $this->clean($work['title'][0] ?? null),
                'description' => $this->clean($work['abstract'] ?? null),
                'doi' => $doi,
                'journal_name' => $type === 'journal_article' || $type === 'book' ? ($container ?? $work['publisher'] ?? null) : null,
                'publisher' => $work['publisher'] ?? null,
                'volume' => $work['volume'] ?? null,
                'issue' => $work['issue'] ?? null,
                'pages' => $work['page'] ?? null,
                'year' => $this->year($work),
                'conference_name' => $type === 'conference_paper' ? ($work['event']['name'] ?? $container) : null,
                'location' => $type === 'conference_paper' ? ($work['event']['location'] ?? null) : null,
                'proceedings_isbn' => $type === 'conference_paper' ? ($work['ISBN'][0] ?? null) : null,
            ], fn ($v) => $v !== null && $v !== ''),
        ];
    }

    /**
     * The project this publication most likely belongs to, among the given candidates.
     *
     * @param  Collection<int, Proposal>  $candidates
     * @param  list<string>  $grantNumbers  award numbers the paper acknowledges
     * @return array{proposal_id: string, reason: string}|null
     */
    public function suggestProject(Collection $candidates, ?string $title, array $grantNumbers = []): ?array
    {
        if ($candidates->isEmpty()) {
            return null;
        }

        // 1. The paper acknowledges one of our grant references.
        $normalizedGrants = collect($grantNumbers)->map(fn ($g) => Str::upper(preg_replace('/\s+/', '', $g)));
        if ($normalizedGrants->isNotEmpty()) {
            $award = Award::whereIn('proposal_id', $candidates->pluck('id'))->get(['proposal_id', 'grant_reference'])
                ->first(fn ($a) => $normalizedGrants->contains(Str::upper(preg_replace('/\s+/', '', $a->grant_reference))));
            if ($award) {
                return ['proposal_id' => $award->proposal_id, 'reason' => "The paper acknowledges grant {$award->grant_reference}."];
            }
        }

        // 2. Only one project to choose from.
        if ($candidates->count() === 1) {
            return ['proposal_id' => $candidates->first()->id, 'reason' => 'It is your only funded project.'];
        }

        // 3. The closest project title.
        $words = $this->words($title);
        if ($words->isEmpty()) {
            return null;
        }

        $best = $candidates
            ->map(fn (Proposal $p) => ['proposal' => $p, 'score' => $this->overlap($words, $this->words($p->title))])
            ->sortByDesc('score')
            ->first();

        return $best['score'] >= self::MIN_TITLE_MATCH
            ? ['proposal_id' => $best['proposal']->id, 'reason' => 'Its title is closest to this project\'s title — check it is right.']
            : null;
    }

    /** The output already recorded with this DOI, if any. */
    public function existingOutputId(string $doi): ?string
    {
        $doi = self::normalize($doi);
        if (! $doi) {
            return null;
        }

        return Publication::whereRaw('LOWER(doi) = ?', [$doi])->value('research_output_id')
            ?? ConferencePresentation::whereRaw('LOWER(doi) = ?', [$doi])->value('research_output_id');
    }

    private function clean(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        // Crossref abstracts are JATS XML: drop the tags and the leading "Abstract" heading.
        $text = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($text))));

        return preg_replace('/^Abstract\s*/i', '', $text) ?: null;
    }

    private function year(array $work): ?int
    {
        foreach (['published-print', 'published-online', 'issued', 'created'] as $key) {
            $year = $work[$key]['date-parts'][0][0] ?? null;
            if ($year) {
                return (int) $year;
            }
        }

        return null;
    }

    /** @return Collection<int, string> */
    private function words(?string $text): Collection
    {
        $stop = ['the', 'and', 'for', 'with', 'from', 'into', 'its', 'their', 'this', 'that', 'study', 'case', 'using', 'among', 'based', 'analysis', 'effect', 'effects', 'assessment', 'ethiopia'];

        return collect(preg_split('/[^\p{L}\p{N}]+/u', Str::lower((string) $text)))
            ->filter(fn ($w) => mb_strlen($w) > 2 && ! in_array($w, $stop, true))
            ->unique()
            ->values();
    }

    /** Share of the smaller word set that the two have in common. */
    private function overlap(Collection $a, Collection $b): float
    {
        $smaller = min($a->count(), $b->count());

        return $smaller > 0 ? $a->intersect($b)->count() / $smaller : 0.0;
    }
}
