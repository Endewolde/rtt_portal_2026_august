import { useState, useEffect, useCallback } from 'react';
import { usePage, router, Link } from '@inertiajs/react';
import { Calendar, Users, Search, Info, Hourglass, ArrowRight, X } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import api from '../../lib/api';
import { get } from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

function WorkloadBadge({ count }) {
    if (count == null) return null;
    const cls =
        count === 0 ? 'bg-green-100 text-green-700' :
        count <= 2  ? 'bg-green-50  text-green-600' :
        count <= 5  ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100   text-red-700';
    return (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${cls}`}>
            {count} active
        </span>
    );
}

function BlindReviewHoldNotice({ collegeName, pending }) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-4 ring-amber-50">
                    <Hourglass size={20} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Open defence on hold</p>
                    <h2 className="mt-0.5 text-base font-bold text-gray-900">
                        Blind review is still in progress{collegeName ? ` for ${collegeName}` : ''}
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                        {pending.length} {pending.length === 1 ? 'proposal from your college has' : 'proposals from your college have'} not
                        yet completed the blind review phase. To keep the review process fair and consistent, open defence
                        sessions can be scheduled once every blind review in your college has been completed.
                    </p>
                </div>
            </div>

            {pending.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-100 bg-white/80">
                    <p className="border-b border-amber-100 px-4 py-2 text-xs font-semibold text-gray-500">
                        Remaining in blind review
                    </p>
                    <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
                        {pending.map((p) => (
                            <li key={p.id}>
                                <Link
                                    href={`/proposals/${p.id}`}
                                    className="group flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/60"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-xs text-gray-400">{p.tracker_number}</p>
                                        <p className="truncate text-sm font-medium text-gray-800">{p.title}</p>
                                    </div>
                                    <StatusBadge status={p.status} />
                                    <ArrowRight size={14} className="shrink-0 text-gray-300 group-hover:text-amber-600" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function ScheduleDefence() {
    const { url } = usePage();
    const id = url.split('/')[2];
    const toast = useToast();

    const [proposal, setProposal]               = useState(null);
    const [availableReviewers, setAvailableReviewers] = useState([]);
    const [reviewerSearch, setReviewerSearch]   = useState('');
    const [reviewersLoading, setReviewersLoading] = useState(false);
    const [evaluationTypes, setEvaluationTypes] = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [submitting, setSubmitting]           = useState(false);
    const [error, setError]                     = useState(null);
    const [blindReviewHold, setBlindReviewHold] = useState(null);
    // Edit mode: the proposal is already in open defence — update date/venue/panel.
    const [panel, setPanel]                     = useState([]); // current defence assignments
    const isEdit = proposal?.status === 'under_open_defence';
    const lockedIds = panel.filter((a) => a.status === 'submitted').map((a) => a.reviewer_id);

    const [form, setForm] = useState({
        scheduled_date:     '',
        scheduled_time:     '',
        venue:              '',
        online_link:        '',
        reviewer_ids:       [],
        evaluation_type_id: '',
    });

    const fetchReviewers = useCallback(async (search) => {
        setReviewersLoading(true);
        try {
            const params = search ? { search } : {};
            const r = await get(`/proposals/${id}/available-reviewers`, params);
            setAvailableReviewers(r.data?.data ?? r.data ?? []);
        } catch { /* silent */ }
        setReviewersLoading(false);
    }, [id]);

    useEffect(() => {
        Promise.all([
            api.get(`/proposals/${id}`),
            api.get('/evaluation-types'),
            api.get(`/proposals/${id}/defence/readiness`).catch(() => null),
        ])
            .then(([propRes, typeRes, readinessRes]) => {
                const prop = propRes.data?.data ?? propRes.data;
                setProposal(prop);

                const readiness = readinessRes?.data?.data;
                if (prop?.status === 'under_open_defence') {
                    api.get(`/proposals/${id}/defence/session`).then((r) => {
                        const { session, assignments = [] } = r.data?.data ?? {};
                        setPanel(assignments);
                        setForm((f) => ({
                            ...f,
                            scheduled_date:     session?.scheduled_date ? String(session.scheduled_date).slice(0, 10) : '',
                            scheduled_time:     session?.scheduled_time ? String(session.scheduled_time).slice(0, 5) : '',
                            venue:              session?.venue ?? '',
                            online_link:        session?.online_link ?? '',
                            reviewer_ids:       assignments.map((a) => a.reviewer_id),
                            evaluation_type_id: assignments[0]?.evaluation_type_id ?? f.evaluation_type_id,
                        }));
                    }).catch(() => setError('Could not load the current defence details.'));
                } else if (readiness && !readiness.can_schedule) {
                    setBlindReviewHold({
                        collegeName: readiness.college_name,
                        pending: readiness.pending_blind_review ?? [],
                    });
                }

                const allTypes = typeRes.data?.data ?? [];
                const defenceTypes = allTypes.filter(
                    (t) => t.name?.startsWith('open_defence') &&
                           (!prop?.category || t.proposal_category === prop.category)
                );
                setEvaluationTypes(defenceTypes);
                if (defenceTypes.length === 1) {
                    setForm((f) => ({ ...f, evaluation_type_id: defenceTypes[0].id }));
                }
            })
            .catch(() => setError('Failed to load page data.'))
            .finally(() => { setLoading(false); fetchReviewers(''); });
    }, [id]);

    useEffect(() => {
        if (loading) return;
        const t = setTimeout(() => fetchReviewers(reviewerSearch), 350);
        return () => clearTimeout(t);
    }, [reviewerSearch, loading]);

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    const today = new Date().toISOString().split('T')[0];

    // Reviewers may score on the defence day and until the end of the next day.
    const scoreDeadlineLabel = form.scheduled_date
        ? (() => {
            const d = new Date(`${form.scheduled_date}T23:59`);
            d.setDate(d.getDate() + 1);
            return d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        })()
        : null;

    const toggleReviewer = (reviewerId) => {
        if (lockedIds.includes(reviewerId)) {
            toast.warning('This reviewer has already submitted a score and stays on the panel.');
            return;
        }
        setForm((f) => ({
            ...f,
            reviewer_ids: f.reviewer_ids.includes(reviewerId)
                ? f.reviewer_ids.filter((r) => r !== reviewerId)
                : [...f.reviewer_ids, reviewerId],
        }));
    };

    const submit = async () => {
        if (!form.scheduled_date) {
            toast.warning('Please select a defence date.', { title: 'Date Required' });
            return;
        }
        if (!form.scheduled_time) {
            toast.warning('Please select a defence time.', { title: 'Time Required' });
            return;
        }
        if (!form.venue.trim()) {
            toast.warning('Please enter the venue.', { title: 'Venue Required' });
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const payload = {
                scheduled_date:     form.scheduled_date,
                scheduled_time:     form.scheduled_time,
                venue:              form.venue,
                online_link:        form.online_link || null,
                reviewer_ids:       form.reviewer_ids,
                evaluation_type_id: form.evaluation_type_id || null,
            };
            if (isEdit) {
                const res = await api.put(`/proposals/${id}/defence/session`, payload);
                toast.success(res.data?.message ?? 'Open defence updated.');
            } else {
                await api.post(`/proposals/${id}/defence/schedule`, payload);
                toast.success('Open defence scheduled successfully.');
            }
            router.visit('/admin/open-defence');
        } catch (e) {
            const body = e.response?.data;
            if (body?.meta?.reason === 'blind_review_incomplete') {
                setBlindReviewHold({
                    collegeName: body.meta.college_name,
                    pending: body.meta.pending_blind_review ?? [],
                });
                toast.warning(body.message, { title: 'Open Defence On Hold' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const msg = body?.message ?? 'Failed to schedule defence. Please try again.';
                setError(msg);
                toast.error(msg, { title: 'Schedule Failed' });
            }
        }
        setSubmitting(false);
    };

    if (loading) {
        return (
            <AppLayout breadcrumb="Schedule Open Defence">
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumb={`Proposals / ${proposal?.tracker_number ?? id} / ${isEdit ? 'Update Defence' : 'Schedule Defence'}`}>
            <div className="max-w-xl mx-auto space-y-5">

                {blindReviewHold && (
                    <BlindReviewHoldNotice
                        collegeName={blindReviewHold.collegeName}
                        pending={blindReviewHold.pending}
                    />
                )}

                {/* Proposal summary */}
                {proposal && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-mono text-xs text-gray-400 mb-1">{proposal.tracker_number}</p>
                                <h1 className="text-base font-bold text-gray-900">{proposal.title}</h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    {getCategoryLabel(proposal.category)} · {proposal.college?.name ?? '—'}
                                </p>
                            </div>
                            <StatusBadge status={proposal.status} />
                        </div>
                    </div>
                )}

                {/* Defence details */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Calendar size={18} className="text-purple-600" />
                        <h2 className="text-base font-semibold text-gray-800">Defence Details</h2>
                    </div>

                    {isEdit && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                            <Info size={13} className="mt-0.5 shrink-0" />
                            <span>
                                This defence is already scheduled. Changing the date resets the score deadline to the day after the new date
                                and moves every reviewer's due date with it. Newly added reviewers are notified; reviewers who already scored stay on the panel.
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.scheduled_date}
                                onChange={(e) => set('scheduled_date', e.target.value)}
                                min={today}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Time <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="time"
                                value={form.scheduled_time}
                                onChange={(e) => set('scheduled_time', e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-purple-100 bg-purple-50/60 px-3 py-2.5 text-xs text-purple-900">
                        <Info size={13} className="mt-0.5 shrink-0 text-purple-500" />
                        <span>
                            Reviewers submit scores during the presentation or by the end of the following day
                            {scoreDeadlineLabel ? <> — <strong>{scoreDeadlineLabel}</strong></> : ''}. After that, submission is closed unless the
                            college officer's extension request is approved.
                        </span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Venue <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.venue}
                            onChange={(e) => set('venue', e.target.value)}
                            placeholder="e.g. Conference Room A, Building 3"
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Online Meeting Link <span className="text-xs text-gray-400">(optional)</span>
                        </label>
                        <input
                            type="url"
                            value={form.online_link}
                            onChange={(e) => set('online_link', e.target.value)}
                            placeholder="https://meet.example.com/…"
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                </div>

                {/* Evaluation type + reviewers */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Users size={18} className="text-purple-600" />
                        <h2 className="text-base font-semibold text-gray-800">Evaluation Type &amp; Reviewers</h2>
                    </div>

                    {evaluationTypes.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Evaluation Type
                            </label>
                            <select
                                value={form.evaluation_type_id}
                                onChange={(e) => set('evaluation_type_id', e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">— Select evaluation type —</option>
                                {evaluationTypes.map((t) => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                {isEdit ? 'Defence Reviewers' : <>Assign Defence Reviewers <span className="text-xs text-gray-400">(optional)</span></>}
                            </label>
                        </div>
                        {form.reviewer_ids.length > 0 && (
                            <div className="mb-3 rounded-lg border border-purple-100 bg-purple-50/50 p-2.5">
                                <p className="mb-1.5 text-xs font-semibold text-purple-800">
                                    {isEdit ? 'Defence panel' : 'Selected reviewers'} ({form.reviewer_ids.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {form.reviewer_ids.map((rid) => {
                                        const current = panel.find((a) => a.reviewer_id === rid);
                                        const person = current?.reviewer ?? availableReviewers.find((r) => r.id === rid);
                                        const locked = lockedIds.includes(rid);
                                        return (
                                            <span key={rid} className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800">
                                                {person ? `${person.title ? `${person.title} ` : ''}${person.name}` : 'Reviewer'}
                                                {locked ? (
                                                    <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">Scored</span>
                                                ) : current ? (
                                                    <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-500">Assigned</span>
                                                ) : (
                                                    <span className="rounded-full bg-purple-100 px-1.5 text-[10px] font-semibold text-purple-700">New</span>
                                                )}
                                                {!locked && (
                                                    <button type="button" onClick={() => toggleReviewer(rid)} aria-label="Remove reviewer" className="text-gray-400 hover:text-red-500">
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 mb-2 focus-within:ring-2 focus-within:ring-purple-500">
                            <Search size={14} className="text-gray-400 mr-2 shrink-0" />
                            <input value={reviewerSearch} onChange={(e) => setReviewerSearch(e.target.value)}
                                placeholder="Search by name, email, or expertise…"
                                className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400" />
                        </div>
                        <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-2">
                            <Info size={12} className="mt-0.5 shrink-0" />
                            PI and Co-Investigators are excluded. Select multiple reviewers for interdisciplinary proposals.
                        </div>
                        {reviewersLoading ? (
                            <div className="flex justify-center py-4">
                                <div className="animate-spin h-5 w-5 rounded-full border-2 border-purple-600 border-t-transparent" />
                            </div>
                        ) : availableReviewers.length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-4">No eligible reviewers available.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                                {availableReviewers.map((reviewer) => (
                                    <label key={reviewer.id}
                                        className={`flex items-start gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                                            form.reviewer_ids.includes(reviewer.id)
                                                ? 'bg-purple-50 border border-purple-300'
                                                : 'hover:bg-gray-50 border border-transparent'
                                        }`}>
                                        <input type="checkbox"
                                            checked={form.reviewer_ids.includes(reviewer.id)}
                                            onChange={() => toggleReviewer(reviewer.id)}
                                            className="mt-0.5 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-medium text-gray-800 truncate">
                                                    {reviewer.title ? `${reviewer.title} ` : ''}{reviewer.name}
                                                </p>
                                                <WorkloadBadge count={reviewer.active_assignments} />
                                            </div>
                                            <p className="text-xs text-gray-400 truncate">
                                                {reviewer.email}
                                                {reviewer.college?.name && ` · ${reviewer.college.name}`}
                                            </p>
                                            {reviewer.expertise?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {reviewer.expertise.map((e, i) => (
                                                        <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                                                            {e}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                        {form.reviewer_ids.length > 0 && (
                            <p className="text-xs text-purple-600 mt-1.5 font-medium">
                                {form.reviewer_ids.length} reviewer{form.reviewer_ids.length !== 1 ? 's' : ''} selected
                            </p>
                        )}
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3 pb-6">
                    <button
                        onClick={() => router.visit(isEdit ? '/admin/open-defence' : `/proposals/${id}`)}
                        className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting || !!blindReviewHold}
                        title={blindReviewHold ? 'Available once every blind review in your college is complete' : undefined}
                        className="flex-1 rounded-lg bg-purple-700 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {submitting ? (isEdit ? 'Saving…' : 'Scheduling…') : (isEdit ? 'Save Changes' : 'Schedule Defence')}
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}
