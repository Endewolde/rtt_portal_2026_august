import { useState, useEffect, useCallback } from 'react';
import { FlaskConical, Search, Plus, X, Loader2, MapPin, User, CalendarClock, Pencil, CheckCircle2, XCircle, Clock, Wrench } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, EmptyState, Skeleton } from '../../Components/Insights/Kit';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { cn } from '../../lib/utils';

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const when = (s, e) => {
    const a = new Date(s), b = new Date(e);
    const d = (x) => x.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const t = (x) => x.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return a.toDateString() === b.toDateString() ? `${d(a)}, ${t(a)}–${t(b)}` : `${d(a)} ${t(a)} – ${d(b)} ${t(b)}`;
};
const BOOKING = {
    pending: { label: 'Waiting', cls: 'bg-amber-50 text-amber-800', icon: Clock },
    approved: { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    rejected: { label: 'Declined', cls: 'bg-red-50 text-red-700', icon: XCircle },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500', icon: XCircle },
};

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

const Field = ({ label, hint, children }) => (
    <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-700">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}</label>
);

function BookDialog({ item, onClose, onDone }) {
    const { error } = useToast();
    const [f, setF] = useState({ starts_at: '', ends_at: '', purpose: '' });
    const [busy, setBusy] = useState(false);
    const send = async () => {
        setBusy(true);
        try {
            const r = await api.post(`/equipment/${item.id}/bookings`, f, { skipErrorToast: true });
            onDone(r.data?.message);
        } catch (e) {
            const errs = e.response?.data?.errors ?? {};
            error(Object.values(errs)[0]?.[0] ?? e.response?.data?.message ?? 'Could not book it.');
        }
        setBusy(false);
    };
    return (
        <Dialog title={`Book ${item.name}`} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={send} disabled={busy || !f.starts_at || !f.ends_at || !f.purpose.trim()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} {item.requires_approval ? 'Request' : 'Book'}</button>
            </>}>
            {item.upcoming?.length > 0 && (
                <div className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs text-gray-600">
                    <p className="mb-1 font-semibold text-gray-700">Already booked</p>
                    {item.upcoming.map((b) => <p key={b.id}>{when(b.starts_at, b.ends_at)}{b.status === 'pending' ? ' (requested)' : ''}</p>)}
                </div>
            )}
            <div className="grid grid-cols-2 gap-3">
                <Field label="From"><input type="datetime-local" value={f.starts_at} onChange={(e) => setF((x) => ({ ...x, starts_at: e.target.value }))} className={inputCls} /></Field>
                <Field label="Until"><input type="datetime-local" value={f.ends_at} onChange={(e) => setF((x) => ({ ...x, ends_at: e.target.value }))} className={inputCls} /></Field>
            </div>
            <Field label="What it is for" hint={item.max_booking_hours ? `At most ${item.max_booking_hours} hours per booking.` : null}><textarea rows={2} value={f.purpose} onChange={(e) => setF((x) => ({ ...x, purpose: e.target.value }))} className={inputCls} placeholder="e.g. Soil nutrient analysis for project WSU/R/2026/014" /></Field>
            {item.requires_approval && <p className="text-xs text-gray-500">{item.custodian ? `${item.custodian.name} confirms bookings of this equipment.` : 'The equipment manager confirms bookings.'}</p>}
        </Dialog>
    );
}

function EquipmentDialog({ item, colleges, onClose, onDone }) {
    const { error } = useToast();
    const [f, setF] = useState({ name: '', category: '', asset_tag: '', description: '', college_id: '', location: '', custodian_id: '', status: 'available', requires_approval: true, max_booking_hours: '',
        ...(item ? Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v ?? ''])) : {}), requires_approval: item ? !!item.requires_approval : true });
    const [custodianQ, setCustodianQ] = useState(item?.custodian?.name ?? '');
    const [hits, setHits] = useState([]);
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

    useEffect(() => {
        if (custodianQ.trim().length < 2 || custodianQ === item?.custodian?.name) { setHits([]); return undefined; }
        const t = setTimeout(() => api.get('/users', { params: { search: custodianQ, per_page: 6 }, skipErrorToast: true })
            .then((r) => { const d = r.data?.data; setHits(Array.isArray(d) ? d : (d?.data ?? [])); }).catch(() => setHits([])), 300);
        return () => clearTimeout(t);
    }, [custodianQ]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async () => {
        setBusy(true);
        const keys = ['name', 'category', 'asset_tag', 'description', 'college_id', 'location', 'custodian_id', 'status', 'requires_approval', 'max_booking_hours'];
        const payload = Object.fromEntries(keys.map((k) => [k, f[k] === '' ? null : f[k]]));
        try {
            const r = item ? await api.put(`/equipment/${item.id}`, payload) : await api.post('/equipment', payload);
            onDone(r.data?.message);
        } catch (e) { error(e.response?.data?.message ?? 'Could not save.'); }
        setBusy(false);
    };

    return (
        <Dialog title={item ? 'Edit equipment' : 'Add equipment'} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={save} disabled={busy || !f.name.trim()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
            </>}>
            <Field label="Name *"><input value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. Atomic absorption spectrophotometer" /></Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Category"><input value={f.category} onChange={(e) => set('category', e.target.value)} className={inputCls} placeholder="Laboratory" /></Field>
                <Field label="Asset tag"><input value={f.asset_tag} onChange={(e) => set('asset_tag', e.target.value)} className={inputCls} /></Field>
                <Field label="College"><select value={f.college_id} onChange={(e) => set('college_id', e.target.value)} className={inputCls}><option value="">—</option>{colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Location"><input value={f.location} onChange={(e) => set('location', e.target.value)} className={inputCls} placeholder="Block 12, Lab 3" /></Field>
                <Field label="Status"><select value={f.status} onChange={(e) => set('status', e.target.value)} className={inputCls}><option value="available">Available</option><option value="maintenance">Under maintenance</option><option value="retired">Retired</option></select></Field>
                <Field label="Longest booking (hours)"><input type="number" min="1" value={f.max_booking_hours} onChange={(e) => set('max_booking_hours', e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label="Custodian" hint="Confirms bookings and is emailed about requests.">
                <div className="relative">
                    <input value={custodianQ} onChange={(e) => { setCustodianQ(e.target.value); set('custodian_id', ''); }} className={inputCls} placeholder="Search people…" />
                    {hits.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                            {hits.map((u) => <button key={u.id} type="button" onClick={() => { set('custodian_id', u.id); setCustodianQ(u.name); setHits([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50">{u.name} <span className="text-xs text-gray-400">{u.email}</span></button>)}
                        </div>
                    )}
                </div>
            </Field>
            <Field label="Description and conditions of use"><textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} className={inputCls} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.requires_approval} onChange={(e) => set('requires_approval', e.target.checked)} className="rounded text-indigo-600" /> Bookings need the custodian's approval</label>
        </Dialog>
    );
}

export default function EquipmentPage() {
    const { success, error } = useToast();
    const [data, setData] = useState(null);
    const [search, setSearch] = useState('');
    const [booking, setBooking] = useState(null);
    const [editing, setEditing] = useState(null);
    const [colleges, setColleges] = useState([]);

    const load = useCallback(() => {
        api.get('/equipment', { params: { search: search || undefined } }).then((r) => setData(r.data?.data)).catch(() => setData(false));
    }, [search]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
    useEffect(() => { api.get('/colleges', { skipErrorToast: true }).then((r) => setColleges(r.data?.data?.data ?? r.data?.data ?? [])).catch(() => {}); }, []);

    const [declining, setDeclining] = useState(null);
    const [declineNote, setDeclineNote] = useState('');
    const decide = async (b, action, note = null) => {
        try { const r = await api.post(`/equipment-bookings/${b.id}/decide`, { action, decision_note: note }); success(r.data?.message); setDeclining(null); load(); } catch (e) { error(e.response?.data?.message ?? 'Could not save.'); }
    };
    const cancel = async (b) => {
        try { await api.post(`/equipment-bookings/${b.id}/cancel`); success('Booking cancelled.'); load(); } catch (e) { error(e.response?.data?.message ?? 'Could not cancel.'); }
    };

    return (
        <AppLayout breadcrumb="Research equipment">
            <div className="mx-auto max-w-7xl space-y-5">
                <PageHeader icon={FlaskConical} color="sky" title="Research equipment" description="What equipment the university has, where it is, who looks after it — and booking it for your work.">
                    {data?.can_manage && <button onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={15} /> Add equipment</button>}
                </PageHeader>

                {data?.to_approve?.length > 0 && (
                    <Panel title="Waiting for your approval" bodyClassName="p-0">
                        <ul className="divide-y divide-gray-100">
                            {data.to_approve.map((b) => (
                                <li key={b.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                                    <span className="min-w-0 flex-1 text-sm"><b className="text-gray-900">{b.equipment?.name}</b> · {b.user?.name}<span className="block text-xs text-gray-500">{when(b.starts_at, b.ends_at)} · {b.purpose}</span></span>
                                    <span className="flex gap-2">
                                        <button onClick={() => decide(b, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                                        <button onClick={() => { setDeclining(b); setDeclineNote(''); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Decline</button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}

                <label className="relative block">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment, category or location…" className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </label>

                {data === false ? <Panel bodyClassName="p-0"><EmptyState icon={FlaskConical} title="Could not load the equipment" /></Panel>
                    : !data ? <Skeleton className="h-64" />
                    : data.equipment.length === 0 ? <Panel bodyClassName="p-0"><EmptyState icon={FlaskConical} title="No equipment registered yet" text="Equipment managers add the university's research equipment here so researchers can find and book it." /></Panel>
                    : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {data.equipment.map((e) => (
                                <article key={e.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            {e.category && <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">{e.category}</p>}
                                            <h3 className="font-semibold leading-snug text-gray-900">{e.name}</h3>
                                        </div>
                                        {e.status === 'maintenance' && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"><Wrench size={11} /> Maintenance</span>}
                                    </div>
                                    <p className="mt-2 space-y-0.5 text-xs text-gray-500">
                                        {e.location && <span className="flex items-center gap-1"><MapPin size={11} /> {e.location}{e.college ? ` · ${e.college.name}` : ''}</span>}
                                        {e.custodian && <span className="flex items-center gap-1"><User size={11} /> {e.custodian.name}</span>}
                                        {e.upcoming?.length > 0 && <span className="flex items-center gap-1"><CalendarClock size={11} /> Next booked {when(e.upcoming[0].starts_at, e.upcoming[0].ends_at)}</span>}
                                    </p>
                                    {e.description && <p className="mt-2 line-clamp-2 text-xs text-gray-600">{e.description}</p>}
                                    <div className="mt-auto flex gap-2 pt-3">
                                        <button onClick={() => setBooking(e)} disabled={e.status !== 'available'} className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">Book</button>
                                        {data.can_manage && <button onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`} className="rounded-xl border border-gray-200 px-3 text-gray-500 hover:bg-gray-50"><Pencil size={14} /></button>}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                {data?.mine?.length > 0 && (
                    <Panel title="My bookings" bodyClassName="p-0">
                        <ul className="divide-y divide-gray-100">
                            {data.mine.map((b) => {
                                const st = BOOKING[b.status] ?? BOOKING.pending;
                                const live = ['pending', 'approved'].includes(b.status) && new Date(b.ends_at) > new Date();
                                return (
                                    <li key={b.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                                        <span className="min-w-0 flex-1 text-sm"><b className="text-gray-900">{b.equipment?.name}</b><span className="block text-xs text-gray-500">{when(b.starts_at, b.ends_at)}{b.decision_note ? ` · “${b.decision_note}”` : ''}</span></span>
                                        <span className="flex items-center gap-2">
                                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', st.cls)}><st.icon size={12} /> {st.label}</span>
                                            {live && <button onClick={() => cancel(b)} className="text-xs font-semibold text-gray-500 hover:text-red-600">Cancel</button>}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </Panel>
                )}
            </div>

            {declining && (
                <Dialog title="Decline this booking" onClose={() => setDeclining(null)}
                    footer={<>
                        <button onClick={() => setDeclining(null)} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button onClick={() => decide(declining, 'reject', declineNote)} disabled={!declineNote.trim()} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Decline and tell them</button>
                    </>}>
                    <p className="text-sm text-gray-600">{declining.user?.name} asked for {declining.equipment?.name}, {when(declining.starts_at, declining.ends_at)}.</p>
                    <Field label="Why it cannot be booked — they will see this"><textarea rows={3} value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} className={inputCls} placeholder="e.g. The instrument is being calibrated that week; any day after the 20th works." /></Field>
                </Dialog>
            )}
            {booking && <BookDialog item={booking} onClose={() => setBooking(null)} onDone={(m) => { success(m); setBooking(null); load(); }} />}
            {editing && <EquipmentDialog item={editing === 'new' ? null : editing} colleges={colleges} onClose={() => setEditing(null)} onDone={(m) => { success(m); setEditing(null); load(); }} />}
        </AppLayout>
    );
}
