import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    DollarSign, Plus, ChevronDown, ChevronUp, CheckCircle2,
    Clock, Send, XCircle, CreditCard, FileCheck, AlertCircle,
    LayoutGrid, TableProperties, X, Info, Pencil, Trash2,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ViewToggle from '../../Components/ViewToggle';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../Components/Toast';
import { formatDate, formatCurrency } from '../../lib/utils';
import api from '../../lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    draft:                { label: 'Draft',              cls: 'bg-gray-100 text-gray-600',     icon: Clock       },
    pending_signatures:   { label: 'Pending Signatures', cls: 'bg-yellow-100 text-yellow-700', icon: Clock       },
    submitted:            { label: 'Submitted',          cls: 'bg-blue-100 text-blue-700',     icon: Send        },
    under_college_review: { label: 'Under Review',       cls: 'bg-purple-100 text-purple-700', icon: Clock       },
    approved:             { label: 'Approved',           cls: 'bg-green-100 text-green-700',   icon: CheckCircle2},
    rejected:             { label: 'Rejected',           cls: 'bg-red-100 text-red-700',       icon: XCircle     },
    disbursed:            { label: 'Disbursed',          cls: 'bg-teal-100 text-teal-700',     icon: CreditCard  },
    settled:              { label: 'Settled',            cls: 'bg-slate-100 text-slate-600',   icon: FileCheck   },
};

const BUDGET_CATEGORIES = [
    'Personnel', 'Equipment', 'Materials & Supplies',
    'Travel & Fieldwork', 'Workshop & Training',
    'Software & Licenses', 'Publication', 'Overhead', 'Other',
];

const STATUS_TABS = [
    { key: 'all',      label: 'All' },
    { key: 'pending',  label: 'Pending',   match: ['draft', 'pending_signatures', 'submitted', 'under_college_review'] },
    { key: 'approved', label: 'Approved',  match: ['approved'] },
    { key: 'disbursed',label: 'Disbursed', match: ['disbursed'] },
    { key: 'settled',  label: 'Settled',   match: ['settled'] },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
            <Icon size={10} />{cfg.label}
        </span>
    );
}

// ─── Signature progress ───────────────────────────────────────────────────────

function SigProgress({ signatures }) {
    const signed = signatures.filter(s => s.status === 'signed').length;
    const total  = signatures.length;
    if (!total) return <span className="text-xs text-gray-400">—</span>;
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full w-16 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${signed === total ? 'bg-green-500' : 'bg-amber-400'}`}
                    style={{ width: `${(signed / total) * 100}%` }} />
            </div>
            <span className={`text-xs font-medium ${signed === total ? 'text-green-600' : 'text-amber-600'}`}>
                {signed}/{total}
            </span>
        </div>
    );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ proposals, templates, preselected, onClose, onSuccess }) {
    const { error } = useToast();
    const [proposal,       setProposal]       = useState(preselected ?? null);
    const [templateId,     setTemplateId]      = useState(templates[0]?.id ?? '');
    const [items,          setItems]           = useState([{ category: '', description: '', amount: '', justification: '' }]);
    const [origBudget,     setOrigBudget]      = useState([]);
    const [budgetSummary,  setBudgetSummary]   = useState(null);
    const [submitting,     setSubmitting]      = useState(false);

    // Load original proposal budget (for reference display + pre-fill category/description)
    useEffect(() => {
        if (!proposal?.id) { setOrigBudget([]); setBudgetSummary(null); return; }
        api.get(`/proposals/${proposal.id}/budget`)
            .then(r => {
                const raw = r.data?.data?.items ?? r.data?.items ?? [];
                setOrigBudget(Array.isArray(raw) ? raw : []);
                if (raw.length) {
                    // Pre-fill category + description only — amounts are left blank
                    // so the PI must enter what they need this round within the remaining cap
                    setItems(raw.map(b => ({
                        category:      b.category ?? '',
                        description:   b.item_description ?? b.description ?? '',
                        amount:        '',
                        justification: b.justification ?? '',
                    })));
                }
            })
            .catch(() => {});
        // Fetch remaining budget for this proposal
        api.get(`/proposals/${proposal.id}/budget-summary`)
            .then(r => setBudgetSummary(r.data?.data ?? null))
            .catch(() => setBudgetSummary(null));
    }, [proposal?.id]);

    const add    = () => setItems(p => [...p, { category: '', description: '', amount: '', justification: '' }]);
    const remove = i  => setItems(p => p.filter((_, idx) => idx !== i));
    const update = (i, f, v) => setItems(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x));
    const total  = items.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

    // Use effective_cap (50% for Round 1, remaining for subsequent rounds)
    const remaining       = budgetSummary?.effective_cap ?? null;
    const overBudget      = remaining !== null && total > remaining;
    // True when the entire awarded budget has been spent across all finalized rounds
    const budgetFullyUsed = !!(budgetSummary?.awarded_amount > 0 && budgetSummary?.remaining <= 0);

    // Reason why the PI cannot create a new round yet (null = allowed)
    const blockingReason = (() => {
        if (!proposal || !budgetSummary || budgetFullyUsed) return null;

        // Allocation must be approved before any budget request (Round 1 or later)
        if (budgetSummary.allocation_approved === false) {
            return {
                title: 'Budget allocation not yet approved',
                body:  'Your proposal\'s budget allocation must be approved by a Research, Community, or Technology Officer before you can submit a budget request.',
            };
        }

        if (budgetSummary.is_first_round) return null; // Round 1 allowed once allocation approved

        // Check for an unsettled previous round
        const unsettled = (budgetSummary.rounds ?? []).find(
            r => r.settlement_status && r.settlement_status !== 'finance_verified'
        );
        if (unsettled) {
            return {
                title: `Round ${unsettled.funding_round} settlement is not yet Finance-verified`,
                body: 'Finance must verify and finalize the previous round\'s settlement before you can submit a new request.',
            };
        }

        // Check midterm evaluation
        if (!budgetSummary.midterm_passed) {
            const rec = budgetSummary.midterm?.recommendation;
            return {
                title: rec === 'hold'
                    ? 'Midterm evaluation is on hold ⛔'
                    : 'Midterm evaluation not yet passed',
                body: rec === 'hold'
                    ? 'Your midterm evaluation was scored "Hold". The College Officer must update the score to "Continue" before the next round is unlocked.'
                    : 'A completed midterm evaluation with a "Continue" recommendation is required before requesting the next round.',
            };
        }

        return null;
    })();

    const submit = async () => {
        if (!proposal)                                          return error('Select a proposal.');
        if (!templateId)                                        return error('No form template available.');
        if (items.some(i => !i.category || !i.description || !i.amount)) return error('Fill in all required item fields.');
        setSubmitting(true);
        try {
            await api.post('/budget-requests', {
                proposal_id:      proposal.id,
                form_template_id: templateId,
                items: items.map(i => ({
                    category:      i.category,
                    description:   i.description,
                    amount:        parseFloat(i.amount),
                    justification: i.justification || null,
                })),
            });
            onSuccess();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to create budget request.');
        }
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                {/* Header */}
                <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-t-2xl px-6 py-5 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">New Budget Request</h2>
                        <p className="text-blue-100 text-sm mt-0.5">Submit your funding request for disbursement</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Proposal selector */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Funded Proposal <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                            {proposals.map(p => (
                                <button key={p.id} type="button" onClick={() => setProposal(p)}
                                    className={`w-full text-left border-2 rounded-xl px-4 py-3 transition-all ${
                                        proposal?.id === p.id
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-blue-300 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                            proposal?.id === p.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                                        }`}>
                                            {proposal?.id === p.id && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                        <div>
                                            <span className="font-mono text-xs font-bold text-blue-600">{p.tracker_number}</span>
                                            <p className="text-sm text-gray-800 font-medium">{p.title}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Blocking reason — form disabled with explanation */}
                    {proposal && budgetSummary && blockingReason && (
                        <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-1">
                            <p className="text-sm font-semibold text-red-800">{blockingReason.title}</p>
                            <p className="text-xs text-red-600">{blockingReason.body}</p>
                        </div>
                    )}

                    {/* Budget fully utilized — show notification instead of form */}
                    {proposal && budgetSummary && budgetFullyUsed && (
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center space-y-3">
                            <div className="text-4xl">🏁</div>
                            <h3 className="text-base font-bold text-amber-800">
                                No More Budget Requests Needed
                            </h3>
                            <p className="text-sm text-amber-700">
                                The full awarded budget for this proposal has been utilized.
                                No further budget requests can be created.
                            </p>
                            <div className="flex justify-center gap-6 pt-2">
                                <div>
                                    <p className="text-xs text-amber-600">Total Awarded</p>
                                    <p className="text-sm font-bold text-amber-900">
                                        {formatCurrency(budgetSummary.awarded_amount)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-amber-600">Total Spent</p>
                                    <p className="text-sm font-bold text-amber-900">
                                        {formatCurrency(budgetSummary.total_spent)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-amber-600">Remaining</p>
                                    <p className="text-sm font-bold text-amber-900">
                                        {formatCurrency(0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Original budget reference — hidden when budget is exhausted */}
                    {!budgetFullyUsed && origBudget.length > 0 && !blockingReason && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">
                                Original Proposal Budget (reference)
                            </p>
                            <div className="space-y-1">
                                {origBudget.map((b, i) => (
                                    <div key={i} className="flex justify-between text-xs text-amber-700">
                                        <span>{b.category} — {b.item_description ?? b.description}</span>
                                        <span className="font-semibold">{formatCurrency(b.amount)}</span>
                                    </div>
                                ))}
                                <div className="border-t border-amber-300 pt-1 flex justify-between text-xs font-bold text-amber-900">
                                    <span>Total</span>
                                    <span>{formatCurrency(origBudget.reduce((s, b) => s + parseFloat(b.amount || 0), 0))}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Budget items + process info — hidden when exhausted, dimmed when blocked */}
                    {!budgetFullyUsed && <div className={blockingReason ? 'space-y-6 opacity-40 pointer-events-none select-none' : 'space-y-6'}><div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    Budget Items <span className="text-red-500">*</span>
                                </label>
                                {remaining !== null && (
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                        overBudget
                                            ? 'bg-red-100 text-red-700'
                                            : Math.max(0, remaining - total) === 0
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {formatCurrency(Math.max(0, remaining - total))} available
                                    </span>
                                )}
                            </div>
                            <button type="button" onClick={add}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-200 bg-blue-50 px-3 py-1 rounded-lg">
                                + Add Item
                            </button>
                        </div>
                        {budgetSummary && (
                            <div className="mb-3 space-y-1">
                                {budgetSummary.is_first_round ? (
                                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                                        🔒 Round 1 is capped at <strong>50%</strong> of the awarded budget ({formatCurrency(budgetSummary.round_one_cap)} max)
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-xs text-gray-400">
                                            {formatCurrency(budgetSummary.awarded_amount)} awarded — {formatCurrency(budgetSummary.total_spent)} used — {formatCurrency(budgetSummary.remaining)} remaining
                                        </p>
                                        {!budgetSummary.midterm_passed && (
                                            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                                                ⚠️ Midterm evaluation not yet passed. A College Officer must score the evaluation with "Continue" before a new round can be created.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        <div className="space-y-3">
                            {items.map((item, i) => {
                                const thisAmount = parseFloat(item.amount) || 0;
                                const itemMax    = remaining !== null
                                    ? Math.max(0, remaining - (total - thisAmount))
                                    : null;
                                const itemOver   = itemMax !== null && thisAmount > itemMax;

                                return (
                                    <div key={i} className={`border rounded-xl p-4 bg-gray-50 ${itemOver ? 'border-red-300' : 'border-gray-200'}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Item {i + 1}</span>
                                            {items.length > 1 && (
                                                <button type="button" onClick={() => remove(i)}
                                                    className="text-xs text-red-500 hover:text-red-700 font-medium">
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Category *</label>
                                                <select value={item.category} onChange={e => update(i, 'category', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                                    <option value="">Select…</option>
                                                    {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-gray-500">Amount (ETB) *</span>
                                                    {itemMax !== null && (
                                                        <span className={`font-semibold ${itemOver ? 'text-red-500' : 'text-emerald-600'}`}>
                                                            max {formatCurrency(itemMax)}
                                                        </span>
                                                    )}
                                                </label>
                                                <input type="number" min="0" max={itemMax ?? undefined} step="0.01"
                                                    value={item.amount}
                                                    onChange={e => update(i, 'amount', e.target.value)}
                                                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                                                        itemOver
                                                            ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-400'
                                                            : 'border-gray-300 focus:ring-blue-500'
                                                    }`}
                                                    placeholder="0.00" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Description *</label>
                                                <input type="text" value={item.description}
                                                    onChange={e => update(i, 'description', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Describe this budget item…" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Justification</label>
                                                <input type="text" value={item.justification}
                                                    onChange={e => update(i, 'justification', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Why is this needed? (optional)" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className={`flex justify-between items-center mt-3 px-4 py-3 rounded-xl font-bold ${
                            overBudget ? 'bg-red-600' : 'bg-blue-600'
                        } text-white`}>
                            <span className="text-sm">
                                {overBudget
                                    ? `Over limit by ${formatCurrency(total - remaining)}`
                                    : 'Total Requested'}
                            </span>
                            <div className="text-right">
                                <span className="text-lg">{formatCurrency(total)}</span>
                                {remaining !== null && (
                                    <span className="text-xs font-normal opacity-80 ml-1">/ {formatCurrency(remaining)}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-700 space-y-1">
                            <p className="font-semibold">What happens next?</p>
                            <ol className="list-decimal list-inside space-y-0.5 text-xs">
                                <li>All team members receive a signing notification</li>
                                <li>Once everyone signs, you can submit for review</li>
                                <li>College Officer / Admin approves the request</li>
                                <li>Finance disburses the approved amount</li>
                                <li>After spending, submit a settlement report</li>
                            </ol>
                        </div>
                    </div>
                    </div>}
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    {budgetFullyUsed ? (
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
                            Close
                        </button>
                    ) : (
                        <>
                            <button type="button" onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                                Cancel
                            </button>
                            <button type="button" onClick={submit} disabled={submitting || !proposal || overBudget || !!blockingReason}
                                className="flex-1 px-4 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors">
                                {submitting ? 'Creating…' : 'Create Budget Request'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({ request, onClose, onSuccess }) {
    const { error, success } = useToast();
    const [items, setItems] = useState(
        (request.items ?? []).map(i => ({
            category:      i.category      ?? '',
            description:   i.description   ?? '',
            amount:        i.amount        ?? '',
            justification: i.justification ?? '',
        }))
    );
    const [budgetSummary, setBudgetSummary] = useState(null);
    const [submitting,    setSubmitting]    = useState(false);

    useEffect(() => {
        api.get(`/proposals/${request.proposal.id}/budget-summary`)
            .then(r => setBudgetSummary(r.data?.data ?? null))
            .catch(() => {});
    }, [request.proposal.id]);

    const add    = () => setItems(p => [...p, { category: '', description: '', amount: '', justification: '' }]);
    const remove = i  => setItems(p => p.filter((_, idx) => idx !== i));
    const update = (i, f, v) => setItems(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x));
    const total  = items.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

    // Round 1 is always capped at 50% of awarded; subsequent rounds are capped at overall remaining budget
    const isRound1   = request.funding_round === 1;
    const remaining  = budgetSummary
        ? isRound1
            ? (budgetSummary.round_one_cap ?? null)
            : budgetSummary.remaining
        : null;
    const overBudget = remaining !== null && total > remaining;

    const submit = async () => {
        if (items.some(i => !i.category || !i.description || !i.amount)) {
            return error('Fill in all required item fields.');
        }
        setSubmitting(true);
        try {
            await api.put(`/budget-requests/${request.id}`, {
                items: items.map(i => ({
                    category:      i.category,
                    description:   i.description,
                    amount:        parseFloat(i.amount),
                    justification: i.justification || null,
                })),
            });
            success('Budget request updated. Team members must re-sign.');
            onSuccess();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to update budget request.');
        }
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                {/* Header */}
                <div className="bg-linear-to-r from-amber-500 to-orange-500 rounded-t-2xl px-6 py-5 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Edit Budget Request</h2>
                        <p className="text-amber-100 text-sm mt-0.5">
                            {request.proposal?.tracker_number} · Round {request.funding_round}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Budget Items */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    Budget Items <span className="text-red-500">*</span>
                                </label>
                                {remaining !== null && (
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                        overBudget ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {formatCurrency(Math.max(0, remaining - total))} available
                                    </span>
                                )}
                            </div>
                            <button type="button" onClick={add}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-200 bg-blue-50 px-3 py-1 rounded-lg">
                                + Add Item
                            </button>
                        </div>

                        {budgetSummary && isRound1 && remaining !== null && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
                                🔒 Round 1 is capped at <strong>50%</strong> of the awarded budget ({formatCurrency(remaining)} max)
                            </p>
                        )}

                        <div className="space-y-3">
                            {items.map((item, i) => {
                                const thisAmount = parseFloat(item.amount) || 0;
                                const itemMax    = remaining !== null
                                    ? Math.max(0, remaining - (total - thisAmount))
                                    : null;
                                const itemOver   = itemMax !== null && thisAmount > itemMax;

                                return (
                                    <div key={i} className={`border rounded-xl p-4 bg-gray-50 ${itemOver ? 'border-red-300' : 'border-gray-200'}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Item {i + 1}</span>
                                            {items.length > 1 && (
                                                <button type="button" onClick={() => remove(i)}
                                                    className="text-xs text-red-500 hover:text-red-700 font-medium">
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Category *</label>
                                                <select value={item.category} onChange={e => update(i, 'category', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                                    <option value="">Select…</option>
                                                    {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-gray-500">Amount (ETB) *</span>
                                                    {itemMax !== null && (
                                                        <span className={`font-semibold ${itemOver ? 'text-red-500' : 'text-emerald-600'}`}>
                                                            max {formatCurrency(itemMax)}
                                                        </span>
                                                    )}
                                                </label>
                                                <input type="number" min="0" max={itemMax ?? undefined} step="0.01"
                                                    value={item.amount}
                                                    onChange={e => update(i, 'amount', e.target.value)}
                                                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                                                        itemOver
                                                            ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-400'
                                                            : 'border-gray-300 focus:ring-blue-500'
                                                    }`}
                                                    placeholder="0.00" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Description *</label>
                                                <input type="text" value={item.description}
                                                    onChange={e => update(i, 'description', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Describe this budget item…" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Justification</label>
                                                <input type="text" value={item.justification}
                                                    onChange={e => update(i, 'justification', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Why is this needed? (optional)" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className={`flex justify-between items-center mt-3 px-4 py-3 rounded-xl font-bold ${
                            overBudget ? 'bg-red-600' : 'bg-amber-500'
                        } text-white`}>
                            <span className="text-sm">
                                {overBudget ? `Over limit by ${formatCurrency(total - remaining)}` : 'Total Requested'}
                            </span>
                            <div className="text-right">
                                <span className="text-lg">{formatCurrency(total)}</span>
                                {remaining !== null && (
                                    <span className="text-xs font-normal opacity-80 ml-1">/ {formatCurrency(remaining)}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ Saving will reset all signatures — team members will need to re-sign.
                    </p>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    <button type="button" onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                        Cancel
                    </button>
                    <button type="button" onClick={submit} disabled={submitting || overBudget}
                        className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                        {submitting ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Card component ───────────────────────────────────────────────────────────

function RequestCard({ request, userId, isOfficer, isAdmin, onRefresh }) {
    const { error, success } = useToast();
    const { confirm, Dialog } = useConfirm();
    const [expanded,   setExpanded]   = useState(false);
    const [showEdit,   setShowEdit]   = useState(false);

    const sigs        = request.signatures ?? [];
    const signed      = sigs.filter(s => s.status === 'signed').length;
    const allSigned   = signed === sigs.length && sigs.length > 0;
    const mySig       = sigs.find(s => s.user_id === userId);
    const canSign     = mySig?.status === 'pending';
    const canSubmit   = allSigned && ['draft', 'pending_signatures'].includes(request.status);
    const canApprove  = isAdmin && request.status === 'submitted';
    const canEdit     = ['draft', 'pending_signatures'].includes(request.status)
                        && request.requested_by?.id === userId
                        && !allSigned;

    const handleDelete = async () => {
        const ok = await confirm({
            title: 'Delete Budget Request?',
            description: 'This will permanently delete this budget request and all signatures. This cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!ok) return;
        try {
            await api.delete(`/budget-requests/${request.id}`);
            success('Budget request deleted.');
            onRefresh();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to delete.');
        }
    };

    const act = async (label, apiCall, successMsg) => {
        const ok = await confirm({ title: `${label}?`, confirmLabel: label });
        if (!ok) return;
        try { await apiCall(); success(successMsg); onRefresh(); }
        catch (e) { error(e.response?.data?.message ?? `${label} failed.`); }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <div className="px-5 py-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(v => !v)}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0">
                        <DollarSign size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="font-mono text-xs font-bold text-blue-600">
                                {request.proposal?.tracker_number}
                            </span>
                            <span className="text-xs text-gray-400">Round {request.funding_round}</span>
                            <StatusBadge status={request.status} />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{request.proposal?.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-500 font-medium">{formatCurrency(request.total_amount)}</span>
                            {sigs.length > 0 && <SigProgress signatures={sigs} />}
                        </div>
                    </div>
                </div>
                {expanded ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
            </div>

            {expanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">
                    {/* Items */}
                    {(request.items ?? []).length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Budget Items</p>
                            <div className="space-y-1.5">
                                {request.items.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm bg-white border border-gray-100 rounded-lg px-3 py-2">
                                        <div className="min-w-0">
                                            <span className="font-medium text-gray-700">{item.category}</span>
                                            {item.description && <span className="text-gray-400 ml-2 truncate">— {item.description}</span>}
                                        </div>
                                        <span className="font-semibold text-gray-900 shrink-0 ml-3">{formatCurrency(item.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm font-bold bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                    <span className="text-blue-800">Total</span>
                                    <span className="text-blue-900">{formatCurrency(request.total_amount)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Signatures */}
                    {sigs.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Signature Chain</p>
                            <div className="space-y-2">
                                {sigs.map(sig => (
                                    <div key={sig.id} className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                            sig.status === 'signed'  ? 'bg-green-500' :
                                            sig.status === 'refused' ? 'bg-red-500' : 'bg-gray-200'
                                        }`}>
                                            {sig.status === 'signed'  && <CheckCircle2 size={12} className="text-white" />}
                                            {sig.status === 'refused' && <XCircle      size={12} className="text-white" />}
                                            {sig.status === 'pending' && <Clock        size={12} className="text-gray-500" />}
                                        </div>
                                        <div className="flex-1 text-sm">
                                            <span className="font-medium text-gray-800">{sig.user?.name ?? '—'}</span>
                                            <span className="text-gray-400 text-xs ml-1.5 capitalize">({sig.role})</span>
                                        </div>
                                        <span className={`text-xs font-medium capitalize ${
                                            sig.status === 'signed'  ? 'text-green-600' :
                                            sig.status === 'refused' ? 'text-red-500' : 'text-gray-400'
                                        }`}>{sig.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                        {canSign && (
                            <button onClick={() => act('Sign', () => api.post(`/budget-requests/${request.id}/sign`), 'Signed successfully.')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
                                <CheckCircle2 size={12} /> Sign
                            </button>
                        )}
                        {canSubmit && (
                            <button onClick={() => act('Submit for Review', () => api.post(`/budget-requests/${request.id}/submit`), 'Submitted for review.')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                                <Send size={12} /> Submit for Review
                            </button>
                        )}
                        {canApprove && (
                            <button onClick={() => act('Approve', () => api.post(`/budget-requests/${request.id}/approve`), 'Approved.')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
                                <CheckCircle2 size={12} /> Approve
                            </button>
                        )}
                        <Link href={`/budget-requests/${request.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-white">
                            View Details →
                        </Link>
                        {canEdit && (
                            <>
                                <button
                                    onClick={() => setShowEdit(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 text-xs font-medium rounded-lg hover:bg-amber-100"
                                >
                                    <Pencil size={12} /> Edit
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 bg-red-50 text-xs font-medium rounded-lg hover:bg-red-100"
                                >
                                    <Trash2 size={12} /> Remove
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showEdit && (
                <EditModal
                    request={request}
                    onClose={() => setShowEdit(false)}
                    onSuccess={() => { setShowEdit(false); onRefresh(); }}
                />
            )}
            <Dialog />
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetRequests() {
    const { user, hasAnyRole } = useAuth();
    const { success, error }   = useToast();
    const [view, setView]      = useViewPreference('budget_requests', 'card');

    const isPI     = hasAnyRole(['pi', 'staff']);
    const isAdmin  = hasAnyRole(['super_admin', 'central_office', 'finance',
                                 'college_officer', 'college_admin',
                                 'research_officer', 'community_officer', 'technology_officer']);

    const [requests,        setRequests]        = useState([]);
    const [fundedProposals, setFundedProposals] = useState([]);
    const [templates,       setTemplates]       = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [activeTab,       setActiveTab]       = useState('all');
    const [showCreate,      setShowCreate]      = useState(false);
    const [preselected,     setPreselected]     = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        api.get('/budget-requests')
            .then(r => {
                const raw = r.data?.data ?? [];
                setRequests(Array.isArray(raw) ? raw : []);
            })
            .catch(() => error('Failed to load budget requests.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
        if (isPI) {
            api.get('/proposals/my')
                .then(async r => {
                    // Include midterm_evaluation — proposal moves to that status when midterm is scheduled
                    const funded = (r.data?.data ?? []).filter(p =>
                        ['funded', 'midterm_evaluation'].includes(p.status)
                    );
                    // Fetch budget summaries in parallel and filter out proposals where
                    // an award EXISTS and the remaining budget is fully exhausted.
                    // Proposals with no award record are kept (remaining = 0 but awarded = 0).
                    const summaries = await Promise.all(
                        funded.map(p =>
                            api.get(`/proposals/${p.id}/budget-summary`)
                                .then(s => {
                                    const d = s.data?.data ?? {};
                                    const awarded   = parseFloat(d.awarded_amount ?? 0);
                                    const remaining = parseFloat(d.remaining ?? 0);
                                    return { id: p.id, exhausted: awarded > 0 && remaining <= 0 };
                                })
                                .catch(() => ({ id: p.id, exhausted: false }))
                        )
                    );
                    const exhaustedIds = new Set(summaries.filter(s => s.exhausted).map(s => s.id));
                    setFundedProposals(funded.filter(p => !exhaustedIds.has(p.id)));
                })
                .catch(() => {});
        }
        api.get('/form-templates')
            .then(r => setTemplates(r.data?.data ?? []))
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = requests.filter(r => {
        if (activeTab === 'all') return true;
        const tab = STATUS_TABS.find(t => t.key === activeTab);
        return tab?.match?.includes(r.status) ?? true;
    });

    const tabCount = key => {
        if (key === 'all') return requests.length;
        const tab = STATUS_TABS.find(t => t.key === key);
        return requests.filter(r => tab?.match?.includes(r.status)).length;
    };

    const openCreate = (proposal = null) => { setPreselected(proposal); setShowCreate(true); };

    return (
        <AppLayout breadcrumb="Budget Requests">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Budget Requests</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {isPI && !isAdmin ? 'Your funding disbursement requests for funded proposals' : 'All budget requests across proposals'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <ViewToggle view={view} onChange={setView} />
                        {isPI && fundedProposals.length > 0 && (
                            <button onClick={() => openCreate()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 shadow-sm">
                                <Plus size={15} /> New Request
                            </button>
                        )}
                    </div>
                </div>

                {/* Funded proposals banner (PI only) */}
                {isPI && fundedProposals.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
                        <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-green-800">
                                {fundedProposals.length} funded proposal{fundedProposals.length > 1 ? 's' : ''} ready for budget request
                            </p>
                            <p className="text-xs text-green-700 mt-0.5">Submit a budget request to receive your funding disbursement.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {fundedProposals.map(p => (
                                    <button key={p.id} onClick={() => openCreate(p)}
                                        className="font-mono text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full border border-green-300 hover:bg-green-200 transition-colors">
                                        {p.tracker_number} →
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                        {STATUS_TABS.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium shrink-0 border-b-2 transition-colors ${
                                    activeTab === tab.key
                                        ? 'border-blue-600 text-blue-700 bg-blue-50/40'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label}
                                {tabCount(tab.key) > 0 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                        activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                    }`}>{tabCount(tab.key)}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12">
                                <DollarSign size={36} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-600 font-medium">No budget requests</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {isPI ? 'Requests appear here once your proposal is funded.' : 'No requests to show.'}
                                </p>
                            </div>
                        ) : view === 'card' ? (
                            <div className="space-y-4">
                                {filtered.map(r => (
                                    <RequestCard
                                        key={r.id}
                                        request={r}
                                        userId={user?.id}
                                        isOfficer={isAdmin && !hasAnyRole(['super_admin', 'central_office', 'finance'])}
                                        isAdmin={isAdmin}
                                        onRefresh={load}
                                    />
                                ))}
                            </div>
                        ) : (
                            /* Table view */
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-gray-200">
                                        <tr>
                                            {['Proposal', 'Round', 'Amount', 'Status', 'Signatures', 'Date', ''].map(h => (
                                                <th key={h} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filtered.map(r => (
                                            <tr key={r.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-3">
                                                    <p className="font-mono text-xs font-bold text-blue-600">{r.proposal?.tracker_number}</p>
                                                    <p className="text-xs text-gray-500 truncate max-w-48">{r.proposal?.title}</p>
                                                </td>
                                                <td className="px-3 py-3 text-xs font-bold text-gray-700">Round {r.funding_round}</td>
                                                <td className="px-3 py-3 text-sm font-semibold text-gray-900">{formatCurrency(r.total_amount)}</td>
                                                <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                                                <td className="px-3 py-3"><SigProgress signatures={r.signatures ?? []} /></td>
                                                <td className="px-3 py-3 text-xs text-gray-500">{formatDate(r.created_at)}</td>
                                                <td className="px-3 py-3 text-right">
                                                    <Link href={`/budget-requests/${r.id}`}
                                                        className="text-xs text-blue-600 hover:underline font-semibold">
                                                        View →
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showCreate && (
                <CreateModal
                    proposals={fundedProposals}
                    templates={templates}
                    preselected={preselected}
                    onClose={() => { setShowCreate(false); setPreselected(null); }}
                    onSuccess={() => {
                        setShowCreate(false);
                        setPreselected(null);
                        success('Budget request created. Team members notified to sign.');
                        load();
                    }}
                />
            )}
        </AppLayout>
    );
}
