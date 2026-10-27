import { useEffect, useState } from 'react';
import { Wallet, History, Sparkles, AlertTriangle, BadgeCheck, Users } from 'lucide-react';
import api from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { currency } from '../../lib/terms';
import { Skeleton } from '../Insights/Kit';
import AiReviewSummary from '../AiReviewSummary';

/** The PI's funding record: what they already hold, overlaps, and team roles. */
export function PiFundingHistory({ data }) {
    const { has_overlap, active_funded, co_investigator_on, stats } = data;
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                {[['Funded as PI', stats.total_funded_as_pi], [`Awarded (${currency()})`, stats.total_awarded_etb > 0 ? `${(stats.total_awarded_etb / 1000).toFixed(0)}K` : '—'], ['Co-investigator on', stats.co_investigator_active_count]].map(([label, v]) => (
                    <div key={label} className="rounded-xl bg-indigo-50/60 px-3 py-2.5 text-center">
                        <p className="text-lg font-bold tabular-nums text-indigo-700">{v}</p>
                        <p className="text-[10px] font-medium text-gray-500">{label}</p>
                    </div>
                ))}
            </div>
            {has_overlap ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800"><AlertTriangle size={13} /> Already holds {active_funded.length} running award{active_funded.length > 1 ? 's' : ''}</p>
                    <div className="mt-1.5 space-y-1">
                        {active_funded.map((ap) => (
                            <div key={ap.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1 text-[11px]">
                                <span className="shrink-0 font-mono font-semibold text-amber-900">{ap.tracker_number}</span>
                                <span className="min-w-0 flex-1 truncate text-amber-800">{ap.title}</span>
                                <span className="shrink-0 font-medium text-amber-900">{ap.awarded_amount ? formatCurrency(ap.awarded_amount) : ap.grant_reference ?? '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><BadgeCheck size={13} /> No other running award — clear for a new one.</p>
            )}
            {co_investigator_on.length > 0 && (
                <div>
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><Users size={11} /> Co-investigator on running projects</p>
                    {co_investigator_on.map((cp) => (
                        <div key={cp.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-[11px]">
                            <span className="shrink-0 font-mono font-semibold text-indigo-700">{cp.tracker_number}</span>
                            <span className="min-w-0 flex-1 truncate text-gray-600">{cp.title}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Cached per visit, so switching tabs or proposals back and forth is instant. */
const budgetCache = new Map();
const historyCache = new Map();

function BudgetLines({ proposalId, requested }) {
    const [data, setData] = useState(() => budgetCache.get(proposalId));
    useEffect(() => {
        if (budgetCache.has(proposalId)) return;
        api.get(`/proposals/${proposalId}/budget`)
            .then((r) => { const d = r.data?.data ?? { items: [], total: 0 }; budgetCache.set(proposalId, d); setData(d); })
            .catch(() => setData({ items: [], total: 0 }));
    }, [proposalId]);

    if (!data) return <Skeleton className="h-24" />;
    if (!data.items?.length) return <p className="text-xs text-gray-400">No budget lines were submitted.</p>;
    const total = Number(data.total ?? requested ?? 0);
    const byCategory = data.items.reduce((m, i) => m.set(i.category, (m.get(i.category) ?? 0) + Number(i.amount)), new Map());

    return (
        <div className="space-y-3">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                {[...byCategory.entries()].map(([cat, v], idx) => (
                    <div key={cat} title={`${cat}: ${formatCurrency(v)}`} style={{ width: `${(v / Math.max(total, 1)) * 100}%` }}
                        className={['bg-indigo-500', 'bg-emerald-500', 'bg-amber-400', 'bg-sky-500', 'bg-violet-500', 'bg-rose-400'][idx % 6]} />
                ))}
            </div>
            <div className="divide-y divide-gray-50 overflow-hidden rounded-xl border border-gray-200">
                {data.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 px-3 py-2 text-xs">
                        <span className="min-w-0"><span className="font-medium capitalize text-gray-800">{item.category}</span> <span className="text-gray-500">· {item.item_description}</span></span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(item.amount)}</span>
                    </div>
                ))}
                <div className="flex justify-between bg-gray-50 px-3 py-2 text-sm font-bold"><span>Total requested</span><span className="tabular-nums">{formatCurrency(total)}</span></div>
            </div>
        </div>
    );
}

function History_({ piId }) {
    const [data, setData] = useState(() => historyCache.get(piId));
    useEffect(() => {
        if (!piId || historyCache.has(piId)) return;
        api.get(`/central-evaluation/pi/${piId}/funding-history`)
            .then((r) => { historyCache.set(piId, r.data?.data ?? null); setData(r.data?.data ?? null); })
            .catch(() => setData(null));
    }, [piId]);

    if (data === undefined) return <Skeleton className="h-28" />;
    if (!data) return <p className="text-xs text-gray-400">The history could not be loaded.</p>;
    return <PiFundingHistory data={data} />;
}

/**
 * The evidence behind a funding decision, in three tabs: the requested budget, the
 * PI's funding history and the summary of the reviewers' comments.
 */
export default function ProposalInsights({ proposalId, piId, piName, requested, initialTab = 'budget' }) {
    const [tab, setTab] = useState(initialTab);
    const tabs = [
        { key: 'budget', label: 'Requested budget', hint: formatCurrency(requested), icon: Wallet },
        { key: 'pi', label: 'PI funding history', hint: piName, icon: History },
        { key: 'reviews', label: 'Reviewer comments', icon: Sparkles },
    ];

    return (
        <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 p-1.5">
                {tabs.map((t) => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <t.icon size={13} /> {t.label}
                        {t.hint && <span className={`font-normal ${tab === t.key ? 'text-white/70' : 'text-gray-400'}`}>· {t.hint}</span>}
                    </button>
                ))}
            </div>
            <div className="p-4">
                {tab === 'budget' && <BudgetLines proposalId={proposalId} requested={requested} />}
                {tab === 'pi' && <History_ piId={piId} />}
                {tab === 'reviews' && <AiReviewSummary proposalId={proposalId} defaultOpen />}
            </div>
        </div>
    );
}
