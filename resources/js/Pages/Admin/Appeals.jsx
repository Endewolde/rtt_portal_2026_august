import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

const STATUS_STYLES = {
    pending:  { cls: 'bg-amber-100 text-amber-700',  label: 'Pending' },
    approved: { cls: 'bg-green-100 text-green-700',  label: 'Approved' },
    denied:   { cls: 'bg-red-100 text-red-700',      label: 'Denied' },
};

function ResolveModal({ appeal, onSave, onClose }) {
    const [decision, setDecision] = useState('denied');
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Resolve Appeal</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{appeal.proposal?.tracker_number}</p>

                <label className="block text-xs font-medium text-gray-700 mb-1">Decision</label>
                <div className="flex gap-3 mb-4">
                    {['approved', 'denied'].map(d => (
                        <button
                            key={d}
                            onClick={() => setDecision(d)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                decision === d
                                    ? d === 'approved' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {d === 'approved' ? 'Approve (Reopen)' : 'Deny'}
                        </button>
                    ))}
                </div>

                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Resolution Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Explain your decision..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />

                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-1">Applicant's Reason</p>
                    <p className="text-sm text-gray-700">{appeal.reason}</p>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save Decision'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Appeals() {
    const [appeals, setAppeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [resolving, setResolving] = useState(null);
    const { error } = useToast();

    const load = () => {
        setLoading(true);
        get(`/appeals?status=${filter}`)
            .then(r => setAppeals(r.data?.data ?? []))
            .catch(() => error('Failed to load appeals.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [filter]);

    return (
        <AppLayout breadcrumb="Appeals">
            <div className="max-w-5xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare size={22} className="text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-900">Proposal Appeals</h1>
                    </div>
                    <div className="flex gap-2">
                        {['pending', 'approved', 'denied'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {STATUS_STYLES[s].label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin h-7 w-7 rounded-full border-4 border-blue-600 border-t-transparent" />
                    </div>
                ) : appeals.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">No {filter} appeals.</div>
                ) : (
                    <div className="space-y-3">
                        {appeals.map(appeal => {
                            const s = STATUS_STYLES[appeal.status] ?? STATUS_STYLES.pending;
                            return (
                                <div key={appeal.id} className="bg-white rounded-xl border border-gray-200 p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Link href={`/proposals/${appeal.proposal_id}`} className="text-sm font-mono text-blue-600 hover:underline">
                                                    {appeal.proposal?.tracker_number}
                                                </Link>
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${s.cls}`}>{s.label}</span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 truncate">{appeal.proposal?.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {getCategoryLabel(appeal.proposal?.category)} &middot; {appeal.submitted_by?.name} &middot; {formatDate(appeal.created_at)}
                                            </p>
                                        </div>
                                        {appeal.status === 'pending' && (
                                            <button
                                                onClick={() => setResolving(appeal)}
                                                className="shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                Review
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                        <p className="text-xs text-gray-500 mb-0.5">Reason</p>
                                        <p className="text-sm text-gray-700 line-clamp-3">{appeal.reason}</p>
                                    </div>

                                    {appeal.resolution_notes && (
                                        <div className={`mt-2 rounded-lg px-3 py-2 ${appeal.status === 'approved' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                                            <p className="text-xs text-gray-500 mb-0.5">Resolution by {appeal.resolved_by?.name} on {formatDate(appeal.resolved_at)}</p>
                                            <p className="text-sm text-gray-700">{appeal.resolution_notes}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {resolving && (
                    <ResolveModal
                        appeal={resolving}
                        onSave={() => { setResolving(null); load(); }}
                        onClose={() => setResolving(null)}
                    />
                )}
            </div>
        </AppLayout>
    );
}
