import { useState } from 'react';
import { ShieldQuestion, CheckCircle2, XCircle, X } from 'lucide-react';
import { post } from '../lib/api';
import { formatDate, getStatusLabel } from '../lib/utils';
import { useToast } from './Toast';

const OUTCOMES = {
    approval_stands: {
        label: 'Approval stands',
        icon: CheckCircle2,
        active: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100',
        iconCls: 'text-emerald-600',
        button: 'bg-emerald-600 hover:bg-emerald-700',
        notesLabel: 'Resolution note',
        notesPlaceholder: 'e.g. Checked against the funded list — this is a different study. The approval stands.',
    },
    approval_revoked: {
        label: 'Mistaken approval — reject',
        icon: XCircle,
        active: 'border-red-500 bg-red-50 ring-2 ring-red-100',
        iconCls: 'text-red-600',
        button: 'bg-red-600 hover:bg-red-700',
        notesLabel: 'Rejection note',
        notesPlaceholder: 'Explain why the approval was a mistake…',
    },
};

/**
 * Central office / category officer decision on a mistaken-approval report.
 * `report` needs id, reason, reported_by, created_at, returned_from_status and
 * proposal (tracker_number, status).
 */
export default function ResolveApprovalReportModal({ report, proposal, onClose, onSaved }) {
    const { success, error } = useToast();
    const [outcome, setOutcome] = useState('approval_stands');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const target = proposal ?? report.proposal ?? {};
    const returnTo = report.returned_from_status;
    const cfg = OUTCOMES[outcome];

    const submit = async () => {
        if (notes.trim().length < 10) { error('Please write a note of at least 10 characters.'); return; }
        setSaving(true);
        try {
            const res = await post(`/approval-reports/${report.id}/resolve`, { outcome, resolution_notes: notes });
            success(res.message ?? 'Report resolved.');
            onSaved();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not resolve the report.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 bg-linear-to-r from-slate-800 to-slate-700 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                            <ShieldQuestion size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Resolve Approval Report</h2>
                            <p className="mt-0.5 font-mono text-xs text-slate-400">
                                {target.tracker_number} · currently {getStatusLabel(target.status)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4 p-6">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">College officer's report</p>
                        <p className="text-sm leading-relaxed text-slate-700">{report.reason}</p>
                        <p className="mt-2 text-xs text-slate-400">{report.reported_by?.name ?? 'College officer'} · {formatDate(report.created_at)}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(OUTCOMES).map(([key, o]) => (
                            <button
                                key={key}
                                onClick={() => setOutcome(key)}
                                className={`rounded-xl border-2 p-3 text-left transition-all ${outcome === key ? o.active : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                    <o.icon size={16} className={o.iconCls} /> {o.label}
                                </span>
                                <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                                    {key === 'approval_stands'
                                        ? returnTo
                                            ? `Returns to ${getStatusLabel(returnTo)} and continues from there.`
                                            : 'The proposal continues from where it is.'
                                        : 'Rejects the proposal, cancels outstanding reviews and notifies the proposal team.'}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">{cfg.notesLabel} <span className="text-red-500">*</span></label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={cfg.notesPlaceholder}
                            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                        {outcome === 'approval_revoked' && (
                            <p className="mt-1.5 text-xs text-gray-500">
                                The PI and co-investigators will see the college officer's reason <strong>and</strong> your note as the rejection reason.
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={saving}
                            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${cfg.button}`}
                        >
                            {saving ? 'Saving…' : outcome === 'approval_stands' ? 'Confirm — Approval Stands' : 'Confirm — Reject Proposal'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
