import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CheckCircle2, Clock, XCircle, Send, Sparkles, FileDown, Loader2, AlertTriangle, Wallet, Lock, Info, X,
    MessageSquareText, Trophy, Undo2, BadgeCheck, ChevronLeft, ChevronRight, PanelRightOpen, Pencil,
} from 'lucide-react';
import ProposalInsights from './CentralEvaluation/ProposalInsights';
import api from '../lib/api';
import { useToast } from './Toast';
import { Panel, EmptyState, Skeleton } from './Insights/Kit';
import ProposalHover from './Finance/ProposalHover';
import { downloadFile } from '../lib/download';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { currency } from '../lib/terms';
import { REJECTION_REASONS } from '../lib/rejectionReasons';

const REASONS = REJECTION_REASONS.central_evaluation;

const DECISIONS = [
    { key: 'fund', label: 'Fund', icon: CheckCircle2, on: 'bg-emerald-600 text-white border-emerald-600' },
    { key: 'reserve', label: 'Reserve', icon: Clock, on: 'bg-amber-500 text-white border-amber-500' },
    { key: 'reject', label: 'Reject', icon: XCircle, on: 'bg-red-600 text-white border-red-600' },
];
const LABEL = { fund: 'Funded', reserve: 'Reserve list', reject: 'Not funded', pending: 'No decision' };
const CHIP = { fund: 'bg-emerald-50 text-emerald-700', reserve: 'bg-amber-50 text-amber-700', reject: 'bg-red-50 text-red-700', pending: 'bg-gray-100 text-gray-600' };

/**
 * The money at a glance: the budget (the call's, or the college's share), what is used
 * already, what open rounds plan to award, and what is left — red once it runs out.
 */
function BudgetBar({ budget }) {
    if (budget.budget === null) {
        return (
            <p className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
                <Info size={14} className="shrink-0 text-gray-400" /> No funding budget was set for this call when it was decided.
            </p>
        );
    }
    const others = budget.other_drafts ?? 0;
    const planned = others + budget.funding;
    const total = Math.max(budget.budget, budget.committed + planned, 1);
    const pct = (v) => `${(Math.max(0, v) / total) * 100}%`;
    const share = (v) => `${Math.round((Math.max(0, v) / Math.max(budget.budget, 1)) * 100)}%`;
    const over = budget.after < -0.005;
    const empty = !over && budget.after < 0.005;
    const isShare = budget.scope === 'college';

    const tiles = [
        { label: isShare ? 'Your college’s share' : 'Total budget', value: formatCurrency(budget.budget), hint: isShare ? `of the call’s ${budget.call_total != null ? formatCurrency(budget.call_total) : '—'}` : (budget.allocated ? `${formatCurrency(budget.allocated)} shared to colleges` : 'For the whole call'), tone: 'text-gray-900', dot: 'bg-gray-300' },
        { label: 'Used so far', value: formatCurrency(budget.committed), hint: `${share(budget.committed)} · already awarded`, tone: 'text-slate-700', dot: 'bg-slate-400' },
        { label: 'Planned now', value: formatCurrency(planned), hint: others > 0 ? `${formatCurrency(budget.funding)} here · ${formatCurrency(others)} ${isShare ? 'by the central office' : 'by colleges'}` : 'In this round, not yet published', tone: over ? 'text-red-700' : 'text-emerald-700', dot: over ? 'bg-red-500' : 'bg-emerald-500' },
    ];

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {tiles.map((t) => (
                    <div key={t.label} className="rounded-xl bg-gray-50 px-3.5 py-2.5 ring-1 ring-gray-100">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><span className={`h-2 w-2 rounded-sm ${t.dot}`} /> {t.label}</p>
                        <p className={`mt-0.5 truncate text-base font-bold tabular-nums ${t.tone}`}>{t.value}</p>
                        <p className="truncate text-[11px] text-gray-500">{t.hint}</p>
                    </div>
                ))}
                <div className={`rounded-xl px-3.5 py-2.5 ring-1 ${over || empty ? 'bg-red-50 ring-red-200' : 'bg-emerald-50 ring-emerald-200'}`}>
                    <p className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${over || empty ? 'text-red-700' : 'text-emerald-700'}`}>
                        {over || empty ? <AlertTriangle size={11} /> : <Wallet size={11} />} Remaining
                    </p>
                    <p className={`mt-0.5 truncate text-base font-bold tabular-nums ${over || empty ? 'text-red-700' : 'text-emerald-800'}`}>{formatCurrency(Math.max(0, budget.after))}</p>
                    <p className={`truncate text-[11px] ${over || empty ? 'font-semibold text-red-600' : 'text-emerald-700'}`}>
                        {over ? `Insufficient — ${formatCurrency(-budget.after)} over` : empty ? 'Insufficient budget — fully used' : `${share(budget.after)} still free`}
                    </p>
                </div>
            </div>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-gray-100" role="img"
                aria-label={`Used ${formatCurrency(budget.committed)}, planned ${formatCurrency(planned)}, remaining ${formatCurrency(Math.max(0, budget.after))} of ${formatCurrency(budget.budget)}`}>
                {budget.committed > 0 && <div className="rounded-full bg-slate-400" style={{ width: pct(budget.committed) }} title={`Used so far: ${formatCurrency(budget.committed)}`} />}
                {others > 0 && <div className="rounded-full bg-sky-400" style={{ width: pct(others) }} title={`Planned in other open rounds: ${formatCurrency(others)}`} />}
                {budget.funding > 0 && <div className={`rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: pct(budget.funding) }} title={`This round: ${formatCurrency(budget.funding)}`} />}
            </div>
        </div>
    );
}

/** A score as a ring: how much of the maximum points the proposal earned. */
function ScoreRing({ score, max }) {
    const pct = max ? Math.max(0, Math.min(1, score / max)) : 0;
    const r = 18;
    const c = 2 * Math.PI * r;
    const tone = pct >= 0.8 ? '#059669' : pct >= 0.65 ? '#4f46e5' : '#d97706';
    return (
        <div className="relative h-12 w-12 shrink-0" title={`${score ?? '—'} of ${max ?? '—'} points`}>
            <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
                <circle cx="22" cy="22" r={r} fill="none" stroke="#eef0f3" strokeWidth="5" />
                <circle cx="22" cy="22" r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${pct * c} ${c}`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-gray-900">{Math.round(pct * 100)}%</span>
        </div>
    );
}

const STRIPE = { fund: 'bg-emerald-500', reserve: 'bg-amber-400', reject: 'bg-red-500', pending: 'bg-gray-200' };

const reasonText = (item) => [REASONS.find((r) => r.key === item.reason_code && r.key !== 'other')?.label, item.reason].filter(Boolean).join(' — ');

/** One proposal: rank, score, money and the quick choice. The full review opens in the side panel. */
function Row({ item, editable, onSave, onPromote, onOpen, cutoffBefore, moneyLeft = null }) {
    const [amount, setAmount] = useState(item.amount ?? item.requested ?? '');
    const [remarks, setRemarks] = useState(item.remarks ?? '');
    const [showNote, setShowNote] = useState(!!item.remarks);
    const [saving, setSaving] = useState(false);
    const timer = useRef(null);

    useEffect(() => { setAmount(item.amount ?? item.requested ?? ''); }, [item.amount, item.requested]);
    useEffect(() => { setRemarks(item.remarks ?? ''); }, [item.remarks]);

    const save = async (patch) => {
        setSaving(true);
        const ok = await onSave(item, { decision: item.decision, amount: item.decision === 'fund' ? Number(amount) || null : null, reason_code: item.reason_code, reason: item.reason || null, remarks: remarks || null, ...patch });
        if (!ok) setAmount(item.amount ?? item.requested ?? '');
        setSaving(false);
    };
    const saveSoon = (patch) => { clearTimeout(timer.current); timer.current = setTimeout(() => save(patch), 600); };
    const choose = (key) => (key === 'reject' ? onOpen(item, 'reject') : save({ decision: key, amount: key === 'fund' ? (Number(amount) || item.requested) : null }));

    const pctOfRequest = item.requested > 0 && Number(amount) ? Math.round((Number(amount) / item.requested) * 100) : null;
    const why = reasonText(item);
    // Money this proposal could still get (its own saved award counts as available to it).
    const noMoney = moneyLeft !== null && moneyLeft < 0.005 && item.decision !== 'fund';
    const shortOfAsk = moneyLeft !== null && !noMoney && item.decision !== 'fund' && moneyLeft + 0.005 < item.requested;

    return (
        <>
            {cutoffBefore && (
                <li className="flex items-center gap-3 px-1 py-1">
                    <span className="h-px flex-1 border-t-2 border-dashed border-red-300" />
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200"><AlertTriangle size={12} /> Money runs out here at the requested amounts</span>
                    <span className="h-px flex-1 border-t-2 border-dashed border-red-300" />
                </li>
            )}
            <li className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="flex items-stretch">
                    <span className={`w-1.5 shrink-0 ${STRIPE[item.decision]}`} />
                    <div className="min-w-0 flex-1 p-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                            {/* Who and how good */}
                            <div className="flex min-w-0 flex-1 items-center gap-3.5">
                                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 px-1.5 text-xs font-bold text-white">#{item.rank}</span>
                                <ScoreRing score={item.score} max={item.score_max} />
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <ProposalHover id={item.proposal_id} className="font-mono text-xs font-bold text-indigo-600">{item.tracker_number}</ProposalHover>
                                        <span className="text-[11px] tabular-nums text-gray-400">{item.score ?? '—'} / {item.score_max ?? '—'} pts</span>
                                        {!editable && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[item.decision]}`}>{LABEL[item.decision]}</span>}
                                        {item.promoted_at && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Funded later from reserve</span>}
                                    </div>
                                    <button onClick={() => onOpen(item)} className="mt-0.5 line-clamp-2 text-left text-sm font-semibold leading-snug text-gray-900 hover:text-indigo-700">{item.title}</button>
                                    <p className="truncate text-xs text-gray-500">{[item.pi, item.college].filter(Boolean).join(' · ')}</p>
                                </div>
                            </div>

                            {/* Money */}
                            <div className="flex shrink-0 gap-5 xl:w-56 xl:justify-end">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Asks</p>
                                    <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(item.requested)}</p>
                                </div>
                                {(item.decision === 'fund' || item.promoted_at) && (
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Award</p>
                                        <p className="text-sm font-bold tabular-nums text-emerald-700">{formatCurrency(editable ? Number(amount) || 0 : item.amount)}</p>
                                    </div>
                                )}
                            </div>

                            {/* The choice */}
                            <div className="w-full shrink-0 space-y-2 xl:w-[340px]">
                                {editable ? (
                                    <>
                                        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
                                            {DECISIONS.map((d) => {
                                                const blocked = d.key === 'fund' && noMoney;
                                                return (
                                                    <button key={d.key} onClick={() => choose(d.key)} disabled={blocked}
                                                        title={blocked ? 'Insufficient budget — nothing is left to fund this proposal' : undefined}
                                                        className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:text-gray-400 ${item.decision === d.key ? `${d.on} shadow-sm` : 'text-gray-600 hover:bg-white disabled:hover:bg-transparent'}`}>
                                                        {blocked ? <Lock size={12} /> : <d.icon size={13} />} {d.label}
                                                    </button>
                                                );
                                            })}
                                            <span className="flex w-6 shrink-0 justify-center">{saving ? <Loader2 size={13} className="animate-spin text-gray-400" /> : item.decision !== 'pending' ? <CheckCircle2 size={13} className="text-emerald-500" /> : null}</span>
                                        </div>
                                        {noMoney && (
                                            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600"><AlertTriangle size={11} /> Insufficient budget — it is fully used</p>
                                        )}
                                        {shortOfAsk && (
                                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700"><Wallet size={11} /> Only {formatCurrency(moneyLeft)} left — less than the ask</p>
                                        )}
                                        {item.decision === 'fund' && (
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-1 rounded-lg border border-gray-200 bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
                                                    <span className="flex items-center rounded-l-lg bg-gray-50 px-2 text-[11px] font-semibold text-gray-500">{currency()}</span>
                                                    <input type="number" min="1" step="0.01" value={amount} aria-label="Award amount"
                                                        onChange={(e) => { setAmount(e.target.value); saveSoon({ amount: Number(e.target.value) || null }); }}
                                                        className="w-full rounded-r-lg px-2 py-1.5 text-sm font-semibold tabular-nums focus:outline-none" />
                                                </div>
                                                <span className={`w-20 text-right text-[11px] ${pctOfRequest > 100 ? 'font-semibold text-amber-600' : 'text-gray-500'}`}>{pctOfRequest != null ? `${pctOfRequest}% of ask` : ''}</span>
                                            </div>
                                        )}
                                        {item.decision === 'reject' && (
                                            <button onClick={() => onOpen(item, 'reject')}
                                                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs ${why ? 'bg-red-50 text-red-800 hover:bg-red-100' : 'border border-dashed border-red-300 font-semibold text-red-700 hover:bg-red-50'}`}>
                                                <span className="min-w-0 flex-1 truncate">{why || 'Add the reason — needed to publish'}</span>
                                                <Pencil size={12} className="shrink-0" />
                                            </button>
                                        )}
                                        {(item.decision === 'fund' || item.decision === 'reserve') && (showNote ? (
                                            <input value={remarks} autoFocus={!item.remarks} onChange={(e) => { setRemarks(e.target.value); saveSoon({ remarks: e.target.value || null }); }}
                                                placeholder="Note to the team (conditions, budget changes)…"
                                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                                        ) : (
                                            <button onClick={() => setShowNote(true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-indigo-600"><MessageSquareText size={11} /> Add a note</button>
                                        ))}
                                    </>
                                ) : (
                                    <div className="xl:text-right">
                                        {item.decision === 'reject' && <p className="text-xs text-red-700">{why}</p>}
                                        {item.remarks && <p className="mt-0.5 text-xs italic text-gray-500">“{item.remarks}”</p>}
                                        {item.decision === 'reserve' && !item.promoted_at && item.proposal_status === 'accepted' && onPromote && (
                                            <button onClick={() => onPromote(item)} className="mt-1 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                                                <BadgeCheck size={13} /> Fund now
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
                            <button onClick={() => onOpen(item)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50">
                                <PanelRightOpen size={13} /> {editable ? 'Review' : 'Details'} · Budget · PI history · Reviewer comments
                            </button>
                            <span className="hidden text-[11px] text-gray-400 sm:inline">{editable ? 'Open the review before deciding' : ''}</span>
                        </div>
                    </div>
                </div>
            </li>
        </>
    );
}

const isTyping = (el) => el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

/**
 * The side panel for one proposal: its summary and score, the evidence (budget, PI history,
 * reviewer comments) and the decision form, with Previous / Next to work down the list.
 */
function ReviewPanel({ round, open, editable, onClose, onGo, onSave, onRaiseBudget }) {
    const items = round.items;
    const index = items.findIndex((i) => i.id === open.id);
    const item = items[index];
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [shown, setShown] = useState(false);
    const decisionRef = useRef(null);
    const bodyRef = useRef(null);

    useEffect(() => { requestAnimationFrame(() => setShown(true)); }, []);
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // A fresh form for each proposal (not on every save, so typing is never overwritten).
    useEffect(() => {
        if (!item) return;
        setForm({
            decision: open.step === 'reject' ? 'reject' : item.decision,
            amount: String(item.amount ?? item.requested ?? ''),
            reason_code: item.reason_code ?? '',
            reason: item.reason ?? '',
            remarks: item.remarks ?? '',
        });
        if (open.step === 'reject') {
            setTimeout(() => decisionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        } else {
            bodyRef.current?.scrollTo({ top: 0 });
        }
    }, [open.id, open.step]); // eslint-disable-line react-hooks/exhaustive-deps

    const go = (delta) => {
        const next = items[index + delta];
        if (next) onGo(next.id);
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            else if (!isTyping(e.target) && e.key === 'ArrowRight') go(1);
            else if (!isTyping(e.target) && e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (!item || !form) return null;

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const amount = Number(form.amount) || 0;
    const pct = item.requested > 0 && amount ? Math.round((amount / item.requested) * 100) : null;
    // Money left once this proposal gets what is typed (its saved award is already counted).
    const leftAfter = round.budget.after === null ? null : round.budget.after + (item.decision === 'fund' ? Number(item.amount) || 0 : 0) - (form.decision === 'fund' ? amount : 0);
    const problem = form.decision === 'pending' ? 'Choose Fund, Reserve or Reject.'
        : form.decision === 'fund' && amount <= 0 ? 'Enter the award amount.'
        : form.decision === 'fund' && leftAfter !== null && leftAfter < -0.005 ? 'Insufficient budget — more than is left.'
        : form.decision === 'reject' && !form.reason_code ? 'Choose a reason.'
        : form.decision === 'reject' && form.reason_code === 'other' && !form.reason.trim() ? 'Describe the reason.'
        : null;
    const nextUndecided = items.find((i, n) => n > index && i.decision === 'pending') ?? items.find((i) => i.decision === 'pending' && i.id !== item.id);

    const submit = async (thenNext) => {
        setBusy(true);
        const ok = await onSave(item, {
            decision: form.decision,
            amount: form.decision === 'fund' ? amount : null,
            reason_code: form.decision === 'reject' ? form.reason_code || null : null,
            reason: form.decision === 'reject' ? form.reason.trim() || null : null,
            remarks: form.decision !== 'reject' ? form.remarks.trim() || null : null,
        });
        setBusy(false);
        if (!ok) return;
        if (!thenNext) onClose();
        else if (nextUndecided) onGo(nextUndecided.id);
        else onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div onClick={onClose} className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`} />
            <aside role="dialog" aria-modal="true" aria-label={`Review ${item.tracker_number}`}
                className={`relative flex h-full w-full max-w-2xl flex-col bg-gray-50 shadow-2xl transition-transform duration-300 ease-out ${shown ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <header className="border-b border-gray-200 bg-white px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                            <button onClick={() => go(-1)} disabled={index <= 0} aria-label="Previous proposal" title="Previous (←)"
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
                            <span className="min-w-14 text-center text-xs font-medium tabular-nums text-gray-500">{index + 1} of {items.length}</span>
                            <button onClick={() => go(1)} disabled={index >= items.length - 1} aria-label="Next proposal" title="Next (→)"
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                            {editable && round.counts.pending > 0 && <span className="hidden rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 sm:inline">{round.counts.pending} to decide</span>}
                            <button onClick={onClose} aria-label="Close" title="Close (Esc)" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={16} /></button>
                        </div>
                    </div>
                </header>

                <div ref={bodyRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                    {/* Summary */}
                    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3.5">
                            <ScoreRing score={item.score} max={item.score_max} />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="rounded-md bg-gray-900 px-1.5 py-0.5 text-[11px] font-bold text-white">#{item.rank}</span>
                                    <ProposalHover id={item.proposal_id} className="font-mono text-xs font-bold text-indigo-600">{item.tracker_number}</ProposalHover>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[item.decision]}`}>{editable && item.decision !== 'pending' ? `Draft: ${LABEL[item.decision]}` : LABEL[item.decision]}</span>
                                </div>
                                <h2 className="mt-1 text-base font-bold leading-snug text-gray-900">{item.title}</h2>
                                <p className="mt-0.5 text-xs text-gray-500">{[item.pi, item.college].filter(Boolean).join(' · ')}</p>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            {[
                                ['Score', `${item.score ?? '—'} / ${item.score_max ?? '—'}`, 'text-gray-900'],
                                ['Asks', formatCurrency(item.requested), 'text-gray-900'],
                                item.decision === 'fund' || item.promoted_at ? ['Award', formatCurrency(item.amount), 'text-emerald-700'] : ['Left in budget', round.budget.after === null ? '—' : formatCurrency(round.budget.after), round.budget.after < 0 ? 'text-red-600' : 'text-gray-900'],
                            ].map(([label, v, cls]) => (
                                <div key={label} className="rounded-xl bg-gray-50 px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                                    <p className={`truncate text-sm font-bold tabular-nums ${cls}`}>{v}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Evidence */}
                    <ProposalInsights key={item.proposal_id} proposalId={item.proposal_id} piId={item.pi_id} piName={item.pi} requested={item.requested} />

                    {/* Decision */}
                    <section ref={decisionRef} className="scroll-mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900">{editable ? 'Your decision' : 'Decision'}</h3>
                        {!editable ? (
                            <div className="mt-2 space-y-1 text-sm">
                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[item.decision]}`}>{LABEL[item.decision]}</span>
                                {item.decision === 'reject' && <p className="text-red-700">{reasonText(item)}</p>}
                                {item.remarks && <p className="italic text-gray-600">“{item.remarks}”</p>}
                            </div>
                        ) : (
                            <div className="mt-3 space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    {DECISIONS.map((d) => (
                                        <button key={d.key} onClick={() => set({ decision: d.key })}
                                            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-semibold transition ${form.decision === d.key ? `${d.on} shadow-sm` : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
                                            <d.icon size={18} /> {d.label}
                                        </button>
                                    ))}
                                </div>

                                {form.decision === 'fund' && (
                                    <div className="space-y-2.5">
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-medium text-gray-600">Award amount</span>
                                            <div className="flex rounded-xl border border-gray-200 bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
                                                <span className="flex items-center rounded-l-xl bg-gray-50 px-3 text-xs font-semibold text-gray-500">{currency()}</span>
                                                <input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })}
                                                    className="w-full rounded-r-xl px-3 py-2.5 text-lg font-bold tabular-nums focus:outline-none" />
                                            </div>
                                        </label>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {[100, 90, 75, 50].map((p) => (
                                                <button key={p} onClick={() => set({ amount: String(Math.round(item.requested * p) / 100) })}
                                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${pct === p ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                                    {p}%
                                                </button>
                                            ))}
                                            <span className={`ml-auto text-xs ${pct > 100 ? 'font-semibold text-amber-600' : 'text-gray-500'}`}>{pct != null ? `${pct}% of the ask` : ''}</span>
                                        </div>
                                        {leftAfter !== null && (
                                            <p className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${leftAfter < 0 ? 'bg-red-50 font-medium text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
                                                <Wallet size={13} className="shrink-0" />
                                                <span className="flex-1">{leftAfter < 0 ? `${formatCurrency(-leftAfter)} more than is left in the call’s budget — not allowed.` : `${formatCurrency(leftAfter)} left in the budget after this`}</span>
                                                {leftAfter < 0 && amount + leftAfter > 0 && (
                                                    <button onClick={() => set({ amount: String(Math.floor((amount + leftAfter) * 100) / 100) })} className="shrink-0 rounded-md bg-white px-2 py-0.5 font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100">Use what is left</button>
                                                )}
                                                {leftAfter < 0 && onRaiseBudget && (
                                                    <button onClick={onRaiseBudget} className="shrink-0 rounded-md bg-white px-2 py-0.5 font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100">Raise budget</button>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {form.decision === 'reject' && (
                                    <div className="space-y-2.5">
                                        <p className="text-xs font-medium text-gray-600">Why is it not funded? <span className="text-gray-400">The team sees this.</span></p>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {REASONS.map((r) => {
                                                const on = form.reason_code === r.key;
                                                const Icon = r.icon ?? XCircle;
                                                return (
                                                    <button key={r.key} onClick={() => set({ reason_code: r.key })}
                                                        className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${on ? 'border-red-400 bg-red-50 ring-2 ring-red-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}><Icon size={14} /></span>
                                                        <span className="min-w-0">
                                                            <span className="block text-xs font-semibold text-gray-900">{r.label}</span>
                                                            {r.description && <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{r.description}</span>}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <textarea rows={2} value={form.reason} onChange={(e) => set({ reason: e.target.value })}
                                            placeholder={form.reason_code === 'other' ? 'Describe the reason (required)…' : 'Add detail for the team (optional)…'}
                                            className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100 sm:text-sm" />
                                    </div>
                                )}

                                {(form.decision === 'fund' || form.decision === 'reserve') && (
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-medium text-gray-600">Note to the team <span className="text-gray-400">(optional)</span></span>
                                        <textarea rows={2} value={form.remarks} onChange={(e) => set({ remarks: e.target.value })}
                                            placeholder={form.decision === 'fund' ? 'Conditions, budget lines to trim…' : 'Why it is on the reserve list…'}
                                            className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                                    </label>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Footer */}
                {editable && (
                    <footer className="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-5 py-3">
                        <p className="min-w-0 flex-1 truncate text-xs text-gray-500">{problem ?? 'Saved as a draft — nobody is told until you publish.'}</p>
                        <button onClick={() => submit(false)} disabled={busy || !!problem}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            Save
                        </button>
                        <button onClick={() => submit(true)} disabled={busy || !!problem}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />} {nextUndecided ? 'Save & next' : 'Save & close'}
                        </button>
                    </footer>
                )}
            </aside>
        </div>
    );
}

/**
 * The call's total funding budget. A round cannot be decided without one, so the first
 * time a call is opened here it asks for it; afterwards it can be changed the same way.
 */
function BudgetForm({ round, onSaved, onCancel }) {
    const { success, error } = useToast();
    const asked = round.items.reduce((s, i) => s + (Number(i.requested) || 0), 0);
    const committed = Number(round.budget.committed) || 0;
    const [value, setValue] = useState(round.budget.budget !== null ? String(round.budget.budget) : '');
    const [busy, setBusy] = useState(false);
    const amount = Number(value) || 0;
    const belowAwarded = amount > 0 && amount < committed;

    const roundUp = (v) => Math.ceil(v / 100000) * 100000;
    const suggestions = [
        { label: 'Everything asked', v: committed + asked },
        { label: 'Rounded up', v: roundUp(committed + asked) },
        ...(asked > 0 ? [{ label: 'About 75% of the asks', v: roundUp(committed + asked * 0.75) }] : []),
    ].filter((s, i, all) => s.v > 0 && all.findIndex((x) => x.v === s.v) === i);
    const coverage = asked > 0 && amount ? Math.max(0, Math.round(((amount - committed) / asked) * 100)) : null;

    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const r = await api.put(`/funding-rounds/call/${round.call.id}/budget`, { funding_budget: amount });
            success(r.data?.message ?? 'Funding budget saved.');
            onSaved(r.data?.data);
        } catch (err) {
            const errs = err.response?.data?.errors;
            error(errs && Object.keys(errs).length ? Object.values(errs).flat()[0] : (err.response?.data?.message ?? 'The budget could not be saved.'));
        }
        setBusy(false);
    };

    return (
        <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                {[['Waiting', round.items.length, 'text-gray-900'], ['Total asked', formatCurrency(asked), 'text-gray-900'], ['Awarded before', formatCurrency(committed), 'text-gray-900']].map(([label, v, cls]) => (
                    <div key={label} className="rounded-xl bg-gray-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                        <p className={`truncate text-sm font-bold tabular-nums ${cls}`}>{v}</p>
                    </div>
                ))}
            </div>
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Total funding budget for this call</span>
                <div className="flex rounded-xl border border-gray-200 bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
                    <span className="flex items-center rounded-l-xl bg-gray-50 px-3 text-sm font-semibold text-gray-500">{currency()}</span>
                    <input type="number" min="1" step="0.01" required autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 2,500,000"
                        className="w-full rounded-r-xl px-3 py-3 text-xl font-bold tabular-nums focus:outline-none" />
                </div>
                <span className="mt-1 block text-xs text-gray-500">
                    {belowAwarded ? <span className="font-medium text-red-600">It cannot be less than the {formatCurrency(committed)} already awarded from this call.</span> : amount > 0 ? <>{formatCurrency(amount)}{coverage !== null && <> · covers about <b className={coverage < 100 ? 'text-amber-700' : 'text-emerald-700'}>{coverage}%</b> of what is asked</>}</> : 'The whole call’s money, including anything already awarded from it.'}
                </span>
            </label>
            {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                        <button type="button" key={s.label} onClick={() => setValue(String(s.v))}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${amount === s.v ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
                            {s.label} · <span className="tabular-nums">{formatCurrency(s.v)}</span>
                        </button>
                    ))}
                </div>
            )}
            <div className="flex gap-3">
                {onCancel && <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>}
                <button type="submit" disabled={busy || amount < 1 || belowAwarded}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />} Save budget{onCancel ? '' : ' and start deciding'}
                </button>
            </div>
        </form>
    );
}

/** Shown instead of the round until the call has a budget: there is nothing to decide against without one. */
function BudgetSetup({ round, onSaved }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-amber-100 bg-linear-to-r from-amber-50 to-white px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Wallet size={18} /></span>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Step 1 of 2 · Set the budget</p>
                    <h3 className="text-base font-bold text-gray-900">How much money does “{round.call.title}” have?</h3>
                    <p className="mt-0.5 text-xs text-gray-600">Decisions are checked against this budget, so it is needed before you fund anyone. It is saved on the call itself.</p>
                </div>
            </div>
            <div className="px-5 py-5"><BudgetForm round={round} onSaved={onSaved} /></div>
        </section>
    );
}

/** Each college's share of the call's budget; College RTT Managers fund within theirs. */
function CollegeShares({ round, onSaved }) {
    const { success, error } = useToast();
    const [data, setData] = useState(null);
    const [values, setValues] = useState({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get(`/funding-rounds/call/${round.call.id}/allocations`)
            .then((r) => {
                const d = r.data?.data;
                setData(d);
                setValues(Object.fromEntries((d?.colleges ?? []).map((c) => [c.college_id, c.amount !== null ? String(c.amount) : ''])));
            })
            .catch(() => setData({ total: null, colleges: [] }));
    }, [round.call.id, round.budget.call_total]);

    if (!data) return <Skeleton className="h-48 rounded-xl" />;
    if (data.total === null) return <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">Set the call’s total first, then share it out here.</p>;
    if (!data.colleges.length) return <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">No college has proposals in this call yet.</p>;

    const shared = data.colleges.reduce((s, c) => s + (Number(values[c.college_id]) || 0), 0);
    const left = data.total - shared;
    const over = left < -0.005;

    // Proportional to what each college has awarded and asked, in whole amounts.
    const splitByAsks = () => {
        const weights = data.colleges.map((c) => c.awarded + c.asked);
        const sum = weights.reduce((s, w) => s + w, 0);
        if (!sum) return;
        setValues(Object.fromEntries(data.colleges.map((c, i) => [c.college_id, String(Math.max(c.awarded, Math.floor((data.total * weights[i]) / sum)))])));
    };

    const save = async () => {
        setBusy(true);
        try {
            const r = await api.put(`/funding-rounds/call/${round.call.id}/allocations`, {
                allocations: data.colleges.map((c) => ({ college_id: c.college_id, amount: values[c.college_id] === '' ? null : Number(values[c.college_id]) })),
            });
            setData(r.data?.data);
            success(r.data?.message ?? 'College shares saved.');
            onSaved?.();
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs && Object.keys(errs).length ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? 'The shares could not be saved.'));
        }
        setBusy(false);
    };

    return (
        <div className="space-y-3">
            <div>
                <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                    <span>Shared out <b className="tabular-nums text-gray-900">{formatCurrency(shared)}</b> of {formatCurrency(data.total)}</span>
                    <span className={over ? 'font-semibold text-red-600' : ''}>{over ? `${formatCurrency(-left)} too much` : `${formatCurrency(left)} not shared`}</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className={over ? 'bg-red-500' : 'bg-indigo-500'} style={{ width: `${Math.min(100, (shared / Math.max(data.total, 1)) * 100)}%` }} />
                </div>
            </div>
            <ul className="max-h-[42vh] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
                {data.colleges.map((c) => {
                    const v = Number(values[c.college_id]) || 0;
                    const below = values[c.college_id] !== '' && v + 0.005 < c.awarded;
                    return (
                        <li key={c.college_id} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-900">{c.college}</p>
                                <p className="truncate text-[11px] text-gray-500">
                                    {c.waiting} waiting · asks {formatCurrency(c.asked)}{c.awarded > 0 && <> · awarded {formatCurrency(c.awarded)}</>}
                                </p>
                                {below && <p className="text-[11px] font-medium text-red-600">Cannot be less than what it was already awarded.</p>}
                            </div>
                            <div className={`flex w-40 shrink-0 rounded-lg border bg-white focus-within:ring-2 focus-within:ring-indigo-100 ${below ? 'border-red-300' : 'border-gray-200'}`}>
                                <span className="flex items-center rounded-l-lg bg-gray-50 px-2 text-[10px] font-semibold text-gray-500">{currency()}</span>
                                <input type="number" min="0" step="0.01" value={values[c.college_id] ?? ''} placeholder="No share" aria-label={`${c.college} share`}
                                    onChange={(e) => setValues((vals) => ({ ...vals, [c.college_id]: e.target.value }))}
                                    className="w-full rounded-r-lg px-2 py-1.5 text-sm font-semibold tabular-nums focus:outline-none" />
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={splitByAsks} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Sparkles size={14} /> Split by what each asks
                </button>
                <button type="button" onClick={save} disabled={busy || over}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save shares
                </button>
            </div>
        </div>
    );
}

/** The call's total and its college shares, for the central office. */
function BudgetDialog({ round, initialTab = 'total', onClose, onSaved }) {
    const [tab, setTab] = useState(initialTab);
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[94vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Wallet size={18} /></span>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Funding budget</h2>
                            <p className="text-xs text-gray-500">{round.call.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="flex gap-1 border-b border-gray-100 px-6 pt-3">
                    {[['total', 'Call total'], ['shares', 'College shares']].map(([k, label]) => (
                        <button key={k} onClick={() => setTab(k)}
                            className={`-mb-px border-b-2 px-3 pb-2 text-sm font-semibold transition ${tab === k ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="overflow-y-auto px-6 py-5">
                    {tab === 'total'
                        ? <BudgetForm round={round} onSaved={(d) => { onSaved(d); setTab('shares'); }} onCancel={onClose} />
                        : (
                            <>
                                <p className="mb-3 text-xs text-gray-500">College RTT Managers can fund their college’s proposals only within its share. The central office’s own round can use the whole call.</p>
                                <CollegeShares round={round} />
                            </>
                        )}
                </div>
            </div>
        </div>
    );
}

/** A College RTT Manager's round before the central office has given the college a share. */
function ShareMissing({ round }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="flex items-start gap-3 bg-linear-to-r from-amber-50 to-white px-5 py-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Clock size={18} /></span>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Waiting for the central office</p>
                    <h3 className="text-base font-bold text-gray-900">{round.college} has no share of “{round.call.title}” yet</h3>
                    <p className="mt-1 text-sm text-gray-600">The central office shares each call’s budget out to the colleges. Once yours is set, you can fund your {round.items.length} waiting proposal{round.items.length === 1 ? '' : 's'} here.</p>
                    <p className="mt-2 text-xs text-gray-500">Asked in total: <b className="tabular-nums text-gray-800">{formatCurrency(round.items.reduce((s, i) => s + (Number(i.requested) || 0), 0))}</b></p>
                </div>
            </div>
        </section>
    );
}

function PublishDialog({ round, onClose, onPublished, onRaiseBudget }) {
    const { error } = useToast();
    const [busy, setBusy] = useState(false);
    const over = round.budget.after !== null && round.budget.after < 0;
    const c = round.counts;

    const publish = async () => {
        setBusy(true);
        try {
            const r = await api.post(`/funding-rounds/${round.id}/publish`);
            onPublished(r.data);
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs && Object.keys(errs).length ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? 'The round could not be published.'));
        }
        setBusy(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Send size={18} /></span>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Publish decisions?</h2>
                            <p className="text-xs text-gray-500">{round.call.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="space-y-4 px-6 py-5">
                    <div className="grid grid-cols-3 gap-2 text-center">
                        {[['fund', 'Funded', 'text-emerald-700 bg-emerald-50'], ['reserve', 'Reserve', 'text-amber-700 bg-amber-50'], ['reject', 'Not funded', 'text-red-700 bg-red-50']].map(([k, l, cls]) => (
                            <div key={k} className={`rounded-xl px-2 py-3 ${cls}`}><p className="text-2xl font-bold tabular-nums">{c[k]}</p><p className="text-[11px] font-medium">{l}</p></div>
                        ))}
                    </div>
                    <p className="text-sm text-gray-700">Total awarded <b className="tabular-nums">{formatCurrency(round.budget.funding)}</b>{round.budget.after !== null && <> · left after <b className={`tabular-nums ${over ? 'text-red-600' : ''}`}>{formatCurrency(round.budget.after)}</b></>}.</p>
                    <ul className="space-y-1 text-xs text-gray-600">
                        <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> Funded proposals get their award and grant reference, and move to Funded.</li>
                        <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> Every team is told now, all together, by email and in the app.</li>
                        <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> Reserve proposals keep waiting and can be funded later with one click.</li>
                        <li className="flex gap-2"><Lock size={13} className="mt-0.5 shrink-0 text-gray-400" /> The round is then locked; you can download its minutes.</li>
                    </ul>
                    {over && (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
                            <span className="flex-1">This is {formatCurrency(-round.budget.after)} more than is left in the call's budget. Lower some awards or raise the budget first.</span>
                            {onRaiseBudget && <button onClick={onRaiseBudget} className="rounded-lg bg-white px-2.5 py-1 font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100">Raise budget</button>}
                        </div>
                    )}
                </div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Not yet</button>
                    <button onClick={publish} disabled={busy || over}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publish & notify
                    </button>
                </div>
            </div>
        </div>
    );
}

function PromoteDialog({ round, item, onClose, onDone }) {
    const { error } = useToast();
    const [amount, setAmount] = useState(String(item.requested ?? ''));
    const [remarks, setRemarks] = useState('');
    const [overBy, setOverBy] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        try {
            const r = await api.post(`/funding-rounds/${round.id}/items/${item.id}/promote`, { amount: Number(amount), remarks: remarks || null });
            onDone(r.data);
        } catch (e) {
            if (e.response?.data?.meta?.code === 'over_budget') setOverBy(e.response.data.data.over_by);
            else error(e.response?.data?.message ?? 'The proposal could not be funded.');
        }
        setBusy(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Fund from the reserve list</h2>
                        <p className="text-xs text-gray-500">{item.tracker_number} · {item.title}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="space-y-3 px-6 py-5">
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Award ({currency()})</span>
                        <input type="number" min="1" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setOverBy(null); }}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-lg font-semibold tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                        <span className="mt-1 block text-xs text-gray-500">Requested {formatCurrency(item.requested)}</span>
                    </label>
                    <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Note to the team (optional)"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                    {overBy !== null && (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
                            This is {formatCurrency(overBy)} more than is left in the call's budget. Lower the award, or raise the call's budget from a draft round's Budget button.
                        </p>
                    )}
                </div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={busy || !(Number(amount) > 0) || overBy !== null}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {busy && <Loader2 size={14} className="animate-spin" />} Fund & notify
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Central Evaluation → Funding round. Pick a call, choose Fund / Reserve / Reject for
 * each of its proposals (drafts — nobody is told), watch the budget, then publish
 * everything at once. Published rounds stay readable, with their reserve list and
 * minutes.
 */
export default function FundingRound({ onChanged, onUnavailable }) {
    const { success, error } = useToast();
    const [calls, setCalls] = useState(null);
    const [callId, setCallId] = useState('');
    const [roundId, setRoundId] = useState('draft');
    const [round, setRound] = useState(null);
    const [loading, setLoading] = useState(false);
    const [notes, setNotes] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [promoting, setPromoting] = useState(null);
    const [filling, setFilling] = useState(false);
    const [reviewing, setReviewing] = useState(null);
    const [editingBudget, setEditingBudget] = useState(false);

    const loadCalls = useCallback(async () => {
        try {
            const r = await api.get('/funding-rounds/calls');
            const list = r.data?.data ?? [];
            setCalls(list);
            setCallId((current) => current || (list.find((c) => c.waiting > 0) ?? list[0])?.id || '');
        } catch (e) {
            setCalls([]);
            if (e.response?.status === 403) onUnavailable?.();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadCalls(); }, [loadCalls]);

    const loadRound = useCallback(async () => {
        if (!callId) return;
        setLoading(true);
        try {
            const r = roundId === 'draft' ? await api.get(`/funding-rounds/call/${callId}`) : await api.get(`/funding-rounds/${roundId}`);
            setRound(r.data?.data);
            setNotes(r.data?.data?.notes ?? '');
        } catch (e) {
            error(e.response?.data?.message ?? 'The round could not be loaded.');
        }
        setLoading(false);
    }, [callId, roundId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadRound(); }, [loadRound]);

    const call = calls?.find((c) => c.id === callId);
    const published = (call?.rounds ?? []).filter((r) => r.status === 'published');
    const editable = round?.status === 'draft';

    const saveItem = async (item, data) => {
        try {
            const r = await api.put(`/funding-rounds/${round.id}/items/${item.id}`, data);
            setRound(r.data?.data);
            return true;
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs && Object.keys(errs).length ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? 'The choice could not be saved.'));
            return false;
        }
    };

    const budgetSaved = (data) => {
        setRound((r) => ({ ...data, can_set_budget: data.can_set_budget ?? r?.can_set_budget }));
        setCalls((list) => list?.map((c) => (c.id === data.call.id ? { ...c, budget: data.budget.budget } : c)));
    };
    const needsBudget = editable && round?.budget.budget === null;

    const autoFill = async () => {
        setFilling(true);
        try {
            const r = await api.post(`/funding-rounds/${round.id}/auto-fill`);
            setRound(r.data?.data);
            success('Filled from the ranking: the best are funded while the money lasts, the rest are on the reserve list. Adjust anything you like.');
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not fill the round.');
        }
        setFilling(false);
    };

    const saveNotes = async () => {
        if ((round?.notes ?? '') === notes) return;
        try { await api.put(`/funding-rounds/${round.id}/notes`, { notes: notes || null }); setRound((r) => ({ ...r, notes })); } catch { error('The notes could not be saved.'); }
    };

    // Where the money runs out if everyone left of the line got what they asked for.
    const cutoff = useMemo(() => {
        if (!round || round.budget.remaining === null) return -1;
        let running = 0;
        return round.items.findIndex((i) => (running += i.requested) > round.budget.remaining + 0.005);
    }, [round]);

    if (calls === null) return <Skeleton className="h-64 rounded-2xl" />;
    if (calls.length === 0) {
        return <Panel bodyClassName="p-0"><EmptyState icon={Trophy} title="No call is waiting for funding decisions" text="A call appears here once its proposals have passed review." /></Panel>;
    }

    return (
        <div className="space-y-4">
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {calls.map((c) => {
                    const on = c.id === callId;
                    const done = (c.rounds ?? []).filter((r) => r.status === 'published').length;
                    return (
                        <button key={c.id} onClick={() => { setCallId(c.id); setRoundId('draft'); setReviewing(null); }}
                            className={`w-64 shrink-0 rounded-2xl border p-4 text-left transition ${on ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-200' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
                            <p className="text-[11px] font-medium text-gray-500">{c.academic_year}</p>
                            <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{c.title}</p>
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                                {c.waiting > 0
                                    ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{c.waiting} waiting</span>
                                    : <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">Nothing waiting</span>}
                                {done > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">{done} published</span>}
                                {c.budget === null
                                    ? <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700 ring-1 ring-red-200"><AlertTriangle size={10} /> {c.budget_scope === 'college' ? 'No share yet' : 'No budget'}</span>
                                    : <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium tabular-nums text-gray-600">{formatCurrency(c.budget)}</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
            {published.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500">Show:</span>
                    {[{ id: 'draft', label: 'Current draft' }, ...published.map((r) => ({ id: r.id, label: `Published ${formatDateTime(r.published_at)}${r.college ? ` · ${r.college}` : ''}` }))].map((r) => (
                        <button key={r.id} onClick={() => { setRoundId(r.id); setReviewing(null); }}
                            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${roundId === r.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
                            {r.label}
                        </button>
                    ))}
                </div>
            )}

            {!round || loading ? <Skeleton className="h-80 rounded-2xl" /> : needsBudget ? (
                round.budget.scope === 'college' ? <ShareMissing round={round} /> : <BudgetSetup key={round.call.id} round={round} onSaved={budgetSaved} />
            ) : (
                <>
                    <section className="z-20 space-y-4 lg:sticky lg:top-0 rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-sm backdrop-blur">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                {editable ? (
                                    <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"><Undo2 size={12} /> Draft — nobody is told until you publish</p>
                                ) : (
                                    <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"><Lock size={12} /> Published {formatDateTime(round.published_at)}{round.published_by ? ` by ${round.published_by}` : ''}</p>
                                )}
                                <h3 className="mt-2 text-base font-bold text-gray-900">{round.call.title}</h3>
                                <p className="text-xs text-gray-500">{round.college ? `${round.college} proposals only · every category` : 'Every college'}</p>
                                <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                                    {['fund', 'reserve', 'reject', 'pending'].map((k) => (k !== 'pending' || editable) && (
                                        <span key={k} className={`rounded-full px-2 py-0.5 font-semibold ${CHIP[k]}`}>{round.counts[k]} {k === 'pending' ? 'to decide' : LABEL[k].toLowerCase()}</span>
                                    ))}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {editable ? (
                                    <>
                                        {round.can_set_budget && (
                                            <button onClick={() => setEditingBudget('total')} title="The call's total and each college's share"
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                                <Wallet size={14} /> Budget
                                            </button>
                                        )}
                                        <button onClick={autoFill} disabled={filling || !round.items.length} title="Fund the best while the money lasts; the rest go on the reserve list. Choices you already made are kept."
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                            {filling ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Fill from ranking
                                        </button>
                                        <button onClick={() => setPublishing(true)} disabled={!round.items.length || round.counts.pending > 0}
                                            title={round.counts.pending ? `Decide the ${round.counts.pending} remaining first` : ''}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                                            <Send size={14} /> Publish decisions
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => downloadFile(`/funding-rounds/${round.id}/minutes`, `funding-decisions-${round.call.title}.pdf`).catch(() => error('The minutes could not be downloaded.'))}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                        <FileDown size={14} /> Minutes (PDF)
                                    </button>
                                )}
                            </div>
                        </div>
                        {editable && round.items.length > 0 && (
                            <div>
                                <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                                    <span>Decided {round.items.length - round.counts.pending} of {round.items.length}</span>
                                    <span>{round.counts.pending ? `${round.counts.pending} to go` : 'Ready to publish'}</span>
                                </div>
                                <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
                                    {['fund', 'reserve', 'reject'].map((k) => (
                                        <div key={k} className={STRIPE[k]} style={{ width: `${(round.counts[k] / round.items.length) * 100}%` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <BudgetBar budget={round.budget} />
                        {editable && round.can_set_budget && round.budget.scope === 'call' && !round.budget.allocated && (
                            <p className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                                <Info size={13} /> <span className="flex-1">No college has a share of this budget yet, so College RTT Managers cannot fund from it.</span>
                                <button onClick={() => setEditingBudget('shares')} className="rounded-lg bg-white px-2.5 py-1 font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100">Share it out</button>
                            </p>
                        )}
                        {editable && round.budget.after !== null && round.budget.after < 0 && (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                <Wallet size={13} /> <span className="flex-1">The funded total is {formatCurrency(-round.budget.after)} over the budget, so it cannot be published. Lower some amounts, move proposals to the reserve list, or raise the budget.</span>
                                {round.can_set_budget
                                    ? <button onClick={() => setEditingBudget('total')} className="rounded-lg bg-white px-2.5 py-1 font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100">Raise budget</button>
                                    : <span className="text-[11px] font-normal">Ask the central office to raise your college’s share.</span>}
                            </div>
                        )}
                    </section>

                    {round.items.length === 0 ? (
                        <Panel bodyClassName="p-0"><EmptyState icon={CheckCircle2} title="Nothing to decide" text="Every proposal of this call has a decision." /></Panel>
                    ) : (
                        <div>
                            <div className="mb-2 flex items-baseline justify-between px-1">
                                <h3 className="text-sm font-semibold text-gray-900">Proposals, best first</h3>
                                <p className="text-xs text-gray-500">{editable ? 'Choose for each — it saves as you go.' : 'As published.'}</p>
                            </div>
                            <ol className="space-y-3">
                                {round.items.map((item, i) => (
                                    <Row key={item.id} item={item} editable={editable} onSave={saveItem} cutoffBefore={editable && i === cutoff}
                                        moneyLeft={editable && round.budget.after !== null ? round.budget.after + (item.decision === 'fund' ? Number(item.amount) || 0 : 0) : null}
                                        onPromote={!editable ? setPromoting : null} onOpen={(it, step = null) => setReviewing({ id: it.id, step })} />
                                ))}
                            </ol>
                        </div>
                    )}

                    {(editable || round.notes) && (
                        <Panel title="Meeting notes" subtitle="Printed in the minutes." icon={MessageSquareText}>
                            {editable ? (
                                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes}
                                    placeholder="Who attended, points discussed, conditions agreed…"
                                    className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                            ) : <p className="whitespace-pre-line text-sm text-gray-700">{round.notes}</p>}
                        </Panel>
                    )}
                </>
            )}

            {reviewing && round && !needsBudget && (
                <ReviewPanel round={round} open={reviewing} editable={editable} onSave={saveItem} onRaiseBudget={round.can_set_budget ? () => setEditingBudget('total') : null}
                    onClose={() => setReviewing(null)} onGo={(id) => setReviewing({ id, step: null })} />
            )}
            {editingBudget && round && <BudgetDialog round={round} initialTab={editingBudget} onClose={() => setEditingBudget(false)} onSaved={budgetSaved} />}
            {publishing && (
                <PublishDialog round={round} onClose={() => setPublishing(false)} onRaiseBudget={round.can_set_budget ? () => { setPublishing(false); setEditingBudget('total'); } : null}
                    onPublished={(r) => {
                        setPublishing(false);
                        success(r.message ?? 'Published.');
                        setRound(r.data);
                        setRoundId(r.data.id);
                        loadCalls();
                        onChanged?.();
                    }} />
            )}
            {promoting && (
                <PromoteDialog round={round} item={promoting} onClose={() => setPromoting(null)}
                    onDone={(r) => { setPromoting(null); success(r.message ?? 'Funded.'); setRound(r.data); onChanged?.(); }} />
            )}
        </div>
    );
}
