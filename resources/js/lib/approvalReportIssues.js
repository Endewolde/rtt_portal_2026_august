import {
    EyeOff, Activity, Copy, FileWarning, UserX, Target, FileX, Wallet, ShieldAlert, LayoutTemplate, Scale, PenLine,
} from 'lucide-react';

/**
 * Issues a college officer can report as a mistaken approval. Keys must match
 * ProposalApprovalReport::ISSUE_TYPES on the server.
 */
export const APPROVAL_REPORT_ISSUES = [
    { key: 'not_anonymous',        label: 'Not anonymous — author identity revealed', icon: EyeOff,         description: 'Names, affiliations or other identifying details appear in the blind review documents.' },
    { key: 'already_ongoing',      label: 'Already ongoing — the project is already running', icon: Activity, description: 'The project was funded before and is already running. The director can move it straight to Ongoing Proposals.' },
    { key: 'duplicate_or_funded',  label: 'Duplicate or already funded proposal',     icon: Copy,           description: 'Same as, or substantially similar to, another submitted or previously funded proposal.' },
    { key: 'plagiarism',           label: 'Plagiarism or high similarity',            icon: FileWarning,    description: 'Content copied from other work without proper attribution.' },
    { key: 'ineligible_team',      label: 'PI or team not eligible',                  icon: UserX,          description: "The PI or co-investigators do not meet the call's eligibility requirements." },
    { key: 'outside_call_scope',   label: "Outside the call's scope or category",     icon: Target,         description: "Does not fit the call's thematic area, priorities or proposal category." },
    { key: 'incomplete_documents', label: 'Missing or incomplete documents',          icon: FileX,          description: 'Required documents or sections are missing, unreadable or incomplete.' },
    { key: 'budget_noncompliant',  label: 'Budget not compliant with the call',       icon: Wallet,         description: 'Budget exceeds the ceiling or includes ineligible cost items.' },
    { key: 'ethical_clearance',    label: 'Ethical clearance missing or invalid',     icon: ShieldAlert,    description: 'Required ethical clearance is missing, expired or invalid.' },
    { key: 'format_noncompliant',  label: 'Template or format not followed',          icon: LayoutTemplate, description: 'Does not follow the required proposal template, length or format.' },
    { key: 'conflict_of_interest', label: 'Conflict of interest in the approval',     icon: Scale,          description: 'A conflict of interest affected how this proposal was approved.' },
    { key: 'other',                label: 'Other',                                    icon: PenLine,        description: 'Something not listed above — describe it in your own words.' },
];

export const issueByKey = (key) => APPROVAL_REPORT_ISSUES.find((i) => i.key === key) ?? null;
