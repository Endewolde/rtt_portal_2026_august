import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    Presentation, UserCheck, Calendar, Clock, AlertCircle, RefreshCw,
    CheckCircle, Search, X, Building2, Users, CheckCircle2, UserPlus, Trash2,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api, { get } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { getCategoryLabel } from '../../lib/utils';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const GRADIENTS = [
    'from-blue-500 to-indigo-600', 'from-purple-500 to-violet-600',
    'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',   'from-cyan-500 to-sky-600',
];

function ReviewerAvatar({ name = '', size = 'md' }) {
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const gradient = GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];
    const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';
    return (
        <div className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-linear-to-br ${gradient} ${dim}`}>
            {initials}
        </div>
    );
}

function WorkloadBadge({ count }) {
    if (count == null) return null;
    const cls =
        count === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
        count <= 2  ? 'bg-green-50  text-green-700  border-green-200'  :
        count <= 5  ? 'bg-amber-50  text-amber-700  border-amber-200'  :
                      'bg-red-50    text-red-700    border-red-200';
    const label = count === 0 ? 'Available' : `${count} active`;
    return (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
    );
}

const SUBMISSION_COLORS = {
    pending:     'bg-yellow-100 text-yellow-700',
    accepted:    'bg-blue-100 text-blue-700',
    in_progress: 'bg-purple-100 text-purple-700',
    submitted:   'bg-green-100 text-green-700',
    declined:    'bg-red-100 text-red-700',
};

function DaysLeft({ dueDate }) {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
    if (diff < 0)   return <span className="text-xs font-medium text-red-600 flex items-center gap-1"><AlertCircle size={11} />Overdue {Math.abs(diff)}d</span>;
    if (diff === 0) return <span className="text-xs font-medium text-orange-600 flex items-center gap-1"><Clock size={11} />Due today</span>;
    if (diff <= 3)  return <span className="text-xs font-medium text-orange-600 flex items-center gap-1"><Clock size={11} />{diff}d left</span>;
    return <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} />{diff}d left</span>;
}

// ─── Reviewer search list (shared by Reassign + Add modals) ──────────────────

function ReviewerSearchList({ proposalId, selectedId, onSelect, alreadyAssignedIds }) {
    const [search, setSearch]       = useState('');
    const [results, setResults]     = useState([]);
    const [searching, setSearching] = useState(false);

    const hasQuery = search.trim().length >= 2;

    const fetchReviewers = useCallback(async (q) => {
        setSearching(true);
        try {
            const res = await api.get(`/proposals/${proposalId}/available-reviewers`, { params: { search: q } });
            setResults(res.data?.data ?? res.data ?? []);
        } catch { /* silent */ }
        setSearching(false);
    }, [proposalId]);

    useEffect(() => {
        if (!hasQuery) { setResults([]); return; }
        const t = setTimeout(() => fetchReviewers(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    return (
        <>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent bg-white">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, or expertise…"
                    className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                    autoFocus
                />
                {searching && <RefreshCw size={13} className="text-purple-400 animate-spin shrink-0" />}
                {search && !searching && (
                    <button onClick={() => { setSearch(''); onSelect(''); }} className="text-gray-300 hover:text-gray-500">
                        <X size={13} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl min-h-40">
                {!hasQuery ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                        <Search size={20} className="text-purple-200 mb-2" />
                        <p className="text-sm text-gray-400">Type to search for reviewers</p>
                    </div>
                ) : results.length === 0 && !searching ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                        <Users size={20} className="text-gray-200 mb-2" />
                        <p className="text-sm text-gray-400">No reviewers found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {results.map(r => {
                            const isChosen   = selectedId === r.id;
                            const isAssigned = alreadyAssignedIds.has(r.id);
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => !isAssigned && onSelect(isChosen ? '' : r.id)}
                                    disabled={isAssigned}
                                    className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                        ${isChosen ? 'bg-purple-50' : isAssigned ? 'bg-gray-50' : 'hover:bg-gray-50/60'}`}
                                >
                                    <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 mt-2 transition-colors
                                        ${isChosen ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'}`}>
                                        {isChosen && <CheckCircle2 size={10} className="text-white" />}
                                    </div>
                                    <ReviewerAvatar name={r.name} />
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className={`text-sm font-semibold ${isChosen ? 'text-purple-900' : 'text-gray-800'}`}>
                                                {r.title ? `${r.title} ` : ''}{r.name}
                                            </p>
                                            <WorkloadBadge count={r.active_assignments} />
                                            {isAssigned && (
                                                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                                                    Already assigned
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 truncate">{r.email}</p>
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                            {r.college?.name && (
                                                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                                    <Building2 size={10} className="text-gray-300 shrink-0" />{r.college.name}
                                                </span>
                                            )}
                                            {r.department?.name && (
                                                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                                    <Users size={10} className="text-gray-300 shrink-0" />{r.department.name}
                                                </span>
                                            )}
                                        </div>
                                        {r.expertise?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 pt-0.5">
                                                {r.expertise.map((e, i) => (
                                                    <span key={i} className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full font-medium">{e}</span>
                                                ))}
                                            </div>
                                        )}
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

// ─── Modals ───────────────────────────────────────────────────────────────────

function ReassignModal({ assignment, proposalId, currentAssignments, onSave, onClose }) {
    const [selectedId, setSelectedId] = useState('');
    const [dueDate, setDueDate]       = useState('');
    const [saving, setSaving]         = useState(false);
    const { error } = useToast();

    const alreadyAssignedIds = new Set(
        (currentAssignments ?? [])
            .filter(a => a.id !== assignment.id && a.status !== 'declined')
            .map(a => a.reviewer_id ?? a.reviewer?.id)
            .filter(Boolean)
    );

    const save = async () => {
        if (!selectedId || !dueDate) return;
        setSaving(true);
        try {
            await api.put(`/review-assignments/${assignment.id}/reassign`, { new_reviewer_id: selectedId, due_date: dueDate });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to reassign.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Replace Reviewer</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Replacing: <span className="font-medium text-gray-700">{assignment.reviewer?.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"><X size={18} /></button>
                </div>

                {alreadyAssignedIds.size > 0 && (
                    <div className="px-6 pt-4 shrink-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Already Assigned</p>
                        <div className="flex flex-wrap gap-2">
                            {(currentAssignments ?? [])
                                .filter(a => a.id !== assignment.id && a.status !== 'declined')
                                .map(a => (
                                    <div key={a.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                                        <ReviewerAvatar name={a.reviewer?.name ?? ''} size="sm" />
                                        <div>
                                            <p className="text-xs font-medium text-gray-700">{a.reviewer?.name}</p>
                                            <p className="text-[10px] text-gray-400">{a.reviewer?.email}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                <div className="px-6 pt-4 shrink-0">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Select New Reviewer</p>
                </div>

                <div className="px-6 flex flex-col flex-1 gap-2 min-h-0">
                    <ReviewerSearchList
                        proposalId={proposalId}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        alreadyAssignedIds={alreadyAssignedIds}
                    />
                </div>

                <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0">
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Due Date <span className="text-red-400">*</span>
                        </label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                            Cancel
                        </button>
                        <button onClick={save} disabled={!selectedId || !dueDate || saving}
                            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {saving ? <><RefreshCw size={13} className="animate-spin inline mr-1.5" />Saving…</> : 'Replace Reviewer'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AddReviewerModal({ proposalId, currentAssignments, onSave, onClose }) {
    const [selectedId, setSelectedId] = useState('');
    const [dueDate, setDueDate]       = useState('');
    const [saving, setSaving]         = useState(false);
    const { error } = useToast();

    const alreadyAssignedIds = new Set(
        (currentAssignments ?? [])
            .filter(a => a.status !== 'declined')
            .map(a => a.reviewer_id ?? a.reviewer?.id)
            .filter(Boolean)
    );

    const save = async () => {
        if (!selectedId || !dueDate) return;
        setSaving(true);
        try {
            await api.post(`/proposals/${proposalId}/review/add-reviewer`, { reviewer_id: selectedId, due_date: dueDate });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to add reviewer.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Add Reviewer</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Search and add a new reviewer to this proposal</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"><X size={18} /></button>
                </div>

                {alreadyAssignedIds.size > 0 && (
                    <div className="px-6 pt-4 shrink-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Already Assigned</p>
                        <div className="flex flex-wrap gap-2">
                            {(currentAssignments ?? [])
                                .filter(a => a.status !== 'declined')
                                .map(a => (
                                    <div key={a.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                                        <ReviewerAvatar name={a.reviewer?.name ?? ''} size="sm" />
                                        <div>
                                            <p className="text-xs font-medium text-gray-700">{a.reviewer?.name}</p>
                                            <p className="text-[10px] text-gray-400">{a.reviewer?.email}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                <div className="px-6 pt-4 shrink-0">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Select Reviewer</p>
                </div>

                <div className="px-6 flex flex-col flex-1 gap-2 min-h-0">
                    <ReviewerSearchList
                        proposalId={proposalId}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        alreadyAssignedIds={alreadyAssignedIds}
                    />
                </div>

                <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0">
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Due Date <span className="text-red-400">*</span>
                        </label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                            Cancel
                        </button>
                        <button onClick={save} disabled={!selectedId || !dueDate || saving}
                            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {saving ? <><RefreshCw size={13} className="animate-spin inline mr-1.5" />Adding…</> : 'Add Reviewer'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ExtendModal({ assignment, onSave, onClose }) {
    const [dueDate, setDueDate] = useState('');
    const [saving, setSaving]   = useState(false);
    const { error } = useToast();

    const save = async () => {
        if (!dueDate) return;
        setSaving(true);
        try {
            await api.put(`/review-assignments/${assignment.id}/extend`, { due_date: dueDate });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to extend due date.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Extend Due Date</h3>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4" />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={!dueDate || saving}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Extend'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Defence Card ─────────────────────────────────────────────────────────────

function DefenceCard({ proposal, onReassign, onExtend, onAddReviewer, onRemove, onProcessResult }) {
    const assignments   = proposal.review_assignments ?? [];
    const submitted     = assignments.filter(a => a.status === 'submitted').length;
    const allSubmitted  = assignments.length > 0 && submitted === assignments.length;
    const isUnderDefence = proposal.status === 'under_open_defence';

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            {/* Card header row */}
            <div className="flex items-stretch">
                <div className="w-0.5 bg-purple-600 shrink-0" />
                <div className="flex items-start justify-between gap-4 flex-1 px-4 py-3.5">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg shrink-0">
                                {proposal.tracker_number}
                            </span>
                            <span className="text-xs text-gray-400">{getCategoryLabel(proposal.category)}</span>
                            <StatusBadge status={proposal.status} />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{proposal.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{proposal.pi?.name} · {proposal.college?.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${allSubmitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {submitted}/{assignments.length} submitted
                        </span>
                        <Link href={`/proposals/${proposal.id}`} className="text-xs text-purple-600 hover:underline">View</Link>
                    </div>
                </div>
            </div>

            {/* Assignment rows */}
            {assignments.length === 0 ? (
                <div className="px-5 pb-4">
                    <p className="text-sm text-gray-400 italic">No reviewers assigned.</p>
                </div>
            ) : (
                <div className="px-4 pb-3 space-y-1.5">
                    {assignments.map(a => (
                        <div key={a.id} className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <ReviewerAvatar name={a.reviewer?.name ?? ''} size="sm" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{a.reviewer?.name ?? '—'}</p>
                                    <p className="text-xs text-gray-400 truncate">{a.reviewer?.email}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${SUBMISSION_COLORS[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {a.status?.replace('_', ' ')}
                                </span>
                                <DaysLeft dueDate={a.due_date} />
                            </div>
                            {a.status !== 'submitted' && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => onReassign(a, proposal.id, assignments)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors font-medium">
                                        <RefreshCw size={11} /> Replace
                                    </button>
                                    <button onClick={() => onExtend(a)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium">
                                        <Calendar size={11} /> Extend
                                    </button>
                                    <button onClick={() => onRemove(a)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium">
                                        <Trash2 size={11} /> Remove
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isUnderDefence && (
                <div className="px-4 pb-3.5">
                    <button
                        onClick={() => onAddReviewer(proposal.id, assignments)}
                        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-semibold transition-colors"
                    >
                        <UserPlus size={13} /> Add Reviewer
                    </button>
                </div>
            )}

            {allSubmitted && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex justify-end">
                    <button onClick={() => onProcessResult(proposal.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors">
                        <CheckCircle size={14} /> Process Result
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OpenDefence() {
    const { success, error } = useToast();
    const { user, hasRole } = useAuth();
    const isCollegeAdmin = hasRole('college_admin');
    const [view, setView] = useViewPreference('open_defence', 'card');
    const [proposals, setProposals]               = useState([]);
    const [loading, setLoading]                   = useState(true);
    const [reassignModal, setReassignModal]        = useState(null);
    const [addReviewerModal, setAddReviewerModal]  = useState(null);
    const [removeConfirm, setRemoveConfirm]        = useState(null);
    const [removing, setRemoving]                  = useState(false);
    const [extendModal, setExtendModal]            = useState(null);
    const [processConfirm, setProcessConfirm]      = useState(null);
    const [processing, setProcessing]             = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/review-management', {
                params: { status: 'blind_review_passed,under_open_defence' },
            });
            setProposals(res.data?.data ?? []);
        } catch { error('Failed to load open defence proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openReassign    = (assignment, proposalId, currentAssignments) => setReassignModal({ assignment, proposalId, currentAssignments });
    const openAddReviewer = (proposalId, currentAssignments)             => setAddReviewerModal({ proposalId, currentAssignments });
    const confirmRemove   = (assignment)                                  => setRemoveConfirm(assignment);

    const doRemove = async () => {
        if (!removeConfirm) return;
        setRemoving(true);
        try {
            await api.delete(`/review-assignments/${removeConfirm.id}/remove`);
            success('Reviewer removed.');
            setRemoveConfirm(null);
            load();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to remove reviewer.');
        }
        setRemoving(false);
    };

    const afterSave = () => {
        success('Saved successfully.');
        setReassignModal(null);
        setAddReviewerModal(null);
        setExtendModal(null);
        load();
    };

    const handleProcessResult = (proposalId) => setProcessConfirm(proposalId);

    const confirmProcessResult = async () => {
        if (!processConfirm) return;
        setProcessing(true);
        try {
            const res = await api.post(`/proposals/${processConfirm}/defence/process-result`);
            success(res.data?.message || 'Defence result processed.');
            setProcessConfirm(null);
            load();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to process result.');
        }
        setProcessing(false);
    };

    const passedBlindReview = proposals.filter(p => p.status === 'blind_review_passed');
    const underDefence      = proposals.filter(p => p.status === 'under_open_defence');

    return (
        <AppLayout breadcrumb="Open Defence">
            <div className="max-w-6xl mx-auto">
                <WorkflowBreadcrumb current="under_open_defence" />
                {isCollegeAdmin && user?.college_name && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-sm text-blue-700">
                        Showing proposals from your college: <strong>{user.college_name}</strong>
                    </div>
                )}

                {/* Page Header */}
                <div className="flex items-start justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                            <Presentation size={20} className="text-purple-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Open Defence Management</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Schedule defences and manage active open defence reviews</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {!loading && (
                            <div className="flex items-center gap-2">
                                {passedBlindReview.length > 0 && (
                                    <span className="flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg">
                                        {passedBlindReview.length} Awaiting Schedule
                                    </span>
                                )}
                                {underDefence.length > 0 && (
                                    <span className="flex items-center gap-1.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1.5 rounded-lg">
                                        {underDefence.length} Under Defence
                                    </span>
                                )}
                            </div>
                        )}
                        <ViewToggle view={view} onChange={setView} />
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : passedBlindReview.length === 0 && underDefence.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className="h-14 w-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Presentation size={28} className="text-purple-300" />
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1">No proposals in open defence</h3>
                        <p className="text-sm text-gray-400 mb-3">Proposals that pass blind review will appear here.</p>
                        <Link href="/admin/blind-review" className="text-sm text-purple-600 hover:underline font-medium">
                            Go to Blind Review →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">

                        {passedBlindReview.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                                    <h2 className="text-sm font-semibold text-gray-700">
                                        Passed Blind Review — Schedule Defence
                                        <span className="ml-2 inline-flex items-center justify-center bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                            {passedBlindReview.length}
                                        </span>
                                    </h2>
                                </div>
                                {view === 'table' ? (
                                    <ProposalTable
                                        proposals={passedBlindReview}
                                        showColumns={['tracker','title','category','college','status']}
                                        actions={(p) => (
                                            <a href={`/proposals/${p.id}/defence`}
                                                className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                                                Schedule Defence
                                            </a>
                                        )}
                                        emptyMessage="No proposals awaiting scheduling."
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        {passedBlindReview.map(proposal => (
                                            <div key={proposal.id}
                                                className="bg-white border border-gray-200 rounded-xl flex items-stretch overflow-hidden hover:shadow-md transition-shadow">
                                                <div className="w-0.5 bg-purple-600 shrink-0" />
                                                <div className="flex items-center gap-4 flex-1 min-w-0 px-4 py-3.5">
                                                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg shrink-0">
                                                        {proposal.tracker_number}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-xs text-gray-400 capitalize">{getCategoryLabel(proposal.category)}</span>
                                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                                Blind Review Passed ✓
                                                            </span>
                                                        </div>
                                                        <h3 className="text-sm font-semibold text-gray-900 truncate">{proposal.title}</h3>
                                                        <p className="text-xs text-gray-500 mt-0.5">{proposal.pi?.name} · {proposal.college?.name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-4 shrink-0">
                                                        <Link href={`/proposals/${proposal.id}`} className="text-xs text-gray-500 hover:underline">View</Link>
                                                        <Link href={`/proposals/${proposal.id}/defence`}
                                                            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 transition-colors">
                                                            <Calendar size={13} /> Schedule Defence
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {underDefence.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                                    <h2 className="text-sm font-semibold text-gray-700">
                                        Under Open Defence
                                        <span className="ml-2 inline-flex items-center justify-center bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                            {underDefence.length}
                                        </span>
                                    </h2>
                                </div>
                                {view === 'table' ? (
                                    <ProposalTable
                                        proposals={underDefence}
                                        showColumns={['tracker','title','category','college','defence_date','status']}
                                        actions={(p) => (
                                            <a href={`/proposals/${p.id}`}
                                                className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                                                View
                                            </a>
                                        )}
                                        emptyMessage="No proposals under defence."
                                    />
                                ) : (
                                    <div className="space-y-3">
                                        {underDefence.map(proposal => (
                                            <DefenceCard
                                                key={proposal.id}
                                                proposal={proposal}
                                                onReassign={openReassign}
                                                onExtend={setExtendModal}
                                                onAddReviewer={openAddReviewer}
                                                onRemove={confirmRemove}
                                                onProcessResult={handleProcessResult}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {reassignModal && (
                <ReassignModal
                    assignment={reassignModal.assignment}
                    proposalId={reassignModal.proposalId}
                    currentAssignments={reassignModal.currentAssignments}
                    onSave={afterSave}
                    onClose={() => setReassignModal(null)}
                />
            )}

            {addReviewerModal && (
                <AddReviewerModal
                    proposalId={addReviewerModal.proposalId}
                    currentAssignments={addReviewerModal.currentAssignments}
                    onSave={afterSave}
                    onClose={() => setAddReviewerModal(null)}
                />
            )}

            {removeConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                                <Trash2 size={18} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Remove Reviewer</h3>
                                <p className="text-xs text-gray-500 mt-0.5">This cannot be undone.</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            Remove <strong>{removeConfirm.reviewer?.name}</strong> from this proposal?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setRemoveConfirm(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                                Cancel
                            </button>
                            <button onClick={doRemove} disabled={removing}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                                {removing ? 'Removing…' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {extendModal && (
                <ExtendModal
                    assignment={extendModal}
                    onSave={afterSave}
                    onClose={() => setExtendModal(null)}
                />
            )}

            {processConfirm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-base font-semibold text-gray-900 mb-2">Process Defence Result?</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            This will calculate the combined score and determine the final result.
                            The proposal will move to the next stage based on the score.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setProcessConfirm(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={confirmProcessResult} disabled={processing}
                                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60">
                                {processing ? 'Processing…' : 'Process Result'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
