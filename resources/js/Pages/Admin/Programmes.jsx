import { useCallback, useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Layers, Plus, Pencil, Trash2, Loader2, X, Power, ShieldCheck, Hash, AlertTriangle } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { PageHeader, Panel, EmptyState } from '../../Components/Insights/Kit';
import { get, post, put, del } from '../../lib/api';
import { setProgrammes } from '../../lib/programmes';
import { useToast } from '../../Components/Toast';

const SWATCHES = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

const prefixFrom = (name) => (name.match(/[A-Za-z]+/g) ?? []).map((w) => w[0]).join('').toUpperCase().slice(0, 4).padEnd(3, 'X').slice(0, 6);

function ProgrammeDialog({ programme, onClose, onSaved }) {
    const { error } = useToast();
    const editing = !!programme;
    const [form, setForm] = useState({
        name: programme?.name ?? '',
        tracker_prefix: programme?.tracker_prefix ?? '',
        description: programme?.description ?? '',
        color: programme?.color ?? SWATCHES[3],
        is_active: programme?.is_active ?? true,
    });
    const [prefixTouched, setPrefixTouched] = useState(editing);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const setName = (name) => setForm((f) => ({ ...f, name, ...(prefixTouched ? {} : { tracker_prefix: name ? prefixFrom(name) : '' }) }));

    const save = async () => {
        setSaving(true);
        setErrors({});
        try {
            const r = editing ? await put(`/programmes/${programme.id}`, form) : await post('/programmes', form);
            onSaved(r.message);
        } catch (e) {
            const errs = e.response?.data?.errors ?? {};
            setErrors(errs);
            if (!Object.keys(errs).length) error(e.response?.data?.message ?? 'The programme could not be saved.');
        }
        setSaving(false);
    };

    const field = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm';
    const fieldError = (key) => errors[key] && <p className="mt-1 text-xs text-red-600">{[errors[key]].flat()[0]}</p>;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: form.color }}><Layers size={17} /></span>
                        <h2 className="text-lg font-bold text-gray-900">{editing ? `Edit ${programme.name}` : 'New programme'}</h2>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="space-y-4 px-6 py-5">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Name</label>
                        <input value={form.name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Postgraduate Research" className={field} autoFocus />
                        {fieldError('name')}
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Tracker number prefix</label>
                        <input value={form.tracker_prefix} maxLength={6}
                            onChange={(e) => { setPrefixTouched(true); set('tracker_prefix', e.target.value.toUpperCase().replace(/[^A-Z]/g, '')); }}
                            className={`${field} font-mono uppercase`} />
                        <p className="mt-1 text-xs text-gray-500">2–6 capital letters. New proposals are numbered like <span className="font-mono">{form.tracker_prefix || 'XXX'}-2026-0001</span>.</p>
                        {fieldError('tracker_prefix')}
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Description <span className="font-normal text-gray-400">(optional)</span></label>
                        <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} className={`${field} resize-none`} />
                        {fieldError('description')}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Colour</label>
                        <div className="flex flex-wrap items-center gap-2">
                            {SWATCHES.map((c) => (
                                <button key={c} type="button" onClick={() => set('color', c)} aria-label={`Colour ${c}`}
                                    className={`h-8 w-8 rounded-full ring-offset-2 transition ${form.color.toLowerCase() === c ? 'ring-2 ring-gray-900' : 'hover:scale-110'}`}
                                    style={{ backgroundColor: c }} />
                            ))}
                            <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} aria-label="Custom colour"
                                className="h-8 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5" />
                        </div>
                        {fieldError('color')}
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                        <span>
                            <span className="block text-sm font-medium text-gray-800">Open for new proposals and calls</span>
                            <span className="block text-xs text-gray-500">Switched-off programmes keep their past proposals but can't be chosen for new ones.</span>
                        </span>
                    </label>
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving || !form.name.trim() || form.tracker_prefix.length < 2}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        {saving && <Loader2 size={14} className="animate-spin" />} {editing ? 'Save changes' : 'Add programme'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Programmes() {
    const { success, error } = useToast();
    const [rows, setRows] = useState(null);
    const [editing, setEditing] = useState(null);
    const [removing, setRemoving] = useState(null);

    const load = useCallback(async () => {
        try {
            const r = await get('/programmes');
            setRows(r.data ?? []);
            setProgrammes(r.data ?? []);
        } catch (e) {
            setRows([]);
            error(e.response?.data?.message ?? 'Could not load the programmes.');
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const saved = (message) => {
        setEditing(null);
        success(message || 'Saved.');
        load();
    };

    const toggle = async (p) => {
        try {
            await put(`/programmes/${p.id}`, { is_active: !p.is_active });
            success(p.is_active ? `${p.name} switched off.` : `${p.name} switched on.`);
            load();
        } catch (e) {
            error(e.response?.data?.message ?? 'The programme could not be changed.');
        }
    };

    const remove = async () => {
        const p = removing;
        setRemoving(null);
        try {
            const r = await del(`/programmes/${p.id}`);
            success(r.message || 'Programme removed.');
            load();
        } catch (e) {
            error(e.response?.data?.message ?? 'The programme could not be removed.');
        }
    };

    return (
        <AppLayout breadcrumb="Programmes">
            <div className="mx-auto max-w-5xl space-y-6">
                <PageHeader icon={Layers} color="indigo" title="Programmes"
                    description="The funding streams proposals and calls belong to. Each has its own tracker prefix, colour and director.">
                    <button onClick={() => setEditing({})}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                        <Plus size={15} /> New programme
                    </button>
                </PageHeader>

                <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-indigo-500" />
                    <p>
                        A programme's director is any role scoped to it. Create or edit one on the{' '}
                        <Link href="/admin/roles" className="font-semibold underline underline-offset-2">Roles page</Link>{' '}
                        and set its scope to the programme; that role then approves, reviews deadlines and gets notified for its proposals.
                    </p>
                </div>

                <Panel title="All programmes" subtitle={rows ? `${rows.length} programme${rows.length === 1 ? '' : 's'}` : undefined} icon={Layers} bodyClassName="p-0">
                    {rows === null ? (
                        <div className="divide-y divide-gray-100">
                            {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse bg-gray-50/60" />)}
                        </div>
                    ) : rows.length === 0 ? (
                        <EmptyState icon={Layers} title="No programmes yet" text="Add the first funding programme to start accepting proposals." />
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {rows.map((p) => (
                                <li key={p.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${p.is_active ? '' : 'bg-gray-50/70'}`}>
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: p.color }}>
                                            <Layers size={18} />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className={`font-semibold ${p.is_active ? 'text-gray-900' : 'text-gray-500'}`}>{p.name}</p>
                                                <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-600">
                                                    <Hash size={10} />{p.tracker_prefix}
                                                </span>
                                                {!p.is_active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Switched off</span>}
                                            </div>
                                            {p.description && <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>}
                                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                                <span>{p.proposals} proposal{p.proposals === 1 ? '' : 's'}</span>
                                                {p.director_roles?.length ? (
                                                    <span className="inline-flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> {p.director_roles.map((r) => r.replace(/_/g, ' ')).join(', ')}</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={12} /> No director role yet</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5 sm:justify-end">
                                        <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                            <Pencil size={12} /> Edit
                                        </button>
                                        <button onClick={() => toggle(p)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                            <Power size={12} /> {p.is_active ? 'Switch off' : 'Switch on'}
                                        </button>
                                        {p.proposals === 0 && (
                                            <button onClick={() => setRemoving(p)} aria-label={`Remove ${p.name}`} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            {editing && <ProgrammeDialog programme={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={saved} />}

            <ConfirmDialog open={!!removing} onCancel={() => setRemoving(null)} onConfirm={remove}
                title={`Remove ${removing?.name ?? 'programme'}?`}
                description="It isn't used by any proposal or call, so it can be removed safely."
                confirmLabel="Remove" confirmVariant="danger" />
        </AppLayout>
    );
}
