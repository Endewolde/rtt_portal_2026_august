import { useState, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import { Download, FileText } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { downloadFile } from '../../lib/download';
import { useConfirm } from '../../hooks/useConfirm';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';

const SCORE_LABELS = {
    0: 'None',
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
};

function scoreButtonClass(score, current) {
    if (current === score) {
        if (score === 0)  return 'border-red-500    bg-red-500    text-white scale-110';
        if (score <= 2)   return 'border-orange-400 bg-orange-400 text-white scale-110';
        if (score <= 3)   return 'border-yellow-400 bg-yellow-400 text-white scale-110';
        if (score <= 4)   return 'border-blue-500   bg-blue-500   text-white scale-110';
        return                    'border-green-500  bg-green-500  text-white scale-110';
    }
    return 'border-gray-300 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600';
}

export default function ReviewScore() {
    const { url }        = usePage();
    const assignmentId   = url.split('/')[2];
    const toast          = useToast();
    const { confirm, Dialog } = useConfirm();

    const [assignment, setAssignment]   = useState(null);
    const [answers, setAnswers]         = useState({});
    const [activeTab, setActiveTab]     = useState('score');
    const [loading, setLoading]         = useState(true);
    const [submitting, setSubmitting]   = useState(false);
    const [submitted, setSubmitted]     = useState(false);

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

    // Running score — weighted when every category has a weight, simple otherwise
    const categories  = assignment?.evaluation_type?.categories ?? [];
    const allQuestions = categories.flatMap(c => c.questions ?? []);
    const hasWeights  = categories.length > 0 && categories.every(c => c.weight != null && c.weight > 0);
    const totalWeight = hasWeights ? categories.reduce((s, c) => s + c.weight, 0) : 0;

    let earned, maxTotal, pct;
    if (hasWeights) {
        // weighted: Σ(catPct × catWeight) out of totalWeight
        let weightedSum = 0;
        categories.forEach(cat => {
            const qs      = cat.questions ?? [];
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

    const handleSubmit = async () => {
        const unanswered = allQuestions.filter(
            q => q.is_required && (answers[q.id]?.score == null)
        );
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

    const proposal = assignment?.proposal;

    // Gate open-defence reviews until the scheduled date is reached
    const isOpenDefence   = assignment?.evaluation_type?.name?.startsWith('open_defence');
    const defenceSession  = assignment?.defence_session;
    const scheduledDateStr = defenceSession?.scheduled_date; // "YYYY-MM-DD"
    const isBeforeSchedule = (() => {
        if (!isOpenDefence || !scheduledDateStr) return false;
        // Compare calendar dates only (strip time) — same logic as assertDefenceDateWindow
        const today   = new Date(); today.setHours(0, 0, 0, 0);
        const session = new Date(scheduledDateStr + 'T00:00:00'); // parse as local date
        return today < session;
    })();

    if (loading) return (
        <AppLayout breadcrumb="Score Review">
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        </AppLayout>
    );

    if (!assignment) return (
        <AppLayout breadcrumb="Score Review">
            <p className="text-gray-500 text-sm p-6">Assignment not found.</p>
        </AppLayout>
    );

    if (isBeforeSchedule) {
        const fmt = new Date(scheduledDateStr + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        const time = defenceSession?.scheduled_time
            ? defenceSession.scheduled_time.slice(0, 5)   // "HH:mm"
            : null;
        const venue = defenceSession?.venue;

        return (
            <AppLayout breadcrumb="Score Review">
                <div className="min-h-[60vh] flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white border border-amber-200 rounded-2xl p-8 text-center shadow-sm">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🗓</span>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">
                            Defence Not Yet Started
                        </h2>
                        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                            This open defence session has not been reached yet.
                            You can only submit your scores on the scheduled date.
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-left space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-amber-500">📅</span>
                                <span className="text-gray-700 font-medium">{fmt}</span>
                            </div>
                            {time && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-amber-500">🕐</span>
                                    <span className="text-gray-700">{time}</span>
                                </div>
                            )}
                            {venue && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-amber-500">📍</span>
                                    <span className="text-gray-700">{venue}</span>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mb-5">
                            Please return on the scheduled date to submit your evaluation.
                        </p>
                        <button
                            onClick={() => window.history.back()}
                            className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
                        >
                            ← Go Back
                        </button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumb="Score Review">
            <div className="min-h-screen bg-gray-50 -m-6">

                {/* ── Sticky top bar ────────────────────────────────────────── */}
                <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
                    <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded shrink-0">
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

                        <div className="flex items-center gap-4 shrink-0">
                            {/* Live score */}
                            <div className="text-right">
                                <div className={`text-xl font-bold leading-none ${pct >= 60 ? 'text-green-600' : 'text-orange-500'}`}>
                                    {earned}<span className="text-sm font-normal text-gray-400">/{maxTotal}</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">{pct}%</div>
                            </div>
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${pct >= 60 ? 'bg-green-500' : 'bg-orange-400'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            {!submitted && (
                                <button onClick={handleSubmit} disabled={submitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                                    {submitting ? 'Submitting…' : 'Submit Review'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="max-w-5xl mx-auto px-6 flex border-t border-gray-100 overflow-x-auto">
                        {[
                            { key: 'score',     label: '📝 Score Questions' },
                            { key: 'details',   label: '📄 Details' },
                            { key: 'documents', label: '📎 Documents' },
                            { key: 'budget',    label: '💰 Budget' },
                        ].map(tab => (
                            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                                className={`px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                                    activeTab === tab.key
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Tab content ───────────────────────────────────────────── */}
                <div className="max-w-5xl mx-auto px-6 py-6">

                    {/* SCORE TAB */}
                    {activeTab === 'score' && (
                        <div className="space-y-4">
                            {submitted && (
                                <div className="bg-green-50 border border-green-300 rounded-xl p-4 text-center">
                                    <p className="text-green-700 font-semibold text-sm">
                                        ✓ Review submitted. Your scores have been recorded.
                                    </p>
                                </div>
                            )}

                            {categories.map((cat, catIdx) => {
                                const questions  = cat.questions ?? [];
                                const catEarned  = questions.reduce((s, q) => s + Number(answers[q.id]?.score ?? 0), 0);
                                const catMax     = questions.reduce((s, q) => s + (q.max_score ?? 0), 0);
                                const catPct     = catMax > 0 ? catEarned / catMax : 0;
                                const catWeighted = hasWeights ? parseFloat((catPct * cat.weight).toFixed(1)) : null;

                                return (
                                    <div key={cat.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                        {/* Category header */}
                                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-semibold text-gray-900">
                                                        {catIdx + 1}. {cat.name}
                                                    </h3>
                                                    {cat.weight != null && (
                                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                            {cat.weight}%
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {questions.length} question{questions.length !== 1 ? 's' : ''}
                                                    {catMax > 0 && ` · raw ${catEarned}/${catMax} pts`}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                {hasWeights ? (
                                                    <>
                                                        <p className="text-sm font-bold text-gray-700">
                                                            {catWeighted}
                                                            <span className="text-xs font-normal text-gray-400">/{cat.weight}</span>
                                                        </p>
                                                        <p className="text-xs text-gray-400">weighted pts</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm font-bold text-gray-700">{catEarned}/{catMax}</p>
                                                        <p className="text-xs text-gray-400">score</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Questions — always expanded, no accordion */}
                                        <div className="divide-y divide-gray-100">
                                            {questions.map((q, qIdx) => {
                                                const current = answers[q.id]?.score;
                                                const comment = answers[q.id]?.comment ?? '';

                                                return (
                                                    <div key={q.id} className="p-5">
                                                        {/* Question text */}
                                                        <div className="flex items-start gap-3 mb-3">
                                                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                                {qIdx + 1}
                                                            </span>
                                                            <p className="text-sm text-gray-800 leading-relaxed">
                                                                {q.question_text}
                                                                {q.is_required && <span className="text-red-500 ml-1">*</span>}
                                                            </p>
                                                        </div>

                                                        {/* Score buttons — FIXED h-12 row, no layout shift */}
                                                        <div className="ml-9">
                                                            <div className="flex items-center gap-2 h-12">
                                                                {Array.from({ length: (q.max_score ?? 5) + 1 }, (_, i) => i).map(score => (
                                                                    <button
                                                                        key={score}
                                                                        type="button"
                                                                        disabled={submitted}
                                                                        title={`${score} — ${SCORE_LABELS[score] ?? score}`}
                                                                        onClick={() => updateAnswer(q.id, 'score', score)}
                                                                        className={`w-10 h-10 rounded-full border-2 shrink-0 flex items-center justify-center text-sm font-bold transition-all duration-100 ${scoreButtonClass(score, current)} ${submitted ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                    >
                                                                        {score}
                                                                    </button>
                                                                ))}
                                                                {/* Inline label — always in DOM but invisible until scored */}
                                                                <span className={`ml-2 text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${current != null ? 'opacity-100 text-gray-600' : 'opacity-0'}`}>
                                                                    {current != null ? `— ${SCORE_LABELS[current] ?? current}` : '—'}{' '}
                                                                    <span className="text-xs text-gray-400">
                                                                        {current != null ? `(${current}/${q.max_score})` : ''}
                                                                    </span>
                                                                </span>
                                                            </div>

                                                            {/* Required error — fixed height placeholder */}
                                                            <div className="h-4 mt-0.5">
                                                                {q.is_required && current == null && (
                                                                    <p className="text-xs text-red-500">Please select a score</p>
                                                                )}
                                                            </div>

                                                            {/* Comment textarea */}
                                                            <textarea
                                                                value={comment}
                                                                onChange={e => updateAnswer(q.id, 'comment', e.target.value)}
                                                                disabled={submitted}
                                                                placeholder="Add comment (optional)…"
                                                                rows={2}
                                                                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-300 disabled:bg-gray-50 disabled:text-gray-400"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {!submitted && (
                                <div className="flex justify-end pt-2 pb-6">
                                    <button onClick={handleSubmit} disabled={submitting}
                                        className="px-8 py-3 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 shadow-sm">
                                        {submitting ? 'Submitting…' : 'Submit Review'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DETAILS TAB */}
                    {activeTab === 'details' && (
                        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Abstract</h3>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    {proposal?.abstract || <span className="text-gray-400 italic">No abstract provided.</span>}
                                </p>
                            </div>
                            {proposal?.keywords && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Keywords</h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {proposal.keywords.split(',').map(kw => kw.trim()).filter(Boolean).map(kw => (
                                            <span key={kw} className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">{kw}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-sm font-semibold text-amber-800 mb-1">🔒 Blind Review — Identities Hidden</p>
                                <p className="text-sm text-amber-700">
                                    Team size: <strong>{proposal?.members_count ?? 1}</strong> member(s)
                                </p>
                                <p className="text-xs text-amber-600 mt-1">
                                    Researcher identities are hidden to ensure unbiased evaluation.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* DOCUMENTS TAB */}
                    {activeTab === 'documents' && (
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
                            {(proposal?.documents ?? []).length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No documents uploaded.</p>
                            ) : (
                                <div className="space-y-3">
                                    {(proposal.documents).map(doc => (
                                        <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center shrink-0">
                                                    <FileText size={15} className="text-red-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 capitalize">
                                                        {doc.document_type?.replace(/_/g, ' ')}
                                                    </p>
                                                    <p className="text-xs text-gray-400">{doc.original_filename}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => downloadFile(
                                                    `/proposals/${proposal.id}/documents/${doc.id}/download`,
                                                    doc.original_filename
                                                ).catch(() => toast.error('Download failed.'))}
                                                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 px-4 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 font-medium transition-colors"
                                            >
                                                <Download size={13} /> Download
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* BUDGET TAB */}
                    {activeTab === 'budget' && (
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Budget Summary</h3>
                            {(proposal?.budgets ?? []).length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No budget information available.</p>
                            ) : (
                                <div className="space-y-2">
                                    {(proposal.budgets).map((item, i) => (
                                        <div key={item.id ?? i} className={`flex items-start justify-between p-4 rounded-xl ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white border border-gray-100'}`}>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 capitalize">{item.category}</p>
                                                {item.item_description && (
                                                    <p className="text-xs text-gray-500 mt-0.5">{item.item_description}</p>
                                                )}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-900 shrink-0 ml-6">
                                                ETB {parseFloat(item.amount ?? 0).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between p-4 bg-blue-600 rounded-xl text-white">
                                        <span className="font-bold text-sm">Total Budget Requested</span>
                                        <span className="text-lg font-bold">
                                            ETB {(proposal.budgets).reduce((s, i) => s + parseFloat(i.amount ?? 0), 0).toLocaleString()}
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
