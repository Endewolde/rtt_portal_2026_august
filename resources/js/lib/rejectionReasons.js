import {
    FileX, EyeOff, Target, UserX, Copy, FileWarning, Wallet, LayoutTemplate, ShieldAlert, Scale, Gavel,
    TrendingDown, Clock, FlaskConical, Layers, MessageSquareWarning, PenOff, FileSignature, FileQuestion,
    CalendarX, Building2, ListX, Receipt, Calculator, HandCoins, PenLine, Ban, UserMinus, CircleAlert,
} from 'lucide-react';

const OTHER = { key: 'other', label: 'Other', icon: PenLine, description: 'Something not listed above — describe it in your own words.' };

/**
 * Reasons for every reject action, per context. Keys must match
 * App\Support\RejectionReasons::CATALOG on the server.
 */
export const REJECTION_REASONS = {
    proposal_validation: [
        { key: 'incomplete_submission', label: 'Incomplete submission', icon: FileX, description: 'Required sections, documents or forms are missing.' },
        { key: 'not_anonymous', label: 'Not anonymous — author identity revealed', icon: EyeOff, description: 'Names, affiliations or other identifying details appear in documents meant for blind review.' },
        { key: 'outside_call_scope', label: "Outside the call's scope or category", icon: Target, description: "Does not fit the call's thematic area, priorities or proposal category." },
        { key: 'ineligible_team', label: 'PI or team not eligible', icon: UserX, description: "The PI or co-investigators do not meet the call's eligibility requirements." },
        { key: 'duplicate_or_funded', label: 'Duplicate or already funded proposal', icon: Copy, description: 'Same as, or substantially similar to, another submitted or funded proposal.' },
        { key: 'plagiarism', label: 'Plagiarism or high similarity', icon: FileWarning, description: 'Content copied from other work without proper attribution.' },
        { key: 'budget_noncompliant', label: 'Budget not compliant with the call', icon: Wallet, description: 'Budget exceeds the ceiling or includes ineligible cost items.' },
        { key: 'format_noncompliant', label: 'Template or format not followed', icon: LayoutTemplate, description: 'Does not follow the required template, length or format.' },
        { key: 'ethical_clearance', label: 'Ethical clearance missing or invalid', icon: ShieldAlert, description: 'Required ethical clearance is missing, expired or invalid.' },
        OTHER,
    ],
    blind_review: [
        { key: 'not_anonymous', label: 'Not anonymous — author identity revealed', icon: EyeOff, description: 'Identifying details were found in the blind review documents.' },
        { key: 'duplicate_or_funded', label: 'Duplicate or already funded proposal', icon: Copy, description: 'Same as, or substantially similar to, another submitted or funded proposal.' },
        { key: 'plagiarism', label: 'Plagiarism or high similarity', icon: FileWarning, description: 'Content copied from other work without proper attribution.' },
        { key: 'ineligible_team', label: 'PI or team not eligible', icon: UserX, description: "The PI or co-investigators do not meet the call's eligibility requirements." },
        { key: 'outside_call_scope', label: "Outside the call's scope or category", icon: Target, description: "Does not fit the call's thematic area, priorities or category." },
        { key: 'conflict_of_interest', label: 'Conflict of interest', icon: Scale, description: 'A conflict of interest compromises this proposal or its review.' },
        { key: 'misconduct', label: 'Research or ethical misconduct concern', icon: Gavel, description: 'Fabrication, falsification or another integrity concern.' },
        OTHER,
    ],
    central_evaluation: [
        { key: 'priority_misalignment', label: 'Not aligned with institutional priorities', icon: Target, description: "Does not match the university's current research priorities." },
        { key: 'funds_unavailable', label: 'Insufficient funds in this round', icon: TrendingDown, description: 'The available budget for this round has been exhausted.' },
        { key: 'budget_unjustified', label: 'Budget not justified or excessive', icon: Wallet, description: 'Costs are not justified by the planned work.' },
        { key: 'feasibility', label: 'Feasibility or timeline concerns', icon: Clock, description: 'The plan is unlikely to be achievable in the proposed time or resources.' },
        { key: 'weak_methodology', label: 'Methodology not sound', icon: FlaskConical, description: 'The research design or methods are not adequate.' },
        { key: 'overlaps_funded', label: 'Overlaps an existing funded project', icon: Layers, description: 'Substantially overlaps work already funded.' },
        { key: 'defence_concerns', label: 'Unresolved issues from the open defence', icon: MessageSquareWarning, description: 'Concerns raised at the open defence were not addressed.' },
        OTHER,
    ],
    funding_revocation: [
        { key: 'misconduct', label: 'Research or financial misconduct', icon: Gavel, description: 'Misuse of funds, fabrication or another integrity breach.' },
        { key: 'contract_breach', label: 'Breach of the research contract', icon: FileSignature, description: 'The terms of the signed contract were not honoured.' },
        { key: 'no_progress', label: 'No meaningful progress on the project', icon: TrendingDown, description: 'Milestones and reports show no real progress.' },
        { key: 'pi_unavailable', label: 'PI left or is no longer available', icon: UserMinus, description: 'The PI has left the university or can no longer lead the project.' },
        { key: 'funding_error', label: 'Funded by mistake', icon: CircleAlert, description: 'The proposal should not have been funded.' },
        { key: 'ethics_violation', label: 'Ethical clearance violated or withdrawn', icon: ShieldAlert, description: 'The study no longer has valid ethical approval.' },
        OTHER,
    ],
    contract: [
        { key: 'missing_signatures', label: 'Missing or invalid signatures', icon: PenOff, description: 'One or more required signatures are missing or invalid.' },
        { key: 'incorrect_details', label: 'Incorrect proposal or budget details', icon: FileQuestion, description: 'Names, amounts or dates do not match the approved proposal.' },
        { key: 'wrong_template', label: 'Wrong or outdated contract template', icon: LayoutTemplate, description: 'Not the current official contract template.' },
        { key: 'terms_modified', label: 'Contract terms were altered', icon: FileWarning, description: 'The standard terms were changed without approval.' },
        { key: 'unreadable_document', label: 'Document unreadable or incomplete', icon: FileX, description: 'Pages are missing, blurred or cut off.' },
        OTHER,
    ],
    ethical_clearance: [
        { key: 'wrong_document', label: 'Not an ethical clearance certificate', icon: FileQuestion, description: 'The uploaded file is a different document.' },
        { key: 'expired', label: 'Certificate has expired', icon: CalendarX, description: 'The clearance is no longer valid.' },
        { key: 'unrecognized_board', label: 'Issued by an unrecognized ethics board', icon: Building2, description: 'The issuing review board is not accepted.' },
        { key: 'scope_mismatch', label: 'Does not cover this study', icon: Target, description: 'The clearance is for a different study, title or scope.' },
        { key: 'missing_details', label: 'Clearance number or validity dates missing', icon: ListX, description: 'Key reference details cannot be found on the certificate.' },
        { key: 'unreadable_document', label: 'Document unreadable or incomplete', icon: FileX, description: 'Pages are missing, blurred or cut off.' },
        OTHER,
    ],
    budget_revision: [
        { key: 'not_justified', label: 'Change not adequately justified', icon: MessageSquareWarning, description: 'The reason for the change is unclear or insufficient.' },
        { key: 'exceeds_ceiling', label: 'Exceeds the approved budget ceiling', icon: TrendingDown, description: 'The revised total is above what was approved.' },
        { key: 'ineligible_items', label: 'Includes ineligible cost items', icon: Ban, description: 'Some items cannot be paid from research funds.' },
        { key: 'scope_change', label: 'Changes the approved scope of work', icon: Layers, description: 'The revision changes what the project will do.' },
        { key: 'missing_documents', label: 'Supporting documents missing', icon: FileX, description: 'Quotations or justification documents were not provided.' },
        OTHER,
    ],
    no_cost_extension: [
        { key: 'not_justified', label: 'Delay not adequately justified', icon: MessageSquareWarning, description: 'The reason for needing more time is unclear or insufficient.' },
        { key: 'exceeds_limit', label: 'Exceeds the maximum allowed extension', icon: CalendarX, description: 'The requested period is longer than the policy allows.' },
        { key: 'insufficient_progress', label: 'Insufficient progress to date', icon: TrendingDown, description: 'Progress so far does not support extending the project.' },
        { key: 'reports_overdue', label: 'Reports or deliverables overdue', icon: Clock, description: 'Required reports or deliverables have not been submitted.' },
        { key: 'late_request', label: 'Requested too late', icon: CircleAlert, description: 'The request was made too close to, or after, the end date.' },
        OTHER,
    ],
    budget_request: [
        { key: 'not_aligned', label: 'Not aligned with the approved budget', icon: Receipt, description: 'Items or amounts differ from the approved budget.' },
        { key: 'missing_documents', label: 'Quotations or supporting documents missing', icon: FileX, description: 'Required quotations or justification are not attached.' },
        { key: 'exceeds_allocation', label: 'Exceeds the remaining allocation', icon: HandCoins, description: 'The amount requested is more than what is left.' },
        { key: 'ineligible_items', label: 'Includes ineligible cost items', icon: Ban, description: 'Some items cannot be paid from research funds.' },
        { key: 'previous_unsettled', label: 'Previous round not yet settled', icon: Clock, description: 'The earlier disbursement has not been settled.' },
        { key: 'calculation_errors', label: 'Calculation errors in the request', icon: Calculator, description: 'Totals or unit costs do not add up.' },
        OTHER,
    ],
};
