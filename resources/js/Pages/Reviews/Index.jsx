import { useState, useEffect } from 'react';
import { translate as tr, Trans } from '../../lib/i18n'
import { Link, router } from '@inertiajs/react';
import {
    ClipboardCheck, Clock, AlertCircle, Download, ArrowRight, Search,
    CheckCircle2, BookOpen, EyeOff, Presentation, Calendar, ChevronDown,
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

/** Quick status filters for the to-do tabs. */
const STATUS_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'todo', label: 'To do', test: a => ['pending', 'accepted'].includes(a.status) },
    { key: 'in_progress', label: 'In progress', test: a => a.status === 'in_progress' },
    { key: 'overdue', label: 'Overdue', test: a => { const d = getDaysRemaining(a.due_date); return d !== null && d < 0; } },
];

const byDue = (x, y) => (x.due_date ? new Date(x.due_date) : Infinity) - (y.due_date ? new Date(y.due_date) : Infinity);
const SORTS = [
    { key: 'due', label: 'Due date (soonest)', compare: byDue },
    { key: 'newest', label: 'Newest assigned', compare: (x, y) => new Date(y.assigned_at ?? 0) - new Date(x.assigned_at ?? 0) },
    { key: 'title', label: 'Title A–Z', compare: (x, y) => (x.proposal?.title ?? '').localeCompare(y.proposal?.title ?? '') },
];
const COMPLETED_SORTS = [
    { key: 'recent', label: 'Recently submitted', compare: (x, y) => new Date(y.submitted_at ?? 0) - new Date(x.submitted_at ?? 0) },
    { key: 'score', label: 'Highest score', compare: (x, y) => scorePct(y) - scorePct(x) },
    { key: 'title', label: 'Title A–Z', compare: (x, y) => (x.proposal?.title ?? '').localeCompare(y.proposal?.title ?? '') },
];

function scorePct(assignment) {
    const { earned, max } = weightedScoreDisplay(assignment.scores ?? []);
    return max > 0 ? earned / max : -1;
}

function getDaysRemaining(dueDate) {
    if (!dueDate) return null;
    return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dueDate }) {
    const days = getDaysRemaining(dueDate);
    if (days === null) return null;
    const base = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset';
    if (days < 0) return <span className={`${base} bg-red-50 text-red-700 ring-red-200`}><AlertCircle size={12} /> {tr("Overdue :daysd", { days: Math.abs(days) })}</span>;
    if (days === 0) return <span className={`${base} bg-orange-50 text-orange-700 ring-orange-200`}><Clock size={12} /> {tr("Due today")}</span>;
    if (days <= 3) return <span className={`${base} bg-amber-50 text-amber-700 ring-amber-200`}><Clock size={12} /> {tr(":daysd left", { days: days })}</span>;
    return <span className={`${base} bg-white text-gray-500 ring-gray-200`}><Calendar size={12} /> {tr("Due :date", { date: formatDate(dueDate) })}</span>;
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
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        : recommendation === 'reject'
            ? 'bg-red-50 text-red-700 ring-red-200'
            : recommendation === 'revise'
                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                : 'bg-gray-50 text-gray-600 ring-gray-200';

    return (
        <div className="px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <TypeIcon isDefence={isDefence} done />
                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span className="font-mono font-semibold text-gray-700">{assignment.proposal?.tracker_number || 'N/A'}</span>
                        <span>· {isDefence ? tr('Open Defence') : tr('Blind Review')}</span>
                        {recommendation && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${recColor}`}>{recommendation}</span>}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{assignment.proposal?.title || 'Untitled Proposal'}</h3>
                    <p className="mt-0.5 text-xs text-gray-400">
                        {tr('Submitted :date', { date: assignment.submitted_at ? formatDate(assignment.submitted_at) : '—' })}
                        {assignment.proposal?.college?.name && <> · {assignment.proposal.college.name}</>}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {pct !== null && (
                        <div className="hidden text-right sm:block">
                            <p className="text-lg font-bold tabular-nums leading-none text-gray-900">{pct}%</p>
                            <p className="mt-1 text-[11px] tabular-nums text-gray-400">{totalScore}/{maxScore} pts</p>
                        </div>
                    )}
                    {pct !== null && (
                        <ProgressRing value={pct / 100} size={40} stroke={4} track="#eef0f3" color={pct >= 70 ? '#059669' : pct >= 50 ? '#4f46e5' : '#d97706'}>
                            <span className="text-[10px] font-bold tabular-nums text-gray-900 sm:hidden">{pct}</span>
                        </ProgressRing>
                    )}
                    <button onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        aria-label={expanded ? tr('Hide details') : tr('Show details')}>
                        <ChevronDown size={16} className={`transition ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {expanded && scores.length > 0 && (
                <div className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4 sm:ml-14">
                    {scores.map((sc, i) => (
                        <div key={i}>
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                                <p className="flex-1 text-xs leading-snug text-gray-700">{sc.evaluation_question?.question_text ?? `Question ${i + 1}`}</p>
                                <div className="sm:w-48"><ScoreBar score={sc.score ?? 0} max={sc.evaluation_question?.max_score ?? 5} /></div>
                            </div>
                            {sc.comment && (
                                <p className="mt-1 flex items-start gap-1.5 text-[11px] italic leading-snug text-gray-500">
                                    <MessageSquare size={11} className="mt-0.5 shrink-0 text-gray-300" /> {sc.comment}
                                </p>
                            )}
                        </div>
                    ))}
                    {comments.length === 0 && <p className="text-xs italic text-gray-400">{tr("No written comments provided.")}</p>}
                </div>
            )}
        </div>
    );
}

function TypeIcon({ isDefence, done = false }) {
    const tone = done ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : isDefence ? 'bg-sky-50 text-sky-600 ring-sky-100' : 'bg-indigo-50 text-indigo-600 ring-indigo-100';
    return (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tone}`}>
            {done ? <CheckCircle2 size={18} /> : isDefence ? <Presentation size={18} /> : <EyeOff size={18} />}
        </span>
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
    const isDone    = assignment.status === 'submitted';
    const isNew     = isNewAssignment(assignment);
    const meta      = STATUS_META[assignment.status] ?? STATUS_META.pending;
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

    return (
        <article id={`assignment-${assignment.id}`}
            className={`group scroll-mt-28 px-4 py-4 transition-colors hover:bg-gray-50/70 sm:px-5 ${isNew ? 'bg-amber-50/40' : ''}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                    <TypeIcon isDefence={isDefence} done={isDone} />
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                            <span className="font-mono font-semibold text-gray-700">{assignment.proposal?.tracker_number || 'N/A'}</span>
                            <span>· {getCategoryLabel(assignment.proposal?.category)}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {tr(meta.label)}
                            </span>
                            {isNew && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{tr("New")}</span>}
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900 sm:text-[15px]">{assignment.proposal?.title || 'Untitled Proposal'}</h3>
                        <p className="mt-0.5 text-xs text-gray-400">
                            {assignment.evaluation_type?.label || assignment.evaluation_type?.name || 'Evaluation'}
                            {assignment.proposal?.college?.name && <> · {assignment.proposal.college.name}</>}
                            {assignment.assigned_at && <> · {tr("Assigned :date", { date: formatDate(assignment.assigned_at) })}</>}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 pl-13 sm:justify-end sm:pl-0">
                    <DueBadge dueDate={assignment.due_date} />
                    {isDone ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={14} /> {tr("Submitted")}
                        </span>
                    ) : hasReportedConflict ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                            <AlertCircle size={14} /> {tr("Conflict reported")}
                        </span>
                    ) : (
                        <Link href={`/reviews/${assignment.id}/score`} onClick={handleScoreClick}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                            {assignment.status === 'in_progress' ? tr("Continue") : tr("Start review")}
                            <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
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
            'bg-white rounded-xl border overflow-hidden',
            hasReview ? 'border-gray-200' : 'border-indigo-200 ring-1 ring-indigo-100',
        )}>
            {total > 1 && (
                <div className={cn(
                    'px-6 py-2 flex items-center justify-between text-[11px] font-semibold border-b',
                    hasReview ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100',
                )}>
                    <span>{tr("Abstract :index of :total", { index: index, total: total })}</span>
                    <span>{hasReview ? tr('Reviewed') : tr('Waiting for your review')}</span>
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
                                        {myReview.recommendation === 'accept' ? tr('Accept') :
                                         myReview.recommendation === 'reject' ? tr('Reject') : tr('Revise')}
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
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
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
    const [search, setSearch]                 = useState('');
    const [statusFilter, setStatusFilter]     = useState('all');
    const [sort, setSort]                     = useState('due');

    /** Each tab starts unfiltered, with its natural order. */
    const changeTab = (key) => {
        setActiveTab(key);
        setSearch('');
        setStatusFilter('all');
        setSort(key === 'completed' ? 'recent' : 'due');
    };

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

    const needle       = search.trim().toLowerCase();
    const statusTest   = STATUS_FILTERS.find(f => f.key === statusFilter)?.test;
    const compare      = [...SORTS, ...COMPLETED_SORTS].find(o => o.key === sort)?.compare ?? byDue;
    const visibleItems = tabItems
        .filter(a => !needle || [a.proposal?.title, a.proposal?.tracker_number, a.proposal?.college?.name].some(v => (v ?? '').toLowerCase().includes(needle)))
        .filter(a => !statusTest || statusTest(a))
        .sort(compare);

    const getCount   = tab => tab.key === 'abstracts' ? abstractItems.length : tab.filter ? assignments.filter(tab.filter).length : 0;
    const getPending = tab => tab.key === 'abstracts'
        ? abstractItems.filter(i => !i.reviews?.some(r => r.submitted_at)).length
        : tab.filter ? assignments.filter(tab.filter).filter(a => ['pending', 'in_progress', 'accepted'].includes(a.status)).length : 0;

    // The headline numbers for the year shown.
    const isTodo     = (a) => ['pending', 'in_progress', 'accepted'].includes(a.status) && !a.coi_has_conflict;
    const todo       = assignments.filter(isTodo);
    const overdueN   = todo.filter(a => { const d = getDaysRemaining(a.due_date); return d !== null && d < 0; }).length;
    const dueWeekN   = todo.filter(a => { const d = getDaysRemaining(a.due_date); return d !== null && d >= 0 && d <= 7; }).length;
    const submittedN = assignments.filter(a => a.status === 'submitted').length;
    const progress   = assignments.length ? submittedN / assignments.length : 0;
    const nextUp     = [...todo].sort(byDue)[0];
    const nextUpTab  = nextUp ? TABS.find(t => t.filter && t.filter(nextUp))?.key : null;
    const nextUpDays = nextUp ? getDaysRemaining(nextUp.due_date) : null;

    const openNextUp = () => {
        if (!nextUp) return;
        if (nextUpTab) changeTab(nextUpTab);
        setTimeout(() => {
            const el = document.getElementById(`assignment-${nextUp.id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.classList.add('bg-indigo-50');
            setTimeout(() => el?.classList.remove('bg-indigo-50'), 1600);
        }, 60);
    };

    if (loading || abstractsLoading) {
        return (
            <AppLayout breadcrumb="Reviews">
                <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
                    <div className="h-14 w-1/2 animate-pulse rounded-xl bg-gray-100" />
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}</div>
                    <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />
                </div>
            </AppLayout>
        );
    }

    const isAssignmentTab = activeTab !== 'abstracts' && activeTab !== 'record';
    const kpis = [
        { label: tr("To review"), value: todo.length, icon: ClipboardCheck, hint: todo.length ? tr("waiting for your score") : tr("all caught up"), tone: 'text-indigo-600 bg-indigo-50' },
        { label: tr("Due this week"), value: dueWeekN, icon: Clock, hint: tr("in the next 7 days"), tone: 'text-amber-600 bg-amber-50' },
        { label: tr("Overdue"), value: overdueN, icon: AlertCircle, hint: overdueN ? tr("past the due date") : tr("nothing late"), tone: 'text-red-600 bg-red-50', alert: overdueN > 0 },
        { label: tr("Submitted"), value: submittedN, icon: CheckCircle2, hint: tr(":done of :total", { done: submittedN, total: assignments.length }), tone: 'text-emerald-600 bg-emerald-50', progress },
    ];

    return (
        <AppLayout breadcrumb="Reviews">
            <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
                {/* ── Header ──────────────────────────────────────────────── */}
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{tr("Reviewer workspace")}</p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{tr("My reviews")}</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            {todo.length
                                ? tr(":count waiting for your score", { count: todo.length })
                                : allTotal ? tr("You are all caught up — nothing waiting.") : tr("No assignments yet")}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {availableYears.length > 1 && (
                            <label className="relative">
                                <span className="sr-only">{tr("Academic year")}</span>
                                <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setActiveTab('blind'); }}
                                    className="h-10 rounded-lg border border-gray-200 bg-white pl-9 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="">{tr("All years")}</option>
                                    {availableYears.map(y => <option key={y} value={y}>{y === latestYear ? `${y} · ${tr("latest")}` : y}</option>)}
                                </select>
                            </label>
                        )}
                        <a href={`/api/v1/calendar/export?token=${localStorage.getItem('rtt_token') ?? ''}`}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50">
                            <Download size={15} /> {tr("Add to calendar")}
                        </a>
                    </div>
                </header>

                {availableYears.length > 1 && yearFilter !== latestYear && (
                    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-amber-900">
                            <b>{yearFilter ? tr("You are viewing :year", { year: yearFilter }) : tr("You are viewing all years")}</b> · {tr("Your latest assignments are in :year (:count).", { year: latestYear, count: latestCount })}
                            {olderCount > 0 && !yearFilter && <span className="text-amber-700"> {tr(":older from earlier years", { older: olderCount })}</span>}
                        </p>
                        <button onClick={() => setYearFilter(latestYear)} className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">{tr("Go to the latest year")}</button>
                    </div>
                )}

                {agreement && !agreement.accepted && (
                    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><Lock size={16} /></span>
                            <div>
                                <p className="text-sm font-semibold text-indigo-900">{tr("Accept the :academic_year confidentiality agreement", { academic_year: agreement.academic_year })}</p>
                                <p className="text-xs text-indigo-700">{tr("You'll need to accept it once this year before opening any proposal to review.")}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAgreement(true)} className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">{tr("Read & accept")}</button>
                    </div>
                )}
                {showAgreement && (
                    <ReviewerAgreementModal
                        onAccepted={() => { setShowAgreement(false); setAgreement((a) => ({ ...a, accepted: true })); }}
                        onClose={() => setShowAgreement(false)}
                    />
                )}

                {/* ── Key numbers ─────────────────────────────────────────── */}
                {allTotal > 0 && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {kpis.map(k => (
                            <div key={k.label} className={`rounded-2xl border bg-white p-4 shadow-sm ${k.alert ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'}`}>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-gray-500">{k.label}</p>
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${k.tone}`}><k.icon size={15} /></span>
                                </div>
                                <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${k.alert ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</p>
                                {k.progress !== undefined ? (
                                    <div className="mt-2">
                                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.round(k.progress * 100)}%` }} />
                                        </div>
                                        <p className="mt-1 text-[11px] text-gray-400">{k.hint}</p>
                                    </div>
                                ) : <p className="mt-1 text-[11px] text-gray-400">{k.hint}</p>}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Next up: the most urgent review ─────────────────────── */}
                {nextUp && (
                    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 border-l-4 border-l-indigo-500 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-indigo-600">
                                {tr("Next up")}
                                {nextUpDays !== null && <span className={nextUpDays < 0 ? 'text-red-600' : 'text-gray-500'}> · {nextUpDays < 0 ? tr("overdue by :d days", { d: Math.abs(nextUpDays) }) : nextUpDays === 0 ? tr("due today") : tr("due in :d days", { d: nextUpDays })}</span>}
                            </p>
                            <p className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900 sm:text-base">{nextUp.proposal?.title || 'Untitled Proposal'}</p>
                            <p className="text-xs text-gray-500"><span className="font-mono font-semibold text-gray-700">{nextUp.proposal?.tracker_number}</span> · {nextUp.evaluation_type?.label || nextUp.evaluation_type?.name}</p>
                        </div>
                        <button onClick={openNextUp} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800">
                            {tr("Go to it")} <ArrowRight size={15} />
                        </button>
                    </section>
                )}

                {/* ── Empty state (no assignments at all) ─────────────────── */}
                {allTotal === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-14 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                            <ClipboardCheck size={26} className="text-indigo-400" />
                        </div>
                        <h3 className="mb-1.5 font-semibold text-gray-800">{tr("No assignments yet")}</h3>
                        <p className="mx-auto max-w-xs text-sm leading-relaxed text-gray-500">
                            {tr("You have no review assignments at the moment. Check back after proposals are assigned for review.")}
                        </p>
                    </div>
                )}

                {allTotal > 0 && (
                    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                        {/* ── Tabs ───────────────────────────────────────── */}
                        <div className="sticky top-0 z-10 rounded-t-2xl border-b border-gray-200 bg-white/95 backdrop-blur">
                            <div role="tablist" className="flex gap-1 overflow-x-auto px-2 sm:px-3">
                                {TABS.map(tab => {
                                    const count    = getCount(tab);
                                    const pending  = getPending(tab);
                                    const isActive = activeTab === tab.key;
                                    const Icon = tab.icon;

                                    return (
                                        <button key={tab.key} role="tab" aria-selected={isActive} onClick={() => changeTab(tab.key)}
                                            className={`relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-medium transition-colors ${isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'}`}>
                                            <Icon size={15} />
                                            {tr(tab.label)}
                                            {count > 0 && (
                                                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${isActive ? 'bg-indigo-100 text-indigo-700' : pending > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
                                                    title={pending > 0 ? tr(":pending waiting", { pending }) : undefined}>
                                                    {pending > 0 && tab.key !== 'completed' ? pending : count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
                            <p className="text-xs text-gray-500">{tr(currentTab.description)}</p>
                            {isAssignmentTab && tabItems.length > 0 && (
                                <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                                        <Search size={15} className="text-gray-400" />
                                        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("Search by title, tracker number or college…")}
                                            className="h-9 flex-1 bg-transparent text-base outline-none sm:text-sm" />
                                    </div>
                                    <div className="flex gap-2">
                                        {activeTab !== 'completed' && (
                                            <div className="flex flex-1 rounded-lg bg-gray-100 p-0.5 text-xs font-medium lg:flex-none">
                                                {STATUS_FILTERS.map(f => (
                                                    <button key={f.key} onClick={() => setStatusFilter(f.key)} aria-pressed={statusFilter === f.key}
                                                        className={`flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 transition lg:flex-none ${statusFilter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                                        {tr(f.label)}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <select value={sort} onChange={e => setSort(e.target.value)} aria-label={tr("Sort")}
                                            className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            {(activeTab === 'completed' ? COMPLETED_SORTS : SORTS).map(o => <option key={o.key} value={o.key}>{tr(o.label)}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Abstract review panel (separate data source) ── */}
                        {activeTab === 'abstracts' && (
                            <div className="p-4 sm:p-5">
                                <AbstractReviewsPanel items={abstractItems} loading={abstractsLoading} onReload={loadAbstracts} />
                            </div>
                        )}

                        {/* ── My record: ratings and certificates ──────────── */}
                        {activeTab === 'record' && (
                            <div className="p-4 sm:p-5">
                                <div className="peer grid items-stretch gap-5 empty:hidden lg:grid-cols-2 [&>*:only-child]:lg:col-span-2">
                                    <ReviewQualityCard />
                                    <ReviewCertificatesCard />
                                </div>
                                <div className="hidden py-10 text-center peer-empty:block">
                                    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50"><Award size={22} className="text-amber-400" /></span>
                                    <p className="text-sm font-semibold text-gray-600">{tr("Nothing on your record yet")}</p>
                                    <p className="mt-1 text-xs text-gray-400">{tr("Ratings of your reviews and your certificates appear here once you have submitted reviews.")}</p>
                                </div>
                            </div>
                        )}

                        {/* ── Empty states ───────────────────────────────── */}
                        {isAssignmentTab && visibleItems.length === 0 && (
                            <div className="px-6 py-14 text-center">
                                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><currentTab.icon size={22} className="text-gray-300" /></span>
                                {tabItems.length === 0 ? (
                                    <>
                                        <p className="text-sm font-semibold text-gray-600">{tr("No :label assignments", { label: tr(currentTab.label) })}</p>
                                        <p className="mt-1 text-xs text-gray-400">{tr("Assignments for this phase will appear here.")}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-semibold text-gray-600">{tr("Nothing matches these filters")}</p>
                                        <button onClick={() => { setSearch(''); setStatusFilter('all'); }} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">{tr("Clear filters")}</button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── Assignment rows ──────────────────────────────── */}
                        {isAssignmentTab && visibleItems.length > 0 && (
                            <div className="divide-y divide-gray-100">
                                {activeTab === 'completed'
                                    ? visibleItems.map(assignment => <CompletedCard key={assignment.id} assignment={assignment} />)
                                    : visibleItems.map(assignment => (
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

                        {isAssignmentTab && tabItems.length > 0 && (
                            <p className="rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-xs text-gray-500">
                                {tr("Showing :shown of :total", { shown: visibleItems.length, total: tabItems.length })}
                            </p>
                        )}
                    </section>
                )}
            </div>
        </AppLayout>
    );
}
