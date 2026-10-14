import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, RefreshCw, Clock, CheckCircle, AlertCircle, FileX, X, Eye } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatDate, getCategoryLabel } from '../../lib/utils';
import RejectWithReasonModal from '../../Components/RejectWithReasonModal';

const TABS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Not Submitted' },
    { value: 'submitted', label: 'Awaiting Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
];

const STATUS_STYLES = {
    pending: 'bg-gray-100 text-gray-600 border-gray-200',
    submitted: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    expired: 'bg-red-50 text-red-700 border-red-200',
};

function KpiCard({ icon: Icon, label, value, tone, active, onClick }) {
    const tones = {
        gray: 'bg-gray-50 text-gray-600 border-gray-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        red: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
        <button
            onClick={onClick}
            className={`text-left bg-white border rounded-2xl p-4 shadow-sm transition-all active:scale-95 touch-manipulation ${
                active ? 'border-purple-400 ring-2 ring-purple-100' : 'border-gray-100 hover:border-gray-200'
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

function ReviewModal({ proposal, onClose, onDone }) {
    const { success, error } = useToast();
    const [certUrl, setCertUrl] = useState(null);
    const [loadingCert, setLoadingCert] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    useEffect(() => {
        const cert = (proposal.documents ?? []).find(d => d.document_type === 'ethical_clearance_certificate' && d.is_current);
        if (!cert) { setLoadingCert(false); return; }
        const token = localStorage.getItem('rtt_token');
        fetch(`/api/v1/proposals/${proposal.id}/documents/${cert.id}/download`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.blob())
            .then(blob => setCertUrl(URL.createObjectURL(blob)))
            .catch(() => setCertUrl(null))
            .finally(() => setLoadingCert(false));
    }, [proposal.id]);

    const approve = async () => {
        setSaving(true);
        try {
            await api.post(`/proposals/${proposal.id}/ethical-clearance/approve`);
            success('Ethical clearance approved.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to approve.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                <div className="flex items-start justify-between p-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <Eye size={18} className="text-purple-600" /> Review Ethical Clearance Certificate
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">{proposal.tracker_number} — {proposal.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Ref: <span className="font-mono">{proposal.ethical_clearance_number}</span> · Expires {formatDate(proposal.ethical_clearance_expiry)}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-hidden bg-gray-100 min-h-100">
                    {loadingCert ? (
                        <div className="flex items-center justify-center h-full py-16">
                            <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : certUrl ? (
                        <iframe src={certUrl} className="w-full h-full min-h-100" title="Ethical Clearance Certificate" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                            <AlertCircle size={32} className="mb-2" />
                            <p className="text-sm">Unable to load certificate preview.</p>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 space-y-3">
                        <div className="flex gap-3 justify-end">
                            <button onClick={onClose} disabled={saving}
                                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                                Close
                            </button>
                            <button onClick={() => setRejecting(true)} disabled={saving}
                                className="px-4 py-2 text-sm font-semibold text-red-700 border border-red-300 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50">
                                Reject &amp; Return
                            </button>
                            <button onClick={approve} disabled={saving}
                                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                                {saving ? 'Saving…' : 'Approve'}
                            </button>
                        </div>
                </div>
            </div>

            {rejecting && (
                <RejectWithReasonModal
                    context="ethical_clearance"
                    title="Reject & Return Certificate"
                    subtitle={`${proposal.tracker_number ?? ''} · ${proposal.title ?? ''}`}
                    note="The certificate is returned to the PI with this reason so they can upload a corrected one."
                    confirmLabel="Return to PI"
                    onClose={() => setRejecting(false)}
                    onSubmit={async (payload) => {
                        await api.post(`/proposals/${proposal.id}/ethical-clearance/reject`, payload);
                        success('Certificate returned to PI for correction.');
                        onDone();
                    }}
                />
            )}
        </div>
    );
}

export default function EthicalClearance() {
    const { error } = useToast();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('submitted');
    const [reviewing, setReviewing] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/ethical-clearances', { params: { per_page: 200 } });
            setProposals(res.data?.data?.data ?? res.data?.data ?? []);
        } catch {
            error('Failed to load ethical clearances.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const counts = useMemo(() => ({
        all: proposals.length,
        pending: proposals.filter(p => p.ethical_clearance_status === 'pending').length,
        submitted: proposals.filter(p => p.ethical_clearance_status === 'submitted').length,
        approved: proposals.filter(p => p.ethical_clearance_status === 'approved').length,
        rejected: proposals.filter(p => p.ethical_clearance_status === 'rejected').length,
        expired: proposals.filter(p => p.ethical_clearance_status === 'expired').length,
    }), [proposals]);

    const visible = statusFilter === 'all'
        ? proposals
        : proposals.filter(p => p.ethical_clearance_status === statusFilter);

    return (
        <AppLayout breadcrumb="Ethical Clearance">
            <div className="max-w-6xl mx-auto space-y-5">

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ShieldCheck size={22} className="text-purple-600" /> Ethical Clearance
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Track and verify research ethics compliance across proposals</p>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <KpiCard icon={FileX} label="Not Submitted" value={counts.pending} tone="gray"
                        active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} />
                    <KpiCard icon={Clock} label="Awaiting Review" value={counts.submitted} tone="amber"
                        active={statusFilter === 'submitted'} onClick={() => setStatusFilter('submitted')} />
                    <KpiCard icon={CheckCircle} label="Approved" value={counts.approved} tone="emerald"
                        active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')} />
                    <KpiCard icon={AlertCircle} label="Rejected / Expired" value={counts.rejected + counts.expired} tone="red"
                        active={statusFilter === 'rejected' || statusFilter === 'expired'} onClick={() => setStatusFilter('expired')} />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {TABS.map(t => (
                        <button key={t.value} onClick={() => setStatusFilter(t.value)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                                statusFilter === t.value
                                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}>
                            {t.label} ({counts[t.value]})
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <ShieldCheck size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No proposals found for the selected filter.</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                        {visible.map(p => (
                            <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <a href={`/proposals/${p.id}`}
                                            className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">
                                            {p.tracker_number}
                                        </a>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                            {getCategoryLabel(p.category)}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLES[p.ethical_clearance_status] ?? STATUS_STYLES.pending}`}>
                                            {TABS.find(t => t.value === p.ethical_clearance_status)?.label ?? 'Not Submitted'}
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{p.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {p.pi?.name} · {p.college?.name}
                                        {p.ethical_clearance_number && <> · Ref: <span className="font-mono">{p.ethical_clearance_number}</span></>}
                                        {p.ethical_clearance_expiry && <> · Expires {formatDate(p.ethical_clearance_expiry)}</>}
                                    </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    <a href={`/proposals/${p.id}`}
                                        className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                                        View
                                    </a>
                                    {p.ethical_clearance_status === 'submitted' && (
                                        <button onClick={() => setReviewing(p)}
                                            className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
                                            Review
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {reviewing && (
                <ReviewModal
                    proposal={reviewing}
                    onClose={() => setReviewing(null)}
                    onDone={() => {
                        setReviewing(null);
                        load();
                    }}
                />
            )}
        </AppLayout>
    );
}
