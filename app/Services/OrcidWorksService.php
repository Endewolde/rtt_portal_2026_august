<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * A researcher's publications, found by their ORCID iD in OpenAlex — the free, open
 * index of scholarly works (no key needed). Each comes back with its DOI so the
 * existing DOI lookup can record it as a project output.
 */
class OrcidWorksService
{
    private const ENDPOINT = 'https://api.openalex.org/works';

    public const ORCID = '/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/';

    /** OpenAlex work types → output types on this platform. */
    private const TYPES = [
        'article' => 'journal_article',
        'review' => 'journal_article',
        'letter' => 'journal_article',
        'preprint' => 'journal_article',
        'book' => 'book',
        'book-chapter' => 'book',
        'proceedings-article' => 'conference_paper',
    ];

    /**
     * @return array{ok: bool, message?: string, works: list<array{doi: ?string, title: string, year: ?int, venue: ?string, type: ?string, cited_by: int, grants: list<string>, url: ?string}>}
     */
    public function works(string $orcid): array
    {
        $orcid = strtoupper(trim(preg_replace('~^(https?://)?orcid\.org/~i', '', $orcid)));
        if (! preg_match(self::ORCID, $orcid) || ! self::checksumOk($orcid)) {
            return ['ok' => false, 'message' => 'That is not a valid ORCID iD — it looks like 0000-0002-1825-0097.', 'works' => []];
        }

        return Cache::remember("orcid_works_{$orcid}", now()->addHours(6), function () use ($orcid) {
            try {
                $response = Http::timeout(20)->acceptJson()
                    ->withUserAgent(config('app.name').' (mailto:'.config('mail.from.address').')')
                    ->get(self::ENDPOINT, [
                        'filter' => "author.orcid:{$orcid}",
                        'per-page' => 100,
                        'sort' => 'publication_year:desc',
                        'select' => 'id,doi,title,publication_year,primary_location,type,cited_by_count,grants',
                    ]);
            } catch (\Throwable $e) {
                Log::warning("[ORCID] OpenAlex unreachable: {$e->getMessage()}");

                return ['ok' => false, 'message' => 'The publication index could not be reached. Try again in a minute.', 'works' => []];
            }
            if (! $response->ok()) {
                return ['ok' => false, 'message' => 'The publication index could not be read just now. Try again later.', 'works' => []];
            }

            $works = collect($response->json('results', []))->map(fn (array $w) => [
                'doi' => DoiLookupService::normalize($w['doi'] ?? null),
                'title' => trim(strip_tags((string) ($w['title'] ?? ''))) ?: 'Untitled',
                'year' => $w['publication_year'] ?? null,
                'venue' => $w['primary_location']['source']['display_name'] ?? null,
                'type' => self::TYPES[$w['type'] ?? ''] ?? null,
                'cited_by' => (int) ($w['cited_by_count'] ?? 0),
                'grants' => collect($w['grants'] ?? [])->pluck('award_id')->filter()->values()->all(),
                'url' => $w['doi'] ?? ($w['id'] ?? null),
            ])->values()->all();

            return ['ok' => true, 'works' => $works];
        });
    }

    /** ISO 7064 11,2 check digit, as ORCID uses. */
    public static function checksumOk(string $orcid): bool
    {
        $digits = str_replace('-', '', $orcid);
        $total = 0;
        foreach (str_split(substr($digits, 0, 15)) as $d) {
            $total = ($total + (int) $d) * 2;
        }
        $check = (12 - $total % 11) % 11;

        return substr($digits, -1) === ($check === 10 ? 'X' : (string) $check);
    }
}
