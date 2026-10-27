<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProposalCallResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Compute real-time expiry so the status is never stale between cron runs.
        // A call whose end_date has passed is treated as expired/closed immediately,
        // regardless of what the database still says.
        $pastDeadline = $this->end_date && $this->end_date->isPast();
        $effectiveStatus = $pastDeadline ? 'expired' : $this->status;
        $effectiveIsOpen = ! $pastDeadline && $this->is_open;

        return [
            'id' => $this->id,
            'academic_year' => $this->academic_year,
            'category' => $this->category,
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,
            'eligibility' => $this->eligibility,

            // ISO-8601 strings so JS can parse them with full datetime precision
            'start_date' => $this->start_date?->toIso8601String(),
            'end_date' => $this->end_date?->toIso8601String(),

            // Human-readable with time
            'start_date_formatted' => $this->start_date
                ? $this->start_date->format('d M Y, H:i')
                : null,
            'end_date_formatted' => $this->end_date
                ? $this->end_date->format('d M Y, H:i')
                : null,

            'status' => $effectiveStatus,
            'is_open' => $effectiveIsOpen,

            // Seconds remaining to deadline (exact, not end-of-day)
            'countdown_seconds' => $this->countdown_seconds,

            'proposals_count' => $this->proposals_count ?? 0,
            'max_proposals_per_pi' => $this->max_proposals_per_pi,
            'funding_budget' => $this->funding_budget !== null ? (float) $this->funding_budget : null,
            'application_form' => $this->application_form,
            'review_route' => $this->review_route,
            'guidelines_file' => $this->guidelines_file,
            'guidelines_filename' => $this->guidelines_file ? basename($this->guidelines_file) : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
