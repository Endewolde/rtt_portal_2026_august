import { useState, useEffect, useRef } from 'react';
import { ShieldQuestion, X, ChevronDown, Check, Info } from 'lucide-react';
import { post } from '../lib/api';
import { getStatusLabel } from '../lib/utils';
import { useToast } from './Toast';
import { APPROVAL_REPORT_ISSUES, issueByKey } from '../lib/approvalReportIssues';

const MAX_DETAILS = 2000;

function IssueSelect({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = issueByKey(value);

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    open ? 'border-amber-400' : 'border-gray-300 hover:border-gray-400'
                }`}
            >
                {selected ? (
                    <>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                            <selected.icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-gray-900">{selected.label}</span>
                            <span className="block truncate text-xs text-gray-500">{selected.description}</span>
                        </span>
                    </>
                ) : (
                    <span className="flex-1 text-gray-400">Select the issue with this proposal…</span>
                )}
                <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 z-10 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                >
                    {APPROVAL_REPORT_ISSUES.map((issue) => {
                        const active = issue.key === value;
                        return (
                            <li key={issue.key} role="option" aria-selected={active}>
                                <button
                                    type="button"
                                    onClick={() => { onChange(issue.key); setOpen(false); }}
                                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                                        active ? 'bg-amber-50' : 'hover:bg-gray-50'
                                    } ${issue.key === 'other' ? 'mt-1 border-t border-gray-100 pt-3' : ''}`}
                                >
                                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                        <issue.icon size={14} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium text-gray-900">{issue.label}</span>
                                        <span className="block text-xs leading-relaxed text-gray-500">{issue.description}</span>
                                    </span>
                                    {active && <Check size={15} className="mt-1 shrink-0 text-amber-600" />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * College officer flags a proposal as possibly mistakenly approved: pick the issue
 * from the list (or "Other" with a description), optionally add details.
 */
export default function ReportMistakenApprovalModal({ proposal, onClose, onReported }) {
    const { success, error } = useToast();
    const [issueType, setIssueType] = useState('');
    const [details, setDetails] = useState('');
    const [saving, setSaving] = useState(false);

    const isOther = issueType === 'other';
    const detailsTooShort = details.trim().length > 0 && details.trim().length < 10;
    const canSubmit = issueType && !saving && (isOther ? details.trim().length >= 10 : !detailsTooShort);
    const pullsBack = ['under_blind_review', 'blind_review_passed'].includes(proposal.status);

    const submit = async () => {
        if (!canSubmit) return;
        setSaving(true);
        try {
            const res = await post(`/proposals/${proposal.id}/approval-reports`, {
                issue_type: issueType,
                reason: details.trim() || null,
            });
            success(res?.message || 'Report submitted. The directors have been notified.');
            onReported();
        } catch (e) {
            const errors = e.response?.data?.errors;
            error(errors ? Object.values(errors).flat()[0] : (e.response?.data?.message ?? 'Could not submit the report.'));
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-visible rounded-2xl bg-white shadow-2xl">
                <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

                <div className="flex items-start justify-between gap-3 px-6 pt-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-4 ring-amber-50">
                            <ShieldQuestion size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Report Mistaken Approval</h2>
                            <p className="mt-0.5 text-xs text-gray-500">
                                <span className="font-mono">{proposal.tracker_number}</span> · {getStatusLabel(proposal.status)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-5 px-6 py-5">
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                            What is wrong with this proposal? <span className="text-red-500">*</span>
                        </label>
                        <IssueSelect value={issueType} onChange={setIssueType} />
                    </div>

                    {issueType && (
                        <div>
                            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-700">
                                <span>
                                    {isOther ? <>Describe the issue <span className="text-red-500">*</span></> : <>Additional details <span className="font-normal text-gray-400">(optional)</span></>}
                                </span>
                                <span className={`font-normal tabular-nums ${details.length > MAX_DETAILS ? 'text-red-500' : 'text-gray-400'}`}>
                                    {details.length}/{MAX_DETAILS}
                                </span>
                            </label>
                            <textarea
                                rows={4}
                                value={details}
                                maxLength={MAX_DETAILS}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder={isOther
                                    ? 'Explain clearly what is wrong, so the director can verify it…'
                                    : 'e.g. where you found it — page, section or document name…'}
                                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            {(isOther || detailsTooShort) && details.trim().length < 10 && (
                                <p className="mt-1 text-xs text-gray-400">Please write at least 10 characters.</p>
                            )}
                        </div>
                    )}

                    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>
                            {pullsBack
                                ? 'The proposal will be put on hold at Validated while the '
                                : 'The '}
                            category director and the central office review your report. If the approval stands, it continues from where it was;
                            if they confirm the mistake, it is rejected and the proposal team is told why. You can cancel the report until it is reviewed.
                        </span>
                    </div>
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!canSubmit}
                        className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? 'Submitting…' : 'Submit Report'}
                    </button>
                </div>
            </div>
        </div>
    );
}
