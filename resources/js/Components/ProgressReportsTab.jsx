import { useState, useEffect, useCallback } from 'react';
import { translate as tr } from '../lib/i18n'
import { FileText, Clock, CheckCircle2, AlertCircle, RotateCcw, Send, X, Paperclip, Flag, ChevronDown, ChevronUp } from 'lucide-react';
import api, { get, post } from '../lib/api';
import { formatDate } from '../lib/utils';
import { downloadFile } from '../lib/download';
import { useToast } from './Toast';
import { currency, withCurrency } from '../lib/terms';

const STATUS = {
    due:                { label: 'Due',              cls: 'bg-gray-100 text-gray-700', icon: Clock },
    submitted:          { label: 'Awaiting review',  cls: 'bg-blue-100 text-blue-700', icon: Send },
    accepted:           { label: 'Accepted',         cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    revision_requested: { label: 'Needs revision',   cls: 'bg-amber-100 text-amber-800', icon: RotateCcw },
};

const MILESTONE_STATUSES = [['pending', 'Not started'], ['in_progress', 'In progress'], ['completed', 'Completed']];

function statusOf(r) {
    if (r.is_overdue) return { label: 'Overdue', cls: 'bg-red-100 text-red-700', icon: AlertCircle };
    if (r.status === 'due' && new Date(r.period_start) > new Date()) return { label: 'Upcoming', cls: 'bg-gray-50 text-gray-400', icon: Clock };
    return STATUS[r.status] ?? STATUS.due;
}

function SubmitModal({ report, milestones, onClose, onDone }) {
    const { success, error } = useToast();
    const [form, setForm] = useState({
        summary: report.summary ?? '',
        achievements: report.achievements ?? '',
        challenges: report.challenges ?? '',
        next_steps: report.next_steps ?? '',
        percent_complete: report.percent_complete ?? '',
        budget_spent: report.budget_spent ?? '',
    });
    const [milestoneState, setMilestoneState] = useState(
        Object.fromEntries(milestones.map((m) => [m.id, { status: m.status ?? 'pending', note: '' }]))
    );
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async () => {
        if (form.summary.trim().length < 30) { error('Please describe the work done (at least 30 characters).'); return; }
        if (form.percent_complete === '' || form.percent_complete < 0 || form.percent_complete > 100) { error('Enter the overall % complete (0–100).'); return; }
        setSaving(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v); });
            milestones.forEach((m, i) => {
                fd.append(`milestone_updates[${i}][milestone_id]`, m.id);
                fd.append(`milestone_updates[${i}][status]`, milestoneState[m.id].status);
                if (milestoneState[m.id].note) fd.append(`milestone_updates[${i}][note]`, milestoneState[m.id].note);
            });
            if (file) fd.append('attachment', file);
            const res = await api.post(`/progress-reports/${report.id}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            success(res.data?.message ?? 'Report submitted.');
            onDone();
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? 'Could not submit the report.'));
            setSaving(false);
        }
    };

    const field = (key, label, placeholder, rows = 3, required = false) => (
        <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">{label} {required && <span className="text-red-500">*</span>}</label>
            <textarea rows={rows} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder}
                className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">{report.is_final ? 'Final Report' : `Progress Report #${report.period_number}`}</h2>
                        <p className="text-xs text-gray-500">{tr("Period :period_start – :period_end · due :due_date", { period_start: formatDate(report.period_start), period_end: formatDate(report.period_end), due_date: formatDate(report.due_date) })}</p>
                    </div>
                    <button onClick={onClose} aria-label={tr("Close")} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="space-y-4 overflow-y-auto px-6 py-5">
                    {report.status === 'revision_requested' && report.review_notes && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <strong>{tr("Revision requested:")}</strong> {report.review_notes}
                        </div>
                    )}
                    {field('summary', report.is_final ? 'What the project achieved overall' : 'Work done this period', 'Activities carried out, data collected, analyses run…', 4, true)}
                    {field('achievements', 'Key results and outputs', 'Findings, publications, presentations, products…')}
                    {field('challenges', 'Challenges and how they were handled', 'Delays, access problems, budget issues…')}
                    {!report.is_final && field('next_steps', 'Plan for the next period', 'What will be done next…')}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-700">{tr("Overall progress (% complete)")} <span className="text-red-500">*</span></label>
                            <input type="number" min="0" max="100" value={form.percent_complete} onChange={(e) => set('percent_complete', e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-gray-700">{withCurrency(tr("Budget spent so far (ETB)"))}</label>
                            <input type="number" min="0" step="0.01" value={form.budget_spent} onChange={(e) => set('budget_spent', e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                    </div>

                    {milestones.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-semibold text-gray-700">{tr("Milestones")}</p>
                            <div className="space-y-2">
                                {milestones.map((m) => (
                                    <div key={m.id} className="rounded-xl border border-gray-200 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800"><Flag size={13} className="text-gray-400" /> {m.title}</span>
                                            <select value={milestoneState[m.id].status}
                                                onChange={(e) => setMilestoneState((s) => ({ ...s, [m.id]: { ...s[m.id], status: e.target.value } }))}
                                                className="rounded-lg border border-gray-300 px-2 py-1 text-xs">
                                                {MILESTONE_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                            </select>
                                        </div>
                                        <input value={milestoneState[m.id].note} placeholder={tr("Note (optional)")}
                                            onChange={(e) => setMilestoneState((s) => ({ ...s, [m.id]: { ...s[m.id], note: e.target.value } }))}
                                            className="mt-2 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">{tr("Supporting document (optional — PDF or Word, max 10 MB)")}</label>
                        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-600" />
                    </div>
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">{tr("Cancel")}</button>
                    <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                        {saving ? 'Submitting…' : 'Submit Report'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ReviewBox({ report, onDone }) {
    const { success, error } = useToast();
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(null);

    const decide = async (decision) => {
        if (decision === 'revision_requested' && notes.trim().length < 5) { error('Tell the PI what needs revising.'); return; }
        setSaving(decision);
        try {
            const res = await post(`/progress-reports/${report.id}/review`, { decision, notes: notes || null });
            success(res.message ?? 'Saved.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not save the review.');
        }
        setSaving(null);
    };

    return (
        <div className="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr("Notes to the PI (required when asking for a revision)")}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="flex justify-end gap-2">
                <button onClick={() => decide('revision_requested')} disabled={!!saving} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                    <RotateCcw size={12} /> {saving === 'revision_requested' ? 'Sending…' : 'Request revision'}
                </button>
                <button onClick={() => decide('accepted')} disabled={!!saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    <CheckCircle2 size={12} /> {saving === 'accepted' ? 'Saving…' : 'Accept'}
                </button>
            </div>
        </div>
    );
}

/** Proposal → Progress tab: the reporting schedule, submission for the team, review for officers. */
export default function ProgressReportsTab({ proposalId }) {
    const [reports, setReports] = useState([]);
    const [meta, setMeta] = useState({});
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [open, setOpen] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await get(`/proposals/${proposalId}/progress-reports`);
            setReports(res.data ?? []);
            setMeta(res.meta ?? {});
        } catch { setReports([]); }
        setLoading(false);
    }, [proposalId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="space-y-3 animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100" />)}</div>;
    if (reports.length === 0) return <p className="text-sm text-gray-500">{tr("Progress reports start once the project is funded.")}</p>;

    const latest = [...reports].reverse().find((r) => r.percent_complete !== null);

    return (
        <div className="space-y-4">
            {latest && (
                <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{tr("Overall progress (as last reported)")}</span>
                        <span className="font-bold tabular-nums text-gray-900">{latest.percent_complete}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${latest.percent_complete}%` }} /></div>
                </div>
            )}

            <ul className="space-y-2.5">
                {reports.map((r) => {
                    const st = statusOf(r);
                    const canSubmit = meta.can_submit && ['due', 'revision_requested'].includes(r.status) && new Date(r.period_start) <= new Date();
                    const expanded = open === r.id;
                    return (
                        <li key={r.id} className="rounded-xl border border-gray-200 p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-500"><FileText size={16} /></span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-900">{r.is_final ? 'Final report' : `Progress report #${r.period_number}`}</p>
                                    <p className="text-xs text-gray-500">{tr(":period_start – :period_end · due :due_date", { period_start: formatDate(r.period_start), period_end: formatDate(r.period_end), due_date: formatDate(r.due_date) })}</p>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}><st.icon size={11} /> {st.label}</span>
                                {canSubmit && (
                                    <button onClick={() => setEditing(r)} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">
                                        {r.status === 'revision_requested' ? 'Revise & resubmit' : 'Submit report'}
                                    </button>
                                )}
                                {r.submitted_at && (
                                    <button onClick={() => setOpen(expanded ? null : r.id)} aria-label={tr("Toggle details")} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50">
                                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                )}
                            </div>

                            {expanded && (
                                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-sm">
                                    {[['Work done', r.summary], ['Results and outputs', r.achievements], ['Challenges', r.challenges], ['Next period', r.next_steps]]
                                        .filter(([, v]) => v)
                                        .map(([label, v]) => (
                                            <div key={label}>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                                                <p className="whitespace-pre-line text-gray-700">{v}</p>
                                            </div>
                                        ))}
                                    <p className="text-xs text-gray-500">
                                        {r.percent_complete}% complete{r.budget_spent ? ` · ${Number(r.budget_spent).toLocaleString()} ${currency()} spent` : ''} · submitted by {r.submitted_by?.name ?? '—'} on {formatDate(r.submitted_at)}
                                    </p>
                                    {r.milestone_updates?.length > 0 && (
                                        <ul className="space-y-1">
                                            {r.milestone_updates.map((m) => (
                                                <li key={m.milestone_id} className="flex items-center gap-2 text-xs text-gray-600">
                                                    <Flag size={11} className="text-gray-400" /> {m.title} — <strong>{MILESTONE_STATUSES.find(([v]) => v === m.status)?.[1]}</strong>{m.note && ` · ${m.note}`}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {r.has_attachment && (
                                        <button onClick={() => downloadFile(`/progress-reports/${r.id}/attachment`, 'progress-report')} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                                            <Paperclip size={12} /> {tr("Download attachment")}
                                        </button>
                                    )}
                                    {r.review_notes && r.reviewed_by && (
                                        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"><strong>{r.reviewed_by.name}:</strong> {r.review_notes}</p>
                                    )}
                                    {meta.can_review && r.status === 'submitted' && <ReviewBox report={r} onDone={load} />}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {editing && <SubmitModal report={editing} milestones={meta.milestones ?? []} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
        </div>
    );
}
