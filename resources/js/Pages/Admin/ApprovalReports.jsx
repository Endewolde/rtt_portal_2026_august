import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { ShieldQuestion, RefreshCw, Clock, CheckCircle2, XCircle, User, CalendarDays, ChevronRight } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';
import ResolveApprovalReportModal from '../../Components/ResolveApprovalReportModal';

const TABS = [
    { key: 'open', label: 'Open', icon: Clock, dot: true },
    { key: 'reviewed', label: 'Reviewed', icon: CheckCircle2, dot: false },
    { key: 'withdrawn', label: 'Cancelled', icon: XCircle, dot: false },
];

const TAB_STYLES = {
    open: { icon: 'text-amber-500' },
    reviewed: { icon: 'text-emerald-500' },
    withdrawn: { icon: 'text-gray-400' },
};

const STATUS_LABELS = {
    submitted: 'Submitted', validated: 'Validated', under_blind_review: 'Under Blind Review',
    blind_review_passed: 'Blind Review Passed', under_open_defence: 'Under Open Defence',
    accepted: 'Central Evaluation', funded: 'Funded', rejected: 'Rejected',
};

export default function ApprovalReports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('open');
    const [reviewing, setReviewing] = useState(null);
    const [canResolve, setCanResolve] = useState(false);
    const { error } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res = await get('/approval-reports', { status: filter, per_page: 200 });
            setReports(res.data?.data ?? []);
            setCanResolve(res.meta?.can_resolve ?? false);
        } catch { error('Failed to load approval reports.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filter]);

    const activeTab = TABS.find(t => t.key === filter);
    const ts = TAB_STYLES[filter];

    return (
        <AppLayout breadcrumb="Approval Reports">
            <div className="max-w-4xl mx-auto space-y-6">

                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
                            <ShieldQuestion size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Approval Reports</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {canResolve
                                    ? 'Proposals a college officer flagged as possibly mistakenly approved'
                                    : 'Track the status of the mistaken-approval reports you\'ve filed'}
                            </p>
                        </div>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                <div className="flex gap-2">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = filter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setFilter(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                                    active
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${filter === 'open' ? 'bg-amber-50' : filter === 'withdrawn' ? 'bg-gray-100' : 'bg-emerald-50'}`}>
                            {activeTab && <activeTab.icon size={28} className={ts.icon} />}
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1">No {filter} reports</h3>
                        <p className="text-sm text-gray-400">
                            {filter === 'open'
                                ? 'No approval reports awaiting review.'
                                : filter === 'withdrawn' ? 'No reports have been cancelled.' : 'No reports have been reviewed yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.map(rep => (
                            <ReportCard key={rep.id} report={rep} filter={filter} canResolve={canResolve} onReview={() => setReviewing(rep)} />
                        ))}
                    </div>
                )}
            </div>

            {reviewing && (
                <ResolveApprovalReportModal
                    report={reviewing}
                    onSaved={() => { setReviewing(null); load(); }}
                    onClose={() => setReviewing(null)}
                />
            )}
        </AppLayout>
    );
}

function ReportCard({ report, filter, canResolve, onReview }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${filter === 'open' ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className={`h-0.5 w-full ${filter === 'open' ? 'bg-amber-500' : filter === 'withdrawn' ? 'bg-gray-300' : 'bg-emerald-500'}`} />

            <div className="p-5">
                <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${filter === 'open' ? 'bg-amber-50' : filter === 'withdrawn' ? 'bg-gray-100' : 'bg-emerald-50'}`}>
                        {filter === 'open'
                            ? <Clock size={18} className="text-amber-500" />
                            : filter === 'withdrawn' ? <XCircle size={18} className="text-gray-400" /> : <CheckCircle2 size={18} className="text-emerald-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Link
                                href={`/proposals/${report.proposal_id}`}
                                className="font-mono text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg"
                            >
                                {report.proposal?.tracker_number}
                            </Link>
                            <span className="text-xs text-gray-400">{getCategoryLabel(report.proposal?.category)}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                                {STATUS_LABELS[report.proposal?.status] ?? report.proposal?.status}
                            </span>
                        </div>

                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-2">
                            {report.proposal?.title}
                        </h3>

                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <User size={11} /> {report.reported_by?.name}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <CalendarDays size={11} /> Reported {formatDate(report.created_at)}
                            </span>
                        </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                        {filter === 'open' && canResolve && (
                            <button
                                onClick={onReview}
                                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
                            >
                                Review <ChevronRight size={13} />
                            </button>
                        )}
                        {filter === 'open' && !canResolve && (
                            <span className="text-xs font-medium text-amber-600 whitespace-nowrap">Awaiting response</span>
                        )}
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            title={expanded ? 'Collapse' : 'Expand'}
                        >
                            <ChevronRight size={16} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                        <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reported Reason</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{report.reason}</p>
                        </div>

                        {report.resolution_notes && (
                            <div className={`rounded-xl p-4 border ${report.outcome === 'approval_revoked' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${report.outcome === 'approval_revoked' ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {report.outcome === 'approval_revoked'
                                        ? 'Mistaken approval confirmed — proposal rejected'
                                        : report.outcome === 'approval_stands' ? 'Approval stands' : 'Resolution Notes'}
                                </p>
                                <p className="text-sm text-gray-700 leading-relaxed">{report.resolution_notes}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                    {report.reviewed_by?.name} · {formatDate(report.reviewed_at)}
                                </p>
                            </div>
                        )}

                        {filter === 'withdrawn' && (
                            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                                <XCircle size={12} />
                                Cancelled by {report.reported_by?.name ?? 'the reporting officer'} · {formatDate(report.withdrawn_at)}
                            </p>
                        )}
                        {filter === 'reviewed' && !report.resolution_notes && (
                            <p className="text-xs text-gray-400">
                                Reviewed by {report.reviewed_by?.name} · {formatDate(report.reviewed_at)}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
