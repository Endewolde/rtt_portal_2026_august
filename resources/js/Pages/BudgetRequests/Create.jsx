import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { DollarSign, Plus, Trash2, AlertTriangle } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

const BUDGET_CATEGORIES = [
    'personnel', 'equipment', 'supplies', 'travel',
    'services', 'indirect_costs', 'other',
];

const emptyItem = () => ({ category: '', description: '', amount: '', justification: '' });

export default function BudgetRequestCreate() {
    const { user } = useAuth();
    const [proposals, setProposals] = useState([]);
    const [proposalId, setProposalId] = useState('');
    const [fundingRound, setFundingRound] = useState(1);
    const selectedProposal = proposals.find(p => p.id === proposalId);
    const [items, setItems] = useState([emptyItem()]);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [budgetSummary, setBudgetSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    useEffect(() => {
        get('/proposals', { status: 'funded' })
            .then((r) => setProposals(r.data?.data ?? []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!proposalId) { setBudgetSummary(null); return; }
        setSummaryLoading(true);
        get(`/proposals/${proposalId}/budget-summary`)
            .then((r) => setBudgetSummary(r.data ?? null))
            .catch(() => setBudgetSummary(null))
            .finally(() => setSummaryLoading(false));
    }, [proposalId]);

    const total = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    const remaining = budgetSummary ? budgetSummary.remaining : null;
    const overBudget = remaining !== null && total > remaining;

    const updateItem = (idx, field, value) => {
        setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const addItem = () => setItems((prev) => [...prev, emptyItem()]);

    const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        if (!proposalId) { setErrors({ proposal_id: ['Please select a proposal.'] }); return; }
        if (items.length === 0) { setErrors({ items: ['Add at least one budget item.'] }); return; }

        setLoading(true);
        try {
            const res = await post(`/proposals/${proposalId}/budget-requests`, {
                funding_round: fundingRound,
                notes,
                items: items.map((i) => ({
                    category: i.category,
                    description: i.description,
                    amount: parseFloat(i.amount) || 0,
                    justification: i.justification,
                })),
            });
            router.visit(`/budget-requests/${res.data?.id}`);
        } catch (err) {
            if (err.validationErrors) setErrors(err.validationErrors);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout breadcrumb="New Budget Request">
            <div className="flex items-center gap-3 mb-6">
                <DollarSign size={24} className="text-emerald-600" />
                <h1 className="text-xl font-bold text-gray-900">New Budget Request</h1>
            </div>

            <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
                {/* Proposal Selection */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-900 mb-4">Proposal &amp; Round</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Proposal <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={proposalId}
                                onChange={(e) => setProposalId(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select funded proposal…</option>
                                {proposals.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.tracker_number} — {p.title}
                                    </option>
                                ))}
                            </select>
                            {errors.proposal_id && (
                                <p className="text-xs text-red-500 mt-1">{errors.proposal_id[0]}</p>
                            )}
                            {selectedProposal && selectedProposal.contract_status !== 'approved' && fundingRound === 1 && (
                                <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                    <span>
                                        {selectedProposal.contract_status === 'pending'
                                            ? 'Your contract is under review. Budget requests cannot be submitted until it is approved by an officer.'
                                            : selectedProposal.contract_status === 'rejected'
                                            ? 'Your contract submission was returned for correction. Please resubmit from your proposal page.'
                                            : 'No signed contract has been uploaded yet. Please upload it from your proposal page before submitting a budget request.'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Funding Round</label>
                            <input
                                type="number"
                                min="1"
                                value={fundingRound}
                                onChange={(e) => setFundingRound(parseInt(e.target.value) || 1)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>


                {/* Budget Items */}
                <div className={`bg-white rounded-xl border p-6 ${overBudget ? 'border-red-300' : 'border-gray-200'}`}>
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4 mb-1">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="font-semibold text-gray-900">Budget Items</h2>
                                {remaining !== null && !summaryLoading && (
                                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                                        overBudget
                                            ? 'bg-red-100 text-red-700'
                                            : Math.max(0, remaining - total) === 0
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {formatCurrency(Math.max(0, remaining - total))} available
                                    </span>
                                )}
                                {summaryLoading && proposalId && (
                                    <span className="text-xs text-gray-400">Loading budget…</span>
                                )}
                            </div>
                            {/* Context line */}
                            {budgetSummary && !summaryLoading && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {formatCurrency(budgetSummary.awarded_amount)} awarded
                                    {budgetSummary.total_spent > 0 && (
                                        <> — {formatCurrency(budgetSummary.total_spent)} used in {budgetSummary.rounds?.length} previous {budgetSummary.rounds?.length === 1 ? 'round' : 'rounds'}</>
                                    )}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={addItem}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium shrink-0"
                        >
                            <Plus size={16} /> Add Item
                        </button>
                    </div>

                    {errors.items && (
                        <p className="text-xs text-red-500 mb-3 mt-2">{errors.items[0]}</p>
                    )}

                    <div className="space-y-3 mt-4">
                        {items.map((item, idx) => {
                            const thisAmount = parseFloat(item.amount) || 0;
                            // How much room is left for this specific item = remaining minus all other items
                            const itemMax = remaining !== null
                                ? Math.max(0, remaining - (total - thisAmount))
                                : null;
                            const itemOver = itemMax !== null && thisAmount > itemMax;

                            return (
                                <div key={idx} className="grid grid-cols-12 gap-3 items-start p-4 bg-gray-50 rounded-lg">
                                    {/* Category — 2 cols */}
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">Category</label>
                                        <select
                                            value={item.category}
                                            onChange={(e) => updateItem(idx, 'category', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                                        >
                                            <option value="">Select…</option>
                                            {BUDGET_CATEGORIES.map((c) => (
                                                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* Description — 3 cols */}
                                    <div className="col-span-3">
                                        <label className="block text-xs text-gray-500 mb-1">Description</label>
                                        <input
                                            value={item.description}
                                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                                        />
                                    </div>
                                    {/* Amount — 3 cols (wider so the max label fits) */}
                                    <div className="col-span-3">
                                        <label className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-gray-500">Amount (ETB)</span>
                                            {itemMax !== null && (
                                                <span className={`font-semibold ${itemOver ? 'text-red-500' : 'text-emerald-600'}`}>
                                                    max {formatCurrency(itemMax)}
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={itemMax ?? undefined}
                                            step="0.01"
                                            value={item.amount}
                                            onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                                            className={`w-full rounded-md border px-2 py-2 text-sm focus:outline-none focus:ring-2 ${
                                                itemOver
                                                    ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-400'
                                                    : 'border-gray-300 focus:ring-blue-500'
                                            }`}
                                        />
                                    </div>
                                    {/* Justification — 3 cols */}
                                    <div className="col-span-3">
                                        <label className="block text-xs text-gray-500 mb-1">Justification</label>
                                        <input
                                            value={item.justification}
                                            onChange={(e) => updateItem(idx, 'justification', e.target.value)}
                                            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                                        />
                                    </div>
                                    {/* Delete — 1 col */}
                                    <div className="col-span-1 flex items-end justify-center pb-1">
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(idx)}
                                                className="text-red-400 hover:text-red-600 p-1"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer: running total */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-xs text-gray-400">
                            {remaining !== null && !overBudget && (
                                <span>After this request: <span className="font-semibold text-gray-600">{formatCurrency(remaining - total)}</span> will remain</span>
                            )}
                            {overBudget && (
                                <span className="text-red-600 font-medium">⚠️ Over limit by {formatCurrency(total - remaining)}</span>
                            )}
                        </div>
                        <div>
                            <span className="text-sm text-gray-500">Request total: </span>
                            <span className={`font-bold ${overBudget ? 'text-red-700' : 'text-gray-900'}`}>
                                {formatCurrency(total)}
                            </span>
                            {remaining !== null && (
                                <span className="text-xs text-gray-400 ml-1">
                                    / {formatCurrency(remaining)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        placeholder="Additional notes or justification for this budget request…"
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={loading || overBudget}
                        className="px-6 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors"
                    >
                        {loading ? 'Saving…' : 'Create Budget Request'}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.visit('/budget-requests')}
                        className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}
