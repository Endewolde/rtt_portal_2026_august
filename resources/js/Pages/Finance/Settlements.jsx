import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    CheckCircle2, FileText, Upload, X, Shield, Search, Building2, Landmark, Send, Lock, Flag,
    Eye, EyeOff, Download, Loader2, Receipt, Wallet, Clock, ArrowRight, User, PiggyBank,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ViewToggle from '../../Components/ViewToggle';
import { PageHeader, StatCard, Panel, EmptyState, Select, RefreshButton, StatSkeletons, Skeleton, DataTable } from '../../Components/Insights/Kit';
import { useToast } from '../../Components/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { useAuth } from '../../hooks/useAuth';
import { useViewPreference } from '../../hooks/useViewPreference';
import { downloadFile } from '../../lib/download';
import { formatCurrency, formatDate } from '../../lib/utils';
import { programmeLabel, programmeColor } from '../../lib/programmes';
import { currency, term } from '../../lib/terms';
import ProposalHover from '../../Components/Finance/ProposalHover';
import DownloadMenu from '../../Components/Finance/DownloadMenu';
import ClearButton from '../../Components/Finance/ClearButton';
import api from '../../lib/api';

const STATUS = {
    submitted:        { label: 'Awaiting college',  cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
    college_verified: { label: 'Awaiting finance',  cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
    finance_verified: { label: 'Finalized',         cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

const money = (v) => parseFloat(v ?? 0) || 0;

function ProgrammeChip({ category }) {
    if (!category) return null;
    const color = programmeColor(category);
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {programmeLabel(category)}
        </span>
    );
}

function StatusBadge({ status }) {
    const s = STATUS[status] ?? STATUS.submitted;
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.cls}`}>{s.label}</span>;
}

/** Submitted → college verified → finance verified, with who did each step. */
function Steps({ settlement }) {
    const steps = [
        { label: 'Submitted', icon: Send, done: true, by: settlement.submitted_by?.name, at: settlement.created_at },
        { label: 'College verified', icon: Building2, done: !!settlement.college_verified_at, by: settlement.college_verified_by_user?.name, at: settlement.college_verified_at },
        { label: 'Finance finalized', icon: Landmark, done: !!settlement.finance_verified_at, by: settlement.finance_verified_by_user?.name, at: settlement.finance_verified_at },
    ];
    const current = steps.findIndex((s) => !s.done);
    return (
        <ol className="grid grid-cols-3 gap-2">
            {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                    <li key={s.label} className={`rounded-xl border px-3 py-2 ${s.done ? 'border-emerald-200 bg-emerald-50/60' : i === current ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-200 bg-white'}`}>
                        <p className={`flex items-center gap-1.5 text-[11px] font-semibold ${s.done ? 'text-emerald-700' : i === current ? 'text-indigo-700' : 'text-gray-400'}`}>
                            {s.done ? <CheckCircle2 size={12} /> : <Icon size={12} />} {s.label}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-500">{s.done ? [s.by, s.at && formatDate(s.at)].filter(Boolean).join(' · ') || '—' : i === current ? 'Waiting' : '—'}</p>
                    </li>
                );
            })}
        </ol>
    );
}

function SpendBar({ approved, spent, unspent }) {
    const base = Math.max(approved, spent + unspent, 1);
    return (
        <div>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-l-full bg-indigo-500" style={{ width: `${(spent / base) * 100}%` }} />
                {unspent > 0 && <div className="h-full bg-amber-400" style={{ width: `${(unspent / base) * 100}%` }} />}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-gray-500">Approved</p><p className="font-bold tabular-nums text-gray-900">{formatCurrency(approved)}</p></div>
                <div><p className="flex items-center gap-1 text-gray-500"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Spent</p><p className="font-bold tabular-nums text-indigo-700">{formatCurrency(spent)}</p></div>
                <div><p className="flex items-center gap-1 text-gray-500"><span className="h-2 w-2 rounded-full bg-amber-400" /> Unspent</p><p className={`font-bold tabular-nums ${unspent > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatCurrency(unspent)}</p></div>
            </div>
        </div>
    );
}

// ─── Waiting to be settled ────────────────────────────────────────────────────

function ToSettleCard({ request, canSettle, onSettle }) {
    const paid = money(request.total_disbursed);
    return (
        <article className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition hover:shadow-md sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <ProposalHover id={request.proposal?.id} className="font-mono text-xs font-bold text-indigo-600">{request.proposal?.tracker_number}</ProposalHover>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Round {request.funding_round}</span>
                    <ProgrammeChip category={request.proposal?.category} />
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 ring-1 ring-teal-200">Paid out</span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-gray-900"><ProposalHover id={request.proposal?.id}>{request.proposal?.title}</ProposalHover></p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                    {request.proposal?.pi?.name && <span className="inline-flex items-center gap-1"><User size={11} /> {request.proposal.pi.name}</span>}
                    {request.proposal?.college?.name && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {request.proposal.college.name}</span>}
                </p>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="sm:text-right">
                    <p className="text-[11px] text-gray-500">Received</p>
                    <p className="text-lg font-bold tabular-nums text-gray-900">{formatCurrency(paid)}</p>
                </div>
                {canSettle ? (
                    <button onClick={onSettle} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                        <Receipt size={14} /> Settle
                    </button>
                ) : (
                    <span className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-500">Waiting for the team</span>
                )}
            </div>
        </article>
    );
}

// ─── A settlement ─────────────────────────────────────────────────────────────

function SettlementCard({ settlement, can, budgetExhausted, onRefresh }) {
    const { success, error } = useToast();
    const { confirm, Dialog } = useConfirm();
    const [busy, setBusy] = useState(false);
    const [noteMode, setNoteMode] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfOpen, setPdfOpen] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

    const proposal = settlement.budget_request?.proposal;
    const request = settlement.budget_request;
    const midtermDone = (proposal?.midterm_evaluations ?? []).some((e) => ['scored', 'completed'].includes(e.status));

    const togglePdf = useCallback(async () => {
        if (pdfOpen) { setPdfOpen(false); return; }
        if (pdfUrl) { setPdfOpen(true); return; }
        setPdfLoading(true);
        try {
            const res = await api.get(`/settlements/${settlement.id}/download-report`, { responseType: 'blob' });
            setPdfUrl(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })));
            setPdfOpen(true);
        } catch {
            error('The expense report could not be opened.');
        }
        setPdfLoading(false);
    }, [pdfOpen, pdfUrl, settlement.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const verify = async () => {
        setBusy(true);
        try {
            await api.post(`/settlements/${settlement.id}/verify`, { notes: noteText });
            success('Verified for the college and sent to finance.');
            setNoteMode(null); setNoteText('');
            onRefresh();
        } catch (e) { error(e.response?.data?.message || 'The settlement could not be verified.'); }
        setBusy(false);
    };

    const finalize = async () => {
        const ok = await confirm({ title: 'Finalize this settlement?', description: 'This closes the funding round; the team can then request the next one.', confirmLabel: 'Finalize' });
        if (!ok) return;
        setBusy(true);
        try {
            await api.post(`/settlements/${settlement.id}/finalize`, { notes: noteText });
            success('Settlement finalized. The next round is open to the team.');
            setNoteMode(null); setNoteText('');
            onRefresh();
        } catch (e) { error(e.response?.data?.message || 'The settlement could not be finalized.'); }
        setBusy(false);
    };

    const canCollege = can.college && settlement.status === 'submitted';
    const canFinance = can.finance && settlement.status === 'college_verified';
    const yourTurn = (canCollege && midtermDone) || canFinance;

    return (
        <article className={`overflow-hidden rounded-2xl border bg-white ${yourTurn ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200'}`}>
            <div className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <ProposalHover id={proposal?.id}><Link href={`/proposals/${proposal?.id}`} className="font-mono text-xs font-bold text-indigo-600">{proposal?.tracker_number}</Link></ProposalHover>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Round {request?.funding_round}</span>
                            <ProgrammeChip category={proposal?.category} />
                            <StatusBadge status={settlement.status} />
                            {yourTurn && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">Your turn</span>}
                        </div>
                        <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-gray-900"><ProposalHover id={proposal?.id}>{proposal?.title}</ProposalHover></p>
                        <p className="mt-0.5 text-xs text-gray-500">{[proposal?.pi?.name, proposal?.college?.name].filter(Boolean).join(' · ')}</p>
                    </div>
                </div>

                <Steps settlement={settlement} />
                <SpendBar approved={money(request?.total_amount)} spent={money(settlement.total_spent)} unspent={money(settlement.unspent_amount)} />

                {money(settlement.unspent_amount) > 0 && settlement.status !== 'finance_verified' && (
                    <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <PiggyBank size={13} className="shrink-0" /> {formatCurrency(settlement.unspent_amount)} unspent is due back to the institution.
                    </p>
                )}

                {(settlement.college_notes || settlement.finance_notes) && (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {settlement.college_notes && <div className="rounded-xl bg-sky-50 px-3 py-2"><p className="text-[11px] font-semibold text-sky-700">College notes</p><p className="text-xs text-sky-900">{settlement.college_notes}</p></div>}
                        {settlement.finance_notes && <div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-[11px] font-semibold text-emerald-700">Finance notes</p><p className="text-xs text-emerald-900">{settlement.finance_notes}</p></div>}
                    </div>
                )}

                {settlement.expense_report_path ? (
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700"><FileText size={14} className="text-indigo-500" /> Expense report</span>
                            <button onClick={togglePdf} disabled={pdfLoading} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                                {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : pdfOpen ? <EyeOff size={12} /> : <Eye size={12} />} {pdfOpen ? 'Hide' : 'View'}
                            </button>
                            <button onClick={() => downloadFile(`/settlements/${settlement.id}/download-report`, 'expense-report.pdf').catch(() => error('The report could not be downloaded.'))}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
                                <Download size={12} /> Download
                            </button>
                        </div>
                        {pdfOpen && pdfUrl && <iframe src={pdfUrl} title="Expense report" className="mt-2 h-96 w-full rounded-xl border border-gray-200" />}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400">No expense report attached.</p>
                )}
            </div>

            <div className="space-y-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                    {canCollege && noteMode !== 'college' && (midtermDone ? (
                        <button onClick={() => { setNoteMode('college'); setNoteText(''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                            <Building2 size={12} /> Verify for the college
                        </button>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200" title="The midterm evaluation must be held and scored first">
                            <Lock size={12} /> Waits for the midterm evaluation score
                        </span>
                    ))}
                    {canFinance && noteMode !== 'finance' && (
                        <button onClick={() => { setNoteMode('finance'); setNoteText(''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                            <Landmark size={12} /> Finalize for finance
                        </button>
                    )}
                    {can.finance && settlement.status === 'submitted' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500"><Lock size={12} /> Finance step opens after the college verifies</span>
                    )}
                    {settlement.status === 'finance_verified' && (
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${budgetExhausted ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {budgetExhausted ? <><Flag size={12} /> Settled — the whole award is used</> : <><CheckCircle2 size={12} /> Settled — the next round is open</>}
                        </span>
                    )}
                    {settlement.status !== 'finance_verified' && !canCollege && !canFinance && !can.finance && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Clock size={12} /> {settlement.status === 'submitted' ? 'With the college for verification' : 'With finance to finalize'}</span>
                    )}
                </div>

                {noteMode && (
                    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
                        <label className="block text-xs font-semibold text-gray-700">{noteMode === 'college' ? 'Verification notes' : 'Finance notes'} <span className="font-normal text-gray-400">(optional)</span></label>
                        <textarea autoFocus rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Anything the team or finance should know…"
                            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setNoteMode(null); setNoteText(''); }} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button onClick={noteMode === 'college' ? verify : finalize} disabled={busy}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${noteMode === 'college' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                {busy && <Loader2 size={12} className="animate-spin" />} {noteMode === 'college' ? 'Confirm verification' : 'Finalize'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <Dialog />
        </article>
    );
}

// ─── Settle ───────────────────────────────────────────────────────────────────

function SettleModal({ request, onClose, onSuccess }) {
    const { success, error } = useToast();
    const received = money(request.total_disbursed || request.total_amount);
    const [spent, setSpent] = useState(String(received || ''));
    const [file, setFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const fileRef = useRef(null);

    const spentValue = parseFloat(spent) || 0;
    const unspent = Math.max(0, received - spentValue);
    const over = spentValue > received;

    const submit = async () => {
        if (spent === '' || spentValue < 0) return error('Enter how much was spent.');
        if (over) return error('Spending can’t be more than what was received.');
        setSubmitting(true);
        try {
            const res = await api.post('/settlements', { budget_request_id: request.id, total_spent: spentValue, unspent_amount: Number(unspent.toFixed(2)) });
            const id = res.data?.data?.id;
            if (file && id) {
                const fd = new FormData();
                fd.append('file', file);
                await api.post(`/settlements/${id}/upload-report`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            success('Settlement submitted. The college will verify it next.');
            onSuccess();
        } catch (e) {
            error(e.response?.data?.message || 'The settlement could not be submitted.');
        }
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><Receipt size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">Settle spending</h2>
                            <p className="truncate text-xs text-gray-500">{request.proposal?.tracker_number} · Round {request.funding_round}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                        <div><p className="text-[11px] text-gray-500">Approved</p><p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(request.total_amount)}</p></div>
                        <div><p className="text-[11px] text-gray-500">Received</p><p className="text-sm font-bold tabular-nums text-teal-700">{formatCurrency(received)}</p></div>
                    </div>

                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Total spent ({currency()})</span>
                        <input type="number" min="0" step="0.01" value={spent} onChange={(e) => setSpent(e.target.value)}
                            className={`w-full rounded-xl border px-4 py-3 text-xl font-bold tabular-nums focus:outline-none focus:ring-2 ${over ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-100' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100'}`} />
                    </label>

                    <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${unspent > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                        <span className="text-sm">{unspent > 0 ? 'Unspent — to be returned' : 'Everything received was spent'}</span>
                        <span className="text-lg font-bold tabular-nums">{formatCurrency(unspent)}</span>
                    </div>

                    <div>
                        <p className="mb-1 text-sm font-medium text-gray-700">Expense report (PDF) <span className="font-normal text-gray-400">· recommended</span></p>
                        <button type="button" onClick={() => fileRef.current?.click()}
                            className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-sm transition ${file ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                            {file ? <><FileText size={16} /> <span className="truncate font-medium">{file.name}</span></> : <><Upload size={16} /> Choose the receipts / expense report (max 10 MB)</>}
                        </button>
                        {file && <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="mt-1 text-xs font-medium text-gray-500 hover:text-red-600">Remove file</button>}
                        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    </div>
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={submitting || over}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        {submitting && <Loader2 size={14} className="animate-spin" />} Submit settlement
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settlements() {
    const { error } = useToast();
    const { user, hasPermission, accessScope } = useAuth();
    const [view, setView] = useViewPreference('settlements', 'card');
    const [tab, setTab] = useState(null);
    const [settlements, setSettlements] = useState(null);
    const [toSettle, setToSettle] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settling, setSettling] = useState(null);
    const [search, setSearch] = useState('');
    const [programme, setProgramme] = useState('');
    const [college, setCollege] = useState('');
    const [round, setRound] = useState('');

    const can = {
        college: hasPermission('settlements.verify_college'),
        finance: hasPermission('settlements.verify_finance'),
    };
    // Only the project's own team settles it; officers just see what is outstanding.
    const canSettle = (r) => accessScope.type === 'own' || r.proposal?.pi_user_id === user?.id;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [s, p] = await Promise.all([api.get('/settlements'), api.get('/settlements/pending')]);
            const list = s.data?.data ?? [];
            const pending = p.data?.data ?? [];
            setSettlements(list);
            setToSettle(pending);
            setTab((current) => current ?? (
                pending.some(canSettle) ? 'settle'
                    : can.college && list.some((x) => x.status === 'submitted') ? 'college'
                    : can.finance && list.some((x) => x.status === 'college_verified') ? 'finance'
                    : 'all'));
        } catch {
            setSettlements((v) => v ?? []);
            error('Could not load settlements.');
        }
        setLoading(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const all = settlements ?? [];
    const q = search.trim().toLowerCase();
    const matches = (p, r) => (!programme || p?.category === programme)
        && (!college || p?.college_id === college)
        && (!round || String(r) === round)
        && (!q || [p?.tracker_number, p?.title, p?.pi?.name].some((v) => v?.toLowerCase().includes(q)));
    const projects = [...toSettle.map((r) => r.proposal), ...all.map((x) => x.budget_request?.proposal)].filter(Boolean);
    const colleges = [...new Map(projects.filter((p) => p.college).map((p) => [p.college_id, p.college.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const usedProgrammes = [...new Set(projects.map((p) => p.category).filter(Boolean))];
    const rounds = [...new Set([...toSettle.map((r) => r.funding_round), ...all.map((x) => x.budget_request?.funding_round)].filter(Boolean))].sort((a, b) => a - b);
    const filtersOn = !!(search || programme || college || round);
    const clearFilters = () => { setSearch(''); setProgramme(''); setCollege(''); setRound(''); };
    const list = all.filter((s) => matches(s.budget_request?.proposal, s.budget_request?.funding_round));
    const pending = toSettle.filter((r) => matches(r.proposal, r.funding_round));

    // Has every finalized settlement of a project used up its whole award?
    const exhausted = useMemo(() => {
        const spent = new Map();
        const award = new Map();
        all.forEach((s) => {
            const p = s.budget_request?.proposal;
            if (!p) return;
            award.set(p.id, money(p.award?.awarded_amount));
            if (s.status === 'finance_verified') spent.set(p.id, (spent.get(p.id) ?? 0) + money(s.total_spent));
        });
        return (id) => (award.get(id) ?? 0) > 0 && (spent.get(id) ?? 0) >= award.get(id);
    }, [all]);

    const tabs = [
        { key: 'settle', label: 'To settle', count: pending.length },
        { key: 'college', label: 'College review', count: list.filter((s) => s.status === 'submitted').length },
        { key: 'finance', label: 'Finance review', count: list.filter((s) => s.status === 'college_verified').length },
        { key: 'done', label: 'Finalized', count: list.filter((s) => s.status === 'finance_verified').length },
        { key: 'all', label: 'All', count: list.length },
    ];
    const shown = tab === 'college' ? list.filter((s) => s.status === 'submitted')
        : tab === 'finance' ? list.filter((s) => s.status === 'college_verified')
        : tab === 'done' ? list.filter((s) => s.status === 'finance_verified')
        : list;

    const unspentDue = all.filter((s) => s.status !== 'finance_verified').reduce((sum, s) => sum + money(s.unspent_amount), 0);
    const settledSpent = all.filter((s) => s.status === 'finance_verified').reduce((sum, s) => sum + money(s.total_spent), 0);

    const columns = [
        { key: 'proj', label: 'Project', render: (s) => (
            <div className="min-w-0">
                <ProposalHover id={s.budget_request?.proposal?.id} className="font-mono text-xs font-bold text-indigo-600">{s.budget_request?.proposal?.tracker_number}</ProposalHover>
                <p className="max-w-64 truncate text-xs text-gray-500">{s.budget_request?.proposal?.title}</p>
            </div>
        ) },
        { key: 'round', label: 'Round', render: (s) => <span className="text-xs">{s.budget_request?.funding_round}</span> },
        { key: 'approved', label: 'Approved', align: 'right', render: (s) => formatCurrency(s.budget_request?.total_amount) },
        { key: 'spent', label: 'Spent', align: 'right', render: (s) => <span className="font-semibold text-indigo-700">{formatCurrency(s.total_spent)}</span> },
        { key: 'unspent', label: 'Unspent', align: 'right', render: (s) => <span className={money(s.unspent_amount) > 0 ? 'font-semibold text-amber-700' : 'text-emerald-700'}>{formatCurrency(s.unspent_amount)}</span> },
        { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status} /> },
        { key: 'date', label: 'Submitted', render: (s) => <span className="text-xs text-gray-500">{formatDate(s.created_at)}</span> },
    ];

    return (
        <AppLayout breadcrumb="Settlements">
            <div className="mx-auto max-w-6xl space-y-5">
                <PageHeader icon={Shield} color="violet" title="Settlements"
                    description="Account for each round’s spending. Once finance finalizes it, the next round opens.">
                    {tab !== 'settle' && <ViewToggle view={view} onChange={setView} />}
                    {tab === 'settle' ? (
                        <DownloadMenu filename="to-settle" title="Waiting to be settled" columns={[
                            { label: 'Tracker', value: (r) => r.proposal?.tracker_number },
                            { label: 'Title', value: (r) => r.proposal?.title },
                            { label: 'PI', value: (r) => r.proposal?.pi?.name },
                            { label: term('college'), value: (r) => r.proposal?.college?.name },
                            { label: 'Round', value: (r) => r.funding_round },
                            { label: 'Approved', value: (r) => money(r.total_amount) },
                            { label: 'Received', value: (r) => money(r.total_disbursed) },
                        ]} rows={pending} />
                    ) : (
                        <DownloadMenu filename="settlements" title="Settlements" subtitle={tabs.find((t) => t.key === tab)?.label} columns={[
                            { label: 'Tracker', value: (x) => x.budget_request?.proposal?.tracker_number },
                            { label: 'Title', value: (x) => x.budget_request?.proposal?.title },
                            { label: 'PI', value: (x) => x.budget_request?.proposal?.pi?.name },
                            { label: term('college'), value: (x) => x.budget_request?.proposal?.college?.name },
                            { label: 'Round', value: (x) => x.budget_request?.funding_round },
                            { label: 'Approved', value: (x) => money(x.budget_request?.total_amount) },
                            { label: 'Spent', value: (x) => money(x.total_spent) },
                            { label: 'Unspent', value: (x) => money(x.unspent_amount) },
                            { label: 'Status', value: (x) => STATUS[x.status]?.label ?? x.status },
                            { label: 'Submitted', value: (x) => (x.created_at ? formatDate(x.created_at) : '') },
                            { label: 'College verified', value: (x) => (x.college_verified_at ? formatDate(x.college_verified_at) : '') },
                            { label: 'Finance finalized', value: (x) => (x.finance_verified_at ? formatDate(x.finance_verified_at) : '') },
                        ]} rows={shown} />
                    )}
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {settlements === null ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={Wallet} color="amber" label="Waiting to be settled" value={toSettle.length} hint={`${formatCurrency(toSettle.reduce((s, r) => s + money(r.total_disbursed), 0))} paid out`} />
                        <StatCard icon={Building2} color="sky" label="With the college" value={all.filter((s) => s.status === 'submitted').length} hint="To verify" />
                        <StatCard icon={Landmark} color="indigo" label="With finance" value={all.filter((s) => s.status === 'college_verified').length} hint="To finalize" />
                        <StatCard icon={CheckCircle2} color="emerald" label="Finalized" value={all.filter((s) => s.status === 'finance_verified').length}
                            hint={unspentDue > 0 ? `${formatCurrency(unspentDue)} unspent still open` : `${formatCurrency(settledSpent)} accounted for`} hintTone={unspentDue > 0 ? 'text-amber-600 font-medium' : undefined} />
                    </div>
                )}

                <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                    {[['Team settles', Receipt], ['College verifies', Building2], ['Finance finalizes', Landmark], ['Next round opens', Flag]].map(([label, Icon], i, arr) => (
                        <span key={label} className="inline-flex shrink-0 items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 font-medium text-gray-700"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-violet-600"><Icon size={12} /></span>{label}</span>
                            {i < arr.length - 1 && <ArrowRight size={12} className="text-gray-300" />}
                        </span>
                    ))}
                </div>

                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex flex-col gap-2 lg:flex-row">
                        <label className="relative min-w-0 flex-1">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tracker number, title or PI…"
                                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 sm:text-sm" />
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
                        {tabs.map((t) => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                {t.label}
                                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === t.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {settlements === null ? (
                    <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
                ) : tab === 'settle' ? (
                    pending.length === 0 ? (
                        <Panel bodyClassName="p-0"><EmptyState icon={Receipt} title="Nothing to settle" text="Requests show here once their money is paid out, until the team settles them." /></Panel>
                    ) : (
                        <div className="space-y-3">{pending.map((r) => <ToSettleCard key={r.id} request={r} canSettle={canSettle(r)} onSettle={() => setSettling(r)} />)}</div>
                    )
                ) : shown.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={Shield} title={q ? 'Nothing matches' : tab === 'college' ? 'Nothing for the college to verify' : tab === 'finance' ? 'Nothing for finance to finalize' : 'No settlements yet'}
                            text={q ? 'Try another search.' : 'Settlements appear here once teams account for their spending.'} />
                    </Panel>
                ) : view === 'table' ? (
                    <Panel bodyClassName="p-0"><DataTable columns={columns} rows={shown} rowKey={(s) => s.id} minWidth={820} /></Panel>
                ) : (
                    <div className="grid gap-3 xl:grid-cols-2">
                        {shown.map((s) => <SettlementCard key={s.id} settlement={s} can={can} budgetExhausted={exhausted(s.budget_request?.proposal?.id)} onRefresh={load} />)}
                    </div>
                )}
            </div>

            {settling && <SettleModal request={settling} onClose={() => setSettling(null)} onSuccess={() => { setSettling(null); load(); }} />}
        </AppLayout>
    );
}
