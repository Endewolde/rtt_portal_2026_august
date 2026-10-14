<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Structured reasons for every reject action. The UI sends a `reason_code` from the
 * matching catalog plus optional details (required for "other"); this turns them into
 * the single reason text each endpoint already stores and shows ("Label — details"),
 * so nothing downstream changes. Requests without a reason_code keep the old
 * free-text behaviour.
 *
 * Keep in sync with resources/js/lib/rejectionReasons.js.
 */
class RejectionReasons
{
    public const OTHER = 'other';

    private const MAX_DETAILS = 900;

    /** @var array<string, array<string, string>> */
    public const CATALOG = [
        'proposal_validation' => [
            'incomplete_submission' => 'Incomplete submission',
            'not_anonymous' => 'Not anonymous — author identity revealed',
            'outside_call_scope' => "Outside the call's scope or category",
            'ineligible_team' => 'PI or team not eligible',
            'duplicate_or_funded' => 'Duplicate or already funded proposal',
            'plagiarism' => 'Plagiarism or high similarity',
            'budget_noncompliant' => 'Budget not compliant with the call',
            'format_noncompliant' => 'Template or format not followed',
            'ethical_clearance' => 'Ethical clearance missing or invalid',
            self::OTHER => 'Other',
        ],
        'blind_review' => [
            'not_anonymous' => 'Not anonymous — author identity revealed',
            'duplicate_or_funded' => 'Duplicate or already funded proposal',
            'plagiarism' => 'Plagiarism or high similarity',
            'ineligible_team' => 'PI or team not eligible',
            'outside_call_scope' => "Outside the call's scope or category",
            'conflict_of_interest' => 'Conflict of interest',
            'misconduct' => 'Research or ethical misconduct concern',
            self::OTHER => 'Other',
        ],
        'central_evaluation' => [
            'priority_misalignment' => 'Not aligned with institutional priorities',
            'funds_unavailable' => 'Insufficient funds in this round',
            'budget_unjustified' => 'Budget not justified or excessive',
            'feasibility' => 'Feasibility or timeline concerns',
            'weak_methodology' => 'Methodology not sound',
            'overlaps_funded' => 'Overlaps an existing funded project',
            'defence_concerns' => 'Unresolved issues from the open defence',
            self::OTHER => 'Other',
        ],
        'funding_revocation' => [
            'misconduct' => 'Research or financial misconduct',
            'contract_breach' => 'Breach of the research contract',
            'no_progress' => 'No meaningful progress on the project',
            'pi_unavailable' => 'PI left or is no longer available',
            'funding_error' => 'Funded by mistake',
            'ethics_violation' => 'Ethical clearance violated or withdrawn',
            self::OTHER => 'Other',
        ],
        'contract' => [
            'missing_signatures' => 'Missing or invalid signatures',
            'incorrect_details' => 'Incorrect proposal or budget details',
            'wrong_template' => 'Wrong or outdated contract template',
            'terms_modified' => 'Contract terms were altered',
            'unreadable_document' => 'Document unreadable or incomplete',
            self::OTHER => 'Other',
        ],
        'ethical_clearance' => [
            'wrong_document' => 'Not an ethical clearance certificate',
            'expired' => 'Certificate has expired',
            'unrecognized_board' => 'Issued by an unrecognized ethics board',
            'scope_mismatch' => 'Does not cover this study',
            'missing_details' => 'Clearance number or validity dates missing',
            'unreadable_document' => 'Document unreadable or incomplete',
            self::OTHER => 'Other',
        ],
        'budget_revision' => [
            'not_justified' => 'Change not adequately justified',
            'exceeds_ceiling' => 'Exceeds the approved budget ceiling',
            'ineligible_items' => 'Includes ineligible cost items',
            'scope_change' => 'Changes the approved scope of work',
            'missing_documents' => 'Supporting documents missing',
            self::OTHER => 'Other',
        ],
        'no_cost_extension' => [
            'not_justified' => 'Delay not adequately justified',
            'exceeds_limit' => 'Exceeds the maximum allowed extension',
            'insufficient_progress' => 'Insufficient progress to date',
            'reports_overdue' => 'Reports or deliverables overdue',
            'late_request' => 'Requested too late',
            self::OTHER => 'Other',
        ],
        'budget_request' => [
            'not_aligned' => 'Not aligned with the approved budget',
            'missing_documents' => 'Quotations or supporting documents missing',
            'exceeds_allocation' => 'Exceeds the remaining allocation',
            'ineligible_items' => 'Includes ineligible cost items',
            'previous_unsettled' => 'Previous round not yet settled',
            'calculation_errors' => 'Calculation errors in the request',
            self::OTHER => 'Other',
        ],
    ];

    /**
     * When the request carries a reason_code, validate it against the context's
     * catalog and replace $field with the composed reason text, so the endpoint's own
     * validation and storage keep working unchanged.
     */
    public static function apply(Request $request, string $context, string $field = 'reason'): void
    {
        if (! $request->filled('reason_code')) {
            return;
        }

        $catalog = self::CATALOG[$context];

        $request->validate([
            'reason_code' => ['required', Rule::in(array_keys($catalog))],
            $field => ['nullable', 'required_if:reason_code,'.self::OTHER, 'string', 'min:10', 'max:'.self::MAX_DETAILS],
        ], [
            'reason_code.in' => 'Please choose a reason from the list.',
            "{$field}.required_if" => 'Please describe the reason.',
        ]);

        $request->merge([$field => self::compose($context, $request->input('reason_code'), $request->input($field))]);
    }

    public static function compose(string $context, string $code, ?string $details): string
    {
        $details = trim((string) $details);

        if ($code === self::OTHER) {
            return $details;
        }

        $label = self::CATALOG[$context][$code];

        return $details === '' ? $label : "{$label} — {$details}";
    }
}
