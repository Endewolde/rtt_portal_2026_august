import { useState, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import {
    Download, FileText, ClipboardCheck, BarChart2,
    Info, Paperclip, DollarSign, CheckCircle2,
    AlertTriangle, ChevronLeft, Calendar, MapPin, Clock,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { downloadFile } from '../../lib/download';
import { useConfirm } from '../../hooks/useConfirm';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';

// ── Score colour ramp ─────────────────────────────────────────────────────────

const SCORE_META = [
    { label: 'None',      bg: 'bg-slate-500',  ring: 'ring-slate-400',  text: 'text-slate-600'   },
    { label: 'Poor',      bg: 'bg-red-500',    ring: 'ring-red-400',    text: 'text-red-600'     },
    { label: 'Fair',      bg: 'bg-orange-500', ring: 'ring-orange-400', text: 'text-orange-600'  },
    { label: 'Good',      bg: 'bg-amber-500',  ring: 'ring-amber-400',  text: 'text-amber-600'   },
    { label: 'Very Good', bg: 'bg-blue-500',   ring: 'ring-blue-400',   text: 'text-blue-600'    },
    { label: 'Excellent', bg: 'bg-emerald-500',ring: 'ring-emerald-400',text: 'text-emerald-600' },
];

const CATEGORY_ACCENTS = [
    'border-l-blue-500',
    'border-l-violet-500',
    'border-l-emerald-500',
    'border-l-orange-500',
    'border-l-pink-500',
    'border-l-cyan-500',
];

const TABS = [
    { key: 'score',     label: 'Score',     icon: ClipboardCheck },
    { key: 'details',   label: 'Details',   icon: Info           },
    { key: 'documents', label: 'Documents', icon: Paperclip      },
    { key: 'budget',    label: 'Budget',    icon: DollarSign     },
];

// ── Circular progress ring ────────────────────────────────────────────────────

function ProgressRing({ pct, size = 52 }) {
    const r   = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const dash = circ * (pct / 100);
    const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#f59e0b';

    return (
        <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={color} strokeWidth={6}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.4s ease' }}
            />
        </svg>
    );
}

// ── Score button ──────────────────────────────────────────────────────────────

function ScoreButton({ score, current, maxScore, disabled, onClick }) {
    const meta    = SCORE_META[score] ?? SCORE_META[0];
    const isActive = current === score;

    return (
        <button
            type="button"
            disabled={disabled}
            title={`${score} — ${meta.label}`}
            onClick={() => onClick(score)}
            className={`
                relative h-10 min-w-11 px-3 rounded-xl border-2 text-sm font-bold
                transition-all duration-150 select-none shrink-0
                ${isActive
                    ? `${meta.bg} border-transparent text-white shadow-md scale-110`
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700'
                }
                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            {score}
        </button>
    );
}

export default function ReviewScore() {
    const { url }      = usePage();
    const assignmentId = url.split('/')[2];
    const toast        = useToast();
    const { confirm, Dialog } = useConfirm();

    const [assignment, setAssignment] = useState(null);
    const [answers, setAnswers]       = useState({});
    const [activeTab, setActiveTab]   = useState('score');
    const [loading, setLoading]       = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted]   = useState(false);

    useEffect(() => {
        api.get(`/review-assignments/${assignmentId}`)
            .then(res => {
                const data = res.data?.data ?? res.data;
                setAssignment(data);
                const pre = {};
                (data?.scores ?? []).forEach(s => {
                    pre[s.evaluation_question_id] = {
                        score:   s.score,
                        comment: s.comment ?? '',
                    };
                });
                setAnswers(pre);
                if (data?.status === 'submitted') setSubmitted(true);
            })
            .catch(() => toast.error('Failed to load review assignment.'))
            .finally(() => setLoading(false));
    }, [assignmentId]);

    const updateAnswer = (qid, field, value) =>
        setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], [field]: value } }));

    // ── Score calculation ─────────────────────────────────────────────────────
    const categories   = assignment?.evaluation_type?.categories ?? [];
    const allQuestions = categories.flatMap(c => c.questions ?? []);
    const hasWeights   = categories.length > 0 && categories.every(c => c.weight != null && c.weight > 0);
    const totalWeight  = hasWeights ? categories.reduce((s, c) => s + c.weight, 0) : 0;

    let earned, maxTotal, pct;
    if (hasWeights) {
        let weightedSum = 0;
        categories.forEach(cat => {
            const qs       = cat.questions ?? [];
            const catEarned = qs.reduce((s, q) => s + Number(answers[q.id]?.score ?? 0), 0);
            const catMax    = qs.reduce((s, q) => s + (q.max_score ?? 0), 0);
            const catPct    = catMax > 0 ? catEarned / catMax : 0;
            weightedSum += catPct * cat.weight;
        });
        earned   = parseFloat(weightedSum.toFixed(1));
        maxTotal = totalWeight;
        pct      = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
    } else {
        earned   = allQuestions.reduce((s, q) => s + Number(answers[q.id]?.score ?? 0), 0);
        maxTotal = allQuestions.reduce((s, q) => s + (q.max_score ?? 0), 0);
        pct      = maxTotal > 0 ? Math.round((earned / maxTotal) * 100) : 0;
    }

    const answered  = allQuestions.filter(q => answers[q.id]?.score != null).length;
    const progress  = allQuestions.length > 0 ? Math.round((answered / allQuestions.length) * 100) : 0;

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        const unanswered = allQuestions.filter(q => q.is_required && answers[q.id]?.score == null);
        if (unanswered.length > 0) {
            toast.error(
                `${unanswered.length} required question${unanswered.length !== 1 ? 's' : ''} still need a score.`,
                { title: 'Incomplete' }
            );
            return;
        }
        const ok = await confirm({
            title:        'Submit Review?',
            description:  'Once submitted your scores cannot be changed.',
            confirmLabel: 'Submit Review',
        });
        if (!ok) return;
        setSubmitting(true);
        try {
            await api.post(`/review-assignments/${assignmentId}/score`, {
                answers: Object.entries(answers).map(([qid, a]) => ({
                    question_id: qid,
                    score:       a.score ?? 0,
                    comment:     a.comment ?? '',
                })),
            });
            toast.success('Review submitted successfully.');
            setSubmitted(true);
            router.visit('/reviews');
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Submission failed.', { title: 'Error' });
        }
        setSubmitting(false);
    };

    // ── Open-defence gate ─────────────────────────────────────────────────────
    const proposal        = assignment?.proposal;
    const isOpenDefence   = assignment?.evaluation_type?.name?.startsWith('open_defence');
    const defenceSession  = assignment?.defence_session;
    const scheduledDateStr = defenceSession?.scheduled_date;
    const isBeforeSchedule = (() => {
        if (!isOpenDefence || !scheduledDateStr) return false;
        const today   = new Date(); today.setHours(0, 0, 0, 0);
        const session = new Date(scheduledDateStr + 'T00:00:00');
        return today < session;
    })();

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) return (
        <AppLayout breadcrumb="Score Review">
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Loading review…</p>
                </div>
            </div>
        </AppLayout>
    );

    if (!assignment) return (
        <AppLayout breadcrumb="Score Review">
            <div className="p-6 text-center">
                <p className="text-gray-500 text-sm">Assignment not found.</p>
            </div>
        </AppLayout>
    );

    // ── Before-schedule gate ──────────────────────────────────────────────────
    if (isBeforeSchedule) {
        const fmt  = new Date(scheduledDateStr + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        const time  = defenceSession?.scheduled_time?.slice(0, 5);
        const venue = defenceSession?.venue;

        return (
            <AppLayout breadcrumb="Score Review">
                <div className="min-h-[70vh] flex items-center justify-center p-6">
                    <div className="max-w-sm w-full">
                        <div className="bg-white border border-amber-200 rounded-3xl p-8 text-center shadow-sm">
                            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <Calendar size={28} className="text-amber-500" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Defence Not Yet Started</h2>
                            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                                This session hasn't been reached yet. You can only submit scores on the scheduled date.
                            </p>
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-4 mb-6 text-left space-y-2.5">
                                <div className="flex items-center gap-2.5 text-sm">
                                    <Calendar size={15} className="text-amber-400 shrink-0" />
                                    <span className="text-gray-700 font-medium">{fmt}</span>
                                </div>
                                {time && (
                                    <div className="flex items-center gap-2.5 text-sm">
                                        <Clock size={15} className="text-amber-400 shrink-0" />
                                        <span className="text-gray-600">{time}</span>
                                    </div>
                                )}
                                {venue && (
                                    <div className="flex items-center gap-2.5 text-sm">
                                        <MapPin size={15} className="text-amber-400 shrink-0" />
                                        <span className="text-gray-600">{venue}</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => window.history.back()}
                                className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <ChevronLeft size={15} /> Go Back
                            </button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumb="Score Review">
            <div className="min-h-screen bg-gray-50 -m-6">

                {/* ── Sticky header ─────────────────────────────────────────── */}
                <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
                    <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

                        {/* Proposal info */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md shrink-0">
                                    {proposal?.tracker_number}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                    {proposal?.title}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {assignment.evaluation_type?.label ?? assignment.evaluation_type?.name}
                            </p>
                        </div>

                        {/* Live score ring */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="relative">
                                <ProgressRing pct={pct} size={52} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[11px] font-bold text-gray-700 leading-none">{pct}%</span>
                                </div>
                            </div>
                            <div className="text-right hidden sm:block">
                                <p className="text-lg font-extrabold text-gray-800 leading-none tabular-nums">
                                    {earned}
                                    <span className="text-sm font-normal text-gray-400">/{maxTotal}</span>
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                                    {answered}/{allQuestions.length} answered
                                </p>
                            </div>

                            {!submitted && (
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 whitespace-nowrap transition-colors shadow-sm shadow-blue-200"
                                >
                                    {submitting ? 'Submitting…' : 'Submit Review'}
                                </button>
                            )}

                            {submitted && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                                    <CheckCircle2 size={14} /> Submitted
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-0.5 bg-gray-100">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Tabs */}
                    <div className="max-w-5xl mx-auto px-6 flex overflow-x-auto">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                                        activeTab === tab.key
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <Icon size={13} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Tab content ───────────────────────────────────────────── */}
                <div className="max-w-5xl mx-auto px-6 py-6">

                    {/* SCORE TAB */}
                    {activeTab === 'score' && (
                        <div className="space-y-4">

                            {submitted && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
                                    <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={20} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-800">Review Submitted Successfully</p>
                                        <p className="text-xs text-emerald-600 mt-0.5">Your scores have been recorded and cannot be changed.</p>
                                    </div>
                                </div>
                            )}

                            {categories.map((cat, catIdx) => {
                                const questions   = cat.questions ?? [];
                                const catEarned   = questions.reduce((s, q) => s + Number(answers[q.id]?.score ?? 0), 0);
                                const catMax      = questions.reduce((s, q) => s + (q.max_score ?? 0), 0);
                                const catPct      = catMax > 0 ? Math.round((catEarned / catMax) * 100) : 0;
                                const catWeighted = hasWeights
                                    ? parseFloat(((catEarned / (catMax || 1)) * cat.weight).toFixed(1))
                                    : null;
                                const accent = CATEGORY_ACCENTS[catIdx % CATEGORY_ACCENTS.length];

                                return (
                                    <div key={cat.id} className={`bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm border-l-4 ${accent}`}>

                                        {/* Category header */}
                                        <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-gray-100">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-sm font-bold text-gray-900">
                                                        {catIdx + 1}. {cat.name}
                                                    </h3>
                                                    {cat.weight != null && (
                                                        <span className="text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                            {cat.weight}% weight
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    {questions.length} question{questions.length !== 1 ? 's' : ''}
                                                    {catMax > 0 && ` · ${catEarned}/${catMax} pts`}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0">
                                                {/* Category progress bar */}
                                                <div className="hidden sm:flex items-center gap-2">
                                                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                            style={{ width: `${catPct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500 font-medium w-8 text-right">{catPct}%</span>
                                                </div>
                                                <div className="text-right">
                                                    {hasWeights ? (
                                                        <>
                                                            <p className="text-sm font-bold text-gray-800 tabular-nums">
                                                                {catWeighted}
                                                                <span className="text-xs font-normal text-gray-400">/{cat.weight}</span>
                                                            </p>
                                                            <p className="text-[10px] text-gray-400">weighted</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-sm font-bold text-gray-800 tabular-nums">{catEarned}/{catMax}</p>
                                                            <p className="text-[10px] text-gray-400">score</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Questions */}
                                        <div className="divide-y divide-gray-50">
                                            {questions.map((q, qIdx) => {
                                                const current = answers[q.id]?.score;
                                                const comment = answers[q.id]?.comment ?? '';
                                                const currentMeta = current != null ? SCORE_META[Math.min(current, SCORE_META.length - 1)] : null;
                                                const maxScore = q.max_score ?? 5;

                                                return (
                                                    <div key={q.id} className="p-5">
                                                        {/* Question */}
                                                        <div className="flex items-start gap-3 mb-4">
                                                            <span className="w-6 h-6 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                                {qIdx + 1}
                                                            </span>
                                                            <div className="flex-1">
                                                                <p className="text-sm text-gray-800 leading-relaxed">
                                                                    {q.question_text}
                                                                    {q.is_required && <span className="text-red-500 ml-1 text-xs">*required</span>}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Score buttons */}
                                                        <div className="ml-9">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {Array.from({ length: maxScore + 1 }, (_, i) => i).map(score => (
                                                                    <ScoreButton
                                                                        key={score}
                                                                        score={score}
                                                                        current={current}
                                                                        maxScore={maxScore}
                                                                        disabled={submitted}
                                                                        onClick={(s) => updateAnswer(q.id, 'score', s)}
                                                                    />
                                                                ))}

                                                                {/* Score label */}
                                                                {currentMeta && (
                                                                    <span className={`ml-1 text-xs font-semibold ${currentMeta.text} transition-all`}>
                                                                        {currentMeta.label}
                                                                        <span className="text-gray-400 font-normal ml-1">({current}/{maxScore})</span>
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Required warning */}
                                                            {q.is_required && current == null && (
                                                                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                                                    <AlertTriangle size={10} /> Please select a score
                                                                </p>
                                                            )}

                                                            {/* Comment */}
                                                            <textarea
                                                                value={comment}
                                                                onChange={e => updateAnswer(q.id, 'comment', e.target.value)}
                                                                disabled={submitted}
                                                                placeholder="Add a comment or justification (optional)…"
                                                                rows={2}
                                                                className="mt-3 w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none
                                                                           focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400
                                                                           placeholder-gray-300 bg-gray-50 focus:bg-white transition-colors
                                                                           disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {!submitted && categories.length > 0 && (
                                <div className="flex items-center justify-between pt-2 pb-6">
                                    <p className="text-xs text-gray-400">
                                        {answered}/{allQuestions.length} questions answered
                                    </p>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm shadow-blue-200 transition-colors"
                                    >
                                        {submitting ? 'Submitting…' : 'Submit Review'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DETAILS TAB */}
                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Abstract</h3>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        {proposal?.abstract || <span className="text-gray-400 italic">No abstract provided.</span>}
                                    </p>
                                </div>

                                {proposal?.keywords && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Keywords</h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {proposal.keywords.split(',').map(kw => kw.trim()).filter(Boolean).map(kw => (
                                                <span key={kw} className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-medium">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
                                <div className="h-9 w-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                                    <span className="text-lg">🔒</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-amber-800 mb-0.5">Blind Review — Identities Hidden</p>
                                    <p className="text-sm text-amber-700">
                                        Team size: <strong>{proposal?.members_count ?? 1}</strong> member(s)
                                    </p>
                                    <p className="text-xs text-amber-600 mt-1">
                                        Researcher identities are hidden to ensure unbiased evaluation.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DOCUMENTS TAB */}
                    {activeTab === 'documents' && (
                        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Uploaded Documents</h3>
                            {(proposal?.documents ?? []).length === 0 ? (
                                <div className="text-center py-8">
                                    <Paperclip size={28} className="mx-auto text-gray-200 mb-2" />
                                    <p className="text-sm text-gray-400">No documents uploaded.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {proposal.documents.map(doc => (
                                        <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center shrink-0">
                                                    <FileText size={15} className="text-red-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 capitalize truncate">
                                                        {doc.document_type?.replace(/_/g, ' ')}
                                                    </p>
                                                    <p className="text-xs text-gray-400 truncate">{doc.original_filename}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => downloadFile(
                                                    `/proposals/${proposal.id}/documents/${doc.id}/download`,
                                                    doc.original_filename
                                                ).catch(() => toast.error('Download failed.'))}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shrink-0 ml-3"
                                            >
                                                <Download size={12} /> Download
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* BUDGET TAB */}
                    {activeTab === 'budget' && (
                        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Budget Summary</h3>
                            {(proposal?.budgets ?? []).length === 0 ? (
                                <div className="text-center py-8">
                                    <DollarSign size={28} className="mx-auto text-gray-200 mb-2" />
                                    <p className="text-sm text-gray-400">No budget information available.</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {proposal.budgets.map((item, i) => (
                                        <div key={item.id ?? i} className="flex items-start justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 capitalize">{item.category}</p>
                                                {item.item_description && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{item.item_description}</p>
                                                )}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-800 shrink-0 ml-6 tabular-nums">
                                                ETB {parseFloat(item.amount ?? 0).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between px-4 py-3.5 bg-blue-600 rounded-xl text-white mt-3">
                                        <span className="text-sm font-bold">Total Budget Requested</span>
                                        <span className="text-base font-extrabold tabular-nums">
                                            ETB {proposal.budgets.reduce((s, i) => s + parseFloat(i.amount ?? 0), 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <Dialog />
        </AppLayout>
    );
}
