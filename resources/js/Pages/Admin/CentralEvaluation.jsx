import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { ClipboardList, CheckCircle, XCircle, TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronUp, History, AlertTriangle, BadgeCheck, Users } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatCurrency, getCategoryLabel } from '../../lib/utils';

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
            <div className="grid grid-cols-3 gap-3">
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
                                <div key={ap.id} className="flex items-center justify-between text-[11px] bg-amber-100 rounded px-2 py-1">
                                    <span className="font-mono text-amber-800 font-semibold">{ap.tracker_number}</span>
                                    <span className="text-amber-700 truncate mx-2 max-w-40">{ap.title}</span>
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
                                <span className="text-gray-600 truncate mx-2">{cp.title}</span>
                                <span className="text-gray-400 shrink-0">{cp.college}</span>
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
    const [proposals, setProposals]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [dialog, setDialog]         = useState(null);
    const [reason, setReason]         = useState('');
    const [approveForm, setApproveForm] = useState({ remarks: '', awarded_amount: '' });
    const [submitting, setSubmitting] = useState(false);
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
            setProposals(res.data?.data ?? []);
        } catch { error('Failed to load proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openApprove = (proposal) => {
        setApproveForm({ remarks: '', awarded_amount: proposal.budget_total ?? '' });
        setDialog({ type: 'approve', proposal });
    };
    const openReject  = (proposal) => { setDialog({ type: 'reject', proposal }); setReason(''); };

    const confirm = async () => {
        if (!dialog) return;
        if (dialog.type === 'reject' && !reason.trim()) { error('Reason is required.'); return; }
        setSubmitting(true);
        try {
            if (dialog.type === 'approve') {
                if (!approveForm.awarded_amount) { error('Awarded amount is required.'); setSubmitting(false); return; }
                const res = await api.post(`/proposals/${dialog.proposal.id}/central/approve`, {
                    awarded_amount: parseFloat(approveForm.awarded_amount),
                    remarks: approveForm.remarks || null,
                });
                success(res.data?.message || 'Proposal approved for funding.', {
                    action: { label: 'Go to Funding', onClick: () => { window.location.href = '/admin/funding'; } },
                });
                setDialog(null);
                setReason('');
                setTimeout(() => { window.location.href = '/admin/funding'; }, 1500);
                return;
            } else {
                const res = await api.post(`/proposals/${dialog.proposal.id}/central/reject`, { reason });
                success(res.data?.message || 'Proposal rejected.');
            }
            setDialog(null);
            setReason('');
            load();
        } catch (e) {
            error(e.response?.data?.message || 'Action failed.');
        }
        setSubmitting(false);
    };

    return (
        <AppLayout breadcrumb="Central Evaluation">
            <div className="max-w-5xl mx-auto">
                <WorkflowBreadcrumb current="accepted" />

                {/* Page Header */}
                <div className="flex items-start justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                            <ClipboardList size={20} className="text-teal-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Central Office Evaluation</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Proposals that passed open defence — ready for final funding decision</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {!loading && proposals.length > 0 && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1.5 rounded-lg">
                                {proposals.length} Awaiting Decision
                            </span>
                        )}
                        <ViewToggle view={view} onChange={setView} />
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
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
                                        <div className="flex items-start justify-between gap-4 flex-1 px-4 py-3.5">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg shrink-0">
                                                        {p.tracker_number}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{getCategoryLabel(p.category)}</span>
                                                </div>
                                                <h3 className="text-sm font-semibold text-gray-900 truncate mb-0.5">{p.title}</h3>
                                                <p className="text-xs text-gray-500">{p.pi?.name} · {p.college?.name}</p>
                                            </div>
                                            <div className={`shrink-0 flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl ${passesThreshold ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                {passesThreshold ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                {p.combined_score} / {totalMax}
                                                <span className="text-xs font-normal opacity-70">({p.threshold_pct}% min)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Score breakdown panel */}
                                    <div className="mx-4 mb-3 p-3.5 bg-gray-50 border border-gray-100 rounded-xl">
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Score Breakdown</p>
                                        <div className="grid grid-cols-3 gap-4">
                                            <ScoreBar score={p.blind_score_raw ?? p.blind_score}     max={p.blind_max ?? 0}    label="Blind Review" color="bg-indigo-500" />
                                            <ScoreBar score={p.defence_score_raw ?? p.defence_score} max={p.defence_max ?? 0}  label="Open Defence" color="bg-purple-500" />
                                            <ScoreBar score={p.combined_score}                        max={totalMax}            label="Total"        color={passesThreshold ? 'bg-green-500' : 'bg-red-500'} />
                                        </div>
                                    </div>

                                    {/* Budget toggle */}
                                    <div className="mx-4 mb-3">
                                        <button
                                            onClick={() => toggleBudget(p.id)}
                                            className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors"
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
                                                            <div key={item.id} className="flex justify-between text-xs">
                                                                <span className="text-gray-600 capitalize">{item.category}: {item.item_description}</span>
                                                                <span className="font-medium text-gray-900">ETB {parseFloat(item.amount).toLocaleString()}</span>
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
                                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
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

                                    {/* Action footer */}
                                    <div className="flex items-center justify-between gap-4 px-4 py-3.5 border-t border-gray-100">
                                        <p className="text-sm text-gray-600">
                                            Requested: <span className="font-semibold text-gray-900">{formatCurrency(p.budget_total)}</span>
                                        </p>
                                        <div className="flex gap-2">
                                            <button onClick={() => openReject(p)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                                                <XCircle size={14} /> Reject
                                            </button>
                                            <button onClick={() => openApprove(p)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                                                <CheckCircle size={14} /> Approve for Funding
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {dialog && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
                        <h2 className="text-base font-semibold mb-2">
                            {dialog.type === 'approve' ? 'Approve for Funding' : 'Reject Proposal'}
                        </h2>
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{dialog.proposal.title}</p>
                        {dialog.type === 'reject' && (
                            <textarea value={reason} onChange={e => setReason(e.target.value)}
                                placeholder="Reason for rejection (required, min 10 characters)…" rows={3}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none resize-none" />
                        )}
                        {dialog.type === 'approve' && (
                            <div className="space-y-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Awarded Amount (ETB) <span className="text-red-500">*</span>
                                    </label>
                                    <input type="number" min="0"
                                        value={approveForm.awarded_amount}
                                        onChange={e => setApproveForm(p => ({ ...p, awarded_amount: e.target.value }))}
                                        placeholder="Enter approved budget amount"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Central Office Remarks</label>
                                    <textarea rows={4} value={approveForm.remarks}
                                        onChange={e => setApproveForm(p => ({ ...p, remarks: e.target.value }))}
                                        placeholder="Add evaluation remarks, conditions, or notes for the PI..."
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDialog(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={confirm} disabled={submitting}
                                className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-60 ${dialog.type === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                {submitting ? 'Processing…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
