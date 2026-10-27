import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    Trophy, RefreshCw, Download, ChevronDown, FileSignature, CheckCircle, Clock, AlertCircle, Search,
    Wallet, CalendarDays, Building2, ExternalLink, Receipt, X, Copy, Check, Send, Printer, Users, Layers,
    History, Banknote, Loader2, Square, CheckSquare, TrendingUp,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { programmes, programmeColor } from '../../lib/programmes';
import StatusBadge from '../../Components/StatusBadge';
import ViewToggle from '../../Components/ViewToggle';
import ContractReviewModal from '../../Components/ContractReviewModal';
import ProposalHover from '../../Components/Finance/ProposalHover';
import { PageHeader, StatCard, Panel, EmptyState, Select, RefreshButton, StatSkeletons, Skeleton, DataTable } from '../../Components/Insights/Kit';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { exportCsv } from '../../lib/exportTable';
import { useToast } from '../../Components/Toast';
import SavedViews, { readSharedView } from '../../Components/SavedViews';
import { formatDate, formatCurrency, getCategoryLabel, getStatusLabel } from '../../lib/utils';

const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];
const FILTERS_KEY = 'awarded_proposals_filters';

const categoryOptions = () => programmes({ includeInactive: true }).map((p) => ({ value: p.key, label: p.name }));

const amountOf = (p) => parseFloat(p.award?.awarded_amount ?? 0) || 0;

/** Saved filters, so the page opens as it was left. Never trusted blindly. */
function savedFilters() {
    try { return JSON.parse(localStorage.getItem(FILTERS_KEY) ?? 'null') ?? {}; } catch { return {}; }
}

/** The contract's state for a funded proposal: label, colours and icon. */
function contractState(p) {
    if (p.status !== 'funded') return null;
    if (p.contract_status === 'approved') return { key: 'approved', label: `Contract approved${p.contract_signed_at ? ` ${formatDate(p.contract_signed_at)}` : ''}`, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle };
    if (p.contract_status === 'pending') return { key: 'pending', label: 'Contract waiting for review', cls: 'bg-blue-50 text-blue-700 ring-blue-200', icon: Clock };
    if (p.contract_status === 'rejected') return { key: 'rejected', label: 'Contract returned to PI', cls: 'bg-red-50 text-red-700 ring-red-200', icon: AlertCircle };
    return { key: 'missing', label: 'Awaiting contract upload', cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: FileSignature };
}

const needsReminder = (p) => ['missing', 'rejected'].includes(contractState(p)?.key);

function timeAgo(date) {
    if (!date) return '';
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

function Initials({ name }) {
    const letters = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{letters}</span>;
}

/** A grant reference you can copy with one click. */
function GrantRef({ value, className = '' }) {
    const [copied, setCopied] = useState(false);
    if (!value) return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-500">No grant reference</span>;
    const copy = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* clipboard blocked */ }
    };
    return (
        <button onClick={copy} title={copied ? 'Copied' : 'Copy grant reference'}
            className={`group/ref inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100 ${className}`}>
            <Trophy size={11} /> {value}
            {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} className="opacity-40 group-hover/ref:opacity-100" />}
        </button>
    );
}

/** Paid out (and settled) against the award. */
function MoneyBar({ awarded, info, compact = false }) {
    if (!info) return null;
    const paidPct = awarded > 0 ? Math.min(100, (info.disbursed / awarded) * 100) : 0;
    const settledPct = awarded > 0 ? Math.min(paidPct, (info.settled / awarded) * 100) : 0;
    return (
        <div className={compact ? 'min-w-36' : ''}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-gray-700">{Math.round(paidPct)}% paid</span>
                <span className="truncate tabular-nums text-gray-400">{formatCurrency(info.disbursed)}{!compact && ` of ${formatCurrency(awarded)}`}</span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="absolute inset-y-0 left-0 rounded-full bg-sky-300" style={{ width: `${paidPct}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-sky-600" style={{ width: `${settledPct}%` }} />
            </div>
            {!compact && (
                <p className="mt-1 text-[10px] text-gray-400">
                    {info.payments} payment{info.payments === 1 ? '' : 's'} · {formatCurrency(info.settled)} settled · {formatCurrency(Math.max(0, awarded - info.disbursed))} still to pay
                </p>
            )}
        </div>
    );
}

/** From award to completion, with the dates each step happened. */
function Timeline({ steps }) {
    const lastDone = steps.reduce((i, s, n) => (s.at ? n : i), -1);
    return (
        <ol className="relative space-y-3 pl-5">
            <span className="absolute bottom-1 left-1.75 top-1 w-0.5 bg-gray-200" />
            {steps.map((s, i) => (
                <li key={s.key} className="relative flex items-center justify-between gap-3 text-xs">
                    <span className={`absolute -left-5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${s.at ? 'bg-emerald-500 text-white' : i === lastDone + 1 ? 'bg-amber-400' : 'bg-gray-200'}`}>
                        {s.at && <Check size={10} />}
                    </span>
                    <span className={s.at ? 'font-medium text-gray-800' : i === lastDone + 1 ? 'font-medium text-amber-700' : 'text-gray-400'}>{s.label}{!s.at && i === lastDone + 1 && ' · next'}</span>
                    <span className="tabular-nums text-gray-500">{s.at ? formatDate(s.at) : '—'}</span>
                </li>
            ))}
        </ol>
    );
}

/** CSV export: a programme director exports their own programme; others pick one or all. */
function ExportButton({ yearFilter, statusFilter }) {
    const { error, success } = useToast();
    const { accessScope } = useAuth();
    const [open, setOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const ref = useRef(null);

    const lockedCategory = accessScope.type === 'category' && accessScope.categories?.length === 1 ? accessScope.categories[0] : null;

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const doExport = async (category) => {
        setOpen(false);
        setExporting(true);
        try {
            const params = new URLSearchParams();
            if (category) params.set('category', category);
            if (yearFilter !== 'all') params.set('year', yearFilter);
            if (statusFilter !== 'all') params.set('status', statusFilter);

            const token = localStorage.getItem('rtt_token');
            const res = await fetch(`/api/v1/proposals/awarded/export?${params}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.message ?? 'Export failed.');
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const match = (res.headers.get('Content-Disposition') ?? '').match(/filename="([^"]+)"/);
            a.href = url;
            a.download = match?.[1] ?? 'awarded_proposals.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            success('Export downloaded.');
        } catch (e) {
            error(e.message ?? 'Export failed.');
        }
        setExporting(false);
    };

    const button = 'inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60';

    if (lockedCategory) {
        return (
            <button onClick={() => doExport(lockedCategory)} disabled={exporting} className={button}>
                {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
        );
    }

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen((o) => !o)} disabled={exporting} className={button} aria-expanded={open}>
                {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                {exporting ? 'Exporting…' : 'Export CSV'}
                {!exporting && <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />}
            </button>
            {open && (
                <div className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                    <button onClick={() => doExport(null)} className="w-full px-4 py-2.5 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50">All programmes</button>
                    <div className="my-1 border-t border-gray-100" />
                    {categoryOptions().map((c) => (
                        <button key={c.value} onClick={() => doExport(c.value)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: programmeColor(c.value) }} /> {c.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Awards per college or programme: count and money, click a row to filter. */
function Breakdown({ rows, by, onBy, selected, onSelect }) {
    const max = Math.max(1, ...rows.map((r) => r.total));
    return (
        <Panel title="Where the awards went" subtitle="Click a row to show only those." icon={by === 'college' ? Building2 : Layers}
            actions={(
                <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                    {[['college', 'College'], ['programme', 'Programme']].map(([k, l]) => (
                        <button key={k} onClick={() => onBy(k)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${by === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{l}</button>
                    ))}
                </div>
            )}>
            <ul className="space-y-2.5">
                {rows.slice(0, 8).map((r) => (
                    <li key={r.key}>
                        <button onClick={() => onSelect(selected === r.key ? '' : r.key)} className="group w-full text-left">
                            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                <span className={`flex min-w-0 items-center gap-1.5 ${selected === r.key ? 'font-semibold text-indigo-700' : 'text-gray-700 group-hover:text-gray-900'}`}>
                                    {r.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />}
                                    <span className="truncate">{r.label}</span>
                                </span>
                                <span className="shrink-0 tabular-nums text-gray-500"><b className="text-gray-900">{r.count}</b> · {formatCurrency(r.total)}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                <div className={`h-full rounded-full transition-all ${selected === r.key ? 'bg-indigo-600' : 'bg-amber-400 group-hover:bg-amber-500'}`}
                                    style={{ width: `${(r.total / max) * 100}%`, ...(r.color && selected !== r.key ? { backgroundColor: r.color } : {}) }} />
                            </div>
                        </button>
                    </li>
                ))}
                {rows.length > 8 && <li className="text-[11px] text-gray-400">+{rows.length - 8} more</li>}
            </ul>
        </Panel>
    );
}

/**
 * Spend per call: awarded, paid and settled against the call's budget, the pace of
 * payments and where it leads in a year, plus idle and fast-spending projects.
 */
function CallSpend({ year }) {
    const [rows, setRows] = useState(null);
    useEffect(() => {
        setRows(null);
        api.get('/proposals/awarded/burn', { params: year !== 'all' ? { year } : {} })
            .then((r) => setRows(r.data?.data ?? []))
            .catch(() => setRows([]));
    }, [year]);

    if (rows === null) return <Skeleton className="h-40 rounded-2xl" />;
    if (!rows.length) return null;

    return (
        <Panel title="Spend and forecast by call" subtitle="Paid out so far, the monthly pace, and where that pace leads a year after the first award." icon={TrendingUp} bodyClassName="divide-y divide-gray-100">
            {rows.map((r) => {
                const base = Math.max(r.budget ?? 0, r.awarded, 1);
                const pct = (v) => `${Math.min(100, (v / base) * 100)}%`;
                const forecastPct = r.awarded > 0 ? Math.round((r.projected_12m / r.awarded) * 100) : 0;
                return (
                    <div key={r.call_id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">{r.title}</p>
                                <p className="text-[11px] text-gray-500">{r.academic_year} · {r.projects} project{r.projects === 1 ? '' : 's'} · {r.months} month{r.months === 1 ? '' : 's'} since the first award</p>
                            </div>
                            <div className="text-right text-xs">
                                <p className="font-semibold tabular-nums text-gray-900">{formatCurrency(r.paid)} <span className="font-normal text-gray-400">paid of {formatCurrency(r.awarded)}</span></p>
                                {r.budget != null && <p className="text-[11px] tabular-nums text-gray-400">Call budget {formatCurrency(r.budget)}</p>}
                            </div>
                        </div>
                        <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-gray-100" title="Grey: awarded · light blue: paid · dark blue: settled · dashed: forecast">
                            <div className="absolute inset-y-0 left-0 rounded-full bg-gray-300" style={{ width: pct(r.awarded) }} />
                            <div className="absolute inset-y-0 left-0 rounded-full border-r-2 border-dashed border-sky-700 bg-transparent" style={{ width: pct(r.projected_12m) }} />
                            <div className="absolute inset-y-0 left-0 rounded-full bg-sky-300" style={{ width: pct(r.paid) }} />
                            <div className="absolute inset-y-0 left-0 rounded-full bg-sky-600" style={{ width: pct(r.settled) }} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-600">
                            <span><b className="tabular-nums text-gray-900">{formatCurrency(r.monthly_pace)}</b> a month</span>
                            <span className={forecastPct < 60 ? 'font-medium text-amber-700' : ''}>At this pace: <b className="tabular-nums">{formatCurrency(r.projected_12m)}</b> ({forecastPct}% of awarded) within a year</span>
                            <span>{formatCurrency(r.settled)} settled</span>
                        </div>
                        {(r.idle.length > 0 || r.fast.length > 0) && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {r.idle.map((x) => (
                                    <Link key={x.id} href={`/proposals/${x.id}`} title="Contract in for over 60 days, nothing paid yet"
                                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">
                                        <Clock size={10} /> Idle · {x.tracker_number}
                                    </Link>
                                ))}
                                {r.fast.map((x) => (
                                    <Link key={x.id} href={`/proposals/${x.id}`} title="Over 80% paid before the midterm"
                                        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">
                                        <TrendingUp size={10} /> Fast · {x.tracker_number}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </Panel>
    );
}

function AwardCard({ p, info, selected, onToggle, onReviewContract, onRemind, canRemind, reminding }) {
    const [showTimeline, setShowTimeline] = useState(false);
    const contract = contractState(p);
    const color = programmeColor(p.category);
    const others = info?.other_running_awards ?? [];

    return (
        <article className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-gray-300'}`}>
            <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
            <div className="flex-1 p-5 pl-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button onClick={() => onToggle(p.id)} aria-label={selected ? 'Deselect' : 'Select'} className={`shrink-0 transition ${selected ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-500'}`}>
                            {selected ? <CheckSquare size={17} /> : <Square size={17} />}
                        </button>
                        <GrantRef value={p.award?.grant_reference} />
                    </div>
                    <span className="shrink-0 rounded-lg bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-gray-200">{p.academic_year}</span>
                </div>

                <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900">
                    <ProposalHover id={p.id}><Link href={`/proposals/${p.id}`} className="hover:text-indigo-700">{p.title}</Link></ProposalHover>
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] font-semibold text-gray-500">{p.tracker_number}</span>
                    <StatusBadge status={p.status} />
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>{getCategoryLabel(p.category)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
                    {p.pi?.name && <span className="inline-flex items-center gap-1.5 font-medium text-gray-700"><Initials name={p.pi.name} /> {p.pi.name}</span>}
                    {p.college?.name && <span className="inline-flex items-center gap-1"><Building2 size={12} className="text-gray-400" /> {p.college.name}</span>}
                </div>
                {others.length > 0 && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200" title={others.join(', ')}>
                        <Users size={12} /> PI also holds {others.length} other running award{others.length === 1 ? '' : 's'}: {others.slice(0, 2).join(', ')}{others.length > 2 ? '…' : ''}
                    </p>
                )}

                <div className="mt-4 rounded-xl bg-emerald-50/60 px-4 py-3 ring-1 ring-emerald-100">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Awarded</p>
                            <p className="text-xl font-bold tabular-nums text-emerald-800">{p.award ? formatCurrency(p.award.awarded_amount) : '—'}</p>
                        </div>
                        {p.award?.approved_at && <p className="text-right text-[11px] text-emerald-700/80">on {formatDate(p.award.approved_at)}</p>}
                    </div>
                    {info && <div className="mt-2.5 border-t border-emerald-100 pt-2.5"><MoneyBar awarded={amountOf(p)} info={info} /></div>}
                </div>

                {contract && (
                    <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ring-1 ${contract.cls}`}>
                        <span className="inline-flex items-center gap-1.5 font-medium">
                            <contract.icon size={13} /> {contract.label}
                            {info?.contract_waiting_days != null && <span className="font-semibold">· {info.contract_waiting_days} days</span>}
                        </span>
                        {contract.key === 'pending' && (
                            <button onClick={() => onReviewContract(p)} className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700">Review</button>
                        )}
                        {needsReminder(p) && canRemind && (
                            <button onClick={() => onRemind([p.id])} disabled={reminding} title={info?.last_reminded_at ? `Last reminded ${timeAgo(info.last_reminded_at)}` : 'Email the PI a reminder'}
                                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-50">
                                {reminding ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Remind PI
                            </button>
                        )}
                        {info?.last_reminded_at && <span className="w-full text-[10px] opacity-80">Last reminded {timeAgo(info.last_reminded_at)}</span>}
                    </div>
                )}

                {showTimeline && info && <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4"><Timeline steps={info.timeline} /></div>}
            </div>

            <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 pl-5">
                <Link href={`/proposals/${p.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white">Proposal <ExternalLink size={11} /></Link>
                {p.award && <Link href={`/proposals/${p.id}/award`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-white"><Trophy size={12} /> Award</Link>}
                <Link href={`/budget-requests?proposal_id=${p.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-white"><Receipt size={12} /> Budget</Link>
                {info && (
                    <button onClick={() => setShowTimeline((v) => !v)} aria-expanded={showTimeline}
                        className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${showTimeline ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-white'}`}>
                        <History size={12} /> Timeline
                    </button>
                )}
            </div>
        </article>
    );
}

export default function AwardedProposals() {
    const { error, success } = useToast();
    const { hasPermission } = useAuth();
    const canRemind = hasPermission('contracts.review');
    // A shared link (?view=…) wins over what this browser remembered.
    const saved = useRef(readSharedView() ?? savedFilters()).current;
    const [view, setView] = useViewPreference('awarded_proposals', 'card');
    const [contractProposal, setContractProposal] = useState(null);
    const [proposals, setProposals] = useState(null);
    const [insights, setInsights] = useState({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState(saved.status ?? 'all');
    const [yearFilter, setYearFilter] = useState(saved.year ?? 'all');
    const [programme, setProgramme] = useState(saved.programme ?? '');
    const [college, setCollege] = useState(saved.college ?? '');
    const [contractFilter, setContractFilter] = useState(saved.contract ?? '');
    const [sort, setSort] = useState(saved.sort ?? 'newest');
    const [breakdownBy, setBreakdownBy] = useState(saved.breakdownBy ?? 'college');
    const [search, setSearch] = useState(saved.search ?? '');
    const [selected, setSelected] = useState(() => new Set());
    const [reminding, setReminding] = useState(false);
    const [printing, setPrinting] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [results, info] = await Promise.all([
                Promise.all(FUNDED_STATUSES.map((s) =>
                    api.get('/proposals', { params: { status: s, per_page: 200, with_award: 1 } })
                        .then((r) => r.data?.data?.data ?? r.data?.data ?? [])
                        .catch(() => []))),
                api.get('/proposals/awarded/insights').then((r) => r.data?.data ?? {}).catch(() => ({})),
            ]);
            setProposals(results.flat().map((p) => ({ ...p, award: p.award ?? null })));
            setInsights(info);
        } catch {
            setProposals((v) => v ?? []);
            error('Failed to load awarded proposals.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Remember the filters for the next visit (search stays fresh each time).
    useEffect(() => {
        try {
            localStorage.setItem(FILTERS_KEY, JSON.stringify({ status: statusFilter, year: yearFilter, programme, college, contract: contractFilter, sort, breakdownBy }));
        } catch { /* storage unavailable */ }
    }, [statusFilter, yearFilter, programme, college, contractFilter, sort, breakdownBy]);

    const all = proposals ?? [];
    const academicYears = useMemo(() => [...new Set(all.map((p) => p.academic_year).filter(Boolean))].sort().reverse(), [all]);
    const usedProgrammes = [...new Set(all.map((p) => p.category).filter(Boolean))];
    const colleges = [...new Map(all.filter((p) => p.college).map((p) => [p.college.id ?? p.college_id, p.college])).entries()]
        .map(([id, c]) => ({ id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
    const inYear = all.filter((p) => yearFilter === 'all' || p.academic_year === yearFilter);

    // Open on the latest year once the list arrives (unless a saved year still exists).
    const yearChosen = useRef(false);
    useEffect(() => {
        if (yearChosen.current || !academicYears.length) return;
        yearChosen.current = true;
        if (saved.year && (saved.year === 'all' || academicYears.includes(saved.year))) return;
        setYearFilter(academicYears.length > 1 ? academicYears[0] : 'all');
    }, [academicYears]); // eslint-disable-line react-hooks/exhaustive-deps

    const collegeKey = (p) => p.college?.id ?? p.college_id ?? '';

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = inYear.filter((p) => (statusFilter === 'all' || p.status === statusFilter)
            && (!programme || p.category === programme)
            && (!college || collegeKey(p) === college)
            && (!contractFilter || contractState(p)?.key === contractFilter)
            && (!q || [p.title, p.tracker_number, p.pi?.name, p.award?.grant_reference, p.college?.name].some((v) => v?.toLowerCase().includes(q))));
        const by = {
            newest: (a, b) => new Date(b.award?.approved_at ?? 0) - new Date(a.award?.approved_at ?? 0),
            oldest: (a, b) => new Date(a.award?.approved_at ?? 0) - new Date(b.award?.approved_at ?? 0),
            amount: (a, b) => amountOf(b) - amountOf(a),
            title: (a, b) => (a.title ?? '').localeCompare(b.title ?? ''),
            unpaid: (a, b) => (amountOf(b) - (insights[b.id]?.disbursed ?? 0)) - (amountOf(a) - (insights[a.id]?.disbursed ?? 0)),
        };
        return [...list].sort(by[sort] ?? by.newest);
    }, [inYear, statusFilter, programme, college, contractFilter, search, sort, insights]); // eslint-disable-line react-hooks/exhaustive-deps

    const totalAwarded = inYear.reduce((s, p) => s + amountOf(p), 0);
    const totalPaid = inYear.reduce((s, p) => s + (insights[p.id]?.disbursed ?? 0), 0);
    const contractsPending = inYear.filter((p) => contractState(p)?.key === 'pending').length;
    const contractsMissing = inYear.filter(needsReminder).length;
    const doubleFunded = inYear.filter((p) => (insights[p.id]?.other_running_awards ?? []).length > 0).length;
    const filtersOn = !!(search || programme || college || contractFilter || statusFilter !== 'all');
    const clearFilters = () => { setSearch(''); setProgramme(''); setCollege(''); setContractFilter(''); setStatusFilter('all'); };
    const currentView = { status: statusFilter, year: yearFilter, programme, college, contract: contractFilter, sort, search };
    const applyView = (v) => {
        setStatusFilter(v.status ?? 'all'); setYearFilter(v.year ?? 'all'); setProgramme(v.programme ?? '');
        setCollege(v.college ?? ''); setContractFilter(v.contract ?? ''); setSort(v.sort ?? 'newest'); setSearch(v.search ?? '');
    };

    const breakdownRows = useMemo(() => {
        const groups = new Map();
        inYear.forEach((p) => {
            const key = breakdownBy === 'college' ? collegeKey(p) : p.category;
            if (!key) return;
            const g = groups.get(key) ?? {
                key,
                label: breakdownBy === 'college' ? (p.college?.name ?? '—') : getCategoryLabel(p.category),
                color: breakdownBy === 'programme' ? programmeColor(p.category) : null,
                count: 0, total: 0,
            };
            g.count += 1;
            g.total += amountOf(p);
            groups.set(key, g);
        });
        return [...groups.values()].sort((a, b) => b.total - a.total);
    }, [inYear, breakdownBy]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Selection and bulk actions ──
    const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
    const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((p) => p.id)));
    const chosen = all.filter((p) => selected.has(p.id));
    const chosenNeedingReminder = chosen.filter(needsReminder);

    const remind = async (ids) => {
        setReminding(true);
        try {
            const r = await api.post('/proposals/awarded/remind-contracts', { proposal_ids: ids });
            success(r.data?.message ?? 'Reminders sent.');
            const info = await api.get('/proposals/awarded/insights').then((res) => res.data?.data ?? {}).catch(() => null);
            if (info) setInsights(info);
        } catch (e) {
            error(e.response?.data?.message ?? 'The reminders could not be sent.');
        }
        setReminding(false);
    };

    const printRegister = async (ids = null) => {
        setPrinting(true);
        const params = new URLSearchParams();
        if (yearFilter !== 'all') params.set('year', yearFilter);
        (ids ?? []).forEach((id) => params.append('ids[]', id));
        try {
            await downloadFile(`/proposals/awarded/register?${params}`, `award-register${yearFilter !== 'all' ? `-${yearFilter}` : ''}.pdf`);
        } catch {
            error('The award register could not be generated.');
        }
        setPrinting(false);
    };

    const exportSelected = () => exportCsv({
        filename: 'awarded-proposals-selected.csv',
        rows: chosen,
        columns: [
            { label: 'Grant reference', value: (p) => p.award?.grant_reference },
            { label: 'Tracker', value: (p) => p.tracker_number },
            { label: 'Title', value: (p) => p.title },
            { label: 'PI', value: (p) => p.pi?.name },
            { label: 'College', value: (p) => p.college?.name },
            { label: 'Programme', value: (p) => getCategoryLabel(p.category) },
            { label: 'Academic year', value: (p) => p.academic_year },
            { label: 'Status', value: (p) => getStatusLabel(p.status) },
            { label: 'Awarded', value: (p) => amountOf(p) },
            { label: 'Paid out', value: (p) => insights[p.id]?.disbursed ?? 0 },
            { label: 'Settled', value: (p) => insights[p.id]?.settled ?? 0 },
            { label: 'Contract', value: (p) => contractState(p)?.label ?? '' },
            { label: 'Awarded on', value: (p) => (p.award?.approved_at ? formatDate(p.award.approved_at) : '') },
        ],
    });

    const columns = [
        { key: 'p', label: 'Proposal', render: (p) => (
            <div className="flex min-w-0 items-start gap-2.5">
            <button onClick={() => toggle(p.id)} aria-label={selected.has(p.id) ? 'Deselect' : 'Select'} className={`mt-0.5 shrink-0 ${selected.has(p.id) ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-500'}`}>
                {selected.has(p.id) ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: programmeColor(p.category) }} title={getCategoryLabel(p.category)} />
                    <ProposalHover id={p.id} className="font-mono text-xs font-bold text-indigo-600">{p.tracker_number}</ProposalHover>
                    {p.award?.grant_reference && <GrantRef value={p.award.grant_reference} className="py-0.5!" />}
                    {(insights[p.id]?.other_running_awards ?? []).length > 0 && <Users size={12} className="text-violet-500" title="PI holds other running awards" />}
                </div>
                <p className="max-w-80 truncate text-sm font-medium text-gray-900">{p.title}</p>
                <p className="max-w-80 truncate text-[11px] text-gray-500">{[p.pi?.name, p.college?.name, p.academic_year].filter(Boolean).join(' · ')}</p>
            </div>
            </div>
        ) },
        { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
        { key: 'contract', label: 'Contract', render: (p) => {
            const c = contractState(p);
            const days = insights[p.id]?.contract_waiting_days;
            return c ? (
                <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${c.cls}`}>
                    <c.icon size={11} /> {c.key === 'approved' ? 'Approved' : c.key === 'pending' ? 'To review' : c.key === 'rejected' ? 'Returned' : 'Not uploaded'}{days != null ? ` · ${days}d` : ''}
                </span>
            ) : <span className="text-xs text-gray-300">—</span>;
        } },
        { key: 'money', label: 'Paid out', render: (p) => <MoneyBar awarded={amountOf(p)} info={insights[p.id]} compact /> },
        { key: 'awarded', label: 'Awarded', align: 'right', render: (p) => (
            <div>
                <p className="font-semibold text-gray-900">{p.award ? formatCurrency(p.award.awarded_amount) : '—'}</p>
                {p.award?.approved_at && <p className="text-[11px] text-gray-400">{formatDate(p.award.approved_at)}</p>}
            </div>
        ) },
        { key: 'act', label: '', align: 'right', render: (p) => (
            <div className="flex justify-end gap-1.5">
                {contractState(p)?.key === 'pending' && (
                    <button onClick={() => setContractProposal(p)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">Review</button>
                )}
                {needsReminder(p) && canRemind && (
                    <button onClick={() => remind([p.id])} disabled={reminding} className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">Remind</button>
                )}
                {p.award && <Link href={`/proposals/${p.id}/award`} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Award</Link>}
            </div>
        ) },
    ];

    return (
        <AppLayout breadcrumb="Awarded Proposals">
            <div className="mx-auto max-w-6xl space-y-5 pb-20">
                <PageHeader icon={Trophy} color="amber" title="Awarded Proposals"
                    description="Every funded proposal with its grant reference, money, contract and progress — from funding to archive.">
                    <SavedViews storageKey="saved_views_awarded" current={currentView} onApply={applyView} />
                    <ViewToggle view={view} onChange={setView} />
                    <button onClick={() => printRegister()} disabled={printing || !inYear.length}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} <span className="hidden sm:inline">Register (PDF)</span>
                    </button>
                    <ExportButton yearFilter={yearFilter} statusFilter={statusFilter} />
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {/* ── Overview ─────────────────────────────────────────── */}
                {proposals === null ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={Trophy} color="amber" label="Awarded proposals" value={inYear.length}
                            hint={doubleFunded ? `${doubleFunded} PI${doubleFunded === 1 ? '' : 's'} hold more than one running award` : `${inYear.filter((p) => ['funded', 'midterm_evaluation'].includes(p.status)).length} still running`}
                            hintTone={doubleFunded ? 'font-medium text-violet-600' : undefined} />
                        <StatCard icon={Wallet} color="emerald" label="Total awarded" value={formatCurrency(totalAwarded)} hint={inYear.length ? `Average ${formatCurrency(totalAwarded / inYear.length)}` : '—'} />
                        <StatCard icon={Banknote} color="sky" label="Paid out so far" value={formatCurrency(totalPaid)}
                            hint={totalAwarded ? `${Math.round((totalPaid / totalAwarded) * 100)}% of awarded · ${formatCurrency(Math.max(0, totalAwarded - totalPaid))} to pay` : '—'} />
                        <button onClick={() => setContractFilter((f) => (f === 'pending' ? '' : 'pending'))} className="text-left">
                            <StatCard icon={FileSignature} color={contractsPending ? 'violet' : 'slate'} label="Contracts to review" value={contractsPending}
                                hint={contractsMissing ? `${contractsMissing} not uploaded or returned` : contractFilter === 'pending' ? 'Showing these — click to clear' : 'Click to show them'}
                                hintTone={contractsMissing ? 'font-medium text-amber-600' : undefined} />
                        </button>
                    </div>
                )}

                {/* ── Contracts waiting on PIs ─────────────────────────── */}
                {canRemind && contractsMissing > 0 && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"><FileSignature size={17} /></span>
                            <div>
                                <p className="text-sm font-semibold text-amber-900">{contractsMissing} funded project{contractsMissing === 1 ? ' is' : 's are'} waiting for a signed contract</p>
                                <p className="text-xs text-amber-800">No money can be paid until the contract is in. The longest has waited {Math.max(...inYear.filter(needsReminder).map((p) => insights[p.id]?.contract_waiting_days ?? 0))} days.</p>
                            </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <button onClick={() => setContractFilter('missing')} className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50">Show them</button>
                            <button onClick={() => remind(inYear.filter(needsReminder).map((p) => p.id))} disabled={reminding}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50">
                                {reminding ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Remind all {contractsMissing}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Where the awards went ────────────────────────────── */}
                {proposals !== null && breakdownRows.length > 1 && (
                    <Breakdown rows={breakdownRows} by={breakdownBy} onBy={setBreakdownBy}
                        selected={breakdownBy === 'college' ? college : programme}
                        onSelect={breakdownBy === 'college' ? setCollege : setProgramme} />
                )}

                {proposals !== null && all.length > 0 && <CallSpend year={yearFilter} />}

                {/* ── Toolbar ──────────────────────────────────────────── */}
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                    {academicYears.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500"><CalendarDays size={13} /> Academic year</span>
                            {academicYears.length <= 5 ? (
                                <div role="tablist" className="inline-flex rounded-xl bg-gray-100 p-1">
                                    {['all', ...academicYears].map((y) => (
                                        <button key={y} role="tab" aria-selected={yearFilter === y} onClick={() => setYearFilter(y)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${yearFilter === y ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                            {y === 'all' ? 'All years' : y}
                                            {y === academicYears[0] && <span className="ml-1 font-normal text-gray-400">· latest</span>}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <Select label="Academic year" value={yearFilter} onChange={setYearFilter} className="sm:w-48">
                                    <option value="all">All years</option>
                                    {academicYears.map((y, i) => <option key={y} value={y}>{i === 0 ? `${y} · latest` : y}</option>)}
                                </Select>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-2 lg:flex-row">
                        <label className="relative min-w-0 flex-1">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, tracker, grant reference, PI or college…"
                                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            {colleges.length > 1 && (
                                <Select label="College" value={college} onChange={setCollege} className="sm:w-44">
                                    <option value="">All colleges</option>
                                    {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            )}
                            {usedProgrammes.length > 1 && (
                                <Select label="Programme" value={programme} onChange={setProgramme} className="sm:w-40">
                                    <option value="">All programmes</option>
                                    {usedProgrammes.map((k) => <option key={k} value={k}>{getCategoryLabel(k)}</option>)}
                                </Select>
                            )}
                            <Select label="Contract" value={contractFilter} onChange={setContractFilter} className="sm:w-40">
                                <option value="">Any contract</option>
                                <option value="pending">Waiting for review</option>
                                <option value="missing">Not uploaded</option>
                                <option value="rejected">Returned to PI</option>
                                <option value="approved">Approved</option>
                            </Select>
                            <Select label="Sort" value={sort} onChange={setSort} className="sm:w-40">
                                <option value="newest">Newest award</option>
                                <option value="oldest">Oldest award</option>
                                <option value="amount">Largest award</option>
                                <option value="unpaid">Most still to pay</option>
                                <option value="title">Title A–Z</option>
                            </Select>
                        </div>
                    </div>
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
                        {['all', ...FUNDED_STATUSES].map((val) => {
                            const cnt = val === 'all' ? inYear.length : inYear.filter((p) => p.status === val).length;
                            const active = statusFilter === val;
                            return (
                                <button key={val} onClick={() => setStatusFilter(val)}
                                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    {val === 'all' ? 'All statuses' : getStatusLabel(val)}
                                    <span className={`rounded-full px-1.5 tabular-nums ${active ? 'bg-white/20' : 'bg-white text-gray-500'}`}>{cnt}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-3">
                        {visible.length > 0 && (
                            <button onClick={toggleAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900">
                                {allVisibleSelected ? <CheckSquare size={15} className="text-indigo-600" /> : <Square size={15} />} Select all
                            </button>
                        )}
                        <p className="text-sm text-gray-600">
                            <b className="text-gray-900">{visible.length}</b> proposal{visible.length === 1 ? '' : 's'}
                            <span className="text-gray-400"> · {formatCurrency(visible.reduce((s, p) => s + amountOf(p), 0))} awarded</span>
                        </p>
                    </div>
                    {filtersOn && (
                        <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"><X size={12} /> Clear filters</button>
                    )}
                </div>

                {/* ── List ─────────────────────────────────────────────── */}
                {proposals === null || (loading && !all.length) ? (
                    <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
                ) : visible.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={Trophy} title={all.length ? 'Nothing matches' : 'No awarded proposals yet'}
                            text={all.length ? 'Try another search or filter.' : 'Proposals appear here once they are funded in Central Evaluation.'}>
                            {filtersOn && <button onClick={clearFilters} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">Clear filters</button>}
                        </EmptyState>
                    </Panel>
                ) : view === 'table' ? (
                    <Panel bodyClassName="p-0"><DataTable columns={columns} rows={visible} rowKey={(p) => p.id} minWidth={1040} /></Panel>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {visible.map((p) => (
                            <AwardCard key={p.id} p={p} info={insights[p.id]} selected={selected.has(p.id)} onToggle={toggle}
                                onReviewContract={setContractProposal} onRemind={remind} canRemind={canRemind} reminding={reminding} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Bulk actions ─────────────────────────────────────────── */}
            {selected.size > 0 && (
                <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-2xl ring-1 ring-black/10">
                        <span className="pr-2 text-sm font-semibold">{selected.size} selected</span>
                        <button onClick={exportSelected} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><Download size={13} /> CSV</button>
                        <button onClick={() => printRegister([...selected])} disabled={printing} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"><Printer size={13} /> Register PDF</button>
                        {canRemind && (
                            <button onClick={() => remind(chosenNeedingReminder.map((p) => p.id))} disabled={reminding || !chosenNeedingReminder.length}
                                title={chosenNeedingReminder.length ? '' : 'None of the selected is missing a contract'}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-40">
                                <Send size={13} /> Remind {chosenNeedingReminder.length || ''} PI{chosenNeedingReminder.length === 1 ? '' : 's'}
                            </button>
                        )}
                        <button onClick={() => setSelected(new Set())} aria-label="Clear selection" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><X size={15} /></button>
                    </div>
                </div>
            )}

            {contractProposal && (
                <ContractReviewModal
                    proposal={contractProposal}
                    onClose={() => setContractProposal(null)}
                    onDone={() => {
                        setContractProposal(null);
                        load();
                    }}
                />
            )}
        </AppLayout>
    );
}
