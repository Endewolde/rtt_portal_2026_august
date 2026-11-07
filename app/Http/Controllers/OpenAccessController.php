<?php

namespace App\Http\Controllers;

use App\Http\Middleware\BlockSwitchedOffPublicPages;
use App\Models\Conference;
use App\Models\RepositoryRecord;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

/**
 * Makes the university's published research findable outside the platform: a page per
 * repository record that search engines can read, a sitemap, and an OAI-PMH endpoint —
 * the protocol harvesters such as BASE, CORE and OpenAIRE use to collect records.
 */
class OpenAccessController extends Controller
{
    private const PAGE_SIZE = 100;

    /** One record's own address, with its details in the page head for crawlers. */
    public function record(string $id): \Symfony\Component\HttpFoundation\Response
    {
        $record = RepositoryRecord::with('college:id,name')->where('status', 'published')->find($id);
        if (! $record) {
            return Inertia::render('Public/Repository')->toResponse(request())->setStatusCode(404);
        }

        $org = $this->orgName();
        $description = Str::limit(trim(preg_replace('/\s+/', ' ', strip_tags((string) $record->abstract))), 300);

        return Inertia::render('Public/Repository', ['recordId' => $record->id])
            ->withViewData(['pageMeta' => [
                'title' => $record->title,
                'description' => $description,
                'tags' => array_filter([
                    // Read by Google Scholar and reference managers.
                    'citation_title' => $record->title,
                    'citation_author' => $record->pi_name,
                    'citation_publication_date' => $this->year($record),
                    'citation_publisher' => $org,
                    'citation_technical_report_institution' => $org,
                    'citation_keywords' => $this->keywords($record)->join('; '),
                    // Dublin Core, read by library catalogues.
                    'DC.title' => $record->title,
                    'DC.creator' => $record->pi_name,
                    'DC.date' => $this->year($record),
                    'DC.publisher' => $org,
                    'DC.type' => 'Text',
                    'DC.description' => $description,
                ]),
                'jsonLd' => [
                    '@context' => 'https://schema.org',
                    '@type' => 'ResearchProject',
                    'name' => $record->title,
                    'description' => $description,
                    'url' => url("/repository/{$record->id}"),
                    'keywords' => $this->keywords($record)->join(', '),
                    'member' => $record->pi_name ? ['@type' => 'Person', 'name' => $record->pi_name] : null,
                    'parentOrganization' => ['@type' => 'CollegeOrUniversity', 'name' => $org],
                ],
            ]])
            ->toResponse(request());
    }

    public function sitemap(): Response
    {
        $closed = BlockSwitchedOffPublicPages::closedPaths();
        $open = fn (string $path) => ! collect($closed)->contains(fn ($c) => $path === $c || str_starts_with($path, rtrim($c, '/').'/'));

        $urls = collect(['/', '/proposal-calls/public', '/conferences', '/explore', '/funding-opportunities', '/repository', '/researchers'])
            ->filter($open)->map(fn ($p) => ['loc' => url($p), 'lastmod' => null]);

        if ($open('/repository')) {
            RepositoryRecord::where('status', 'published')->get(['id', 'updated_at'])
                ->each(fn ($r) => $urls->push(['loc' => url("/repository/{$r->id}"), 'lastmod' => $r->updated_at]));
        }
        if ($open('/conferences')) {
            Conference::where('status', 'published')->where(fn ($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()))
                ->get(['slug', 'updated_at'])
                ->each(fn ($c) => $urls->push(['loc' => url("/conferences/{$c->slug}"), 'lastmod' => $c->updated_at]));
        }
        if ($open('/researchers')) {
            DB::table('users')->where('public_profile', true)->whereNotNull('profile_slug')->where('status', 'active')->get(['profile_slug', 'updated_at'])
                ->each(fn ($u) => $urls->push(['loc' => url("/researchers/{$u->profile_slug}"), 'lastmod' => $u->updated_at ? Carbon::parse($u->updated_at) : null]));
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        foreach ($urls as $u) {
            $xml .= '  <url><loc>'.e($u['loc']).'</loc>'.($u['lastmod'] ? '<lastmod>'.$u['lastmod']->toDateString().'</lastmod>' : '')."</url>\n";
        }

        return response($xml.'</urlset>', 200, ['Content-Type' => 'application/xml; charset=utf-8']);
    }

    // ── OAI-PMH 2.0 ───────────────────────────────────────────────────────────

    /** The six OAI-PMH verbs, Dublin Core (oai_dc) only, 100 records a page. */
    public function oai(Request $request): Response
    {
        $args = $request->query();
        $verb = $args['verb'] ?? null;
        $base = url('/oai');

        $body = match ($verb) {
            'Identify' => $this->identify($base),
            'ListMetadataFormats' => $this->formats($args),
            'ListSets' => $this->error('noSetHierarchy', 'This repository does not use sets.'),
            'GetRecord' => $this->getRecord($args),
            'ListIdentifiers', 'ListRecords' => $this->listRecords($args, $verb === 'ListRecords'),
            default => $this->error('badVerb', $verb ? "Unknown verb {$verb}." : 'The verb argument is missing.'),
        };

        $echo = $verb && ! str_contains($body, '<error code="badVerb"')
            ? collect($args)->only(['verb', 'identifier', 'metadataPrefix', 'from', 'until', 'set', 'resumptionToken'])
                ->map(fn ($v, $k) => $k.'="'.e($v).'"')->join(' ')
            : '';

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
            .' xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">'
            .'<responseDate>'.now()->utc()->format('Y-m-d\TH:i:s\Z').'</responseDate>'
            ."<request {$echo}>".e($base).'</request>'
            .$body.'</OAI-PMH>';

        return response($xml, 200, ['Content-Type' => 'text/xml; charset=utf-8']);
    }

    private function identify(string $base): string
    {
        $earliest = RepositoryRecord::where('status', 'published')->min('updated_at');
        $admin = DB::table('app_settings')->where('key', 'contact_email')->value('value') ?: config('mail.from.address');

        return '<Identify><repositoryName>'.e($this->orgName().' Research Repository').'</repositoryName>'
            .'<baseURL>'.e($base).'</baseURL><protocolVersion>2.0</protocolVersion>'
            .'<adminEmail>'.e($admin).'</adminEmail>'
            .'<earliestDatestamp>'.($earliest ? Carbon::parse($earliest)->utc()->format('Y-m-d\TH:i:s\Z') : now()->utc()->format('Y-m-d\TH:i:s\Z')).'</earliestDatestamp>'
            .'<deletedRecord>no</deletedRecord><granularity>YYYY-MM-DDThh:mm:ssZ</granularity></Identify>';
    }

    /** @param  array<string, mixed>  $args */
    private function formats(array $args): string
    {
        if (isset($args['identifier']) && ! $this->findByIdentifier($args['identifier'])) {
            return $this->error('idDoesNotExist', 'No record has this identifier.');
        }

        return '<ListMetadataFormats><metadataFormat><metadataPrefix>oai_dc</metadataPrefix>'
            .'<schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>'
            .'<metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace></metadataFormat></ListMetadataFormats>';
    }

    /** @param  array<string, mixed>  $args */
    private function getRecord(array $args): string
    {
        if (empty($args['identifier']) || empty($args['metadataPrefix'])) {
            return $this->error('badArgument', 'GetRecord needs identifier and metadataPrefix.');
        }
        if ($args['metadataPrefix'] !== 'oai_dc') {
            return $this->error('cannotDisseminateFormat', 'Only oai_dc is offered.');
        }
        $record = $this->findByIdentifier($args['identifier']);

        return $record ? '<GetRecord>'.$this->recordXml($record, true).'</GetRecord>' : $this->error('idDoesNotExist', 'No record has this identifier.');
    }

    /** @param  array<string, mixed>  $args */
    private function listRecords(array $args, bool $full): string
    {
        $offset = 0;
        if (isset($args['resumptionToken'])) {
            // The token carries the original arguments: "offset|from|until".
            $parts = explode('|', (string) base64_decode($args['resumptionToken'], true));
            if (count($parts) !== 3 || ! ctype_digit($parts[0])) {
                return $this->error('badResumptionToken', 'The resumption token is not valid.');
            }
            [$offset, $args['from'], $args['until']] = [(int) $parts[0], $parts[1] ?: null, $parts[2] ?: null];
            $args['metadataPrefix'] = 'oai_dc';
        }
        if (($args['metadataPrefix'] ?? null) !== 'oai_dc') {
            return empty($args['metadataPrefix'])
                ? $this->error('badArgument', 'metadataPrefix is required.')
                : $this->error('cannotDisseminateFormat', 'Only oai_dc is offered.');
        }
        if (isset($args['set'])) {
            return $this->error('noSetHierarchy', 'This repository does not use sets.');
        }

        try {
            $from = ! empty($args['from']) ? Carbon::parse($args['from'])->utc() : null;
            $until = ! empty($args['until']) ? Carbon::parse($args['until'])->utc() : null;
        } catch (\Throwable) {
            return $this->error('badArgument', 'from and until must be dates.');
        }
        if ($until && strlen((string) $args['until']) === 10) {
            $until = $until->endOfDay();
        }

        $query = RepositoryRecord::with('college:id,name')->where('status', 'published')
            ->when($from, fn ($q) => $q->where('updated_at', '>=', $from))
            ->when($until, fn ($q) => $q->where('updated_at', '<=', $until))
            ->orderBy('updated_at')->orderBy('id');
        $total = (clone $query)->count();
        $records = $query->skip($offset)->take(self::PAGE_SIZE)->get();

        if ($records->isEmpty()) {
            return $this->error('noRecordsMatch', 'No records match.');
        }

        $tag = $full ? 'ListRecords' : 'ListIdentifiers';
        $xml = "<{$tag}>".$records->map(fn ($r) => $full ? $this->recordXml($r, true) : $this->headerXml($r))->join('');
        if ($offset + self::PAGE_SIZE < $total || $offset > 0) {
            $next = $offset + self::PAGE_SIZE < $total
                ? base64_encode(($offset + self::PAGE_SIZE).'|'.($args['from'] ?? '').'|'.($args['until'] ?? ''))
                : '';
            $xml .= '<resumptionToken completeListSize="'.$total.'" cursor="'.$offset.'">'.$next.'</resumptionToken>';
        }

        return $xml."</{$tag}>";
    }

    private function recordXml(RepositoryRecord $r, bool $withMetadata): string
    {
        $dc = collect([
            'title' => [$r->title],
            'creator' => [$r->pi_name],
            'subject' => $this->keywords($r)->all(),
            'description' => [trim(strip_tags((string) $r->abstract))],
            'publisher' => [$this->orgName().($r->college?->name ? ' — '.$r->college->name : '')],
            'date' => [$this->year($r)],
            'type' => ['Text', 'Research project'],
            'identifier' => [url("/repository/{$r->id}")],
            'language' => ['en'],
        ])->flatMap(fn ($values, $el) => collect($values)->filter()->map(fn ($v) => "<dc:{$el}>".e($v)."</dc:{$el}>"))->join('');

        return '<record>'.$this->headerXml($r).($withMetadata
            ? '<metadata><oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/"'
                .' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
                .' xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">'
                .$dc.'</oai_dc:dc></metadata>'
            : '').'</record>';
    }

    private function headerXml(RepositoryRecord $r): string
    {
        return '<header><identifier>'.e($this->identifier($r)).'</identifier>'
            .'<datestamp>'.$r->updated_at->utc()->format('Y-m-d\TH:i:s\Z').'</datestamp></header>';
    }

    private function identifier(RepositoryRecord $r): string
    {
        return 'oai:'.parse_url(config('app.url'), PHP_URL_HOST).':repository/'.$r->id;
    }

    private function findByIdentifier(string $identifier): ?RepositoryRecord
    {
        $id = Str::afterLast($identifier, 'repository/');

        return Str::isUuid($id) ? RepositoryRecord::with('college:id,name')->where('status', 'published')->find($id) : null;
    }

    private function error(string $code, string $message): string
    {
        return '<error code="'.$code.'">'.e($message).'</error>';
    }

    /** @return Collection<int, string> */
    private function keywords(RepositoryRecord $r)
    {
        return collect(preg_split('/[,;]+/', (string) $r->keywords))->map(fn ($k) => trim($k))->filter()->values();
    }

    private function year(RepositoryRecord $r): ?string
    {
        // "2025-2026" → the year the project finished.
        return preg_match('/(\d{4})\D*$/', (string) $r->academic_year, $m) ? $m[1] : $r->created_at?->format('Y');
    }

    private function orgName(): string
    {
        return DB::table('app_settings')->where('key', 'organization_name')->value('value') ?: config('app.name');
    }
}
