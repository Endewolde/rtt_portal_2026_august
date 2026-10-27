import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    DollarSign, Plus, ChevronDown, CheckCircle2, Clock, Send, XCircle, CreditCard, FileCheck,
    X, Info, Pencil, Trash2, Banknote, Trophy, Search, PenLine, Building2, Landmark, Lock,
    AlertTriangle, Flag, Loader2, ArrowRight, Wallet, Inbox,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ViewToggle from '../../Components/ViewToggle';
import { PageHeader, StatCard, Panel, EmptyState, Select, RefreshButton, StatSkeletons, Skeleton, DataTable } from '../../Components/Insights/Kit';
import { useAuth } from '../../hooks/useAuth';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../Components/Toast';
import { formatDate, formatCurrency } from '../../lib/utils';
import { programmeLabel, programmeColor } from '../../lib/programmes';
import api from '../../lib/api';
import RejectWithReasonModal from '../../Components/RejectWithReasonModal';
import { currency, term } from '../../lib/terms';
import ProposalHover from '../../Components/Finance/ProposalHover';
import DownloadMenu from '../../Components/Finance/DownloadMenu';
import ClearButton from '../../Components/Finance/ClearButton';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    draft:              { label: 'Draft',                   cls: 'bg-gray-100 text-gray-600 ring-gray-200',          icon: Clock },
    pending_signatures: { label: 'Awaiting signatures',     cls: 'bg-amber-50 text-amber-700 ring-amber-200',        icon: PenLine },
    submitted:          { label: 'Awaiting college review', cls: 'bg-sky-50 text-sky-700 ring-sky-200',              icon: Send },
    college_approved:   { label: 'Awaiting finance review', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200',     icon: Landmark },
    finance_returned:   { label: 'Returned by finance',     cls: 'bg-orange-50 text-orange-700 ring-orange-200',     icon: XCircle },
    rejected:           { label: 'Rejected',                cls: 'bg-red-50 text-red-700 ring-red-200',              icon: XCircle },
    approved:           { label: 'Approved · ready to pay', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200',  icon: CheckCircle2 },
    disbursed:          { label: 'Disbursed',               cls: 'bg-teal-50 text-teal-700 ring-teal-200',           icon: CreditCard },
    settled:            { label: 'Settled',                 cls: 'bg-slate-100 text-slate-600 ring-slate-200',       icon: FileCheck },
};

const BUDGET_CATEGORIES = [
    'Personnel', 'Equipment', 'Materials & Supplies',
    'Travel & Fieldwork', 'Workshop & Training',
    'Software & Licenses', 'Publication', 'Overhead', 'Other',
];

/** The road every request travels; returned and rejected requests stop at the college step. */
const STAGES = [
    { key: 'sign', label: 'Signatures', icon: PenLine },
    { key: 'college', label: 'College', icon: Building2 },
    { key: 'finance', label: 'Finance', icon: Landmark },
    { key: 'paid', label: 'Disbursed', icon: Banknote },
    { key: 'settled', label: 'Settled', icon: Flag },
];
const STAGE_INDEX = { draft: 0, pending_signatures: 0, submitted: 1, finance_returned: 1, rejected: 1, college_approved: 2, approved: 3, disbursed: 4, settled: 5 };

const blankItem = () => ({ category: '', description: '', amount: '', justification: '' });
const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm';

// ─── Small pieces ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cfg.cls}`}>
            <Icon size={11} /> {cfg.label}
        </span>
    );
}

function SigProgress({ signatures }) {
    const signed = signatures.filter((s) => s.status === 'signed').length;
    const total = signatures.length;
    if (!total) return <span className="text-xs text-gray-400">—</span>;
    const done = signed === total;
    return (
        <span className="inline-flex items-center gap-1.5" title={`${signed} of ${total} signed`}>
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                <span className={`block h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${(signed / total) * 100}%` }} />
            </span>
            <span className={`text-[11px] font-semibold tabular-nums ${done ? 'text-emerald-600' : 'text-amber-600'}`}>{signed}/{total}</span>
        </span>
    );
}

function StageTrack({ status }) {
    const at = STAGE_INDEX[status] ?? 0;
    const stopped = status === 'rejected' || status === 'finance_returned';
    return (
        <ol className="flex items-center gap-1">
            {STAGES.map((s, i) => {
                const done = i < at;
                const current = i === at;
                const Icon = s.icon;
                return (
                    <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1">
                        <span title={s.label}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${
                                done ? 'bg-emerald-500 text-white ring-emerald-500'
                                    : current ? (stopped ? 'bg-red-50 text-red-600 ring-red-300' : 'bg-indigo-50 text-indigo-600 ring-indigo-300')
                                    : 'bg-white text-gray-300 ring-gray-200'}`}>
                            {done ? <CheckCircle2 size={14} /> : <Icon size={13} />}
                        </span>
                        <span className={`hidden truncate text-[11px] font-medium md:inline ${done ? 'text-emerald-700' : current ? (stopped ? 'text-red-600' : 'text-indigo-700') : 'text-gray-400'}`}>{s.label}</span>
                        {i < STAGES.length - 1 && <span className={`h-px min-w-2 flex-1 ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                    </li>
                );
            })}
        </ol>
    );
}

function ProgrammeDot({ category }) {
    if (!category) return null;
    const color = programmeColor(category);
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {programmeLabel(category)}
        </span>
    );
}

function Sheet({ title, subtitle, icon: Icon, tone = 'bg-indigo-100 text-indigo-600', onClose, children, footer, wide }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className={`flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                            {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>}
            </div>
        </div>
    );
}

function Callout({ tone = 'amber', icon: Icon = Info, title, children }) {
    const tones = {
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        red: 'border-red-200 bg-red-50 text-red-800',
        sky: 'border-sky-200 bg-sky-50 text-sky-800',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        orange: 'border-orange-200 bg-orange-50 text-orange-800',
        indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    };
    return (
        <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${tones[tone]}`}>
            <Icon size={15} className="mt-0.5 shrink-0" />
            <div className="min-w-0 text-sm">
                {title && <p className="font-semibold">{title}</p>}
                <div className={title ? 'mt-0.5 text-xs opacity-90' : 'text-xs'}>{children}</div>
            </div>
        </div>
    );
}

// ─── Items editor (shared by create and edit) ─────────────────────────────────

function ItemsEditor({ items, setItems, cap, capNote }) {
    const total = items.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const over = cap !== null && total > cap;
    const update = (i, field, value) => setItems((list) => list.map((x, idx) => (idx === i ? { ...x, [field]: value } : x)));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">Budget items</p>
                {cap !== null && (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${over ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {formatCurrency(Math.max(0, cap - total))} still available
                    </span>
                )}
            </div>
            {capNote}

            {items.map((item, i) => {
                const amount = parseFloat(item.amount) || 0;
                const itemMax = cap !== null ? Math.max(0, cap - (total - amount)) : null;
                const itemOver = itemMax !== null && amount > itemMax;
                return (
                    <div key={i} className={`rounded-xl border bg-gray-50/70 p-4 ${itemOver ? 'border-red-300' : 'border-gray-200'}`}>
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Item {i + 1}</span>
                            {items.length > 1 && (
                                <button type="button" onClick={() => setItems((list) => list.filter((_, idx) => idx !== i))}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-600">
                                    <Trash2 size={12} /> Remove
                                </button>
                            )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className="mb-1 block text-xs text-gray-500">Category</span>
                                <select value={item.category} onChange={(e) => update(i, 'category', e.target.value)} className={inputCls}>
                                    <option value="">Choose…</option>
                                    {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 flex items-center justify-between text-xs">
                                    <span className="text-gray-500">Amount ({currency()})</span>
                                    {itemMax !== null && <span className={`font-semibold ${itemOver ? 'text-red-600' : 'text-emerald-600'}`}>max {formatCurrency(itemMax)}</span>}
                                </span>
                                <input type="number" min="0" step="0.01" value={item.amount} placeholder="0.00"
                                    onChange={(e) => update(i, 'amount', e.target.value)}
                                    className={`${inputCls} tabular-nums ${itemOver ? 'border-red-400 bg-red-50 text-red-700' : ''}`} />
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="mb-1 block text-xs text-gray-500">Description</span>
                                <input value={item.description} onChange={(e) => update(i, 'description', e.target.value)} placeholder="What will this pay for?" className={inputCls} />
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="mb-1 block text-xs text-gray-500">Justification <span className="text-gray-400">(optional)</span></span>
                                <input value={item.justification} onChange={(e) => update(i, 'justification', e.target.value)} placeholder="Why is it needed?" className={inputCls} />
                            </label>
                        </div>
                    </div>
                );
            })}

            <button type="button" onClick={() => setItems((list) => [...list, blankItem()])}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600">
                <Plus size={14} /> Add item
            </button>

            <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-white ${over ? 'bg-red-600' : 'bg-slate-900'}`}>
                <span className="text-sm font-medium">{over ? `Over the limit by ${formatCurrency(total - cap)}` : 'Total requested'}</span>
                <span className="tabular-nums">
                    <span className="text-lg font-bold">{formatCurrency(total)}</span>
                    {cap !== null && <span className="ml-1 text-xs opacity-70">/ {formatCurrency(cap)}</span>}
                </span>
            </div>
        </div>
    );
}

const itemsPayload = (items) => items.map((i) => ({
    category: i.category, description: i.description, amount: parseFloat(i.amount), justification: i.justification || null,
}));
const itemsIncomplete = (items) => items.some((i) => !i.category || !i.description || !i.amount);

// ─── Create ───────────────────────────────────────────────────────────────────

function CreateModal({ proposals, templates, preselected, onClose, onSuccess }) {
    const { error } = useToast();
    const [proposal, setProposal] = useState(preselected ?? (proposals.length === 1 ? proposals[0] : null));
    const [items, setItems] = useState([blankItem()]);
    const [origBudget, setOrigBudget] = useState([]);
    const [summary, setSummary] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const templateId = templates[0]?.id ?? '';

    useEffect(() => {
        if (!proposal?.id) { setOrigBudget([]); setSummary(null); return; }
        api.get(`/proposals/${proposal.id}/budget`)
            .then((r) => {
                const raw = r.data?.data?.items ?? r.data?.items ?? [];
                setOrigBudget(Array.isArray(raw) ? raw : []);
                // Start from the proposal's own lines; amounts stay blank so the team asks for what this round needs.
                if (raw.length) setItems(raw.map((b) => ({ category: b.category ?? '', description: b.item_description ?? b.description ?? '', amount: '', justification: b.justification ?? '' })));
            })
            .catch(() => {});
        api.get(`/proposals/${proposal.id}/budget-summary`)
            .then((r) => setSummary(r.data?.data ?? null))
            .catch(() => setSummary(null));
    }, [proposal?.id]);

    const total = items.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const cap = summary?.effective_cap ?? null;
    const overBudget = cap !== null && total > cap;
    const fullyUsed = !!(summary?.awarded_amount > 0 && summary?.remaining <= 0);

    const blocking = (() => {
        if (!proposal || !summary || fullyUsed) return null;
        if (summary.allocation_approved === false) {
            return { title: 'The budget allocation is not approved yet', body: 'The programme director or central office approves the allocation first; then you can request funds.' };
        }
        if (summary.is_first_round) return null;
        const unsettled = (summary.rounds ?? []).find((r) => r.settlement_status && r.settlement_status !== 'finance_verified');
        if (unsettled) {
            return { title: `Round ${unsettled.funding_round} is not settled yet`, body: 'Finance must verify the previous round’s settlement before a new request.' };
        }
        if (!summary.midterm_passed) {
            const hold = summary.midterm?.recommendation === 'hold';
            return hold
                ? { title: 'The midterm evaluation is on hold', body: 'The college officer must change the result to “Continue” before the next round opens.' }
                : { title: 'The midterm evaluation has not passed yet', body: 'A completed midterm evaluation recommending “Continue” is needed before the next round.' };
        }
        return null;
    })();

    const submit = async () => {
        if (!proposal) return error('Choose a project.');
        if (!templateId) return error('No request form is set up yet. Ask the finance office.');
        if (itemsIncomplete(items)) return error('Fill in the category, description and amount of every item.');
        setSubmitting(true);
        try {
            await api.post('/budget-requests', { proposal_id: proposal.id, form_template_id: templateId, items: itemsPayload(items) });
            onSuccess();
        } catch (e) {
            error(e.response?.data?.message ?? 'The budget request could not be created.');
        }
        setSubmitting(false);
    };

    return (
        <Sheet wide title="New budget request" subtitle="Ask for this round’s funds" icon={Wallet} onClose={onClose}
            footer={fullyUsed ? (
                <button onClick={onClose} className="flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white">Close</button>
            ) : (<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={submitting || !proposal || overBudget || !!blocking}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    {submitting && <Loader2 size={14} className="animate-spin" />} Create request
                </button>
            </>)}>

            <div>
                <p className="mb-2 text-sm font-semibold text-gray-800">Project</p>
                <div className="space-y-2">
                    {proposals.map((p) => {
                        const on = proposal?.id === p.id;
                        return (
                            <button key={p.id} type="button" onClick={() => setProposal(p)}
                                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${on ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                                    {on && <CheckCircle2 size={12} className="text-white" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block font-mono text-xs font-bold text-indigo-600">{p.tracker_number}</span>
                                    <span className="block truncate text-sm font-medium text-gray-800">{p.title}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {proposal && summary && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                    {[['Awarded', summary.awarded_amount], ['Used so far', summary.total_spent], ['Remaining', summary.remaining]].map(([label, v]) => (
                        <div key={label}>
                            <p className="text-[11px] text-gray-500">{label}</p>
                            <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(v ?? 0)}</p>
                        </div>
                    ))}
                </div>
            )}

            {blocking && <Callout tone="red" icon={Lock} title={blocking.title}>{blocking.body}</Callout>}

            {fullyUsed ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                    <Trophy size={28} className="mx-auto text-emerald-500" />
                    <p className="mt-2 font-semibold text-emerald-900">The whole award has been used</p>
                    <p className="mt-1 text-sm text-emerald-700">No further budget requests are needed for this project.</p>
                </div>
            ) : proposal && (
                <div className={blocking ? 'pointer-events-none select-none opacity-40' : ''}>
                    {origBudget.length > 0 && (
                        <details className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700">Original proposal budget <span className="text-gray-400">· {formatCurrency(origBudget.reduce((s, b) => s + parseFloat(b.amount || 0), 0))}</span></summary>
                            <div className="mt-2 space-y-1">
                                {origBudget.map((b, i) => (
                                    <div key={i} className="flex justify-between gap-3 text-xs text-gray-600">
                                        <span className="truncate">{b.category} — {b.item_description ?? b.description}</span>
                                        <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(b.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                    <ItemsEditor items={items} setItems={setItems} cap={cap}
                        capNote={summary?.is_first_round && <Callout tone="sky" icon={Lock}>Round 1 is capped at 50% of the award ({formatCurrency(summary.round_one_cap)}).</Callout>} />
                    <div className="mt-4">
                        <Callout tone="indigo" icon={ArrowRight} title="What happens next">
                            Every team member signs → you submit it → the college reviews → finance approves and pays → you settle with receipts.
                        </Callout>
                    </div>
                </div>
            )}
        </Sheet>
    );
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

function EditModal({ request, onClose, onSuccess }) {
    const { error, success } = useToast();
    const [items, setItems] = useState((request.items ?? []).map((i) => ({ category: i.category ?? '', description: i.description ?? '', amount: i.amount ?? '', justification: i.justification ?? '' })));
    const [summary, setSummary] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        api.get(`/proposals/${request.proposal.id}/budget-summary`).then((r) => setSummary(r.data?.data ?? null)).catch(() => {});
    }, [request.proposal.id]);

    // Round 1 stays capped at half the award; later rounds at what is left.
    const isRound1 = request.funding_round === 1;
    const cap = summary ? (isRound1 ? (summary.round_one_cap ?? null) : summary.remaining) : null;
    const total = items.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

    const submit = async () => {
        if (itemsIncomplete(items)) return error('Fill in the category, description and amount of every item.');
        setSubmitting(true);
        try {
            await api.put(`/budget-requests/${request.id}`, { items: itemsPayload(items) });
            success('Budget request updated. Team members need to sign again.');
            onSuccess();
        } catch (e) {
            error(e.response?.data?.message ?? 'The budget request could not be updated.');
        }
        setSubmitting(false);
    };

    return (
        <Sheet wide title="Edit budget request" subtitle={`${request.proposal?.tracker_number} · Round ${request.funding_round}`} icon={Pencil} tone="bg-amber-100 text-amber-600" onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={submitting || (cap !== null && total > cap)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    {submitting && <Loader2 size={14} className="animate-spin" />} Save changes
                </button>
            </>}>
            <ItemsEditor items={items} setItems={setItems} cap={cap}
                capNote={isRound1 && cap !== null && <Callout tone="sky" icon={Lock}>Round 1 is capped at 50% of the award ({formatCurrency(cap)}).</Callout>} />
            <Callout tone="amber" icon={AlertTriangle}>Saving clears the signatures collected so far — everyone signs again.</Callout>
        </Sheet>
    );
}

// ─── Officer modals ───────────────────────────────────────────────────────────

function ReturnModal({ request, onConfirm, onClose }) {
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const valid = notes.trim().length >= 10;
    return (
        <Sheet title="Return to the college" subtitle={request.proposal?.tracker_number} icon={XCircle} tone="bg-orange-100 text-orange-600" onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={async () => { setSaving(true); await onConfirm(notes.trim()); setSaving(false); }} disabled={!valid || saving}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                    {saving && <Loader2 size={14} className="animate-spin" />} Return with notes
                </button>
            </>}>
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">What needs to change?</span>
                <textarea rows={4} autoFocus value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain what the college officer should address…" className={`${inputCls} resize-none`} />
                <span className={`mt-1 block text-xs ${valid ? 'text-gray-400' : 'text-gray-500'}`}>At least 10 characters.</span>
            </label>
        </Sheet>
    );
}

function DisburseModal({ request, onClose, onSuccess }) {
    const { error, success } = useToast();
    const [amount, setAmount] = useState(String(request.total_amount ?? ''));
    const [transactionId, setTransactionId] = useState('');
    const [chequeNumber, setChequeNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!amount || parseFloat(amount) <= 0) return error('Enter a valid amount.');
        setSaving(true);
        try {
            await api.post(`/budget-requests/${request.id}/disburse`, {
                amount: parseFloat(amount), transaction_id: transactionId || undefined, cheque_number: chequeNumber || undefined, notes: notes || undefined,
            });
            success('Funds disbursed. The team has been told.');
            onSuccess();
        } catch (e) {
            error(e.response?.data?.message ?? 'The disbursement could not be recorded.');
        }
        setSaving(false);
    };

    return (
        <Sheet title="Record disbursement" subtitle={`${request.proposal?.tracker_number} · ${formatCurrency(request.total_amount)} approved`} icon={Banknote} tone="bg-teal-100 text-teal-600" onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={saving || !amount}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                    {saving && <Loader2 size={14} className="animate-spin" />} Record disbursement
                </button>
            </>}>
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Amount paid ({currency()})</span>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} tabular-nums`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Transaction reference</span>
                    <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Optional" className={inputCls} />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Cheque number</span>
                    <input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="Optional" className={inputCls} />
                </label>
            </div>
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Notes</span>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={`${inputCls} resize-none`} />
            </label>
        </Sheet>
    );
}

// ─── What the viewer may do with a request ────────────────────────────────────

function useAbilities() {
    const { user, hasPermission } = useAuth();
    // Same stages as the server: the college stage is for those who can't give the finance approval.
    const isFinance = hasPermission('budget_requests.approve_finance');
    const isCollege = hasPermission('budget_requests.approve_college') && !isFinance;
    const canPay = hasPermission('funds.disburse');

    return useCallback((request) => {
        const sigs = request.signatures ?? [];
        const allSigned = sigs.length > 0 && sigs.every((s) => s.status === 'signed');
        const mine = request.requested_by?.id === user?.id;
        const a = {
            sign: sigs.find((s) => s.user_id === user?.id)?.status === 'pending',
            submit: allSigned && ['draft', 'pending_signatures'].includes(request.status),
            edit: ['draft', 'pending_signatures'].includes(request.status) && mine && !allSigned,
            collegeDecide: isCollege && ['submitted', 'finance_returned'].includes(request.status),
            financeDecide: isFinance && request.status === 'college_approved',
            disburse: canPay && request.status === 'approved',
            isOfficer: isCollege || isFinance,
        };
        a.needsMe = a.sign || a.submit || a.collegeDecide || a.financeDecide || a.disburse;
        return a;
    }, [user?.id, isCollege, isFinance, canPay]);
}

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({ request, can, onRefresh }) {
    const { error, success } = useToast();
    const { confirm, Dialog } = useConfirm();
    const [expanded, setExpanded] = useState(can.needsMe);
    const [modal, setModal] = useState(null);

    const sigs = request.signatures ?? [];
    const paid = (request.disbursements ?? []).reduce((s, d) => s + parseFloat(d.amount || 0), 0);

    const act = async (label, call, done) => {
        const ok = await confirm({ title: `${label}?`, confirmLabel: label });
        if (!ok) return;
        try { await call(); success(done); onRefresh(); } catch (e) { error(e.response?.data?.message ?? `${label} failed.`); }
    };

    const remove = async () => {
        const ok = await confirm({ title: 'Delete this budget request?', description: 'The request and its signatures are removed for good.', confirmLabel: 'Delete', variant: 'destructive' });
        if (!ok) return;
        try { await api.delete(`/budget-requests/${request.id}`); success('Budget request deleted.'); onRefresh(); } catch (e) { error(e.response?.data?.message ?? 'The request could not be deleted.'); }
    };

    const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold';

    return (
        <article className={`overflow-hidden rounded-2xl border bg-white transition hover:shadow-md ${can.needsMe ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200'}`}>
            <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-start gap-4 px-5 py-4 text-left">
                <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:flex"><DollarSign size={18} /></span>
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                        <ProposalHover id={request.proposal?.id} className="font-mono text-xs font-bold text-indigo-600">{request.proposal?.tracker_number}</ProposalHover>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Round {request.funding_round}</span>
                        <ProgrammeDot category={request.proposal?.category} />
                        <StatusBadge status={request.status} />
                        {can.needsMe && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">Your turn</span>}
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold text-gray-900"><ProposalHover id={request.proposal?.id}>{request.proposal?.title}</ProposalHover></span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="font-bold tabular-nums text-gray-900">{formatCurrency(request.total_amount)}</span>
                        {sigs.length > 0 && <SigProgress signatures={sigs} />}
                        <span>{formatDate(request.created_at)}</span>
                        {request.requested_by?.name && <span>by {request.requested_by.name}</span>}
                    </span>
                </span>
                <ChevronDown size={16} className={`mt-1 shrink-0 text-gray-400 transition ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <div className="space-y-4 border-t border-gray-100 bg-gray-50/50 px-5 py-4">
                    <StageTrack status={request.status} />

                    {request.status === 'finance_returned' && request.finance_notes && <Callout tone="orange" icon={XCircle} title="Returned by finance">{request.finance_notes}</Callout>}
                    {request.status === 'rejected' && request.rejection_reason && <Callout tone="red" icon={XCircle} title="Rejected">{request.rejection_reason}</Callout>}
                    {request.college_review_notes && ['college_approved', 'approved'].includes(request.status) && <Callout tone="indigo" icon={Building2} title="College notes">{request.college_review_notes}</Callout>}
                    {request.status === 'approved' && !can.isOfficer && (
                        <Callout tone="emerald" icon={Trophy} title="Approved — ready to collect">
                            {formatCurrency(request.total_amount)} was approved by finance{request.approved_at ? ` on ${formatDate(request.approved_at)}` : ''}. Visit the finance office to collect it.
                        </Callout>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                        {(request.items ?? []).length > 0 && (
                            <div className="rounded-xl border border-gray-200 bg-white">
                                <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Items</p>
                                <ul className="divide-y divide-gray-50">
                                    {request.items.map((item, i) => (
                                        <li key={i} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                                            <span className="min-w-0">
                                                <span className="font-medium text-gray-800">{item.category}</span>
                                                {item.description && <span className="block truncate text-xs text-gray-500">{item.description}</span>}
                                            </span>
                                            <span className="shrink-0 font-semibold tabular-nums text-gray-900">{formatCurrency(item.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex justify-between border-t border-gray-100 px-4 py-2.5 text-sm font-bold">
                                    <span>Total</span><span className="tabular-nums">{formatCurrency(request.total_amount)}</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {sigs.length > 0 && (
                                <div className="rounded-xl border border-gray-200 bg-white">
                                    <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Signatures</p>
                                    <ul className="divide-y divide-gray-50">
                                        {sigs.map((sig) => (
                                            <li key={sig.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${sig.status === 'signed' ? 'bg-emerald-500 text-white' : sig.status === 'refused' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    {sig.status === 'signed' ? <CheckCircle2 size={12} /> : sig.status === 'refused' ? <XCircle size={12} /> : <Clock size={12} />}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate"><span className="font-medium text-gray-800">{sig.user?.name ?? '—'}</span> <span className="text-xs capitalize text-gray-400">{sig.role}</span></span>
                                                <span className={`text-xs font-medium capitalize ${sig.status === 'signed' ? 'text-emerald-600' : sig.status === 'refused' ? 'text-red-500' : 'text-gray-400'}`}>{sig.status}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {(request.disbursements ?? []).length > 0 && (
                                <div className="rounded-xl border border-teal-200 bg-teal-50/60">
                                    <p className="flex justify-between border-b border-teal-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
                                        <span>Disbursed</span><span className="tabular-nums">{formatCurrency(paid)}</span>
                                    </p>
                                    <ul className="divide-y divide-teal-100">
                                        {request.disbursements.map((d, i) => (
                                            <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                                                <span className="min-w-0">
                                                    <span className="font-semibold tabular-nums text-teal-900">{formatCurrency(d.amount)}</span>
                                                    <span className="block truncate text-xs text-teal-700">{[d.transaction_id && `Ref ${d.transaction_id}`, d.cheque_number && `Cheque ${d.cheque_number}`].filter(Boolean).join(' · ') || '—'}</span>
                                                </span>
                                                <span className="shrink-0 text-xs text-teal-700">{formatDate(d.created_at)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                        {can.sign && <button onClick={() => act('Sign', () => api.post(`/budget-requests/${request.id}/sign`), 'Signed.')} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}><PenLine size={12} /> Sign</button>}
                        {can.submit && <button onClick={() => act('Submit for college review', () => api.post(`/budget-requests/${request.id}/submit`), 'Sent to the college for review.')} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}><Send size={12} /> Submit for review</button>}
                        {can.collegeDecide && <>
                            <button onClick={() => act('Approve for the college', () => api.post(`/budget-requests/${request.id}/approve`), 'Approved and sent to finance.')} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}><CheckCircle2 size={12} /> Approve</button>
                            <button onClick={() => setModal('reject')} className={`${btn} border border-red-200 bg-white text-red-600 hover:bg-red-50`}><XCircle size={12} /> Reject</button>
                        </>}
                        {can.financeDecide && <>
                            <button onClick={() => act('Give finance approval', () => api.post(`/budget-requests/${request.id}/approve`), 'Approved. The team has been told to collect the funds.')} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}><CheckCircle2 size={12} /> Finance approve</button>
                            <button onClick={() => setModal('return')} className={`${btn} border border-orange-200 bg-white text-orange-600 hover:bg-orange-50`}><XCircle size={12} /> Return to college</button>
                        </>}
                        {can.disburse && <button onClick={() => setModal('disburse')} className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}><Banknote size={12} /> Disburse</button>}
                        {can.edit && <>
                            <button onClick={() => setModal('edit')} className={`${btn} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}><Pencil size={12} /> Edit</button>
                            <button onClick={remove} className={`${btn} border border-gray-200 bg-white text-red-600 hover:bg-red-50`}><Trash2 size={12} /> Delete</button>
                        </>}
                        <Link href={`/budget-requests/${request.id}`} className={`${btn} ml-auto text-indigo-600 hover:bg-indigo-50`}>Full details <ArrowRight size={12} /></Link>
                    </div>
                </div>
            )}

            {modal === 'edit' && <EditModal request={request} onClose={() => setModal(null)} onSuccess={() => { setModal(null); onRefresh(); }} />}
            {modal === 'disburse' && <DisburseModal request={request} onClose={() => setModal(null)} onSuccess={() => { setModal(null); onRefresh(); }} />}
            {modal === 'return' && (
                <ReturnModal request={request} onClose={() => setModal(null)} onConfirm={async (notes) => {
                    try {
                        await api.post(`/budget-requests/${request.id}/finance-return`, { notes });
                        success('Returned to the college officer with your notes.');
                        setModal(null);
                        onRefresh();
                    } catch (e) { error(e.response?.data?.message ?? 'The request could not be returned.'); }
                }} />
            )}
            {modal === 'reject' && (
                <RejectWithReasonModal context="budget_request" title="Reject budget request" subtitle={request.proposal?.tracker_number}
                    note="The team is told this reason so they can correct it and try again." confirmLabel="Reject & notify" detailsField="notes"
                    onSubmit={async (payload) => {
                        await api.post(`/budget-requests/${request.id}/reject`, payload);
                        success('Budget request rejected. The team has been told.');
                        setModal(null);
                        onRefresh();
                    }}
                    onClose={() => setModal(null)} />
            )}
            <Dialog />
        </article>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'all', label: 'All', match: () => true },
    { key: 'mine', label: 'Needs my action', match: (r, can) => can(r).needsMe },
    { key: 'signing', label: 'Signing', match: (r) => ['draft', 'pending_signatures'].includes(r.status) },
    { key: 'college', label: 'College review', match: (r) => ['submitted', 'finance_returned'].includes(r.status) },
    { key: 'finance', label: 'Finance review', match: (r) => r.status === 'college_approved' },
    { key: 'approved', label: 'Ready to pay', match: (r) => r.status === 'approved' },
    { key: 'paid', label: 'Disbursed', match: (r) => r.status === 'disbursed' },
    { key: 'settled', label: 'Settled', match: (r) => r.status === 'settled' },
    { key: 'rejected', label: 'Rejected', match: (r) => r.status === 'rejected' },
];

export default function BudgetRequests() {
    const { hasPermission, accessScope } = useAuth();
    const { success, error } = useToast();
    const [view, setView] = useViewPreference('budget_requests', 'card');
    const can = useAbilities();

    // Researchers request money for their own projects; officers see requests within their scope.
    const isPI = accessScope.type === 'own' && hasPermission('budget_requests.create');

    const [requests, setRequests] = useState(null);
    const [fundedProposals, setFundedProposals] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    // Other pages link here with ?proposal=<tracker number> to show one project's requests.
    const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('proposal') ?? '');
    const [round, setRound] = useState('');
    const [programme, setProgramme] = useState('');
    const [college, setCollege] = useState('');
    const [year, setYear] = useState('');
    const [create, setCreate] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        api.get('/budget-requests')
            .then((r) => setRequests(Array.isArray(r.data?.data) ? r.data.data : []))
            .catch(() => { setRequests([]); error('Could not load budget requests.'); })
            .finally(() => setLoading(false));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        load();
        if (isPI) {
            api.get('/proposals/my')
                .then(async (r) => {
                    // Midterm evaluation counts as funded: the project moves there once a midterm is scheduled.
                    const funded = (r.data?.data ?? []).filter((p) => ['funded', 'midterm_evaluation'].includes(p.status));
                    // Hide projects whose whole award is already used (no award yet still shows).
                    const summaries = await Promise.all(funded.map((p) => api.get(`/proposals/${p.id}/budget-summary`)
                        .then((s) => { const d = s.data?.data ?? {}; return { id: p.id, exhausted: parseFloat(d.awarded_amount ?? 0) > 0 && parseFloat(d.remaining ?? 0) <= 0 }; })
                        .catch(() => ({ id: p.id, exhausted: false }))));
                    const exhausted = new Set(summaries.filter((s) => s.exhausted).map((s) => s.id));
                    setFundedProposals(funded.filter((p) => !exhausted.has(p.id)));
                })
                .catch(() => {});
        }
        api.get('/form-templates').then((r) => setTemplates(r.data?.data ?? [])).catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Once loaded, open on the requests waiting for this person if there are any.
    useEffect(() => {
        if (!search && requests?.some((r) => can(r).needsMe)) setTab((t) => (t === 'all' ? 'mine' : t));
    }, [requests === null]); // eslint-disable-line react-hooks/exhaustive-deps

    const all = requests ?? [];
    const rounds = [...new Set(all.map((r) => r.funding_round).filter(Boolean))].sort((a, b) => a - b);

    const colleges = [...new Map(all.filter((r) => r.proposal?.college).map((r) => [r.proposal.college.id, r.proposal.college.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const years = [...new Set(all.map((r) => r.proposal?.academic_year).filter(Boolean))].sort().reverse();
    const usedProgrammes = [...new Set(all.map((r) => r.proposal?.category).filter(Boolean))];

    const scoped = useMemo(() => {
        const q = search.trim().toLowerCase();
        return all.filter((r) => (!round || String(r.funding_round) === round)
            && (!programme || r.proposal?.category === programme)
            && (!college || r.proposal?.college_id === college)
            && (!year || r.proposal?.academic_year === year)
            && (!q || [r.proposal?.tracker_number, r.proposal?.title, r.requested_by?.name, r.proposal?.pi?.name].some((v) => v?.toLowerCase().includes(q))));
    }, [all, search, round, programme, college, year]);

    const filtersOn = !!(search || round || programme || college || year || tab !== 'all');
    const clearFilters = () => { setSearch(''); setRound(''); setProgramme(''); setCollege(''); setYear(''); setTab('all'); };

    const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
    const visible = scoped.filter((r) => activeTab.match(r, can));

    const sum = (list) => list.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
    const inReview = scoped.filter((r) => ['submitted', 'finance_returned', 'college_approved'].includes(r.status));
    const ready = scoped.filter((r) => r.status === 'approved');
    const paidOut = scoped.reduce((s, r) => s + (r.disbursements ?? []).reduce((x, d) => x + parseFloat(d.amount || 0), 0), 0);
    const waitingOnMe = scoped.filter((r) => can(r).needsMe).length;

    const columns = [
        { key: 'proposal', label: 'Project', render: (r) => (
            <div className="min-w-0">
                <ProposalHover id={r.proposal?.id} className="font-mono text-xs font-bold text-indigo-600">{r.proposal?.tracker_number}</ProposalHover>
                <p className="max-w-64 truncate text-xs text-gray-500">{r.proposal?.title}</p>
            </div>
        ) },
        { key: 'round', label: 'Round', render: (r) => <span className="text-xs font-semibold text-gray-700">{r.funding_round}</span> },
        { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold text-gray-900">{formatCurrency(r.total_amount)}</span> },
        { key: 'status', label: 'Status', render: (r) => <span className="inline-flex items-center gap-1.5"><StatusBadge status={r.status} />{can(r).needsMe && <span className="h-2 w-2 rounded-full bg-indigo-600" title="Your turn" />}</span> },
        { key: 'sigs', label: 'Signatures', render: (r) => <SigProgress signatures={r.signatures ?? []} /> },
        { key: 'date', label: 'Created', render: (r) => <span className="text-xs text-gray-500">{formatDate(r.created_at)}</span> },
        { key: 'go', label: '', align: 'right', render: (r) => <Link href={`/budget-requests/${r.id}`} className="text-xs font-semibold text-indigo-600 hover:underline">Open</Link> },
    ];

    return (
        <AppLayout breadcrumb="Budget Requests">
            <div className="mx-auto max-w-6xl space-y-5">
                <PageHeader icon={DollarSign} color="indigo" title="Budget Requests"
                    description={isPI ? 'Ask for each round of your project’s funds and follow it to payment.' : 'Requests for project funds, from signatures to payment and settlement.'}>
                    <ViewToggle view={view} onChange={setView} />
                    <DownloadMenu filename="budget-requests" title="Budget requests" subtitle={(TABS.find((t) => t.key === tab) ?? TABS[0]).label} rows={visible} columns={[
                        { label: 'Tracker', value: (r) => r.proposal?.tracker_number },
                        { label: 'Title', value: (r) => r.proposal?.title },
                        { label: 'PI', value: (r) => r.proposal?.pi?.name },
                        { label: term('college'), value: (r) => r.proposal?.college?.name },
                        { label: 'Programme', value: (r) => programmeLabel(r.proposal?.category) },
                        { label: 'Round', value: (r) => r.funding_round },
                        { label: 'Amount', value: (r) => parseFloat(r.total_amount || 0) },
                        { label: 'Paid out', value: (r) => (r.disbursements ?? []).reduce((x, d) => x + parseFloat(d.amount || 0), 0) },
                        { label: 'Status', value: (r) => STATUS_CONFIG[r.status]?.label ?? r.status },
                        { label: 'Signatures', value: (r) => `${(r.signatures ?? []).filter((x) => x.status === 'signed').length}/${(r.signatures ?? []).length}` },
                        { label: 'Requested by', value: (r) => r.requested_by?.name },
                        { label: 'Created', value: (r) => (r.created_at ? formatDate(r.created_at) : '') },
                    ]} />
                    <RefreshButton onClick={load} loading={loading} />
                    {isPI && fundedProposals.length > 0 && (
                        <button onClick={() => setCreate({ proposal: null })}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                            <Plus size={15} /> New request
                        </button>
                    )}
                </PageHeader>

                {requests === null ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={Inbox} color="indigo" label="Waiting on you" value={waitingOnMe}
                            hint={waitingOnMe ? 'Open “Needs my action”' : 'You’re all caught up'} hintTone={waitingOnMe ? 'text-indigo-600 font-medium' : undefined} />
                        <StatCard icon={Clock} color="amber" label="In review" value={formatCurrency(sum(inReview))} hint={`${inReview.length} request${inReview.length === 1 ? '' : 's'} at college or finance`} />
                        <StatCard icon={CheckCircle2} color="emerald" label="Approved, not yet paid" value={formatCurrency(sum(ready))} hint={`${ready.length} request${ready.length === 1 ? '' : 's'}`} />
                        <StatCard icon={Banknote} color="sky" label="Paid out" value={formatCurrency(paidOut)} hint={`${scoped.length} request${scoped.length === 1 ? '' : 's'} in view`} />
                    </div>
                )}

                {isPI && fundedProposals.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50 to-teal-50 p-4 sm:flex-row sm:items-center">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 ring-1 ring-emerald-200"><Wallet size={18} /></span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-emerald-900">{fundedProposals.length} funded project{fundedProposals.length > 1 ? 's' : ''} can request funds</p>
                            <p className="text-xs text-emerald-700">Pick one to start this round’s request.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {fundedProposals.map((p) => (
                                <button key={p.id} onClick={() => setCreate({ proposal: p })}
                                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-mono text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100">
                                    {p.tracker_number} <ArrowRight size={11} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <label className="relative min-w-0 flex-1">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tracker number, title or requester…"
                                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            {usedProgrammes.length > 1 && (
                                <Select label="Programme" value={programme} onChange={setProgramme} className="sm:w-44">
                                    <option value="">All programmes</option>
                                    {usedProgrammes.map((k) => <option key={k} value={k}>{programmeLabel(k)}</option>)}
                                </Select>
                            )}
                            {colleges.length > 1 && (
                                <Select label={term('college')} value={college} onChange={setCollege} className="sm:w-44">
                                    <option value="">All {term('college', { plural: true, lower: true })}</option>
                                    {colleges.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                                </Select>
                            )}
                            {years.length > 1 && (
                                <Select label="Year" value={year} onChange={setYear} className="sm:w-32">
                                    <option value="">All years</option>
                                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                </Select>
                            )}
                            {rounds.length > 1 && (
                                <Select label="Round" value={round} onChange={setRound} className="sm:w-32">
                                    <option value="">All rounds</option>
                                    {rounds.map((n) => <option key={n} value={String(n)}>Round {n}</option>)}
                                </Select>
                            )}
                            {filtersOn && <ClearButton onClick={clearFilters} />}
                        </div>
                    </div>
                    <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
                        {TABS.map((t) => {
                            const count = scoped.filter((r) => t.match(r, can)).length;
                            if (t.key !== 'all' && t.key !== 'mine' && count === 0 && tab !== t.key) return null;
                            return (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                    {t.label}
                                    <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === t.key ? 'bg-white/20' : t.key === 'mine' && count ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {requests === null ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
                ) : visible.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={DollarSign}
                            title={tab === 'mine' ? 'Nothing is waiting on you' : all.length === 0 ? 'No budget requests yet' : 'Nothing matches'}
                            text={tab === 'mine' ? 'Requests you need to sign, review, approve or pay will show here.' : all.length === 0 ? (isPI ? 'Once your project is funded and its allocation approved, start a request here.' : 'Requests appear here as teams submit them.') : 'Try another tab or search.'} />
                    </Panel>
                ) : view === 'card' ? (
                    <div className="space-y-3">
                        {visible.map((r) => <RequestCard key={r.id} request={r} can={can(r)} onRefresh={load} />)}
                    </div>
                ) : (
                    <>
                        <Panel bodyClassName="p-0" className="hidden sm:flex">
                            <DataTable columns={columns} rows={visible} rowKey={(r) => r.id} minWidth={760} />
                        </Panel>
                        <div className="space-y-3 sm:hidden">
                            {visible.map((r) => <RequestCard key={r.id} request={r} can={can(r)} onRefresh={load} />)}
                        </div>
                    </>
                )}
            </div>

            {create && (
                <CreateModal proposals={fundedProposals} templates={templates} preselected={create.proposal}
                    onClose={() => setCreate(null)}
                    onSuccess={() => { setCreate(null); success('Budget request created. Team members have been asked to sign.'); load(); }} />
            )}
        </AppLayout>
    );
}
