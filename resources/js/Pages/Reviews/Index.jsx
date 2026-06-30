import { useState, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import {
    ClipboardCheck, Clock, AlertCircle, Download,
    CheckCircle2, ChevronRight, BookOpen, EyeOff,
    Presentation, Calendar, Shield, Star, ChevronDown, ChevronUp,
    MessageSquare, Loader2, ShieldAlert,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import AppLayout from '../../Layouts/AppLayout';
import { useToast } from '../../Components/Toast';
import { useFeature } from '../../hooks/useFeature';
import api from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';

const STATUS_META = {
    pending:     { label: 'Pending',     bg: 'bg-amber-100',   text: 'text-amber-700',  dot: 'bg-amber-400'   },
    accepted:    { label: 'Accepted',    bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500'    },
    in_progress: { label: 'In Progress', bg: 'bg-violet-100',  text: 'text-violet-700', dot: 'bg-violet-500'  },
    submitted:   { label: 'Submitted',   bg: 'bg-emerald-100', text: 'text-emerald-700',dot: 'bg-emerald-500' },
    declined:    { label: 'Declined',    bg: 'bg-red-100',     text: 'text-red-700',    dot: 'bg-red-400'     },
};

const TABS = [
    {
        key: 'blind',
        label: 'Blind Review',
        icon: EyeOff,
        color: 'violet',
        description: "Evaluate proposals anonymously without knowing the PI's identity.",
        filter: a => (a.evaluation_type?.name ?? '').startsWith('blind_review') && a.status !== 'submitted',
    },
    {
        key: 'defence',
        label: 'Open Defence',
        icon: Presentation,
        color: 'blue',
        description: 'Attend and score proposals presented in open defence sessions.',
        filter: a => (a.evaluation_type?.name ?? '').startsWith('open_defence') && a.status !== 'submitted',
    },
    {
        key: 'completed',
        label: 'Completed',
        icon: CheckCircle2,
        color: 'emerald',
        description: 'Your submitted review scores and recommendations.',
        filter: a => a.status === 'submitted',
    },
];

function getDaysRemaining(dueDate) {
    if (!dueDate) return null;
    return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dueDate }) {
    const days = getDaysRemaining(dueDate);
    if (days === null) return null;
    if (days < 0) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
            <AlertCircle size={11} className="animate-pulse" /> Overdue {Math.abs(days)}d
        </span>
    );
    if (days === 0) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
            <Clock size={11} className="animate-pulse" /> Due today
        </span>
    );
    if (days <= 3) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
            <Clock size={11} /> {days}d left
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
            <Calendar size={11} /> {formatDate(dueDate)}
        </span>
    );
}

function urgencyStripe(daysLeft, isDone) {
    if (isDone)            return 'border-l-4 border-l-emerald-400';
    if (daysLeft === null) return 'border-l-4 border-l-gray-200';
    if (daysLeft < 0)      return 'border-l-4 border-l-red-400';
    if (daysLeft <= 3)     return 'border-l-4 border-l-orange-400';
    return 'border-l-4 border-l-indigo-300';
}

function StatsRow({ items }) {
    const total     = items.length;
    const pending   = items.filter(a => ['pending', 'in_progress', 'accepted'].includes(a.status)).length;
    const completed = items.filter(a => a.status === 'submitted').length;
    const overdue   = items.filter(a => {
        const d = getDaysRemaining(a.due_date);
        return d !== null && d < 0 && a.status !== 'submitted';
    }).length;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
                { label: 'Total',     value: total,     bg: 'bg-slate-50',    text: 'text-slate-700',   border: 'border-slate-200'   },
                { label: 'Pending',   value: pending,   bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200'   },
                { label: 'Completed', value: completed, bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
                { label: 'Overdue',   value: overdue,   bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200'     },
            ].map(stat => (
                <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-2xl px-4 py-3.5 flex items-center justify-between`}>
                    <span className="text-xs font-medium text-gray-500">{stat.label}</span>
                    <span className={`text-2xl font-extrabold ${stat.text} tabular-nums`}>{stat.value}</span>
                </div>
            ))}
        </div>
    );
}

function ScoreBar({ score, max }) {
    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
    const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400';
    return (
        <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-gray-700 w-10 text-right tabular-nums">{score}/{max}</span>
        </div>
    );
}

function CompletedCard({ assignment }) {
    const [expanded, setExpanded] = useState(false);
    const isDefence   = (assignment.evaluation_type?.name ?? '').startsWith('open_defence');
    const scores      = assignment.scores ?? [];
    const totalScore  = scores.reduce((s, sc) => s + (sc.score ?? 0), 0);
    const maxScore    = scores.reduce((s, sc) => s + (sc.evaluation_question?.max_score ?? 0), 0);
    const pct         = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : null;
    const recommendation = scores.find(s => s.recommendation)?.recommendation;
    const comments    = scores.filter(s => s.comment);

    const recColor = recommendation === 'accept'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : recommendation === 'reject'
            ? 'bg-red-100 text-red-700 border-red-200'
            : recommendation === 'revise'
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-gray-100 text-gray-600 border-gray-200';

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-emerald-400">
            <div className="p-5">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isDefence ? 'bg-blue-100' : 'bg-violet-100'}`}>
                        {isDefence
                            ? <Presentation size={18} className="text-blue-600" />
                            : <EyeOff size={18} className="text-violet-600" />
                        }
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                {assignment.proposal?.tracker_number || 'N/A'}
                            </span>
                            <span className="text-xs text-gray-400">{isDefence ? 'Open Defence' : 'Blind Review'}</span>
                            {recommendation && (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${recColor}`}>
                                    {recommendation}
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1">
                            {assignment.proposal?.title || 'Untitled Proposal'}
                        </h3>
                        <p className="text-xs text-gray-400">
                            Submitted {assignment.submitted_at ? formatDate(assignment.submitted_at) : '—'}
                            {assignment.proposal?.college?.name && (
                                <span className="ml-2 text-gray-300">· {assignment.proposal.college.name}</span>
                            )}
                        </p>
                    </div>

                    {/* Score summary */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        {pct !== null && (
                            <div className="text-right">
                                <div className="text-xl font-extrabold text-emerald-600 tabular-nums leading-none">{pct}%</div>
                                <div className="text-[10px] text-gray-400 mt-0.5">{totalScore}/{maxScore} pts</div>
                            </div>
                        )}
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {expanded ? 'Hide' : 'Details'}
                        </button>
                    </div>
                </div>

                {/* Expandable score breakdown */}
                {expanded && scores.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5">
                        {scores.map((sc, i) => (
                            <div key={i}>
                                <div className="flex items-center gap-3">
                                    <p className="text-xs text-gray-600 flex-1 leading-snug">
                                        {sc.evaluation_question?.question_text ?? `Question ${i + 1}`}
                                    </p>
                                    <ScoreBar score={sc.score ?? 0} max={sc.evaluation_question?.max_score ?? 5} />
                                </div>
                                {sc.comment && (
                                    <div className="flex items-start gap-1.5 mt-1 ml-0 pl-0">
                                        <MessageSquare size={11} className="text-gray-300 mt-0.5 shrink-0" />
                                        <p className="text-[11px] text-gray-400 italic leading-snug">{sc.comment}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                        {comments.length === 0 && (
                            <p className="text-xs text-gray-400 italic">No written comments provided.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function isNewAssignment(assignment) {
    if (assignment.status !== 'pending') return false;
    if (!assignment.assigned_at) return false;
    const hoursOld = (Date.now() - new Date(assignment.assigned_at)) / (1000 * 60 * 60);
    return hoursOld <= 168; // 7 days
}

function CoiDeclarationModal({ assignment, onDeclared, onClose }) {
    const { error } = useToast();
    const [confirmed, setConfirmed] = useState(false);
    const [declaring, setDeclaring] = useState(false);

    const handleProceed = async () => {
        setDeclaring(true);
        try {
            await api.post(`/review-assignments/${assignment.id}/declare-coi`);
            onDeclared();
        } catch (err) {
            error(err?.response?.data?.message ?? 'Failed to record declaration.');
        } finally {
            setDeclaring(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-linear-to-r from-violet-600 to-indigo-600 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <ShieldAlert size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Conflict of Interest Declaration</h2>
                            <p className="text-xs text-white/80 mt-0.5">Required before accessing this review</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Proposal</p>
                        <p className="text-sm font-semibold text-gray-900">
                            {assignment.proposal?.tracker_number} — {assignment.proposal?.title || 'Untitled'}
                        </p>
                    </div>

                    <p className="text-sm text-gray-600 leading-relaxed">
                        Before proceeding, you must declare whether you have any conflict of interest with this proposal or its investigators.
                    </p>

                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={e => setConfirmed(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-relaxed">
                            I confirm that I have <strong>no conflict of interest</strong> with this proposal and that I can review it fairly and objectively.
                        </span>
                    </label>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleProceed}
                            disabled={!confirmed || declaring}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
                        >
                            {declaring ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
                            Declare &amp; Proceed
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

function AssignmentCard({ assignment, tabKey, onCoiDeclared }) {
    const daysLeft  = getDaysRemaining(assignment.due_date);
    const isDone    = assignment.status === 'submitted';
    const isNew     = isNewAssignment(assignment);
    const meta      = STATUS_META[assignment.status] ?? STATUS_META.pending;
    const stripe    = urgencyStripe(daysLeft, isDone);
    const isDefence = tabKey === 'defence';
    const { hasSubFeature } = useFeature();

    const [showCoiModal, setShowCoiModal] = useState(false);
    const needsCoiDeclaration = hasSubFeature('workflow.coi_declaration') && !assignment.coi_declared_at;

    const handleScoreClick = (e) => {
        if (needsCoiDeclaration) {
            e.preventDefault();
            setShowCoiModal(true);
        }
    };

    const handleCoiDeclared = () => {
        setShowCoiModal(false);
        onCoiDeclared(assignment.id);
        router.visit(`/reviews/${assignment.id}/score`);
    };

    return (
        <div className={`relative bg-white rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md ${stripe} ${isNew ? 'ring-2 ring-amber-300' : ''}`}>
            {isNew && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    NEW
                </div>
            )}
            <div className="p-5">
                <div className="flex items-start gap-4">
                    {/* Type icon */}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isDone
                            ? 'bg-emerald-100'
                            : isDefence ? 'bg-blue-100' : 'bg-violet-100'
                    }`}>
                        {isDone
                            ? <CheckCircle2 size={18} className="text-emerald-600" />
                            : isDefence
                                ? <Presentation size={18} className="text-blue-600" />
                                : <EyeOff size={18} className="text-violet-600" />
                        }
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                {assignment.proposal?.tracker_number || 'N/A'}
                            </span>
                            <span className="text-xs text-gray-400">
                                {getCategoryLabel(assignment.proposal?.category)}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1 pr-4">
                            {assignment.proposal?.title || 'Untitled Proposal'}
                        </h3>
                        <p className="text-xs text-gray-400">
                            {assignment.evaluation_type?.label || assignment.evaluation_type?.name || 'Evaluation'}
                            {assignment.proposal?.college?.name && (
                                <span className="ml-2 text-gray-300">· {assignment.proposal.college.name}</span>
                            )}
                        </p>
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                        <DueBadge dueDate={assignment.due_date} />
                        {isDone ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                                <CheckCircle2 size={13} /> Submitted
                            </span>
                        ) : (
                            <Link
                                href={`/reviews/${assignment.id}/score`}
                                onClick={handleScoreClick}
                                className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm ${
                                    isDefence
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                        : 'bg-violet-600 hover:bg-violet-700 shadow-violet-200'
                                }`}
                            >
                                <ClipboardCheck size={13} />
                                Score Review
                                <ChevronRight size={13} />
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {showCoiModal && (
                <CoiDeclarationModal
                    assignment={assignment}
                    onDeclared={handleCoiDeclared}
                    onClose={() => setShowCoiModal(false)}
                />
            )}
        </div>
    );
}

export default function ReviewIndex() {
    const { error } = useToast();
    const { app_settings } = usePage().props;
    const [allAssignments, setAllAssignments] = useState([]);
    const [yearFilter, setYearFilter]         = useState(app_settings?.current_academic_year ?? '');
    const [loading, setLoading]               = useState(true);
    const [activeTab, setActiveTab]           = useState('blind');

    const handleCoiDeclared = (assignmentId) => {
        setAllAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, coi_declared_at: new Date().toISOString() } : a
        ));
    };

    useEffect(() => {
        api.get('/review-assignments/my')
            .then(res => setAllAssignments(res.data?.data ?? []))
            .catch(() => error('Failed to load your review assignments.'))
            .finally(() => setLoading(false));
    }, []);

    const availableYears = [...new Set(allAssignments.map(a => a.proposal?.academic_year).filter(Boolean))].sort().reverse();
    const assignments    = yearFilter ? allAssignments.filter(a => a.proposal?.academic_year === yearFilter) : allAssignments;

    const currentTab  = TABS.find(t => t.key === activeTab);
    const tabItems    = currentTab ? assignments.filter(currentTab.filter) : [];
    const allTotal    = allAssignments.length;

    const getCount   = tab => assignments.filter(tab.filter).length;
    const getPending = tab => assignments.filter(tab.filter).filter(a => ['pending', 'in_progress', 'accepted'].includes(a.status)).length;
    const getNew     = tab => assignments.filter(tab.filter).filter(isNewAssignment).length;

    if (loading) {
        return (
            <AppLayout breadcrumb="Reviews">
                <div className="p-8 flex items-center justify-center min-h-64">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-9 h-9 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-400">Loading assignments…</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumb="Reviews">
            <div className="p-6 max-w-5xl mx-auto space-y-6">

                {/* ── Page header ─────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Shield size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">My Review Assignments</h1>
                            <p className="text-sm text-gray-400 mt-0.5">
                                {allTotal} total assignment{allTotal !== 1 ? 's' : ''} across all phases
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {availableYears.length > 1 && (
                            <select
                                value={yearFilter}
                                onChange={e => { setYearFilter(e.target.value); setActiveTab('blind'); }}
                                className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            >
                                <option value="">All Years</option>
                                {availableYears.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        )}
                        <a
                            href={`/api/v1/calendar/export?token=${localStorage.getItem('rtt_token') ?? ''}`}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-colors"
                        >
                            <Download size={13} /> Export iCal
                        </a>
                    </div>
                </div>

                {/* ── Empty state (no assignments at all) ──────────────────── */}
                {allTotal === 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-14 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ClipboardCheck size={28} className="text-gray-300" />
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1.5">No assignments yet</h3>
                        <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
                            You have no review assignments at the moment.
                            Check back after proposals are assigned for review.
                        </p>
                    </div>
                )}

                {allTotal > 0 && (
                    <>
                        {/* ── Tabs ─────────────────────────────────────────── */}
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
                            {TABS.map(tab => {
                                const count    = getCount(tab);
                                const pending  = getPending(tab);
                                const newCount = getNew(tab);
                                const isActive = activeTab === tab.key;
                                const Icon = tab.icon;

                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                            isActive
                                                ? 'bg-white shadow-sm text-gray-900'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        <Icon size={15} className={isActive
                                            ? tab.color === 'violet' ? 'text-violet-600'
                                                : tab.color === 'emerald' ? 'text-emerald-600'
                                                : 'text-blue-600'
                                            : 'text-gray-400'} />
                                        {tab.label}
                                        {count > 0 && (
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                                                isActive
                                                    ? tab.color === 'violet'  ? 'bg-violet-100 text-violet-700'
                                                    : tab.color === 'emerald' ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                    : 'bg-gray-200 text-gray-600'
                                            }`}>
                                                {count}
                                            </span>
                                        )}
                                        {newCount > 0 && !isActive && (
                                            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                                            </span>
                                        )}
                                        {pending > 0 && !isActive && newCount === 0 && (
                                            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Tab description + context banner ─────────────── */}
                        {currentTab && (
                            <div className={`rounded-2xl border px-5 py-4 flex items-start gap-3 ${
                                activeTab === 'blind'    ? 'bg-violet-50 border-violet-200' :
                                activeTab === 'defence'  ? 'bg-blue-50 border-blue-200' :
                                                           'bg-emerald-50 border-emerald-200'
                            }`}>
                                <currentTab.icon size={18} className={`mt-0.5 shrink-0 ${
                                    activeTab === 'blind'   ? 'text-violet-500' :
                                    activeTab === 'defence' ? 'text-blue-500' :
                                                              'text-emerald-500'
                                }`} />
                                <div>
                                    <p className={`text-sm font-semibold ${
                                        activeTab === 'blind'   ? 'text-violet-800' :
                                        activeTab === 'defence' ? 'text-blue-800' :
                                                                  'text-emerald-800'
                                    }`}>
                                        {currentTab.label}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${
                                        activeTab === 'blind'   ? 'text-violet-600' :
                                        activeTab === 'defence' ? 'text-blue-600' :
                                                                  'text-emerald-600'
                                    }`}>
                                        {currentTab.description}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Stats (active/pending tabs only) ─────────────── */}
                        {tabItems.length > 0 && activeTab !== 'completed' && <StatsRow items={tabItems} />}

                        {/* ── Empty tab state ────────────────────────────────── */}
                        {tabItems.length === 0 && (
                            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
                                <currentTab.icon size={28} className="text-gray-300 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-500">No {currentTab.label} assignments</p>
                                <p className="text-xs text-gray-400 mt-1">Assignments for this phase will appear here.</p>
                            </div>
                        )}

                        {/* ── Assignment cards ────────────────────────────────── */}
                        {tabItems.length > 0 && activeTab !== 'completed' && (
                            <div className="space-y-3">
                                {tabItems.map(assignment => (
                                    <AssignmentCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        tabKey={activeTab}
                                        onCoiDeclared={handleCoiDeclared}
                                    />
                                ))}
                            </div>
                        )}

                        {/* ── Completed review cards ───────────────────────── */}
                        {tabItems.length > 0 && activeTab === 'completed' && (
                            <div className="space-y-3">
                                {tabItems.map(assignment => (
                                    <CompletedCard key={assignment.id} assignment={assignment} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
