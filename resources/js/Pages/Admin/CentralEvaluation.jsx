import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { ClipboardList, CheckCircle, XCircle, TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronUp, History, AlertTriangle, BadgeCheck, Users } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import FilterBar from '../../Components/FilterBar';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatCurrency, getCategoryLabel } from '../../lib/utils';
import RejectWithReasonModal from '../../Components/RejectWithReasonModal';
import ApproveFundingModal from '../../Components/ApproveFundingModal';
import MeritList from '../../Components/MeritList';
import AiReviewSummary from '../../Components/AiReviewSummary';

function ScoreBar({ score, max, label, color }) {
    const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
    return (
        <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{label}</span>
                <span className="font-semibold">
                    {score != null ? score : '—'}
                    {score != null && max != null && (
                        <span className="font-normal text-gray-400">/{max}</span>
                    )}
                </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function PiFundingHistory({ data }) {
    const { has_overlap, active_funded, co_investigator_on, stats } = data;

    return (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 space-y-3">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-white rounded-lg px-3 py-2 text-center border border-indigo-100">
                    <div className="text-lg font-bold text-indigo-700">{stats.total_funded_as_pi}</div>
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Funded as PI</div>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 text-center border border-indigo-100">
                    <div className="text-lg font-bold text-indigo-700">
                        {stats.total_awarded_etb > 0 ? `${(stats.total_awarded_etb / 1000).toFixed(0)}K` : '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Total Awarded (ETB)</div>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 text-center border border-indigo-100">
                    <div className="text-lg font-bold text-indigo-700">{stats.co_investigator_active_count}</div>
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Co-Inv on Funded</div>
                </div>
            </div>

            {/* Overlap warning */}
            {has_overlap ? (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-amber-700">Overlapping Funding Detected</p>
                        <p className="text-[11px] text-amber-600 mt-0.5">
                            This PI already holds active funding on {active_funded.length} proposal{active_funded.length > 1 ? 's' : ''}.
                            Approving this proposal creates concurrent funding.
                        </p>
                        <div className="mt-1.5 space-y-1">
                            {active_funded.map(ap => (
                                <div key={ap.id} className="flex items-center justify-between gap-2 text-[11px] bg-amber-100 rounded px-2 py-1">
                                    <span className="font-mono text-amber-800 font-semibold shrink-0">{ap.tracker_number}</span>
                                    <span className="min-w-0 flex-1 text-amber-700 truncate">{ap.title}</span>
                                    <span className="text-amber-800 font-medium shrink-0">
                                        {ap.awarded_amount ? formatCurrency(ap.awarded_amount) : ap.grant_reference ?? '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <BadgeCheck size={14} className="text-green-500 shrink-0" />
                    <p className="text-xs text-green-700 font-medium">No overlapping active funding — PI is clear for new award.</p>
                </div>
            )}

            {/* Co-investigator involvement */}
            {co_investigator_on.length > 0 && (
                <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <Users size={11} /> Co-Investigator on Active Funded Proposals
                    </p>
                    <div className="space-y-1">
                        {co_investigator_on.map(cp => (
                            <div key={cp.id} className="flex items-center justify-between text-[11px] bg-white border border-indigo-100 rounded px-2 py-1.5">
                                <span className="font-mono text-indigo-700 font-semibold shrink-0">{cp.tracker_number}</span>
                                <span className="min-w-0 flex-1 text-gray-600 truncate mx-2">{cp.title}</span>
                                <span className="hidden text-gray-400 shrink-0 sm:inline">{cp.college}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {stats.total_funded_as_pi === 0 && !has_overlap && co_investigator_on.length === 0 && (
                <p className="text-[11px] text-gray-400 italic text-center py-1">
                    No prior funding history found for this PI.
                </p>
            )}
        </div>
    );
}

export default function CentralEvaluation() {
    const { success, error } = useToast();
    const [view, setView] = useViewPreference('central_evaluation', 'card');
    const [allProposals, setAllProposals] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [collegeFilter, setCollegeFilter] = useState('');
    const [loading, setLoading]       = useState(true);
    const [dialog, setDialog]         = useState(null);
    const [mode, setMode]             = useState('proposals');
    const [meritKey, setMeritKey]     = useState(0);
    const [budgetMap, setBudgetMap]         = useState({});
    const [expandedBudget, setExpandedBudget] = useState(null);
    const [piHistoryMap, setPiHistoryMap]   = useState({});
    const [expandedPi, setExpandedPi]       = useState(null);
    const [piHistoryLoading, setPiHistoryLoading] = useState({});

    const toggleBudget = async (proposalId) => {
        if (expandedBudget === proposalId) { setExpandedBudget(null); return; }
        setExpandedBudget(proposalId);
        if (!budgetMap[proposalId]) {
            try {
                const res = await api.get(`/proposals/${proposalId}/budget`);
                setBudgetMap(m => ({ ...m, [proposalId]: res.data?.data ?? { items: [], total: 0 } }));
            } catch { /* silent */ }
        }
    };

    const togglePiHistory = async (proposalId, piUserId) => {
        if (expandedPi === proposalId) { setExpandedPi(null); return; }
        setExpandedPi(proposalId);
        if (!piHistoryMap[proposalId] && piUserId) {
            setPiHistoryLoading(l => ({ ...l, [proposalId]: true }));
            try {
                const res = await api.get(`/central-evaluation/pi/${piUserId}/funding-history`);
                setPiHistoryMap(m => ({ ...m, [proposalId]: res.data?.data }));
            } catch { /* silent */ }
            setPiHistoryLoading(l => ({ ...l, [proposalId]: false }));
        }
    };

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/central-evaluation');
            setAllProposals(res.data?.data ?? []);
        } catch { error('Failed to load proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    // ── Category/college options & client-side filters ──
    const availableCategories = [...new Set(allProposals.map(p => p.category).filter(Boolean))].sort();
    const availableColleges   = [...new Map(allProposals.filter(p => p.college).map(p => [p.college.id, p.college])).values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    const proposals = allProposals
        .filter(p => !categoryFilter || p.category === categoryFilter)
        .filter(p => !collegeFilter || p.college_id === collegeFilter);

    const openApprove = (proposal) => setDialog({ type: 'approve', proposal });
    const openReject  = (proposal) => setDialog({ type: 'reject', proposal });

    return (
        <AppLayout breadcrumb="Central Evaluation">
            <div className="max-w-5xl mx-auto">
                <WorkflowBreadcrumb current="accepted" />

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                            <ClipboardList size={20} className="text-teal-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Central Office Evaluation</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Proposals that passed open defence — ready for final funding decision</p>
                        </div>
                    </div>
                    <FilterBar
                        accent="teal"
                        activeCount={[collegeFilter, categoryFilter].filter(Boolean).length}
                        trailing={
                            <>
                                {!loading && proposals.length > 0 && (
                                    <span className="flex items-center gap-1.5 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1.5 rounded-lg shrink-0">
                                        {proposals.length} Awaiting Decision
                                    </span>
                                )}
                                <ViewToggle view={view} onChange={setView} />
                                <button onClick={load} className="flex items-center gap-2 px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
                                    <RefreshCw size={14} />
                                    <span className="hidden sm:inline">Refresh</span>
                                </button>
                            </>
                        }
                    >
                        {availableColleges.length > 1 && (
                            <select
                                value={collegeFilter}
                                onChange={e => setCollegeFilter(e.target.value)}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
                            >
                                <option value="">All Colleges</option>
                                {availableColleges.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                        {availableCategories.length > 1 && (
                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
                            >
                                <option value="">All Categories</option>
                                {availableCategories.map(c => (
                                    <option key={c} value={c}>{getCategoryLabel(c)}</option>
                                ))}
                            </select>
                        )}
                    </FilterBar>
                </div>

                <div className="mb-4 flex w-full rounded-xl bg-gray-100 p-1 text-sm sm:inline-flex sm:w-auto">
                    {[['proposals', 'Proposals'], ['merit', 'Merit List & Budget']].map(([key, label]) => (
                        <button key={key} onClick={() => setMode(key)}
                            className={`flex-1 rounded-lg px-3.5 py-1.5 font-medium transition-colors sm:flex-none ${mode === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {mode === 'merit' ? (
                    <MeritList
                        refreshKey={meritKey}
                        onApprove={(proposalId) => {
                            const proposal = allProposals.find((p) => p.id === proposalId);
                            if (proposal) openApprove(proposal);
                        }}
                    />
                ) : loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className="h-14 w-14 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <ClipboardList size={28} className="text-teal-300" />
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1">No proposals awaiting central evaluation</h3>
                        <p className="text-sm text-gray-400 mb-3">Proposals that pass open defence will appear here.</p>
                        <Link href="/admin/open-defence" className="text-sm text-teal-600 hover:underline font-medium">
                            Go to Open Defence →
                        </Link>
                    </div>
                ) : view === 'table' ? (
                    <ProposalTable
                        proposals={proposals}
                        showColumns={['tracker','title','category','college','blind_score','defence_score','combined_score']}
                        actions={(p) => (
                            <div className="flex items-center gap-1.5 justify-end">
                                <button onClick={() => openApprove(p)}
                                    className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                                    Approve
                                </button>
                                <button onClick={() => openReject(p)}
                                    className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">
                                    Reject
                                </button>
                            </div>
                        )}
                        emptyMessage="No proposals awaiting central evaluation."
                    />
                ) : (
                    <div className="space-y-4">
                        {proposals.map(p => {
                            const totalMax        = (p.blind_max ?? 0) + (p.defence_max ?? 0);
                            const passesThreshold = (p.combined_score ?? 0) >= (p.threshold ?? 0);
                            const budgetExpanded  = expandedBudget === p.id;

                            return (
                                <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                    {/* Top accent + header row */}
                                    <div className="flex items-stretch">
                                        <div className="w-0.5 bg-teal-600 shrink-0" />
                                        <div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg shrink-0">
                                                        {p.tracker_number}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{getCategoryLabel(p.category)}</span>
                                                </div>
                                                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 sm:line-clamp-1 mb-0.5">{p.title}</h3>
                                                <p className="text-xs text-gray-500">{p.pi?.name} · {p.college?.name}</p>
                                            </div>
                                            <div className={`shrink-0 self-start flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold px-3 py-1.5 rounded-xl ${passesThreshold ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                {passesThreshold ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                {p.combined_score} / {totalMax}
                                                <span className="text-xs font-normal opacity-70">({p.threshold_pct} pts min)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Score breakdown panel */}
                                    <div className="mx-4 mb-3 p-3.5 bg-gray-50 border border-gray-100 rounded-xl">
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Score Breakdown</p>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                                            <ScoreBar score={p.blind_score_raw ?? p.blind_score}     max={p.blind_max ?? 0}    label="Blind Review" color="bg-indigo-500" />
                                            <ScoreBar score={p.defence_score_raw ?? p.defence_score} max={p.defence_max ?? 0}  label="Open Defence" color="bg-purple-500" />
                                            <ScoreBar score={p.combined_score}                        max={totalMax}            label="Total"        color={passesThreshold ? 'bg-green-500' : 'bg-red-500'} />
                                        </div>
                                    </div>

                                    {/* Informational flag: defence score fell short of its own threshold —
                                        doesn't block advancement, but the central officer should know. */}
                                    {p.defence_below_threshold && (
                                        <div className="mx-4 mb-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                                            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                            <p className="text-xs text-amber-700 leading-relaxed">
                                                Open defence score ({p.defence_score_raw}/{p.defence_max}) is below the open defence threshold
                                                ({p.defence_threshold} pts) — the proposal still cleared the combined threshold, but consider this
                                                when making the final funding decision.
                                            </p>
                                        </div>
                                    )}

                                    {/* Budget toggle */}
                                    <div className="mx-4 mb-3">
                                        <button
                                            onClick={() => toggleBudget(p.id)}
                                            className="flex flex-wrap items-center gap-1.5 text-left text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors"
                                        >
                                            {budgetExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            {budgetExpanded ? 'Hide' : 'Show'} Budget Details
                                            <span className="text-gray-400 font-normal ml-0.5">({formatCurrency(p.budget_total)} requested)</span>
                                        </button>
                                        {budgetExpanded && (
                                            <div className="mt-2 bg-teal-50 border border-teal-200 rounded-xl p-3.5">
                                                <p className="text-xs font-semibold text-teal-800 mb-2">Requested Budget</p>
                                                {(budgetMap[p.id]?.items ?? []).length === 0 ? (
                                                    <p className="text-xs text-gray-400 italic">No budget items.</p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {(budgetMap[p.id]?.items ?? []).map(item => (
                                                            <div key={item.id} className="flex justify-between gap-3 text-xs">
                                                                <span className="min-w-0 text-gray-600 capitalize">{item.category}: {item.item_description}</span>
                                                                <span className="shrink-0 whitespace-nowrap font-medium text-gray-900">ETB {parseFloat(item.amount).toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                        <div className="border-t border-teal-200 pt-1.5 flex justify-between text-sm font-bold">
                                                            <span className="text-teal-800">Total Requested</span>
                                                            <span className="text-teal-900">ETB {parseFloat(budgetMap[p.id]?.total ?? 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* PI Funding History */}
                                    <div className="mx-4 mb-3">
                                        <button
                                            onClick={() => togglePiHistory(p.id, p.pi?.id)}
                                            className="flex flex-wrap items-center gap-1.5 text-left text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                                        >
                                            {expandedPi === p.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            {expandedPi === p.id ? 'Hide' : 'View'} PI Funding History
                                            <span className="text-gray-400 font-normal ml-0.5">— {p.pi?.name}</span>
                                        </button>
                                        {expandedPi === p.id && (
                                            <div className="mt-2">
                                                {piHistoryLoading[p.id] ? (
                                                    <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
                                                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                                        Loading history…
                                                    </div>
                                                ) : piHistoryMap[p.id] && (
                                                    <PiFundingHistory data={piHistoryMap[p.id]} />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* AI review summary */}
                                    <div className="mx-4 mb-3">
                                        <AiReviewSummary proposalId={p.id} />
                                    </div>

                                    {/* Action footer */}
                                    <div className="flex flex-col gap-3 px-4 py-3.5 border-t border-gray-100 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                        <p className="text-sm text-gray-600">
                                            Requested: <span className="font-semibold text-gray-900">{formatCurrency(p.budget_total)}</span>
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 sm:flex">
                                            <button onClick={() => openReject(p)}
                                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                                                <XCircle size={14} /> Reject
                                            </button>
                                            <button onClick={() => openApprove(p)}
                                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                                                <CheckCircle size={14} /> <span className="sm:hidden">Approve</span><span className="hidden sm:inline">Approve for Funding</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {dialog?.type === 'reject' && (
                <RejectWithReasonModal
                    context="central_evaluation"
                    title="Reject Proposal"
                    subtitle={`${dialog.proposal.tracker_number ?? ''} · Central Evaluation`}
                    note="The PI and co-investigators are notified with this reason."
                    confirmLabel="Reject Proposal"
                    onClose={() => setDialog(null)}
                    onSubmit={async (payload) => {
                        const res = await api.post(`/proposals/${dialog.proposal.id}/central/reject`, payload);
                        success(res.data?.message || 'Proposal rejected.');
                        setDialog(null);
                        load();
                    }}
                />
            )}

            {dialog?.type === 'approve' && (
                <ApproveFundingModal
                    proposal={dialog.proposal}
                    onClose={() => setDialog(null)}
                    onSubmit={async (payload) => {
                        const res = await api.post(`/proposals/${dialog.proposal.id}/central/approve`, payload);
                        setMeritKey((k) => k + 1);
                        success(res.data?.message || 'Proposal approved for funding.', {
                            action: { label: 'Go to Funding', onClick: () => { window.location.href = '/admin/funding'; } },
                        });
                        setDialog(null);
                        setTimeout(() => { window.location.href = '/admin/funding'; }, 1500);
                    }}
                />
            )}
        </AppLayout>
    );
}
