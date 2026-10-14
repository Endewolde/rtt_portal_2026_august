<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\ProposalDocument;
use App\Models\User;
use App\Support\DocumentText;
use Illuminate\Support\Collection;

/**
 * Blind review only works if reviewers can't tell who wrote the proposal. Before
 * validation, scan everything reviewers will see — the reviewer-visible documents and
 * the title/abstract/keywords — for the PI's and team members' names, emails and
 * phone numbers, and record what was found so the validator can act on it.
 *
 * It warns, never blocks: a name can legitimately appear (e.g. a cited co-author).
 */
class AnonymityCheckService
{
    public const STATUS_CLEAN = 'clean';

    public const STATUS_ISSUES = 'issues';

    /** No reviewer-visible document could be read (e.g. a scanned PDF) — check by hand. */
    public const STATUS_NOT_CHECKED = 'not_checked';

    private const MAX_FINDINGS = 25;

    private const SNIPPET_RADIUS = 60;

    /** Honorifics stripped from names before matching. */
    private const TITLES = ['dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'miss', 'ato', 'w/ro', 'w/rt', 'eng', 'engr', 'sr'];

    /**
     * Run the check and store the result on the proposal.
     *
     * @return array{status: string, findings: list<array<string, string>>, checked_documents: int, unreadable_documents: list<string>}
     */
    public function check(Proposal $proposal): array
    {
        $identifiers = $this->identifiers($proposal);
        $findings = [];
        $readable = 0;
        $unreadable = [];

        $sources = [['label' => 'Proposal form (title, abstract, keywords)', 'text' => $this->normalise(
            implode(' ', [$proposal->getRawOriginal('title'), $proposal->abstract, $proposal->keywords])
        )]];

        foreach ($this->reviewerDocuments($proposal) as $document) {
            $label = $this->documentLabel($document);
            if (! DocumentText::supports($document)) {
                $unreadable[] = $label;

                continue;
            }

            $text = DocumentText::for($document);
            if ($text === '') {
                $unreadable[] = $label;

                continue;
            }

            $readable++;
            $sources[] = ['label' => $label, 'text' => $text];
        }

        foreach ($sources as $source) {
            foreach ($identifiers as $identifier) {
                if (count($findings) >= self::MAX_FINDINGS) {
                    break 2;
                }

                $snippet = $this->find($source['text'], $identifier['pattern']);
                if ($snippet !== null) {
                    $findings[] = [
                        'source' => $source['label'],
                        'type' => $identifier['type'],
                        'person' => $identifier['person'],
                        'value' => $identifier['value'],
                        'snippet' => $snippet,
                    ];
                }
            }
        }

        $status = match (true) {
            $findings !== [] => self::STATUS_ISSUES,
            $readable === 0 => self::STATUS_NOT_CHECKED,
            default => self::STATUS_CLEAN,
        };

        $proposal->forceFill([
            'anonymity_status' => $status,
            'anonymity_findings' => ['findings' => $findings, 'unreadable_documents' => $unreadable, 'checked_documents' => $readable],
            'anonymity_checked_at' => now(),
        ])->saveQuietly();

        return ['status' => $status, 'findings' => $findings, 'checked_documents' => $readable, 'unreadable_documents' => $unreadable];
    }

    /** @return Collection<int, ProposalDocument> */
    private function reviewerDocuments(Proposal $proposal): Collection
    {
        return ProposalDocument::where('proposal_id', $proposal->id)
            ->whereIn('document_type', ProposalDocument::REVIEWER_VISIBLE_TYPES)
            ->where('is_current', true)
            ->get();
    }

    /**
     * Patterns that would identify the team: each person's full name and every
     * two-word run of it (Ethiopian names are given + father's + grandfather's name,
     * and documents often use just two of them), their email and phone number.
     * Single words are skipped — first names alone are far too common.
     *
     * @return list<array{type: string, person: string, value: string, pattern: string}>
     */
    private function identifiers(Proposal $proposal): array
    {
        $people = collect();
        if ($pi = User::find($proposal->pi_user_id)) {
            $people->push(['user' => $pi, 'role' => 'Principal Investigator']);
        }

        $proposal->activeMembers()->with('user')->get()
            ->filter(fn ($m) => $m->user && $m->user_id !== $proposal->pi_user_id)
            ->each(fn ($m) => $people->push(['user' => $m->user, 'role' => 'Co-investigator']));

        $identifiers = [];
        foreach ($people as ['user' => $user, 'role' => $role]) {
            $person = "{$role}: {$user->name}";

            foreach ($this->namePhrases((string) $user->name) as $phrase) {
                $identifiers[] = [
                    'type' => 'name',
                    'person' => $person,
                    'value' => $phrase,
                    'pattern' => '/(?<![\p{L}])'.str_replace(' ', '\s+', preg_quote($phrase, '/')).'(?![\p{L}])/u',
                ];
            }

            if ($user->email) {
                $email = mb_strtolower($user->email);
                $identifiers[] = ['type' => 'email', 'person' => $person, 'value' => $email, 'pattern' => '/'.preg_quote($email, '/').'/u'];
            }

            $digits = preg_replace('/\D/', '', (string) ($user->phone ?? ''));
            if (strlen($digits) >= 9) {
                // Last nine digits, allowing spaces/dashes between them (+251 9.. / 09..).
                $core = substr($digits, -9);
                $identifiers[] = [
                    'type' => 'phone',
                    'person' => $person,
                    'value' => $core,
                    'pattern' => '/'.implode('[\s\-.]?', str_split($core)).'/u',
                ];
            }
        }

        return $identifiers;
    }

    /** @return list<string> */
    private function namePhrases(string $name): array
    {
        $tokens = array_values(array_filter(
            preg_split('/\s+/u', $this->normalise($name)),
            fn ($t) => mb_strlen($t) >= 2 && ! in_array(rtrim($t, '.'), self::TITLES, true)
        ));

        if (count($tokens) < 2) {
            return [];
        }

        $phrases = [implode(' ', $tokens)];
        for ($i = 0; $i < count($tokens) - 1; $i++) {
            $phrases[] = $tokens[$i].' '.$tokens[$i + 1];
        }

        return array_values(array_unique($phrases));
    }

    private function find(string $text, string $pattern): ?string
    {
        if ($text === '' || ! preg_match($pattern, $text, $m, PREG_OFFSET_CAPTURE)) {
            return null;
        }

        [$match, $byteOffset] = $m[0];
        $offset = mb_strlen(substr($text, 0, $byteOffset));
        $start = max(0, $offset - self::SNIPPET_RADIUS);
        $length = mb_strlen($match) + self::SNIPPET_RADIUS * 2;

        return ($start > 0 ? '…' : '').trim(mb_substr($text, $start, $length)).($start + $length < mb_strlen($text) ? '…' : '');
    }

    private function normalise(string $text): string
    {
        return trim(mb_strtolower(preg_replace('/\s+/u', ' ', $text) ?? ''));
    }

    private function documentLabel(ProposalDocument $document): string
    {
        $type = $document->document_type === 'proposal_document' ? 'Proposal document' : 'Budget spreadsheet';

        return "{$type} ({$document->original_filename})";
    }
}
