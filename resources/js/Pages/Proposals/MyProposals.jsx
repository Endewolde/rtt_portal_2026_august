import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import {
    FolderOpen, Pencil, Search, Trophy, AlertCircle,
    Download, Users, DollarSign, FileSignature, Trash2,
    GitBranch, ChevronDown, ChevronUp, Loader2, Copy,
    CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import ProposalTimeline from '../../Components/ProposalTimeline';
import { downloadFile } from '../../lib/download';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useAuth } from '../../hooks/useAuth';
import { useFeature } from '../../hooks/useFeature';
import api, { del, post } from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';

const REVIEW_STATUSES  = ['submitted', 'validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence', 'accepted'];
const AWARDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];

// ─── Co-PI invitation banner ──────────────────────────────────────────────────

function InvitationResponseBanner({ proposal, onRespond }) {
    const [responding, setResponding] = useState(null); // 'accepted' | 'declined'

    const respond = async (response) => {
        setResponding(response);
        try {
            await onRespond(proposal.my_proposal_member_id, response, proposal.id);
        } finally {
            setResponding(null);
        }
    };

    return (
        <div className="mb-3 px-3 py-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
                <Clock size={13} className="text-amber-500 shrink-0" />
                <p className="text-xs font-semibold text-amber-800">Invitation Pending — Your Response Required</p>
            </div>
            <p className="text-xs text-amber-700">
                You have been invited as a co-investigator on this proposal. Please accept or decline to let the PI know.
            </p>
            <div className="flex gap-2 pt-0.5">
                <button
                    onClick={() => respond('accepted')}
                    disabled={!!responding}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                    {responding === 'accepted'
                        ? <Loader2 size={12} className="animate-spin" />
                        : <CheckCircle2 size={12} />}
                    Accept
                </button>
                <button
                    onClick={() => respond('declined')}
                    disabled={!!responding}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-600 border border-red-300 rounded-lg text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                    {responding === 'declined'
                        ? <Loader2 size={12} className="animate-spin" />
                        : <XCircle size={12} />}
                    Decline
                </button>
            </div>
        </div>
    );
}

// ─── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({ proposal, isCoPI, userId, pendingBudgetIds, onViewReason, onDelete, onClone, onRespond }) {
    const isDraft    = proposal.status === 'draft';
    const isReview   = REVIEW_STATUSES.includes(proposal.status);
    const isAwarded  = AWARDED_STATUSES.includes(proposal.status);
    const isRejected = proposal.status === 'rejected';
    const hasPending = pendingBudgetIds.has(proposal.id);

    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineData, setTimelineData] = useState(null);
    const [timelineLoading, setTimelineLoading] = useState(false);

    const toggleTimeline = async () => {
        if (!timelineOpen && !timelineData) {
            setTimelineLoading(true);
            try {
                const r = await api.get(`/proposals/${proposal.id}/workflow-history`);
                setTimelineData(r.data?.data ?? []);
            } catch { setTimelineData([]); }
            finally { setTimelineLoading(false); }
        }
        setTimelineOpen(v => !v);
    };

    const membership = (proposal.members ?? []).find(m => m.user_id === userId);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            {/* Status colour bar */}
            <div className={`h-1.5 ${
                isAwarded  ? 'bg-emerald-500' :
                isRejected ? 'bg-red-400' :
                isDraft    ? 'bg-gray-300' : 'bg-blue-500'
            }`} />

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                {proposal.tracker_number}
                            </span>

                            {isCoPI ? (
                                <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium border border-purple-200">
                                    <Users size={10} /> Co-Investigator
                                </span>
                            ) : (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium border border-blue-200">
                                    PI
                                </span>
                            )}

                            <StatusBadge status={proposal.status} />
                        </div>

                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
                            {proposal.title || <span className="italic text-gray-400">Untitled Draft</span>}
                        </h3>
                    </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                    {proposal.academic_year && <span>{proposal.academic_year}</span>}
                    {proposal.category && <span className="capitalize">{getCategoryLabel(proposal.category)}</span>}
                    {proposal.college?.name && <span>{proposal.college.name}</span>}
                    {proposal.submitted_at && <span>Submitted {formatDate(proposal.submitted_at)}</span>}

                    {isCoPI && membership && (
                        <span className="font-medium text-purple-600">
                            Contribution: {membership.contribution_percentage}%
                        </span>
                    )}
                    {!isCoPI && proposal.co_investigators_count > 0 && (
                        <span>
                            {proposal.co_investigators_count} Co-PI{proposal.co_investigators_count !== 1 ? 's' : ''}
                        </span>
                    )}
                    {proposal.budget_total > 0 && (
                        <span>Budget: {formatCurrency(proposal.budget_total)}</span>
                    )}
                </div>

                {/* Rejection reason */}
                {isRejected && proposal.rejection_reason && (
                    <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection Reason</p>
                        <p className="text-xs text-red-600 line-clamp-2">{proposal.rejection_reason}</p>
                    </div>
                )}

                {/* Pending signature alert */}
                {hasPending && (
                    <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                        <FileSignature size={13} className="text-amber-500 shrink-0" />
                        <p className="text-xs font-medium text-amber-700">Your signature is required on a budget request</p>
                    </div>
                )}

                {/* Co-PI invitation response */}
                {isCoPI && proposal.my_invitation_status === 'pending' && onRespond && (
                    <InvitationResponseBanner
                        proposal={proposal}
                        onRespond={onRespond}
                    />
                )}
                {isCoPI && proposal.my_invitation_status === 'declined' && (
                    <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                        <XCircle size={13} className="text-red-500 shrink-0" />
                        <p className="text-xs font-medium text-red-700">You declined this co-investigator invitation</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                    {/* Draft — only PI can continue or delete */}
                    {!isCoPI && isDraft && !proposal.rejection_reason && (
                        <Link href={`/proposals/create?resume=${proposal.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                            <Pencil size={12} /> Continue
                        </Link>
                    )}
                    {!isCoPI && isDraft && proposal.rejection_reason && (
                        <Link href={`/proposals/create?resume=${proposal.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600">
                            <Pencil size={12} /> Fix &amp; Resubmit
                        </Link>
                    )}
                    {!isCoPI && isDraft && (
                        <button onClick={() => onDelete(proposal)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">
                            <Trash2 size={12} /> Delete
                        </button>
                    )}

                    {/* Track */}
                    {isReview && proposal.tracker_number && (
                        <Link href={`/tracker?number=${proposal.tracker_number}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
                            <Search size={12} /> Track
                        </Link>
                    )}

                    {/* Award / funded */}
                    {isAwarded && (
                        <Link href={`/proposals/${proposal.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                            <Trophy size={12} /> View Award
                        </Link>
                    )}
                    {proposal.status === 'funded' && proposal.award && (
                        <button
                            onClick={() => downloadFile(
                                `/proposals/${proposal.id}/award-letter/download`,
                                `Award-Letter-${proposal.award.grant_reference}.pdf`
                            ).catch(() => {})}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-medium hover:bg-emerald-100">
                            <Download size={12} /> Award Letter
                        </button>
                    )}

                    {/* Budget — funded proposals */}
                    {AWARDED_STATUSES.slice(0, 3).includes(proposal.status) && (
                        <Link href="/budget-requests"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700">
                            <DollarSign size={12} /> Budget
                        </Link>
                    )}

                    {/* Sign budget — co-PI pending signature */}
                    {hasPending && (
                        <Link href="/budget-requests"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600">
                            <FileSignature size={12} /> Sign Budget
                        </Link>
                    )}

                    {/* Rejection reason modal trigger */}
                    {isRejected && proposal.rejection_reason && (
                        <button onClick={() => onViewReason(proposal)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">
                            <AlertCircle size={12} /> View Reason
                        </button>
                    )}

                    {/* Timeline toggle */}
                    {!isDraft && (
                        <button onClick={toggleTimeline}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
                            {timelineLoading
                                ? <Loader2 size={12} className="animate-spin" />
                                : <GitBranch size={12} />
                            }
                            History
                            {timelineOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                    )}

                    {/* Clone — available to PI on non-draft proposals */}
                    {!isCoPI && !isDraft && (
                        <button onClick={() => onClone(proposal)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
                            <Copy size={12} /> Clone
                        </button>
                    )}

                    {/* View details — always shown */}
                    <Link href={`/proposals/${proposal.id}`}
                        className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
                        View Details
                    </Link>
                </div>

                {/* Workflow history */}
                {timelineOpen && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Workflow History</p>
                        {timelineData?.length > 0
                            ? <ProposalTimeline history={timelineData} currentStatus={proposal.status} />
                            : <p className="text-xs text-gray-400 italic">No workflow history recorded yet.</p>
                        }
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyProposals() {
    const { user }   = useAuth();
    const { error, success }  = useToast();
    const { confirm, Dialog } = useConfirm();
    const [view, setView] = useViewPreference('my_proposals', 'card');

    const [myProposals,  setMyProposals]  = useState([]);
    const [coProposals,  setCoProposals]  = useState([]);
    const [pendingBudgetProposalIds, setPendingBudgetProposalIds] = useState(new Set());
    const [loading,      setLoading]      = useState(true);
    const [activeTab,    setActiveTab]    = useState('all');
    const [reasonModal,  setReasonModal]  = useState(null);

    useEffect(() => {
        Promise.all([
            api.get('/proposals/involved'),
            api.get('/budget-requests'),
        ])
            .then(([propRes, budgetRes]) => {
                const data = propRes.data?.data ?? {};
                setMyProposals(Array.isArray(data.as_pi)    ? data.as_pi    : []);
                setCoProposals(Array.isArray(data.as_co_pi) ? data.as_co_pi : []);

                // Collect proposal IDs where this user has a pending signature
                const budgets   = Array.isArray(budgetRes.data?.data) ? budgetRes.data.data : [];
                const pendingIds = new Set(
                    budgets
                        .filter(br => (br.signatures ?? []).some(
                            s => s.user_id === user?.id && s.status === 'pending'
                        ))
                        .map(br => br.proposal?.id)
                        .filter(Boolean)
                );
                setPendingBudgetProposalIds(pendingIds);
            })
            .catch(() => error('Failed to load your proposals.'))
            .finally(() => setLoading(false));
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDeleteProposal = async (proposal) => {
        const ok = await confirm({
            title:        'Delete this proposal?',
            description:  `"${proposal.title || 'Untitled Draft'}" will be permanently deleted and cannot be recovered.`,
            confirmLabel: 'Delete',
            variant:      'danger',
        });
        if (!ok) return;
        try {
            await del(`/proposals/${proposal.id}`);
            setMyProposals(prev => prev.filter(p => p.id !== proposal.id));
            success('Proposal deleted.');
        } catch (err) {
            error(err.response?.data?.message ?? 'Failed to delete proposal.');
        }
    };

    const { hasSubFeature } = useFeature();
    const showInvitations = hasSubFeature('workflow.co_pi_acceptance');

    const handleRespondInvitation = async (memberId, response, proposalId) => {
        try {
            await post(`/proposal-members/${memberId}/respond-invitation`, { response });
            setCoProposals(prev => prev.map(p =>
                p.id === proposalId
                    ? { ...p, my_invitation_status: response }
                    : p
            ));
            success(response === 'accepted'
                ? 'You have accepted the co-investigator invitation.'
                : 'You have declined the co-investigator invitation.');
        } catch (err) {
            error(err.response?.data?.message ?? 'Failed to record your response.');
        }
    };

    const pendingInvitations = showInvitations
        ? coProposals.filter(p => p.my_invitation_status === 'pending')
        : [];

    const handleCloneProposal = async (proposal) => {
        const ok = await confirm({
            title:        'Clone this proposal?',
            description:  `A new draft copy of "${proposal.title}" will be created in your proposals.`,
            confirmLabel: 'Clone',
        });
        if (!ok) return;
        try {
            const r = await api.post(`/proposals/${proposal.id}/clone`);
            const clone = r.data?.data;
            success(`Proposal cloned as ${clone.tracker_number}. You can find it in your drafts.`);
            // Re-fetch proposals to show the new clone
            setMyProposals(prev => [{ ...clone, status: 'draft' }, ...prev]);
        } catch (err) {
            error(err.response?.data?.message ?? 'Failed to clone proposal.');
        }
    };

    const allProposals = [...myProposals, ...coProposals];
    const coProposalIds = new Set(coProposals.map(p => p.id));
    const pendingCount  = pendingBudgetProposalIds.size;

    const tabSets = {
        all:      allProposals,
        mine:     myProposals,
        co_pi:    coProposals,
        draft:    allProposals.filter(p => p.status === 'draft'),
        review:   allProposals.filter(p => REVIEW_STATUSES.includes(p.status)),
        awarded:  allProposals.filter(p => AWARDED_STATUSES.includes(p.status)),
        rejected: allProposals.filter(p => p.status === 'rejected'),
    };

    const TABS = [
        { key: 'all',     label: 'All'           },
        { key: 'mine',    label: 'As PI'         },
        { key: 'co_pi',   label: 'As Co-PI'      },
        { key: 'draft',   label: 'Drafts'        },
        { key: 'review',  label: 'Under Review'  },
        { key: 'awarded', label: 'Awarded'       },
        { key: 'rejected',label: 'Rejected'      },
    ].filter(t => t.key === 'all' || tabSets[t.key]?.length > 0);

    const visible = tabSets[activeTab] ?? allProposals;

    return (
        <AppLayout breadcrumb="My Proposals">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Pending invitation alert */}
                {pendingInvitations.length > 0 && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <Clock size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800">
                                {pendingInvitations.length === 1
                                    ? 'You have a pending co-investigator invitation'
                                    : `You have ${pendingInvitations.length} pending co-investigator invitations`}
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Switch to the <strong>As Co-PI</strong> tab to accept or decline.
                            </p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <FolderOpen size={22} className="text-blue-600" /> My Proposals
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {myProposals.length} as PI · {coProposals.length} as Co-Investigator
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <ViewToggle view={view} onChange={setView} />
                        <a
                            href={`/api/v1/calendar/export?token=${localStorage.getItem('rtt_token') ?? ''}`}
                            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <Download size={12} />
                            Calendar
                        </a>
                        <Link href="/proposals/create"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm">
                            + New Application
                        </Link>
                    </div>
                </div>

                {/* Pending signature banner */}
                {pendingCount > 0 && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl p-4">
                        <FileSignature size={20} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-amber-800">
                                {pendingCount} pending budget request signature{pendingCount > 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Budget requests on proposals you're part of are waiting for your signature.
                            </p>
                        </div>
                        <Link href="/budget-requests"
                            className="shrink-0 text-xs font-semibold text-amber-800 border border-amber-400 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors">
                            Go to Budget Requests →
                        </Link>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                activeTab === tab.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label}
                            {(tabSets[tab.key]?.length ?? 0) > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                    activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                                }`}>
                                    {tabSets[tab.key]?.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                        <FolderOpen size={40} className="mx-auto text-gray-300 mb-3" />
                        <h3 className="text-gray-600 font-medium mb-1">No proposals here</h3>
                        <p className="text-sm text-gray-400">
                            {activeTab === 'all'
                                ? 'You have no proposals yet.'
                                : 'No proposals match this filter.'}
                        </p>
                        {activeTab === 'all' && (
                            <Link href="/proposals/create"
                                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                                Start New Application
                            </Link>
                        )}
                    </div>
                ) : view === 'table' ? (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <ProposalTable
                            proposals={visible}
                            showColumns={['tracker', 'title', 'category', 'status', 'date']}
                            actions={(p) => (
                                <div className="flex items-center gap-1.5 justify-end">
                                    {p.status === 'draft' && !coProposalIds.has(p.id) && (
                                        <Link href={`/proposals/create?resume=${p.id}`}
                                            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                                            {p.rejection_reason ? 'Fix & Resubmit' : 'Continue'}
                                        </Link>
                                    )}
                                    {coProposalIds.has(p.id) && (
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Co-PI</span>
                                    )}
                                    {p.status === 'draft' && !coProposalIds.has(p.id) && (
                                        <button onClick={() => handleDeleteProposal(p)}
                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete draft">
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                    <Link href={`/proposals/${p.id}`}
                                        className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                                        View
                                    </Link>
                                </div>
                            )}
                            emptyMessage="No proposals here."
                        />
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                        {visible.map(p => (
                            <ProposalCard
                                key={p.id}
                                proposal={p}
                                isCoPI={coProposalIds.has(p.id)}
                                userId={user?.id}
                                pendingBudgetIds={pendingBudgetProposalIds}
                                onViewReason={setReasonModal}
                                onDelete={handleDeleteProposal}
                                onClone={handleCloneProposal}
                                onRespond={showInvitations ? handleRespondInvitation : null}
                            />
                        ))}
                    </div>
                )}
            </div>

            <Dialog />

            {/* Rejection reason modal */}
            {reasonModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-base font-semibold text-gray-900 mb-2">Rejection Reason</h3>
                        <p className="text-xs text-gray-500 mb-3 font-mono">{reasonModal.tracker_number}</p>
                        <p className="text-sm text-gray-700 bg-red-50 border border-red-200 rounded-xl p-4 leading-relaxed">
                            {reasonModal.rejection_reason}
                        </p>
                        <button onClick={() => setReasonModal(null)}
                            className="mt-4 w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
