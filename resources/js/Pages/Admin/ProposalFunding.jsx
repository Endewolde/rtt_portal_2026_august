import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { BadgeDollarSign, Pencil, RefreshCw, ExternalLink, FileText, ReceiptText, Hash, XCircle, AlertTriangle, User, X, CheckCircle, Clock } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';

function EditAmountModal({ proposal, onSave, onClose }) {
    const [amount, setAmount] = useState(proposal.award?.awarded_amount ?? 0);
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const save = async () => {
        setSaving(true);
        try {
            await api.patch(`/proposals/${proposal.id}/award`, { awarded_amount: parseFloat(amount) });
            success('Awarded amount updated.');
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to update amount.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Set Awarded Amount</h3>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{proposal.title}</p>
                <input type="number" min="0" step="0.01" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4" />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const STATUS_LABELS = {
    draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
    submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
    validated: { label: 'Validated', cls: 'bg-indigo-100 text-indigo-700' },
    under_blind_review: { label: 'Blind Review', cls: 'bg-violet-100 text-violet-700' },
    blind_review_passed: { label: 'BR Passed', cls: 'bg-orange-100 text-orange-700' },
    under_open_defence: { label: 'Open Defence', cls: 'bg-purple-100 text-purple-700' },
    accepted: { label: 'Accepted', cls: 'bg-teal-100 text-teal-700' },
    funded: { label: 'Funded', cls: 'bg-emerald-100 text-emerald-700' },
    midterm_evaluation: { label: 'Midterm', cls: 'bg-cyan-100 text-cyan-700' },
    completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
    archived: { label: 'Archived', cls: 'bg-slate-100 text-slate-600' },
};

function PIHistoryModal({ piId, piName, onClose }) {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/users/${piId}/proposal-history`)
            .then(r => setHistory(r.data?.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [piId]);

    const s = history?.summary;
    const hasWarnings = s && (s.funded_active > 1 || s.unsettled_budgets > 0);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
                <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-white/10 rounded-xl flex items-center justify-center">
                            <User size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">PI Funding History</h2>
                            <p className="text-xs text-slate-400 mt-0.5">{piName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="h-7 w-7 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : !history ? (
                        <p className="text-sm text-gray-500 text-center py-6">Failed to load history.</p>
                    ) : (
                        <>
                            {/* Warnings */}
                            {hasWarnings && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={15} className="text-amber-600" />
                                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Funding Flags</p>
                                    </div>
                                    {s.funded_active > 1 && (
                                        <p className="text-xs text-amber-700">⚠ This PI has <strong>{s.funded_active}</strong> active funded proposals (including this one).</p>
                                    )}
                                    {s.unsettled_budgets > 0 && (
                                        <p className="text-xs text-amber-700">⚠ <strong>{s.unsettled_budgets}</strong> approved budget request(s) with unverified settlement.</p>
                                    )}
                                </div>
                            )}

                            {/* Summary cards */}
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'Total', value: s.total, cls: 'text-gray-700' },
                                    { label: 'Funded', value: s.funded_active, cls: 'text-emerald-700' },
                                    { label: 'Pending', value: s.pending_review, cls: 'text-blue-700' },
                                    { label: 'Rejected', value: s.rejected, cls: 'text-red-700' },
                                ].map(item => (
                                    <div key={item.label} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                                        <div className={`text-xl font-bold ${item.cls}`}>{item.value}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Proposal list */}
                            <div className="space-y-2">
                                {history.proposals.map(p => {
                                    const st = STATUS_LABELS[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' };
                                    return (
                                        <div key={p.id} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
                                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded shrink-0">{p.tracker_number}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-900 truncate">{p.title}</p>
                                                <p className="text-xs text-gray-400">{p.academic_year}</p>
                                            </div>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function RevokeFundingModal({ proposal, onSave, onClose }) {
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const save = async () => {
        if (reason.trim().length < 10) { error('Please provide at least 10 characters explaining the reason.'); return; }
        setSaving(true);
        try {
            const res = await api.post(`/proposals/${proposal.id}/funding/revoke`, { reason });
            success(res.data?.message || 'Funding revoked.');
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to revoke funding.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="h-9 w-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                        <XCircle size={18} className="text-red-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">Revoke Funding</h3>
                </div>
                <p className="text-xs text-gray-500 mb-1 font-mono">{proposal.tracker_number}</p>
                <p className="text-xs text-gray-500 mb-4 line-clamp-2">{proposal.title}</p>

                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                    <p className="text-xs font-semibold text-amber-800">This action is irreversible via normal workflow.</p>
                    <p className="text-xs text-amber-700 mt-0.5">The proposal will be moved to <strong>Rejected</strong> status and the PI will be notified.</p>
                </div>

                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reason for Revocation <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={4}
                    placeholder="Explain why the funding is being revoked..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 resize-none"
                />

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
                        {saving ? 'Revoking…' : 'Revoke Funding'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProposalFunding() {
    const { error } = useToast();
    const [view, setView] = useViewPreference('proposal_funding', 'card');
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [editModal, setEditModal] = useState(null);
    const [revokeModal, setRevokeModal] = useState(null);
    const [piHistory, setPiHistory] = useState(null); // { id, name }

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/proposals', { params: { status: 'funded', per_page: 50 } });
            const items = res.data?.data?.data ?? res.data?.data ?? [];
            const withAwards = await Promise.all(
                items.map(async p => {
                    try {
                        const aRes = await api.get(`/proposals/${p.id}/award`);
                        return { ...p, award: aRes.data?.data ?? null };
                    } catch { return { ...p, award: null }; }
                })
            );
            setProposals(withAwards);
        } catch { error('Failed to load funded proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    return (
        <AppLayout breadcrumb="Proposal Funding">
            <div className="max-w-5xl mx-auto">
                <WorkflowBreadcrumb current="funded" />

                {/* Page Header */}
                <div className="flex items-start justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                            <BadgeDollarSign size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Proposal Funding</h1>
                            <p className="text-sm text-gray-500 mt-0.5">All funded proposals with grant details and award information</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {!loading && proposals.length > 0 && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                                <BadgeDollarSign size={12} /> {proposals.length} Funded
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
                        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <BadgeDollarSign size={28} className="text-emerald-300" />
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1">No funded proposals yet</h3>
                        <p className="text-sm text-gray-400">Approved proposals will appear here once funded.</p>
                    </div>
                ) : view === 'table' ? (
                    <ProposalTable
                        proposals={proposals}
                        showColumns={['tracker','grant_reference','title','pi','college','awarded_amount','status']}
                        actions={(p) => (
                            <a href={`/proposals/${p.id}/award`}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                                Manage Award
                            </a>
                        )}
                        emptyMessage="No funded proposals."
                    />
                ) : (
                    <div className="space-y-3">
                        {proposals.map(p => (
                            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                {/* Top row */}
                                <div className="flex items-stretch">
                                    <div className="w-0.5 bg-emerald-600 shrink-0" />
                                    <div className="flex items-start justify-between gap-4 flex-1 px-4 py-3.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg shrink-0">
                                                    {p.tracker_number}
                                                </span>
                                                {p.award?.grant_reference && (
                                                    <span className="flex items-center gap-1 font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                                                        <Hash size={10} />{p.award.grant_reference}
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-400">{getCategoryLabel(p.category)}</span>
                                            </div>
                                            <h3 className="text-sm font-semibold text-gray-900 truncate mb-0.5">{p.title}</h3>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setPiHistory({ id: p.pi?.id, name: p.pi?.name })}
                                                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                >
                                                    <User size={10} className="inline mr-0.5" />{p.pi?.name}
                                                </button>
                                                <span className="text-xs text-gray-400">· {p.college?.name}</span>
                                            </div>
                                        </div>

                                        {/* Awarded amount badge */}
                                        <div className="shrink-0 text-right">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <span className="text-base font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                                                    {p.award ? formatCurrency(p.award.awarded_amount) : '—'}
                                                </span>
                                                <button
                                                    onClick={() => setEditModal(p)}
                                                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Edit amount"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                            </div>
                                            {p.award?.approved_at && (
                                                <p className="text-xs text-gray-400 mt-1">Awarded {formatDate(p.award.approved_at)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer links */}
                                <div className="flex items-center gap-1 px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
                                    <Link href={`/proposals/${p.id}`}
                                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 font-medium px-2.5 py-1 rounded-lg hover:bg-white transition-colors">
                                        <FileText size={11} /> View Proposal
                                    </Link>
                                    <span className="text-gray-200">·</span>
                                    <Link href={`/proposals/${p.id}/award`}
                                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-emerald-600 font-medium px-2.5 py-1 rounded-lg hover:bg-white transition-colors">
                                        <ExternalLink size={11} /> Award Details
                                    </Link>
                                    <span className="text-gray-200">·</span>
                                    <Link href={`/budget-requests?proposal_id=${p.id}`}
                                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium px-2.5 py-1 rounded-lg hover:bg-white transition-colors">
                                        <ReceiptText size={11} /> Budget Requests
                                    </Link>
                                    <div className="ml-auto">
                                        <button
                                            onClick={() => setRevokeModal(p)}
                                            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                                        >
                                            <XCircle size={11} /> Revoke Funding
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {editModal && (
                <EditAmountModal
                    proposal={editModal}
                    onSave={() => { setEditModal(null); load(); }}
                    onClose={() => setEditModal(null)}
                />
            )}

            {revokeModal && (
                <RevokeFundingModal
                    proposal={revokeModal}
                    onSave={() => { setRevokeModal(null); load(); }}
                    onClose={() => setRevokeModal(null)}
                />
            )}

            {piHistory && (
                <PIHistoryModal
                    piId={piHistory.id}
                    piName={piHistory.name}
                    onClose={() => setPiHistory(null)}
                />
            )}
        </AppLayout>
    );
}
