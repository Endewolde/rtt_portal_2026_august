import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    CheckCircle2, Clock, AlertCircle, Circle, Plus, X, Pencil, Trash2, Loader2, Calendar, ChevronDown,
    Milestone, Search, Target, CalendarClock, ListChecks, FolderOpen,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { PageHeader, StatCard, Panel, EmptyState, Select, RefreshButton, StatSkeletons, Skeleton } from '../../Components/Insights/Kit';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { get, post, put, del } from '../../lib/api';
import { formatDate, formatCurrency } from '../../lib/utils';
import { currency, term } from '../../lib/terms';
import ProposalHover from '../../Components/Finance/ProposalHover';
import DownloadMenu from '../../Components/Finance/DownloadMenu';
import ClearButton from '../../Components/Finance/ClearButton';
import { programmes, programmeLabel, programmeColor } from '../../lib/programmes';

const STATUS = {
    pending:     { label: 'Not started', icon: Circle,       cls: 'bg-gray-100 text-gray-600' },
    in_progress: { label: 'In progress', icon: Clock,        cls: 'bg-sky-50 text-sky-700' },
    completed:   { label: 'Done',        icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700' },
    overdue:     { label: 'Overdue',     icon: AlertCircle,  cls: 'bg-red-50 text-red-700' },
};

const EMPTY = { title: '', description: '', amount: '', due_date: '', status: 'pending' };
const today = () => new Date(new Date().toDateString());
const isDone = (m) => m.status === 'completed' || !!m.completed_at;
const statusOf = (m) => (isDone(m) ? 'completed' : m.due_date && new Date(m.due_date) < today() ? 'overdue' : m.status ?? 'pending');
const daysUntil = (d) => Math.round((new Date(d) - today()) / 86400000);
const dateInput = (d) => (d ? String(d).slice(0, 10) : '');

function MilestoneForm({ initial, project, onClose, onSaved }) {
    const { error } = useToast();
    const [form, setForm] = useState(initial ? { ...EMPTY, ...initial, amount: initial.amount ?? '', due_date: dateInput(initial.due_date), description: initial.description ?? '' } : EMPTY);
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm';

    const save = async () => {
        if (!form.title.trim()) return error('Give the milestone a title.');
        setSaving(true);
        const payload = { title: form.title.trim(), description: form.description || null, amount: form.amount === '' ? null : Number(form.amount), due_date: form.due_date || null, ...(initial?.id ? { status: form.status } : {}) };
        try {
            const r = initial?.id ? await put(`/proposals/${project.id}/milestones/${initial.id}`, payload) : await post(`/proposals/${project.id}/milestones`, payload);
            onSaved(r.data, !initial?.id);
        } catch (e) {
            error(e?.response?.data?.message ?? 'The milestone could not be saved.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><Milestone size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">{initial?.id ? 'Edit milestone' : 'New milestone'}</h2>
                            <p className="truncate text-xs text-gray-500">{project.tracker_number} · {project.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="space-y-4 px-6 py-5">
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
                        <input value={form.title} autoFocus onChange={(e) => set('title', e.target.value)} placeholder="e.g. Field data collected" className={inputCls} />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Budget ({currency()})</span>
                            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="Optional" className={`${inputCls} tabular-nums`} />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Due date</span>
                            <input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} className={inputCls} />
                        </label>
                    </div>
                    {initial?.id && (
                        <div>
                            <span className="mb-1 block text-sm font-medium text-gray-700">Status</span>
                            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
                                {['pending', 'in_progress', 'completed'].map((k) => (
                                    <button key={k} type="button" onClick={() => set('status', k)}
                                        className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${form.status === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                                        {STATUS[k].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
                        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional details" className={`${inputCls} resize-none`} />
                    </label>
                </div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        {saving && <Loader2 size={14} className="animate-spin" />} {initial?.id ? 'Save' : 'Add milestone'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MilestoneItem({ m, canEdit, busy, onToggle, onEdit, onDelete, last }) {
    const status = statusOf(m);
    const cfg = STATUS[status];
    const Icon = cfg.icon;
    const due = m.due_date && !isDone(m) ? daysUntil(m.due_date) : null;

    return (
        <li className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span className="absolute left-3.25 top-7 bottom-0 w-px bg-gray-200" />}
            <button onClick={onToggle} disabled={!canEdit || busy} aria-label={isDone(m) ? 'Mark as not done' : 'Mark as done'}
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    status === 'completed' ? 'border-emerald-500 bg-emerald-500 text-white'
                        : status === 'overdue' ? 'border-red-300 bg-red-50 text-red-500'
                        : 'border-gray-300 bg-white text-gray-300'} ${canEdit ? 'hover:border-emerald-400' : 'cursor-default'}`}>
                {busy ? <Loader2 size={12} className="animate-spin" /> : status === 'completed' ? <CheckCircle2 size={14} /> : <Icon size={12} />}
            </button>
            <div className={`min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 ${status === 'overdue' ? 'border-red-200 bg-red-50/40' : status === 'completed' ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className={`text-sm font-semibold ${status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{m.title}</p>
                        {m.description && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{m.description}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${cfg.cls}`}><Icon size={10} /> {cfg.label}</span>
                            {m.amount != null && m.amount !== '' && <span className="font-semibold tabular-nums text-gray-700">{formatCurrency(m.amount)}</span>}
                            {m.due_date && (
                                <span className={`inline-flex items-center gap-1 ${due !== null && due < 0 ? 'font-semibold text-red-600' : due !== null && due <= 14 ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
                                    <Calendar size={10} /> {formatDate(m.due_date)}
                                    {due !== null && (due < 0 ? ` · ${-due} day${due === -1 ? '' : 's'} late` : due === 0 ? ' · today' : due <= 14 ? ` · in ${due} day${due === 1 ? '' : 's'}` : '')}
                                </span>
                            )}
                            {m.completed_at && <span className="text-emerald-700">Done {formatDate(m.completed_at)}</span>}
                        </div>
                    </div>
                    {canEdit && (
                        <div className="flex shrink-0 items-center">
                            <button onClick={onEdit} aria-label={`Edit ${m.title}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={13} /></button>
                            <button onClick={onDelete} aria-label={`Delete ${m.title}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
}

function ProjectPanel({ project, canEdit, onChange, defaultOpen }) {
    const { success, error } = useToast();
    const [open, setOpen] = useState(defaultOpen);
    const [form, setForm] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(null);
    const list = project.budget_milestones ?? [];

    const done = list.filter(isDone).length;
    const overdue = list.filter((m) => statusOf(m) === 'overdue').length;
    const planned = list.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
    const reached = list.filter(isDone).reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
    const awarded = parseFloat(project.award?.awarded_amount ?? 0);
    const pct = list.length ? Math.round((done / list.length) * 100) : 0;
    const color = programmeColor(project.category);

    const replace = (next) => onChange(project.id, next);

    const toggle = async (m) => {
        setBusy(m.id);
        try {
            const r = await put(`/proposals/${project.id}/milestones/${m.id}`, { status: isDone(m) ? 'pending' : 'completed' });
            replace(list.map((x) => (x.id === m.id ? r.data : x)));
        } catch (e) { error(e?.response?.data?.message ?? 'The milestone could not be updated.'); }
        setBusy(null);
    };

    const remove = async () => {
        const m = deleting;
        setDeleting(null);
        try {
            await del(`/proposals/${project.id}/milestones/${m.id}`);
            replace(list.filter((x) => x.id !== m.id));
            success('Milestone deleted.');
        } catch { error('The milestone could not be deleted.'); }
    };

    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-stretch">
                <span className="w-1 shrink-0" style={{ backgroundColor: color }} />
                <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                    <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-gray-400 transition ${open ? '' : '-rotate-90'}`} />
                        <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-1.5">
                                <ProposalHover id={project.id} className="font-mono text-xs font-bold text-indigo-600">{project.tracker_number}</ProposalHover>
                                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>{programmeLabel(project.category)}</span>
                                {overdue > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{overdue} overdue</span>}
                            </span>
                            <span className="mt-0.5 block truncate text-sm font-semibold text-gray-900"><ProposalHover id={project.id}>{project.title}</ProposalHover></span>
                            <span className="block text-xs text-gray-500">{[project.pi?.name, project.college?.name].filter(Boolean).join(' · ')}</span>
                        </span>
                    </button>
                    <div className="flex items-center gap-4 pl-7 sm:pl-0">
                        <div className="w-36">
                            <div className="flex justify-between text-[11px] text-gray-500"><span>{done}/{list.length} done</span><span className="font-semibold text-gray-700">{pct}%</span></div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                        </div>
                        {canEdit && (
                            <button onClick={() => { setOpen(true); setForm({}); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                                <Plus size={12} /> Add
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {open && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
                    {(planned > 0 || awarded > 0) && (
                        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                            {awarded > 0 && <span>Awarded <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(awarded)}</span></span>}
                            {planned > 0 && <span>Planned in milestones <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(planned)}</span></span>}
                            {planned > 0 && <span>Reached <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(reached)}</span></span>}
                            {awarded > 0 && planned > awarded && <span className="font-semibold text-amber-700">Milestones add up to more than the award</span>}
                        </div>
                    )}
                    {list.length === 0 ? (
                        <div className="py-4 text-center">
                            <p className="text-sm text-gray-500">No milestones yet.</p>
                            {canEdit && <button onClick={() => setForm({})} className="mt-1 text-sm font-semibold text-indigo-600 hover:underline">Add the first one</button>}
                        </div>
                    ) : (
                        <ol>
                            {list.map((m, i) => (
                                <MilestoneItem key={m.id} m={m} canEdit={canEdit} busy={busy === m.id} last={i === list.length - 1}
                                    onToggle={() => toggle(m)} onEdit={() => setForm(m)} onDelete={() => setDeleting(m)} />
                            ))}
                        </ol>
                    )}
                    <div className="mt-3 text-right">
                        <Link href={`/proposals/${project.id}`} className="text-xs font-medium text-gray-500 hover:text-indigo-600">Open the project →</Link>
                    </div>
                </div>
            )}

            {form && (
                <MilestoneForm initial={form.id ? form : null} project={project} onClose={() => setForm(null)}
                    onSaved={(item, isNew) => {
                        replace(isNew ? [...list, item] : list.map((x) => (x.id === item.id ? item : x)));
                        setForm(null);
                        success(isNew ? 'Milestone added.' : 'Milestone updated.');
                    }} />
            )}
            {deleting && (
                <ConfirmDialog open title="Delete this milestone?" description={`“${deleting.title}” will be removed.`} confirmLabel="Delete" confirmVariant="danger"
                    onConfirm={remove} onCancel={() => setDeleting(null)} />
            )}
        </section>
    );
}

export default function BudgetMilestones() {
    const { hasPermission } = useAuth();
    const { error } = useToast();
    const canEdit = hasPermission('budget_milestones.update');

    const [projects, setProjects] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [programme, setProgramme] = useState('');
    const [show, setShow] = useState('all');
    const [college, setCollege] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await get('/budget-milestones');
            setProjects(r.data ?? []);
        } catch {
            setProjects([]);
            error('Could not load milestones.');
        }
        setLoading(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const update = (id, milestones) => setProjects((list) => list.map((p) => (p.id === id ? { ...p, budget_milestones: milestones } : p)));

    const all = projects ?? [];
    const milestones = all.flatMap((p) => (p.budget_milestones ?? []).map((m) => ({ ...m, project: p })));
    const doneCount = milestones.filter(isDone).length;
    const overdue = milestones.filter((m) => statusOf(m) === 'overdue');
    const upcoming = milestones.filter((m) => !isDone(m) && m.due_date && daysUntil(m.due_date) >= 0 && daysUntil(m.due_date) <= 30)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return all.filter((p) => {
            const list = p.budget_milestones ?? [];
            if (programme && p.category !== programme) return false;
            if (college && p.college_id !== college) return false;
            if (q && ![p.tracker_number, p.title, p.pi?.name, ...list.map((m) => m.title)].some((v) => v?.toLowerCase().includes(q))) return false;
            if (show === 'overdue') return list.some((m) => statusOf(m) === 'overdue');
            if (show === 'open') return list.some((m) => !isDone(m));
            if (show === 'none') return list.length === 0;
            return true;
        });
    }, [all, search, programme, show, college]);

    const colleges = [...new Map(all.filter((p) => p.college).map((p) => [p.college_id, p.college.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const filtersOn = !!(search || programme || college || show !== 'all');
    const clearFilters = () => { setSearch(''); setProgramme(''); setCollege(''); setShow('all'); };
    const exportRows = visible.flatMap((p) => ((p.budget_milestones ?? []).length ? p.budget_milestones : [null]).map((m) => ({ p, m })));
    const exportColumns = [
        { label: 'Tracker', value: (r) => r.p.tracker_number },
        { label: 'Project', value: (r) => r.p.title },
        { label: 'PI', value: (r) => r.p.pi?.name },
        { label: term('college'), value: (r) => r.p.college?.name },
        { label: 'Milestone', value: (r) => r.m?.title ?? '(none planned)' },
        { label: 'Status', value: (r) => (r.m ? STATUS[statusOf(r.m)].label : '') },
        { label: 'Due', value: (r) => (r.m?.due_date ? formatDate(r.m.due_date) : '') },
        { label: 'Done on', value: (r) => (r.m?.completed_at ? formatDate(r.m.completed_at) : '') },
        { label: 'Budget', value: (r) => (r.m?.amount != null && r.m?.amount !== '' ? parseFloat(r.m.amount) : '') },
    ];

    return (
        <AppLayout breadcrumb="Budget Milestones">
            <div className="mx-auto max-w-6xl space-y-5">
                <PageHeader icon={Milestone} color="violet" title="Budget Milestones"
                    description="The checkpoints each funded project works towards, and what is coming up next.">
                    <DownloadMenu filename="budget-milestones" title="Budget milestones" subtitle={`${visible.length} project${visible.length === 1 ? '' : 's'}`} columns={exportColumns} rows={exportRows} />
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {projects === null ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={FolderOpen} color="indigo" label="Projects" value={all.length} hint={`${all.filter((p) => !(p.budget_milestones ?? []).length).length} without milestones`} />
                        <StatCard icon={ListChecks} color="emerald" label="Milestones done" value={`${doneCount}/${milestones.length}`} hint={milestones.length ? `${Math.round((doneCount / milestones.length) * 100)}% complete` : 'None planned yet'} />
                        <StatCard icon={AlertCircle} color="red" label="Overdue" value={overdue.length} hint={overdue.length ? `Across ${new Set(overdue.map((m) => m.project.id)).size} project(s)` : 'Nothing late'} hintTone={overdue.length ? 'text-red-600 font-medium' : undefined} />
                        <StatCard icon={CalendarClock} color="amber" label="Due in 30 days" value={upcoming.length} hint={upcoming[0] ? `Next: ${formatDate(upcoming[0].due_date)}` : 'Nothing due soon'} />
                    </div>
                )}

                {upcoming.length > 0 && (
                    <Panel title="Coming up" subtitle="Open milestones due in the next 30 days" icon={Target} bodyClassName="p-0">
                        <ul className="divide-y divide-gray-100">
                            {upcoming.slice(0, 6).map((m) => {
                                const d = daysUntil(m.due_date);
                                return (
                                    <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                                        <span className={`flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-lg text-center ${d <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'}`}>
                                            <span className="text-sm font-bold leading-none">{d === 0 ? 'Today' : d}</span>
                                            {d !== 0 && <span className="text-[10px]">day{d === 1 ? '' : 's'}</span>}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-900">{m.title}</p>
                                            <p className="truncate text-xs text-gray-500"><ProposalHover id={m.project.id} className="font-mono font-semibold text-indigo-600">{m.project.tracker_number}</ProposalHover> · {m.project.title}</p>
                                        </div>
                                        {m.amount != null && <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-700">{formatCurrency(m.amount)}</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    </Panel>
                )}

                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 lg:flex-row">
                    <label className="relative min-w-0 flex-1">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects or milestones…"
                            className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 sm:text-sm" />
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Select label="Show" value={show} onChange={setShow} className="sm:w-48">
                            <option value="all">All projects</option>
                            <option value="open">With open milestones</option>
                            <option value="overdue">With overdue milestones</option>
                            <option value="none">Without milestones</option>
                        </Select>
                        {programmes({ includeInactive: true }).length > 1 && (
                            <Select label="Programme" value={programme} onChange={setProgramme} className="sm:w-44">
                                <option value="">All programmes</option>
                                {programmes({ includeInactive: true }).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                            </Select>
                        )}
                        {colleges.length > 1 && (
                            <Select label={term('college')} value={college} onChange={setCollege} className="sm:w-44">
                                <option value="">All {term('college', { plural: true, lower: true })}</option>
                                {colleges.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                            </Select>
                        )}
                        {filtersOn && <ClearButton onClick={clearFilters} />}
                    </div>
                </div>

                {projects === null ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
                ) : visible.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={Milestone} title={all.length ? 'Nothing matches' : 'No running projects yet'}
                            text={all.length ? 'Try another search or filter.' : 'Funded projects appear here so their milestones can be planned.'} />
                    </Panel>
                ) : (
                    <div className="space-y-3">
                        {visible.map((p) => (
                            <ProjectPanel key={p.id} project={p} canEdit={canEdit} onChange={update}
                                defaultOpen={visible.length <= 3 || (p.budget_milestones ?? []).some((m) => statusOf(m) === 'overdue')} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
