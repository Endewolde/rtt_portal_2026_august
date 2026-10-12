import { useState, useEffect, useRef } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import { UserCheck, Calendar, Award, CheckCircle, RotateCcw, XCircle, ExternalLink, AlertCircle, ChevronDown, ChevronUp, ArrowUpCircle, MessageSquare, PlusCircle, Pencil, Trash2, Upload, FileText, Eye, Sparkles, RefreshCw, Star, CalendarClock, ClipboardList } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import TrackerNumberDisplay from '../../Components/TrackerNumberDisplay';
import ProposalTimeline from '../../Components/ProposalTimeline';
import api, { get, post, put, del } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useFeature } from '../../hooks/useFeature';
import { formatDate, formatCurrency, getCategoryLabel, getStatusLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';
import ResolveApprovalReportModal from '../../Components/ResolveApprovalReportModal';
import ReportMistakenApprovalModal from '../../Components/ReportMistakenApprovalModal';
import { issueByKey } from '../../lib/approvalReportIssues';
import { downloadFile } from '../../lib/download';

const TABS = ['Overview', 'Team', 'Budget', 'Documents', 'History', 'Reviews', 'Complaints'];

function SlaIndicator({ enteredAt, status }) {
    const daysInStage = Math.floor((Date.now() - new Date(enteredAt).getTime()) / 86400000);
    const isOverdue = daysInStage > 14 && !['funded', 'rejected', 'completed', 'archived', 'draft'].includes(status);
    if (!isOverdue) return null;
    return (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            Overdue — {daysInStage} days in {getStatusLabel(status)} stage
        </div>
    );
}

const REVIEW_VISIBLE_STATUSES = [
    'blind_review_passed', 'under_open_defence', 'funded', 'midterm_evaluation',
    'completed', 'archived', 'rejected',
];

const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];
const COLLEGE_COMPLAINT_STATUSES = ['under_blind_review', 'under_open_defence'];

const COMPLAINT_STAGE_MAP = {
    under_blind_review: 'blind_review',
    under_open_defence: 'open_defence',
};

// Once rejected, proposal.status no longer identifies which review phase to complain
// about — the workflow action that caused the rejection does instead.
const REJECTION_ACTION_STAGE_MAP = {
    fail_blind_review: 'blind_review',
    fail_defence: 'open_defence',
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

function FileComplaintModal({ proposal, level, rejectedVia, onSave, onClose }) {
    const isOfficer = level === 'officer';
    const stage     = COMPLAINT_STAGE_MAP[proposal.status] ?? REJECTION_ACTION_STAGE_MAP[rejectedVia] ?? null;

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

function ComplaintsTab({ proposal, userId, isProposalMember, isOfficer, isAdmin, rejectedVia }) {
    const [complaints,  setComplaints]  = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [filing,      setFiling]      = useState(null); // 'college' | 'officer'
    const [escalating,  setEscalating]  = useState(null);
    const [editing,     setEditing]     = useState(null);
    const [withdrawing, setWithdrawing] = useState(null);
    const [expanded,    setExpanded]    = useState(null);
    const { success, error } = useToast();

    // Also stays open after a terminal rejection specifically caused by failing the
    // blind review or open defence score threshold — the PI should still be able to
    // dispute how THAT review was conducted even though the decision itself is final
    // (disputing the decision is Request Reconsideration's job, scoped separately to
    // central-evaluation rejections only).
    const rejectedOnReviewScore = proposal.status === 'rejected' && rejectedVia in REJECTION_ACTION_STAGE_MAP;
    const canFileCollege = isProposalMember && (COLLEGE_COMPLAINT_STATUSES.includes(proposal.status) || rejectedOnReviewScore);
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
                        Complaints can be filed during the Blind Review or Open Defence phases, or afterward if the
                        proposal was rejected for not meeting the review score threshold.
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
                    rejectedVia={rejectedVia}
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

function ActionButtons({ proposal, onAction, onProcessDefenceResult, isAdmin, canRejectBlindReview, canReportMistakenApproval, hasOpenReport }) {
    if (!isAdmin && !canRejectBlindReview && !canReportMistakenApproval) return null;
    const { status, id } = proposal;

    if (isAdmin && status === 'submitted') return (
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

    if (status === 'validated' && (isAdmin || canRejectBlindReview || canReportMistakenApproval)) return (
        <div className="flex flex-wrap gap-2">
            {isAdmin && (
                <Link href={`/proposals/${id}/assign-reviewers`}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
                    <UserCheck size={15} /> Assign Reviewers
                </Link>
            )}
            {canRejectBlindReview && (
                <button onClick={() => onAction('reject')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                    <XCircle size={15} /> Reject
                </button>
            )}
            {canReportMistakenApproval && !hasOpenReport && (
                <button onClick={() => onAction('report_mistaken_approval')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                    <AlertCircle size={15} /> Report Mistaken Approval
                </button>
            )}
        </div>
    );

    if (status === 'under_blind_review' && (canRejectBlindReview || canReportMistakenApproval)) return (
        <div className="flex flex-wrap gap-2">
            {canRejectBlindReview && (
                <button onClick={() => onAction('reject_blind_review')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                    <XCircle size={15} /> Reject From Blind Review
                </button>
            )}
            {canReportMistakenApproval && !hasOpenReport && (
                <button onClick={() => onAction('report_mistaken_approval')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                    <AlertCircle size={15} /> Report Mistaken Approval
                </button>
            )}
        </div>
    );

    if (status === 'blind_review_passed' && (isAdmin || canRejectBlindReview || canReportMistakenApproval)) return (
        <div className="flex flex-wrap gap-2">
            {isAdmin && (
                <Link href={`/proposals/${id}/defence`}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800">
                    <Calendar size={15} /> Schedule Open Defence
                </Link>
            )}
            {canRejectBlindReview && (
                <button onClick={() => onAction('reject_blind_review')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                    <XCircle size={15} /> Reject
                </button>
            )}
            {canReportMistakenApproval && !hasOpenReport && (
                <button onClick={() => onAction('report_mistaken_approval')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                    <AlertCircle size={15} /> Report Mistaken Approval
                </button>
            )}
        </div>
    );

    if (isAdmin && status === 'under_open_defence') return (
        <button
            onClick={onProcessDefenceResult}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
            <Award size={15} /> Process Defence Result
        </button>
    );

    if (isAdmin && status === 'accepted') return (
        <Link href={`/proposals/${id}/award`}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800">
            <Award size={15} /> Generate Award
        </Link>
    );

    if (status === 'rejected' && canRejectBlindReview) return (
        <button onClick={() => onAction('reopen')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <RotateCcw size={15} /> Reopen for Reconsideration
        </button>
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
    ethical_clearance_certificate: 'Ethical Clearance Certificate',
};

const DOC_TYPE_COLORS = {
    shared_document: 'bg-blue-100 text-blue-700',
    ethical_clearance_certificate: 'bg-purple-100 text-purple-700',
};

function DocumentsTab({ proposalId, documents, userId, isPI, isDraft, hideIdentity, onRefresh, showEthicalClearanceOption }) {
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
                                {showEthicalClearanceOption && (
                                    <option value="ethical_clearance_certificate">Ethical Clearance Certificate</option>
                                )}
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

            {!isDraft && documents.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                    <span className="text-amber-500 text-base mt-0.5">🔒</span>
                    <p className="text-sm text-amber-800">
                        This proposal has been submitted — documents can no longer be removed.
                    </p>
                </div>
            )}

            {/* Document list — grouped by type, current version first, older versions collapsed */}
            {documents.length === 0 ? (
                <p className="text-sm text-gray-400">No documents uploaded yet.</p>
            ) : (
                <div className="space-y-4">
                    {Object.entries(
                        documents.reduce((groups, doc) => {
                            (groups[doc.document_type] ??= []).push(doc);
                            return groups;
                        }, {})
                    ).map(([type, docs]) => {
                        const sorted = [...docs].sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
                        const current = sorted.find(d => d.is_current) ?? sorted[0];
                        const older = sorted.filter(d => d.id !== current.id);
                        const typeColor = DOC_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-600';
                        const typeLabel = DOC_TYPE_LABELS[type] ?? type?.replace(/_/g, ' ');

                        const row = (doc, faded = false) => {
                            const isOwner = (doc.uploaded_by?.id ?? doc.uploaded_by) === userId;
                            return (
                                <li key={doc.id} className={`flex items-center justify-between py-3 gap-4 ${faded ? 'opacity-60' : ''}`}>
                                    <div className="flex items-start gap-3 min-w-0">
                                        <FileText size={18} className="text-gray-400 mt-0.5 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{doc.original_filename}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                {docs.length > 1 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                                        v{doc.version ?? 1}
                                                    </span>
                                                )}
                                                {!hideIdentity && doc.uploaded_by?.name && (
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
                                        {isOwner && isDraft && (
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
                        };

                        return (
                            <div key={type}>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>
                                    {typeLabel}
                                </span>
                                <ul className="divide-y divide-gray-100 mt-1">
                                    {row(current)}
                                </ul>
                                {older.length > 0 && (
                                    <details className="mt-1">
                                        <summary className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer select-none">
                                            {older.length} earlier version{older.length !== 1 ? 's' : ''}
                                        </summary>
                                        <ul className="divide-y divide-gray-100 mt-1">
                                            {older.map(doc => row(doc, true))}
                                        </ul>
                                    </details>
                                )}
                            </div>
                        );
                    })}
                </div>
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

// ─── Ethical Clearance Modal ────────────────────────────────────────────────────
function EthicalClearanceModal({ proposal, onSave, onClose }) {
    const [clearanceNumber, setClearanceNumber] = useState(proposal.ethical_clearance_number ?? '');
    const [expiryDate, setExpiryDate] = useState('');
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const submit = async () => {
        if (!clearanceNumber.trim()) { error('Please enter the certificate/reference number.'); return; }
        if (!expiryDate) { error('Please choose the certificate\'s expiry date.'); return; }
        setSaving(true);
        try {
            const res = await post(`/proposals/${proposal.id}/ethical-clearance/submit`, {
                clearance_number: clearanceNumber, expiry_date: expiryDate,
            });
            success(res?.message || 'Submitted for verification.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to submit.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Submit Ethical Clearance for Verification</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                    Upload your certificate in the Documents tab (type "Ethical Clearance Certificate") before submitting here.
                </p>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Certificate / Reference Number <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={clearanceNumber}
                    onChange={e => setClearanceNumber(e.target.value)}
                    placeholder="e.g. IRB-2026-0042"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Expiry Date <span className="text-red-500">*</span>
                </label>
                <input
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Submitting…' : 'Submit for Verification'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Deadline Extension Modal ──────────────────────────────────────────────────
function ExtensionModal({ proposal, onSave, onClose }) {
    const [reason, setReason] = useState('');
    const [requestedUntil, setRequestedUntil] = useState('');
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const submit = async () => {
        if (reason.trim().length < 20) { error('Please provide at least 20 characters explaining your request.'); return; }
        if (!requestedUntil) { error('Please choose the date you need until.'); return; }
        setSaving(true);
        try {
            const res = await post(`/proposals/${proposal.id}/deadline-extension`, {
                reason, requested_until: requestedUntil,
            });
            success(res?.message || 'Extension request submitted successfully.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to submit extension request.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Request a Deadline Extension</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    I need until <span className="text-red-500">*</span>
                </label>
                <input
                    type="datetime-local"
                    value={requestedUntil}
                    onChange={e => setRequestedUntil(e.target.value)}
                    min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">(min 20 characters)</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={5}
                    placeholder="Explain why you need more time…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Submitting…' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Budget Revision Modal ──────────────────────────────────────────────────────
function BudgetRevisionModal({ proposal, onSave, onClose }) {
    const [reason, setReason] = useState('');
    const [items, setItems] = useState(
        (proposal.budgets ?? []).map(b => ({
            category: b.category ?? '', item_description: b.item_description ?? '',
            amount: String(b.amount ?? ''), justification: b.justification ?? '',
        }))
    );
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const updateItem = (idx, field, value) => {
        setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
    };
    const addItem = () => setItems([...items, { category: '', item_description: '', amount: '', justification: '' }]);
    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

    const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

    const submit = async () => {
        if (reason.trim().length < 20) { error('Please provide at least 20 characters explaining your request.'); return; }
        if (items.length === 0) { error('Add at least one budget item.'); return; }
        if (items.some(it => !it.category.trim() || !it.item_description.trim() || !it.amount)) {
            error('Every item needs a category, description, and amount.');
            return;
        }
        setSaving(true);
        try {
            const res = await post(`/proposals/${proposal.id}/budget-revision`, {
                reason,
                items: items.map(it => ({ ...it, amount: Number(it.amount) })),
            });
            success(res?.message || 'Budget revision request submitted successfully.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to submit budget revision request.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Request a Budget Revision</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>

                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">(min 20 characters)</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    placeholder="Explain why the budget needs to change…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />

                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-700">Revised Budget Items <span className="text-red-500">*</span></p>
                    <button onClick={addItem} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add Item</button>
                </div>

                <div className="space-y-3 mb-4">
                    {items.map((it, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="text" placeholder="Category" value={it.category}
                                    onChange={e => updateItem(idx, 'category', e.target.value)}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="number" placeholder="Amount" value={it.amount} min="0"
                                    onChange={e => updateItem(idx, 'amount', e.target.value)}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <input
                                type="text" placeholder="Item description" value={it.item_description}
                                onChange={e => updateItem(idx, 'item_description', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text" placeholder="Justification (optional)" value={it.justification}
                                    onChange={e => updateItem(idx, 'justification', e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button onClick={() => removeItem(idx)} className="px-3 text-xs text-red-500 hover:text-red-700 shrink-0">Remove</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mb-4">
                    <span className="text-sm font-semibold text-gray-700">New Total</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(total)}</span>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Submitting…' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── No-Cost Extension Modal ────────────────────────────────────────────────────
function NoCostExtensionModal({ proposal, onSave, onClose }) {
    const [reason, setReason] = useState('');
    const [requestedDuration, setRequestedDuration] = useState(String((proposal.duration_months ?? 0) + 6));
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const submit = async () => {
        if (reason.trim().length < 20) { error('Please provide at least 20 characters explaining your request.'); return; }
        const months = Number(requestedDuration);
        if (!months || months <= (proposal.duration_months ?? 0)) {
            error('The requested duration must be longer than the current project duration.');
            return;
        }
        setSaving(true);
        try {
            const res = await post(`/proposals/${proposal.id}/no-cost-extension`, {
                reason, requested_duration_months: months,
            });
            success(res?.message || 'No-cost extension request submitted successfully.');
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to submit no-cost extension request.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Request a No-Cost Extension</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>
                <p className="text-xs text-gray-500 mb-4">Current project duration: <strong>{proposal.duration_months} months</strong></p>

                <label className="block text-xs font-medium text-gray-700 mb-1">
                    New Total Duration (months) <span className="text-red-500">*</span>
                </label>
                <input
                    type="number"
                    value={requestedDuration}
                    onChange={e => setRequestedDuration(e.target.value)}
                    min={(proposal.duration_months ?? 0) + 1}
                    max="120"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />

                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">(min 20 characters)</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={5}
                    placeholder="Explain why more time is needed to complete this project…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Submitting…' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── AI Score Panel ────────────────────────────────────────────────────────────

function ScoreDot({ score }) {
    const color = score >= 8 ? 'bg-green-500' : score >= 5 ? 'bg-amber-400' : 'bg-red-400';
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className={`h-1.5 w-1.5 rounded-full ${i < score ? color : 'bg-gray-200'}`} />
                ))}
            </div>
            <span className="text-xs font-bold text-gray-700">{score}/10</span>
        </div>
    );
}

function AiScorePanel({ proposalId }) {
    const [score, setScore] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const toast = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const r = await get(`/proposals/${proposalId}/ai-score`);
            setScore(r.data ?? null);
        } catch {}
        finally { setLoading(false); }
    };

    const generate = async () => {
        setGenerating(true);
        try {
            const r = await post(`/proposals/${proposalId}/ai-score/generate`);
            setScore(r.data ?? null);
            setOpen(true);
            toast.success('AI scoring complete. Scroll down to see results.');
            setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        } catch (e) {
            // A failed scoring attempt still returns the (failed) score row in the
            // response body — keep it so the panel can show the real reason inline
            // instead of only a toast that's gone the moment the user looks away.
            setScore(e?.response?.data?.data ?? null);
            setOpen(true);
            toast.error(e?.response?.data?.message ?? 'AI scoring failed.');
        } finally { setGenerating(false); }
    };

    useEffect(() => { load(); }, [proposalId]);

    const toggleOpen = () => { if (!score) generate(); else setOpen(o => !o); };

    const DIMENSIONS = [
        { key: 'clarity_score', label: 'Clarity' },
        { key: 'feasibility_score', label: 'Feasibility' },
        { key: 'budget_alignment_score', label: 'Budget' },
        { key: 'innovation_score', label: 'Innovation' },
        { key: 'completeness_score', label: 'Completeness' },
    ];

    return (
        <div ref={panelRef} className="bg-violet-50 border border-violet-200 rounded-xl overflow-hidden">
            <button onClick={toggleOpen} disabled={generating} className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-100/60 transition-colors disabled:cursor-wait">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className={generating ? 'text-violet-400 animate-pulse' : 'text-violet-600'} />
                    <span className="text-xs font-bold text-violet-800">
                        {generating ? 'Analyzing proposal with AI…' : 'AI Pre-screening Score'}
                    </span>
                    {!generating && score?.overall_score != null && (
                        <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                            {score.overall_score}/10
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {generating && <RefreshCw size={12} className="animate-spin text-violet-500" />}
                    {!score && !loading && !generating && (
                        <span className="text-[11px] font-semibold text-violet-600">Score now →</span>
                    )}
                    {score && !generating && (open ? <ChevronUp size={13} className="text-violet-500" /> : <ChevronDown size={13} className="text-violet-500" />)}
                </div>
            </button>

            {/* Loading skeleton while generating */}
            {generating && (
                <div className="px-4 pb-4 border-t border-violet-200 pt-3 space-y-3">
                    <div className="h-8 bg-violet-200/60 rounded-lg animate-pulse" />
                    <div className="grid grid-cols-2 gap-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="h-2 w-16 bg-violet-200/60 rounded animate-pulse" />
                                <div className="h-2 w-24 bg-violet-200/60 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                    <div className="space-y-1.5">
                        <div className="h-2 w-20 bg-violet-200/60 rounded animate-pulse" />
                        <div className="h-2 w-full bg-violet-200/60 rounded animate-pulse" />
                        <div className="h-2 w-4/5 bg-violet-200/60 rounded animate-pulse" />
                    </div>
                </div>
            )}

            {!generating && open && score?.status === 'completed' && (
                <div className="px-4 pb-4 space-y-3 border-t border-violet-200 pt-3">
                    {score.summary && (
                        <p className="text-xs text-violet-700 leading-relaxed bg-violet-100/50 rounded-lg px-3 py-2">
                            {score.summary}
                        </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {DIMENSIONS.map(d => score[d.key] != null && (
                            <div key={d.key}>
                                <p className="text-[10px] font-semibold text-violet-600 mb-1 uppercase tracking-wide">{d.label}</p>
                                <ScoreDot score={score[d.key]} />
                            </div>
                        ))}
                    </div>
                    {score.strengths && (
                        <div>
                            <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">Strengths</p>
                            <p className="text-xs text-gray-600">{score.strengths}</p>
                        </div>
                    )}
                    {score.weaknesses && (
                        <div>
                            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">Weaknesses</p>
                            <p className="text-xs text-gray-600">{score.weaknesses}</p>
                        </div>
                    )}
                    {score.recommendations && (
                        <div>
                            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Recommendations</p>
                            <p className="text-xs text-gray-600">{score.recommendations}</p>
                        </div>
                    )}
                    <button onClick={generate} disabled={generating}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 hover:text-violet-800 mt-1">
                        {generating ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        Re-score
                    </button>
                </div>
            )}

            {!generating && open && score?.status === 'failed' && (
                <div className="px-4 pb-4 border-t border-violet-200 pt-3">
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                        <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-red-700">AI scoring failed</p>
                            <p className="text-xs text-red-600 mt-0.5 wrap-break-word">{score.error_message ?? 'Check server logs for details.'}</p>
                        </div>
                    </div>
                    <button onClick={generate} disabled={generating}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 hover:text-violet-800 mt-2.5">
                        {generating ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        Try again
                    </button>
                </div>
            )}
        </div>
    );
}

const PHASE_LABELS = { blind_review: 'Blind Review', open_defence: 'Open Defence' };

function CorrectionsNotice({ corrections, canApply, applying, onApply }) {
    if (!corrections?.length) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <CheckCircle size={12} className="text-green-600 shrink-0" />
                <p className="text-[11px] text-green-700">Recorded decisions match the current thresholds — nothing to correct.</p>
            </div>
        );
    }

    const applicable = corrections.filter(c => c.applicable);

    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
            <div className="flex items-start gap-2">
                <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs font-semibold text-amber-800">Recorded decision differs from the recalculated result</p>
            </div>
            <ul className="space-y-1.5 pl-5">
                {corrections.map((c) => (
                    <li key={c.phase} className="text-[11px] text-amber-800 leading-relaxed">
                        <span className="font-semibold">{PHASE_LABELS[c.phase] ?? c.phase}:</span>{' '}
                        {c.issue === 'wrongly_passed' ? 'passed, but now falls below the threshold' : 'rejected, but now clears the threshold'}
                        {' '}({c.score}) — <span className="font-semibold">{c.change.replace('accepted', 'central evaluation').replace('blind_review_passed', 'blind review passed')}</span>
                        {!c.applicable && c.reason && (
                            <span className="block text-amber-700/80 italic">Cannot be applied here: {c.reason}.</span>
                        )}
                    </li>
                ))}
            </ul>
            {canApply && applicable.length > 0 && (
                <div className="flex justify-end">
                    <button
                        onClick={onApply}
                        disabled={applying}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                        <RefreshCw size={12} className={applying ? 'animate-spin' : ''} />
                        {applying ? 'Applying…' : 'Apply Correction'}
                    </button>
                </div>
            )}
        </div>
    );
}

function ScoreMeter({ label, score, max, threshold, passes, note }) {
    const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
    const thresholdPct = max > 0 ? Math.min(100, (threshold / max) * 100) : 0;

    return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                {passes !== null && passes !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${passes ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {passes ? 'Passes' : 'Below threshold'}
                    </span>
                )}
            </div>
            <p className="text-lg font-bold text-gray-900 tabular-nums">
                {score}<span className="text-sm font-medium text-gray-400">/{max}</span>
            </p>
            <div className="relative h-1.5 rounded-full bg-gray-100">
                <div className={`h-1.5 rounded-full ${passes === false ? 'bg-red-400' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                <div className="absolute -top-1 h-3.5 w-0.5 bg-gray-700/60" style={{ left: `${thresholdPct}%` }} title={`Minimum ${threshold}`} />
            </div>
            <p className="text-[10px] text-gray-400">Minimum required: {threshold} · Maximum possible: {max}{note ? ` · ${note}` : ''}</p>
        </div>
    );
}

function PhaseResult({ phase, snapshot }) {
    if (phase === 'blind_review') {
        if (!snapshot.blind) {
            return <p className="text-xs text-gray-400 italic">No submitted blind review scores yet.</p>;
        }
        return (
            <ScoreMeter
                label="Blind Review Score"
                score={snapshot.blind.score}
                max={snapshot.blind.max}
                threshold={snapshot.blind_threshold}
                passes={snapshot.blind_passes}
            />
        );
    }

    if (!snapshot.defence) {
        return <p className="text-xs text-gray-400 italic">No submitted open defence scores yet.</p>;
    }

    return (
        <div className="grid gap-2 sm:grid-cols-2">
            <ScoreMeter
                label="Open Defence Score"
                score={snapshot.defence.score}
                max={snapshot.defence.max}
                threshold={snapshot.defence_threshold}
                passes={snapshot.decision_mode === 'strict_all' ? !snapshot.defence_below_threshold : null}
                note={snapshot.decision_mode === 'strict_all' ? null : 'informational'}
            />
            <ScoreMeter
                label="Combined (Blind + Defence)"
                score={snapshot.combined}
                max={snapshot.combined_max}
                threshold={snapshot.combined_threshold}
                passes={snapshot.combined_passes}
                note="decides the outcome"
            />
        </div>
    );
}

function RecalculatePanel({ proposalId, proposalStatus, onDecisionChanged }) {
    const { success, error } = useToast();
    const [recalculating, setRecalculating] = useState(null); // phase being recalculated
    const [phase, setPhase] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [applying, setApplying] = useState(false);

    const recalculate = async (targetPhase) => {
        setRecalculating(targetPhase);
        try {
            const r = await get(`/proposals/${proposalId}/review-results/recalculate`, { phase: targetPhase });
            setPhase(targetPhase);
            setSnapshot(r.data ?? null);
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not recalculate the score.');
        }
        setRecalculating(null);
    };

    const applyCorrection = async () => {
        setConfirmOpen(false);
        setApplying(true);
        try {
            const r = await post(`/proposals/${proposalId}/review-results/recalculate/apply`, { phase });
            success(r.message ?? 'Decision corrected.');
            onDecisionChanged?.();
            await recalculate(phase);
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not apply the correction.');
        }
        setApplying(false);
    };

    const PHASE_BUTTONS = [
        { key: 'blind_review', label: 'Recalculate Blind Review', icon: Eye },
        { key: 'open_defence', label: 'Recalculate Open Defence', icon: Star },
    ];

    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
            <div>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Verify Current Scores</p>
                <p className="text-xs text-gray-400 mt-0.5">
                    Recomputes a phase live against the current threshold settings and evaluation criteria. Scores are capped at each phase's maximum.
                </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                {PHASE_BUTTONS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => recalculate(key)}
                        disabled={recalculating !== null || applying}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                            phase === key && snapshot
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {recalculating === key ? <RefreshCw size={12} className="animate-spin" /> : <Icon size={12} />}
                        {recalculating === key ? 'Recalculating…' : label}
                    </button>
                ))}
            </div>

            {snapshot && phase && (
                <div className="space-y-2.5 pt-2 border-t border-gray-200">
                    <PhaseResult phase={phase} snapshot={snapshot} />

                    <CorrectionsNotice
                        corrections={snapshot.corrections}
                        canApply={snapshot.can_apply_corrections}
                        applying={applying}
                        onApply={() => setConfirmOpen(true)}
                    />

                    <p className="text-[10px] text-gray-400">
                        {PHASE_LABELS[phase]} · Current proposal status: <span className="font-semibold text-gray-600">{getStatusLabel(snapshot.proposal_status ?? proposalStatus)}</span>
                        {' · '}Recalculated {formatDate(snapshot.recalculated_at)}
                    </p>
                </div>
            )}

            <ConfirmDialog
                open={confirmOpen}
                title={`Apply recalculated ${PHASE_LABELS[phase] ?? ''} decision?`}
                description={`This will change the proposal's status (${(snapshot?.corrections ?? []).filter(c => c.applicable).map(c => c.change.replace('accepted', 'central evaluation')).join(', ')}) based on the current thresholds. The proposal team will be notified of the new outcome, and the change is recorded under your name in the workflow history.`}
                confirmLabel="Apply Correction"
                confirmVariant="danger"
                onConfirm={applyCorrection}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
}

function ReviewResultsTab({ proposalId, isVisible, isStaff, proposalStatus, onDecisionChanged }) {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const reviewsReleased = REVIEW_VISIBLE_STATUSES.includes(proposalStatus);

    useEffect(() => {
        if (!isVisible || (!isStaff && !reviewsReleased)) { setLoading(false); return; }
        get(`/proposals/${proposalId}/review-results`)
            .then(r => setResults(r.data ?? null))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [proposalId, isVisible, isStaff, reviewsReleased]);

    if (!isVisible) {
        return (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                <span className="text-amber-500 text-base mt-0.5">🔒</span>
                <div>
                    <p className="text-sm font-semibold text-amber-700">Review results are not visible to your role</p>
                    <p className="text-xs text-amber-600 mt-0.5">Review outcomes are shared with the proposal team after the review phase is complete.</p>
                </div>
            </div>
        );
    }

    if (!isStaff && !reviewsReleased) {
        return (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5">
                <span className="text-blue-500 text-base mt-0.5">ℹ️</span>
                <div>
                    <p className="text-sm font-semibold text-blue-700">Review in progress</p>
                    <p className="text-xs text-blue-600 mt-0.5">Review results will be available once the blind review phase is complete.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
            </div>
        );
    }

    if (!results || results.total_reviews === 0) {
        return <p className="text-sm text-gray-400">No review results available yet.</p>;
    }

    const { total_reviews, submitted_reviews, average_score, average_max, reviews } = results;

    return (
        <div className="space-y-5">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-gray-800 tabular-nums">{submitted_reviews}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Reviews Submitted</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-gray-800 tabular-nums">{total_reviews}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total Assigned</p>
                </div>
                {average_score != null && (
                    <div className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-indigo-700 tabular-nums">{average_score}{average_max != null ? `/${average_max}` : ''}</p>
                        <p className="text-xs text-indigo-500 mt-0.5">Avg. Score</p>
                    </div>
                )}
            </div>

            {isStaff && <RecalculatePanel proposalId={proposalId} proposalStatus={proposalStatus} onDecisionChanged={onDecisionChanged} />}

            {/* Per-review cards (anonymized) */}
            {reviews.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Feedback</p>
                    {reviews.map((rv, i) => (
                        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <span className="text-xs font-semibold text-gray-600">Reviewer {i + 1}</span>
                                {rv.overall_score != null && (
                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                        {rv.overall_score}{rv.overall_max != null ? `/${rv.overall_max}` : ''}
                                    </span>
                                )}
                                {rv.recommendation && (
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                        rv.recommendation === 'approve' ? 'bg-green-100 text-green-700' :
                                        rv.recommendation === 'reject'  ? 'bg-red-100 text-red-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                        {rv.recommendation === 'approve' ? 'Approve' : rv.recommendation === 'reject' ? 'Reject' : 'Revise'}
                                    </span>
                                )}
                            </div>
                            {rv.comments?.length > 0 && (
                                <div className="px-4 py-3 space-y-2">
                                    {rv.comments.map((c, j) => c.comment && (
                                        <div key={j}>
                                            {c.question && <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{c.question}</p>}
                                            <p className="text-xs text-gray-700 leading-relaxed">{c.comment}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ContractUploadSection({ proposal, onUploaded }) {
    const { success, error } = useToast();
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [showPdf, setShowPdf] = useState(true);
    const fileRef = useRef(null);
    const blobRef = useRef(null);

    const loadPdf = () => {
        const token = localStorage.getItem('rtt_token');
        fetch(`/api/v1/proposals/${proposal.id}/contract/download`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.ok ? r.blob() : null)
            .then(blob => {
                if (!blob) return;
                if (blobRef.current) URL.revokeObjectURL(blobRef.current);
                blobRef.current = URL.createObjectURL(blob);
                setPdfUrl(blobRef.current);
            })
            .catch(() => {});
    };

    useEffect(() => {
        if (proposal.contract_document_path) loadPdf();
        return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
    }, []);

    const upload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            await api.post(`/proposals/${proposal.id}/contract/submit`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            loadPdf();
            success('Contract submitted for review. You will be notified once it is approved.');
            onUploaded();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to submit contract.');
        }
        setUploading(false);
        e.target.value = '';
    };

    const status = proposal.contract_status;
    const canReplace = status === 'pending' || status === 'rejected';
    const canRemove  = status === 'pending' || status === 'rejected';

    const remove = async () => {
        setRemoving(true);
        try {
            await api.delete(`/proposals/${proposal.id}/contract`);
            if (blobRef.current) URL.revokeObjectURL(blobRef.current);
            blobRef.current = null;
            setPdfUrl(null);
            onUploaded();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to remove contract.');
        }
        setRemoving(false);
    };

    return (
        <div className="mt-4 rounded-lg border bg-white border-gray-200 overflow-hidden">
            <div className="px-4 py-3 space-y-2">
                {/* Header row */}
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText size={13} /> Research Contract
                    </p>
                    <div className="flex items-center gap-2">
                        {canReplace && (
                            <button onClick={() => fileRef.current?.click()} disabled={uploading || removing}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                                <Upload size={11} /> {uploading ? 'Uploading…' : 'Replace'}
                            </button>
                        )}
                        {canRemove && (
                            <button onClick={remove} disabled={removing || uploading}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
                                <Trash2 size={11} /> {removing ? 'Removing…' : 'Remove'}
                            </button>
                        )}
                        {pdfUrl && (
                            <button onClick={() => setShowPdf(v => !v)}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                                <Eye size={11} /> {showPdf ? 'Hide' : 'Show'}
                            </button>
                        )}
                    </div>
                </div>

                {status === 'approved' && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle size={14} />
                        <span>Contract approved on {formatDate(proposal.contract_signed_at)}. You may now submit your budget request.</span>
                    </div>
                )}

                {status === 'pending' && (
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                        <Upload size={14} className="shrink-0" />
                        <span>Contract submitted and under review. You will be notified once approved.</span>
                    </div>
                )}

                {status === 'rejected' && (
                    <div className="flex items-start gap-2 text-sm text-red-700">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Contract was returned for correction.</p>
                            {proposal.contract_rejection_reason && (
                                <p className="text-xs text-red-600 mt-0.5">{proposal.contract_rejection_reason}</p>
                            )}
                        </div>
                    </div>
                )}

                {!status && (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                            Please upload the signed research contract (PDF). An officer will review and approve it before you can submit your first budget request.
                        </p>
                        <button onClick={() => fileRef.current?.click()} disabled={uploading}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload Signed Contract PDF'}
                        </button>
                    </div>
                )}

                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={upload} />
            </div>

            {pdfUrl && showPdf && (
                <div className="border-t border-gray-100">
                    <iframe
                        src={pdfUrl}
                        className="w-full h-96 block"
                        title="Submitted contract"
                    />
                </div>
            )}
        </div>
    );
}

export default function ProposalShow() {
    const { url } = usePage();
    const id = url.split('/')[2];
    const { user, hasAnyRole } = useAuth();
    const { hasSubFeature } = useFeature();
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
    const [approvalReports, setApprovalReports] = useState([]);
    const [resolvingReport, setResolvingReport] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [withdrawingReportId, setWithdrawingReportId] = useState(null);
    const [confirmWithdrawReport, setConfirmWithdrawReport] = useState(null);
    const [extension, setExtension] = useState(null);
    const [showExtensionModal, setShowExtensionModal] = useState(false);
    const [showClearanceModal, setShowClearanceModal] = useState(false);
    const [budgetRevision, setBudgetRevision] = useState(null);
    const [showBudgetRevisionModal, setShowBudgetRevisionModal] = useState(false);
    const [noCostExtension, setNoCostExtension] = useState(null);
    const [showNoCostExtensionModal, setShowNoCostExtensionModal] = useState(false);

    const isAdmin    = hasAnyRole(['super_admin', 'admin', 'central_officer']);
    const isOfficer  = hasAnyRole(['college_officer', 'research_officer', 'community_officer', 'technology_officer']);
    // Matches ReviewController::rejectFromBlindReview / WorkflowStageSeeder's fail_blind_review
    // roles — wider than isAdmin, since category officers are also authorized server-side.
    const canRejectBlindReview = hasAnyRole(['super_admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer']);
    const canReportMistakenApproval = hasAnyRole(['college_officer']);
    const canReviewApprovalReports = canRejectBlindReview;
    const hasOpenReport = approvalReports.some(r => r.status === 'open');

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

    const loadExtension = () => {
        get(`/proposals/${id}/deadline-extension`).then(r => setExtension(r.data)).catch(() => {});
    };

    const loadBudgetRevision = () => {
        get(`/proposals/${id}/budget-revision`).then(r => setBudgetRevision(r.data)).catch(() => {});
    };

    const loadNoCostExtension = () => {
        get(`/proposals/${id}/no-cost-extension`).then(r => setNoCostExtension(r.data)).catch(() => {});
    };

    const loadApprovalReports = () => {
        if (!canReportMistakenApproval && !canReviewApprovalReports) return;
        get(`/proposals/${id}/approval-reports`).then(r => setApprovalReports(r.data ?? [])).catch(() => {});
    };

    useEffect(() => { load(); loadAppeal(); loadExtension(); loadBudgetRevision(); loadNoCostExtension(); loadApprovalReports(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const withdrawReport = async () => {
        const reportId = confirmWithdrawReport;
        setConfirmWithdrawReport(null);
        setWithdrawingReportId(reportId);
        try {
            const res = await post(`/approval-reports/${reportId}/withdraw`, {});
            toast.success(res.message ?? 'Report cancelled.');
            loadApprovalReports();
            load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not cancel the report.');
        }
        setWithdrawingReportId(null);
    };

    const handleAction = (action) => {
        if (action === 'report_mistaken_approval') { setShowReportModal(true); return; }
        setDialog(action);
        setReason('');
    };

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
            if (dialog === 'reject_blind_review') {
                await post(`/proposals/${id}/blind-review/reject`, { reason });
                toast.error('Proposal rejected and removed from blind review.');
            } else if (dialog === 'reopen') {
                const res = await post(`/proposals/${id}/reopen`, { reason });
                toast.success(res?.message || 'Proposal reopened for reconsideration.');
            } else {
                await post(`/proposals/${id}/validation/${dialog}`, { reason });
                if (dialog === 'approve') toast.success('Proposal approved for review.');
                if (dialog === 'return')  toast.warning('Proposal returned to PI for correction.');
                if (dialog === 'reject')  toast.error('Proposal has been rejected.');
            }
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

    // 'rejected' is a shared terminal status reached from four very different places
    // (validation, blind review score, open defence score, central evaluation) — the
    // workflow_logs entry that transitioned the proposal INTO 'rejected' is the only
    // way to tell which one actually happened, so Reconsideration/Complaint visibility
    // can be scoped to the right origin instead of showing for every rejection alike.
    const rejectionEntries = history.filter(h => h.to_stage === 'rejected');
    const rejectedVia = rejectionEntries.length ? rejectionEntries[rejectionEntries.length - 1].action : null;
    const canRequestReconsideration = proposal.status === 'rejected' && rejectedVia === 'central_reject';

    // Only surface the extension flow once the deadline is actually a concern (passed,
    // or within 2 weeks) — no need to clutter the page for a proposal with months left.
    // Once a request exists, keep showing its status regardless of the deadline math.
    const callEndDate = proposal.proposal_call?.end_date ? new Date(proposal.proposal_call.end_date) : null;
    const deadlineIsPressing = callEndDate && (callEndDate - new Date()) < 14 * 86400000;
    const isOwnDraft = proposal.status === 'draft' && user?.id === proposal.pi_user_id;
    const showExtensionSection = isOwnDraft && (deadlineIsPressing || !!extension);
    const canRequestExtension = isOwnDraft && (!extension || extension.status !== 'pending');

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
                                {hasSubFeature('workflow.ethical_clearance') && proposal.ethical_clearance_required && (
                                    <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                                        EC: {proposal.ethical_clearance_number || 'Clearance Required'}
                                    </span>
                                )}
                            </div>
                            {hasSubFeature('workflow.sla_tracking') && proposal.status_entered_at && (
                                <SlaIndicator enteredAt={proposal.status_entered_at} status={proposal.status} />
                            )}
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
                                canRequestReconsideration ? (
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setShowAppealModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <RotateCcw size={14} /> Request Reconsideration
                                        </button>
                                    </div>
                                ) : ['fail_blind_review', 'fail_defence'].includes(rejectedVia) && (
                                    <p className="text-xs text-gray-400 italic text-right">
                                        This proposal was rejected for not meeting the review score threshold —
                                        use the Complaints tab to raise a concern about that review.
                                    </p>
                                )
                            )}
                        </div>
                    )}
                    {proposal.status === 'accepted' && (
                        <div className="mt-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white px-4 py-3.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                                <ClipboardList size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-sky-900">In Central Evaluation</p>
                                <p className="mt-0.5 text-sm leading-relaxed text-sky-800/80">
                                    This proposal has passed both the Blind Review and Open Defence phases and is now with the
                                    Central Evaluation Committee. A separate notification will follow once the final funding
                                    decision has been made.
                                </p>
                            </div>
                        </div>
                    )}
                    {/* Deadline extension section */}
                    {showExtensionSection && (
                        <div className="mt-4">
                            {extension ? (
                                <div className={`rounded-lg border px-4 py-3 ${extension.status === 'pending' ? 'bg-amber-50 border-amber-200' : extension.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <p className={`text-sm font-semibold mb-1 flex items-center gap-1.5 ${extension.status === 'pending' ? 'text-amber-800' : extension.status === 'approved' ? 'text-green-800' : 'text-gray-700'}`}>
                                        <CalendarClock size={14} />
                                        Deadline Extension {extension.status === 'pending' ? 'Pending Review' : extension.status === 'approved' ? 'Approved' : 'Denied'}
                                    </p>
                                    {extension.status === 'approved' && extension.granted_until && (
                                        <p className="text-sm text-gray-700">You may now submit until <strong>{formatDate(extension.granted_until)}</strong>.</p>
                                    )}
                                    {extension.resolution_notes && <p className="text-sm text-gray-600 mt-1">{extension.resolution_notes}</p>}
                                    {canRequestExtension && extension.status !== 'pending' && (
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={() => setShowExtensionModal(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                <CalendarClock size={14} /> Request Another Extension
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                                    <p className="text-sm text-blue-800">
                                        {callEndDate && callEndDate < new Date()
                                            ? 'This call\'s deadline has passed. Request more time to finish and submit your draft.'
                                            : 'Running out of time? Request more time to finish this draft.'}
                                    </p>
                                    <button
                                        onClick={() => setShowExtensionModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                                    >
                                        <CalendarClock size={14} /> Request Extension
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Ethical clearance section */}
                    {proposal.ethical_clearance_required && (
                        <div className="mt-4">
                            {(() => {
                                const ecStatus = proposal.ethical_clearance_status;
                                const isOwner = user?.id === proposal.pi_user_id;
                                const canSubmit = isOwner && ecStatus !== 'submitted' && ecStatus !== 'approved';
                                const styles = {
                                    pending: 'bg-gray-50 border-gray-200 text-gray-700',
                                    submitted: 'bg-amber-50 border-amber-200 text-amber-800',
                                    approved: 'bg-green-50 border-green-200 text-green-800',
                                    rejected: 'bg-red-50 border-red-200 text-red-800',
                                    expired: 'bg-red-50 border-red-200 text-red-800',
                                };
                                const labels = {
                                    pending: 'Ethical Clearance Required — Not Yet Submitted',
                                    submitted: 'Ethical Clearance Awaiting Verification',
                                    approved: 'Ethical Clearance Approved',
                                    rejected: 'Ethical Clearance Returned for Correction',
                                    expired: 'Ethical Clearance Expired',
                                };
                                return (
                                    <div className={`rounded-lg border px-4 py-3 ${styles[ecStatus] ?? styles.pending}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold flex items-center gap-1.5">
                                                    <CalendarClock size={14} /> {labels[ecStatus] ?? labels.pending}
                                                </p>
                                                {ecStatus === 'approved' && proposal.ethical_clearance_expiry && (
                                                    <p className="text-sm mt-1">Valid until <strong>{formatDate(proposal.ethical_clearance_expiry)}</strong></p>
                                                )}
                                                {ecStatus === 'rejected' && proposal.ethical_clearance_rejection_reason && (
                                                    <p className="text-sm mt-1">{proposal.ethical_clearance_rejection_reason}</p>
                                                )}
                                            </div>
                                            {canSubmit && (
                                                <button
                                                    onClick={() => setShowClearanceModal(true)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                                                >
                                                    {ecStatus === 'rejected' || ecStatus === 'expired' ? 'Resubmit' : 'Submit for Verification'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
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
                            </div>
                        </div>
                    )}

                    {/* Contract upload — PI only, funded proposals */}
                    {proposal.status === 'funded' && user?.id === proposal.pi_user_id && (
                        <ContractUploadSection proposal={proposal} onUploaded={() => router.reload({ only: ['proposal'] })} />
                    )}

                    {/* Budget revision section — PI only, funded/midterm proposals */}
                    {hasSubFeature('workflow.budget_revision') && ['funded', 'midterm_evaluation'].includes(proposal.status) && user?.id === proposal.pi_user_id && (
                        <div className="mt-4">
                            {(() => {
                                const brStatus = budgetRevision?.status;
                                const canRequest = !brStatus || brStatus !== 'pending';
                                const styles = {
                                    pending: 'bg-amber-50 border-amber-200 text-amber-800',
                                    approved: 'bg-green-50 border-green-200 text-green-800',
                                    denied: 'bg-red-50 border-red-200 text-red-800',
                                };
                                const labels = {
                                    pending: 'Budget Revision Awaiting Review',
                                    approved: 'Budget Revision Approved',
                                    denied: 'Budget Revision Request Denied',
                                };
                                return (
                                    <div className={`rounded-lg border px-4 py-3 ${brStatus ? styles[brStatus] : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold flex items-center gap-1.5">
                                                    <CalendarClock size={14} /> {brStatus ? labels[brStatus] : 'Need to change your approved budget?'}
                                                </p>
                                                {brStatus === 'denied' && budgetRevision?.resolution_notes && (
                                                    <p className="text-sm mt-1">{budgetRevision.resolution_notes}</p>
                                                )}
                                                {!brStatus && (
                                                    <p className="text-sm mt-1">Request a revision to your budget line items — an officer will review it.</p>
                                                )}
                                            </div>
                                            {canRequest && (
                                                <button
                                                    onClick={() => setShowBudgetRevisionModal(true)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                                                >
                                                    Request Budget Revision
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* No-cost extension section — PI only, funded/midterm proposals */}
                    {hasSubFeature('workflow.no_cost_extension') && ['funded', 'midterm_evaluation'].includes(proposal.status) && user?.id === proposal.pi_user_id && (
                        <div className="mt-4">
                            {(() => {
                                const nceStatus = noCostExtension?.status;
                                const canRequest = !nceStatus || nceStatus !== 'pending';
                                const styles = {
                                    pending: 'bg-amber-50 border-amber-200 text-amber-800',
                                    approved: 'bg-green-50 border-green-200 text-green-800',
                                    denied: 'bg-red-50 border-red-200 text-red-800',
                                };
                                const labels = {
                                    pending: 'No-Cost Extension Awaiting Review',
                                    approved: 'No-Cost Extension Approved',
                                    denied: 'No-Cost Extension Request Denied',
                                };
                                return (
                                    <div className={`rounded-lg border px-4 py-3 ${nceStatus ? styles[nceStatus] : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold flex items-center gap-1.5">
                                                    <CalendarClock size={14} /> {nceStatus ? labels[nceStatus] : 'Need more time to complete this project?'}
                                                </p>
                                                {nceStatus === 'approved' && (
                                                    <p className="text-sm mt-1">Project duration extended to <strong>{noCostExtension.requested_duration_months} months</strong>.</p>
                                                )}
                                                {nceStatus === 'denied' && noCostExtension?.resolution_notes && (
                                                    <p className="text-sm mt-1">{noCostExtension.resolution_notes}</p>
                                                )}
                                                {!nceStatus && (
                                                    <p className="text-sm mt-1">Request more time to complete the project at no additional cost — an officer will review it.</p>
                                                )}
                                            </div>
                                            {canRequest && (
                                                <button
                                                    onClick={() => setShowNoCostExtensionModal(true)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                                                >
                                                    Request No-Cost Extension
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Approval reports — college officer flagged this as possibly mistakenly approved */}
                    {approvalReports.length > 0 && (canReviewApprovalReports || canReportMistakenApproval) && (
                        <div className="mt-4 space-y-2">
                            {approvalReports.map(r => (
                                <div key={r.id} className={`rounded-xl border p-4 ${r.status === 'open' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2">
                                            <AlertCircle size={16} className={r.status === 'open' ? 'text-amber-600 mt-0.5 shrink-0' : 'text-gray-400 mt-0.5 shrink-0'} />
                                            <div>
                                                <p className={`text-sm font-semibold ${r.status === 'open' ? 'text-amber-800' : 'text-gray-600'}`}>
                                                    {r.status === 'open'
                                                        ? 'Possible mistaken approval reported'
                                                        : r.status === 'withdrawn'
                                                            ? 'Approval report cancelled'
                                                            : r.outcome === 'approval_revoked'
                                                                ? 'Mistaken approval confirmed — proposal rejected'
                                                                : r.outcome === 'approval_stands' ? 'Approval report reviewed — approval stands' : 'Approval report reviewed'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    By {r.reported_by?.name ?? 'a college officer'} · {formatDate(r.created_at)}
                                                </p>
                                                {r.issue_type && (() => {
                                                    const issue = issueByKey(r.issue_type);
                                                    const Icon = issue?.icon;
                                                    return (
                                                        <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                                            {Icon && <Icon size={12} />} {r.issue_label ?? issue?.label}
                                                        </span>
                                                    );
                                                })()}
                                                {r.reason && <p className="text-sm text-gray-700 mt-1.5">{r.reason}</p>}
                                                {r.status === 'reviewed' && (
                                                    <p className="text-xs text-gray-500 mt-1.5">
                                                        Reviewed by {r.reviewed_by?.name ?? '—'} · {formatDate(r.reviewed_at)}
                                                        {r.resolution_notes && <> — {r.resolution_notes}</>}
                                                    </p>
                                                )}
                                                {r.status === 'withdrawn' && (
                                                    <p className="text-xs text-gray-500 mt-1.5">
                                                        Cancelled by {r.reported_by?.name ?? 'the reporting officer'} · {formatDate(r.withdrawn_at)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {r.status === 'open' && r.reported_by?.id === user?.id && proposal.status === 'validated' && (
                                            <button
                                                onClick={() => setConfirmWithdrawReport(r.id)}
                                                disabled={withdrawingReportId === r.id}
                                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                                            >
                                                <XCircle size={13} /> {withdrawingReportId === r.id ? 'Cancelling…' : 'Cancel Report'}
                                            </button>
                                        )}
                                        {r.status === 'open' && canReviewApprovalReports && (
                                            <button
                                                onClick={() => setResolvingReport(r)}
                                                className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100"
                                            >
                                                Resolve Report
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {showReportModal && (
                        <ReportMistakenApprovalModal
                            proposal={proposal}
                            onClose={() => setShowReportModal(false)}
                            onReported={() => { setShowReportModal(false); loadApprovalReports(); load(); }}
                        />
                    )}

                    {resolvingReport && (
                        <ResolveApprovalReportModal
                            report={resolvingReport}
                            proposal={proposal}
                            onClose={() => setResolvingReport(null)}
                            onSaved={() => { setResolvingReport(null); loadApprovalReports(); load(); }}
                        />
                    )}

                    <ConfirmDialog
                        open={!!confirmWithdrawReport}
                        title="Cancel this report?"
                        description="Your mistaken-approval report will be withdrawn and the proposal will return to the stage it was at before you reported it. The central office and category officer will be told no action is needed."
                        confirmLabel="Cancel Report"
                        cancelLabel="Keep Report"
                        confirmVariant="danger"
                        onConfirm={withdrawReport}
                        onCancel={() => setConfirmWithdrawReport(null)}
                    />

                    {/* Workflow actions */}
                    {(isAdmin || canRejectBlindReview || canReportMistakenApproval) && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <ActionButtons
                                proposal={proposal}
                                onAction={handleAction}
                                onProcessDefenceResult={handleProcessDefenceResult}
                                isAdmin={isAdmin}
                                canRejectBlindReview={canRejectBlindReview}
                                canReportMistakenApproval={canReportMistakenApproval}
                                hasOpenReport={hasOpenReport}
                            />
                        </div>
                    )}
                </div>

                {/* AI Score — officers and admins */}
                {(isAdmin || isOfficer) && (
                    <AiScorePanel proposalId={proposal.id} />
                )}

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
                                        ['Status', getStatusLabel(proposal.status)],
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
                            proposal.members_hidden
                                ? (
                                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                                        <span className="text-amber-500 text-base mt-0.5">🔒</span>
                                        <div>
                                            <p className="text-sm font-semibold text-amber-700">Member information is not visible to your role</p>
                                            <p className="text-xs text-amber-600 mt-0.5">Team identity is concealed during blind and open defence review to preserve evaluation integrity.</p>
                                        </div>
                                    </div>
                                )
                            : members.length === 0
                                ? <p className="text-sm text-gray-400">No team members on record.</p>
                                : (
                                    <>
                                        <div className="hidden sm:block overflow-x-auto">
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

                                        {/* Mobile: stacked cards */}
                                        <div className="sm:hidden space-y-2">
                                            {members.filter(m => m.status === 'active').map((m) => (
                                                <div key={m.id} className="border border-gray-200 rounded-xl p-3">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <p className="font-medium text-gray-800 text-sm">{m.user?.name ?? '—'}</p>
                                                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${m.role === 'pi' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                            {m.role === 'pi' ? 'PI' : 'Co-PI'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate">{m.user?.email ?? '—'}</p>
                                                    <p className="text-xs text-gray-600 mt-1">Contribution: {m.contribution_percentage}%</p>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )
                        )}

                        {activeTab === 'Budget' && (
                            budgets.length === 0
                                ? <p className="text-sm text-gray-400">No budget items on record.</p>
                                : (
                                    <div className="space-y-3">
                                        <div className="hidden sm:block overflow-x-auto">
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

                                        {/* Mobile: stacked cards */}
                                        <div className="sm:hidden space-y-2">
                                            {budgets.map((b) => (
                                                <div key={b.id} className="border border-gray-200 rounded-xl p-3">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">{b.category}</span>
                                                        <span className="shrink-0 font-semibold text-gray-900 text-sm">{formatCurrency(b.amount)}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-800">{b.item_description}</p>
                                                    {b.justification && <p className="text-xs text-gray-500 mt-1">{b.justification}</p>}
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between border-t border-gray-200 pt-2 px-1">
                                                <span className="text-sm font-semibold text-gray-700">Total</span>
                                                <span className="text-sm font-bold text-gray-900">{formatCurrency(budgetTotal)}</span>
                                            </div>
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
                                isDraft={proposal.status === 'draft'}
                                hideIdentity={proposal.members_hidden}
                                onRefresh={load}
                                showEthicalClearanceOption={proposal.ethical_clearance_required}
                            />
                        )}

                        {activeTab === 'History' && (
                            proposal.history_hidden ? (
                                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                                    <span className="text-amber-500 text-base mt-0.5">🔒</span>
                                    <div>
                                        <p className="text-sm font-semibold text-amber-700">Submission history is not visible to your role</p>
                                        <p className="text-xs text-amber-600 mt-0.5">Activity logs are concealed during blind and open defence review to preserve evaluation integrity.</p>
                                    </div>
                                </div>
                            ) : (
                                <ProposalTimeline history={history} currentStatus={proposal.status} />
                            )
                        )}

                        {activeTab === 'Reviews' && (
                            <ReviewResultsTab
                                proposalId={id}
                                isVisible={isProposalMember || isAdmin || isOfficer}
                                isStaff={isAdmin || isOfficer}
                                proposalStatus={proposal.status}
                                onDecisionChanged={load}
                            />
                        )}

                        {activeTab === 'Complaints' && (
                            <ComplaintsTab
                                proposal={proposal}
                                userId={user?.id}
                                isProposalMember={isProposalMember}
                                isOfficer={isOfficer}
                                isAdmin={isAdmin}
                                rejectedVia={rejectedVia}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Validation reason modal */}
            {dialog && dialog !== 'approve' && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-base font-semibold mb-3">
                            {dialog === 'reject_blind_review' ? 'Reject From Blind Review'
                                : dialog === 'reopen' ? 'Reopen for Reconsideration'
                                : <span className="capitalize">{dialog} Proposal</span>}
                        </h2>
                        {dialog === 'reopen' && (
                            <p className="text-xs text-gray-500 mb-3">
                                This returns the proposal to whichever stage it was rejected from, so it can be re-decided — e.g. after correcting threshold settings. Already-submitted review scores are preserved.
                            </p>
                        )}
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason (required)…" rows={3}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none resize-none focus:ring-2 focus:ring-blue-500" />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setDialog(null); setReason(''); }}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={confirmAction} disabled={submitting}
                                className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-60 ${
                                    dialog === 'reject' || dialog === 'reject_blind_review' ? 'bg-red-600 hover:bg-red-700'
                                        : dialog === 'reopen' ? 'bg-indigo-600 hover:bg-indigo-700'
                                        : 'bg-yellow-600 hover:bg-yellow-700'
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
            {showExtensionModal && (
                <ExtensionModal
                    proposal={proposal}
                    onSave={() => { setShowExtensionModal(false); loadExtension(); }}
                    onClose={() => setShowExtensionModal(false)}
                />
            )}
            {showClearanceModal && (
                <EthicalClearanceModal
                    proposal={proposal}
                    onSave={() => { setShowClearanceModal(false); load(); }}
                    onClose={() => setShowClearanceModal(false)}
                />
            )}
            {showBudgetRevisionModal && (
                <BudgetRevisionModal
                    proposal={proposal}
                    onSave={() => { setShowBudgetRevisionModal(false); loadBudgetRevision(); }}
                    onClose={() => setShowBudgetRevisionModal(false)}
                />
            )}
            {showNoCostExtensionModal && (
                <NoCostExtensionModal
                    proposal={proposal}
                    onSave={() => { setShowNoCostExtensionModal(false); loadNoCostExtension(); }}
                    onClose={() => setShowNoCostExtensionModal(false)}
                />
            )}
        </AppLayout>
    );
}
