<?php

namespace App\Support;

/**
 * Standard display form for proposal titles (APA-style Title Case):
 *  - major words capitalised, short minor words (of, and, in, the, for…) lower-case
 *    unless they start the title or follow a colon, dash or question mark;
 *  - acronyms kept: words typed in capitals inside a normal title (HIV, ICT), words
 *    with inner capitals (mRNA, eLearning), and a list of known acronyms that are
 *    restored even when the whole title was typed in CAPITALS;
 *  - hyphenated words capitalised on both sides (Socio-Economic).
 *
 * Idempotent: formatting an already formatted title returns it unchanged.
 */
class TitleCase
{
    /** APA: conjunctions, articles and prepositions of three letters or fewer. */
    private const MINOR_WORDS = [
        'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by',
        'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs', 'vs.',
    ];

    /** Acronyms common in WSU proposals, restored even from ALL-CAPS titles. */
    private const KNOWN_ACRONYMS = [
        'HIV', 'AIDS', 'ICT', 'ICTS', 'COVID', 'TB', 'GIS', 'NGO', 'NGOS', 'SNNPR', 'SDG', 'SDGS', 'GDP',
        'PHC', 'MCH', 'ANC', 'PNC', 'DNA', 'RNA', 'ICU', 'PCR', 'IPM', 'TVET', 'HEI', 'HEIS', 'EFL', 'ESL',
        'ELT', 'MSE', 'MSES', 'SME', 'SMES', 'WSU', 'ARV', 'NCD', 'NCDS', 'PMTCT', 'OVC', 'UNICEF', 'USAID',
        'FAO', 'WFP', 'CBHI', 'HEW', 'HEWS', 'EPI', 'IMNCI', 'MDR', 'STI', 'STIS', 'IUD', 'BMI',
        'UAV', 'AI', 'ML', 'ERP', 'GPS', 'SMS', 'USSD', 'ETB', 'GTP', 'MOH', 'MOE', 'NBE',
    ];

    public static function format(?string $title): ?string
    {
        if ($title === null) {
            return null;
        }

        $title = trim(preg_replace('/\s+/u', ' ', $title));
        if ($title === '') {
            return $title;
        }

        $shouting = self::isMostlyUppercase($title);
        $words = explode(' ', $title);
        $last = count($words) - 1;
        $startsClause = true;

        foreach ($words as $i => $word) {
            $words[$i] = self::formatWord($word, $startsClause || $i === $last, $shouting);
            // The next word starts a new clause after a colon, dash or question mark.
            $startsClause = (bool) preg_match('/[:?!—–]$|^[—–-]$/u', $word);
        }

        return implode(' ', $words);
    }

    private static function formatWord(string $word, bool $forceCapital, bool $shouting): string
    {
        // Compounds: format each part, all capitalised (Socio-Economic, HIV/AIDS).
        foreach (['-', '/'] as $separator) {
            if (preg_match('/[\p{L}\p{N}]'.preg_quote($separator, '/').'[\p{L}\p{N}]/u', $word)) {
                return implode($separator, array_map(
                    fn ($part) => self::formatWord($part, true, $shouting),
                    explode($separator, $word)
                ));
            }
        }

        // Split leading/trailing punctuation from the core: "(case" / "farmers'," / "“quality”".
        if (! preg_match('/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u', $word, $m) || $m[2] === '') {
            return $word;
        }
        [, $lead, $core, $trail] = $m;

        if (self::isAcronym($core, $shouting)) {
            return $lead.self::acronymForm($core).$trail;
        }

        $lower = mb_strtolower($core);
        $minorKey = $lower === 'vs' && str_starts_with($trail, '.') ? 'vs.' : $lower;

        if (! $forceCapital && in_array($minorKey, self::MINOR_WORDS, true)) {
            return $lead.$lower.$trail;
        }

        return $lead.mb_strtoupper(mb_substr($lower, 0, 1)).mb_substr($lower, 1).$trail;
    }

    private static function isAcronym(string $core, bool $shouting): bool
    {
        if (self::knownAcronym($core) !== null) {
            return true;
        }

        // In an ALL-CAPS title, capitals carry no meaning — only known acronyms survive.
        if ($shouting) {
            return false;
        }

        $letters = preg_replace('/[^\p{L}]/u', '', $core);
        $length = mb_strlen($letters);

        // Short word typed in capitals inside a normally-cased title (HIV, ICT, COVID19).
        if ($length >= 2 && $length <= 6 && $letters === mb_strtoupper($letters)) {
            return true;
        }

        // Deliberate inner capitals: a short lower-case prefix, then either capitals
        // (mRNA) or one capital and lower-case (eLearning, iPhone). Random casing like
        // "aSSessment" is not deliberate.
        return mb_strlen($core) >= 4 && (bool) preg_match('/^\p{Ll}{1,2}(\p{Lu}+|\p{Lu}\p{Ll}+)$/u', $core);
    }

    /** Canonical form of a known acronym (ICT, ICTs, NGOs), or null. */
    private static function knownAcronym(string $core): ?string
    {
        if (! preg_match('/^[A-Za-z0-9]+$/', $core)) {
            return null;
        }

        $upper = strtoupper($core);
        if (in_array($upper, self::KNOWN_ACRONYMS, true)) {
            $base = substr($upper, 0, -1);

            return str_ends_with($upper, 'S') && in_array($base, self::KNOWN_ACRONYMS, true) ? $base.'s' : $upper;
        }

        return null;
    }

    /** Known acronyms in canonical form; anything else exactly as typed. */
    private static function acronymForm(string $core): string
    {
        return self::knownAcronym($core) ?? $core;
    }

    private static function isMostlyUppercase(string $title): bool
    {
        $letters = preg_replace('/[^\p{L}]/u', '', $title);
        if (mb_strlen($letters) < 4) {
            return false;
        }

        $upper = preg_replace('/[^\p{Lu}]/u', '', $title);

        return mb_strlen($upper) / mb_strlen($letters) > 0.7;
    }
}
