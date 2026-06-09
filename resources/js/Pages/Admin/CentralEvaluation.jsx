import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { ClipboardList, CheckCircle, XCircle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
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

export default function CentralEvaluation() {
    const { success, error } = useToast();
    const [view, setView] = useViewPreference('central_evaluation', 'card');
    const [proposals, setProposals]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [dialog, setDialog]         = useState(null);
    const [reason, setReason]         = useState('');
    const [approveForm, setApproveForm] = useState({ remarks: '', awarded_amount: '' });
    const [submitting, setSubmitting] = useState(false);
    const [budgetMap, setBudgetMap]   = useState({});
    const [expandedBudget, setExpandedBudget] = useState(null);

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
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ClipboardList size={22} className="text-blue-600" /> Central Office Evaluation
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Proposals that passed open defence — ready for final funding decision</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ViewToggle view={view} onChange={setView} />
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <ClipboardList size={36} className="mx-auto text-gray-300 mb-3" />
                        <h3 className="text-gray-600 font-medium mb-1">No proposals awaiting central evaluation</h3>
                        <p className="text-sm text-gray-400">Proposals that pass open defence will appear here.</p>
                        <Link href="/admin/open-defence" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
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
                            const passesThreshold = (p.combined_score ?? 0) >= (p.threshold ?? 120);

                            return (
                                <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5">
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.tracker_number}</span>
                                                <span className="text-xs text-gray-400">{getCategoryLabel(p.category)}</span>
                                            </div>
                                            <h3 className="text-base font-semibold text-gray-900 line-clamp-1 mb-0.5">{p.title}</h3>
                                            <p className="text-xs text-gray-500">{p.pi?.name} · {p.college?.name}</p>
                                        </div>
                                        <div className={`shrink-0 flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${passesThreshold ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {passesThreshold ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                            {p.combined_score} / {p.threshold}
                                        </div>
                                    </div>

                                    {/* Score breakdown */}
                                    <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                                        <ScoreBar score={p.blind_score_raw ?? p.blind_score}   max={p.blind_max ?? 100}   label="Blind Review"  color="bg-blue-500" />
                                        <ScoreBar score={p.defence_score_raw ?? p.defence_score} max={p.defence_max ?? 100} label="Open Defence"  color="bg-purple-500" />
                                        <ScoreBar score={p.combined_score} max={p.threshold * 1.5} label="Combined" color={passesThreshold ? 'bg-green-500' : 'bg-red-500'} />
                                    </div>

                                    {/* Budget breakdown toggle */}
                                    <div className="mb-3">
                                        <button onClick={() => toggleBudget(p.id)}
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                            {expandedBudget === p.id ? '▲ Hide' : '▼ Show'} Budget Details
                                            <span className="ml-1 text-gray-500">({formatCurrency(p.budget_total)} requested)</span>
                                        </button>
                                        {expandedBudget === p.id && (
                                            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <p className="text-xs font-semibold text-blue-800 mb-2">Requested Budget</p>
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
                                                        <div className="border-t border-blue-200 pt-1 flex justify-between text-sm font-bold">
                                                            <span className="text-blue-800">Total Requested</span>
                                                            <span className="text-blue-900">ETB {parseFloat(budgetMap[p.id]?.total ?? 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Budget + actions */}
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="text-sm text-gray-600">
                                            Requested budget: <span className="font-semibold text-gray-900">{formatCurrency(p.budget_total)}</span>
                                        </p>
                                        <div className="flex gap-2">
                                            <button onClick={() => openReject(p)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                                                <XCircle size={14} /> Reject
                                            </button>
                                            <button onClick={() => openApprove(p)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
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
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
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
