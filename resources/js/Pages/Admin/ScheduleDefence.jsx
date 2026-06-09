import { useState, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import { Calendar, Users } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import api from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

export default function ScheduleDefence() {
    const { url } = usePage();
    const id = url.split('/')[2];
    const toast = useToast();

    const [proposal, setProposal] = useState(null);
    const [availableReviewers, setAvailableReviewers] = useState([]);
    const [evaluationTypes, setEvaluationTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [form, setForm] = useState({
        scheduled_date:     '',
        scheduled_time:     '',
        venue:              '',
        online_link:        '',
        reviewer_ids:       [],
        evaluation_type_id: '',
    });

    useEffect(() => {
        Promise.all([
            api.get(`/proposals/${id}`),
            api.get(`/proposals/${id}/available-reviewers`),
            api.get('/evaluation-types'),
        ])
            .then(([propRes, reviewerRes, typeRes]) => {
                const prop = propRes.data?.data ?? propRes.data;
                setProposal(prop);
                setAvailableReviewers(reviewerRes.data?.data ?? []);

                // Only show open_defence types that match the proposal's category
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
            .finally(() => setLoading(false));
    }, [id]);

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    const toggleReviewer = (reviewerId) => {
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
            await api.post(`/proposals/${id}/defence/schedule`, {
                scheduled_date:     form.scheduled_date,
                scheduled_time:     form.scheduled_time,
                venue:              form.venue,
                online_link:        form.online_link || null,
                reviewer_ids:       form.reviewer_ids,
                evaluation_type_id: form.evaluation_type_id || null,
            });
            toast.success('Open defence scheduled successfully.');
            router.visit('/admin/open-defence');
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Failed to schedule defence. Please try again.';
            setError(msg);
            toast.error(msg, { title: 'Schedule Failed' });
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
        <AppLayout breadcrumb={`Proposals / ${proposal?.tracker_number ?? id} / Schedule Defence`}>
            <div className="max-w-xl mx-auto space-y-5">

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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.scheduled_date}
                                onChange={(e) => set('scheduled_date', e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Assign Defence Reviewers <span className="text-xs text-gray-400">(optional)</span>
                        </label>
                        {availableReviewers.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No eligible reviewers available.</p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                                {availableReviewers.map((reviewer) => (
                                    <label
                                        key={reviewer.id}
                                        className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.reviewer_ids.includes(reviewer.id)}
                                            onChange={() => toggleReviewer(reviewer.id)}
                                            className="w-4 h-4 text-purple-600 rounded"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{reviewer.name}</p>
                                            <p className="text-xs text-gray-400">{reviewer.email}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                        {form.reviewer_ids.length > 0 && (
                            <p className="text-xs text-purple-600 mt-1">
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
                        onClick={() => router.visit(`/proposals/${id}`)}
                        className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting}
                        className="flex-1 rounded-lg bg-purple-700 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
                    >
                        {submitting ? 'Scheduling…' : 'Schedule Defence'}
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}
