import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import {
    Clock, CheckCircle2, XCircle, Inbox, Search, ChevronDown, Hourglass, User, CalendarDays, Building2, ArrowRight, Percent,
} from 'lucide-react';
import AppLayout from '../Layouts/AppLayout';
import { PageHeader, StatCard, Panel, EmptyState, Select, RefreshButton, StatSkeletons, Skeleton } from './Insights/Kit';
import ProposalHover from './Finance/ProposalHover';
import DownloadMenu from './Finance/DownloadMenu';
import ClearButton from './Finance/ClearButton';
import { useToast } from './Toast';
import { get } from '../lib/api';
import { formatDate } from '../lib/utils';
import { term } from '../lib/terms';
import { programmeLabel, programmeColor } from '../lib/programmes';

const STATUS = {
    pending:  { label: 'Waiting',  icon: Clock,        chip: 'bg-amber-50 text-amber-700 ring-amber-200',       bar: 'bg-amber-400',   tile: 'bg-amber-50 text-amber-600' },
    approved: { label: 'Approved', icon: CheckCircle2, chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', tile: 'bg-emerald-50 text-emerald-600' },
    denied:   { label: 'Denied',   icon: XCircle,      chip: 'bg-red-50 text-red-700 ring-red-200',             bar: 'bg-red-400',     tile: 'bg-red-50 text-red-600' },
};

export const daysSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);

/** The coloured "waiting N days" chip: calm for a few days, amber after a week, red after two. */
export function WaitingChip({ since }) {
    const d = daysSince(since);
    const cls = d > 14 ? 'bg-red-50 text-red-700' : d > 7 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600';
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}><Hourglass size={10} /> {d === 0 ? 'Today' : `${d} day${d === 1 ? '' : 's'}`}</span>;
}

export function Quote({ label, children, tone = 'slate' }) {
    const tones = {
        slate: 'border-slate-200 bg-slate-50 text-slate-700',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        red: 'border-red-200 bg-red-50 text-red-900',
        amber: 'border-amber-200 bg-amber-50 text-amber-900',
    };
    return (
        <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
            <div className="whitespace-pre-line text-sm leading-relaxed">{children}</div>
        </div>
    );
}

function ItemCard({ item, config, onReview }) {
    const [open, setOpen] = useState(false);
    const s = STATUS[item.status] ?? STATUS.pending;
    const p = item.proposal ?? {};
    const color = programmeColor(p.category);
    const person = config.person(item);

    return (
        <article className={`overflow-hidden rounded-2xl border bg-white transition hover:shadow-md ${item.status === 'pending' ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className="flex items-stretch">
                <span className={`w-1 shrink-0 ${s.bar}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex ${s.tile}`}><s.icon size={18} /></span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <ProposalHover id={item.proposal_id}>
                                <Link href={`/proposals/${item.proposal_id}`} className="font-mono text-xs font-bold text-indigo-600">{p.tracker_number}</Link>
                            </ProposalHover>
                            {p.category && <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>{programmeLabel(p.category)}</span>}
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.chip}`}><s.icon size={10} /> {config.statusLabels?.[item.status] ?? s.label}</span>
                            {item.status === 'pending' && <WaitingChip since={item.created_at} />}
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900"><ProposalHover id={item.proposal_id}>{p.title}</ProposalHover></p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            {person && <span className="inline-flex items-center gap-1"><User size={11} /> {person}</span>}
                            {p.college?.name && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {p.college.name}</span>}
                            <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {formatDate(item.created_at)}</span>
                            {item.resolved_by?.name && <span>Decided by {item.resolved_by.name}{item.resolved_at ? `, ${formatDate(item.resolved_at)}` : ''}</span>}
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                        {config.highlight?.(item)}
                        <div className="flex items-center gap-1.5">
                            {item.status === 'pending' && (
                                <button onClick={onReview} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800">
                                    Decide <ArrowRight size={13} />
                                </button>
                            )}
                            <button onClick={() => setOpen((v) => !v)} aria-label={open ? 'Hide details' : 'Show details'} aria-expanded={open}
                                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                                <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {open && <div className="space-y-3 border-t border-gray-100 bg-gray-50/50 px-5 py-4">{config.detail(item)}</div>}
        </article>
    );
}

/**
 * The shared page for requests an officer decides — appeals, deadline extensions,
 * no-cost extensions: a waiting queue first, figures, filters, downloads, and a
 * card per request whose details open in place.
 */
export default function ReviewQueue({ config }) {
    const { error } = useToast();
    const [items, setItems] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending');
    const [search, setSearch] = useState('');
    const [programme, setProgramme] = useState('');
    const [college, setCollege] = useState('');
    const [sort, setSort] = useState('oldest');
    const [reviewing, setReviewing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await get(config.endpoint);
            setItems(Array.isArray(r.data) ? r.data : (r.data?.data ?? []));
        } catch (e) {
            setItems((v) => v ?? []);
            error(e.response?.data?.message ?? `Could not load ${config.noun}s.`);
        }
        setLoading(false);
    }, [config.endpoint]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const all = items ?? [];
    const colleges = [...new Map(all.filter((i) => i.proposal?.college).map((i) => [i.proposal.college_id, i.proposal.college.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const usedProgrammes = [...new Set(all.map((i) => i.proposal?.category).filter(Boolean))];

    const scoped = useMemo(() => {
        const q = search.trim().toLowerCase();
        return all.filter((i) => (!programme || i.proposal?.category === programme)
            && (!college || i.proposal?.college_id === college)
            && (!q || [i.proposal?.tracker_number, i.proposal?.title, config.person(i), i.reason].some((v) => v?.toLowerCase().includes(q))));
    }, [all, search, programme, college]); // eslint-disable-line react-hooks/exhaustive-deps

    const counts = { pending: 0, approved: 0, denied: 0 };
    scoped.forEach((i) => { counts[i.status] = (counts[i.status] ?? 0) + 1; });

    const visible = useMemo(() => {
        const list = scoped.filter((i) => tab === 'all' || i.status === tab);
        const time = (i) => new Date(i.created_at ?? 0).getTime();
        return [...list].sort((a, b) => (sort === 'oldest' ? time(a) - time(b) : time(b) - time(a)));
    }, [scoped, tab, sort]);

    const pending = scoped.filter((i) => i.status === 'pending');
    const oldest = pending.reduce((m, i) => Math.max(m, daysSince(i.created_at)), 0);
    const decided = counts.approved + counts.denied;
    const filtersOn = !!(search || programme || college);
    const clear = () => { setSearch(''); setProgramme(''); setCollege(''); };

    const tabs = [
        { key: 'pending', label: 'Waiting', count: counts.pending },
        { key: 'approved', label: config.statusLabels?.approved ?? 'Approved', count: counts.approved },
        { key: 'denied', label: config.statusLabels?.denied ?? 'Denied', count: counts.denied },
        { key: 'all', label: 'All', count: scoped.length },
    ];

    const exportColumns = [
        { label: 'Tracker', value: (i) => i.proposal?.tracker_number },
        { label: 'Title', value: (i) => i.proposal?.title },
        { label: 'Programme', value: (i) => programmeLabel(i.proposal?.category) },
        { label: term('college'), value: (i) => i.proposal?.college?.name },
        { label: config.personLabel, value: (i) => config.person(i) },
        { label: 'Submitted', value: (i) => (i.created_at ? formatDate(i.created_at) : '') },
        ...config.exportExtra,
        { label: 'Reason', value: (i) => i.reason },
        { label: 'Status', value: (i) => config.statusLabels?.[i.status] ?? STATUS[i.status]?.label ?? i.status },
        { label: 'Decided by', value: (i) => i.resolved_by?.name },
        { label: 'Decided on', value: (i) => (i.resolved_at ? formatDate(i.resolved_at) : '') },
        { label: 'Decision notes', value: (i) => i.resolution_notes },
    ];

    const Modal = config.Modal;

    return (
        <AppLayout breadcrumb={config.title}>
            <div className="mx-auto max-w-6xl space-y-5">
                <PageHeader icon={config.icon} color={config.color} title={config.title} description={config.description}>
                    <DownloadMenu filename={config.filename} title={config.title} subtitle={tabs.find((t) => t.key === tab)?.label} columns={exportColumns} rows={visible} />
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {items === null ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={Inbox} color="amber" label="Waiting for a decision" value={counts.pending}
                            hint={counts.pending ? `Oldest waiting ${oldest} day${oldest === 1 ? '' : 's'}` : 'Nothing waiting'} hintTone={oldest > 14 ? 'text-red-600 font-medium' : undefined} />
                        <StatCard icon={CheckCircle2} color="emerald" label={config.statusLabels?.approved ?? 'Approved'} value={counts.approved} hint="All time, in your area" />
                        <StatCard icon={XCircle} color="red" label={config.statusLabels?.denied ?? 'Denied'} value={counts.denied} hint="All time, in your area" />
                        <StatCard icon={Percent} color="indigo" label="Approval rate" value={decided ? `${Math.round((counts.approved / decided) * 100)}%` : '—'} hint={`${decided} decided`} />
                    </div>
                )}

                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex flex-col gap-2 lg:flex-row">
                        <label className="relative min-w-0 flex-1">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search tracker, title, ${config.personLabel.toLowerCase()} or reason…`}
                                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            {usedProgrammes.length > 1 && (
                                <Select label="Programme" value={programme} onChange={setProgramme} className="sm:w-44">
                                    <option value="">All programmes</option>
                                    {usedProgrammes.map((k) => <option key={k} value={k}>{programmeLabel(k)}</option>)}
                                </Select>
                            )}
                            {colleges.length > 1 && (
                                <Select label={term('college')} value={college} onChange={setCollege} className="sm:w-44">
                                    <option value="">All {term('college', { plural: true, lower: true })}</option>
                                    {colleges.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                                </Select>
                            )}
                            <Select label="Sort" value={sort} onChange={setSort} className="sm:w-40">
                                <option value="oldest">Oldest first</option>
                                <option value="newest">Newest first</option>
                            </Select>
                            {filtersOn && <ClearButton onClick={clear} />}
                        </div>
                    </div>
                    <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
                        {tabs.map((t) => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                {t.label}
                                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === t.key ? 'bg-white/20' : t.key === 'pending' && t.count ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {items === null ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
                ) : visible.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={tab === 'pending' ? CheckCircle2 : config.icon}
                            title={filtersOn ? 'Nothing matches' : tab === 'pending' ? 'All caught up' : `No ${(tabs.find((t) => t.key === tab)?.label ?? '').toLowerCase()} ${config.noun}s`}
                            text={filtersOn ? 'Try another search or filter.' : tab === 'pending' ? `No ${config.noun} is waiting for a decision.` : config.emptyText} />
                    </Panel>
                ) : (
                    <div className="space-y-3">
                        {visible.map((i) => <ItemCard key={i.id} item={i} config={config} onReview={() => setReviewing(i)} />)}
                    </div>
                )}
            </div>

            {reviewing && <Modal item={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); load(); }} />}
        </AppLayout>
    );
}

/** The decision sheet shared by the three pages: context on top, the choice, then notes. */
export function DecisionSheet({ icon: Icon, title, subtitle, children, footer, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Icon size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                            {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><XCircle size={18} /></button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>
            </div>
        </div>
    );
}

/** Approve / deny toggle. */
export function DecisionToggle({ value, onChange, approveLabel, denyLabel }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {[['approved', approveLabel, CheckCircle2, 'bg-emerald-600 border-emerald-600 shadow-emerald-100'], ['denied', denyLabel, XCircle, 'bg-red-600 border-red-600 shadow-red-100']].map(([key, label, Icon, on]) => (
                <button key={key} type="button" onClick={() => onChange(key)}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition ${value === key ? `${on} text-white shadow-lg` : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                    <Icon size={15} /> {label}
                </button>
            ))}
        </div>
    );
}
