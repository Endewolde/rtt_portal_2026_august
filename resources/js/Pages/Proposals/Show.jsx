import { useState, useEffect, useRef } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import { UserCheck, Calendar, Award, CheckCircle, RotateCcw, XCircle, ExternalLink, AlertCircle, ChevronDown, ChevronUp, ArrowUpCircle, MessageSquare, PlusCircle, Pencil, Trash2, Upload, FileText, Eye } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import TrackerNumberDisplay from '../../Components/TrackerNumberDisplay';
import ProposalTimeline from '../../Components/ProposalTimeline';
import api, { get, post, put, del } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';
import { downloadFile } from '../../lib/download';

const TABS = ['Overview', 'Team', 'Budget', 'Documents', 'History', 'Complaints'];

const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];
const COLLEGE_COMPLAINT_STATUSES = ['under_blind_review', 'under_open_defence'];

const COMPLAINT_STAGE_MAP = {
    under_blind_review: 'blind_review',
    under_open_defence: 'open_defence',
};

const COMPLAINT_STAGE_LABELS = {
    blind_review:  'Blind Review',
    open_defence:  'Open Defence',
    post_funding:  'Post Funding',
};

const COMPLAINT_TYPE_LABELS = {
    budget:     'Budget',
    rejection:  'Rejection',
    other:      'Other',
    escalation: 'Escalation',
};

const COMPLAINT_STATUS_COLORS = {
    open:         'bg-blue-100 text-blue-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    resolved:     'bg-green-100 text-green-700',
    dismissed:    'bg-gray-100 text-gray-500',
    escalated:    'bg-orange-100 text-orange-700',
};

const LEVEL_COLORS = {
    college: 'bg-blue-50 text-blue-600 border border-blue-200',
    officer: 'bg-purple-50 text-purple-600 border border-purple-200',
};

// ── File Complaint Modal ─────────────────────────────────────────────────────

function FileComplaintModal({ proposal, level, onSave, onClose }) {
    const isOfficer = level === 'officer';
    const stage     = COMPLAINT_STAGE_MAP[proposal.status] ?? null;

    const [description,   setDescription]   = useState('');
    const [complaintType, setComplaintType] = useState('budget');
    const [saving,        setSaving]        = useState(false);
    const { error } = useToast();

    const minLen    = 50;
    const tooShort  = description.trim().length < minLen;

    const submit = async () => {
        if (tooShort) { error(`Description must be at least ${minLen} characters.`); return; }
        setSaving(true);
        try {
            if (isOfficer) {
                await post(`/proposals/${proposal.id}/complaints/officer`, { complaint_type: complaintType, description });
            } else {
                await post(`/proposals/${proposal.id}/complaints`, { stage, description });
            }
            onSave();
        } catch (e) {
            error(e.response?.data?.message || e.response?.data?.errors?.description?.[0] || 'Failed to submit complaint.');
        }
        setSaving(false);
    };

    const title = isOfficer
        ? 'File Post-Funding Complaint'
        : `File Complaint — ${COMPLAINT_STAGE_LABELS[stage] ?? 'Review'} Phase`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">{title}</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>

                {isOfficer && (
                    <>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Complaint Type</label>
                        <select
                            value={complaintType}
                            onChange={e => setComplaintType(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
                        >
                            <option value="budget">Budget Dispute</option>
                            <option value="rejection">Rejection Appeal</option>
                            <option value="other">Other</option>
                        </select>
                    </>
                )}

                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">(min {minLen} characters)</span>
                </label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                    placeholder="Describe your complaint in detail…"
                />
                <p className={`text-xs mb-4 ${tooShort ? 'text-red-400' : 'text-green-600'}`}>
                    {description.trim().length} / {minLen} characters minimum
                </p>

                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving || tooShort}
                        className={`px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${
                            isOfficer ? 'bg-purple-700 hover:bg-purple-800' : 'bg-blue-700 hover:bg-blue-800'
                        }`}
                    >
                        {saving ? 'Submitting…' : 'Submit Complaint'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Escalate Modal ───────────────────────────────────────────────────────────

function EscalateComplaintModal({ complaint, onSave, onClose }) {
    const [description, setDescription] = useState('');
    const [saving,      setSaving]      = useState(false);
    const { error } = useToast();

    const submit = async () => {
        if (description.trim().length < 30) { error('Please provide at least 30 characters.'); return; }
        setSaving(true);
        try {
            await post(`/complaints/${complaint.id}/escalate`, { description });
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to escalate.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Escalate Complaint</h2>
                <p className="text-xs text-gray-500 mb-3">
                    This complaint will be escalated to the responsible Research / Community / Technology Officer.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
                    Escalations are reviewed by the relevant officer based on your proposal's research category.
                </div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reason for escalation <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={5}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 mb-5"
                    placeholder="Explain why you are not satisfied with the college officer's response…"
                />
                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving || description.trim().length < 30}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
                    >
                        {saving ? 'Escalating…' : 'Escalate'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Edit Complaint Modal ─────────────────────────────────────────────────────

function EditComplaintModal({ complaint, onSave, onClose }) {
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
        } catch (e) {
            error(e.response?.data?.message || 'Failed to update complaint.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Edit Complaint</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{complaint.proposal?.tracker_number ?? '—'}</p>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">(min 50 characters)</span>
                </label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                />
                <p className={`text-xs mb-4 ${tooShort ? 'text-red-400' : 'text-green-600'}`}>
                    {description.trim().length} / 50 characters minimum
                </p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving || tooShort}
                        className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Withdraw Confirm Modal ───────────────────────────────────────────────────

function WithdrawConfirmModal({ complaint, onConfirm, onClose }) {
    const [withdrawing, setWithdrawing] = useState(false);
    const { error } = useToast();

    const confirm = async () => {
        setWithdrawing(true);
        try {
            await del(`/complaints/${complaint.id}`);
            onConfirm();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to withdraw complaint.');
        }
        setWithdrawing(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-2">Withdraw Complaint</h2>
                <p className="text-sm text-gray-600 mb-2">
                    Are you sure you want to withdraw this complaint about{' '}
                    <span className="font-mono font-semibold">{complaint.proposal?.tracker_number ?? '—'}</span>?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-5 text-xs text-red-700">
                    This action is permanent and cannot be undone.
                </div>
                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button
                        onClick={confirm}
                        disabled={withdrawing}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                    >
                        {withdrawing ? 'Withdrawing…' : 'Withdraw Complaint'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Complaints Tab Content ───────────────────────────────────────────────────

function ComplaintsTab({ proposal, userId, isProposalMember, isOfficer, isAdmin }) {
    const [complaints,  setComplaints]  = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [filing,      setFiling]      = useState(null); // 'college' | 'officer'
    const [escalating,  setEscalating]  = useState(null);
    const [editing,     setEditing]     = useState(null);
    const [withdrawing, setWithdrawing] = useState(null);
    const [expanded,    setExpanded]    = useState(null);
    const { success, error } = useToast();

    const canFileCollege = isProposalMember && COLLEGE_COMPLAINT_STATUSES.includes(proposal.status);
    const canFileOfficer = isProposalMember && FUNDED_STATUSES.includes(proposal.status);

    const load = () => {
        setLoading(true);
        get(`/proposals/${proposal.id}/complaints`)
            .then(r => setComplaints(r.data ?? []))
            .catch(() => error('Failed to load complaints.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [proposal.id]);

    const handleSaved = (msg) => {
        setFiling(null);
        setEscalating(null);
        setEditing(null);
        setWithdrawing(null);
        success(msg);
        load();
    };

    const collegeComplaints = complaints.filter(c => c.level === 'college');
    const officerComplaints = complaints.filter(c => c.level === 'officer');

    const renderComplaint = (c) => {
        const isExpanded  = expanded === c.id;
        const isOwner     = c.complainant_id === userId;
        const isEditable  = isOwner && ['open', 'under_review'].includes(c.status);
        const isWithdrawable = isOwner && c.status === 'open';
        const canEscalate = isProposalMember
            && isOwner
            && c.level === 'college'
            && ['resolved', 'dismissed'].includes(c.status);

        return (
            <div key={c.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : c.id)}
                >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${LEVEL_COLORS[c.level]}`}>
                            {c.level === 'college' ? 'Level 1' : 'Level 2'}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">
                            {c.complaint_type
                                ? COMPLAINT_TYPE_LABELS[c.complaint_type] ?? c.complaint_type
                                : COMPLAINT_STAGE_LABELS[c.stage] ?? c.stage}
                        </span>
                        {c.escalated_from_id && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full shrink-0">Escalated</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMPLAINT_STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {c.status?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                        {isExpanded ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
                    </div>
                </div>
                {isExpanded && (
                    <div className="px-4 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
                        <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Filed by</p>
                            <p className="text-sm text-gray-800">{c.complainant?.name ?? '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.description}</p>
                        </div>
                        {c.response && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-xs font-medium text-green-700 mb-1">
                                    Response {c.resolved_by?.name ? `by ${c.resolved_by.name}` : ''} · {formatDate(c.resolved_at)}
                                </p>
                                <p className="text-sm text-green-800 leading-relaxed">{c.response}</p>
                            </div>
                        )}
                        {canEscalate && (
                            <button
                                onClick={() => setEscalating(c)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600"
                            >
                                <ArrowUpCircle size={12} /> Escalate to Officer Level
                            </button>
                        )}
                        {isEditable && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
                            >
                                <Pencil size={12} /> Edit
                            </button>
                        )}
                        {isWithdrawable && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setWithdrawing(c); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50"
                            >
                                <Trash2 size={12} /> Withdraw
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Level 1 — College complaints */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Level 1 — College Office</p>
                        <p className="text-xs text-gray-500">Blind review & open defence phase complaints</p>
                    </div>
                    {canFileCollege && (
                        <button
                            onClick={() => setFiling('college')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800"
                        >
                            <PlusCircle size={13} /> File Complaint
                        </button>
                    )}
                </div>
                {!canFileCollege && isProposalMember && !FUNDED_STATUSES.includes(proposal.status) && (
                    <p className="text-xs text-gray-400 italic">
                        Complaints can be filed during the Blind Review or Open Defence phases.
                    </p>
                )}
                {collegeComplaints.length === 0
                    ? <p className="text-xs text-gray-400">No college-level complaints on record.</p>
                    : <div className="space-y-2">{collegeComplaints.map(renderComplaint)}</div>
                }
            </div>

            <div className="border-t border-gray-200" />

            {/* Level 2 — Officer complaints */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Level 2 — Research / Community / Technology Office</p>
                        <p className="text-xs text-gray-500">Post-funding complaints (budget, rejection, other)</p>
                    </div>
                    {canFileOfficer && (
                        <button
                            onClick={() => setFiling('officer')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 text-white text-xs font-semibold rounded-lg hover:bg-purple-800"
                        >
                            <PlusCircle size={13} /> File Complaint
                        </button>
                    )}
                </div>
                {!canFileOfficer && isProposalMember && !COLLEGE_COMPLAINT_STATUSES.includes(proposal.status) && (
                    <p className="text-xs text-gray-400 italic">
                        Post-funding complaints are available after the proposal has been funded.
                    </p>
                )}
                {officerComplaints.length === 0
                    ? <p className="text-xs text-gray-400">No officer-level complaints on record.</p>
                    : <div className="space-y-2">{officerComplaints.map(renderComplaint)}</div>
                }
            </div>

            {filing && (
                <FileComplaintModal
                    proposal={proposal}
                    level={filing}
                    onSave={() => handleSaved('Complaint submitted successfully.')}
                    onClose={() => setFiling(null)}
                />
            )}
            {escalating && (
                <EscalateComplaintModal
                    complaint={escalating}
                    onSave={() => handleSaved('Complaint escalated to officer level.')}
                    onClose={() => setEscalating(null)}
                />
            )}
            {editing && (
                <EditComplaintModal
                    complaint={editing}
                    onSave={() => handleSaved('Complaint updated.')}
                    onClose={() => setEditing(null)}
                />
            )}
            {withdrawing && (
                <WithdrawConfirmModal
                    complaint={withdrawing}
                    onConfirm={() => handleSaved('Complaint withdrawn.')}
                    onClose={() => setWithdrawing(null)}
                />
            )}
        </div>
    );
}

function ActionButtons({ proposal, onAction, onProcessDefenceResult, isAdmin }) {
    if (!isAdmin) return null;
    const { status, id } = proposal;

    if (status === 'submitted') return (
        <div className="flex flex-wrap gap-2">
            <button onClick={() => onAction('approve')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                <CheckCircle size={15} /> Approve
            </button>
            <button onClick={() => onAction('return')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                <RotateCcw size={15} /> Return for Correction
            </button>
            <button onClick={() => onAction('reject')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                <XCircle size={15} /> Reject
            </button>
        </div>
    );

    if (status === 'validated') return (
        <Link href={`/proposals/${id}/assign-reviewers`}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
            <UserCheck size={15} /> Assign Reviewers
        </Link>
    );

    if (status === 'blind_review_passed') return (
        <Link href={`/proposals/${id}/defence`}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800">
            <Calendar size={15} /> Schedule Open Defence
        </Link>
    );

    if (status === 'under_open_defence') return (
        <button
            onClick={onProcessDefenceResult}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
            <Award size={15} /> Process Defence Result
        </button>
    );

    if (status === 'accepted') return (
        <Link href={`/proposals/${id}/award`}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800">
            <Award size={15} /> Generate Award
        </Link>
    );

    return null;
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS = {
    proposal_document:  'Proposal Document',
    budget_spreadsheet: 'Budget Spreadsheet',
    pi_cv:              'PI CV',
    supporting_document:'Supporting Document',
    shared_document:    'Shared by PI',
};

const DOC_TYPE_COLORS = {
    shared_document: 'bg-blue-100 text-blue-700',
};

function DocumentsTab({ proposalId, documents, userId, isPI, onRefresh }) {
    const { success, error: toastError } = useToast();
    const [uploading,  setUploading]  = useState(false);
    const [docType,    setDocType]    = useState('shared_document');
    const [file,       setFile]       = useState(null);
    const [deleting,   setDeleting]   = useState(null); // id of doc being deleted
    const fileRef = useRef(null);

    const handleUpload = async () => {
        if (!file) return toastError('Select a file first.');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('document_type', docType);
            await api.post(`/proposals/${proposalId}/documents`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            success('File uploaded. College officer can now view it.');
            setFile(null);
            onRefresh();
        } catch (e) {
            toastError(e.response?.data?.message ?? 'Upload failed.');
        }
        setUploading(false);
    };

    const handleDelete = async (docId) => {
        setDeleting(docId);
        try {
            await api.delete(`/proposals/${proposalId}/documents/${docId}`);
            success('Document removed.');
            onRefresh();
        } catch (e) {
            toastError(e.response?.data?.message ?? 'Delete failed.');
        }
        setDeleting(null);
    };

    return (
        <div className="space-y-5">
            {/* Upload section — PI only */}
            {isPI && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-800">Share a file with your College Officer</p>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="block text-xs text-blue-700 mb-1">Document type</label>
                            <select
                                value={docType}
                                onChange={e => setDocType(e.target.value)}
                                className="border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="shared_document">Shared by PI</option>
                                <option value="supporting_document">Supporting Document</option>
                                <option value="budget_spreadsheet">Budget Spreadsheet</option>
                                <option value="pi_cv">PI CV</option>
                            </select>
                        </div>
                        <div
                            className={`flex-1 min-w-48 border-2 border-dashed rounded-xl px-4 py-3 text-center cursor-pointer transition-colors ${
                                file ? 'border-green-400 bg-green-50' : 'border-blue-300 hover:border-blue-500'
                            }`}
                            onClick={() => fileRef.current?.click()}
                        >
                            {file ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileText size={14} className="text-green-600" />
                                    <span className="text-sm text-green-700 font-medium">{file.name}</span>
                                    <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                                        className="text-red-400 hover:text-red-600 ml-1">
                                        <XCircle size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 text-blue-600">
                                    <Upload size={14} />
                                    <span className="text-sm">Click to select file</span>
                                </div>
                            )}
                        </div>
                        <input ref={fileRef} type="file" className="hidden"
                            onChange={e => setFile(e.target.files[0] ?? null)} />
                        <button
                            onClick={handleUpload}
                            disabled={uploading || !file}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold
                                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {uploading ? 'Uploading…' : 'Upload'}
                        </button>
                    </div>
                </div>
            )}

            {/* Document list */}
            {documents.length === 0 ? (
                <p className="text-sm text-gray-400">No documents uploaded yet.</p>
            ) : (
                <ul className="divide-y divide-gray-100">
                    {documents.map(doc => {
                        const isOwner  = (doc.uploaded_by?.id ?? doc.uploaded_by) === userId;
                        const typeColor = DOC_TYPE_COLORS[doc.document_type] ?? 'bg-gray-100 text-gray-600';
                        const typeLabel = DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type?.replace(/_/g, ' ');

                        return (
                            <li key={doc.id} className="flex items-center justify-between py-3 gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <FileText size={18} className="text-gray-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{doc.original_filename}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>
                                                {typeLabel}
                                            </span>
                                            {doc.uploaded_by?.name && (
                                                <span className="text-xs text-gray-400">
                                                    by {doc.uploaded_by.name}
                                                </span>
                                            )}
                                            {doc.file_size && (
                                                <span className="text-xs text-gray-400">
                                                    {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                                                </span>
                                            )}
                                            {doc.created_at && (
                                                <span className="text-xs text-gray-400">
                                                    {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => downloadFile(
                                            `/proposals/${proposalId}/documents/${doc.id}/download`,
                                            doc.original_filename
                                        ).catch(() => toastError('Download failed.'))}
                                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                    >
                                        <ExternalLink size={12} /> Download
                                    </button>
                                    {isOwner && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(doc.id)}
                                            disabled={deleting === doc.id}
                                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                                        >
                                            <Trash2 size={12} /> {deleting === doc.id ? '…' : 'Remove'}
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

// ── Appeal Modal ─────────────────────────────────────────────────────────────
function AppealModal({ proposal, onSave, onClose }) {
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const submit = async () => {
        if (reason.trim().length < 20) { error('Please provide at least 20 characters explaining your appeal.'); return; }
        setSaving(true);
        try {
            const res = await post(`/proposals/${proposal.id}/appeal`, { reason });
            success(res?.message || 'Appeal submitted successfully.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to submit appeal.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Request Reconsideration</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reason for Appeal <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">(min 20 characters)</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={5}
                    placeholder="Explain why you believe this proposal should be reconsidered..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Submitting…' : 'Submit Appeal'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProposalShow() {
    const { url } = usePage();
    const id = url.split('/')[2];
    const { user, hasAnyRole } = useAuth();
    const toast = useToast();

    const [proposal, setProposal] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Overview');
    const [dialog, setDialog] = useState(null);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [appeal, setAppeal] = useState(null);
    const [showAppealModal, setShowAppealModal] = useState(false);

    const isAdmin    = hasAnyRole(['super_admin', 'central_office']);
    const isOfficer  = hasAnyRole(['college_officer', 'college_admin', 'research_officer', 'community_officer', 'technology_officer']);

    const load = () => {
        setLoading(true);
        Promise.all([get(`/proposals/${id}`), get(`/proposals/${id}/workflow-history`)])
            .then(([p, h]) => { setProposal(p.data); setHistory(h.data ?? []); })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    const loadAppeal = () => {
        get(`/proposals/${id}/appeal`).then(r => setAppeal(r.data)).catch(() => {});
    };

    useEffect(() => { load(); loadAppeal(); }, [id]);

    const handleAction = (action) => { setDialog(action); setReason(''); };

    const handleProcessDefenceResult = async () => {
        setSubmitting(true);
        try {
            const res = await post(`/proposals/${id}/defence/process-result`);
            toast.success(res?.message || 'Defence result processed.');
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to process defence result.');
        }
        setSubmitting(false);
    };

    const confirmAction = async () => {
        if (dialog !== 'approve' && !reason.trim()) { toast.warning('Reason is required.'); return; }
        setSubmitting(true);
        try {
            await post(`/proposals/${id}/validation/${dialog}`, { reason });
            if (dialog === 'approve') toast.success('Proposal approved for review.');
            if (dialog === 'return')  toast.warning('Proposal returned to PI for correction.');
            if (dialog === 'reject')  toast.error('Proposal has been rejected.');
            setDialog(null);
            setReason('');
            load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Action failed.');
        }
        setSubmitting(false);
    };

    if (loading) return (
        <AppLayout breadcrumb="Proposal">
            <div className="flex justify-center py-16">
                <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
        </AppLayout>
    );

    if (!proposal) return (
        <AppLayout breadcrumb="Proposal"><p className="text-gray-500">Proposal not found.</p></AppLayout>
    );

    const budgets   = proposal.budgets   ?? [];
    const documents = proposal.documents ?? [];
    const members   = proposal.members   ?? [];
    const budgetTotal       = budgets.reduce((s, b) => s + Number(b.amount || 0), 0);
    const isProposalMember  = user?.id === proposal.pi_user_id
        || members.some(m => m.user_id === user?.id && m.status === 'active');

    return (
        <AppLayout breadcrumb={`Proposals / ${proposal.tracker_number ?? 'Draft'}`}>
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                            {proposal.tracker_number && (
                                <TrackerNumberDisplay trackerNumber={proposal.tracker_number} />
                            )}
                            <h1 className="text-xl font-bold text-gray-900">{proposal.title ?? 'Untitled Draft'}</h1>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                <span><strong>Category:</strong> {getCategoryLabel(proposal.category)}</span>
                                <span><strong>College:</strong> {proposal.college?.name ?? '—'}</span>
                                <span><strong>Year:</strong> {proposal.academic_year ?? '—'}</span>
                                <span><strong>Submitted:</strong> {formatDate(proposal.submitted_at)}</span>
                            </div>
                        </div>
                        <StatusBadge status={proposal.status} size="lg" />
                    </div>

                    {/* Status-specific info panels */}
                    {proposal.status === 'rejected' && (
                        <div className="mt-4 space-y-3">
                            {proposal.rejection_reason && (
                                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                                    <p className="text-sm font-semibold text-red-800 mb-1">Rejection Reason</p>
                                    <p className="text-sm text-red-700">{proposal.rejection_reason}</p>
                                </div>
                            )}
                            {/* Appeal section */}
                            {appeal ? (
                                <div className={`rounded-lg border px-4 py-3 ${appeal.status === 'pending' ? 'bg-amber-50 border-amber-200' : appeal.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <p className={`text-sm font-semibold mb-1 ${appeal.status === 'pending' ? 'text-amber-800' : appeal.status === 'approved' ? 'text-green-800' : 'text-gray-700'}`}>
                                        Appeal {appeal.status === 'pending' ? 'Pending Review' : appeal.status === 'approved' ? 'Approved — Proposal Returned to Draft' : 'Denied'}
                                    </p>
                                    {appeal.resolution_notes && <p className="text-sm text-gray-600">{appeal.resolution_notes}</p>}
                                </div>
                            ) : user?.id === proposal.pi_user_id && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setShowAppealModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <RotateCcw size={14} /> Request Reconsideration
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {proposal.status === 'funded' && proposal.award && (
                        <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-6">
                                <div>
                                    <p className="text-xs font-medium text-emerald-600 uppercase">Grant Reference</p>
                                    <p className="text-sm font-bold text-emerald-800 font-mono">{proposal.award.grant_reference}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-emerald-600 uppercase">Awarded Amount</p>
                                    <p className="text-sm font-bold text-emerald-800">{formatCurrency(proposal.award.awarded_amount)}</p>
                                </div>
                                <div className="ml-auto">
                                    <button
                                        onClick={() =>
                                            downloadFile(
                                                `/proposals/${proposal.id}/award-letter/download`,
                                                `Award-Letter-${proposal.award.grant_reference}.pdf`
                                            ).catch(() => {})
                                        }
                                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        Download Award Letter
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Workflow actions */}
                    {isAdmin && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <ActionButtons proposal={proposal} onAction={handleAction} onProcessDefenceResult={handleProcessDefenceResult} isAdmin={isAdmin} />
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                        {TABS.map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-5 py-3 text-sm font-medium shrink-0 border-b-2 transition-colors ${
                                    activeTab === tab
                                        ? 'border-blue-600 text-blue-700'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}>
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {activeTab === 'Overview' && (
                            <div className="space-y-4 text-sm text-gray-700">
                                {proposal.abstract && (
                                    <div>
                                        <p className="font-semibold text-gray-800 mb-1">Abstract</p>
                                        <p className="leading-relaxed">{proposal.abstract}</p>
                                    </div>
                                )}
                                {proposal.keywords && (
                                    <div>
                                        <p className="font-semibold text-gray-800 mb-1">Keywords</p>
                                        <p className="text-gray-500">{proposal.keywords}</p>
                                    </div>
                                )}
                                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                                    {[
                                        ['PI', proposal.pi?.name],
                                        ['College', proposal.college?.name],
                                        ['Call', proposal.proposalCall?.title],
                                        ['Academic Year', proposal.academic_year],
                                        ['Category', getCategoryLabel(proposal.category)],
                                        ['Status', proposal.status?.replace(/_/g, ' ')],
                                    ].map(([label, val]) => (
                                        <div key={label} className="flex gap-2">
                                            <span className="w-28 shrink-0 text-gray-500">{label}:</span>
                                            <span className="font-medium capitalize">{val ?? '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'Team' && (
                            members.length === 0
                                ? <p className="text-sm text-gray-400">No team members on record.</p>
                                : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                                <tr>
                                                    {['Member', 'Email', 'Role', 'Contribution'].map((h) => (
                                                        <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {members.filter(m => m.status === 'active').map((m) => (
                                                    <tr key={m.id}>
                                                        <td className="px-4 py-2.5 font-medium text-gray-800">{m.user?.name ?? '—'}</td>
                                                        <td className="px-4 py-2.5 text-gray-500">{m.user?.email ?? '—'}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.role === 'pi' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                                {m.role === 'pi' ? 'PI' : 'Co-PI'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-600">{m.contribution_percentage}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                        )}

                        {activeTab === 'Budget' && (
                            budgets.length === 0
                                ? <p className="text-sm text-gray-400">No budget items on record.</p>
                                : (
                                    <div className="space-y-3">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                                    <tr>
                                                        {['Category', 'Description', 'Amount', 'Justification'].map((h) => (
                                                            <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {budgets.map((b) => (
                                                        <tr key={b.id}>
                                                            <td className="px-4 py-2.5 text-gray-600 capitalize">{b.category}</td>
                                                            <td className="px-4 py-2.5 text-gray-800">{b.item_description}</td>
                                                            <td className="px-4 py-2.5 font-medium">{formatCurrency(b.amount)}</td>
                                                            <td className="px-4 py-2.5 text-gray-500 text-xs">{b.justification ?? '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-50 border-t border-gray-200">
                                                    <tr>
                                                        <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-700">Total</td>
                                                        <td className="px-4 py-2 text-sm font-bold text-gray-900">{formatCurrency(budgetTotal)}</td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )
                        )}

                        {activeTab === 'Documents' && (
                            <DocumentsTab
                                proposalId={id}
                                documents={documents}
                                userId={user?.id}
                                isPI={isProposalMember}
                                onRefresh={load}
                            />
                        )}

                        {activeTab === 'History' && (
                            <ProposalTimeline history={history} currentStatus={proposal.status} />
                        )}

                        {activeTab === 'Complaints' && (
                            <ComplaintsTab
                                proposal={proposal}
                                userId={user?.id}
                                isProposalMember={isProposalMember}
                                isOfficer={isOfficer}
                                isAdmin={isAdmin}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Validation reason modal */}
            {dialog && dialog !== 'approve' && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-base font-semibold mb-3 capitalize">{dialog} Proposal</h2>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason (required)…" rows={3}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none resize-none focus:ring-2 focus:ring-blue-500" />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setDialog(null); setReason(''); }}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={confirmAction} disabled={submitting}
                                className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-60 ${
                                    dialog === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'
                                }`}>
                                {submitting ? 'Processing…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve has no reason modal — confirm inline */}
            {dialog === 'approve' && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
                        <h2 className="text-base font-semibold mb-2">Approve Proposal</h2>
                        <p className="text-sm text-gray-500 mb-5">
                            Approving will move this proposal to <strong>Validated</strong> status. Continue?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDialog(null)}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={confirmAction} disabled={submitting}
                                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
                                {submitting ? 'Processing…' : 'Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showAppealModal && (
                <AppealModal
                    proposal={proposal}
                    onSave={() => { setShowAppealModal(false); loadAppeal(); }}
                    onClose={() => setShowAppealModal(false)}
                />
            )}
        </AppLayout>
    );
}
