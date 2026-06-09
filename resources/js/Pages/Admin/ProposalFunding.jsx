import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { BadgeDollarSign, Pencil, Check, RefreshCw } from 'lucide-react';
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

export default function ProposalFunding() {
    const { error } = useToast();
    const [view, setView] = useViewPreference('proposal_funding', 'card');
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [editModal, setEditModal] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/proposals', { params: { status: 'funded', per_page: 50 } });
            const items = res.data?.data?.data ?? res.data?.data ?? [];
            // Load award for each proposal
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
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <BadgeDollarSign size={22} className="text-emerald-600" /> Proposal Funding
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">All funded proposals with grant details</p>
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
                        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <BadgeDollarSign size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No funded proposals yet.</p>
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
                            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                {p.tracker_number}
                                            </span>
                                            {p.award?.grant_reference && (
                                                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                    {p.award.grant_reference}
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400">{getCategoryLabel(p.category)}</span>
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-0.5">{p.title}</h3>
                                        <p className="text-xs text-gray-500">{p.pi?.name} · {p.college?.name}</p>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <div className="flex items-center gap-1">
                                            <span className="text-lg font-bold text-emerald-700">
                                                {p.award ? formatCurrency(p.award.awarded_amount) : '—'}
                                            </span>
                                            <button onClick={() => setEditModal(p)}
                                                className="p-1 text-gray-400 hover:text-emerald-600 rounded">
                                                <Pencil size={13} />
                                            </button>
                                        </div>
                                        {p.award?.approved_at && (
                                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.award.approved_at)}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                                    <Link href={`/proposals/${p.id}`}
                                        className="text-xs text-blue-600 hover:underline">View Proposal</Link>
                                    <Link href={`/proposals/${p.id}/award`}
                                        className="text-xs text-emerald-600 hover:underline">Award Details</Link>
                                    <Link href={`/budget-requests?proposal_id=${p.id}`}
                                        className="text-xs text-gray-500 hover:underline">Budget Requests</Link>
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
        </AppLayout>
    );
}
