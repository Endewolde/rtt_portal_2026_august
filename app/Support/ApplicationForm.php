<?php

namespace App\Support;

use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use Illuminate\Support\Str;

/**
 * A call's own application form: extra questions applicants answer and extra
 * documents they upload, on top of the standard proposal. Stored on the call as
 *   { questions: [{id, section, label, type, required, help, options, max_words}],
 *     documents: [{key, label, description, required, accept}] }
 * and answered on the proposal as { question id: answer }.
 */
class ApplicationForm
{
    public const TYPES = [
        'short_text' => 'Short answer',
        'long_text' => 'Paragraph',
        'number' => 'Number',
        'date' => 'Date',
        'yes_no' => 'Yes / No',
        'select' => 'One choice',
        'multi_select' => 'Several choices',
    ];

    /** Uploads for a call's own documents use this document_type prefix. */
    public const DOCUMENT_PREFIX = 'call_';

    public const ACCEPT = ['pdf' => '.pdf', 'office' => '.pdf,.doc,.docx,.xls,.xlsx', 'image' => '.pdf,.png,.jpg,.jpeg', 'any' => '*'];

    /** @return array<string, mixed> */
    public static function rules(): array
    {
        return [
            'questions' => ['present', 'array', 'max:60'],
            'questions.*.id' => ['nullable', 'string', 'max:40'],
            'questions.*.section' => ['nullable', 'string', 'max:120'],
            'questions.*.label' => ['required', 'string', 'max:500'],
            'questions.*.type' => ['required', 'string', 'in:'.implode(',', array_keys(self::TYPES))],
            'questions.*.required' => ['boolean'],
            'questions.*.help' => ['nullable', 'string', 'max:500'],
            'questions.*.options' => ['nullable', 'array', 'max:30'],
            'questions.*.options.*' => ['nullable', 'string', 'max:200'],
            'questions.*.max_words' => ['nullable', 'integer', 'min:1', 'max:5000'],
            'documents' => ['present', 'array', 'max:15'],
            'documents.*.key' => ['nullable', 'string', 'max:40'],
            'documents.*.label' => ['required', 'string', 'max:200'],
            'documents.*.description' => ['nullable', 'string', 'max:300'],
            'documents.*.required' => ['boolean'],
            'documents.*.accept' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::ACCEPT))],
        ];
    }

    /**
     * Tidy a validated form: stable ids for every question and document, options
     * only where a choice is asked, and null when nothing is asked at all.
     *
     * @param  array{questions?: array<int, array<string, mixed>>, documents?: array<int, array<string, mixed>>}  $form
     * @return array{questions: list<array<string, mixed>>, documents: list<array<string, mixed>>}|null
     */
    public static function clean(array $form): ?array
    {
        $questions = collect($form['questions'] ?? [])->map(function (array $q) {
            $choice = in_array($q['type'], ['select', 'multi_select'], true);
            $options = $choice ? collect($q['options'] ?? [])->map(fn ($o) => trim((string) $o))->filter()->unique()->values()->all() : [];

            return [
                'id' => self::id($q['id'] ?? null, 'q'),
                'section' => trim((string) ($q['section'] ?? '')) ?: null,
                'label' => trim($q['label']),
                'type' => $choice && ! $options ? 'short_text' : $q['type'],
                'required' => (bool) ($q['required'] ?? false),
                'help' => trim((string) ($q['help'] ?? '')) ?: null,
                'options' => $options,
                'max_words' => $q['type'] === 'long_text' && ! empty($q['max_words']) ? (int) $q['max_words'] : null,
            ];
        })->unique('id')->values()->all();

        $documents = collect($form['documents'] ?? [])->map(fn (array $d) => [
            'key' => self::id($d['key'] ?? null, 'd'),
            'label' => trim($d['label']),
            'description' => trim((string) ($d['description'] ?? '')) ?: null,
            'required' => (bool) ($d['required'] ?? false),
            'accept' => $d['accept'] ?? 'pdf',
        ])->unique('key')->values()->all();

        return $questions || $documents ? ['questions' => $questions, 'documents' => $documents] : null;
    }

    /**
     * Keep only answers to questions the call asks, in the shape each type expects.
     *
     * @param  array<string, mixed>|null  $form
     * @param  array<string, mixed>  $answers
     * @return array<string, mixed>
     */
    public static function cleanAnswers(?array $form, array $answers): array
    {
        $clean = [];
        foreach ($form['questions'] ?? [] as $q) {
            if (! array_key_exists($q['id'], $answers)) {
                continue;
            }
            $value = $answers[$q['id']];
            $clean[$q['id']] = match ($q['type']) {
                'multi_select' => array_values(array_intersect((array) $value, $q['options'])),
                'select' => in_array($value, $q['options'], true) ? $value : null,
                'yes_no' => $value === null || $value === '' ? null : filter_var($value, FILTER_VALIDATE_BOOLEAN),
                'number' => is_numeric($value) ? $value + 0 : null,
                default => is_scalar($value) ? Str::limit(trim((string) $value), 20000, '') : null,
            };
        }

        return $clean;
    }

    /**
     * What still stops this proposal being submitted under its call's form.
     *
     * @return list<string> human-readable labels of what is missing or too long
     */
    public static function problems(Proposal $proposal): array
    {
        $form = $proposal->proposalCall?->application_form;
        if (! $form) {
            return [];
        }

        $answers = $proposal->call_answers ?? [];
        $problems = [];
        foreach ($form['questions'] ?? [] as $q) {
            $value = $answers[$q['id']] ?? null;
            $blank = $value === null || $value === '' || $value === [];
            if (($q['required'] ?? false) && $blank) {
                $problems[] = $q['label'];
            } elseif (! $blank && ($q['max_words'] ?? null) && str_word_count((string) $value) > $q['max_words']) {
                $problems[] = "{$q['label']} (over {$q['max_words']} words)";
            }
        }

        $uploaded = ProposalDocument::where('proposal_id', $proposal->id)->where('is_current', true)->pluck('document_type')->all();
        foreach ($form['documents'] ?? [] as $d) {
            if (($d['required'] ?? false) && ! in_array(self::DOCUMENT_PREFIX.$d['key'], $uploaded, true)) {
                $problems[] = $d['label'];
            }
        }

        return $problems;
    }

    /** Whether this upload type belongs to the call's own documents. */
    public static function isCallDocument(?ProposalCall $call, string $documentType): bool
    {
        if (! $call || ! str_starts_with($documentType, self::DOCUMENT_PREFIX)) {
            return false;
        }
        $key = substr($documentType, strlen(self::DOCUMENT_PREFIX));

        return collect($call->application_form['documents'] ?? [])->contains('key', $key);
    }

    /**
     * The proposal's answers paired with their questions, for reading back.
     *
     * @return list<array{id: string, section: ?string, label: string, type: string, answer: mixed}>
     */
    public static function answered(Proposal $proposal): array
    {
        $call = $proposal->proposalCall;
        // Lists load only a few columns of the call; there is nothing to read back then.
        if (! $call || ! array_key_exists('application_form', $call->getAttributes())) {
            return [];
        }
        $answers = $proposal->call_answers ?? [];

        return collect($call->application_form['questions'] ?? [])
            ->map(fn (array $q) => ['id' => $q['id'], 'section' => $q['section'] ?? null, 'label' => $q['label'], 'type' => $q['type'], 'answer' => $answers[$q['id']] ?? null])
            ->values()->all();
    }

    private static function id(?string $given, string $prefix): string
    {
        $given = Str::of((string) $given)->lower()->replaceMatches('/[^a-z0-9_]/', '')->limit(40, '')->toString();

        return $given !== '' ? $given : $prefix.Str::lower(Str::random(8));
    }
}
