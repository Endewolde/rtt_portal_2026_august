import { useState, useEffect, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import { Wallet, RefreshCw, Clock, CheckCircle, XCircle, User, CalendarDays, ChevronRight } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

const TABS = [
    { key: 'pending', label: 'Pending', icon: Clock, dot: true },
    { key: 'approved', label: 'Approved', icon: CheckCircle, dot: false },
    { key: 'denied', label: 'Denied', icon: XCircle, dot: false },
];

const TAB_STYLES = {
    pending: { icon: 'text-amber-500' },
    approved: { icon: 'text-emerald-500' },
    denied: { icon: 'text-red-500' },
};

function ReviewModal({ revision, onSave, onClose }) {
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const approve = async () => {
        setSaving(true);
        try {
            const res = await post(`/budget-revisions/${revision.id}/approve`, {});
            success(res?.message || 'Budget revision approved.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to approve budget revision.');
        }
        setSaving(false);
    };

    const reject = async () => {
        if (reason.trim().length < 10) { error('Please provide at least 10 characters explaining the denial.'); return; }
        setSaving(true);
        try {
            const res = await post(`/budget-revisions/${revision.id}/reject`, { reason });
            success(res?.message || 'Budget revision denied.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to deny budget revision.');
        }
        setSaving(false);
    };

    const delta = Number(revision.requested_total) - Number(revision.current_total);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="bg-linear-to-r from-slate-800 to-slate-700 px-6 py-5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                            <Wallet size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Review Budget Revision</h2>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{revision.proposal?.tracker_number}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">PI's Reason</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{revision.reason}</p>
                        <p className="text-xs text-slate-400 mt-2">
                            {revision.requested_by?.name} · {formatDate(revision.created_at)}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="border border-gray-200 rounded-xl p-3">
                            <p className="text-xs text-gray-500">Current Total</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(revision.current_total)}</p>
                        </div>
                        <div className={`border rounded-xl p-3 ${delta >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                            <p className="text-xs text-gray-500">Requested Total</p>
                            <p className={`text-lg font-bold ${delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                {formatCurrency(revision.requested_total)}
                                <span className="text-xs font-medium ml-1.5">({delta >= 0 ? '+' : ''}{formatCurrency(delta)})</span>
                            </p>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">Requested Line Items</p>
                        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                            {(revision.requested_items ?? []).map((item, i) => (
                                <div key={i} className="p-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-gray-500 capitalize">{item.category}</p>
                                        <p className="text-sm text-gray-900">{item.item_description}</p>
                                        {item.justification && <p className="text-xs text-gray-500 mt-0.5">{item.justification}</p>}
                                    </div>
                                    <span className="shrink-0 text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {rejecting && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Reason for Denial <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                rows={3}
                                placeholder="Explain why this revision is being denied…"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                            />
                        </div>
                    )}
                </div>

                <div className="p-6 pt-0 shrink-0">
                    {rejecting ? (
                        <div className="flex gap-3">
                            <button onClick={() => setRejecting(false)} disabled={saving} className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
                                Back
                            </button>
                            <button onClick={reject} disabled={saving || reason.trim().length < 10} className="flex-1 px-4 py-2.5 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700 font-semibold disabled:opacity-50">
                                {saving ? 'Saving…' : 'Confirm Denial'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
                                Cancel
                            </button>
                            <button onClick={() => setRejecting(true)} disabled={saving} className="flex-1 px-4 py-2.5 text-sm text-red-700 border-2 border-red-200 rounded-xl hover:bg-red-50 font-semibold">
                                Deny
                            </button>
                            <button onClick={approve} disabled={saving} className="flex-1 px-4 py-2.5 text-sm text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 font-semibold disabled:opacity-50">
                                {saving ? 'Saving…' : 'Approve & Apply'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function BudgetRevisions() {
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [reviewing, setReviewing] = useState(null);
    const { error } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res = await get('/budget-revisions', { per_page: 200 });
            setRevisions(res.data?.data ?? []);
        } catch { error('Failed to load budget revision requests.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const counts = useMemo(() => ({
        pending: revisions.filter(r => r.status === 'pending').length,
        approved: revisions.filter(r => r.status === 'approved').length,
        denied: revisions.filter(r => r.status === 'denied').length,
    }), [revisions]);

    const visible = revisions.filter(r => r.status === filter);
    const activeTab = TABS.find(t => t.key === filter);
    const ts = TAB_STYLES[filter];

    return (
        <AppLayout breadcrumb="Budget Revisions">
            <div className="max-w-4xl mx-auto space-y-6">

                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
                            <Wallet size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Budget Revisions</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Review PI requests to change a funded proposal's budget</p>
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
                        const count = counts[tab.key];
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
                                {count > 0 && (
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                                        active
                                            ? 'bg-white/20 text-white'
                                            : tab.key === 'pending' ? 'bg-amber-100 text-amber-700' : tab.key === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                            filter === 'pending' ? 'bg-amber-50' : filter === 'approved' ? 'bg-emerald-50' : 'bg-red-50'
                        }`}>
                            {activeTab && <activeTab.icon size={28} className={ts.icon} />}
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1">No {filter} requests</h3>
                        <p className="text-sm text-gray-400">
                            {filter === 'pending' ? 'No budget revision requests awaiting review.' : `No ${filter} requests to show.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visible.map(rev => (
                            <RevisionCard key={rev.id} revision={rev} filter={filter} onReview={() => setReviewing(rev)} />
                        ))}
                    </div>
                )}
            </div>

            {reviewing && (
                <ReviewModal
                    revision={reviewing}
                    onSave={() => { setReviewing(null); load(); }}
                    onClose={() => setReviewing(null)}
                />
            )}
        </AppLayout>
    );
}

function RevisionCard({ revision, filter, onReview }) {
    const [expanded, setExpanded] = useState(false);
    const delta = Number(revision.requested_total) - Number(revision.current_total);

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${filter === 'pending' ? 'border-amber-200' : filter === 'approved' ? 'border-emerald-200' : 'border-gray-200'}`}>
            <div className={`h-0.5 w-full ${filter === 'pending' ? 'bg-amber-500' : filter === 'approved' ? 'bg-emerald-500' : 'bg-red-500'}`} />

            <div className="p-5">
                <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        filter === 'pending' ? 'bg-amber-50' : filter === 'approved' ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                        {filter === 'pending' && <Clock size={18} className="text-amber-500" />}
                        {filter === 'approved' && <CheckCircle size={18} className="text-emerald-500" />}
                        {filter === 'denied' && <XCircle size={18} className="text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Link
                                href={`/proposals/${revision.proposal_id}`}
                                className="font-mono text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg"
                            >
                                {revision.proposal?.tracker_number}
                            </Link>
                            <span className="text-xs text-gray-400">{getCategoryLabel(revision.proposal?.category)}</span>
                        </div>

                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-2">
                            {revision.proposal?.title}
                        </h3>

                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <User size={11} /> {revision.requested_by?.name}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <CalendarDays size={11} /> Requested {formatDate(revision.created_at)}
                            </span>
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(revision.current_total)} → {formatCurrency(revision.requested_total)}
                            </span>
                        </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                        {filter === 'pending' && (
                            <button
                                onClick={onReview}
                                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
                            >
                                Review <ChevronRight size={13} />
                            </button>
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
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reason</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{revision.reason}</p>
                        </div>

                        {revision.resolution_notes && (
                            <div className={`rounded-xl p-4 ${filter === 'approved' ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${filter === 'approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    Resolution Notes
                                </p>
                                <p className="text-sm text-gray-700 leading-relaxed">{revision.resolution_notes}</p>
                                {revision.resolved_at && (
                                    <p className="text-xs text-gray-400 mt-2">{formatDate(revision.resolved_at)}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
