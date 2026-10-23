import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, RefreshCw, Search, X, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { getCategoryLabel } from '../../lib/utils';

function daysAgo(date) {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function fmtDate(d) {
    return d
        ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
}

// ─── Reviewer search (scoped to this page — mirrors the BlindReview/OpenDefence
// reassignment picker, kept local since this page's usage is a single lightweight action) ───

function ReviewerPicker({ proposalId, excludeReviewerId, selectedId, onSelect }) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const hasQuery = search.trim().length >= 2;

    const fetchReviewers = useCallback(async (q) => {
        setSearching(true);
        try {
            const res = await api.get(`/proposals/${proposalId}/available-reviewers`, { params: { search: q } });
            setResults((res.data?.data ?? res.data ?? []).filter(r => r.id !== excludeReviewerId));
        } catch { /* silent */ }
        setSearching(false);
    }, [proposalId, excludeReviewerId]);

    useEffect(() => {
        if (!hasQuery) { setResults([]); return; }
        const t = setTimeout(() => fetchReviewers(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    return (
        <>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, or expertise…"
                    className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                    autoFocus
                />
                {searching && <RefreshCw size={13} className="text-blue-400 animate-spin shrink-0" />}
                {search && !searching && (
                    <button onClick={() => { setSearch(''); onSelect(''); }} className="text-gray-300 hover:text-gray-500">
                        <X size={13} />
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl min-h-40 max-h-64">
                {!hasQuery ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                        <Search size={20} className="text-blue-200 mb-2" />
                        <p className="text-sm text-gray-400">Type to search for a replacement reviewer</p>
                    </div>
                ) : results.length === 0 && !searching ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                        <p className="text-sm text-gray-400">No reviewers found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {results.map(r => {
                            const isChosen = selectedId === r.id;
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => onSelect(isChosen ? '' : r.id)}
                                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                                        isChosen ? 'bg-blue-50' : 'hover:bg-gray-50/60'
                                    }`}
                                >
                                    <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                                        isChosen ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                                    }`}>
                                        {isChosen && <CheckCircle2 size={10} className="text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800">{r.name}</p>
                                        <p className="text-xs text-gray-400">{r.email}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

function ReassignModal({ assignment, onClose, onDone }) {
    const { success, error } = useToast();
    const [selectedId, setSelectedId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async (overrideWorkloadCap = false) => {
        if (!selectedId || !dueDate) return;
        setSaving(true);
        try {
            await api.put(`/review-assignments/${assignment.id}/reassign`, {
                new_reviewer_id: selectedId, due_date: dueDate, override_workload_cap: overrideWorkloadCap,
            });
            success('Reviewer reassigned. The conflict has been resolved.');
            onDone();
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Failed to reassign.';
            if (msg.includes('max workload')) {
                error(msg, { action: { label: 'Assign Anyway', onClick: () => save(true) } });
            } else {
                error(msg);
            }
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Reassign Reviewer</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {assignment.proposal?.tracker_number} — replacing {assignment.reviewer?.name}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"><X size={18} /></button>
                </div>

                <div className="px-6 pt-4 pb-2 shrink-0">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-800">
                        <span className="font-semibold">Reported conflict:</span> {assignment.coi_reason}
                    </div>
                </div>

                <div className="px-6 pb-2 flex flex-col flex-1 gap-2 min-h-0 overflow-hidden">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Select Replacement Reviewer</p>
                    <ReviewerPicker
                        proposalId={assignment.proposal_id}
                        excludeReviewerId={assignment.reviewer_id}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                </div>

                <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-3">
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            New Due Date <span className="text-red-400">*</span>
                        </label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                            Cancel
                        </button>
                        <button onClick={() => save()} disabled={!selectedId || !dueDate || saving}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {saving ? <><RefreshCw size={13} className="animate-spin inline mr-1.5" />Saving…</> : 'Reassign & Resolve'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function COIConflicts() {
    const { error } = useToast();
    const [conflicts, setConflicts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reassignTarget, setReassignTarget] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/review-assignments/coi-conflicts');
            setConflicts(res.data?.data ?? []);
        } catch {
            error('Failed to load COI conflicts.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    return (
        <AppLayout breadcrumb="COI Conflicts">
            <div className="max-w-5xl mx-auto space-y-5">

                <div className="flex items-center flex-wrap justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ShieldAlert size={22} className="text-red-500" /> COI Conflicts
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Reported conflicts of interest awaiting reviewer reassignment</p>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex items-center gap-3">
                    <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl border bg-red-50 text-red-700 border-red-200">
                        <AlertTriangle size={16} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{conflicts.length}</p>
                        <p className="text-xs text-gray-500">outstanding conflict{conflicts.length !== 1 ? 's' : ''} awaiting reassignment</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : conflicts.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <ShieldAlert size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No outstanding conflicts of interest. All clear.</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                        {conflicts.map(c => {
                            const waiting = daysAgo(c.coi_declared_at);
                            return (
                                <div key={c.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <a href={`/proposals/${c.proposal_id}`}
                                                className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">
                                                {c.proposal?.tracker_number ?? '—'}
                                            </a>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                                {getCategoryLabel(c.proposal?.category)}
                                            </span>
                                            {waiting !== null && (
                                                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${waiting > 3 ? 'text-red-500' : 'text-gray-400'}`}>
                                                    <Clock size={11} /> {waiting === 0 ? 'reported today' : `${waiting}d waiting`}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{c.proposal?.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {c.proposal?.college?.name} · Reviewer: <span className="font-medium text-gray-700">{c.reviewer?.name}</span> · Assigned by {c.assigned_by?.name ?? '—'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-block">
                                            "{c.coi_reason}"
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-1">Reported {fmtDate(c.coi_declared_at)}</p>
                                    </div>
                                    <div className="shrink-0">
                                        <button onClick={() => setReassignTarget(c)}
                                            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
                                            Reassign Reviewer
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {reassignTarget && (
                <ReassignModal
                    assignment={reassignTarget}
                    onClose={() => setReassignTarget(null)}
                    onDone={() => {
                        setReassignTarget(null);
                        load();
                    }}
                />
            )}
        </AppLayout>
    );
}
