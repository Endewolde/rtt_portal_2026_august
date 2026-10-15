import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, usePage } from '@inertiajs/react';
import {
    Presentation, Calendar, Clock, AlertCircle, RefreshCw,
    CheckCircle2, Search, X, Building2, Users, UserPlus, Trash2,
    ChevronRight, Shield, Activity, AlertTriangle, EyeOff,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import FilterBar from '../../Components/FilterBar';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { getCategoryLabel } from '../../lib/utils';
import OpenDefenceHoldModal from '../../Components/OpenDefenceHoldModal';
import DefenceRecordButton from '../../Components/DefenceRecordButton';
import DefenceDeadlineStrip, { RequestDeadlineExtensionModal } from '../../Components/DefenceDeadlineStrip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function isExternalReviewer(user) {
    return user?.roles?.some(r => (typeof r === 'string' ? r : r.name) === 'external_reviewer') ?? false;
}

function WorkloadBadge({ count }) {
    if (count == null) return null;
    const cls =
        count === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
        count <= 2  ? 'bg-green-50  text-green-700  border-green-200'  :
        count <= 5  ? 'bg-amber-50  text-amber-700  border-amber-200'  :
                      'bg-red-50    text-red-700    border-red-200';
    const label = count === 0 ? 'Available' : `${count} active`;
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function daysAgo(dateStr) {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
}

function DueChip({ dueDate, status }) {
    if (!dueDate || status === 'submitted') return null;
    const diff = daysUntil(dueDate);
    if (diff < 0)   return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <AlertTriangle size={10} /> {Math.abs(diff)}d overdue
        </span>
    );
    if (diff === 0) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
            <Clock size={10} /> Due today
        </span>
    );
    if (diff <= 3)  return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Clock size={10} /> {diff}d left
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <Clock size={10} /> {diff}d left
        </span>
    );
}

const STATUS_LABEL = {
    submitted:   { label: 'Submitted',   cls: 'bg-green-100 text-green-700 border-green-200' },
    in_progress: { label: 'In Progress', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    accepted:    { label: 'Accepted',    cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    pending:     { label: 'Pending',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    declined:    { label: 'Declined',    cls: 'bg-red-100 text-red-700 border-red-200' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }) {
    const colors = {
        green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600',  val: 'text-green-700' },
        purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', val: 'text-purple-700' },
        blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',    val: 'text-blue-700' },
        red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-500',      val: 'text-red-600' },
        gray:   { bg: 'bg-gray-50',   icon: 'bg-gray-100 text-gray-500',    val: 'text-gray-700' },
    }[color] ?? { bg: 'bg-gray-50', icon: 'bg-gray-100 text-gray-500', val: 'text-gray-700' };

    return (
        <div className={`${colors.bg} border border-white rounded-2xl px-5 py-4 flex items-center gap-4`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-2xl font-bold leading-none mt-0.5 ${colors.val}`}>{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Blind Review Hover Popover ───────────────────────────────────────────────

function BlindReviewPopover({ assignments, onReassign, onExtend, onRemove, proposalId, allAssignments }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos]   = useState({ top: 0, right: 0 });
    const btnRef          = useRef(null);
    const leaveTimer      = useRef(null);

    const enter = () => { clearTimeout(leaveTimer.current); setOpen(true); };
    const leave = () => { leaveTimer.current = setTimeout(() => setOpen(false), 180); };

    function handleEnter() {
        clearTimeout(leaveTimer.current);
        if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPos({ bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right });
        }
        setOpen(true);
    }

    const submitted  = assignments.filter(a => a.status === 'submitted').length;
    const hasOverdue = assignments.some(a => a.due_date && daysUntil(a.due_date) < 0 && a.status !== 'submitted');

    return (
        <div onMouseEnter={handleEnter} onMouseLeave={leave}>
            {/* Trigger badge */}
            <button ref={btnRef} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-default
                ${hasOverdue
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : submitted === assignments.length && assignments.length > 0
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'}`
            }>
                <EyeOff size={11} />
                {submitted}/{assignments.length} submitted
            </button>

            {/* Popover panel — portaled to escape overflow:hidden on card */}
            {open && assignments.length > 0 && createPortal(
                <div
                    style={{ position: 'fixed', bottom: pos.bottom, right: pos.right, zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-80"
                    onMouseEnter={enter}
                    onMouseLeave={leave}
                >
                    {/* Popover header */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                        <EyeOff size={13} className="text-purple-500" />
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Blind Review Panel</p>
                        <span className="ml-auto text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            {submitted}/{assignments.length} done
                        </span>
                    </div>

                    {/* Reviewer rows */}
                    <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                        {assignments.map(a => {
                            const statusInfo = STATUS_LABEL[a.status] ?? { label: a.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
                            const due = a.due_date
                                ? new Date(a.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                : null;
                            return (
                                <div key={a.id} className="px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <ReviewerAvatar name={a.reviewer?.name ?? ''} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="text-xs font-semibold text-gray-800 truncate">{a.reviewer?.name ?? '—'}</p>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${statusInfo.cls}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-[11px] text-gray-400 truncate">{a.reviewer?.email}</p>
                                                {due && (
                                                    <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-0.5">
                                                        <Clock size={9} /> {due}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1">
                                                <DueChip dueDate={a.due_date} status={a.status} />
                                            </div>
                                        </div>
                                    </div>
                                    {a.status !== 'submitted' && (
                                        <div className="flex items-center gap-1.5 mt-2 ml-10">
                                            <button onClick={() => { setOpen(false); onReassign(a, proposalId, allAssignments); }}
                                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors font-medium">
                                                <RefreshCw size={10} /> Replace
                                            </button>
                                            <button onClick={() => { setOpen(false); onExtend(a); }}
                                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors font-medium">
                                                <Calendar size={10} /> Extend
                                            </button>
                                            <button onClick={() => { setOpen(false); onRemove(a); }}
                                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-colors font-medium ml-1">
                                                <Trash2 size={10} /> Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
                        <p className="text-[10px] text-gray-400 text-center">Hover to manage reviewer assignments</p>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

// ─── Reviewer search list (shared by modals) ──────────────────────────────────

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
                                            {isExternalReviewer(r) && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                    External
                                                </span>
                                            )}
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

function ModalShell({ title, subtitle, onClose, children, footer }) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"><X size={18} /></button>
                </div>
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{children}</div>
                {footer && <div className="px-6 py-4 border-t border-gray-100 shrink-0">{footer}</div>}
            </div>
        </div>
    );
}

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

    const currentDue = assignment.due_date
        ? new Date(assignment.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;

    const save = async (overrideWorkloadCap = false) => {
        if (!selectedId || !dueDate) return;
        setSaving(true);
        try {
            await api.put(`/review-assignments/${assignment.id}/reassign`, {
                new_reviewer_id: selectedId, due_date: dueDate, override_workload_cap: overrideWorkloadCap,
            });
            onSave();
        } catch (e) {
            const msg = e.response?.data?.message || 'Failed to reassign.';
            if (msg.includes('max workload')) {
                error(msg, { action: { label: 'Assign Anyway', onClick: () => save(true) } });
            } else {
                error(msg);
            }
        }
        setSaving(false);
    };

    return (
        <ModalShell
            title="Replace Reviewer"
            subtitle={`Replacing: ${assignment.reviewer?.name}`}
            onClose={onClose}
            footer={
                <div className="space-y-3">
                    {currentDue && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                            <span className="text-xs text-gray-500">Current deadline</span>
                            <span className="text-xs font-semibold text-gray-700">{currentDue}</span>
                        </div>
                    )}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            New Due Date <span className="text-red-400">*</span>
                        </label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                            Cancel
                        </button>
                        <button onClick={() => save()} disabled={!selectedId || !dueDate || saving}
                            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {saving ? <><RefreshCw size={13} className="animate-spin inline mr-1.5" />Saving…</> : 'Replace Reviewer'}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="px-6 pt-4 shrink-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Select New Reviewer</p>
            </div>
            <div className="px-6 pb-2 flex flex-col flex-1 gap-2 min-h-0 overflow-hidden">
                <ReviewerSearchList
                    proposalId={proposalId}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    alreadyAssignedIds={alreadyAssignedIds}
                />
            </div>
        </ModalShell>
    );
}

// ─── Awaiting Schedule Row ────────────────────────────────────────────────────

function AwaitingRow({ proposal }) {
    const waiting = daysAgo(proposal.updated_at);
    const urgency = waiting != null && waiting > 7;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-green-300 transition-all">
            <div className="flex items-stretch">
                <div className="w-1 bg-green-500 shrink-0 rounded-l-2xl" />
                <div className="flex items-center gap-4 flex-1 min-w-0 px-5 py-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg shrink-0">
                                {proposal.tracker_number}
                            </span>
                            <span className="text-xs text-gray-400">{getCategoryLabel(proposal.category)}</span>
                            <StatusBadge status={proposal.status} />
                            {urgency && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                                    <AlertTriangle size={10} /> Waiting {waiting}d
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{proposal.title}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Building2 size={10} className="text-gray-300" /> {proposal.college?.name}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                        <Link href={`/proposals/${proposal.id}`}
                            className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
                            View
                        </Link>
                        <Link href={`/proposals/${proposal.id}/defence`}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm shadow-green-100">
                            <Calendar size={13} /> Schedule Defence
                            <ChevronRight size={12} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Defence Card ─────────────────────────────────────────────────────────────

function DefenceCard({ proposal, onReassign, onExtend, onRemove, onRequestDeadlineExtension }) {
    const assignments  = (proposal.review_assignments ?? []).filter(a => (a.evaluation_type?.name ?? '').startsWith('open_defence'));
    const submitted    = assignments.filter(a => a.status === 'submitted').length;
    const overdue      = assignments.filter(a => a.due_date && daysUntil(a.due_date) < 0 && a.status !== 'submitted').length;
    const allSubmitted = assignments.length > 0 && submitted === assignments.length;

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${allSubmitted ? 'border-green-300 shadow-sm shadow-green-50' : 'border-gray-200 hover:shadow-md'}`}>
            {/* ── Header ── */}
            <div className="flex items-stretch">
                <div className={`w-1 shrink-0 rounded-tl-2xl ${allSubmitted ? 'bg-green-500' : 'bg-purple-500'}`} />
                <div className="flex items-start justify-between gap-4 flex-1 px-5 py-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg shrink-0">
                                {proposal.tracker_number}
                            </span>
                            <span className="text-xs text-gray-400">{getCategoryLabel(proposal.category)}</span>
                            <StatusBadge status={proposal.status} />
                            {overdue > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                    <AlertTriangle size={10} /> {overdue} overdue
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 leading-snug">{proposal.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Building2 size={10} className="text-gray-300" /> {proposal.college?.name}
                            </span>
                        </div>
                    </div>

                    {/* Right side: review popover + progress bar */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                        {assignments.length === 0 ? (
                            <Link
                                href={`/proposals/${proposal.id}/defence`}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-purple-200 hover:bg-purple-700"
                            >
                                <Calendar size={13} /> Schedule Defence
                            </Link>
                        ) : (
                        <BlindReviewPopover
                            assignments={assignments}
                            onReassign={onReassign}
                            onExtend={onExtend}
                            onRemove={onRemove}
                            proposalId={proposal.id}
                            allAssignments={assignments}
                        />
                        )}
                        {assignments.length > 0 && (
                            <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${allSubmitted ? 'bg-green-500' : 'bg-purple-500'}`}
                                    style={{ width: `${(submitted / assignments.length) * 100}%` }}
                                />
                            </div>
                        )}
                        <Link href={`/proposals/${proposal.id}`}
                            className="text-xs text-purple-600 hover:underline">
                            View →
                        </Link>
                    </div>
                </div>
            </div>

            <DefenceDeadlineStrip
                deadline={proposal.defence_deadline}
                onRequestExtension={() => onRequestDeadlineExtension(proposal)}
            />

            {/* ── Footer ── */}
            <div className={`px-5 py-3 border-t flex items-center justify-between ${allSubmitted ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                <div className="flex items-center gap-4">
                    <Link
                        href={`/proposals/${proposal.id}/defence`}
                        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-semibold transition-colors"
                    >
                        <UserPlus size={13} /> {assignments.length === 0 ? 'Assign Reviewers' : 'Add Reviewer'}
                    </Link>
                    {assignments.length > 0 && <DefenceRecordButton proposalId={proposal.id} trackerNumber={proposal.tracker_number} />}
                </div>

                {allSubmitted ? (
                    <span className="text-xs font-semibold text-green-600 flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Result processed automatically
                    </span>
                ) : (
                    <span className="text-xs text-gray-400">
                        Waiting for {assignments.length - submitted} more review{assignments.length - submitted !== 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'active',   label: 'Active',           color: 'purple' },
    { key: 'overdue',  label: 'Due Date Passed',   color: 'red'    },
    { key: 'complete', label: 'Completed',          color: 'green'  },
];

function TabBar({ active, counts, onChange }) {
    return (
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {TABS.map(tab => {
                const isActive = active === tab.key;
                const count    = counts[tab.key] ?? 0;
                const activeStyle = {
                    purple: 'bg-white text-purple-700 shadow-sm border border-purple-100',
                    red:    'bg-white text-red-600    shadow-sm border border-red-100',
                    green:  'bg-white text-green-700  shadow-sm border border-green-100',
                }[tab.color];

                return (
                    <button
                        key={tab.key}
                        onClick={() => onChange(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            isActive ? activeStyle : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                        }`}
                    >
                        {tab.label}
                        {count > 0 && (
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center ${
                                isActive
                                    ? { purple: 'bg-purple-100 text-purple-700', red: 'bg-red-100 text-red-600', green: 'bg-green-100 text-green-700' }[tab.color]
                                    : 'bg-gray-200 text-gray-600'
                            }`}>
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OpenDefence() {
    const { success, error } = useToast();
    const { user, hasRole } = useAuth();
    const { app_settings } = usePage().props;
    const isCollegeOfficer = hasRole('college_officer');
    const [view, setView] = useViewPreference('open_defence', 'card');
    const [activeTab, setActiveTab] = useState('active');

    const [allProposals, setAllProposals]        = useState([]);
    const [yearFilter, setYearFilter]            = useState(app_settings?.current_academic_year ?? '');
    const [categoryFilter, setCategoryFilter]    = useState('');
    const [collegeFilter, setCollegeFilter]      = useState('');
    const [loading, setLoading]                  = useState(true);
    const [reassignModal, setReassignModal]       = useState(null);
    const [removeConfirm, setRemoveConfirm]       = useState(null);
    const [removing, setRemoving]                 = useState(false);
    const [defenceHold, setDefenceHold]           = useState(null);
    const [deadlineExtensionFor, setDeadlineExtensionFor] = useState(null);

    // Defence score deadlines move only through an approved college-officer request,
    // so the per-reviewer "Extend" action routes here too.
    const openDeadlineExtension = (proposal) => {
        if (proposal.defence_deadline?.can_request_extension) {
            setDeadlineExtensionFor(proposal);
        } else if (proposal.defence_deadline?.pending_extension) {
            error('An extension request for this defence is already awaiting approval.');
        } else {
            error("Open defence score deadlines are extended by the college officer's request, approved by the category director or the central office.");
        }
    };

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/review-management', {
                params: { status: 'blind_review_passed,under_open_defence' },
            });
            setAllProposals(res.data?.data ?? []);
        } catch { error('Failed to load open defence proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    // Reached directly (URL, bookmark, command palette) rather than via the sidebar,
    // which already checks first — the server only gates college officers.
    useEffect(() => {
        api.get('/defence/college-readiness')
            .then((res) => {
                const readiness = res.data?.data;
                if (readiness && !readiness.can_schedule) {
                    setDefenceHold({
                        collegeName: readiness.college_name,
                        pending: readiness.pending_blind_review ?? [],
                    });
                }
            })
            .catch(() => {});
    }, []);

    const openReassign    = (assignment, proposalId, currentAssignments) => setReassignModal({ assignment, proposalId, currentAssignments });
    const confirmRemove   = (assignment)                                  => setRemoveConfirm(assignment);

    const doRemove = async () => {
        if (!removeConfirm) return;
        setRemoving(true);
        try {
            await api.delete(`/review-assignments/${removeConfirm.id}/remove`);
            success('Reviewer removed.');
            setRemoveConfirm(null);
            load();
        } catch (e) { error(e.response?.data?.message || 'Failed to remove reviewer.'); }
        setRemoving(false);
    };

    const afterSave = () => {
        success('Saved successfully.');
        setReassignModal(null);
        load();
    };

    // ── Year/category/college options & client-side filters ──
    const availableYears      = [...new Set(allProposals.map(p => p.academic_year).filter(Boolean))].sort().reverse();
    const availableCategories = [...new Set(allProposals.map(p => p.category).filter(Boolean))].sort();
    const availableColleges   = [...new Map(allProposals.filter(p => p.college).map(p => [p.college.id, p.college])).values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    const proposals = allProposals
        .filter(p => !yearFilter || p.academic_year === yearFilter)
        .filter(p => !categoryFilter || p.category === categoryFilter)
        .filter(p => !collegeFilter || p.college_id === collegeFilter);

    // ── Data slices ──
    const passedBlindReview = proposals.filter(p => p.status === 'blind_review_passed');
    const underDefence      = proposals.filter(p => p.status === 'under_open_defence');

    const defenceAssignments = p => (p.review_assignments ?? []).filter(a => (a.evaluation_type?.name ?? '').startsWith('open_defence'));

    const tabActive   = underDefence.filter(p => {
        const assignments = defenceAssignments(p);
        const allDone    = assignments.length > 0 && assignments.every(a => a.status === 'submitted');
        const hasOverdue = assignments.some(a => a.due_date && daysUntil(a.due_date) < 0 && a.status !== 'submitted');
        return !allDone && !hasOverdue;
    });
    const tabOverdue  = underDefence.filter(p => {
        const assignments = defenceAssignments(p);
        return assignments.some(a => a.due_date && daysUntil(a.due_date) < 0 && a.status !== 'submitted');
    });
    const tabComplete = underDefence.filter(p => {
        const assignments = defenceAssignments(p);
        return assignments.length > 0 && assignments.every(a => a.status === 'submitted');
    });

    const tabCounts = { active: tabActive.length, overdue: tabOverdue.length, complete: tabComplete.length };

    const tabProposals = { active: tabActive, overdue: tabOverdue, complete: tabComplete }[activeTab] ?? [];

    // ── Stats ──
    const totalAssignments = underDefence.reduce((s, p) => s + defenceAssignments(p).length, 0);
    const totalSubmitted   = underDefence.reduce((s, p) => s + defenceAssignments(p).filter(a => a.status === 'submitted').length, 0);
    const totalOverdue     = underDefence.reduce((s, p) => s + defenceAssignments(p).filter(a => a.due_date && daysUntil(a.due_date) < 0 && a.status !== 'submitted').length, 0);

    return (
        <AppLayout breadcrumb="Open Defence">
            <OpenDefenceHoldModal
                open={!!defenceHold}
                collegeName={defenceHold?.collegeName}
                pending={defenceHold?.pending}
            />
            <div className="max-w-6xl mx-auto">
                <WorkflowBreadcrumb current="under_open_defence" />

                {isCollegeOfficer && user?.college_name && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-5 text-sm text-blue-700">
                        <Building2 size={14} className="text-blue-400 shrink-0" />
                        Showing proposals from your college: <strong>{user.college_name}</strong>
                    </div>
                )}

                {/* ── Page header ── */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-purple-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-purple-200">
                            <Presentation size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Open Defence Management</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Schedule defences and manage active open defence reviews</p>
                        </div>
                    </div>
                    <FilterBar
                        accent="purple"
                        activeCount={[collegeFilter, categoryFilter, yearFilter].filter(Boolean).length}
                        trailing={
                            <>
                                <ViewToggle view={view} onChange={setView} />
                                <button onClick={load}
                                    className="flex items-center gap-2 px-3.5 py-2.5 sm:py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium shrink-0">
                                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                    <span className="hidden sm:inline">Refresh</span>
                                </button>
                            </>
                        }
                    >
                        {availableColleges.length > 1 && (
                            <select
                                value={collegeFilter}
                                onChange={e => { setCollegeFilter(e.target.value); setActiveTab('active'); }}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                            >
                                <option value="">All Colleges</option>
                                {availableColleges.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                        {availableCategories.length > 1 && (
                            <select
                                value={categoryFilter}
                                onChange={e => { setCategoryFilter(e.target.value); setActiveTab('active'); }}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                            >
                                <option value="">All Categories</option>
                                {availableCategories.map(c => (
                                    <option key={c} value={c}>{getCategoryLabel(c)}</option>
                                ))}
                            </select>
                        )}
                        {availableYears.length > 0 && (
                            <select
                                value={yearFilter}
                                onChange={e => { setYearFilter(e.target.value); setActiveTab('active'); }}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                            >
                                <option value="">All Years</option>
                                {availableYears.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        )}
                    </FilterBar>
                </div>

                {/* ── Stat cards ── */}
                {!loading && allProposals.length > 0 && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                        <StatCard icon={Shield}       label="Awaiting Schedule"  value={passedBlindReview.length} color="green" />
                        <StatCard icon={Presentation} label="Under Defence"       value={underDefence.length}      color="purple" />
                        <StatCard icon={Activity}     label="Reviews Submitted"   value={`${totalSubmitted}/${totalAssignments}`} sub="of assigned reviews" color="blue" />
                        <StatCard icon={AlertCircle}  label="Overdue Reviews"     value={totalOverdue} color={totalOverdue > 0 ? 'red' : 'gray'} />
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-400">Loading proposals…</p>
                    </div>
                ) : passedBlindReview.length === 0 && underDefence.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className="h-16 w-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <Presentation size={30} className="text-purple-300" />
                        </div>
                        <h3 className="text-gray-700 font-semibold text-base mb-1">No proposals in open defence</h3>
                        <p className="text-sm text-gray-400 mb-4">Proposals that pass blind review will appear here for scheduling.</p>
                        <Link href="/admin/blind-review"
                            className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-semibold transition-colors">
                            Go to Blind Review <ChevronRight size={14} />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-10">

                        {/* ── Awaiting Schedule (above tabs) ── */}
                        {passedBlindReview.length > 0 && (
                            <div>
                                <div className="border-l-4 border-l-green-500 pl-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <Calendar size={18} className="text-green-600" />
                                        <h2 className="text-base font-bold text-gray-900">Awaiting Defence Schedule</h2>
                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">{passedBlindReview.length}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">These proposals passed blind review and need a defence session scheduled.</p>
                                </div>
                                {view === 'table' ? (
                                    <ProposalTable
                                        proposals={passedBlindReview}
                                        showColumns={['tracker', 'title', 'category', 'college', 'status']}
                                        actions={(p) => (
                                            <Link href={`/proposals/${p.id}/defence`}
                                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors">
                                                Schedule Defence
                                            </Link>
                                        )}
                                        emptyMessage="No proposals awaiting scheduling."
                                    />
                                ) : (
                                    <div className="space-y-3">
                                        {passedBlindReview.map(p => <AwaitingRow key={p.id} proposal={p} />)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Under Open Defence (tabbed) ── */}
                        {underDefence.length > 0 && (
                            <div>
                                <div className="border-l-4 border-l-purple-500 pl-4 mb-5">
                                    <div className="flex items-center gap-3">
                                        <Presentation size={18} className="text-purple-600" />
                                        <h2 className="text-base font-bold text-gray-900">Under Open Defence</h2>
                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{underDefence.length}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {totalSubmitted} of {totalAssignments} assigned reviews submitted.
                                        Hover the review badge on each card to see reviewer details.
                                    </p>
                                </div>

                                <TabBar active={activeTab} counts={tabCounts} onChange={setActiveTab} />

                                <div className="mt-5">
                                    {tabProposals.length === 0 ? (
                                        <div className="bg-white border border-gray-200 rounded-2xl py-12 text-center">
                                            <CheckCircle2 size={28} className="mx-auto text-gray-200 mb-3" />
                                            <p className="text-sm text-gray-400">No proposals in this category.</p>
                                        </div>
                                    ) : view === 'table' ? (
                                        <ProposalTable
                                            proposals={tabProposals}
                                            showColumns={['tracker', 'title', 'category', 'college', 'status']}
                                            actions={(p) => (
                                                <Link href={`/proposals/${p.id}`}
                                                    className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                                                    View
                                                </Link>
                                            )}
                                            emptyMessage="No proposals in this tab."
                                        />
                                    ) : (
                                        <div className="space-y-4">
                                            {tabProposals.map(p => (
                                                <DefenceCard
                                                    key={p.id}
                                                    proposal={p}
                                                    onReassign={openReassign}
                                                    onExtend={() => openDeadlineExtension(p)}
                                                    onRemove={confirmRemove}
                                                    onRequestDeadlineExtension={openDeadlineExtension}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            {reassignModal && (
                <ReassignModal
                    assignment={reassignModal.assignment}
                    proposalId={reassignModal.proposalId}
                    currentAssignments={reassignModal.currentAssignments}
                    onSave={afterSave}
                    onClose={() => setReassignModal(null)}
                />
            )}
            {deadlineExtensionFor && (
                <RequestDeadlineExtensionModal
                    proposal={deadlineExtensionFor}
                    onClose={() => setDeadlineExtensionFor(null)}
                    onSaved={() => { setDeadlineExtensionFor(null); load(); }}
                />
            )}

            {removeConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                                <Trash2 size={18} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Remove Reviewer</h3>
                                <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
                            <p className="text-sm text-gray-700">
                                Remove <strong>{removeConfirm.reviewer?.name}</strong> from this proposal's review panel?
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setRemoveConfirm(null)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                                Keep Reviewer
                            </button>
                            <button onClick={doRemove} disabled={removing}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                                {removing ? 'Removing…' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </AppLayout>
    );
}
