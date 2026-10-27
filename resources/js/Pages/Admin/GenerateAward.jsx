import { useState, useEffect } from 'react';
import { usePage, router, Link } from '@inertiajs/react';
import { Award, Trophy, RefreshCw } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import TrackerNumberDisplay from '../../Components/TrackerNumberDisplay';
import api from '../../lib/api';
import { getCategoryLabel, formatCurrency } from '../../lib/utils';
import { useToast } from '../../Components/Toast';
import { currency } from '../../lib/terms';

export default function GenerateAward() {
    const { url } = usePage();
    const id = url.split('/')[2];
    const toast = useToast();

    const [proposal, setProposal]           = useState(null);
    const [existingAward, setExistingAward] = useState(null);
    const [proposalBudget, setProposalBudget] = useState(null);
    const [loading, setLoading]             = useState(true);
    const [submitting, setSubmitting]       = useState(false);
    const [error, setError]                 = useState(null);
    const [form, setForm]                   = useState({ awarded_amount: '', approval_notes: '' });

    useEffect(() => {
        if (!id) return;
        setLoading(true);

        Promise.allSettled([
            api.get(`/proposals/${id}`),
            api.get(`/proposals/${id}/award-details`),
            api.get(`/proposals/${id}/budget`),
        ]).then(([propResult, awardResult, budgetResult]) => {
            if (propResult.status === 'fulfilled') {
                const p = propResult.value.data?.data ?? propResult.value.data;
                setProposal(p);
            }

            if (awardResult.status === 'fulfilled') {
                const aw = awardResult.value.data?.data ?? awardResult.value.data;
                if (aw?.id) {
                    setExistingAward(aw);
                    setForm({
                        awarded_amount: aw.awarded_amount ?? '',
                        approval_notes: aw.approval_notes ?? '',
                    });
                }
            }

            if (budgetResult.status === 'fulfilled') {
                const budget = budgetResult.value.data?.data ?? null;
                setProposalBudget(budget);
            }
        }).finally(() => setLoading(false));
    }, [id]);

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

    // Create new award (proposal in 'accepted' state)
    const handleCreate = async () => {
        if (!form.awarded_amount || Number(form.awarded_amount) <= 0) {
            setError('A valid awarded amount is required.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const res = await api.post(`/proposals/${id}/award`, {
                awarded_amount: Number(form.awarded_amount),
                approval_notes: form.approval_notes || null,
            });
            const aw = res.data?.data ?? res.data;
            setExistingAward(aw);
            toast.success(`Award generated. Grant: ${aw.grant_reference}`);
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Failed to generate award.';
            setError(msg);
            toast.error(msg, { title: 'Award Failed' });
        }
        setSubmitting(false);
    };

    // Update existing award
    const handleUpdate = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await api.put(`/proposals/${id}/award-details`, {
                awarded_amount: form.awarded_amount ? Number(form.awarded_amount) : undefined,
                approval_notes: form.approval_notes || null,
            });
            const aw = res.data?.data ?? res.data;
            setExistingAward(aw);
            toast.success('Award details updated.');
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Update failed.';
            setError(msg);
            toast.error(msg);
        }
        setSubmitting(false);
    };

    if (loading) return (
        <AppLayout breadcrumb="Award">
            <div className="flex justify-center py-16">
                <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
        </AppLayout>
    );

    const previewYear = proposal?.academic_year ?? new Date().getFullYear();

    return (
        <AppLayout breadcrumb={`Proposals / ${proposal?.tracker_number ?? id} / Award`}>
            <div className="max-w-xl mx-auto space-y-5">

                {/* Proposal summary */}
                {proposal && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                {proposal.tracker_number && (
                                    <TrackerNumberDisplay trackerNumber={proposal.tracker_number} />
                                )}
                                <h1 className="text-base font-bold text-gray-900 mt-1">{proposal.title}</h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    {getCategoryLabel(proposal.category)} · {proposal.college?.name ?? '—'}
                                </p>
                            </div>
                            <StatusBadge status={proposal.status} />
                        </div>
                    </div>
                )}

                {/* ── Existing award (funded state) ───────────────────────── */}
                {existingAward ? (
                    <div className="space-y-4">
                        {/* Grant reference hero */}
                        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 text-center">
                            <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Trophy size={26} className="text-white" />
                            </div>
                            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                                Grant Reference
                            </p>
                            <p className="text-3xl font-bold font-mono text-emerald-800 tracking-wider">
                                {existingAward.grant_reference}
                            </p>
                            {existingAward.approved_at && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Approved on{' '}
                                    {new Date(existingAward.approved_at).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric',
                                    })}
                                </p>
                            )}
                            {existingAward.approvedBy?.name && (
                                <p className="text-xs text-emerald-500 mt-1">
                                    by {existingAward.approvedBy.name}
                                </p>
                            )}
                        </div>

                        {/* Edit awarded amount + notes */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Award size={16} className="text-emerald-600" />
                                <h2 className="text-sm font-semibold text-gray-800">Award Details</h2>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Awarded Amount ({currency()})
                                </label>
                                <input type="number" min="0" step="0.01"
                                    value={form.awarded_amount}
                                    onChange={e => set('awarded_amount', e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Approval Notes <span className="text-xs text-gray-400">(optional)</span>
                                </label>
                                <textarea rows={3}
                                    value={form.approval_notes}
                                    onChange={e => set('approval_notes', e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none resize-none focus:ring-2 focus:ring-emerald-500"
                                    placeholder="Add notes…"
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => router.visit(`/proposals/${id}`)}
                                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                                    Back
                                </button>
                                <button onClick={handleUpdate} disabled={submitting}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                                    {submitting ? (
                                        <><RefreshCw size={14} className="animate-spin" /> Updating…</>
                                    ) : 'Update Award'}
                                </button>
                            </div>
                        </div>

                        {/* PI requested budget breakdown */}
                        {proposalBudget && (proposalBudget.items ?? []).length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-blue-800 mb-3">
                                    💰 PI Requested Budget
                                </h3>
                                <div className="space-y-1.5">
                                    {(proposalBudget.items ?? []).map((item, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-gray-600 capitalize">
                                                {item.category}: {item.item_description}
                                            </span>
                                            <span className="font-medium text-gray-900 shrink-0 ml-3">
                                                {currency()} {parseFloat(item.amount ?? 0).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between text-sm font-bold">
                                        <span className="text-blue-800">Total Requested</span>
                                        <span className="text-blue-900">
                                            {currency()} {parseFloat(proposalBudget.total ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="pt-1 flex justify-between text-sm font-bold text-emerald-700">
                                        <span>Awarded</span>
                                        <span>
                                            {formatCurrency(existingAward.awarded_amount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Create new award (accepted state) ─────────────────── */
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Award size={18} className="text-emerald-600" />
                            <h2 className="text-base font-semibold text-gray-800">Generate Award</h2>
                        </div>

                        {/* Grant reference preview */}
                        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                            <p className="text-xs text-gray-500 mb-1">Grant reference will be generated as:</p>
                            <p className="font-mono text-sm font-bold text-gray-700">
                                GRANT-{previewYear}-<span className="text-gray-400">NNNNNN</span>
                            </p>
                        </div>

                        {/* PI budget preview */}
                        {proposalBudget && (proposalBudget.items ?? []).length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-xs font-semibold text-blue-800 mb-2">
                                    💰 PI Requested Budget — {currency()} {parseFloat(proposalBudget.total ?? 0).toLocaleString()}
                                </p>
                                <div className="space-y-1">
                                    {(proposalBudget.items ?? []).map((item, i) => (
                                        <div key={i} className="flex justify-between text-xs">
                                            <span className="text-gray-600 capitalize">
                                                {item.category}: {item.item_description}
                                            </span>
                                            <span className="font-medium text-gray-800 shrink-0 ml-2">
                                                {currency()} {parseFloat(item.amount ?? 0).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Awarded Amount ({currency()}) <span className="text-red-500">*</span>
                            </label>
                            <input type="number" min="0" step="0.01"
                                value={form.awarded_amount}
                                onChange={e => set('awarded_amount', e.target.value)}
                                placeholder="0.00"
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Approval Notes <span className="text-xs text-gray-400">(optional)</span>
                            </label>
                            <textarea value={form.approval_notes}
                                onChange={e => set('approval_notes', e.target.value)}
                                rows={3} placeholder="Any notes about this award…"
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none resize-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => router.visit(`/proposals/${id}`)}
                                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleCreate} disabled={submitting}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                                {submitting ? (
                                    <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                                ) : 'Generate Award'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
