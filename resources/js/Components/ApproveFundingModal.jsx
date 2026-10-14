import { useEffect, useState } from 'react';
import { BadgeCheck, X, AlertTriangle, Info, Wallet, TrendingUp, TrendingDown, History, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { useToast } from './Toast';
import { formatCurrency, getCategoryLabel } from '../lib/utils';

const MAX_REMARKS = 2000;

const NEXT_STEPS = [
    'A grant reference is issued and the award is recorded.',
    'The proposal moves to Funded and the PI and team are notified.',
    'The PI signs the research contract; budget allocation follows on the Funding page.',
];

const parseAmount = (text) => {
    const n = parseFloat(String(text).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
};

const formatInput = (text) => {
    const [whole, decimals] = String(text).replace(/[^\d.]/g, '').split('.');
    const grouped = (whole || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimals !== undefined ? `${grouped}.${decimals.slice(0, 2)}` : grouped;
};

/**
 * Central office funding decision: confirm the award amount against the request,
 * see the scores and the PI's current funding at a glance, and record remarks.
 *
 * `onSubmit({ awarded_amount, remarks })` performs the request; throw to keep the
 * modal open (the server's message is shown).
 */
export default function ApproveFundingModal({ proposal, onSubmit, onClose }) {
    const { error } = useToast();
    const requested = Number(proposal.budget_total ?? 0);
    const [amount, setAmount] = useState(requested > 0 ? formatInput(String(requested)) : '');
    const [remarks, setRemarks] = useState('');
    const [history, setHistory] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!proposal.pi?.id) return;
        api.get(`/central-evaluation/pi/${proposal.pi.id}/funding-history`)
            .then((res) => setHistory(res.data?.data ?? null))
            .catch(() => {});
    }, [proposal.pi?.id]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [saving, onClose]);

    const value = parseAmount(amount);
    const amountValid = value !== null && value >= 1;
    const pctOfRequest = requested > 0 && value ? Math.round((value / requested) * 100) : null;
    const overRequest = requested > 0 && value > requested;
    const totalMax = (proposal.blind_max ?? 0) + (proposal.defence_max ?? 0);
    const passes = (proposal.combined_score ?? 0) >= (proposal.threshold ?? 0);
    const activeGrants = history?.active_funded?.length ?? 0;
    const canSubmit = amountValid && !saving;

    const submit = async () => {
        if (!canSubmit) return;
        setSaving(true);
        try {
            await onSubmit({ awarded_amount: value, remarks: remarks.trim() || null });
        } catch (e) {
            const errors = e?.response?.data?.errors;
            error(errors && Object.keys(errors).length ? Object.values(errors).flat()[0] : (e?.response?.data?.message ?? 'The approval could not be saved.'));
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="approve-funding-title"
                className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
                <div className="h-1.5 shrink-0 rounded-t-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />

                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 ring-4 ring-emerald-50">
                            <BadgeCheck size={20} />
                        </div>
                        <div>
                            <h2 id="approve-funding-title" className="text-lg font-bold text-gray-900">Approve for Funding</h2>
                            <p className="mt-0.5 text-xs text-gray-500">
                                <span className="font-mono font-semibold text-gray-600">{proposal.tracker_number}</span> · Central Evaluation decision
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={saving} aria-label="Close"
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-5 overflow-y-auto px-6 py-5">
                    {/* Proposal summary */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{proposal.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                            {[proposal.pi?.name, proposal.college?.name, getCategoryLabel(proposal.category)].filter(Boolean).join(' · ')}
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Combined Score</p>
                                <p className={`mt-0.5 flex items-center gap-1 text-sm font-bold ${passes ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {passes ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                    {proposal.combined_score ?? '—'}
                                    <span className="font-normal text-gray-400">/ {totalMax}</span>
                                </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Requested</p>
                                <p className="mt-0.5 text-sm font-bold text-gray-900">{formatCurrency(requested)}</p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">PI Active Grants</p>
                                <p className={`mt-0.5 flex items-center gap-1 text-sm font-bold ${activeGrants ? 'text-amber-600' : 'text-gray-900'}`}>
                                    <History size={13} className="text-gray-400" />
                                    {history ? activeGrants : '…'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {history?.has_overlap && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                            <span>
                                {proposal.pi?.name ?? 'The PI'} already holds {activeGrants} active grant{activeGrants === 1 ? '' : 's'}
                                {' '}({history.active_funded.map((g) => g.tracker_number).join(', ')}). Approving creates concurrent funding.
                            </span>
                        </div>
                    )}

                    {proposal.defence_below_threshold && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                            <span>
                                The open defence score ({proposal.defence_score_raw}/{proposal.defence_max}) is below its own threshold
                                ({proposal.defence_threshold} pts), although the combined score passed.
                            </span>
                        </div>
                    )}

                    {/* Award amount */}
                    <div>
                        <label htmlFor="award-amount" className="mb-1.5 block text-xs font-semibold text-gray-700">
                            Award amount <span className="text-red-500">*</span>
                        </label>
                        <div className="flex rounded-xl border border-gray-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200">
                            <span className="flex items-center gap-1.5 rounded-l-xl border-r border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-500">
                                <Wallet size={13} /> ETB
                            </span>
                            <input
                                id="award-amount"
                                inputMode="decimal"
                                autoFocus
                                value={amount}
                                onChange={(e) => setAmount(formatInput(e.target.value))}
                                placeholder="0.00"
                                className="w-full rounded-r-xl px-3 py-2.5 text-base font-semibold tabular-nums text-gray-900 focus:outline-none"
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                            {!amountValid ? (
                                <span className="text-red-500">Enter an amount of at least ETB 1.</span>
                            ) : overRequest ? (
                                <span className="flex items-center gap-1 text-amber-600">
                                    <AlertTriangle size={12} /> {formatCurrency(value - requested)} more than requested
                                </span>
                            ) : pctOfRequest !== null ? (
                                <span className="text-gray-500">
                                    {pctOfRequest === 100 ? 'Full requested budget' : `${pctOfRequest}% of the requested budget`}
                                </span>
                            ) : <span />}
                            {requested > 0 && value !== requested && (
                                <button type="button" onClick={() => setAmount(formatInput(String(requested)))}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100">
                                    Use full request
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label htmlFor="award-remarks" className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-700">
                            <span>Central office remarks <span className="font-normal text-gray-400">(optional)</span></span>
                            <span className="font-normal tabular-nums text-gray-400">{remarks.length}/{MAX_REMARKS}</span>
                        </label>
                        <textarea
                            id="award-remarks"
                            rows={3}
                            value={remarks}
                            maxLength={MAX_REMARKS}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Conditions of the award, budget adjustments, or notes for the research team…"
                            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <p className="mt-1 text-[11px] text-gray-400">Saved with the award and the proposal's history.</p>
                    </div>

                    {/* What happens next */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Info size={13} className="text-slate-400" /> What happens next
                        </p>
                        <ul className="space-y-1.5">
                            {NEXT_STEPS.map((step) => (
                                <li key={step} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                                    {step}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row">
                    <button onClick={onClose} disabled={saving}
                        className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={!canSubmit}
                        className="flex flex-[1.6] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {saving ? (
                            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Approving…</>
                        ) : (
                            <><BadgeCheck size={15} /> Approve{amountValid ? ` · ${formatCurrency(value)}` : ''}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
