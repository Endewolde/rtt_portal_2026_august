import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    ClipboardList, CheckCircle, XCircle, TrendingUp, TrendingDown, ChevronDown, AlertTriangle,
    Trophy, Wallet, Gauge, ListOrdered, Building2, EyeOff, Presentation,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import { PageHeader, Panel, EmptyState, Select, RefreshButton, Skeleton, DataTable } from '../../Components/Insights/Kit';
import StageFilters from '../../Components/Review/StageFilters';
import DownloadMenu from '../../Components/Finance/DownloadMenu';
import ProposalHover from '../../Components/Finance/ProposalHover';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatCurrency } from '../../lib/utils';
import { programmeLabel, programmeColor } from '../../lib/programmes';
import RejectWithReasonModal from '../../Components/RejectWithReasonModal';
import ApproveFundingModal from '../../Components/ApproveFundingModal';
import FundingRound from '../../Components/FundingRound';
import ProposalInsights from '../../Components/CentralEvaluation/ProposalInsights';
import { currency, term } from '../../lib/terms';

const totalMaxOf = (p) => p.total_max ?? ((p.blind_max ?? 0) + (p.defence_max ?? 0));
const passes = (p) => (p.combined_score ?? 0) >= (p.threshold ?? 0);
const pct = (score, max) => (max > 0 ? Math.min(100, (score / max) * 100) : 0);

/** One score as a bar with the pass mark drawn on it. */
function ScoreBar({ icon: Icon, label, score, max, mark, tone }) {
    const tones = { indigo: 'bg-indigo-500', violet: 'bg-violet-500', ok: 'bg-emerald-500', bad: 'bg-red-500' };
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 text-gray-500"><Icon size={11} /> {label}</span>
                <span className="font-semibold tabular-nums text-gray-900">{score ?? '—'}{max ? <span className="font-normal text-gray-400"> / {max}</span> : null}</span>
            </div>
            <div className="relative h-2 rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${pct(score ?? 0, max)}%` }} />
                {mark != null && max > 0 && <span className="absolute -top-1 h-4 w-0.5 rounded bg-gray-700" style={{ left: `${pct(mark, max)}%` }} title={`Pass mark ${mark}`} />}
            </div>
        </div>
    );
}

/** The combined score as a ring, green when it clears the pass mark. */
function ScoreRing({ score, max, ok, size = 64 }) {
    const share = max > 0 ? Math.max(0, Math.min(1, (score ?? 0) / max)) : 0;
    const r = 26;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }} title={`${score ?? '—'} of ${max} points`}>
            <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                <circle cx="32" cy="32" r={r} fill="none" stroke="#eef0f3" strokeWidth="6" />
                <circle cx="32" cy="32" r={r} fill="none" stroke={ok ? '#059669' : '#dc2626'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${share * c} ${c}`} />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-sm font-bold tabular-nums text-gray-900">{Math.round(share * 100)}%</span>
                <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400">score</span>
            </span>
        </div>
    );
}

const MEDAL = ['from-amber-400 to-yellow-500', 'from-slate-300 to-slate-400', 'from-orange-400 to-amber-600'];

/** The rank, gold / silver / bronze for the top three. */
function RankBadge({ rank, className = '' }) {
    const medal = MEDAL[rank - 1];
    return (
        <span title="Rank by combined score"
            className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-bold ${medal ? `bg-linear-to-br ${medal} text-white shadow-sm` : 'bg-gray-100 text-gray-600'} ${className}`}>
            #{rank}
        </span>
    );
}

function Initials({ name }) {
    const letters = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{letters}</span>;
}

function ProposalCard({ p, rank, onApprove, onReject }) {
    const [open, setOpen] = useState(false);
    const max = totalMaxOf(p);
    const ok = passes(p);
    const color = programmeColor(p.category);
    const budget = p.call_budget?.budget != null ? p.call_budget : null;
    const noMoney = budget && budget.remaining < 0.005;

    return (
        <article className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md">
            <div className="flex items-stretch">
                <span className="w-1 shrink-0" style={{ backgroundColor: color }} />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start">
                        {/* Who and what */}
                        <div className="flex min-w-0 flex-1 gap-4">
                            <div className="flex flex-col items-center gap-2">
                                <RankBadge rank={rank} />
                                <ScoreRing score={p.combined_score} max={max} ok={ok} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <ProposalHover id={p.id}><Link href={`/proposals/${p.id}`} className="font-mono text-xs font-bold text-indigo-600 hover:underline">{p.tracker_number}</Link></ProposalHover>
                                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>{programmeLabel(p.category)}</span>
                                    {p.skips_defence && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">No defence (call route)</span>}
                                    {p.defence_below_threshold && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200"><AlertTriangle size={10} /> Defence below its mark</span>}
                                </div>
                                <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900"><ProposalHover id={p.id}>{p.title}</ProposalHover></h3>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
                                    {p.pi?.name && <span className="inline-flex items-center gap-1.5 font-medium text-gray-700"><Initials name={p.pi.name} /> {p.pi.name}</span>}
                                    {p.college?.name && <span className="inline-flex items-center gap-1"><Building2 size={12} className="text-gray-400" /> {p.college.name}</span>}
                                    {p.proposal_call?.title && <span className="inline-flex min-w-0 items-center gap-1"><ClipboardList size={12} className="shrink-0 text-gray-400" /> <span className="truncate">{p.proposal_call.title}</span></span>}
                                </div>

                                <div className="mt-4 grid gap-x-5 gap-y-3 rounded-xl bg-gray-50/80 p-3 sm:grid-cols-3">
                                    <ScoreBar icon={EyeOff} label={`Blind · ${p.blind_reviewers ?? 0} reviewers`} score={p.blind_score_raw ?? p.blind_score} max={p.blind_max ?? 0} tone="indigo" />
                                    {p.skips_defence
                                        ? <div className="flex items-center text-[11px] text-gray-500">This call has no open defence.</div>
                                        : <ScoreBar icon={Presentation} label={`Defence · ${p.defence_reviewers ?? 0} panel`} score={p.defence_score_raw ?? p.defence_score} max={p.defence_max ?? 0} mark={p.defence_threshold} tone="violet" />}
                                    <ScoreBar icon={Gauge} label="Combined" score={p.combined_score} max={max} mark={p.threshold} tone={ok ? 'ok' : 'bad'} />
                                </div>
                            </div>
                        </div>

                        {/* The numbers that matter for the decision */}
                        <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-52 lg:grid-cols-1">
                            <div className={`rounded-xl px-4 py-3 ring-1 ${ok ? 'bg-emerald-50/70 ring-emerald-100' : 'bg-red-50/70 ring-red-100'}`}>
                                <p className={`flex items-center gap-1 text-[11px] font-semibold ${ok ? 'text-emerald-700' : 'text-red-700'}`}>{ok ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {ok ? 'Clears the pass mark' : 'Below the pass mark'}</p>
                                <p className={`mt-0.5 text-2xl font-bold tabular-nums ${ok ? 'text-emerald-800' : 'text-red-800'}`}>{p.combined_score}<span className="text-sm font-normal opacity-60"> / {max}</span></p>
                                <p className="text-[11px] text-gray-500">Pass mark {p.threshold}</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
                                <p className="flex items-center gap-1 text-[11px] font-semibold text-gray-500"><Wallet size={12} /> Requested</p>
                                <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">{formatCurrency(p.budget_total)}</p>
                                {budget && (
                                    <p className={`mt-1 text-[11px] ${noMoney ? 'font-semibold text-red-600' : budget.remaining < (p.budget_total ?? 0) ? 'font-medium text-amber-700' : 'text-gray-500'}`}>
                                        {noMoney ? 'Insufficient budget — fully used' : `${formatCurrency(budget.remaining)} left in budget`}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {p.defence_below_threshold && (
                        <p className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                            The defence score ({p.defence_score_raw}/{p.defence_max}) is under its own mark ({p.defence_threshold}). The combined score still cleared, so it is your call.
                        </p>
                    )}

                    {open && <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-4"><ProposalInsights proposalId={p.id} piId={p.pi?.id} piName={p.pi?.name} requested={p.budget_total} /></div>}

                    <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-3 sm:flex-row sm:items-center">
                        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${open ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} /> {open ? 'Hide the evidence' : 'Budget · PI history · Reviewer comments'}
                        </button>
                        <div className="flex gap-2 sm:ml-auto">
                            <button onClick={onReject} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:flex-none">
                                <XCircle size={15} /> Reject
                            </button>
                            <button onClick={onApprove} disabled={noMoney} title={noMoney ? 'Insufficient budget: this budget is fully used' : undefined}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 hover:shadow disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 sm:flex-none">
                                <CheckCircle size={15} /> {noMoney ? 'Insufficient budget' : 'Approve for funding'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

/** The page's overview: how many wait, how many clear the mark, the money asked and the flags. */
function Overview({ visible, total, requested, avg, flagged }) {
    const clearing = visible.filter(passes).length;
    const below = visible.length - clearing;
    const byProgramme = Object.entries(visible.reduce((m, p) => ({ ...m, [p.category]: (m[p.category] ?? 0) + 1 }), {}));

    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="grid divide-y divide-gray-100 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:divide-x lg:divide-y-0">
                <div className="p-5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500"><Trophy size={13} className="text-emerald-500" /> Awaiting a decision</p>
                    <p className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-bold tabular-nums text-gray-900">{visible.length}</span>
                        <span className="text-sm text-gray-500">{total !== visible.length ? `of ${total} in your area` : 'in your area'}</span>
                    </p>
                    {visible.length > 0 && (
                        <>
                            <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-gray-100">
                                {clearing > 0 && <div className="rounded-full bg-emerald-500" style={{ width: `${(clearing / visible.length) * 100}%` }} />}
                                {below > 0 && <div className="rounded-full bg-red-400" style={{ width: `${(below / visible.length) * 100}%` }} />}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {clearing} clear the mark</span>
                                {below > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> {below} below</span>}
                                {byProgramme.length > 1 && byProgramme.map(([k, n]) => (
                                    <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: programmeColor(k) }} /> {n} {programmeLabel(k)}</span>
                                ))}
                            </div>
                        </>
                    )}
                </div>
                {[
                    { icon: Wallet, tone: 'text-indigo-500', label: 'Total requested', value: formatCurrency(requested), hint: visible.length ? `Average ${formatCurrency(requested / visible.length)}` : '—' },
                    { icon: Gauge, tone: 'text-violet-500', label: 'Average score', value: visible.length ? `${avg}%` : '—', hint: 'Of the maximum points' },
                    { icon: AlertTriangle, tone: flagged ? 'text-amber-500' : 'text-gray-400', label: 'Defence below its mark', value: flagged, hint: flagged ? 'Worth a closer look' : 'None flagged', hintTone: flagged ? 'font-medium text-amber-600' : '' },
                ].map((m) => (
                    <div key={m.label} className="p-5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500"><m.icon size={13} className={m.tone} /> {m.label}</p>
                        <p className="mt-1 truncate text-2xl font-bold tabular-nums text-gray-900">{m.value}</p>
                        <p className={`mt-0.5 text-xs text-gray-500 ${m.hintTone ?? ''}`}>{m.hint}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function CentralEvaluation() {
    const { success, error } = useToast();
    const [view, setView] = useViewPreference('central_evaluation', 'card');
    const [all, setAll] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dialog, setDialog] = useState(null);
    const [mode, setMode] = useState('round');
    const [roundsAvailable, setRoundsAvailable] = useState(true);
    const [meritKey, setMeritKey] = useState(0);
    const [search, setSearch] = useState('');
    const [programme, setProgramme] = useState('');
    const [college, setCollege] = useState('');
    const [sort, setSort] = useState('score');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/central-evaluation');
            setAll(res.data?.data ?? []);
        } catch {
            setAll((v) => v ?? []);
            error('Could not load the proposals.');
        }
        setLoading(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const list = all ?? [];
    const colleges = [...new Map(list.filter((p) => p.college).map((p) => [p.college.id, p.college])).values()].sort((a, b) => a.name.localeCompare(b.name));
    const usedProgrammes = [...new Set(list.map((p) => p.category).filter(Boolean))];

    // Rank by combined score share, so proposals scored on different forms compare fairly.
    const ranked = useMemo(() => [...list].sort((a, b) => pct(b.combined_score ?? 0, totalMaxOf(b)) - pct(a.combined_score ?? 0, totalMaxOf(a))), [list]);
    const rankOf = useMemo(() => new Map(ranked.map((p, i) => [p.id, i + 1])), [ranked]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = ranked.filter((p) => (!programme || p.category === programme)
            && (!college || p.college_id === college)
            && (!q || [p.tracker_number, p.title, p.pi?.name].some((v) => v?.toLowerCase().includes(q))));
        if (sort === 'budget') return [...filtered].sort((a, b) => (b.budget_total ?? 0) - (a.budget_total ?? 0));
        if (sort === 'oldest') return [...filtered].sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
        return filtered;
    }, [ranked, search, programme, college, sort]);

    const requested = visible.reduce((s, p) => s + Number(p.budget_total ?? 0), 0);
    const flagged = visible.filter((p) => p.defence_below_threshold).length;
    const avg = visible.length ? Math.round(visible.reduce((s, p) => s + pct(p.combined_score ?? 0, totalMaxOf(p)), 0) / visible.length) : 0;

    const exportColumns = [
        { label: 'Rank', value: (p) => rankOf.get(p.id) },
        { label: 'Tracker', value: (p) => p.tracker_number },
        { label: 'Title', value: (p) => p.title },
        { label: 'PI', value: (p) => p.pi?.name },
        { label: term('college'), value: (p) => p.college?.name },
        { label: 'Programme', value: (p) => programmeLabel(p.category) },
        { label: 'Blind', value: (p) => p.blind_score_raw ?? '' },
        { label: 'Blind max', value: (p) => p.blind_max ?? '' },
        { label: 'Defence', value: (p) => (p.skips_defence ? 'n/a' : p.defence_score_raw ?? '') },
        { label: 'Defence max', value: (p) => (p.skips_defence ? '' : p.defence_max ?? '') },
        { label: 'Combined', value: (p) => p.combined_score },
        { label: 'Out of', value: (p) => totalMaxOf(p) },
        { label: 'Pass mark', value: (p) => p.threshold },
        { label: 'Requested', value: (p) => Number(p.budget_total ?? 0) },
        { label: 'Flag', value: (p) => (p.defence_below_threshold ? 'Defence below its mark' : '') },
    ];

    const columns = [
        { key: 'rank', label: 'Rank', render: (p) => <RankBadge rank={rankOf.get(p.id)} /> },
        { key: 'p', label: 'Proposal', render: (p) => (
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: programmeColor(p.category) }} title={programmeLabel(p.category)} />
                    <ProposalHover id={p.id} className="font-mono text-xs font-bold text-indigo-600">{p.tracker_number}</ProposalHover>
                    {p.defence_below_threshold && <AlertTriangle size={11} className="text-amber-500" title="Defence below its mark" />}
                </div>
                <p className="max-w-72 truncate text-sm font-medium text-gray-900">{p.title}</p>
                <p className="max-w-72 truncate text-[11px] text-gray-500">{[p.pi?.name, p.college?.name].filter(Boolean).join(' · ')}</p>
            </div>
        ) },
        { key: 'blind', label: 'Blind', align: 'right', render: (p) => `${p.blind_score_raw ?? '—'}/${p.blind_max ?? '—'}` },
        { key: 'def', label: 'Defence', align: 'right', render: (p) => (p.skips_defence ? <span className="text-gray-400">—</span> : `${p.defence_score_raw ?? '—'}/${p.defence_max ?? '—'}`) },
        { key: 'comb', label: 'Combined', align: 'right', render: (p) => (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${passes(p) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {passes(p) ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {p.combined_score}/{totalMaxOf(p)}
            </span>
        ) },
        { key: 'req', label: 'Requested', align: 'right', render: (p) => <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(p.budget_total)}</span> },
        { key: 'act', label: '', align: 'right', render: (p) => (
            <div className="flex justify-end gap-1.5">
                <button onClick={() => setDialog({ type: 'reject', proposal: p })} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"><XCircle size={12} /> Reject</button>
                <button onClick={() => setDialog({ type: 'approve', proposal: p })} disabled={p.call_budget?.budget != null && p.call_budget.remaining < 0.005}
                    title={p.call_budget?.budget != null && p.call_budget.remaining < 0.005 ? 'Insufficient budget: this budget is fully used' : undefined}
                    className="inline-flex items-center gap-1 rounded-lg bg-linear-to-r from-emerald-600 to-teal-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300"><CheckCircle size={12} /> Approve</button>
            </div>
        ) },
    ];

    return (
        <AppLayout breadcrumb="Central Evaluation">
            <div className="mx-auto max-w-6xl space-y-5">
                <WorkflowBreadcrumb current="accepted" />

                <PageHeader icon={ClipboardList} color="emerald" title="Central Evaluation"
                    description={mode === 'round' ? 'Decide a call’s proposals together as a funding round, then publish them all at once.' : 'Approve or reject each proposal that passed review — ranked by combined score.'}>
                    <RefreshButton onClick={() => { load(); setMeritKey((k) => k + 1); }} loading={loading} />
                </PageHeader>

                {all === null ? <Skeleton className="h-32 rounded-2xl" /> : (
                    <Overview visible={visible} total={list.length} requested={requested} avg={avg} flagged={flagged} />
                )}

                {/* How to decide: two ways, as cards */}
                <div role="tablist" aria-label="How to decide" className={`grid gap-3 ${roundsAvailable ? 'sm:grid-cols-2' : ''}`}>
                    {[
                        ...(roundsAvailable ? [{
                            key: 'round', label: 'Funding round', icon: ListOrdered, badge: 'Recommended',
                            text: 'Decide a call’s proposals together as drafts, watch the budget, then publish all at once.',
                            on: 'from-emerald-600 to-teal-600', ring: 'ring-emerald-200', tile: 'bg-emerald-100 text-emerald-700',
                        }] : []),
                        {
                            key: 'proposals', label: 'Proposals one by one', icon: ClipboardList, badge: all === null ? null : `${visible.length} waiting`,
                            text: 'Approve or reject a single proposal right away — the team is told at once.',
                            on: 'from-indigo-600 to-violet-600', ring: 'ring-indigo-200', tile: 'bg-indigo-100 text-indigo-700',
                        },
                    ].map((m) => {
                        const active = mode === m.key;
                        return (
                            <button key={m.key} role="tab" aria-selected={active} onClick={() => setMode(m.key)}
                                className={`group relative flex items-start gap-3.5 overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 ${active
                                    ? `bg-linear-to-br ${m.on} text-white shadow-lg ring-4 ${m.ring}`
                                    : 'border border-gray-200 bg-white text-gray-900 shadow-sm hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md'}`}>
                                {active && <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />}
                                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${active ? 'bg-white/20 text-white' : `${m.tile} group-hover:scale-105`}`}>
                                    <m.icon size={20} />
                                </span>
                                <span className="relative min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold">{m.label}</span>
                                        {m.badge && (
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{m.badge}</span>
                                        )}
                                    </span>
                                    <span className={`mt-1 block text-xs leading-relaxed ${active ? 'text-white/85' : 'text-gray-500'}`}>{m.text}</span>
                                </span>
                                <span className={`relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${active ? 'border-white bg-white' : 'border-gray-300 group-hover:border-gray-400'}`}>
                                    {active && <CheckCircle size={14} className={m.key === 'round' ? 'text-emerald-600' : 'text-indigo-600'} />}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {mode === 'round' && roundsAvailable ? (
                    <FundingRound key={meritKey} onChanged={load}
                        onUnavailable={() => { setRoundsAvailable(false); setMode('proposals'); }} />
                ) : (
                    <>
                        <StageFilters search={search} onSearch={setSearch} colleges={colleges} college={college} onCollege={setCollege}
                            programmes={usedProgrammes} programme={programme} onProgramme={setProgramme}
                            onClear={() => { setSearch(''); setCollege(''); setProgramme(''); }}>
                            <Select label="Sort" value={sort} onChange={setSort} className="sm:w-44">
                                <option value="score">Highest score</option>
                                <option value="budget">Largest request</option>
                                <option value="oldest">Waiting longest</option>
                            </Select>
                        </StageFilters>

                        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <p className="text-sm text-gray-600">
                                <b className="text-gray-900">{visible.length}</b> proposal{visible.length === 1 ? '' : 's'}
                                <span className="text-gray-400"> · {sort === 'score' ? 'best score first' : sort === 'budget' ? 'largest request first' : 'waiting longest first'}</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <DownloadMenu filename="central-evaluation" title="Central evaluation" subtitle="Ranked by combined score" columns={exportColumns} rows={visible} />
                                <ViewToggle view={view} onChange={setView} />
                            </div>
                        </div>

                        {all === null ? (
                            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
                        ) : visible.length === 0 ? (
                            <Panel bodyClassName="p-0">
                                <EmptyState icon={ClipboardList} title={list.length ? 'Nothing matches' : 'Nothing awaiting a decision'}
                                    text={list.length ? 'Try another search or filter.' : 'Proposals appear here once they pass open defence (or blind review, where a call has no defence).'}>
                                    {!list.length && <Link href="/admin/open-defence" className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">Go to Open Defence →</Link>}
                                </EmptyState>
                            </Panel>
                        ) : view === 'table' ? (
                            <Panel bodyClassName="p-0"><DataTable columns={columns} rows={visible} rowKey={(p) => p.id} minWidth={860} /></Panel>
                        ) : (
                            <div className="space-y-4">
                                {visible.map((p) => (
                                    <ProposalCard key={p.id} p={p} rank={rankOf.get(p.id)}
                                        onApprove={() => setDialog({ type: 'approve', proposal: p })}
                                        onReject={() => setDialog({ type: 'reject', proposal: p })} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {dialog?.type === 'reject' && (
                <RejectWithReasonModal context="central_evaluation" title="Reject proposal" subtitle={`${dialog.proposal.tracker_number ?? ''} · Central evaluation`}
                    note="The PI and co-investigators are told this reason." confirmLabel="Reject proposal"
                    onClose={() => setDialog(null)}
                    onSubmit={async (payload) => {
                        const res = await api.post(`/proposals/${dialog.proposal.id}/central/reject`, payload);
                        success(res.data?.message || 'Proposal rejected.');
                        setDialog(null);
                        setMeritKey((k) => k + 1);
                        load();
                    }} />
            )}
            {dialog?.type === 'approve' && (
                <ApproveFundingModal proposal={dialog.proposal} onClose={() => setDialog(null)}
                    onSubmit={async (payload) => {
                        const res = await api.post(`/proposals/${dialog.proposal.id}/central/approve`, payload);
                        // Stay here to decide the next one; the funding page is one click away.
                        success(res.data?.message || 'Approved for funding.', {
                            action: { label: 'Open Funding', onClick: () => { window.location.href = '/admin/funding'; } },
                        });
                        setDialog(null);
                        setMeritKey((k) => k + 1);
                        load();
                    }} />
            )}
        </AppLayout>
    );
}
