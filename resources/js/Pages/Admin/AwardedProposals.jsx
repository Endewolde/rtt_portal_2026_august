import { useState, useEffect, useRef } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { Trophy, RefreshCw, Calendar, Download, ChevronDown, FileSignature, CheckCircle, Upload, X, Clock, AlertCircle, Eye } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';

const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];

const CATEGORIES = [
    { value: 'research',             label: 'Research' },
    { value: 'community_engagement', label: 'Community Engagement' },
    { value: 'technology_transfer',  label: 'Technology Transfer' },
    { value: 'innovation',           label: 'Innovation' },
    { value: 'other',                label: 'Other' },
];

const ROLE_CATEGORY = {
    research_officer:   'research',
    community_officer:  'community_engagement',
    technology_officer: 'technology_transfer',
};

function ExportButton({ yearFilter, statusFilter }) {
    const { error, success } = useToast();
    const { auth } = usePage().props;
    const roles = (auth?.user?.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
    const [open, setOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const ref = useRef(null);

    // Determine which category this role is locked to (null = admin, can pick)
    const lockedCategory = (() => {
        for (const [role, cat] of Object.entries(ROLE_CATEGORY)) {
            if (roles.includes(role)) return cat;
        }
        return null;
    })();

    const isAdmin = lockedCategory === null;

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
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            const cd   = res.headers.get('Content-Disposition') ?? '';
            const match = cd.match(/filename="([^"]+)"/);
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

    // Officers: single button, no dropdown
    if (!isAdmin) {
        const catLabel = CATEGORIES.find(c => c.value === lockedCategory)?.label ?? lockedCategory;
        return (
            <button
                onClick={() => doExport(lockedCategory)}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
                {exporting
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <Download size={14} />
                }
                {exporting ? 'Exporting…' : `Export ${catLabel}`}
            </button>
        );
    }

    // Admins: dropdown with all categories + "All"
    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
                {exporting
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <Download size={14} />
                }
                {exporting ? 'Exporting…' : 'Export CSV'}
                {!exporting && <ChevronDown size={13} />}
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                    <button
                        onClick={() => doExport(null)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-semibold border-b border-gray-100"
                    >
                        All Categories
                    </button>
                    {CATEGORIES.map(c => (
                        <button
                            key={c.value}
                            onClick={() => doExport(c.value)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ContractReviewModal({ proposal, onClose, onDone }) {
    const { success, error } = useToast();
    const [pdfUrl, setPdfUrl] = useState(null);
    const [loadingPdf, setLoadingPdf] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('rtt_token');
        fetch(`/api/v1/proposals/${proposal.id}/contract/download`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.blob())
            .then(blob => setPdfUrl(URL.createObjectURL(blob)))
            .catch(() => setPdfUrl(null))
            .finally(() => setLoadingPdf(false));
        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    }, [proposal.id]);

    const approve = async () => {
        setSaving(true);
        try {
            await api.post(`/proposals/${proposal.id}/contract/approve`);
            success('Contract approved. PI may now submit their first budget request.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to approve contract.');
        }
        setSaving(false);
    };

    const reject = async () => {
        if (!reason.trim()) { error('Please provide a reason for rejection.'); return; }
        setSaving(true);
        try {
            await api.post(`/proposals/${proposal.id}/contract/reject`, { reason });
            success('Contract returned to PI for correction.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to reject contract.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <Eye size={18} className="text-blue-600" /> Review Submitted Contract
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">{proposal.tracker_number} — {proposal.title}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>

                {/* PDF viewer */}
                <div className="flex-1 overflow-hidden bg-gray-100 min-h-100">
                    {loadingPdf ? (
                        <div className="flex items-center justify-center h-full py-16">
                            <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full min-h-100" title="Contract PDF" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                            <AlertCircle size={32} className="mb-2" />
                            <p className="text-sm">Unable to load PDF preview.</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-5 border-t border-gray-100 space-y-3">
                    {rejecting ? (
                        <div className="space-y-3">
                            <label className="text-xs font-medium text-gray-700 block">Reason for rejection (sent to PI)</label>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                placeholder="Explain what needs to be corrected…"
                            />
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setRejecting(false)} disabled={saving}
                                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                                    Back
                                </button>
                                <button onClick={reject} disabled={saving || !reason.trim()}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                                    {saving ? 'Sending…' : 'Return to PI'}
                                </button>
                            </div>
                        </div>
                    ) : (
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
                                {saving ? 'Saving…' : 'Approve Contract'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AwardedProposals() {
    const { error } = useToast();
    const [view, setView]               = useViewPreference('awarded_proposals', 'card');
    const [contractProposal, setContractProposal] = useState(null);
    const [proposals, setProposals]     = useState([]);
    const [loading, setLoading]         = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [yearFilter, setYearFilter]   = useState('all');

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
            const all = results.flat();
            const withAwards = await Promise.all(
                all.map(async p => {
                    try {
                        const r = await api.get(`/proposals/${p.id}/award`);
                        return { ...p, award: r.data?.data ?? null };
                    } catch { return { ...p, award: null }; }
                })
            );
            setProposals(withAwards);
        } catch { error('Failed to load awarded proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const academicYears = ['all', ...Array.from(new Set(proposals.map(p => p.academic_year).filter(Boolean))).sort().reverse()];

    const visible = proposals.filter(p =>
        (statusFilter === 'all' || p.status === statusFilter) &&
        (yearFilter === 'all' || p.academic_year === yearFilter)
    );

    // Summary per academic year for the year selector
    const yearSummary = (year) => {
        const group = year === 'all' ? proposals : proposals.filter(p => p.academic_year === year);
        return {
            count: group.length,
            total: group.reduce((s, p) => s + parseFloat(p.award?.awarded_amount ?? 0), 0),
        };
    };

    return (
        <AppLayout breadcrumb="Awarded Proposals">
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Page header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Trophy size={22} className="text-amber-500" /> Awarded Proposals
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">All proposals that have been funded or are in post-award phases</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ViewToggle view={view} onChange={setView} />
                        <ExportButton yearFilter={yearFilter} statusFilter={statusFilter} />
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Academic year selector */}
                {!loading && (
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar size={14} className="text-amber-500" />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Academic Year</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {academicYears.map(y => {
                                const s = yearSummary(y);
                                const active = yearFilter === y;
                                return (
                                    <button key={y} onClick={() => setYearFilter(y)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                            active
                                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700'
                                        }`}>
                                        <span>{y === 'all' ? 'All Years' : y}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${
                                            active ? 'bg-amber-400/50 text-white' : 'bg-gray-100 text-gray-500'
                                        }`}>{s.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {yearFilter !== 'all' && (
                            <p className="text-xs text-gray-400 mt-2">
                                {yearSummary(yearFilter).count} proposals · Total awarded:{' '}
                                <span className="font-semibold text-emerald-600">{formatCurrency(yearSummary(yearFilter).total)}</span>
                            </p>
                        )}
                    </div>
                )}

                {/* Status filter tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[['all', 'All'], ...FUNDED_STATUSES.map(s => [s, s.replace('_', ' ')])].map(([val, label]) => {
                        const cnt = val === 'all'
                            ? proposals.filter(p => yearFilter === 'all' || p.academic_year === yearFilter).length
                            : proposals.filter(p => p.status === val && (yearFilter === 'all' || p.academic_year === yearFilter)).length;
                        return (
                            <button key={val} onClick={() => setStatusFilter(val)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap capitalize transition-colors ${
                                    statusFilter === val
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}>
                                {label} ({cnt})
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <Trophy size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No proposals found for the selected filters.</p>
                    </div>
                ) : view === 'table' ? (
                    <ProposalTable
                        proposals={visible}
                        showColumns={['grant_reference','tracker','title','pi','college','category','awarded_amount','status']}
                        actions={(p) => (
                            <a href={`/proposals/${p.id}/award`}
                                className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                                Award Details
                            </a>
                        )}
                        emptyMessage="No awarded proposals found."
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {visible.map(p => (
                            <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    {p.award?.grant_reference ? (
                                        <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                                            <Trophy size={11} /> {p.award.grant_reference}
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                                            No grant reference
                                        </div>
                                    )}
                                    <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg font-medium shrink-0">
                                        {p.academic_year}
                                    </span>
                                </div>

                                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2">{p.title}</h3>

                                <div className="flex items-center gap-2 mb-3">
                                    <StatusBadge status={p.status} />
                                    <span className="text-xs text-gray-400">{getCategoryLabel(p.category)}</span>
                                </div>

                                <div className="text-xs text-gray-500 mb-3">
                                    <p>{p.pi?.name} · {p.college?.name}</p>
                                    {p.award?.approved_at && (
                                        <p className="mt-0.5">Awarded {formatDate(p.award.approved_at)}</p>
                                    )}
                                </div>

                                {p.award && (
                                    <div className="text-lg font-bold text-emerald-700 mb-3">
                                        {formatCurrency(p.award.awarded_amount)}
                                    </div>
                                )}

                                {/* Contract status */}
                                {p.status === 'funded' && (
                                    p.contract_status === 'approved' ? (
                                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mb-3">
                                            <CheckCircle size={12} /> Contract approved {formatDate(p.contract_signed_at)}
                                        </div>
                                    ) : p.contract_status === 'pending' ? (
                                        <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 mb-3">
                                            <Clock size={12} /> Contract pending review
                                        </div>
                                    ) : p.contract_status === 'rejected' ? (
                                        <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 mb-3">
                                            <AlertCircle size={12} /> Contract returned to PI
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
                                            <FileSignature size={12} /> Awaiting contract upload
                                        </div>
                                    )
                                )}

                                <div className="flex items-center gap-3 pt-3 border-t border-gray-100 flex-wrap">
                                    <Link href={`/proposals/${p.id}`} className="text-xs text-blue-600 hover:underline">View Proposal</Link>
                                    {p.award && (
                                        <Link href={`/proposals/${p.id}/award`} className="text-xs text-emerald-600 hover:underline">Award Details</Link>
                                    )}
                                    <Link href={`/budget-requests?proposal_id=${p.id}`} className="text-xs text-gray-500 hover:underline">Budget Requests</Link>
                                    {p.status === 'funded' && p.contract_status === 'pending' && (
                                        <button onClick={() => setContractProposal(p)}
                                            className="text-xs text-blue-700 hover:underline font-medium">
                                            Review Contract
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
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
