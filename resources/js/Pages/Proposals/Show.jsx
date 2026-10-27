import { useState, useEffect, useRef } from 'react';
import { translate as tr } from '../../lib/i18n'
import { usePage, Link, router } from '@inertiajs/react';
import { UserCheck, Calendar, Award, CheckCircle, RotateCcw, XCircle, ExternalLink, AlertCircle, ChevronDown, ChevronUp, ArrowUpCircle, MessageSquare, PlusCircle, Pencil, Trash2, Building2, Scale, ShieldCheck, Upload, FileText, Eye, Sparkles, RefreshCw, Star, CalendarClock, ClipboardList } from 'lucide-react';
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
import RejectWithReasonModal from '../../Components/RejectWithReasonModal';
import AnonymityCheckPanel from '../../Components/AnonymityCheckPanel';
import ReviewDisagreementPanel from '../../Components/ReviewDisagreementPanel';
import ProgressReportsTab from '../../Components/ProgressReportsTab';
import ProposalStatusGuide from '../../Components/ProposalStatusGuide';
import ProjectHealthCard from '../../Components/ProjectHealthCard';
import { SdgBadges } from '../../Components/SdgPicker';
import { CallAnswers } from '../../Components/CallQuestions';
import ProposalMessages from '../../Components/ProposalMessages';
import ProposalVersions from '../../Components/ProposalVersions';
import DefenceRecordButton from '../../Components/DefenceRecordButton';
import { issueByKey } from '../../lib/approvalReportIssues';
import { downloadFile } from '../../lib/download';
import {
    AWAITING, STAGE_LABELS, topicLabel, complaintPermissions,
    ComplaintStatusBadge, LevelBadge, AgeNote, ComplaintTimeline,
    FileComplaintModal, RespondModal, EscalateModal, EditModal,
} from '../../Components/ComplaintKit';

const TABS = ['Overview', 'Team', 'Budget', 'Documents', 'History', 'Reviews', 'Complaints'];

function SlaIndicator({ enteredAt, status }) {
    const daysInStage = Math.floor((Date.now() - new Date(enteredAt).getTime()) / 86400000);
    const isOverdue = daysInStage > 14 && !['funded', 'rejected', 'completed', 'archived', 'draft'].includes(status);
    if (!isOverdue) return null;
    return (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            {tr("Overdue — :daysInStage days in :status stage", { daysInStage: daysInStage, status: getStatusLabel(status) })}
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

// ── Complaints Tab Content ───────────────────────────────────────────────────

function ComplaintLevelCard({ icon: Icon, tone, title, who, count, canFile, availability, onFile }) {
    return (
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900">{title}</p>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-600">{count}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{who}</p>
                </div>
            </div>
            <div className="mt-3 flex flex-1 items-end justify-between gap-3 border-t border-gray-100 pt-3">
                <p className={`text-xs ${canFile ? 'font-medium text-green-700' : 'text-gray-400'}`}>{availability}</p>
                {canFile && (
                    <button onClick={onFile}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                        <PlusCircle size={13} /> {tr("File complaint")}
                    </button>
                )}
            </div>
        </div>
    );
}

function ComplaintCard({ complaint: c, permissions, expanded, onToggle, onAction }) {
    const { canRespond, canEscalate, canEdit, canWithdraw } = permissions(c);
    const hasActions = canRespond || canEscalate || canEdit || canWithdraw;

    return (
        <div className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${expanded ? 'border-gray-300 shadow-sm' : 'border-gray-200 hover:shadow-sm'}`}>
            <button onClick={onToggle} aria-expanded={expanded} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <LevelBadge level={c.level} />
                        <span className="text-xs font-medium text-gray-600">{topicLabel(c)}</span>
                        {c.escalated_from_id && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700">
                                <ArrowUpCircle size={10} /> {tr("Escalation")}
                            </span>
                        )}
                    </div>
                    {!expanded && <p className="mt-1.5 line-clamp-2 text-sm text-gray-700">{c.description}</p>}
                    <p className="mt-1.5 text-xs text-gray-400">
                        {c.complainant?.name ?? 'Research team'} · {formatDate(c.created_at)}
                    </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <ComplaintStatusBadge status={c.status} />
                    <AgeNote complaint={c} />
                    {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-gray-100 px-4 py-4">
                    <ComplaintTimeline complaint={c} />
                    {hasActions && (
                        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
                            {canWithdraw && (
                                <button onClick={() => onAction('withdraw', c)}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                                    <Trash2 size={13} /> {tr("Withdraw")}
                                </button>
                            )}
                            {canEdit && (
                                <button onClick={() => onAction('edit', c)}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                    <Pencil size={13} /> {tr("Edit")}
                                </button>
                            )}
                            {canEscalate && (
                                <button onClick={() => onAction('escalate', c)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600">
                                    <ArrowUpCircle size={13} /> {tr("Escalate to Level 2")}
                                </button>
                            )}
                            {canRespond && (
                                <button onClick={() => onAction('respond', c)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                                    <MessageSquare size={13} /> {tr("Respond")}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ComplaintsTab({ proposal, userId, isProposalMember, rejectedVia }) {
    const { hasPermission, accessScope } = useAuth();
    const [complaints,  setComplaints]  = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [filing,      setFiling]      = useState(null); // 'college' | 'officer'
    const [action,      setAction]      = useState(null); // { type, complaint }
    const [expanded,    setExpanded]    = useState(null);
    const [withdrawing, setWithdrawing] = useState(false);
    const { success, error } = useToast();

    // Also stays open after a terminal rejection specifically caused by failing the
    // blind review or open defence score threshold — the PI should still be able to
    // dispute how THAT review was conducted even though the decision itself is final
    // (disputing the decision is Request Reconsideration's job, scoped separately to
    // central-evaluation rejections only).
    const rejectedOnReviewScore = proposal.status === 'rejected' && rejectedVia in REJECTION_ACTION_STAGE_MAP;
    const collegeStage   = COMPLAINT_STAGE_MAP[proposal.status] ?? REJECTION_ACTION_STAGE_MAP[rejectedVia] ?? null;
    const canFileCollege = isProposalMember && (COLLEGE_COMPLAINT_STATUSES.includes(proposal.status) || rejectedOnReviewScore);
    const canFileOfficer = isProposalMember && FUNDED_STATUSES.includes(proposal.status);

    const who = { userId, canRespond: hasPermission('complaints.respond'), scope: accessScope };
    const permissions = (c) => complaintPermissions(c, who);

    const load = () => {
        setLoading(true);
        get(`/proposals/${proposal.id}/complaints`)
            .then(r => {
                const owner = { id: proposal.id, tracker_number: proposal.tracker_number, title: proposal.title, category: proposal.category, college_id: proposal.college_id };
                setComplaints((r.data ?? []).map(c => ({ ...c, proposal: owner })));
            })
            .catch(() => error('Failed to load complaints.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [proposal.id]);

    const handleSaved = (msg) => {
        setFiling(null);
        setAction(null);
        success(msg);
        load();
    };

    const withdraw = async () => {
        setWithdrawing(true);
        try {
            await del(`/complaints/${action.complaint.id}`);
            handleSaved('Complaint withdrawn.');
        } catch (e) {
            error(e.response?.data?.message || 'Failed to withdraw complaint.');
        }
        setWithdrawing(false);
    };

    const collegeCount = complaints.filter(c => c.level === 'college').length;
    const officerCount = complaints.filter(c => c.level === 'officer').length;
    const awaitingCount = complaints.filter(c => AWAITING.includes(c.status)).length;

    const collegeAvailability = canFileCollege
        ? `Open now for the ${STAGE_LABELS[collegeStage] ?? 'review'} stage`
        : FUNDED_STATUSES.includes(proposal.status)
            ? 'Closed — the review stages are over'
            : 'Opens during blind review and open defence';
    const officerAvailability = canFileOfficer
        ? 'Open now — the project is funded'
        : 'Opens once the project is funded';

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                    {[0, 1].map(i => <div key={i} className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-gray-50" />)}
                </div>
                {[0, 1].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl border border-gray-200 bg-gray-50" />)}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
                <ComplaintLevelCard icon={Building2} tone="bg-sky-50 text-sky-700" title={tr("Level 1 · College office")}
                    who="Concerns about how the blind review or open defence was conducted"
                    count={collegeCount} canFile={canFileCollege}
                    availability={isProposalMember ? collegeAvailability : 'Filed by the research team'}
                    onFile={() => setFiling('college')} />
                <ComplaintLevelCard icon={Scale} tone="bg-violet-50 text-violet-700" title={tr("Level 2 · Category director")}
                    who="Post-funding concerns (budget, decisions), and escalated Level 1 complaints"
                    count={officerCount} canFile={canFileOfficer}
                    availability={isProposalMember ? officerAvailability : 'Filed by the research team'}
                    onFile={() => setFiling('officer')} />
            </div>

            <div>
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                        {tr("Complaint history")} <span className="font-normal text-gray-400">({complaints.length})</span>
                    </p>
                    {awaitingCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {tr(":awaitingCount awaiting a response", { awaitingCount: awaitingCount })}
                        </span>
                    )}
                </div>

                {complaints.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
                        <ShieldCheck size={26} className="mx-auto text-gray-300" />
                        <p className="mt-2 text-sm font-medium text-gray-700">{tr("No complaints on this proposal")}</p>
                        <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">
                            {isProposalMember
                                ? 'If something about the review or the funded project seems wrong, you can raise it while the level above is open.'
                                : 'Complaints filed by the research team will appear here.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {complaints.map(c => (
                            <ComplaintCard key={c.id} complaint={c} permissions={permissions}
                                expanded={expanded === c.id}
                                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                                onAction={(type, complaint) => setAction({ type, complaint })} />
                        ))}
                    </div>
                )}
            </div>

            {filing && (
                <FileComplaintModal proposal={proposal} level={filing} stage={collegeStage}
                    onSave={() => handleSaved('Complaint submitted — you\'ll be notified when it is answered.')}
                    onClose={() => setFiling(null)} />
            )}
            {action?.type === 'respond' && (
                <RespondModal complaint={action.complaint}
                    onSave={(resolution) => handleSaved(resolution === 'dismissed' ? 'Complaint dismissed — the complainant has been notified.' : 'Complaint resolved — the complainant has been notified.')}
                    onClose={() => setAction(null)} />
            )}
            {action?.type === 'escalate' && (
                <EscalateModal complaint={action.complaint} onSave={() => handleSaved('Complaint escalated to Level 2.')} onClose={() => setAction(null)} />
            )}
            {action?.type === 'edit' && (
                <EditModal complaint={action.complaint} onSave={() => handleSaved('Complaint updated.')} onClose={() => setAction(null)} />
            )}
            <ConfirmDialog
                open={action?.type === 'withdraw'}
                title={tr("Withdraw complaint")}
                description="Withdraw this complaint? It will be removed and can't be restored."
                confirmLabel={withdrawing ? 'Withdrawing…' : 'Withdraw'}
                confirmVariant="danger"
                onConfirm={withdraw}
                onCancel={() => setAction(null)}
            />
        </div>
    );
}

function ActionButtons({ proposal, onAction, onProcessDefenceResult, can, canRejectBlindReview, canReportMistakenApproval, hasOpenReport }) {
    if (!Object.values(can).some(Boolean) && !canRejectBlindReview && !canReportMistakenApproval) return null;
    const { status, id } = proposal;

    if (can.validate && status === 'submitted') return (
        <div className="flex flex-wrap gap-2">
            <button onClick={() => onAction('approve')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                <CheckCircle size={15} /> {tr("Approve")}
            </button>
            <button onClick={() => onAction('return')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                <RotateCcw size={15} /> {tr("Return for Correction")}
            </button>
            <button onClick={() => onAction('reject')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                <XCircle size={15} /> {tr("Reject")}
            </button>
        </div>
    );

    if (status === 'validated' && (can.assignReviewers || canRejectBlindReview || canReportMistakenApproval)) return (
        <div className="flex flex-wrap gap-2">
            {can.assignReviewers && (
                <Link href={`/proposals/${id}/assign-reviewers`}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
                    <UserCheck size={15} /> {tr("Assign Reviewers")}
                </Link>
            )}
            {canRejectBlindReview && (
                <button onClick={() => onAction('reject')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                    <XCircle size={15} /> {tr("Reject")}
                </button>
            )}
            {canReportMistakenApproval && !hasOpenReport && (
                <button onClick={() => onAction('report_mistaken_approval')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                    <AlertCircle size={15} /> {tr("Report Mistaken Approval")}
                </button>
            )}
        </div>
    );

    if (status === 'under_blind_review' && (canRejectBlindReview || canReportMistakenApproval)) return (
        <div className="flex flex-wrap gap-2">
            {canRejectBlindReview && (
                <button onClick={() => onAction('reject_blind_review')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                    <XCircle size={15} /> {tr("Reject From Blind Review")}
                </button>
            )}
            {canReportMistakenApproval && !hasOpenReport && (
                <button onClick={() => onAction('report_mistaken_approval')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                    <AlertCircle size={15} /> {tr("Report Mistaken Approval")}
                </button>
            )}
        </div>
    );

    if (status === 'blind_review_passed' && (can.manageReviews || canRejectBlindReview || canReportMistakenApproval)) return (
        <div className="flex flex-wrap gap-2">
            {can.manageReviews && (
                <Link href={`/proposals/${id}/defence`}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800">
                    <Calendar size={15} /> {tr("Schedule Open Defence")}
                </Link>
            )}
            {canRejectBlindReview && (
                <button onClick={() => onAction('reject_blind_review')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                    <XCircle size={15} /> {tr("Reject")}
                </button>
            )}
            {canReportMistakenApproval && !hasOpenReport && (
                <button onClick={() => onAction('report_mistaken_approval')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                    <AlertCircle size={15} /> {tr("Report Mistaken Approval")}
                </button>
            )}
        </div>
    );

    if (can.decideReview && status === 'under_open_defence') return (
        <button
            onClick={onProcessDefenceResult}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
            <Award size={15} /> {tr("Process Defence Result")}
        </button>
    );

    if (can.decideFunding && status === 'accepted') return (
        <Link href={`/proposals/${id}/award`}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800">
            <Award size={15} /> {tr("Generate Award")}
        </Link>
    );

    if (status === 'rejected' && canRejectBlindReview) return (
        <button onClick={() => onAction('reopen')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <RotateCcw size={15} /> {tr("Reopen for Reconsideration")}
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

function DocumentsTab({ proposalId, documents, userId, isPI, isDraft, hideIdentity, onRefresh, showEthicalClearanceOption, callDocuments = [] }) {
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
                    <p className="text-sm font-semibold text-blue-800">{tr("Share a file with your College Officer")}</p>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="block text-xs text-blue-700 mb-1">{tr("Document type")}</label>
                            <select
                                value={docType}
                                onChange={e => setDocType(e.target.value)}
                                className="border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="shared_document">{tr("Shared by PI")}</option>
                                <option value="supporting_document">{tr("Supporting Document")}</option>
                                <option value="budget_spreadsheet">{tr("Budget Spreadsheet")}</option>
                                <option value="pi_cv">{tr("PI CV")}</option>
                                {showEthicalClearanceOption && (
                                    <option value="ethical_clearance_certificate">{tr("Ethical Clearance Certificate")}</option>
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
                                    <span className="text-sm">{tr("Click to select file")}</span>
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
                        {tr("This proposal has been submitted — documents can no longer be removed.")}
                    </p>
                </div>
            )}

            {/* Document list — grouped by type, current version first, older versions collapsed */}
            {documents.length === 0 ? (
                <p className="text-sm text-gray-400">{tr("No documents uploaded yet.")}</p>
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
                        const typeLabel = DOC_TYPE_LABELS[type] ?? callDocuments.find(d => `call_${d.key}` === type)?.label ?? type?.replace(/_/g, ' ');

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
                                                        {tr("by :name", { name: doc.uploaded_by.name })}
                                                    </span>
                                                )}
                                                {doc.file_size && (
                                                    <span className="text-xs text-gray-400">
                                                        {tr(":file_size MB", { file_size: (doc.file_size / 1024 / 1024).toFixed(2) })}
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
                                            <ExternalLink size={12} /> {tr("Download")}
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
                <h2 className="text-base font-semibold text-gray-900 mb-1">{tr("Request Reconsideration")}</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {tr("Reason for Appeal")} <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">{tr("(min 20 characters)")}</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={5}
                    placeholder={tr("Explain why you believe this proposal should be reconsidered...")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">{tr("Cancel")}</button>
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
                <h2 className="text-base font-semibold text-gray-900 mb-1">{tr("Submit Ethical Clearance for Verification")}</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                    {tr("Upload your certificate in the Documents tab (type \"Ethical Clearance Certificate\") before submitting here.")}
                </p>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {tr("Certificate / Reference Number")} <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={clearanceNumber}
                    onChange={e => setClearanceNumber(e.target.value)}
                    placeholder={tr("e.g. IRB-2026-0042")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {tr("Expiry Date")} <span className="text-red-500">*</span>
                </label>
                <input
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">{tr("Cancel")}</button>
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
                <h2 className="text-base font-semibold text-gray-900 mb-1">{tr("Request a Deadline Extension")}</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {tr("I need until")} <span className="text-red-500">*</span>
                </label>
                <input
                    type="datetime-local"
                    value={requestedUntil}
                    onChange={e => setRequestedUntil(e.target.value)}
                    min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {tr("Reason")} <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">{tr("(min 20 characters)")}</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={5}
                    placeholder={tr("Explain why you need more time…")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">{tr("Cancel")}</button>
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
                <h2 className="text-base font-semibold text-gray-900 mb-1">{tr("Request a Budget Revision")}</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>

                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {tr("Reason")} <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">{tr("(min 20 characters)")}</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    placeholder={tr("Explain why the budget needs to change…")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />

                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-700">{tr("Revised Budget Items")} <span className="text-red-500">*</span></p>
                    <button onClick={addItem} className="text-xs font-semibold text-blue-600 hover:text-blue-700">{tr("+ Add Item")}</button>
                </div>

                <div className="space-y-3 mb-4">
                    {items.map((it, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="text" placeholder={tr("Category")} value={it.category}
                                    onChange={e => updateItem(idx, 'category', e.target.value)}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="number" placeholder={tr("Amount")} value={it.amount} min="0"
                                    onChange={e => updateItem(idx, 'amount', e.target.value)}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <input
                                type="text" placeholder={tr("Item description")} value={it.item_description}
                                onChange={e => updateItem(idx, 'item_description', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text" placeholder={tr("Justification (optional)")} value={it.justification}
                                    onChange={e => updateItem(idx, 'justification', e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button onClick={() => removeItem(idx)} className="px-3 text-xs text-red-500 hover:text-red-700 shrink-0">{tr("Remove")}</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mb-4">
                    <span className="text-sm font-semibold text-gray-700">{tr("New Total")}</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(total)}</span>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">{tr("Cancel")}</button>
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
                <h2 className="text-base font-semibold text-gray-900 mb-1">{tr("Request a No-Cost Extension")}</h2>
                <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.tracker_number}</p>
                <p className="text-xs text-gray-500 mb-4">{tr("Current project duration:")} <strong>{tr(":duration_months months", { duration_months: proposal.duration_months })}</strong></p>

                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {tr("New Total Duration (months)")} <span className="text-red-500">*</span>
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
                    {tr("Reason")} <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">{tr("(min 20 characters)")}</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={5}
                    placeholder={tr("Explain why more time is needed to complete this project…")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50">{tr("Cancel")}</button>
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
                        <span className="text-[11px] font-semibold text-violet-600">{tr("Score now →")}</span>
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
                            <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">{tr("Strengths")}</p>
                            <p className="text-xs text-gray-600">{score.strengths}</p>
                        </div>
                    )}
                    {score.weaknesses && (
                        <div>
                            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">{tr("Weaknesses")}</p>
                            <p className="text-xs text-gray-600">{score.weaknesses}</p>
                        </div>
                    )}
                    {score.recommendations && (
                        <div>
                            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">{tr("Recommendations")}</p>
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
                            <p className="text-xs font-semibold text-red-700">{tr("AI scoring failed")}</p>
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
                <p className="text-[11px] text-green-700">{tr("Recorded decisions match the current thresholds — nothing to correct.")}</p>
            </div>
        );
    }

    const applicable = corrections.filter(c => c.applicable);

    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
            <div className="flex items-start gap-2">
                <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs font-semibold text-amber-800">{tr("Recorded decision differs from the recalculated result")}</p>
            </div>
            <ul className="space-y-1.5 pl-5">
                {corrections.map((c) => (
                    <li key={c.phase} className="text-[11px] text-amber-800 leading-relaxed">
                        <span className="font-semibold">{PHASE_LABELS[c.phase] ?? c.phase}:</span>{' '}
                        {c.issue === 'wrongly_passed' ? 'passed, but now falls below the threshold' : 'rejected, but now clears the threshold'}
                        {' '}({c.score}) — <span className="font-semibold">{c.change.replace('accepted', 'central evaluation').replace('blind_review_passed', 'blind review passed')}</span>
                        {!c.applicable && c.reason && (
                            <span className="block text-amber-700/80 italic">{tr("Cannot be applied here: :reason.", { reason: c.reason })}</span>
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
            return <p className="text-xs text-gray-400 italic">{tr("No submitted blind review scores yet.")}</p>;
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
        return <p className="text-xs text-gray-400 italic">{tr("No submitted open defence scores yet.")}</p>;
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
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{tr("Verify Current Scores")}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                    {tr("Recomputes a phase live against the current threshold settings and evaluation criteria. Scores are capped at each phase's maximum.")}
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
                        {tr(":phase · Current proposal status:", { phase: PHASE_LABELS[phase] })} <span className="font-semibold text-gray-600">{getStatusLabel(snapshot.proposal_status ?? proposalStatus)}</span>
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

/** The proposal's active mentor, when the PI has one for it. */
function ProposalMentor({ proposalId }) {
    const [mentor, setMentor] = useState(null);
    useEffect(() => { get(`/proposals/${proposalId}/mentor`).then((r) => setMentor(r.data ?? null)).catch(() => {}); }, [proposalId]);
    if (!mentor) return null;
    return (
        <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-sm">
            <span className="font-semibold text-violet-800">{tr('Mentor')}:</span>
            <span className="text-violet-900">{mentor.name}</span>
        </div>
    );
}

/** The office rates how useful a review was; ratings lift or lower the reviewer in future matching. */
function ReviewQualityRating({ assignmentId, value }) {
    const { error } = useToast();
    const [rating, setRating] = useState(value ?? null);
    const [saving, setSaving] = useState(false);
    const options = [[3, 'Useful', 'bg-emerald-600 text-white'], [2, 'Adequate', 'bg-sky-600 text-white'], [1, 'Thin', 'bg-amber-500 text-white']];

    const rate = async (next) => {
        const target = rating === next ? null : next;
        setSaving(true);
        try {
            await post(`/review-assignments/${assignmentId}/quality`, { rating: target });
            setRating(target);
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not save the rating.');
        }
        setSaving(false);
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 bg-gray-50/60 px-4 py-2">
            <span className="mr-1 text-[11px] font-medium text-gray-500">{tr('Review quality')}:</span>
            {options.map(([n, label, active]) => (
                <button key={n} onClick={() => rate(n)} disabled={saving}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 ${rating === n ? active : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100'}`}>
                    {tr(label)}
                </button>
            ))}
            <span className="ml-auto text-[10px] text-gray-400">{tr('Only the office sees this')}</span>
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
                    <p className="text-sm font-semibold text-amber-700">{tr("Review results are not visible to your role")}</p>
                    <p className="text-xs text-amber-600 mt-0.5">{tr("Review outcomes are shared with the proposal team after the review phase is complete.")}</p>
                </div>
            </div>
        );
    }

    if (!isStaff && !reviewsReleased) {
        return (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5">
                <span className="text-blue-500 text-base mt-0.5">ℹ️</span>
                <div>
                    <p className="text-sm font-semibold text-blue-700">{tr("Review in progress")}</p>
                    <p className="text-xs text-blue-600 mt-0.5">{tr("Review results will be available once the blind review phase is complete.")}</p>
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
        return <p className="text-sm text-gray-400">{tr("No review results available yet.")}</p>;
    }

    const { total_reviews, submitted_reviews, scores, reviews } = results;
    // Combined (blind + defence) out of 100 — scaled only if the criteria weights don't add up to 100.
    const outOf100 = (score, max) => (max && Math.abs(max - 100) > 0.001 ? Math.round((score / max) * 10000) / 100 : score);
    const fmt = n => (n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));

    return (
        <div className="space-y-5">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-gray-800 tabular-nums">{submitted_reviews}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tr("Reviews Submitted")}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-gray-800 tabular-nums">{total_reviews}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tr("Total Assigned")}</p>
                </div>
                {scores?.combined != null ? (
                    <div className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-indigo-700 tabular-nums">{fmt(outOf100(scores.combined, scores.combined_max))}<span className="text-base font-semibold text-indigo-400">/100</span></p>
                        <p className="text-xs text-indigo-500 mt-0.5">{tr("Combined (Blind + Defence)")}</p>
                        <p className="text-[11px] text-indigo-400 mt-0.5 tabular-nums">
                            {tr("Blind :score/:max + Defence :score2/:max2", { score: fmt(scores.blind?.score), max: fmt(scores.blind?.max), score2: fmt(scores.defence?.score), max2: fmt(scores.defence?.max) })}
                        </p>
                    </div>
                ) : scores?.blind != null && (
                    <div className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-indigo-700 tabular-nums">{fmt(scores.blind.score)}<span className="text-base font-semibold text-indigo-400">/{fmt(scores.blind.max)}</span></p>
                        <p className="text-xs text-indigo-500 mt-0.5">{tr("Blind Review Score")}</p>
                        <p className="text-[11px] text-indigo-400 mt-0.5">{tr("Combined score after the open defence")}</p>
                    </div>
                )}
            </div>

            {isStaff && <RecalculatePanel proposalId={proposalId} proposalStatus={proposalStatus} onDecisionChanged={onDecisionChanged} />}

            {/* Per-review cards (anonymized) */}
            {reviews.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{tr("Review Feedback")}</p>
                    {reviews.map((rv, i) => (
                        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-gray-600">
                                    {tr("Reviewer :i", { i: i + 1 })}
                                    {rv.second_opinion && <span className="rounded-full bg-indigo-50 px-1.5 py-px text-[10px] font-semibold text-indigo-700">{tr("Second opinion")}</span>}
                                    {rv.set_aside && <span className="rounded-full bg-gray-200 px-1.5 py-px text-[10px] font-semibold text-gray-600" title={tr("Furthest from the other scores after a second opinion — not counted in the blind review score.")}>{tr("Set aside")}</span>}
                                </span>
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
                            {rv.assignment_id && <ReviewQualityRating assignmentId={rv.assignment_id} value={rv.quality_rating} />}
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
                        <FileText size={13} /> {tr("Research Contract")}
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
                        <span>{tr("Contract approved on :contract_signed_at. You may now submit your budget request.", { contract_signed_at: formatDate(proposal.contract_signed_at) })}</span>
                    </div>
                )}

                {status === 'pending' && (
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                        <Upload size={14} className="shrink-0" />
                        <span>{tr("Contract submitted and under review. You will be notified once approved.")}</span>
                    </div>
                )}

                {status === 'rejected' && (
                    <div className="flex items-start gap-2 text-sm text-red-700">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">{tr("Contract was returned for correction.")}</p>
                            {proposal.contract_rejection_reason && (
                                <p className="text-xs text-red-600 mt-0.5">{proposal.contract_rejection_reason}</p>
                            )}
                        </div>
                    </div>
                )}

                {!status && (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                            {tr("Please upload the signed research contract (PDF). An officer will review and approve it before you can submit your first budget request.")}
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
                        title={tr("Submitted contract")}
                    />
                </div>
            )}
        </div>
    );
}

export default function ProposalShow() {
    const { url } = usePage();
    const id = url.split('/')[2];
    const { user, hasPermission, covers } = useAuth();
    const { hasSubFeature } = useFeature();
    const toast = useToast();

    const [proposal, setProposal] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    // ?tab=Progress (from a notification link) opens that tab directly.
    const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'Overview');
    // The message thread tab shows only to those who may read it, with their unread count.
    const [messageInfo, setMessageInfo] = useState({ can_see: false, count: 0 });
    useEffect(() => {
        if (!id) return;
        get(`/proposals/${id}/messages/unread`).then((r) => setMessageInfo(r.data ?? { can_see: false, count: 0 })).catch(() => {});
    }, [id]);
    const [dialog, setDialog] = useState(null);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [appeal, setAppeal] = useState(null);
    const [showAppealModal, setShowAppealModal] = useState(false);
    const [approvalReports, setApprovalReports] = useState([]);
    const [approvalReportsLoaded, setApprovalReportsLoaded] = useState(false);
    const [resolvingReport, setResolvingReport] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [rejectDialog, setRejectDialog] = useState(null); // 'reject' | 'reject_blind_review'
    const [rejectPreset, setRejectPreset] = useState(null); // { code, details } — e.g. from the anonymity check
    const [withdrawingReportId, setWithdrawingReportId] = useState(null);
    const [confirmWithdrawReport, setConfirmWithdrawReport] = useState(null);
    const [extension, setExtension] = useState(null);
    const [showExtensionModal, setShowExtensionModal] = useState(false);
    const [showClearanceModal, setShowClearanceModal] = useState(false);
    const [budgetRevision, setBudgetRevision] = useState(null);
    const [showBudgetRevisionModal, setShowBudgetRevisionModal] = useState(false);
    const [noCostExtension, setNoCostExtension] = useState(null);
    const [showNoCostExtensionModal, setShowNoCostExtensionModal] = useState(false);

    // Every action follows the permissions the server checks, within the user's scope.
    const inScope = !!proposal && covers(proposal.college_id, proposal.category);
    const can = {
        validate: hasPermission('proposals.validate') && inScope,
        assignReviewers: hasPermission('proposals.assign_reviewer') && inScope,
        manageReviews: hasPermission('reviews.manage') && inScope,
        decideReview: hasPermission('review_decisions.correct') && inScope,
        decideFunding: hasPermission('evaluation.central') && inScope,
    };
    const isAdmin = can.validate || can.assignReviewers || can.manageReviews || can.decideReview;
    const isOfficer = hasPermission('review_results.view');
    const canRejectBlindReview = can.decideReview;
    const canReportMistakenApproval = hasPermission('approval_reports.file') && inScope;
    const canReviewApprovalReports = hasPermission('approval_reports.resolve');
    // Until the reports have loaded, assume one may be open so "Report" isn't offered twice.
    const hasOpenReport = !approvalReportsLoaded || approvalReports.some(r => r.status === 'open');

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

    // Runs before the proposal has loaded, so it can't depend on scope (inScope).
    const loadApprovalReports = () => {
        if (!hasPermission('approval_reports.file') && !canReviewApprovalReports) return;
        get(`/proposals/${id}/approval-reports`)
            .then(r => { setApprovalReports(r.data ?? []); setApprovalReportsLoaded(true); })
            .catch(e => toast.error(e.response?.data?.message ?? 'Could not load the approval reports for this proposal. Refresh the page to try again.'));
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
        if (action === 'reject' || action === 'reject_blind_review') { setRejectDialog(action); return; }
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
            if (dialog === 'reopen') {
                const res = await post(`/proposals/${id}/reopen`, { reason });
                toast.success(res?.message || 'Proposal reopened for reconsideration.');
            } else {
                await post(`/proposals/${id}/validation/${dialog}`, { reason });
                if (dialog === 'approve') toast.success('Proposal approved for review.');
                if (dialog === 'return')  toast.warning('Proposal returned to PI for correction.');
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
        <AppLayout breadcrumb="Proposal"><p className="text-gray-500">{tr("Proposal not found.")}</p></AppLayout>
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
                                <span><strong>{tr("Category:")}</strong> {getCategoryLabel(proposal.category)}</span>
                                <span><strong>{tr("College:")}</strong> {proposal.college?.name ?? '—'}</span>
                                <span><strong>{tr("Year:")}</strong> {proposal.academic_year ?? '—'}</span>
                                <span><strong>{tr("Submitted:")}</strong> {formatDate(proposal.submitted_at)}</span>
                                {hasSubFeature('workflow.ethical_clearance') && proposal.ethical_clearance_required && (
                                    <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                                        {tr("EC: :Required", { Required: proposal.ethical_clearance_number || 'Clearance Required' })}
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
                                    <p className="text-sm font-semibold text-red-800 mb-1">{tr("Rejection Reason")}</p>
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
                                            <RotateCcw size={14} /> {tr("Request Reconsideration")}
                                        </button>
                                    </div>
                                ) : ['fail_blind_review', 'fail_defence'].includes(rejectedVia) && (
                                    <p className="text-xs text-gray-400 italic text-right">
                                        {tr("This proposal was rejected for not meeting the review score threshold — use the Complaints tab to raise a concern about that review.")}
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
                                <p className="text-sm font-semibold text-sky-900">{tr("In Central Evaluation")}</p>
                                <p className="mt-0.5 text-sm leading-relaxed text-sky-800/80">
                                    {tr("This proposal has passed both the Blind Review and Open Defence phases and is now with the Central Evaluation Committee. A separate notification will follow once the final funding decision has been made.")}
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
                                        <p className="text-sm text-gray-700">{tr("You may now submit until")} <strong>{formatDate(extension.granted_until)}</strong>.</p>
                                    )}
                                    {extension.resolution_notes && <p className="text-sm text-gray-600 mt-1">{extension.resolution_notes}</p>}
                                    {canRequestExtension && extension.status !== 'pending' && (
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={() => setShowExtensionModal(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                <CalendarClock size={14} /> {tr("Request Another Extension")}
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
                                        <CalendarClock size={14} /> {tr("Request Extension")}
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
                                                    <p className="text-sm mt-1">{tr("Valid until")} <strong>{formatDate(proposal.ethical_clearance_expiry)}</strong></p>
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
                                    <p className="text-xs font-medium text-emerald-600 uppercase">{tr("Grant Reference")}</p>
                                    <p className="text-sm font-bold text-emerald-800 font-mono">{proposal.award.grant_reference}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-emerald-600 uppercase">{tr("Awarded Amount")}</p>
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
                                                    <p className="text-sm mt-1">{tr("Request a revision to your budget line items — an officer will review it.")}</p>
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
                                                    <p className="text-sm mt-1">{tr("Project duration extended to")} <strong>{tr(":requested_duration_months months", { requested_duration_months: noCostExtension.requested_duration_months })}</strong>.</p>
                                                )}
                                                {nceStatus === 'denied' && noCostExtension?.resolution_notes && (
                                                    <p className="text-sm mt-1">{noCostExtension.resolution_notes}</p>
                                                )}
                                                {!nceStatus && (
                                                    <p className="text-sm mt-1">{tr("Request more time to complete the project at no additional cost — an officer will review it.")}</p>
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

                    {['submitted', 'validated', 'under_blind_review', 'blind_review_passed'].includes(proposal.status)
                        && (isAdmin || isOfficer || canRejectBlindReview) && (
                        <AnonymityCheckPanel
                            proposal={proposal}
                            canRecheck={hasPermission('proposals.validate') || hasPermission('reviews.manage')}
                            canReject={
                                (proposal.status === 'submitted' && hasPermission('proposals.validate'))
                                || (proposal.status === 'under_blind_review' && canRejectBlindReview)
                            }
                            onRejectAsNotAnonymous={(details) => {
                                setRejectPreset({ code: 'not_anonymous', details });
                                setRejectDialog(proposal.status === 'submitted' ? 'reject' : 'reject_blind_review');
                            }}
                            onChecked={load}
                        />
                    )}

                    {proposal.status === 'under_blind_review' && (isAdmin || isOfficer) && (
                        <ReviewDisagreementPanel proposal={proposal} canDecide={canRejectBlindReview} canInvite={can.manageReviews || canRejectBlindReview} onDecided={load} />
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
                                                                : r.outcome === 'moved_to_ongoing' ? 'Already ongoing — moved to Ongoing Proposals'
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
                                                {r.status === 'open' && r.reported_by?.id === user?.id && proposal.status !== 'validated' && (
                                                    <p className="text-xs text-gray-500 mt-1.5">
                                                        {tr("This report can no longer be cancelled — the proposal has already been acted on and is now :status.", { status: getStatusLabel(proposal.status) })}
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

                    {rejectDialog && (
                        <RejectWithReasonModal
                            context={rejectDialog === 'reject' ? 'proposal_validation' : 'blind_review'}
                            title={rejectDialog === 'reject' ? 'Reject Proposal' : 'Reject From Blind Review'}
                            subtitle={`${proposal.tracker_number ?? ''} · ${proposal.title ?? ''}`}
                            note="The PI and co-investigators are notified with this reason. Outstanding reviewer assignments are cancelled."
                            confirmLabel="Reject Proposal"
                            initialCode={rejectPreset?.code ?? ''}
                            initialDetails={rejectPreset?.details ?? ''}
                            onClose={() => { setRejectDialog(null); setRejectPreset(null); }}
                            onSubmit={async (payload) => {
                                const url = rejectDialog === 'reject'
                                    ? `/proposals/${id}/validation/reject`
                                    : `/proposals/${id}/blind-review/reject`;
                                await post(url, payload);
                                toast.error(rejectDialog === 'reject' ? 'Proposal has been rejected.' : 'Proposal rejected and removed from blind review.');
                                setRejectDialog(null);
                                setRejectPreset(null);
                                load();
                            }}
                        />
                    )}

                    {showReportModal && (
                        <ReportMistakenApprovalModal
                            proposal={proposal}
                            previousReport={approvalReports.find(r => r.status === 'reviewed' && r.outcome === 'approval_stands') ?? null}
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
                        title={tr("Cancel this report?")}
                        description="Your mistaken-approval report will be withdrawn and the proposal will return to the stage it was at before you reported it. The central office and category officer will be told no action is needed."
                        confirmLabel="Cancel Report"
                        cancelLabel="Keep Report"
                        confirmVariant="danger"
                        onConfirm={withdrawReport}
                        onCancel={() => setConfirmWithdrawReport(null)}
                    />

                    {/* Workflow actions */}
                    {(isAdmin || can.decideFunding || canRejectBlindReview || canReportMistakenApproval) && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <ActionButtons
                                proposal={proposal}
                                onAction={handleAction}
                                onProcessDefenceResult={handleProcessDefenceResult}
                                can={can}
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

                {/* Running projects: time, money and progress against each other */}
                {['funded', 'midterm_evaluation'].includes(proposal.status) && <ProjectHealthCard proposalId={proposal.id} />}

                {/* Tabs */}
                {isProposalMember && (
                    <ProposalStatusGuide proposalId={id} status={proposal.status} onOpenTab={setActiveTab} />
                )}

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                        {[...TABS, ...(['funded', 'midterm_evaluation', 'completed', 'archived'].includes(proposal.status) ? ['Progress'] : []), ...(messageInfo.can_see ? ['Messages'] : [])].map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`inline-flex items-center gap-1.5 px-5 py-3 text-sm font-medium shrink-0 border-b-2 transition-colors ${
                                    activeTab === tab
                                        ? 'border-blue-600 text-blue-700'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}>
                                {tr(tab)}
                                {tab === 'Messages' && messageInfo.count > 0 && (
                                    <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold tabular-nums text-white">{messageInfo.count}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {activeTab === 'Overview' && proposal.status === 'submitted' && !proposal.history_hidden && (
                            <ProposalVersions proposalId={id} />
                        )}
                        {activeTab === 'Overview' && (
                            <div className="space-y-4 text-sm text-gray-700">
                                {proposal.abstract && (
                                    <div>
                                        <p className="font-semibold text-gray-800 mb-1">{tr("Abstract")}</p>
                                        <p className="leading-relaxed">{proposal.abstract}</p>
                                    </div>
                                )}
                                {proposal.keywords && (
                                    <div>
                                        <p className="font-semibold text-gray-800 mb-1">{tr("Keywords")}</p>
                                        <p className="text-gray-500">{proposal.keywords}</p>
                                    </div>
                                )}
                                {(proposal.call_form_answers ?? []).length > 0 && (
                                    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                                        <p className="font-semibold text-gray-800 mb-3">{tr("Questions for this call")}</p>
                                        <CallAnswers items={proposal.call_form_answers} />
                                    </div>
                                )}
                                <ProposalMentor proposalId={proposal.id} />
                                {(proposal.sdgs ?? []).length > 0 && (
                                    <div>
                                        <p className="font-semibold text-gray-800 mb-1.5">{tr("Sustainable Development Goals")}</p>
                                        <SdgBadges value={proposal.sdgs} size="md" />
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
                                            <p className="text-sm font-semibold text-amber-700">{tr("Member information is not visible to your role")}</p>
                                            <p className="text-xs text-amber-600 mt-0.5">{tr("Team identity is concealed during blind and open defence review to preserve evaluation integrity.")}</p>
                                        </div>
                                    </div>
                                )
                            : members.length === 0
                                ? <p className="text-sm text-gray-400">{tr("No team members on record.")}</p>
                                : (
                                    <>
                                        <div className="hidden sm:block overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                                    <tr><th className="px-4 py-2 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                                        {['Member', 'Email', 'Role', 'Contribution'].map((h) => (
                                                            <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {members.filter(m => m.status === 'active').map((m, rowIdx) => (
                                                        <tr key={m.id}><td className="px-4 py-2.5 w-10 text-xs font-medium tabular-nums text-gray-400">{rowIdx + 1}</td>
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
                                                    <p className="text-xs text-gray-600 mt-1">{tr("Contribution: :contribution_percentage%", { contribution_percentage: m.contribution_percentage })}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )
                        )}

                        {activeTab === 'Budget' && (
                            budgets.length === 0
                                ? <p className="text-sm text-gray-400">{tr("No budget items on record.")}</p>
                                : (
                                    <div className="space-y-3">
                                        <div className="hidden sm:block overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                                    <tr><th className="px-4 py-2 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                                        {['Category', 'Description', 'Amount', 'Justification'].map((h) => (
                                                            <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {budgets.map((b, rowIdx) => (
                                                        <tr key={b.id}><td className="px-4 py-2.5 w-10 text-xs font-medium tabular-nums text-gray-400">{rowIdx + 1}</td>
                                                            <td className="px-4 py-2.5 text-gray-600 capitalize">{b.category}</td>
                                                            <td className="px-4 py-2.5 text-gray-800">{b.item_description}</td>
                                                            <td className="px-4 py-2.5 font-medium">{formatCurrency(b.amount)}</td>
                                                            <td className="px-4 py-2.5 text-gray-500 text-xs">{b.justification ?? '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-50 border-t border-gray-200">
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-700">{tr("Total")}</td>
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
                                                <span className="text-sm font-semibold text-gray-700">{tr("Total")}</span>
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
                                callDocuments={proposal.proposal_call?.application_form?.documents ?? []}
                            />
                        )}

                        {activeTab === 'History' && (
                            proposal.history_hidden ? (
                                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                                    <span className="text-amber-500 text-base mt-0.5">🔒</span>
                                    <div>
                                        <p className="text-sm font-semibold text-amber-700">{tr("Submission history is not visible to your role")}</p>
                                        <p className="text-xs text-amber-600 mt-0.5">{tr("Activity logs are concealed during blind and open defence review to preserve evaluation integrity.")}</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <ProposalVersions proposalId={id} />
                                    <ProposalTimeline history={history} currentStatus={proposal.status} />
                                </>
                            )
                        )}

                        {activeTab === 'Reviews' && (isAdmin || isOfficer) && ['under_open_defence', 'accepted', 'funded', 'midterm_evaluation', 'completed', 'archived', 'rejected'].includes(proposal.status) && (
                            <div className="mb-3 flex justify-end">
                                <DefenceRecordButton proposalId={id} trackerNumber={proposal.tracker_number} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5" />
                            </div>
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

                        {activeTab === 'Progress' && <ProgressReportsTab proposalId={id} />}
                        {activeTab === 'Messages' && <ProposalMessages proposalId={id} onRead={() => setMessageInfo((m) => ({ ...m, count: 0 }))} />}

                        {activeTab === 'Complaints' && (
                            <ComplaintsTab
                                proposal={proposal}
                                userId={user?.id}
                                isProposalMember={isProposalMember}
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
                            {dialog === 'reopen' ? 'Reopen for Reconsideration'
                                : <span className="capitalize">{tr(":dialog Proposal", { dialog: dialog })}</span>}
                        </h2>
                        {dialog === 'reopen' && (
                            <p className="text-xs text-gray-500 mb-3">
                                {tr("This returns the proposal to whichever stage it was rejected from, so it can be re-decided — e.g. after correcting threshold settings. Already-submitted review scores are preserved.")}
                            </p>
                        )}
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                            placeholder={tr("Reason (required)…")} rows={3}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none resize-none focus:ring-2 focus:ring-blue-500" />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setDialog(null); setReason(''); }}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{tr("Cancel")}</button>
                            <button onClick={confirmAction} disabled={submitting}
                                className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-60 ${
                                    dialog === 'reopen' ? 'bg-indigo-600 hover:bg-indigo-700'
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
                        <h2 className="text-base font-semibold mb-2">{tr("Approve Proposal")}</h2>
                        <p className="text-sm text-gray-500 mb-5">
                            {tr("Approving will move this proposal to")} <strong>{tr("Validated")}</strong> {tr("status. Continue?")}
                        </p>
                        {proposal.anonymity_status === 'issues' && (
                            <p className="-mt-2 mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                {tr("The anonymity check found identifying details in this proposal. Reviewers may be able to tell who wrote it.")}
                            </p>
                        )}
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDialog(null)}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{tr("Cancel")}</button>
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
