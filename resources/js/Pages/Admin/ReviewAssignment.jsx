import { useState, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { useToast } from '../../Components/Toast';

export default function ReviewAssignment() {
    const { error: toastError } = useToast();
    const { url } = usePage();
    const id = url.split('/').pop();
    const [proposal, setProposal] = useState(null);
    const [reviewers, setReviewers] = useState([]);
    const [evalTypes, setEvalTypes] = useState([]);
    const [selected, setSelected] = useState([]);
    const [evalType, setEvalType] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        Promise.all([
            get(`/proposals/${id}`),
            get(`/proposals/${id}/available-reviewers`),
        ]).then(([p, r]) => {
            setProposal(p.data);
            setReviewers(r.data ?? []);
        }).catch(() => {}).finally(() => setLoading(false));
    }, [id]);

    const toggleReviewer = (rid) => setSelected((s) => s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid]);

    const assign = async () => {
        if (!selected.length || !evalType) return toastError('Select at least one reviewer and evaluation type.');
        setSubmitting(true);
        try {
            await post(`/proposals/${id}/review/assign`, { reviewer_ids: selected, evaluation_type_id: evalType });
            router.visit('/proposals');
        } catch (e) { toastError(e.response?.data?.message ?? 'Assignment failed.'); }
        setSubmitting(false);
    };

    if (loading) return <AppLayout breadcrumb="Assign Reviewers"><div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" /></div></AppLayout>;

    return (
        <AppLayout breadcrumb="Assign Reviewers">
            <div className="max-w-2xl mx-auto space-y-6">
                {proposal && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h1 className="text-lg font-bold text-gray-900 mb-1">{proposal.title}</h1>
                        <p className="text-sm text-gray-500 font-mono">{proposal.tracker_number}</p>
                    </div>
                )}

                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-gray-700">Available Reviewers</h2>
                    {reviewers.length === 0
                        ? <p className="text-sm text-gray-400">No available reviewers.</p>
                        : reviewers.map((r) => (
                            <label key={r.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleReviewer(r.id)}
                                    className="rounded border-gray-300 text-blue-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{r.name}</p>
                                    <p className="text-xs text-gray-400">{r.email} · {r.active_assignments ?? 0} active</p>
                                </div>
                            </label>
                        ))
                    }

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Type</label>
                        <select value={evalType} onChange={(e) => setEvalType(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none">
                            <option value="">Select type…</option>
                            {evalTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <button onClick={assign} disabled={submitting || !selected.length}
                        className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                        {submitting ? 'Assigning…' : `Assign ${selected.length} Reviewer${selected.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}
