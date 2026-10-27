import { useState, useEffect } from 'react';
import { translate as tr, Trans } from '../../lib/i18n'
import { Link, router } from '@inertiajs/react';
import {
    ClipboardCheck, Clock, AlertCircle, Download,
    CheckCircle2, ChevronRight, BookOpen, EyeOff,
    Presentation, Calendar, Shield, Star, ChevronDown, ChevronUp,
    MessageSquare, Loader2, ShieldAlert, Send, ExternalLink, Lock, CalendarDays, Award,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import AppLayout from '../../Layouts/AppLayout';
import ReviewCertificatesCard from '../../Components/ReviewCertificatesCard';
import ReviewQualityCard from '../../Components/ReviewQualityCard';
import ReviewerAgreementModal from '../../Components/ReviewerAgreementModal';
import { useToast } from '../../Components/Toast';
import { useFeature } from '../../hooks/useFeature';
import api from '../../lib/api';
import { cn, formatDate, getCategoryLabel } from '../../lib/utils';

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
        key: 'abstracts',
        label: 'Abstract Review',
        icon: BookOpen,
        color: 'amber',
        description: 'Score conference abstracts assigned to you.',
    },
    {
        key: 'completed',
        label: 'Completed',
        icon: CheckCircle2,
        color: 'emerald',
        description: 'Your submitted review scores and recommendations.',
        filter: a => a.status === 'submitted',
    },
    {
        key: 'record',
        label: 'My record',
        icon: Award,
        color: 'amber',
        description: 'How the office rated your reviews, and your certificates of review service.',
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
            <AlertCircle size={11} className="animate-pulse" /> {tr("Overdue :daysd", { days: Math.abs(days) })}
        </span>
    );
    if (days === 0) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
            <Clock size={11} className="animate-pulse" /> {tr("Due today")}
        </span>
    );
    if (days <= 3) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
            <Clock size={11} /> {tr(":daysd left", { days: days })}
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
            <Calendar size={11} /> {formatDate(dueDate)}
        </span>
    );
}

/** The colour of a card's edge: done, overdue, due soon, or on track. */
function urgencyStripe(daysLeft, isDone) {
    if (isDone)            return 'bg-emerald-400';
    if (daysLeft === null) return 'bg-gray-200';
    if (daysLeft < 0)      return 'bg-red-500';
    if (daysLeft <= 3)     return 'bg-orange-400';
    return 'bg-indigo-400';
}

/** A progress ring: share of something done, with the share in the middle. */
function ProgressRing({ value, size = 88, stroke = 8, track = 'rgba(255,255,255,0.2)', color = '#fff', children }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={`${Math.max(0, Math.min(1, value)) * c} ${c}`} className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">{children}</div>
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

// Mirrors the backend's ReviewScoreService::calculateWeightedDisplay(): when every
// answered category has a weight, the displayed total is the weighted sum out of the
// categories' combined weight (e.g. out of 100), not a flat sum of raw question points.
function weightedScoreDisplay(scores) {
    if (scores.length === 0) return { earned: 0, max: 0 };

    const byCategory = new Map();
    scores.forEach(sc => {
        const catId = sc.evaluation_question?.evaluation_category_id ?? 'none';
        if (!byCategory.has(catId)) byCategory.set(catId, []);
        byCategory.get(catId).push(sc);
    });
    const categories = Array.from(byCategory.values());
    const hasWeights = categories.every(cs => (cs[0].evaluation_question?.category?.weight ?? 0) > 0);

    if (hasWeights) {
        let weightedSum = 0;
        let totalWeight = 0;
        categories.forEach(cs => {
            const weight    = cs[0].evaluation_question.category.weight;
            const catEarned = cs.reduce((s, sc) => s + (sc.score ?? 0), 0);
            const catMax    = cs.reduce((s, sc) => s + (sc.evaluation_question?.max_score ?? 0), 0);
            const catPct    = catMax > 0 ? catEarned / catMax : 0;
            weightedSum += catPct * weight;
            totalWeight += weight;
        });
        return { earned: Math.round(weightedSum * 100) / 100, max: totalWeight };
    }

    return {
        earned: scores.reduce((s, sc) => s + (sc.score ?? 0), 0),
        max: scores.reduce((s, sc) => s + (sc.evaluation_question?.max_score ?? 0), 0),
    };
}

function CompletedCard({ assignment }) {
    const [expanded, setExpanded] = useState(false);
    const isDefence   = (assignment.evaluation_type?.name ?? '').startsWith('open_defence');
    const scores      = assignment.scores ?? [];
    const { earned: totalScore, max: maxScore } = weightedScoreDisplay(scores);
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
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
            <span className="absolute inset-y-0 left-0 w-1 bg-emerald-400" />
            <div className="p-5 pl-6">
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
                            <div className="flex items-center gap-2.5">
                                <span className="text-right text-[10px] leading-tight text-gray-400">{tr(":totalScore/:maxScore pts", { totalScore: totalScore, maxScore: maxScore })}</span>
                                <ProgressRing value={pct / 100} size={48} stroke={5} track="#eef0f3" color={pct >= 70 ? '#059669' : pct >= 50 ? '#4f46e5' : '#d97706'}>
                                    <span className="text-[11px] font-bold tabular-nums text-gray-900">{pct}%</span>
                                </ProgressRing>
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
                            <p className="text-xs text-gray-400 italic">{tr("No written comments provided.")}</p>
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

function CoiDeclarationModal({ assignment, onDeclared, onConflictReported, onClose }) {
    const { error, success } = useToast();
    const [confirmed, setConfirmed] = useState(false);
    const [declaring, setDeclaring] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [showConflictForm, setShowConflictForm] = useState(false);
    const [reason, setReason] = useState('');

    const handleProceed = async () => {
        setDeclaring(true);
        try {
            await api.post(`/review-assignments/${assignment.id}/declare-coi`, { has_conflict: false });
            onDeclared();
        } catch (err) {
            error(err?.response?.data?.message ?? 'Failed to record declaration.');
        } finally {
            setDeclaring(false);
        }
    };

    const handleReportConflict = async () => {
        if (reason.trim().length < 5) { error('Briefly describe the conflict.'); return; }
        setReporting(true);
        try {
            await api.post(`/review-assignments/${assignment.id}/declare-coi`, { has_conflict: true, reason });
            success('Conflict reported. The assigning officer has been notified to reassign this review.');
            onConflictReported();
        } catch (err) {
            error(err?.response?.data?.message ?? 'Failed to report the conflict.');
        } finally {
            setReporting(false);
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
                            <h2 className="text-base font-bold text-white">{tr("Conflict of Interest Declaration")}</h2>
                            <p className="text-xs text-white/80 mt-0.5">{tr("Required before accessing this review")}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">{tr("Proposal")}</p>
                        <p className="text-sm font-semibold text-gray-900">
                            {assignment.proposal?.tracker_number} — {assignment.proposal?.title || 'Untitled'}
                        </p>
                    </div>

                    <p className="text-sm text-gray-600 leading-relaxed">
                        {tr("Before proceeding, you must declare whether you have any conflict of interest with this proposal or its investigators — e.g. you're in the same department, have collaborated with the PI before, or have a personal relationship with them.")}
                    </p>

                    {!showConflictForm ? (
                        <>
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={confirmed}
                                    onChange={e => setConfirmed(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 cursor-pointer"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-relaxed">
                                    <Trans text="I confirm that I have <b>no conflict of interest</b> with this proposal and that I can review it fairly and objectively." />
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

                            <button
                                onClick={() => setShowConflictForm(true)}
                                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                            >
                                <AlertCircle size={12} /> {tr("I actually have a conflict — report it instead")}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <label className="block text-xs font-semibold text-red-700 mb-1.5">
                                    {tr("Briefly describe the conflict")}
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    rows={3}
                                    placeholder={tr("e.g. The PI is my former PhD supervisor.")}
                                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                                />
                                <p className="text-xs text-red-600 mt-1.5">
                                    {tr("You will not be able to score this proposal. The officer who assigned you will be notified to reassign it.")}
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleReportConflict}
                                    disabled={reporting || reason.trim().length < 5}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {reporting ? <Loader2 size={15} className="animate-spin" /> : <AlertCircle size={15} />}
                                    Report Conflict
                                </button>
                                <button
                                    onClick={() => setShowConflictForm(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Back
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

function AssignmentCard({ assignment, tabKey, onCoiDeclared, onConflictReported }) {
    const daysLeft  = getDaysRemaining(assignment.due_date);
    const isDone    = assignment.status === 'submitted';
    const isNew     = isNewAssignment(assignment);
    const meta      = STATUS_META[assignment.status] ?? STATUS_META.pending;
    const stripe    = urgencyStripe(daysLeft, isDone);
    const isDefence = tabKey === 'defence';
    const { hasSubFeature } = useFeature();

    const [showCoiModal, setShowCoiModal] = useState(false);
    const hasReportedConflict = assignment.coi_has_conflict === true;
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

    const handleConflictReported = () => {
        setShowCoiModal(false);
        onConflictReported(assignment.id);
    };

    const overdue = !isDone && daysLeft !== null && daysLeft < 0;
    const tone = isDone ? 'emerald' : isDefence ? 'blue' : 'violet';
    const tile = { emerald: 'bg-emerald-100 text-emerald-600', blue: 'bg-blue-100 text-blue-600', violet: 'bg-violet-100 text-violet-600' }[tone];

    return (
        <article id={`assignment-${assignment.id}`}
            className={`group relative scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${overdue ? 'border-red-200' : isNew ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${stripe}`} />
            <div className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${tile}`}>
                        {isDone ? <CheckCircle2 size={20} /> : isDefence ? <Presentation size={20} /> : <EyeOff size={20} />}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-gray-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">{assignment.proposal?.tracker_number || 'N/A'}</span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{getCategoryLabel(assignment.proposal?.category)}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                            </span>
                            {isNew && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> {tr("NEW")}
                                </span>
                            )}
                        </div>
                        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900">{assignment.proposal?.title || 'Untitled Proposal'}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span>{assignment.evaluation_type?.label || assignment.evaluation_type?.name || 'Evaluation'}</span>
                            {assignment.proposal?.college?.name && <span className="text-gray-400">· {assignment.proposal.college.name}</span>}
                            {assignment.assigned_at && <span className="text-gray-400">· {tr("Assigned :date", { date: formatDate(assignment.assigned_at) })}</span>}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                    <DueBadge dueDate={assignment.due_date} />
                    {isDone ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={13} /> {tr("Submitted")}
                        </span>
                    ) : hasReportedConflict ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                            <AlertCircle size={13} /> {tr("Conflict Reported")}
                        </span>
                    ) : (
                        <Link
                            href={`/reviews/${assignment.id}/score`}
                            onClick={handleScoreClick}
                            className={`inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md ${
                                isDefence ? 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700' : 'from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700'
                            }`}
                        >
                            <ClipboardCheck size={14} />
                            {assignment.status === 'in_progress' ? tr("Continue review") : tr("Score Review")}
                            <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
                        </Link>
                    )}
                </div>
            </div>

            {showCoiModal && (
                <CoiDeclarationModal
                    assignment={assignment}
                    onDeclared={handleCoiDeclared}
                    onConflictReported={handleConflictReported}
                    onClose={() => setShowCoiModal(false)}
                />
            )}
        </article>
    );
}

// ─── Abstract Review (conference abstracts, separate from proposal review) ────

const ABSTRACT_TYPE_COLORS = {
    oral:     'bg-sky-50 text-sky-700',
    poster:   'bg-fuchsia-50 text-fuchsia-700',
    workshop: 'bg-teal-50 text-teal-700',
    panel:    'bg-orange-50 text-orange-700',
    other:    'bg-gray-100 text-gray-600',
};

function AbstractTypeBadge({ type }) {
    return (
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', ABSTRACT_TYPE_COLORS[type] ?? ABSTRACT_TYPE_COLORS.other)}>
            {type ?? '—'}
        </span>
    );
}

function AbstractAvatar({ name }) {
    const initials = (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const colors = ['from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600', 'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600', 'from-pink-500 to-rose-600'];
    const gradient = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
    return (
        <div className={cn('w-8 h-8 rounded-full bg-linear-to-br flex items-center justify-center text-white font-bold shrink-0 text-xs', gradient)}>
            {initials}
        </div>
    );
}

const RECOMMENDATION_OPTIONS = [
    { value: 'accept', label: 'Accept', activeColor: 'bg-emerald-600 border-emerald-600 text-white' },
    { value: 'revise', label: 'Revise', activeColor: 'bg-amber-500 border-amber-500 text-white' },
    { value: 'reject', label: 'Reject', activeColor: 'bg-red-600 border-red-600 text-white' },
];

function AbstractReviewCard({ item, onSubmitted, index, total }) {
    const { success, error } = useToast();
    const myReview  = item.reviews?.find(r => r.submitted_at) ?? null;
    const hasReview = Boolean(myReview);

    const [score, setScore]                   = useState(myReview?.score ?? 5);
    const [recommendation, setRecommendation] = useState(myReview?.recommendation ?? '');
    const [comments, setComments]             = useState(myReview?.comments ?? '');
    const [submitting, setSubmitting]         = useState(false);

    const submit = async () => {
        if (!recommendation) { error('Please select a recommendation.'); return; }
        setSubmitting(true);
        try {
            const res = await api.post(`/reviewer/abstracts/${item.id}/review`, { score, recommendation, comments });
            success(res.data?.message ?? 'Review submitted.');
            onSubmitted();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to submit review.');
        }
        setSubmitting(false);
    };

    // Whole class names (not built from parts), so Tailwind generates them.
    const REC_TONE = {
        accept: { box: 'bg-emerald-50 border-emerald-200', icon: 'bg-emerald-600', title: 'text-emerald-800', sub: 'text-emerald-600' },
        reject: { box: 'bg-red-50 border-red-200', icon: 'bg-red-600', title: 'text-red-800', sub: 'text-red-600' },
        revise: { box: 'bg-amber-50 border-amber-200', icon: 'bg-amber-600', title: 'text-amber-800', sub: 'text-amber-600' },
    };
    const tone = REC_TONE[myReview?.recommendation] ?? REC_TONE.revise;

    return (
        <div className={cn(
            'bg-white rounded-2xl border overflow-hidden shadow-sm',
            hasReview ? 'border-gray-100' : 'border-indigo-200 ring-1 ring-indigo-100',
        )}>
            {total > 1 && (
                <div className={cn(
                    'px-6 py-2 flex items-center justify-between text-[11px] font-semibold border-b',
                    hasReview ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100',
                )}>
                    <span>{tr("Abstract :index of :total", { index: index, total: total })}</span>
                    <span>{hasReview ? '✓ Reviewed' : '⏳ Pending review'}</span>
                </div>
            )}

            <div className="px-6 py-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-gray-900 leading-snug">{item.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            {item.conference?.title && (
                                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                                    <BookOpen size={9} /> {item.conference.title}
                                </span>
                            )}
                            {item.presentation_type && <AbstractTypeBadge type={item.presentation_type} />}
                        </div>
                    </div>
                    {hasReview && (
                        <span className="shrink-0 flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full">
                            <CheckCircle2 size={12} /> {tr("Submitted")}
                        </span>
                    )}
                </div>

                {item.submitter_name && (
                    <div className="flex items-center gap-2.5 mb-5 pb-5 border-b border-gray-50">
                        <AbstractAvatar name={item.submitter_name} />
                        <div>
                            <p className="text-sm font-semibold text-gray-800">{item.submitter_name}</p>
                            {item.submitter_affiliation && (
                                <p className="text-xs text-gray-400">{item.submitter_affiliation}</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="mb-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{tr("Abstract")}</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{item.body ?? item.abstract_body ?? '—'}</p>
                </div>

                {item.keywords?.length > 0 && (
                    <div className="mb-5">
                        <div className="flex flex-wrap gap-1.5">
                            {item.keywords.map((kw, i) => (
                                <span key={i} className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full font-medium">#{kw}</span>
                            ))}
                        </div>
                    </div>
                )}

                {item.file_path && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl mb-5">
                        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                            <ClipboardCheck size={15} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-blue-900">{tr("Submitted Document")}</p>
                            <p className="text-[10px] text-blue-500 truncate">{item.file_path.split('/').pop()}</p>
                        </div>
                        <a href={item.file_path} target="_blank" rel="noreferrer"
                            className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-blue-700
                                       bg-white border border-blue-200 px-3 py-1.5 rounded-lg
                                       hover:bg-blue-700 hover:text-white hover:border-blue-700 transition-colors">
                            <ExternalLink size={11} /> {tr("Open")}
                        </a>
                    </div>
                )}

                <div className="border-t border-gray-100 pt-5">
                    {hasReview ? (
                        <div className="space-y-4">
                            <div className={cn('flex items-center gap-3 px-4 py-3 rounded-2xl border', tone.box)}>
                                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', tone.icon)}>
                                    <CheckCircle2 size={17} className="text-white" />
                                </div>
                                <div>
                                    <p className={cn('text-sm font-bold', tone.title)}>
                                        Review submitted — {myReview.recommendation === 'accept' ? 'Accept' :
                                            myReview.recommendation === 'reject' ? 'Reject' : 'Revise'}
                                    </p>
                                    <p className={cn('text-xs mt-0.5', tone.sub)}>
                                        {tr(":created_at · Sent to the committee, which makes the final decision", { created_at: formatDate(myReview.submitted_at ?? myReview.created_at) })}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{tr("Score")}</p>
                                    <p className="text-3xl font-black text-indigo-600 leading-none">{myReview.score}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">/ 10</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{tr("Recommendation")}</p>
                                    <span className={cn(
                                        'inline-block mt-2 text-sm font-bold px-3 py-1.5 rounded-full capitalize',
                                        myReview.recommendation === 'accept' ? 'bg-emerald-100 text-emerald-700' :
                                        myReview.recommendation === 'reject' ? 'bg-red-100 text-red-700' :
                                        'bg-amber-100 text-amber-700',
                                    )}>
                                        {myReview.recommendation === 'accept' ? '✓ Accept' :
                                         myReview.recommendation === 'reject' ? '✗ Reject' : '⟳ Revise'}
                                    </span>
                                </div>
                            </div>

                            {myReview.comments && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-2">{tr("Your Comments")}</p>
                                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100 whitespace-pre-line">
                                        {myReview.comments}
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                <ShieldAlert size={12} className="shrink-0" />
                                {tr("This review is locked. Contact an admin if a correction is needed.")}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{tr("Submit Your Review")}</p>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-600">{tr("Score")}</label>
                                    <span className="text-lg font-bold text-indigo-600">
                                        {score}<span className="text-xs text-gray-400 font-normal">/10</span>
                                    </span>
                                </div>
                                <input type="range" min={1} max={10} step={1} value={score}
                                    onChange={e => setScore(Number(e.target.value))}
                                    className="w-full accent-indigo-600 h-2 rounded-full cursor-pointer" />
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-gray-400">{tr("Poor (1)")}</span>
                                    <span className="text-[10px] text-gray-400">{tr("Excellent (10)")}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">{tr("Recommendation *")}</label>
                                <div className="flex gap-2.5">
                                    {RECOMMENDATION_OPTIONS.map(opt => (
                                        <button key={opt.value} onClick={() => setRecommendation(opt.value)}
                                            className={cn(
                                                'flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all',
                                                recommendation === opt.value ? opt.activeColor : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                                            )}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{tr("Comments")}</label>
                                <textarea value={comments} onChange={e => setComments(e.target.value)}
                                    rows={4} placeholder={tr("Provide detailed feedback for the author…")}
                                    className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm
                                               focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-colors resize-none" />
                            </div>

                            <button onClick={submit} disabled={submitting || !recommendation}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white
                                           rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                                {submitting ? 'Submitting…' : 'Submit Review'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function AbstractReviewsPanel({ items, loading, onReload }) {
    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse space-y-3">
                        <div className="h-4 bg-gray-100 rounded w-3/5" />
                        <div className="h-3 bg-gray-100 rounded w-1/4" />
                        <div className="h-24 bg-gray-100 rounded-xl mt-4" />
                    </div>
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
                <BookOpen size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">{tr("No Abstract Review assignments")}</p>
                <p className="text-xs text-gray-400 mt-1">{tr("Abstracts assigned to you for review will appear here.")}</p>
            </div>
        );
    }

    const reviewed = items.filter(i => i.reviews?.some(r => r.submitted_at)).length;
    const pending  = items.length - reviewed;
    const pct      = Math.round((reviewed / items.length) * 100);

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">{tr("Your Review Progress")}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {reviewed} of {items.length} abstract{items.length !== 1 ? 's' : ''} reviewed
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {pending > 0 && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700
                                             bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                                <Clock size={11} /> {tr(":pending pending", { pending: pending })}
                            </span>
                        )}
                        <span className={cn('text-2xl font-black', pct === 100 ? 'text-emerald-600' : 'text-indigo-600')}>
                            {pct}%
                        </span>
                    </div>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-700', pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                        style={{ width: `${pct}%` }} />
                </div>
            </div>

            {items.map((item, idx) => (
                <AbstractReviewCard key={item.id} item={item} onSubmitted={onReload} index={idx + 1} total={items.length} />
            ))}
        </div>
    );
}

export default function ReviewIndex() {
    const { error } = useToast();
    const [allAssignments, setAllAssignments] = useState([]);
    // Opens on the reviewer's latest year with assignments (not the system's year setting).
    const [yearFilter, setYearFilter]         = useState('');
    const [loading, setLoading]               = useState(true);
    const [activeTab, setActiveTab]           = useState('blind');
    const [agreement, setAgreement]           = useState(null);
    const [showAgreement, setShowAgreement]   = useState(false);

    useEffect(() => {
        api.get('/reviewer-agreement').then((r) => setAgreement(r.data?.data ?? null)).catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const [abstractItems, setAbstractItems]     = useState([]);
    const [abstractsLoading, setAbstractsLoading] = useState(true);

    const handleCoiDeclared = (assignmentId) => {
        setAllAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, coi_declared_at: new Date().toISOString() } : a
        ));
    };

    const handleConflictReported = (assignmentId) => {
        setAllAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, coi_declared_at: new Date().toISOString(), coi_has_conflict: true } : a
        ));
    };

    const loadAbstracts = () => {
        setAbstractsLoading(true);
        api.get('/reviewer/abstracts')
            .then(res => {
                const d = res.data?.data ?? res.data ?? [];
                setAbstractItems(Array.isArray(d) ? d : (d.data ?? []));
            })
            .catch(() => {})
            .finally(() => setAbstractsLoading(false));
    };

    useEffect(() => {
        api.get('/review-assignments/my')
            .then(res => {
                const list = res.data?.data ?? [];
                setAllAssignments(list);
                const years = [...new Set(list.map(a => a.proposal?.academic_year).filter(Boolean))].sort().reverse();
                if (years.length > 1) {
                    setYearFilter(years[0]);
                    // Open the first tab with work waiting in that year.
                    const inYear = list.filter(a => a.proposal?.academic_year === years[0]);
                    const busy = TABS.find(t => t.filter && inYear.some(a => t.filter(a) && ['pending', 'in_progress', 'accepted'].includes(a.status)))
                        ?? TABS.find(t => t.filter && inYear.some(t.filter));
                    if (busy) setActiveTab(busy.key);
                }
            })
            .catch(() => error('Failed to load your review assignments.'))
            .finally(() => setLoading(false));
        loadAbstracts();
    }, []);

    const availableYears = [...new Set(allAssignments.map(a => a.proposal?.academic_year).filter(Boolean))].sort().reverse();
    const latestYear     = availableYears[0] ?? null;
    const assignments    = yearFilter ? allAssignments.filter(a => a.proposal?.academic_year === yearFilter) : allAssignments;
    const olderCount     = latestYear ? allAssignments.filter(a => a.proposal?.academic_year && a.proposal.academic_year !== latestYear).length : 0;
    const latestCount    = latestYear ? allAssignments.filter(a => a.proposal?.academic_year === latestYear).length : 0;

    const currentTab  = TABS.find(t => t.key === activeTab);
    const tabItems    = currentTab?.filter ? assignments.filter(currentTab.filter) : [];
    const allTotal    = allAssignments.length + abstractItems.length;

    const getCount   = tab => tab.key === 'abstracts' ? abstractItems.length : tab.filter ? assignments.filter(tab.filter).length : 0;
    const getPending = tab => tab.key === 'abstracts'
        ? abstractItems.filter(i => !i.reviews?.some(r => r.submitted_at)).length
        : tab.filter ? assignments.filter(tab.filter).filter(a => ['pending', 'in_progress', 'accepted'].includes(a.status)).length : 0;
    const getNew     = tab => tab.filter && tab.key !== 'abstracts' ? assignments.filter(tab.filter).filter(isNewAssignment).length : 0;

    // The headline numbers for the year shown.
    const isTodo     = (a) => ['pending', 'in_progress', 'accepted'].includes(a.status) && !a.coi_has_conflict;
    const todo       = assignments.filter(isTodo);
    const overdueN   = todo.filter(a => { const d = getDaysRemaining(a.due_date); return d !== null && d < 0; }).length;
    const dueWeekN   = todo.filter(a => { const d = getDaysRemaining(a.due_date); return d !== null && d >= 0 && d <= 7; }).length;
    const submittedN = assignments.filter(a => a.status === 'submitted').length;
    const progress   = assignments.length ? submittedN / assignments.length : 0;
    const nextUp     = [...todo].sort((x, y) => (x.due_date ? new Date(x.due_date) : Infinity) - (y.due_date ? new Date(y.due_date) : Infinity))[0];
    const nextUpTab  = nextUp ? TABS.find(t => t.filter && t.filter(nextUp))?.key : null;
    const nextUpDays = nextUp ? getDaysRemaining(nextUp.due_date) : null;

    const openNextUp = () => {
        if (!nextUp) return;
        if (nextUpTab) setActiveTab(nextUpTab);
        setTimeout(() => {
            const el = document.getElementById(`assignment-${nextUp.id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.classList.add('ring-4', 'ring-indigo-200');
            setTimeout(() => el?.classList.remove('ring-4', 'ring-indigo-200'), 1600);
        }, 60);
    };

    const TONE = {
        violet:  { text: 'text-violet-700', chip: 'bg-violet-100 text-violet-700', bar: 'bg-violet-600' },
        blue:    { text: 'text-blue-700', chip: 'bg-blue-100 text-blue-700', bar: 'bg-blue-600' },
        amber:   { text: 'text-amber-700', chip: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
        emerald: { text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-600' },
    };

    if (loading || abstractsLoading) {
        return (
            <AppLayout breadcrumb="Reviews">
                <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
                    <div className="h-36 animate-pulse rounded-2xl bg-linear-to-br from-indigo-200 to-violet-200" />
                    <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-gray-100" />
                    {[0, 1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumb="Reviews">
            <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
                {/* ── Header: who, how far, what is waiting ───────────────── */}
                <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5 py-4 text-white shadow-lg shadow-indigo-200 sm:px-6">
                    <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
                    <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-white/5" />
                    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/70"><Shield size={12} /> {tr("Reviewer workspace")}</p>
                            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{tr("My Review Assignments")}</h1>
                            <p className="text-sm text-white/80">
                                {todo.length
                                    ? tr(":count waiting for your score", { count: todo.length })
                                    : allTotal ? tr("You are all caught up — nothing waiting.") : tr("No assignments yet")}
                                {yearFilter ? ` · ${yearFilter}` : availableYears.length > 1 ? ` · ${tr("All years")}` : ''}
                            </p>
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                {availableYears.length > 1 && (
                                    <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setActiveTab('blind'); }} aria-label={tr("Academic year")}
                                        className="rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-gray-900">
                                        <option value="">{tr("All Years")}</option>
                                        {availableYears.map(y => <option key={y} value={y}>{y === latestYear ? `${y} · ${tr("latest")}` : y}</option>)}
                                    </select>
                                )}
                                <a href={`/api/v1/calendar/export?token=${localStorage.getItem('rtt_token') ?? ''}`}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25">
                                    <Download size={13} /> {tr("Export iCal")}
                                </a>
                            </div>
                        </div>
                        <ProgressRing value={progress} size={72} stroke={7}>
                            <span className="text-base font-bold tabular-nums">{Math.round(progress * 100)}%</span>
                            <span className="mt-0.5 text-[8px] font-medium uppercase tracking-wide text-white/70">{tr(":done of :total done", { done: submittedN, total: assignments.length })}</span>
                        </ProgressRing>
                    </div>
                    <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                            { label: tr("To score"), value: todo.length, icon: ClipboardCheck },
                            { label: tr("Due this week"), value: dueWeekN, icon: Clock },
                            { label: tr("Overdue"), value: overdueN, icon: AlertCircle, alert: overdueN > 0 },
                            { label: tr("Submitted"), value: submittedN, icon: CheckCircle2 },
                        ].map(t => (
                            <div key={t.label} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 backdrop-blur ${t.alert ? 'bg-red-500/30 ring-1 ring-red-200/50' : 'bg-white/15 ring-1 ring-white/15'}`}>
                                <p className="flex items-center gap-1.5 text-[11px] font-medium text-white/80"><t.icon size={12} /> {t.label}</p>
                                <p className="text-lg font-bold tabular-nums">{t.value}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {agreement && !agreement.accepted && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Lock size={16} /></span>
                            <div>
                                <p className="text-sm font-semibold text-indigo-900">{tr("Accept the :academic_year confidentiality agreement", { academic_year: agreement.academic_year })}</p>
                                <p className="text-xs text-indigo-700">{tr("You'll need to accept it once this year before opening any proposal to review.")}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAgreement(true)} className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">Read &amp; accept</button>
                    </div>
                )}
                {showAgreement && (
                    <ReviewerAgreementModal
                        onAccepted={() => { setShowAgreement(false); setAgreement((a) => ({ ...a, accepted: true })); }}
                        onClose={() => setShowAgreement(false)}
                    />
                )}

                {/* ── Which year is shown ──────────────────────────────────── */}
                {availableYears.length > 1 && (
                    <div className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${yearFilter === latestYear ? 'border-indigo-100 bg-white' : 'border-amber-200 bg-amber-50'}`}>
                        <p className="flex items-center gap-2 text-sm">
                            <CalendarDays size={16} className={yearFilter === latestYear ? 'text-indigo-500' : 'text-amber-600'} />
                            {yearFilter === latestYear ? (
                                <span className="text-gray-700"><b className="text-gray-900">{tr("Showing your latest assignments — :year", { year: latestYear })}</b> <span className="text-gray-500">· {tr(":count this year, :older from earlier years", { count: latestCount, older: olderCount })}</span></span>
                            ) : (
                                <span className="text-amber-900"><b>{yearFilter ? tr("You are viewing :year", { year: yearFilter }) : tr("You are viewing all years")}</b> · {tr("Your latest assignments are in :year (:count).", { year: latestYear, count: latestCount })}</span>
                            )}
                        </p>
                        {yearFilter === latestYear
                            ? <button onClick={() => setYearFilter('')} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">{tr("Show all years")}</button>
                            : <button onClick={() => setYearFilter(latestYear)} className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">{tr("Go to the latest year")}</button>}
                    </div>
                )}

                {/* ── Next up: the most urgent review ───────────────────────── */}
                {nextUp && (
                    <section className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-linear-to-r from-indigo-50 via-white to-white p-5 shadow-sm sm:flex-row sm:items-center">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200"><Star size={20} /></span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                                {tr("Next up")}{nextUpDays !== null && ` · ${nextUpDays < 0 ? tr("overdue by :d days", { d: Math.abs(nextUpDays) }) : nextUpDays === 0 ? tr("due today") : tr("due in :d days", { d: nextUpDays })}`}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-gray-900">{nextUp.proposal?.title || 'Untitled Proposal'}</p>
                            <p className="text-xs text-gray-500"><span className="font-mono font-semibold text-gray-700">{nextUp.proposal?.tracker_number}</span> · {nextUp.evaluation_type?.label || nextUp.evaluation_type?.name}</p>
                        </div>
                        <button onClick={openNextUp} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800">
                            {tr("Go to it")} <ChevronRight size={15} />
                        </button>
                    </section>
                )}

                {/* ── Empty state (no assignments at all) ──────────────────── */}
                {allTotal === 0 && (
                    <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-14 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
                            <ClipboardCheck size={28} className="text-indigo-400" />
                        </div>
                        <h3 className="mb-1.5 font-semibold text-gray-800">{tr("No assignments yet")}</h3>
                        <p className="mx-auto max-w-xs text-sm leading-relaxed text-gray-500">
                            {tr("You have no review assignments at the moment. Check back after proposals are assigned for review.")}
                        </p>
                    </div>
                )}

                {allTotal > 0 && (
                    <>
                        {/* ── Tabs ─────────────────────────────────────────── */}
                        <div className="sticky top-0 z-10 -mx-4 bg-gray-50/90 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:px-0">
                            <div className="overflow-x-auto">
                                <div role="tablist" className="flex w-fit gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
                                    {TABS.map(tab => {
                                        const count    = getCount(tab);
                                        const pending  = getPending(tab);
                                        const newCount = getNew(tab);
                                        const isActive = activeTab === tab.key;
                                        const Icon = tab.icon;
                                        const t = TONE[tab.color];

                                        return (
                                            <button key={tab.key} role="tab" aria-selected={isActive} onClick={() => setActiveTab(tab.key)}
                                                className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-all sm:px-4 ${isActive ? 'bg-gray-900 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                                                <Icon size={15} className={isActive ? 'text-white' : t.text} />
                                                {tab.label}
                                                {count > 0 && (
                                                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${isActive ? 'bg-white/20 text-white' : t.chip}`}>{count}</span>
                                                )}
                                                {newCount > 0 && !isActive && (
                                                    <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                                                    </span>
                                                )}
                                                {pending > 0 && !isActive && newCount === 0 && (
                                                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {currentTab && <p className="mt-2 px-1 text-xs text-gray-500">{currentTab.description}</p>}
                        </div>

                        {/* ── Abstract review panel (separate data source) ─── */}
                        {activeTab === 'abstracts' && (
                            <AbstractReviewsPanel items={abstractItems} loading={abstractsLoading} onReload={loadAbstracts} />
                        )}

                        {/* ── My record: ratings and certificates ───────────── */}
                        {activeTab === 'record' && (
                            <div>
                                <div className="peer grid items-stretch gap-5 empty:hidden lg:grid-cols-2 [&>*:only-child]:lg:col-span-2">
                                    <ReviewQualityCard />
                                    <ReviewCertificatesCard />
                                </div>
                                <div className="hidden rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center peer-empty:block">
                                    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50"><Award size={22} className="text-amber-400" /></span>
                                    <p className="text-sm font-semibold text-gray-600">{tr("Nothing on your record yet")}</p>
                                    <p className="mt-1 text-xs text-gray-400">{tr("Ratings of your reviews and your certificates appear here once you have submitted reviews.")}</p>
                                </div>
                            </div>
                        )}

                        {/* ── Empty tab state ────────────────────────────────── */}
                        {activeTab !== 'abstracts' && activeTab !== 'record' && tabItems.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><currentTab.icon size={22} className="text-gray-300" /></span>
                                <p className="text-sm font-semibold text-gray-600">{tr("No :label assignments", { label: currentTab.label })}</p>
                                <p className="mt-1 text-xs text-gray-400">{tr("Assignments for this phase will appear here.")}</p>
                            </div>
                        )}

                        {/* ── Assignment cards ────────────────────────────────── */}
                        {activeTab !== 'abstracts' && tabItems.length > 0 && activeTab !== 'completed' && (
                            <div className="space-y-3">
                                {tabItems.map(assignment => (
                                    <AssignmentCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        tabKey={activeTab}
                                        onCoiDeclared={handleCoiDeclared}
                                        onConflictReported={handleConflictReported}
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
