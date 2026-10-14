<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\ProposalDocument;
use App\Models\ProposalMember;
use App\Models\ProposalVersion;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Keeps a copy of the proposal at every submission and works out what changed between
 * one submission and the next — so a validator re-checking a corrected proposal only
 * looks at what was fixed, and the PI has a record if there is ever a dispute.
 */
class ProposalVersionService
{
    /** The proposal fields compared between versions, with their labels. */
    private const FIELDS = [
        'title' => 'Title',
        'abstract' => 'Abstract',
        'keywords' => 'Keywords',
        'focus_area' => 'Focus area',
        'research_type' => 'Research type',
        'duration_months' => 'Duration (months)',
    ];

    public function capture(Proposal $proposal, ?User $submittedBy): ProposalVersion
    {
        $last = (int) ProposalVersion::where('proposal_id', $proposal->id)->max('version_number');

        return ProposalVersion::create([
            'proposal_id' => $proposal->id,
            'version_number' => $last + 1,
            'submitted_by' => $submittedBy?->id,
            'submitted_at' => now(),
            'snapshot' => $this->snapshot($proposal),
        ]);
    }

    /**
     * Every version, newest first, each with the changes since the one before it.
     *
     * @return list<array<string, mixed>>
     */
    public function history(Proposal $proposal): array
    {
        $versions = ProposalVersion::with('submitter:id,name')
            ->where('proposal_id', $proposal->id)
            ->orderBy('version_number')
            ->get();

        return $versions->map(fn (ProposalVersion $v, int $i) => [
            'id' => $v->id,
            'version_number' => $v->version_number,
            'submitted_at' => $v->submitted_at->toIso8601String(),
            'submitted_by' => $v->submitter?->name,
            'changes' => $i === 0 ? null : $this->compare($versions[$i - 1]->snapshot, $v->snapshot),
        ])->reverse()->values()->all();
    }

    /** @return array<string, mixed> */
    public function snapshot(Proposal $proposal): array
    {
        $proposal = $proposal->fresh();

        return [
            'fields' => collect(self::FIELDS)->keys()->mapWithKeys(fn ($f) => [$f => $proposal->{$f}])->all(),
            'team' => ProposalMember::with('user:id,name')
                ->where('proposal_id', $proposal->id)
                ->where('status', 'active')
                ->get()
                ->map(fn ($m) => ['user_id' => $m->user_id, 'name' => $m->user?->name, 'role' => $m->role])
                ->sortBy('name')->values()->all(),
            'budget' => ProposalBudget::where('proposal_id', $proposal->id)
                ->orderBy('category')->orderBy('item_description')
                ->get(['category', 'item_description', 'amount'])
                ->map(fn ($b) => ['category' => $b->category, 'item' => $b->item_description, 'amount' => (float) $b->amount])
                ->all(),
            'documents' => ProposalDocument::where('proposal_id', $proposal->id)
                ->where(fn ($q) => $q->where('is_current', true)->orWhereNull('is_current'))
                ->get(['id', 'document_type', 'original_filename', 'file_size'])
                ->map(fn ($d) => ['id' => $d->id, 'type' => $d->document_type, 'name' => $d->original_filename, 'size' => (int) $d->file_size])
                ->sortBy('type')->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return array{fields: list<array<string, mixed>>, team: array<string, list<string>>, budget: array<string, mixed>, documents: array<string, list<string>>, count: int}
     */
    public function compare(array $before, array $after): array
    {
        $fields = collect(self::FIELDS)
            ->filter(fn ($label, $key) => $this->normalise($before['fields'][$key] ?? null) !== $this->normalise($after['fields'][$key] ?? null))
            ->map(fn ($label, $key) => [
                'field' => $key,
                'label' => $label,
                'before' => $before['fields'][$key] ?? null,
                'after' => $after['fields'][$key] ?? null,
            ])->values()->all();

        $teamBefore = collect($before['team'] ?? [])->keyBy('user_id');
        $teamAfter = collect($after['team'] ?? [])->keyBy('user_id');
        $team = [
            'added' => $teamAfter->diffKeys($teamBefore)->pluck('name')->filter()->values()->all(),
            'removed' => $teamBefore->diffKeys($teamAfter)->pluck('name')->filter()->values()->all(),
        ];

        $budget = $this->compareBudget(collect($before['budget'] ?? []), collect($after['budget'] ?? []));

        $docsBefore = collect($before['documents'] ?? []);
        $docsAfter = collect($after['documents'] ?? []);
        $documents = [
            // A new file id is a new upload, even with the same name.
            'added' => $docsAfter->whereNotIn('id', $docsBefore->pluck('id'))->pluck('name')->values()->all(),
            'removed' => $docsBefore->whereNotIn('id', $docsAfter->pluck('id'))->pluck('name')->values()->all(),
        ];

        $count = count($fields) + count($team['added']) + count($team['removed'])
            + count($budget['added']) + count($budget['removed']) + count($budget['changed'])
            + count($documents['added']) + count($documents['removed']);

        return compact('fields', 'team', 'budget', 'documents', 'count');
    }

    /** @return array{added: list<array>, removed: list<array>, changed: list<array>, total_before: float, total_after: float} */
    private function compareBudget(Collection $before, Collection $after): array
    {
        $key = fn ($line) => mb_strtolower(trim($line['category'].'|'.$line['item']));
        $b = $before->keyBy($key);
        $a = $after->keyBy($key);

        return [
            'added' => $a->diffKeys($b)->values()->all(),
            'removed' => $b->diffKeys($a)->values()->all(),
            'changed' => $a->intersectByKeys($b)
                ->filter(fn ($line, $k) => abs($line['amount'] - $b[$k]['amount']) >= 0.01)
                ->map(fn ($line, $k) => $line + ['before' => $b[$k]['amount']])
                ->values()->all(),
            'total_before' => round($before->sum('amount'), 2),
            'total_after' => round($after->sum('amount'), 2),
        ];
    }

    private function normalise(mixed $value): string
    {
        return trim(preg_replace('/\s+/', ' ', (string) $value));
    }
}
