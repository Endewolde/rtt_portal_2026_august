import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { CalendarClock, CheckCircle, XCircle, Clock, RefreshCw, User, CalendarDays, ChevronRight } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';
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

function ResolveModal({ extension, onSave, onClose }) {
    const [decision, setDecision] = useState('approved');
    const [notes, setNotes] = useState('');
    const [grantedUntil, setGrantedUntil] = useState(
        extension.requested_until ? new Date(extension.requested_until).toISOString().slice(0, 16) : ''
    );
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const submit = async () => {
        if (notes.trim().length < 10) { error('Resolution notes must be at least 10 characters.'); return; }
        setSaving(true);
        try {
            const payload = { decision, resolution_notes: notes };
            if (decision === 'approved' && grantedUntil) payload.granted_until = grantedUntil;
            const res = await post(`/deadline-extensions/${extension.id}/resolve`, payload);
            success(res?.message || 'Extension request resolved.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to resolve extension request.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="bg-linear-to-r from-slate-800 to-slate-700 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                            <CalendarClock size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Resolve Extension Request</h2>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{extension.proposal?.tracker_number}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">PI's Reason</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{extension.reason}</p>
                        <p className="text-xs text-slate-400 mt-2">
                            {extension.requested_by?.name} requested until {formatDate(extension.requested_until)}
                        </p>
                    </div>

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
                                <CheckCircle size={15} /> Grant Extension
                            </button>
                            <button
                                onClick={() => setDecision('denied')}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                    decision === 'denied'
                                        ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100'
                                        : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
                                }`}
                            >
                                <XCircle size={15} /> Deny Request
                            </button>
                        </div>
                    </div>

                    {decision === 'approved' && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Grant Until <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={grantedUntil}
                                onChange={e => setGrantedUntil(e.target.value)}
                                min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                            <p className="text-xs text-gray-400 mt-1">Defaults to what the PI requested — adjust if granting a different date.</p>
                        </div>
                    )}

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
                            disabled={saving || (decision === 'approved' && !grantedUntil)}
                            className={`flex-1 px-4 py-2.5 text-sm text-white rounded-xl font-semibold disabled:opacity-50 transition-colors ${
                                decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {saving ? 'Saving…' : decision === 'approved' ? 'Grant Extension' : 'Deny Request'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DeadlineExtensions() {
    const [extensions, setExtensions] = useState([]);
    const [counts, setCounts] = useState({ pending: 0, approved: 0, denied: 0 });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [resolving, setResolving] = useState(null);
    const { error } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const [cur, all] = await Promise.all([
                get(`/deadline-extensions?status=${filter}`),
                get('/deadline-extensions'),
            ]);
            setExtensions(cur.data?.data ?? []);
            const allItems = all.data?.data ?? [];
            setCounts({
                pending: allItems.filter(a => a.status === 'pending').length,
                approved: allItems.filter(a => a.status === 'approved').length,
                denied: allItems.filter(a => a.status === 'denied').length,
            });
        } catch { error('Failed to load extension requests.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filter]);

    const activeTab = TABS.find(t => t.key === filter);
    const ts = TAB_STYLES[filter];

    return (
        <AppLayout breadcrumb="Deadline Extensions">
            <div className="max-w-4xl mx-auto space-y-6">

                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
                            <CalendarClock size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Deadline Extensions</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Review PI requests for more time to finish a draft proposal</p>
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
                ) : extensions.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                            filter === 'pending' ? 'bg-amber-50' : filter === 'approved' ? 'bg-emerald-50' : 'bg-red-50'
                        }`}>
                            {activeTab && <activeTab.icon size={28} className={ts.icon} />}
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1">No {filter} requests</h3>
                        <p className="text-sm text-gray-400">
                            {filter === 'pending' ? 'No extension requests awaiting review.' : `No ${filter} requests to show.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {extensions.map(ext => (
                            <ExtensionCard
                                key={ext.id}
                                extension={ext}
                                filter={filter}
                                onResolve={() => setResolving(ext)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {resolving && (
                <ResolveModal
                    extension={resolving}
                    onSave={() => { setResolving(null); load(); }}
                    onClose={() => setResolving(null)}
                />
            )}
        </AppLayout>
    );
}

function ExtensionCard({ extension, filter, onResolve }) {
    const [expanded, setExpanded] = useState(false);

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
                                href={`/proposals/${extension.proposal_id}`}
                                className="font-mono text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg"
                            >
                                {extension.proposal?.tracker_number}
                            </Link>
                            <span className="text-xs text-gray-400">{getCategoryLabel(extension.proposal?.category)}</span>
                        </div>

                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-2">
                            {extension.proposal?.title}
                        </h3>

                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <User size={11} /> {extension.requested_by?.name}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <CalendarDays size={11} /> Requested {formatDate(extension.created_at)}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <CalendarClock size={11} /> Until {formatDate(extension.requested_until)}
                            </span>
                        </div>
                    </div>

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

                {expanded && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                        <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reason</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{extension.reason}</p>
                        </div>

                        {extension.resolution_notes && (
                            <div className={`rounded-xl p-4 ${filter === 'approved' ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${filter === 'approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    Resolution Notes
                                </p>
                                <p className="text-sm text-gray-700 leading-relaxed">{extension.resolution_notes}</p>
                                {extension.granted_until && (
                                    <p className="text-sm font-semibold text-emerald-700 mt-2">Granted until {formatDate(extension.granted_until)}</p>
                                )}
                                {extension.resolved_at && (
                                    <p className="text-xs text-gray-400 mt-2">{formatDate(extension.resolved_at)}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
