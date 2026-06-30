import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    AlertCircle, MessageSquare, ArrowUpCircle, Pencil, Trash2,
    X, ChevronRight, Clock, CheckCircle2, XCircle, RotateCcw,
    TrendingUp, FileText,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import DataTable from '../../Components/DataTable';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { get, post, put, del } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGE_LABELS = {
    blind_review: 'Blind Review',
    open_defence: 'Open Defence',
    post_funding: 'Post Funding',
};

const TYPE_LABELS = {
    budget:     'Budget',
    rejection:  'Rejection',
    other:      'Other',
    escalation: 'Escalation',
};

const LEVEL_BADGES = {
    college: 'bg-blue-100 text-blue-700 border border-blue-200',
    officer: 'bg-purple-100 text-purple-700 border border-purple-200',
};

const TYPE_BADGES = {
    budget:     'bg-amber-100 text-amber-700',
    rejection:  'bg-red-100 text-red-700',
    other:      'bg-gray-100 text-gray-600',
    escalation: 'bg-orange-100 text-orange-700',
};

const STATUS_CONFIG = {
    open:         { label: 'Open',         cls: 'bg-blue-100 text-blue-700',    icon: Clock },
    under_review: { label: 'Under Review', cls: 'bg-yellow-100 text-yellow-700', icon: RotateCcw },
    resolved:     { label: 'Resolved',     cls: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
    dismissed:    { label: 'Dismissed',    cls: 'bg-gray-100 text-gray-500',    icon: XCircle },
    escalated:    { label: 'Escalated',    cls: 'bg-orange-100 text-orange-700', icon: ArrowUpCircle },
};

const STATUS_FILTERS = [
    { value: '',             label: 'All' },
    { value: 'open',         label: 'Open' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'resolved',     label: 'Resolved' },
    { value: 'dismissed',    label: 'Dismissed' },
    { value: 'escalated',    label: 'Escalated' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600', icon: Clock };
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
}

function LevelBadge({ level }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_BADGES[level] ?? 'bg-gray-100 text-gray-500'}`}>
            {level === 'college' ? 'Level 1' : 'Level 2'}
        </span>
    );
}

function TypeBadge({ complaint }) {
    if (complaint.complaint_type) {
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[complaint.complaint_type] ?? 'bg-gray-100 text-gray-600'}`}>
                {TYPE_LABELS[complaint.complaint_type] ?? complaint.complaint_type}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">
            {STAGE_LABELS[complaint.stage] ?? complaint.stage}
        </span>
    );
}

function StatCard({ label, value, color, icon: Icon }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={18} className="text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function DetailModal({ complaint, userId, isOfficer, isAdmin, onClose, onAction }) {
    const isOwner        = complaint.complainant_id === userId;
    const isEditable     = isOwner && ['open', 'under_review'].includes(complaint.status);
    const isWithdrawable = isOwner && complaint.status === 'open';
    const canEscalate    = isOwner && complaint.level === 'college' && ['resolved', 'dismissed'].includes(complaint.status);
    const canRespond     = (isAdmin || (isOfficer && complaint.level === (isOfficer === 'college' ? 'college' : 'officer')))
        && ['open', 'under_review'].includes(complaint.status);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                            <AlertCircle size={16} className="text-orange-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    {complaint.proposal?.tracker_number ?? '—'}
                                </span>
                                <LevelBadge level={complaint.level} />
                                <TypeBadge complaint={complaint} />
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{complaint.proposal?.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <StatusBadge status={complaint.status} />
                        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-gray-400 font-medium mb-1">Filed by</p>
                            <p className="text-gray-800 font-semibold">{complaint.complainant?.name ?? '—'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-gray-400 font-medium mb-1">Date filed</p>
                            <p className="text-gray-800 font-semibold">{formatDate(complaint.created_at)}</p>
                        </div>
                    </div>

                    {/* Escalation notice */}
                    {complaint.escalated_from_id && (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
                            <ArrowUpCircle size={13} />
                            This is an escalation from a college-level complaint
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Complaint Description</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-100">
                            {complaint.description}
                        </p>
                    </div>

                    {/* Response */}
                    {complaint.response && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Official Response</p>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-green-700">
                                        {complaint.resolvedBy?.name ?? 'Officer'}
                                    </span>
                                    <span className="text-xs text-green-600">{formatDate(complaint.resolved_at)}</span>
                                </div>
                                <p className="text-sm text-green-800 leading-relaxed">{complaint.response}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <Link
                        href={`/proposals/${complaint.proposal?.id}`}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                        <FileText size={13} /> View Proposal <ChevronRight size={12} />
                    </Link>
                    <div className="flex gap-2">
                        {canRespond && (
                            <button
                                onClick={() => onAction('respond', complaint)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                            >
                                <MessageSquare size={12} /> Respond
                            </button>
                        )}
                        {canEscalate && (
                            <button
                                onClick={() => onAction('escalate', complaint)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600"
                            >
                                <ArrowUpCircle size={12} /> Escalate
                            </button>
                        )}
                        {isEditable && (
                            <button
                                onClick={() => onAction('edit', complaint)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-white"
                            >
                                <Pencil size={12} /> Edit
                            </button>
                        )}
                        {isWithdrawable && (
                            <button
                                onClick={() => onAction('withdraw', complaint)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50"
                            >
                                <Trash2 size={12} /> Withdraw
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function RespondModal({ complaint, onSave, onClose }) {
    const [response,   setResponse]   = useState('');
    const [resolution, setResolution] = useState('resolved');
    const [saving,     setSaving]     = useState(false);
    const { error } = useToast();

    const submit = async () => {
        if (!response.trim()) { error('Response is required.'); return; }
        setSaving(true);
        try {
            await post(`/complaints/${complaint.id}/respond`, { response, resolution });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to submit response.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Respond to Complaint</h2>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{complaint.proposal?.tracker_number}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                        <X size={16} />
                    </button>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4 text-xs text-gray-600 leading-relaxed line-clamp-3">
                    {complaint.description}
                </div>

                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Response <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                    rows={5}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                    placeholder="Write a thorough response…"
                />

                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Resolution</label>
                <div className="flex gap-3 mb-5">
                    {[
                        { value: 'resolved', label: 'Resolved', color: 'border-green-500 bg-green-50 text-green-700' },
                        { value: 'dismissed', label: 'Dismissed', color: 'border-gray-400 bg-gray-50 text-gray-600' },
                    ].map(opt => (
                        <label key={opt.value}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 border-2 rounded-xl cursor-pointer text-sm font-medium transition-colors ${
                                resolution === opt.value ? opt.color : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                        >
                            <input type="radio" className="sr-only" value={opt.value} checked={resolution === opt.value}
                                onChange={() => setResolution(opt.value)} />
                            {opt.label}
                        </label>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={saving || !response.trim()}
                        className="flex-1 px-4 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">
                        {saving ? 'Submitting…' : 'Submit Response'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EscalateModal({ complaint, onSave, onClose }) {
    const [description, setDescription] = useState('');
    const [saving,      setSaving]      = useState(false);
    const { error } = useToast();

    const submit = async () => {
        if (description.trim().length < 30) { error('Please provide at least 30 characters.'); return; }
        setSaving(true);
        try {
            await post(`/complaints/${complaint.id}/escalate`, { description });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to escalate.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Escalate Complaint</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-amber-700 leading-relaxed">
                    This complaint will be reviewed by the Research / Community / Technology Officer responsible for your proposal's category.
                </div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Reason for escalation <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={5}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 mb-5"
                    placeholder="Explain why you are not satisfied with the college officer's decision…"
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit} disabled={saving || description.trim().length < 30}
                        className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
                        {saving ? 'Escalating…' : 'Escalate to Officer'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditModal({ complaint, onSave, onClose }) {
    const [description, setDescription] = useState(complaint.description ?? '');
    const [saving,      setSaving]      = useState(false);
    const { error } = useToast();
    const tooShort = description.trim().length < 50;

    const submit = async () => {
        if (tooShort) { error('Description must be at least 50 characters.'); return; }
        setSaving(true);
        try {
            await put(`/complaints/${complaint.id}`, { description });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to update.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Edit Complaint</h2>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{complaint.proposal?.tracker_number}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Description <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={7}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                />
                <p className={`text-xs mb-4 ${tooShort ? 'text-red-400' : 'text-green-600'}`}>
                    {description.trim().length} / 50 minimum characters
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit} disabled={saving || tooShort}
                        className="flex-1 px-4 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComplaintsIndex() {
    const { user, hasAnyRole, hasRole } = useAuth();
    const { success, error } = useToast();

    const isCollegeOfficer  = hasRole('college_officer');
    const isCategoryOfficer = hasAnyRole(['research_officer', 'community_officer', 'technology_officer']);
    const isAdmin           = hasAnyRole(['super_admin', 'admin', 'central_officer']);
    const isOfficer         = isCollegeOfficer ? 'college' : isCategoryOfficer ? 'officer' : false;
    const isUser            = !isAdmin && !isCollegeOfficer && !isCategoryOfficer;

    const defaultLevel = isCollegeOfficer ? 'college' : isCategoryOfficer ? 'officer' : '';
    const [levelFilter,  setLevelFilter]  = useState(defaultLevel);
    const [statusFilter, setStatusFilter] = useState('');
    const [complaints,   setComplaints]   = useState([]);
    const [loading,      setLoading]      = useState(true);

    // Modals
    const [detail,   setDetail]   = useState(null);
    const [respond,  setRespond]  = useState(null);
    const [escalate, setEscalate] = useState(null);
    const [edit,     setEdit]     = useState(null);
    const [withdraw, setWithdraw] = useState(null);
    const [withdrawing, setWithdrawing] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (levelFilter) params.level = levelFilter;
        get('/complaints', params)
            .then(r => {
                const raw = r.data?.data ?? r.data ?? [];
                setComplaints(Array.isArray(raw) ? raw : raw?.data ?? []);
            })
            .catch(() => error('Failed to load complaints.'))
            .finally(() => setLoading(false));
    }, [levelFilter]);

    useEffect(() => { load(); }, [load]);

    const handleAction = (type, complaint) => {
        setDetail(null);
        if (type === 'respond')  setRespond(complaint);
        if (type === 'escalate') setEscalate(complaint);
        if (type === 'edit')     setEdit(complaint);
        if (type === 'withdraw') setWithdraw(complaint);
    };

    const handleWithdrawConfirm = async () => {
        if (!withdraw) return;
        setWithdrawing(true);
        try {
            await del(`/complaints/${withdraw.id}`);
            setWithdraw(null);
            success('Complaint withdrawn successfully.');
            load();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to withdraw.');
        }
        setWithdrawing(false);
    };

    const done = (msg) => {
        setRespond(null); setEscalate(null); setEdit(null);
        success(msg);
        load();
    };

    // Stats
    const stats = useMemo(() => {
        const all = complaints;
        return {
            total:        all.length,
            open:         all.filter(c => c.status === 'open').length,
            under_review: all.filter(c => c.status === 'under_review').length,
            resolved:     all.filter(c => ['resolved', 'dismissed'].includes(c.status)).length,
        };
    }, [complaints]);

    // Filtered view
    const visible = useMemo(() =>
        statusFilter ? complaints.filter(c => c.status === statusFilter) : complaints,
    [complaints, statusFilter]);

    // Level tabs
    const levelTabs = [
        ...(isAdmin ? [{ value: '', label: 'All Complaints' }] : []),
        ...(isAdmin || isCollegeOfficer ? [{ value: 'college', label: 'Level 1 — College' }] : []),
        ...(isAdmin || isCategoryOfficer ? [{ value: 'officer', label: 'Level 2 — Officer' }] : []),
        ...(isUser ? [{ value: '', label: 'My Complaints' }] : []),
    ];

    // Table columns
    const columns = useMemo(() => [
        {
            id: 'proposal',
            header: 'Proposal',
            accessorFn: row => row.proposal?.tracker_number ?? '',
            cell: ({ row: { original: c } }) => (
                <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {c.proposal?.tracker_number ?? '—'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1 truncate max-w-50">{c.proposal?.title}</p>
                </div>
            ),
        },
        {
            id: 'level',
            header: 'Level',
            accessorFn: row => row.level,
            cell: ({ row: { original: c } }) => <LevelBadge level={c.level} />,
        },
        {
            id: 'type',
            header: 'Type / Stage',
            cell: ({ row: { original: c } }) => <TypeBadge complaint={c} />,
        },
        ...(isAdmin || isCollegeOfficer || isCategoryOfficer ? [{
            id: 'complainant',
            header: 'Filed By',
            accessorFn: row => row.complainant?.name ?? '',
            cell: ({ row: { original: c } }) => (
                <span className="text-sm text-gray-700">{c.complainant?.name ?? '—'}</span>
            ),
        }] : []),
        {
            id: 'status',
            header: 'Status',
            accessorFn: row => row.status,
            cell: ({ row: { original: c } }) => <StatusBadge status={c.status} />,
        },
        {
            id: 'date',
            header: 'Filed',
            accessorFn: row => row.created_at,
            cell: ({ row: { original: c } }) => (
                <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>
            ),
        },
        {
            id: 'actions',
            header: '',
            enableSorting: false,
            cell: ({ row: { original: c } }) => {
                const isOwner     = c.complainant_id === user?.id;
                const canRespond  = (isAdmin || isCollegeOfficer || isCategoryOfficer)
                    && ['open', 'under_review'].includes(c.status);
                const canEscalate = isOwner && c.level === 'college' && ['resolved', 'dismissed'].includes(c.status);
                const isEditable  = isOwner && ['open', 'under_review'].includes(c.status);

                return (
                    <div className="flex items-center justify-end gap-1.5">
                        <button
                            onClick={() => setDetail(c)}
                            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            View
                        </button>
                        {canRespond && (
                            <button
                                onClick={() => setRespond(c)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <MessageSquare size={11} /> Respond
                            </button>
                        )}
                        {canEscalate && (
                            <button
                                onClick={() => setEscalate(c)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
                            >
                                <ArrowUpCircle size={11} /> Escalate
                            </button>
                        )}
                        {isEditable && (
                            <button
                                onClick={() => setEdit(c)}
                                className="p-1.5 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                title="Edit"
                            >
                                <Pencil size={13} />
                            </button>
                        )}
                        {isOwner && c.status === 'open' && (
                            <button
                                onClick={() => setWithdraw(c)}
                                className="p-1.5 text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
                                title="Withdraw"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                );
            },
        },
    ], [user, isAdmin, isCollegeOfficer, isCategoryOfficer]);

    return (
        <AppLayout breadcrumb="Complaints">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ── Page header ─────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {isCollegeOfficer && !isAdmin && 'College-level complaints (blind review & open defence) for your college'}
                            {isCategoryOfficer && !isAdmin && 'Post-funding complaints assigned to your category'}
                            {isAdmin && 'All complaints across all levels and colleges'}
                            {isUser && 'Your submitted complaints. File new complaints from the Complaints tab on your proposal.'}
                        </p>
                    </div>
                    {isUser && (
                        <Link
                            href="/my-proposals"
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition-colors"
                        >
                            <FileText size={15} /> My Proposals
                        </Link>
                    )}
                </div>

                {/* ── Stats cards ─────────────────────────────────────── */}
                {!isUser && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Total"        value={stats.total}        color="bg-slate-600"  icon={AlertCircle} />
                        <StatCard label="Open"         value={stats.open}         color="bg-blue-600"   icon={Clock} />
                        <StatCard label="Under Review" value={stats.under_review} color="bg-yellow-500" icon={RotateCcw} />
                        <StatCard label="Resolved"     value={stats.resolved}     color="bg-green-600"  icon={TrendingUp} />
                    </div>
                )}

                {/* ── Main card ───────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                    {/* Level tabs */}
                    {levelTabs.length > 1 && (
                        <div className="flex border-b border-gray-200 overflow-x-auto">
                            {levelTabs.map(tab => (
                                <button
                                    key={tab.value}
                                    onClick={() => setLevelFilter(tab.value)}
                                    className={`px-5 py-3.5 text-sm font-medium shrink-0 border-b-2 transition-colors ${
                                        levelFilter === tab.value
                                            ? 'border-blue-600 text-blue-700 bg-blue-50/40'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Level context banner */}
                    {levelFilter === 'college' && (
                        <div className="mx-5 mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                            <strong>Level 1 — College Office:</strong> Complaints filed during Blind Review and Open Defence phases. Officers respond; unsatisfied users may escalate.
                        </div>
                    )}
                    {levelFilter === 'officer' && (
                        <div className="mx-5 mt-4 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-xs text-purple-700">
                            <strong>Level 2 — Category Officer:</strong> Post-funding complaints (budget, rejection, other). Routed to the Research / Community / Technology officer.
                        </div>
                    )}

                    {/* Status filter pills */}
                    <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto border-b border-gray-100">
                        {STATUS_FILTERS.map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                    statusFilter === f.value
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {f.label}
                                {f.value && (
                                    <span className="ml-1.5 opacity-60">
                                        {complaints.filter(c => c.status === f.value).length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="p-5">
                        <DataTable
                            columns={columns}
                            data={visible}
                            isLoading={loading}
                            emptyMessage={
                                isUser
                                    ? 'No complaints found. Go to a proposal and open the Complaints tab to file one.'
                                    : 'No complaints match the selected filters.'
                            }
                        />
                    </div>
                </div>
            </div>

            {/* ── Modals ──────────────────────────────────────────────── */}
            {detail && (
                <DetailModal
                    complaint={detail}
                    userId={user?.id}
                    isOfficer={isOfficer}
                    isAdmin={isAdmin}
                    onClose={() => setDetail(null)}
                    onAction={handleAction}
                />
            )}
            {respond && (
                <RespondModal
                    complaint={respond}
                    onSave={() => done('Response submitted successfully.')}
                    onClose={() => setRespond(null)}
                />
            )}
            {escalate && (
                <EscalateModal
                    complaint={escalate}
                    onSave={() => done('Complaint escalated to officer level.')}
                    onClose={() => setEscalate(null)}
                />
            )}
            {edit && (
                <EditModal
                    complaint={edit}
                    onSave={() => done('Complaint updated.')}
                    onClose={() => setEdit(null)}
                />
            )}
            <ConfirmDialog
                open={!!withdraw}
                title="Withdraw Complaint"
                description={`Are you sure you want to withdraw your complaint about ${withdraw?.proposal?.tracker_number ?? 'this proposal'}? This action cannot be undone.`}
                confirmLabel={withdrawing ? 'Withdrawing…' : 'Withdraw'}
                confirmVariant="danger"
                onConfirm={handleWithdrawConfirm}
                onCancel={() => setWithdraw(null)}
            />
        </AppLayout>
    );
}
