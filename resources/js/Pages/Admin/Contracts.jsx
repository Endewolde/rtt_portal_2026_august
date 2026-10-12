import { useState, useEffect, useMemo } from 'react';
import { FileSignature, RefreshCw, Clock, CheckCircle, AlertCircle, FileX } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ProposalTable from '../../Components/ProposalTable';
import ContractReviewModal from '../../Components/ContractReviewModal';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';

const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];

const TABS = [
    { value: 'all',        label: 'All' },
    { value: 'null',       label: 'Not Submitted' },
    { value: 'pending',    label: 'Pending Review' },
    { value: 'approved',   label: 'Approved' },
    { value: 'rejected',   label: 'Rejected' },
];

function KpiCard({ icon: Icon, label, value, tone, active, onClick }) {
    const tones = {
        gray:    'bg-gray-50 text-gray-600 border-gray-200',
        blue:    'bg-blue-50 text-blue-700 border-blue-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        red:     'bg-red-50 text-red-700 border-red-200',
    };
    return (
        <button
            onClick={onClick}
            className={`text-left bg-white border rounded-2xl p-4 shadow-sm transition-all active:scale-95 touch-manipulation ${
                active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'
            }`}
        >
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border mb-3 ${tones[tone]}`}>
                <Icon size={16} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </button>
    );
}

export default function Contracts() {
    const { error } = useToast();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [contractProposal, setContractProposal] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const results = await Promise.all(
                FUNDED_STATUSES.map(s =>
                    api.get('/proposals', { params: { status: s, per_page: 200 } })
                        .then(r => r.data?.data?.data ?? r.data?.data ?? [])
                        .catch(() => [])
                )
            );
            setProposals(results.flat());
        } catch {
            error('Failed to load contracts.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const counts = useMemo(() => ({
        all:      proposals.length,
        null:     proposals.filter(p => !p.contract_status).length,
        pending:  proposals.filter(p => p.contract_status === 'pending').length,
        approved: proposals.filter(p => p.contract_status === 'approved').length,
        rejected: proposals.filter(p => p.contract_status === 'rejected').length,
    }), [proposals]);

    const visible = statusFilter === 'all'
        ? proposals
        : proposals.filter(p => (p.contract_status ?? 'null') === statusFilter);

    // Sort pending-longest-first within the pending tab so stuck contracts surface first.
    const sorted = statusFilter === 'pending'
        ? [...visible].sort((a, b) => new Date(a.contract_submitted_at ?? 0) - new Date(b.contract_submitted_at ?? 0))
        : visible;

    return (
        <AppLayout breadcrumb="Contracts">
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Page header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <FileSignature size={22} className="text-blue-600" /> Contracts
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Contract submission and approval status across all funded proposals</p>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <KpiCard icon={FileX} label="Not Submitted" value={counts.null} tone="gray"
                        active={statusFilter === 'null'} onClick={() => setStatusFilter('null')} />
                    <KpiCard icon={Clock} label="Pending Review" value={counts.pending} tone="blue"
                        active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} />
                    <KpiCard icon={CheckCircle} label="Approved" value={counts.approved} tone="emerald"
                        active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')} />
                    <KpiCard icon={AlertCircle} label="Rejected" value={counts.rejected} tone="red"
                        active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')} />
                </div>

                {/* Status filter tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {TABS.map(t => (
                        <button key={t.value} onClick={() => setStatusFilter(t.value)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                                statusFilter === t.value
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}>
                            {t.label} ({counts[t.value]})
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <ProposalTable
                        proposals={sorted}
                        showColumns={['tracker', 'title', 'pi', 'college', 'category', 'contract_status', 'contract_submitted']}
                        actions={(p) => (
                            <div className="flex items-center justify-end gap-2">
                                <a href={`/proposals/${p.id}`}
                                    className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                                    View
                                </a>
                                {p.contract_status === 'pending' && (
                                    <button onClick={() => setContractProposal(p)}
                                        className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                                        Review
                                    </button>
                                )}
                            </div>
                        )}
                        emptyMessage="No proposals found for the selected filter."
                    />
                )}
            </div>

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
