import { useState, useEffect, useCallback } from 'react';
import { Banknote, Plus, X, Loader2, FileText, Download, CheckCircle2, XCircle, Clock, Wallet, Pencil, Undo2 } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, EmptyState, Skeleton, Select } from '../../Components/Insights/Kit';
import api from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { useToast } from '../../Components/Toast';
import { cn, formatDate } from '../../lib/utils';

const KINDS = { publication_incentive: 'Publication incentive', article_fee: 'Article processing charge', travel: 'Conference travel', thesis: 'Thesis support', other: 'Other support' };
const STATUS = {
    submitted: { label: 'Waiting for a decision', cls: 'bg-amber-50 text-amber-800', icon: Clock },
    approved: { label: 'Approved', cls: 'bg-sky-50 text-sky-700', icon: CheckCircle2 },
    paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700', icon: Wallet },
    rejected: { label: 'Not approved', cls: 'bg-red-50 text-red-700', icon: XCircle },
    withdrawn: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-500', icon: Undo2 },
};
const money = (n) => (n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

function Badge({ status }) {
    const s = STATUS[status];
    return <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', s.cls)}><s.icon size={12} /> {s.label}</span>;
}

function Dialog({ title, onClose, children, footer }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">{children}</div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>
            </div>
        </div>
    );
}

function Field({ label, error, hint, children }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-700">{label}</span>
            {children}
            {hint && !error && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}
            {error && <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span>}
        </label>
    );
}

// ─── Applicant ────────────────────────────────────────────────────────────────

function ApplyDialog({ scheme, onClose, onDone }) {
    const { error } = useToast();
    const [f, setF] = useState({ title: '', venue: '', doi: '', justification: '', amount_requested: scheme.max_award ?? '' });
    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

    const send = async () => {
        setBusy(true);
        setErrors({});
        const fd = new FormData();
        fd.append('scheme_id', scheme.id);
        Object.entries(f).forEach(([k, v]) => fd.append(k, v ?? ''));
        if (file) fd.append('evidence', file);
        try {
            const r = await api.post('/support-grants', fd, { skipErrorToast: true });
            onDone(r.data?.message);
        } catch (e) {
            const errs = e.response?.data?.errors ?? {};
            setErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
            if (!Object.keys(errs).length) error(e.response?.data?.message ?? 'Could not submit.');
        }
        setBusy(false);
    };

    const isPaper = ['publication_incentive', 'article_fee'].includes(scheme.kind);
    return (
        <Dialog title={scheme.name} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={send} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" />} Submit</button>
            </>}>
            {scheme.description && <p className="whitespace-pre-line rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs leading-relaxed text-gray-600">{scheme.description}</p>}
            <Field label={isPaper ? 'Paper title *' : 'What it is for *'} error={errors.title}><input value={f.title} onChange={(e) => set('title', e.target.value)} className={inputCls} /></Field>
            <Field label={isPaper ? 'Journal' : scheme.kind === 'travel' ? 'Conference and place' : 'Details'}><input value={f.venue} onChange={(e) => set('venue', e.target.value)} className={inputCls} /></Field>
            {isPaper && <Field label="DOI"><input value={f.doi} onChange={(e) => set('doi', e.target.value)} className={inputCls} placeholder="10.…" /></Field>}
            <Field label="Amount requested *" error={errors.amount_requested} hint={scheme.max_award ? `At most ${money(scheme.max_award)}.` : null}>
                <input type="number" min="1" step="0.01" value={f.amount_requested} onChange={(e) => set('amount_requested', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Why it should be supported"><textarea rows={3} value={f.justification} onChange={(e) => set('justification', e.target.value)} className={inputCls} /></Field>
            <Field label="Evidence *" error={errors.evidence} hint={isPaper ? 'The published paper or the acceptance letter (PDF or image).' : 'The invitation, acceptance or quotation (PDF or image).'}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
            </Field>
        </Dialog>
    );
}

function Mine({ data, reload }) {
    const { success, error } = useToast();
    const [applying, setApplying] = useState(null);

    const withdraw = async (a) => {
        try { await api.post(`/support-grants/${a.id}/withdraw`); success('Application withdrawn.'); reload(); } catch (e) { error(e.response?.data?.message ?? 'Could not withdraw it.'); }
    };

    return (
        <div className="space-y-5">
            <Panel title="Open schemes" subtitle="Apply with your evidence; the research office decides and pays.">
                {data.schemes.length === 0 ? <p className="text-sm text-gray-500">No scheme is open right now.</p> : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {data.schemes.map((s) => {
                            const full = s.max_per_person && s.used >= s.max_per_person;
                            return (
                                <div key={s.id} className="flex flex-col rounded-2xl border border-gray-200 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">{KINDS[s.kind]}</p>
                                    <p className="mt-0.5 font-semibold text-gray-900">{s.name}</p>
                                    <p className="mt-1 flex-1 text-xs text-gray-500">
                                        {s.max_award ? `Up to ${money(s.max_award)}` : 'Amount decided per case'}{s.closes_on ? ` · closes ${formatDate(s.closes_on)}` : ''}{s.max_per_person ? ` · ${s.max_per_person} per person` : ''}
                                    </p>
                                    <button onClick={() => setApplying(s)} disabled={full} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
                                        {full ? 'Limit reached' : <><Plus size={14} /> Apply</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Panel>
            <Panel title="My applications" bodyClassName="p-0">
                {data.applications.length === 0 ? <EmptyState icon={Banknote} title="No applications yet" /> : (
                    <ul className="divide-y divide-gray-100">
                        {data.applications.map((a) => (
                            <li key={a.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900">{a.title}</p>
                                    <p className="text-xs text-gray-500">{a.reference} · {a.scheme?.name} · asked {money(a.amount_requested)}{a.amount_approved ? ` · approved ${money(a.amount_approved)}` : ''}</p>
                                    {a.decision_note && <p className="mt-1 text-xs text-gray-600">“{a.decision_note}”</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge status={a.status} />
                                    {a.status === 'submitted' && <button onClick={() => withdraw(a)} className="text-xs font-semibold text-gray-500 hover:text-red-600">Withdraw</button>}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
            {applying && <ApplyDialog scheme={applying} onClose={() => setApplying(null)} onDone={(m) => { success(m ?? 'Submitted.'); setApplying(null); reload(); }} />}
        </div>
    );
}

// ─── Office ───────────────────────────────────────────────────────────────────

function SchemeDialog({ scheme, onClose, onDone }) {
    const { error } = useToast();
    const [f, setF] = useState({
        name: '', kind: 'publication_incentive', description: '', academic_year: '', budget: '', max_award: '', max_per_person: '', opens_on: '', closes_on: '', active: true,
        ...(scheme ? Object.fromEntries(Object.entries(scheme).map(([k, v]) => [k, k.endsWith('_on') ? (v ?? '').slice(0, 10) : (v ?? '')])) : {}),
        active: scheme ? !!scheme.active : true,
    });
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

    const save = async () => {
        setBusy(true);
        const payload = Object.fromEntries(Object.entries(f).filter(([k]) => ['name', 'kind', 'description', 'academic_year', 'budget', 'max_award', 'max_per_person', 'opens_on', 'closes_on', 'active'].includes(k)).map(([k, v]) => [k, v === '' ? null : v]));
        try {
            const r = scheme ? await api.put(`/admin/support-schemes/${scheme.id}`, payload, { skipErrorToast: true }) : await api.post('/admin/support-schemes', payload, { skipErrorToast: true });
            onDone(r.data?.message);
        } catch (e) {
            const errs = e.response?.data?.errors ?? {};
            setErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, v[0]])));
            if (!Object.keys(errs).length) error(e.response?.data?.message ?? 'Could not save.');
        }
        setBusy(false);
    };

    return (
        <Dialog title={scheme ? 'Edit scheme' : 'New scheme'} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={save} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
            </>}>
            <Field label="Name *" error={errors.name}><input value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. Scopus publication incentive 2026" /></Field>
            <Field label="Kind"><select value={f.kind} onChange={(e) => set('kind', e.target.value)} className={inputCls}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Rules and eligibility"><textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Total budget" hint="Approvals stop when it is used up."><input type="number" min="0" value={f.budget} onChange={(e) => set('budget', e.target.value)} className={inputCls} /></Field>
                <Field label="Most per award"><input type="number" min="0" value={f.max_award} onChange={(e) => set('max_award', e.target.value)} className={inputCls} /></Field>
                <Field label="Applications per person"><input type="number" min="1" value={f.max_per_person} onChange={(e) => set('max_per_person', e.target.value)} className={inputCls} /></Field>
                <Field label="Academic year"><input value={f.academic_year} onChange={(e) => set('academic_year', e.target.value)} className={inputCls} placeholder="2025-2026" /></Field>
                <Field label="Opens on"><input type="date" value={f.opens_on} onChange={(e) => set('opens_on', e.target.value)} className={inputCls} /></Field>
                <Field label="Closes on" error={errors.closes_on}><input type="date" value={f.closes_on} onChange={(e) => set('closes_on', e.target.value)} className={inputCls} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="rounded text-indigo-600" /> Open for applications</label>
        </Dialog>
    );
}

function DecideDialog({ application, onClose, onDone }) {
    const { error } = useToast();
    const [action, setAction] = useState(application.status === 'approved' ? 'pay' : 'approve');
    const [amount, setAmount] = useState(application.amount_approved ?? application.amount_requested);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const send = async () => {
        setBusy(true);
        try {
            const r = await api.post(`/admin/support-grants/${application.id}/decide`, { action, amount_approved: amount, decision_note: note || null }, { skipErrorToast: true });
            onDone(r.data?.message);
        } catch (e) { error(e.response?.data?.errors?.decision_note?.[0] ?? e.response?.data?.message ?? 'Could not save the decision.'); }
        setBusy(false);
    };

    const actions = application.status === 'approved' ? [['pay', 'Mark paid'], ['reject', 'Withdraw approval']] : [['approve', 'Approve'], ['reject', 'Do not approve']];
    return (
        <Dialog title={`${application.reference} — ${application.applicant?.name}`} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={send} disabled={busy} className={cn('inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60', action === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700')}>{busy && <Loader2 size={14} className="animate-spin" />} Confirm and email</button>
            </>}>
            <div className="rounded-xl bg-gray-50 px-3.5 py-3 text-sm">
                <p className="font-medium text-gray-900">{application.title}</p>
                <p className="text-xs text-gray-500">{[application.venue, application.doi].filter(Boolean).join(' · ')}</p>
                <p className="mt-1 text-xs text-gray-600">Asked {money(application.amount_requested)} under {application.scheme?.name}</p>
                {application.justification && <p className="mt-2 whitespace-pre-line text-xs text-gray-600">{application.justification}</p>}
                <button onClick={() => downloadFile(`/support-grants/${application.id}/evidence`, application.reference).catch(() => error('Could not open the evidence.'))} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"><Download size={12} /> Evidence</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {actions.map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setAction(k)} className={cn('rounded-xl border px-3 py-2 text-sm font-semibold', action === k ? (k === 'reject' ? 'border-red-300 bg-red-50 text-red-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700') : 'border-gray-200 text-gray-600')}>{l}</button>
                ))}
            </div>
            {action === 'approve' && <Field label="Amount approved"><input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>}
            {action !== 'pay' && <Field label={action === 'reject' ? 'Reason, for the applicant *' : 'Note for the applicant'}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>}
        </Dialog>
    );
}

function Manage() {
    const { success } = useToast();
    const [data, setData] = useState(null);
    const [status, setStatus] = useState('submitted');
    const [editing, setEditing] = useState(null);
    const [deciding, setDeciding] = useState(null);

    const load = useCallback(() => {
        api.get('/admin/support-grants', { params: { status: status || undefined } }).then((r) => setData(r.data?.data)).catch(() => setData({ schemes: [], applications: [] }));
    }, [status]);
    useEffect(() => { load(); }, [load]);

    if (!data) return <Skeleton className="h-64" />;
    return (
        <div className="space-y-5">
            <Panel title="Schemes" actions={<button onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={14} /> New scheme</button>} bodyClassName="p-0">
                {data.schemes.length === 0 ? <EmptyState icon={Banknote} title="No schemes yet" text="Set up a publication incentive, article fee support or travel grant." /> : (
                    <ul className="divide-y divide-gray-100">
                        {data.schemes.map((s) => (
                            <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-2 font-medium text-gray-900">{s.name} {!s.is_open && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Closed</span>}</p>
                                    <p className="text-xs text-gray-500">{KINDS[s.kind]}{s.pending_count ? ` · ${s.pending_count} waiting` : ''} · paid {money(s.paid)}</p>
                                    {s.budget != null && (
                                        <div className="mt-1.5 max-w-sm">
                                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (s.committed / Math.max(1, s.budget)) * 100)}%` }} /></div>
                                            <p className="mt-0.5 text-[11px] text-gray-500">{money(s.committed)} of {money(s.budget)} committed</p>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Pencil size={15} /></button>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
            <Panel title="Applications" actions={
                <Select label="Status" value={status} onChange={setStatus} className="w-48">
                    <option value="">All</option>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>} bodyClassName="p-0">
                {data.applications.length === 0 ? <EmptyState icon={FileText} title="Nothing here" /> : (
                    <ul className="divide-y divide-gray-100">
                        {data.applications.map((a) => (
                            <li key={a.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900">{a.title}</p>
                                    <p className="text-xs text-gray-500">{a.reference} · {a.applicant?.name}{a.applicant?.college ? ` (${a.applicant.college.name})` : ''} · {a.scheme?.name} · asked {money(a.amount_requested)} · {formatDate(a.created_at)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge status={a.status} />
                                    {['submitted', 'approved'].includes(a.status) && <button onClick={() => setDeciding(a)} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800">{a.status === 'submitted' ? 'Decide' : 'Pay'}</button>}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
            {editing && <SchemeDialog scheme={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={(m) => { success(m); setEditing(null); load(); }} />}
            {deciding && <DecideDialog application={deciding} onClose={() => setDeciding(null)} onDone={(m) => { success(m); setDeciding(null); load(); }} />}
        </div>
    );
}

export default function SupportGrants() {
    const [data, setData] = useState(null);
    const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') ?? 'mine');
    const load = useCallback(() => { api.get('/support-grants/mine').then((r) => setData(r.data?.data)).catch(() => setData(false)); }, []);
    useEffect(() => { load(); }, [load]);

    return (
        <AppLayout breadcrumb="Support grants">
            <div className="mx-auto max-w-5xl space-y-5">
                <PageHeader icon={Banknote} color="emerald" title="Support grants" description="Publication incentives, article processing charges and conference travel — apply here and follow the decision." />
                {data?.can_manage && (
                    <div className="flex gap-1 rounded-2xl border border-gray-200 bg-white p-1" role="tablist">
                        {[['mine', 'My applications'], ['manage', 'Manage schemes']].map(([k, l]) => (
                            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-xl px-4 py-2 text-sm font-semibold', tab === k ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>{l}</button>
                        ))}
                    </div>
                )}
                {data === false ? <Panel bodyClassName="p-0"><EmptyState icon={XCircle} title="Could not load support grants" /></Panel>
                    : !data ? <Skeleton className="h-64" />
                    : tab === 'manage' && data.can_manage ? <Manage /> : <Mine data={data} reload={load} />}
            </div>
        </AppLayout>
    );
}
