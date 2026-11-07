import { useState, useEffect, useCallback } from 'react';
import {
    Handshake, Lightbulb, Search, Plus, X, Loader2, Pencil, Trash2, Download, AlertTriangle, CheckCircle2, Clock, Ban,
    Building2, Globe2, FileText, Banknote, ChevronRight,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, EmptyState, StatCard, Select, Skeleton } from '../../Components/Insights/Kit';
import ConfirmDialog from '../../Components/ConfirmDialog';
import api from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { cn, formatDate } from '../../lib/utils';

const PARTNER_TYPES = { university: 'University', industry: 'Industry', government: 'Government', ngo: 'NGO', international: 'International body', community: 'Community' };
const AGREEMENTS = { mou: 'MoU', moa: 'MoA', contract: 'Contract', collaboration: 'Collaboration', licence: 'Licence' };
const STATES = {
    active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    expiring: { label: 'Ending soon', cls: 'bg-amber-50 text-amber-700', icon: Clock },
    expired: { label: 'Expired', cls: 'bg-red-50 text-red-700', icon: AlertTriangle },
    terminated: { label: 'Terminated', cls: 'bg-gray-100 text-gray-600', icon: Ban },
};
const STAGES = [
    { key: 'disclosed', label: 'Disclosed', hint: 'An inventor has reported it' },
    { key: 'assessed', label: 'Assessed', hint: 'Novelty and market checked' },
    { key: 'filed', label: 'Filed', hint: 'Protection applied for' },
    { key: 'granted', label: 'Granted', hint: 'Protection granted' },
    { key: 'commercialised', label: 'Commercialised', hint: 'Licensed, spun off or in use' },
    { key: 'closed', label: 'Closed', hint: 'Not taken further' },
];
const IP_TYPES = { patent: 'Patent', utility_model: 'Utility model', industrial_design: 'Industrial design', copyright: 'Copyright', trademark: 'Trademark', plant_variety: 'Plant variety', trade_secret: 'Trade secret' };
const COMMERCIALISATION = { licence: 'Licence', spin_off: 'Spin-off company', assignment: 'Assignment (sale)', in_house: 'Used in-house' };
const INCOME_SOURCES = { licence_fee: 'Licence fee', royalty: 'Royalty', equity: 'Equity', sale: 'Sale', grant: 'Follow-on grant', other: 'Other' };
const birr = (n) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB`;

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

function Field({ label, error, children, hint }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-700">{label}</span>
            {children}
            {hint && !error && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}
            {error && <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span>}
        </label>
    );
}

function Modal({ title, onClose, children, footer }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>
            </div>
        </div>
    );
}

/** Search-as-you-type picker for one record (a person) or several (projects). */
function Picker({ endpoint, params = {}, label, value, onChange, multiple = false, render }) {
    const [q, setQ] = useState('');
    const [hits, setHits] = useState([]);
    useEffect(() => {
        if (q.trim().length < 2) { setHits([]); return undefined; }
        const t = setTimeout(() => {
            api.get(endpoint, { params: { ...params, search: q, per_page: 8 }, skipErrorToast: true })
                .then((r) => { const d = r.data?.data; setHits(Array.isArray(d) ? d : (d?.data ?? [])); })
                .catch(() => setHits([]));
        }, 300);
        return () => clearTimeout(t);
    }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

    const picked = multiple ? value : (value ? [value] : []);
    return (
        <div>
            {picked.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                    {picked.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-indigo-800">
                            {render(p)}
                            <button type="button" aria-label="Remove" onClick={() => onChange(multiple ? value.filter((v) => v.id !== p.id) : null)} className="rounded-full p-0.5 hover:bg-indigo-100"><X size={11} /></button>
                        </span>
                    ))}
                </div>
            )}
            {(multiple || picked.length === 0) && (
                <div className="relative">
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={label} aria-label={label} className={inputCls} />
                    {hits.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                            {hits.map((h) => (
                                <button key={h.id} type="button" onClick={() => { onChange(multiple ? [...value.filter((v) => v.id !== h.id), h] : h); setQ(''); setHits([]); }}
                                    className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-indigo-50">{render(h)}</button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Partnerships ─────────────────────────────────────────────────────────────

function PartnershipForm({ editing, colleges, onClose, onSaved }) {
    const { error } = useToast();
    const [f, setF] = useState(() => ({
        partner_name: '', partner_type: 'university', country: '', agreement_type: 'mou', title: '', scope: '',
        signed_on: '', expires_on: '', terminated: false, college_id: '', partner_contact_name: '', partner_contact_email: '',
        ...(editing ? Object.fromEntries(Object.entries(editing).map(([k, v]) => [k, k.endsWith('_on') ? (v ?? '').slice(0, 10) : (v ?? '')])) : {}),
        terminated: !!editing?.terminated,
    }));
    const [focal, setFocal] = useState(editing?.focal_person ?? null);
    const [projects, setProjects] = useState(editing?.proposals ?? []);
    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

    const save = async () => {
        setBusy(true);
        setErrors({});
        const fd = new FormData();
        ['partner_name', 'partner_type', 'country', 'agreement_type', 'title', 'scope', 'signed_on', 'expires_on', 'college_id', 'partner_contact_name', 'partner_contact_email']
            .forEach((k) => fd.append(k, f[k] ?? ''));
        fd.append('terminated', f.terminated ? '1' : '0');
        fd.append('focal_person_id', focal?.id ?? '');
        projects.forEach((p) => fd.append('proposal_ids[]', p.id));
        if (projects.length === 0) fd.append('proposal_ids', '');
        if (file) fd.append('document', file);
        try {
            const r = await api.post(editing ? `/tech-transfer/partnerships/${editing.id}` : '/tech-transfer/partnerships', fd, { skipErrorToast: true });
            onSaved(r.data?.message);
        } catch (e) {
            const errs = e.response?.data?.errors ?? {};
            setErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
            if (!Object.keys(errs).length) error(e.response?.data?.message ?? 'Could not save.');
        }
        setBusy(false);
    };

    return (
        <Modal title={editing ? 'Edit agreement' : 'New agreement'} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={save} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
            </>}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Partner organisation *" error={errors.partner_name}><input value={f.partner_name} onChange={(e) => set('partner_name', e.target.value)} className={inputCls} placeholder="e.g. Ethiopian Agricultural Research Institute" /></Field></div>
                <Field label="Kind of partner"><select value={f.partner_type} onChange={(e) => set('partner_type', e.target.value)} className={inputCls}>{Object.entries(PARTNER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Country"><input value={f.country} onChange={(e) => set('country', e.target.value)} className={inputCls} placeholder="Ethiopia" /></Field>
                <Field label="Agreement"><select value={f.agreement_type} onChange={(e) => set('agreement_type', e.target.value)} className={inputCls}>{Object.entries(AGREEMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Title"><input value={f.title} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="e.g. Joint research on climate-smart farming" /></Field>
                <Field label="Signed on" error={errors.signed_on}><input type="date" value={f.signed_on} onChange={(e) => set('signed_on', e.target.value)} className={inputCls} /></Field>
                <Field label="Ends on" error={errors.expires_on} hint="Reminders go out 90 days before."><input type="date" value={f.expires_on} onChange={(e) => set('expires_on', e.target.value)} className={inputCls} /></Field>
                <div className="sm:col-span-2"><Field label="What the agreement covers"><textarea rows={3} value={f.scope} onChange={(e) => set('scope', e.target.value)} className={inputCls} /></Field></div>
                <Field label="College"><select value={f.college_id ?? ''} onChange={(e) => set('college_id', e.target.value)} className={inputCls}><option value="">University-wide</option>{colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Our focal person"><Picker endpoint="/users" label="Search people…" value={focal} onChange={setFocal} render={(u) => u.name} /></Field>
                <Field label="Partner's contact"><input value={f.partner_contact_name} onChange={(e) => set('partner_contact_name', e.target.value)} className={inputCls} placeholder="Name" /></Field>
                <Field label="Contact email" error={errors.partner_contact_email}><input type="email" value={f.partner_contact_email} onChange={(e) => set('partner_contact_email', e.target.value)} className={inputCls} /></Field>
                <div className="sm:col-span-2"><Field label="Projects under this agreement"><Picker endpoint="/proposals" label="Search projects by title or number…" multiple value={projects} onChange={setProjects} render={(p) => `${p.tracker_number} · ${p.title}`} /></Field></div>
                <div className="sm:col-span-2">
                    <Field label="Signed agreement (PDF, Word or image)" error={errors.document} hint={editing?.has_document ? 'A document is on file — choose a file to replace it.' : 'Kept private to the office.'}>
                        <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
                    </Field>
                </div>
                {editing && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                        <input type="checkbox" checked={f.terminated} onChange={(e) => set('terminated', e.target.checked)} className="rounded text-red-600" /> The agreement has been terminated
                    </label>
                )}
            </div>
        </Modal>
    );
}

function Partnerships({ canManage, colleges }) {
    const { success, error } = useToast();
    const [rows, setRows] = useState(null);
    const [meta, setMeta] = useState({});
    const [state, setState] = useState('');
    const [type, setType] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null);
    const [removing, setRemoving] = useState(null);

    const load = useCallback(() => {
        api.get('/tech-transfer/partnerships', { params: { state: state || undefined, type: type || undefined, search: search || undefined } })
            .then((r) => { setRows(r.data?.data ?? []); setMeta(r.data?.meta ?? {}); }).catch(() => setRows([]));
    }, [state, type, search]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    const c = meta.counts ?? {};
    const remove = async () => {
        try { await api.delete(`/tech-transfer/partnerships/${removing.id}`); success('Agreement deleted.'); load(); } catch { error('Could not delete it.'); }
        setRemoving(null);
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {['active', 'expiring', 'expired', 'terminated'].map((k) => (
                    <button key={k} onClick={() => setState(state === k ? '' : k)} className={cn('text-left', state === k && 'rounded-2xl ring-2 ring-indigo-400')}>
                        <StatCard icon={STATES[k].icon} label={STATES[k].label} value={c[k] ?? 0} color={{ active: 'emerald', expiring: 'amber', expired: 'red', terminated: 'slate' }[k]} hint={k === 'expiring' ? 'Within 90 days' : ''} loading={rows === null} />
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row">
                <label className="relative min-w-0 flex-1">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partner, title or country…" className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </label>
                <Select label="Kind" value={type} onChange={setType} className="sm:w-44">
                    <option value="">All partners</option>
                    {Object.entries(PARTNER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                {canManage && <button onClick={() => setEditing('new')} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={15} /> New agreement</button>}
            </div>

            {rows === null ? <Skeleton className="h-48" /> : rows.length === 0 ? (
                <Panel bodyClassName="p-0"><EmptyState icon={Handshake} title="No agreements here" text="Record the university's MoUs and agreements to see what is active and get reminded before they end." /></Panel>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <ul className="divide-y divide-gray-100">
                        {rows.map((p) => {
                            const st = STATES[p.state];
                            return (
                                <li key={p.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-gray-900">{p.partner_name}</span>
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{AGREEMENTS[p.agreement_type]}</span>
                                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', st.cls)}><st.icon size={11} /> {st.label}</span>
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-500">
                                            {[PARTNER_TYPES[p.partner_type], p.country, p.title].filter(Boolean).join(' · ')}
                                        </p>
                                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                                            {p.college && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {p.college.name}</span>}
                                            {p.focal_person && <span>Focal: {p.focal_person.name}</span>}
                                            {p.proposals?.length > 0 && <span>{p.proposals.length} project{p.proposals.length === 1 ? '' : 's'}</span>}
                                            <span>{p.signed_on ? `Signed ${formatDate(p.signed_on)}` : 'Not signed yet'}{p.expires_on ? ` · ends ${formatDate(p.expires_on)}` : ' · no end date'}</span>
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        {p.has_document && <button onClick={() => downloadFile(`/tech-transfer/partnerships/${p.id}/document`, `${p.partner_name}-agreement`).catch(() => error('Could not open the document.'))} aria-label="Download agreement" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Download size={15} /></button>}
                                        {canManage && <button onClick={() => setEditing(p)} aria-label="Edit" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Pencil size={15} /></button>}
                                        {canManage && <button onClick={() => setRemoving(p)} aria-label="Delete" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {editing && <PartnershipForm editing={editing === 'new' ? null : editing} colleges={colleges} onClose={() => setEditing(null)} onSaved={(m) => { success(m ?? 'Saved.'); setEditing(null); load(); }} />}
            <ConfirmDialog open={!!removing} title="Delete this agreement?" description={`${removing?.partner_name ?? ''} will be removed from the register, with its document.`}
                confirmLabel="Delete" confirmVariant="danger" onConfirm={remove} onCancel={() => setRemoving(null)} />
        </div>
    );
}

// ─── Innovations ──────────────────────────────────────────────────────────────

function InnovationForm({ editing, colleges, partnerships, onClose, onSaved }) {
    const { error, success } = useToast();
    const [f, setF] = useState(() => ({
        title: '', description: '', ip_type: 'patent', stage: 'disclosed', disclosed_on: '', filing_number: '', filed_on: '', granted_on: '',
        commercialisation: '', partnership_id: '', licensee: '', licensed_on: '', spin_off_name: '', notes: '', college_id: '',
        ...(editing ? Object.fromEntries(Object.entries(editing).map(([k, v]) => [k, k.endsWith('_on') ? (v ?? '').slice(0, 10) : (v ?? '')])) : {}),
    }));
    const [inventors, setInventors] = useState((editing?.inventors ?? []).join(', '));
    const [project, setProject] = useState(editing?.proposal ?? null);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [incomes, setIncomes] = useState(editing?.incomes ?? []);
    const [income, setIncome] = useState({ amount: '', currency: 'ETB', received_on: '', source: 'licence_fee', note: '' });
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    const at = STAGES.findIndex((s) => s.key === f.stage);

    const save = async () => {
        setBusy(true);
        setErrors({});
        const payload = { ...f, inventors: inventors.split(',').map((s) => s.trim()).filter(Boolean), proposal_id: project?.id ?? null };
        Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
        try {
            const r = editing ? await api.put(`/tech-transfer/innovations/${editing.id}`, payload, { skipErrorToast: true }) : await api.post('/tech-transfer/innovations', payload, { skipErrorToast: true });
            onSaved(r.data?.message);
        } catch (e) {
            const errs = e.response?.data?.errors ?? {};
            setErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
            if (!Object.keys(errs).length) error(e.response?.data?.message ?? 'Could not save.');
        }
        setBusy(false);
    };

    const addIncome = async () => {
        try {
            const r = await api.post(`/tech-transfer/innovations/${editing.id}/incomes`, income);
            setIncomes((x) => [r.data.data, ...x]);
            setIncome({ amount: '', currency: 'ETB', received_on: '', source: 'licence_fee', note: '' });
            success('Income recorded.');
        } catch (e) { error(e.response?.data?.message ?? 'Could not record it.'); }
    };
    const removeIncome = async (row) => {
        try { await api.delete(`/tech-transfer/innovations/${editing.id}/incomes/${row.id}`); setIncomes((x) => x.filter((i) => i.id !== row.id)); } catch { error('Could not remove it.'); }
    };

    return (
        <Modal title={editing ? `${editing.reference} — ${editing.title}` : 'New invention disclosure'} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
                <button onClick={save} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
            </>}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Title *" error={errors.title}><input value={f.title} onChange={(e) => set('title', e.target.value)} className={inputCls} placeholder="e.g. Solar-powered enset processing machine" /></Field></div>
                <div className="sm:col-span-2"><Field label="What it is and what problem it solves"><textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} className={inputCls} /></Field></div>
                <Field label="Inventors" hint="Separate names with commas."><input value={inventors} onChange={(e) => setInventors(e.target.value)} className={inputCls} /></Field>
                <Field label="Kind of protection"><select value={f.ip_type} onChange={(e) => set('ip_type', e.target.value)} className={inputCls}>{Object.entries(IP_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="College"><select value={f.college_id ?? ''} onChange={(e) => set('college_id', e.target.value)} className={inputCls}><option value="">—</option>{colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="From project"><Picker endpoint="/proposals" label="Search projects…" value={project} onChange={setProject} render={(p) => `${p.tracker_number} · ${p.title}`} /></Field>
                <div className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-gray-700">Stage</span>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        {STAGES.map((s, i) => (
                            <button key={s.key} type="button" onClick={() => set('stage', s.key)} title={s.hint}
                                className={cn('rounded-lg border px-2 py-2 text-xs font-semibold', f.stage === s.key ? 'border-indigo-500 bg-indigo-600 text-white' : i < at && s.key !== 'closed' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>{s.label}</button>
                        ))}
                    </div>
                </div>
                <Field label="Disclosed on"><input type="date" value={f.disclosed_on} onChange={(e) => set('disclosed_on', e.target.value)} className={inputCls} /></Field>
                {['filed', 'granted', 'commercialised'].includes(f.stage) && <>
                    <Field label="Application / patent number" error={errors.filing_number}><input value={f.filing_number} onChange={(e) => set('filing_number', e.target.value)} className={inputCls} placeholder="e.g. ET/P/2026/00123" /></Field>
                    <Field label="Filed on"><input type="date" value={f.filed_on} onChange={(e) => set('filed_on', e.target.value)} className={inputCls} /></Field>
                </>}
                {['granted', 'commercialised'].includes(f.stage) && <Field label="Granted on" error={errors.granted_on}><input type="date" value={f.granted_on} onChange={(e) => set('granted_on', e.target.value)} className={inputCls} /></Field>}
                {f.stage === 'commercialised' && <>
                    <Field label="How" error={errors.commercialisation}><select value={f.commercialisation ?? ''} onChange={(e) => set('commercialisation', e.target.value)} className={inputCls}><option value="">Choose…</option>{Object.entries(COMMERCIALISATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                    {f.commercialisation === 'spin_off'
                        ? <Field label="Spin-off company" error={errors.spin_off_name}><input value={f.spin_off_name} onChange={(e) => set('spin_off_name', e.target.value)} className={inputCls} /></Field>
                        : <Field label="Licensee / buyer"><input value={f.licensee} onChange={(e) => set('licensee', e.target.value)} className={inputCls} /></Field>}
                    <Field label="Agreement in the register"><select value={f.partnership_id ?? ''} onChange={(e) => set('partnership_id', e.target.value)} className={inputCls}><option value="">—</option>{partnerships.map((p) => <option key={p.id} value={p.id}>{p.partner_name}{p.title ? ` — ${p.title}` : ''}</option>)}</select></Field>
                    <Field label="Licensed / started on"><input type="date" value={f.licensed_on} onChange={(e) => set('licensed_on', e.target.value)} className={inputCls} /></Field>
                </>}
                <div className="sm:col-span-2"><Field label="Notes"><textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} /></Field></div>
            </div>

            {editing && (
                <section className="rounded-2xl border border-gray-200 p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Banknote size={15} className="text-emerald-600" /> Income</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <input type="number" min="0" step="0.01" value={income.amount} onChange={(e) => setIncome((x) => ({ ...x, amount: e.target.value }))} placeholder="Amount" aria-label="Amount" className={inputCls} />
                        <input value={income.currency} maxLength={3} onChange={(e) => setIncome((x) => ({ ...x, currency: e.target.value.toUpperCase() }))} aria-label="Currency" className={inputCls} />
                        <input type="date" value={income.received_on} onChange={(e) => setIncome((x) => ({ ...x, received_on: e.target.value }))} aria-label="Received on" className={inputCls} />
                        <select value={income.source} onChange={(e) => setIncome((x) => ({ ...x, source: e.target.value }))} aria-label="Source" className={inputCls}>{Object.entries(INCOME_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                        <button type="button" onClick={addIncome} disabled={!income.amount || !income.received_on} className="col-span-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 sm:col-span-1">Add</button>
                    </div>
                    {incomes.length > 0 && (
                        <ul className="mt-3 divide-y divide-gray-100 text-sm">
                            {incomes.map((i) => (
                                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                                    <span className="text-gray-700">{formatDate(i.received_on)} · {INCOME_SOURCES[i.source]}</span>
                                    <span className="flex items-center gap-2"><b className="tabular-nums text-gray-900">{Number(i.amount).toLocaleString()} {i.currency}</b>
                                        <button onClick={() => removeIncome(i)} aria-label="Remove income" className="rounded p-1 text-gray-400 hover:text-red-600"><X size={13} /></button></span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </Modal>
    );
}

function Innovations({ canManage, colleges }) {
    const { success, error } = useToast();
    const [rows, setRows] = useState(null);
    const [meta, setMeta] = useState({});
    const [stage, setStage] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null);
    const [removing, setRemoving] = useState(null);
    const [partnerships, setPartnerships] = useState([]);

    const load = useCallback(() => {
        api.get('/tech-transfer/innovations', { params: { stage: stage || undefined, search: search || undefined } })
            .then((r) => { setRows(r.data?.data ?? []); setMeta(r.data?.meta ?? {}); }).catch(() => setRows([]));
    }, [stage, search]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
    useEffect(() => { api.get('/tech-transfer/partnerships', { skipErrorToast: true }).then((r) => setPartnerships(r.data?.data ?? [])).catch(() => {}); }, []);

    const remove = async () => {
        try { await api.delete(`/tech-transfer/innovations/${removing.id}`); success('Deleted.'); load(); } catch { error('Could not delete it.'); }
        setRemoving(null);
    };
    const byStage = meta.by_stage ?? {};

    return (
        <div className="space-y-5">
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                <ol className="flex min-w-max items-stretch gap-1">
                    {STAGES.map((s, i) => (
                        <li key={s.key} className="flex items-center gap-1">
                            <button onClick={() => setStage(stage === s.key ? '' : s.key)} title={s.hint}
                                className={cn('w-32 rounded-xl px-3 py-2.5 text-left transition-colors', stage === s.key ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50')}>
                                <span className={cn('block text-2xl font-bold tabular-nums', stage === s.key ? 'text-white' : 'text-gray-900')}>{byStage[s.key] ?? 0}</span>
                                <span className={cn('block text-xs font-semibold', stage === s.key ? 'text-indigo-100' : 'text-gray-600')}>{s.label}</span>
                            </button>
                            {i < STAGES.length - 2 && <ChevronRight size={14} className="shrink-0 text-gray-300" />}
                            {i === STAGES.length - 2 && <span className="mx-1 h-8 w-px bg-gray-200" />}
                        </li>
                    ))}
                </ol>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row">
                    <label className="relative min-w-0 flex-1">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, reference or patent number…" className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                    </label>
                    {canManage && <button onClick={() => setEditing('new')} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={15} /> New disclosure</button>}
                </div>
                <StatCard icon={Banknote} label="Income from innovations" value={birr(meta.income_total)} hint={Object.entries(meta.income_by_year ?? {}).slice(-1).map(([y, v]) => `${y}: ${birr(v)}`).join('') || 'None recorded yet'} color="emerald" loading={rows === null} />
            </div>

            {rows === null ? <Skeleton className="h-48" /> : rows.length === 0 ? (
                <Panel bodyClassName="p-0"><EmptyState icon={Lightbulb} title="No innovations here" text="Record an invention when a researcher discloses it, then follow it through patenting to a licence or spin-off." /></Panel>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {rows.map((i) => (
                        <article key={i.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-gray-400">{i.reference} · {IP_TYPES[i.ip_type]}</p>
                                    <h3 className="mt-0.5 font-semibold leading-snug text-gray-900">{i.title}</h3>
                                </div>
                                <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{STAGES.find((s) => s.key === i.stage)?.label}</span>
                            </div>
                            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                {i.inventors?.length > 0 && <span>{i.inventors.join(', ')}</span>}
                                {i.college && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {i.college.name}</span>}
                                {i.filing_number && <span className="font-mono">{i.filing_number}</span>}
                                {i.proposal && <span className="inline-flex items-center gap-1"><FileText size={11} /> {i.proposal.tracker_number}</span>}
                                {(i.spin_off_name || i.licensee) && <span className="inline-flex items-center gap-1"><Globe2 size={11} /> {i.spin_off_name ?? i.licensee}</span>}
                            </p>
                            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                                <span className="text-xs text-gray-600">{i.income_total > 0 ? <>Income <b className="text-emerald-700">{birr(i.income_total)}</b></> : 'No income yet'}</span>
                                <span className="flex gap-1">
                                    {canManage && <button onClick={() => setEditing(i)} aria-label="Open" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><Pencil size={14} /></button>}
                                    {canManage && <button onClick={() => setRemoving(i)} aria-label="Delete" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}
                                </span>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {editing && <InnovationForm editing={editing === 'new' ? null : editing} colleges={colleges} partnerships={partnerships} onClose={() => { setEditing(null); load(); }} onSaved={(m) => { success(m ?? 'Saved.'); setEditing(null); load(); }} />}
            <ConfirmDialog open={!!removing} title="Delete this innovation?" description={`${removing?.reference ?? ''} and its income entries will be removed.`}
                confirmLabel="Delete" confirmVariant="danger" onConfirm={remove} onCancel={() => setRemoving(null)} />
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TechTransfer() {
    const { hasPermission } = useAuth();
    const tabs = [
        hasPermission('partnerships.view') && { key: 'partnerships', label: 'Partnerships & agreements', icon: Handshake },
        hasPermission('innovations.view') && { key: 'innovations', label: 'Innovations & IP', icon: Lightbulb },
    ].filter(Boolean);
    const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab'));
    const current = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key;
    const [colleges, setColleges] = useState([]);
    useEffect(() => { api.get('/colleges', { skipErrorToast: true }).then((r) => setColleges(r.data?.data?.data ?? r.data?.data ?? [])).catch(() => {}); }, []);

    const pick = (key) => {
        setTab(key);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', key);
        window.history.replaceState(window.history.state, '', url);
    };

    return (
        <AppLayout breadcrumb="Technology transfer">
            <div className="mx-auto max-w-7xl space-y-5">
                <PageHeader icon={Handshake} color="emerald" title="Technology transfer"
                    description="The agreements the university holds with partners, and every invention on its way from disclosure to use." />
                {tabs.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1" role="tablist">
                        {tabs.map((t) => (
                            <button key={t.key} role="tab" aria-selected={current === t.key} onClick={() => pick(t.key)}
                                className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold', current === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                                <t.icon size={14} /> {t.label}
                            </button>
                        ))}
                    </div>
                )}
                {current === 'partnerships' && <Partnerships canManage={hasPermission('partnerships.manage')} colleges={colleges} />}
                {current === 'innovations' && <Innovations canManage={hasPermission('innovations.manage')} colleges={colleges} />}
            </div>
        </AppLayout>
    );
}
