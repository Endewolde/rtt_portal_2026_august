import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { Scale, CheckCircle, XCircle, Clock, RefreshCw, FileText, User, CalendarDays, ChevronRight } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

const TABS = [
    { key: 'pending',  label: 'Pending',  icon: Clock,        color: 'amber',  dot: true },
    { key: 'approved', label: 'Approved', icon: CheckCircle,  color: 'emerald', dot: false },
    { key: 'denied',   label: 'Denied',   icon: XCircle,      color: 'red',    dot: false },
];

const TAB_STYLES = {
    pending:  { badge: 'bg-amber-100 text-amber-700 border-amber-200',  bar: 'bg-amber-500',  row: 'border-amber-200', icon: 'text-amber-500' },
    approved: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', row: 'border-emerald-200', icon: 'text-emerald-500' },
    denied:   { badge: 'bg-red-100 text-red-700 border-red-200',        bar: 'bg-red-500',    row: 'border-red-200',   icon: 'text-red-500' },
};

function ResolveModal({ appeal, onSave, onClose }) {
    const [decision, setDecision] = useState('approved');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const submit = async () => {
        if (notes.trim().length < 10) { error('Resolution notes must be at least 10 characters.'); return; }
        setSaving(true);
        try {
            const res = await post(`/appeals/${appeal.id}/resolve`, { decision, resolution_notes: notes });
            success(res?.message || 'Appeal resolved.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to resolve appeal.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Modal header */}
                <div className="bg-linear-to-r from-slate-800 to-slate-700 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                            <Scale size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Resolve Appeal</h2>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{appeal.proposal?.tracker_number}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Applicant reason */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Applicant's Reason</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{appeal.reason}</p>
                        <p className="text-xs text-slate-400 mt-2">Submitted by {appeal.submitted_by?.name}</p>
                    </div>

                    {/* Decision toggle */}
                    <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">Your Decision</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setDecision('approved')}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    decision === 'approved'
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100'
                                        : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                            >
                                <CheckCircle size={15} /> Approve & Reopen
                            </button>
                            <button
                                onClick={() => setDecision('denied')}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    decision === 'denied'
                                        ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100'
                                        : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
                                }`}
                            >
                                <XCircle size={15} /> Deny Appeal
                            </button>
                        </div>
                    </div>

                    {decision === 'approved' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700">
                            The proposal will return to <strong>Draft</strong> status so the PI can revise and resubmit.
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Resolution Notes <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={4}
                            placeholder="Explain your decision to the applicant…"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={saving}
                            className={`flex-1 px-4 py-2.5 text-sm text-white rounded-xl font-semibold disabled:opacity-50 transition-colors ${
                                decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {saving ? 'Saving…' : decision === 'approved' ? 'Approve Appeal' : 'Deny Appeal'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Appeals() {
    const [appeals, setAppeals]   = useState([]);
    const [counts, setCounts]     = useState({ pending: 0, approved: 0, denied: 0 });
    const [loading, setLoading]   = useState(true);
    const [filter, setFilter]     = useState('pending');
    const [resolving, setResolving] = useState(null);
    const { error } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const [cur, all] = await Promise.all([
                get(`/appeals?status=${filter}`),
                get('/appeals'),
            ]);
            setAppeals(cur.data?.data ?? []);
            const allItems = all.data?.data ?? [];
            setCounts({
                pending:  allItems.filter(a => a.status === 'pending').length,
                approved: allItems.filter(a => a.status === 'approved').length,
                denied:   allItems.filter(a => a.status === 'denied').length,
            });
        } catch { error('Failed to load appeals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filter]);

    const activeTab = TABS.find(t => t.key === filter);
    const ts = TAB_STYLES[filter];

    return (
        <AppLayout breadcrumb="Appeals">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Page header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
                            <Scale size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Proposal Appeals</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Review and resolve PI reconsideration requests</p>
                        </div>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                {/* Tabs */}
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

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : appeals.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                            filter === 'pending' ? 'bg-amber-50' : filter === 'approved' ? 'bg-emerald-50' : 'bg-red-50'
                        }`}>
                            {activeTab && <activeTab.icon size={28} className={ts.icon} />}
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1">No {filter} appeals</h3>
                        <p className="text-sm text-gray-400">
                            {filter === 'pending' ? 'No appeals awaiting review.' : `No ${filter} appeals to show.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {appeals.map(appeal => (
                            <AppealCard
                                key={appeal.id}
                                appeal={appeal}
                                ts={ts}
                                filter={filter}
                                onResolve={() => setResolving(appeal)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {resolving && (
                <ResolveModal
                    appeal={resolving}
                    onSave={() => { setResolving(null); load(); }}
                    onClose={() => setResolving(null)}
                />
            )}
        </AppLayout>
    );
}

function AppealCard({ appeal, ts, filter, onResolve }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${filter === 'pending' ? 'border-amber-200' : filter === 'approved' ? 'border-emerald-200' : 'border-gray-200'}`}>
            {/* Color bar */}
            <div className={`h-0.5 w-full ${ts.bar}`} />

            <div className="p-5">
                {/* Top row */}
                <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        filter === 'pending' ? 'bg-amber-50' : filter === 'approved' ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                        {filter === 'pending'  && <Clock size={18} className="text-amber-500" />}
                        {filter === 'approved' && <CheckCircle size={18} className="text-emerald-500" />}
                        {filter === 'denied'   && <XCircle size={18} className="text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* Tracker + category */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Link
                                href={`/proposals/${appeal.proposal_id}`}
                                className="font-mono text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg"
                            >
                                {appeal.proposal?.tracker_number}
                            </Link>
                            <span className="text-xs text-gray-400">{getCategoryLabel(appeal.proposal?.category)}</span>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-2">
                            {appeal.proposal?.title}
                        </h3>

                        {/* Meta row */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <User size={11} /> {appeal.submitted_by?.name}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <CalendarDays size={11} /> {formatDate(appeal.created_at)}
                            </span>
                            {appeal.resolved_by && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <FileText size={11} /> Resolved by {appeal.resolved_by?.name}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-2">
                        {filter === 'pending' && (
                            <button
                                onClick={onResolve}
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

                {/* Expandable detail */}
                {expanded && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                        <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Appeal Reason</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{appeal.reason}</p>
                        </div>

                        {appeal.resolution_notes && (
                            <div className={`rounded-xl p-4 ${filter === 'approved' ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2 ${filter === 'approved' ? 'text-emerald-600' : 'text-red-600'}">
                                    Resolution Notes
                                </p>
                                <p className="text-sm text-gray-700 leading-relaxed">{appeal.resolution_notes}</p>
                                {appeal.resolved_at && (
                                    <p className="text-xs text-gray-400 mt-2">{formatDate(appeal.resolved_at)}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
