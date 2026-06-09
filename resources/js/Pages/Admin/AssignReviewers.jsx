import { useState, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import { Search, UserCheck } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import { get, post } from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

export default function AssignReviewers() {
    const { url } = usePage();
    const id = url.split('/')[2];
    const toast = useToast();

    const [proposal, setProposal] = useState(null);
    const [reviewers, setReviewers] = useState([]);
    const [evalTypes, setEvalTypes] = useState([]);
    const [selected, setSelected] = useState([]);
    const [evalType, setEvalType] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        Promise.all([
            get(`/proposals/${id}`),
            get(`/proposals/${id}/available-reviewers`),
        ]).then(([p, r]) => {
            const proposal = p.data;
            setProposal(proposal);
            setReviewers(r.data ?? []);
            // Load eval types filtered by this proposal's category
            return get('/evaluation-types', { category: proposal.category });
        }).then((t) => {
            const all = t.data ?? [];
            setEvalTypes(all.filter(type => type.name?.startsWith('blind_review')));
        }).catch(() => {
            setError('Failed to load data. Please try again.');
        }).finally(() => setLoading(false));
    }, [id]);

    const toggleReviewer = (rid) =>
        setSelected((s) => s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid]);

    const assign = async () => {
        if (!selected.length || !evalType) {
            toast.warning('Select at least one reviewer and an evaluation type.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await post(`/proposals/${id}/review/assign`, {
                reviewer_ids:       selected,
                evaluation_type_id: evalType,
            });
            toast.success('Reviewers assigned. Proposal moved to Blind Review.');
            router.visit('/admin/blind-review');
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Assignment failed. Please try again.';
            setError(msg);
            toast.error(msg);
        }
        setSubmitting(false);
    };

    const filtered = reviewers.filter((r) =>
        !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return (
        <AppLayout breadcrumb="Assign Reviewers">
            <div className="flex justify-center py-16">
                <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
        </AppLayout>
    );

    return (
        <AppLayout breadcrumb={`Proposals / ${proposal?.tracker_number ?? id} / Assign Reviewers`}>
            <div className="max-w-2xl mx-auto space-y-5">

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

                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">

                    {/* Evaluation type */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Evaluation Type <span className="text-red-500">*</span>
                        </label>
                        {evalTypes.length === 0
                            ? <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                No evaluation types found for this category. Contact the administrator.
                              </p>
                            : (
                                <select value={evalType} onChange={(e) => setEvalType(e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select evaluation type…</option>
                                    {evalTypes.map((t) => (
                                        <option key={t.id} value={t.id}>{t.label ?? t.name}</option>
                                    ))}
                                </select>
                            )
                        }
                    </div>

                    {/* Reviewer search */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Available Reviewers
                        </label>
                        <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 mb-3 focus-within:ring-2 focus-within:ring-blue-500">
                            <Search size={15} className="text-gray-400 mr-2 shrink-0" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name or email…"
                                className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400" />
                        </div>

                        {filtered.length === 0
                            ? <p className="text-sm text-gray-400 text-center py-6">No available reviewers.</p>
                            : (
                                <div className="space-y-2 max-h-72 overflow-y-auto">
                                    {filtered.map((r) => (
                                        <label key={r.id}
                                            className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                                                selected.includes(r.id)
                                                    ? 'border-blue-400 bg-blue-50'
                                                    : 'border-gray-200 hover:bg-gray-50'
                                            }`}>
                                            <input type="checkbox" checked={selected.includes(r.id)}
                                                onChange={() => toggleReviewer(r.id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                                                <p className="text-xs text-gray-400 truncate">
                                                    {r.email}
                                                    {r.active_assignments != null && ` · ${r.active_assignments} active`}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )
                        }
                    </div>

                    {/* Selected summary */}
                    {selected.length > 0 && (
                        <p className="text-sm text-blue-700 font-medium">
                            {selected.length} reviewer{selected.length !== 1 ? 's' : ''} selected
                        </p>
                    )}

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <button onClick={assign}
                        disabled={submitting || !selected.length || !evalType}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                        <UserCheck size={16} />
                        {submitting ? 'Assigning…' : `Assign ${selected.length || ''} Reviewer${selected.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}
