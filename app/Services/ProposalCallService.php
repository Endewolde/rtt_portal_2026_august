<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProposalCallService
{
    /**
     * Create a new proposal call.
     */
    public function create(array $data, User $createdBy): ProposalCall
    {
        $data['created_by'] = $createdBy->id;
        $data['slug'] = Str::slug($data['title']).'-'.time();
        $data['status'] = 'draft';
        $data['is_open'] = false;

        return ProposalCall::create($data);
    }

    /**
     * Start a new draft call from an existing one: the same content and settings,
     * moved to a new academic year. By default the dates move forward by the same
     * number of years and any year written in the title follows; the guidelines PDF
     * is copied so the new call can change it without touching the old one.
     *
     * @param  array{academic_year?: string, title?: string, start_date?: string, end_date?: string}  $overrides
     */
    public function copy(ProposalCall $source, array $overrides, User $createdBy): ProposalCall
    {
        $fromYear = (int) substr((string) $source->academic_year, 0, 4);
        $academicYear = $overrides['academic_year'] ?? ($fromYear ? ($fromYear + 1).'-'.($fromYear + 2) : $source->academic_year);
        $shift = max(0, (int) substr($academicYear, 0, 4) - $fromYear);

        $title = $overrides['title'] ?? $this->shiftYearsInText((string) $source->title, (string) $source->academic_year, $academicYear, $shift);

        $call = $this->create([
            'academic_year' => $academicYear,
            'category' => $source->category,
            'title' => $title,
            'description' => $source->description,
            'eligibility' => $source->eligibility,
            'start_date' => isset($overrides['start_date']) ? Carbon::parse($overrides['start_date']) : $source->start_date?->copy()->addYears($shift),
            'end_date' => isset($overrides['end_date']) ? Carbon::parse($overrides['end_date']) : $source->end_date?->copy()->addYears($shift),
            'max_proposals_per_pi' => $source->max_proposals_per_pi,
            'funding_budget' => $source->funding_budget,
            'application_form' => $source->application_form,
            'review_route' => $source->review_route,
        ], $createdBy);

        if ($source->guidelines_file && Storage::disk('private')->exists($source->guidelines_file)) {
            $path = "proposal-calls/{$call->id}/guidelines/".basename($source->guidelines_file);
            Storage::disk('private')->copy($source->guidelines_file, $path);
            $call->update(['guidelines_file' => $path]);
        }

        return $call->fresh();
    }

    /** "Research Call 2026-2027" → "Research Call 2027-2028"; a lone "2026" moves too. */
    private function shiftYearsInText(string $text, string $fromYear, string $toYear, int $shift): string
    {
        if ($fromYear && str_contains($text, $fromYear)) {
            return str_replace($fromYear, $toYear, $text);
        }

        return $shift > 0
            ? preg_replace_callback('/\b(20\d{2})\b/', fn ($m) => (string) ((int) $m[1] + $shift), $text)
            : $text;
    }

    /**
     * Update a proposal call.
     *
     * @throws \Exception if call is active and has submissions with category change
     */
    public function update(ProposalCall $call, array $data, User $_updatedBy): ProposalCall
    {
        if ($call->status === 'active') {
            $hasSubmissions = Proposal::where('proposal_call_id', $call->id)
                ->where('status', '!=', 'draft')
                ->exists();

            if ($hasSubmissions && isset($data['category']) && $data['category'] !== $call->category) {
                throw new \Exception('Cannot change category of an active call that has submissions.');
            }
        }

        $call->update($data);

        return $call->fresh();
    }

    /**
     * Activate a proposal call.
     *
     * @throws \Exception if end_date is in the past
     */
    public function activate(ProposalCall $call): ProposalCall
    {
        if ($call->end_date->isPast()) {
            throw new \Exception('Cannot activate a call whose end date is in the past.');
        }

        $call->update(['status' => 'active', 'is_open' => true]);

        return $call->fresh();
    }

    /**
     * Close a proposal call.
     */
    public function close(ProposalCall $call): ProposalCall
    {
        $call->update(['status' => 'closed', 'is_open' => false]);

        return $call->fresh();
    }

    /**
     * Reopen a closed proposal call.
     *
     * @throws \Exception if call is expired, already active, or deadline has passed
     */
    public function reopen(ProposalCall $call): ProposalCall
    {
        // Always refresh so we see the deadline just saved by the caller.
        $call = $call->fresh();

        // Block only when the call is genuinely active (status=active AND deadline in the future).
        // A call whose DB status is still 'active' but whose deadline has passed is effectively
        // expired (ProposalCallResource returns 'expired' for it), so it should be reopenable.
        if ($call->status === 'active' && ! $call->end_date->isPast()) {
            throw new \Exception('This call is already active.');
        }

        // Block reopen if the (freshly saved) deadline is still in the past.
        if ($call->end_date->isPast()) {
            throw new \Exception(
                'Cannot reopen: the deadline '.$call->end_date->format('d M Y H:i').
                ' has already passed. Please update the deadline to a future date first.'
            );
        }

        $call->update(['status' => 'active', 'is_open' => true]);

        return $call->fresh();
    }

    /**
     * List active proposal calls with optional filters.
     */
    public function listActive(array $filters = []): LengthAwarePaginator
    {
        $query = ProposalCall::where('status', 'active')
            ->where('is_open', true);

        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (! empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }

        return $query->orderBy('end_date', 'asc')
            ->paginate($filters['per_page'] ?? 15);
    }
}
