import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    CreditCard, CheckCircle2, Clock, X, TrendingUp, AlertCircle, ChevronDown, Search,
    Loader2, Banknote, CalendarDays, Receipt, User, Building2, ArrowRight, Hash,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ViewToggle from '../../Components/ViewToggle';
import { PageHeader, StatCard, Panel, EmptyState, Select, RefreshButton, StatSkeletons, Skeleton, DataTable } from '../../Components/Insights/Kit';
import { useAuth } from '../../hooks/useAuth';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useToast } from '../../Components/Toast';
import { formatDate, formatDateTime, formatCurrency } from '../../lib/utils';
import { programmeLabel, programmeColor } from '../../lib/programmes';
import api from '../../lib/api';
import { currency, term } from '../../lib/terms';
import ProposalHover from '../../Components/Finance/ProposalHover';
import DownloadMenu from '../../Components/Finance/DownloadMenu';
import ClearButton from '../../Components/Finance/ClearButton';

const money = (v) => parseFloat(v ?? 0) || 0;
const monthKey = (iso) => (iso ? iso.slice(0, 7) : 'unknown');
const monthLabel = (key) => (key === 'unknown' ? 'No date' : new Date(`${key}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
const daysSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);

function ProgrammeChip({ category }) {
    if (!category) return null;
    const color = programmeColor(category);
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {programmeLabel(category)}
        </span>
    );
}

// ─── Waiting to be paid ───────────────────────────────────────────────────────

function PendingCard({ request, onDisburse }) {
    const [open, setOpen] = useState(false);
    const total = money(request.total_amount);
    const paid = money(request.disbursed_amount);
    const remaining = money(request.remaining_amount ?? total - paid);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    const waited = daysSince(request.approved_at);

    return (
        <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <ProposalHover id={request.proposal?.id} className="font-mono text-xs font-bold text-indigo-600">{request.proposal?.tracker_number}</ProposalHover>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Round {request.funding_round}</span>
                        <ProgrammeChip category={request.proposal?.category} />
                        {waited !== null && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${waited > 14 ? 'bg-red-50 text-red-700' : waited > 7 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                <Clock size={10} /> {waited === 0 ? 'Approved today' : `Waiting ${waited} day${waited === 1 ? '' : 's'}`}
                            </span>
                        )}
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-gray-900"><ProposalHover id={request.proposal?.id}>{request.proposal?.title}</ProposalHover></p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                        {request.proposal?.pi?.name && <span className="inline-flex items-center gap-1"><User size={11} /> {request.proposal.pi.name}</span>}
                        {request.proposal?.college?.name && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {request.proposal.college.name}</span>}
                    </p>

                    <div className="mt-3">
                        <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[11px]">
                            <span className="text-gray-500">{formatCurrency(paid)} of {formatCurrency(total)} paid</span>
                            <span className="font-semibold text-gray-700">{pct}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <div className="sm:text-right">
                        <p className="text-[11px] text-gray-500">To pay</p>
                        <p className="text-xl font-bold tabular-nums text-gray-900">{formatCurrency(remaining)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={`/budget-requests/${request.id}`} className="rounded-lg px-2.5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100">Request</Link>
                        <button onClick={onDisburse} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                            <Banknote size={14} /> Pay
                        </button>
                    </div>
                </div>
            </div>

            {(request.items ?? []).length > 0 && (
                <>
                    <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50">
                        <span>{request.items.length} item{request.items.length === 1 ? '' : 's'}</span>
                        <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                        <ul className="divide-y divide-gray-50 border-t border-gray-100 px-4">
                            {request.items.map((item, i) => (
                                <li key={i} className="flex justify-between gap-3 py-2 text-xs">
                                    <span className="min-w-0 truncate text-gray-600"><span className="font-medium text-gray-800">{item.category}</span> — {item.description}</span>
                                    <span className="shrink-0 font-semibold tabular-nums text-gray-900">{formatCurrency(item.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </article>
    );
}

// ─── Paid ─────────────────────────────────────────────────────────────────────

function PaymentRow({ d }) {
    const ref = d.transaction_id || (d.cheque_number && `Cheque ${d.cheque_number}`);
    return (
        <li className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><Receipt size={16} /></span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <ProposalHover id={d.budget_request?.proposal?.id} className="font-mono text-xs font-bold text-indigo-600">{d.budget_request?.proposal?.tracker_number}</ProposalHover>
                    <span className="text-[11px] text-gray-400">Round {d.budget_request?.funding_round}</span>
                    {ref && <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600"><Hash size={10} />{ref}</span>}
                </div>
                <p className="truncate text-sm text-gray-800">{d.budget_request?.proposal?.title}</p>
                <p className="text-[11px] text-gray-400">
                    {d.disbursed_at ? formatDateTime(d.disbursed_at) : '—'}{d.disbursed_by?.name ? ` · by ${d.disbursed_by.name}` : ''}
                </p>
                {d.notes && <p className="mt-0.5 text-xs italic text-gray-500">“{d.notes}”</p>}
            </div>
            <p className="shrink-0 text-sm font-bold tabular-nums text-teal-700">{formatCurrency(d.amount)}</p>
        </li>
    );
}

// ─── Pay ──────────────────────────────────────────────────────────────────────

function DisburseModal({ request, onClose, onSuccess }) {
    const { error } = useToast();
    const total = money(request.total_amount);
    const paid = money(request.disbursed_amount);
    const remaining = money(request.remaining_amount ?? total - paid);
    const [form, setForm] = useState({ amount: String(remaining || ''), transaction_id: '', cheque_number: '', notes: '' });
    const [submitting, setSubmitting] = useState(false);
    const entered = parseFloat(form.amount || 0);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:text-sm';

    const submit = async () => {
        if (!(entered > 0)) return error('Enter an amount above zero.');
        if (entered > remaining + 0.01) return error(`That is more than the ${formatCurrency(remaining)} still to pay.`);
        setSubmitting(true);
        try {
            await api.post('/disbursements', {
                budget_request_id: request.id, amount: entered,
                transaction_id: form.transaction_id || null, cheque_number: form.cheque_number || null, notes: form.notes || null,
            });
            onSuccess(entered);
        } catch (e) {
            error(e.response?.data?.message ?? 'The payment could not be recorded.');
        }
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600"><Banknote size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">Record payment</h2>
                            <p className="truncate text-xs text-gray-500">{request.proposal?.tracker_number} · Round {request.funding_round}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                        {[['Approved', total, 'text-gray-900'], ['Paid', paid, 'text-teal-700'], ['Still to pay', remaining, 'text-indigo-700']].map(([label, v, cls]) => (
                            <div key={label}>
                                <p className="text-[11px] text-gray-500">{label}</p>
                                <p className={`text-sm font-bold tabular-nums ${cls}`}>{formatCurrency(v)}</p>
                            </div>
                        ))}
                    </div>

                    <label className="block">
                        <span className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700">
                            Amount ({currency()})
                            {entered !== remaining && <button type="button" onClick={() => set('amount', String(remaining))} className="text-xs font-semibold text-teal-600 hover:underline">Pay the full {formatCurrency(remaining)}</button>}
                        </span>
                        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-xl font-bold tabular-nums focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100" />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Transaction reference</span>
                            <input value={form.transaction_id} onChange={(e) => set('transaction_id', e.target.value)} placeholder="e.g. TXN-2026-001" className={inputCls} />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Cheque number</span>
                            <input value={form.cheque_number} onChange={(e) => set('cheque_number', e.target.value)} placeholder="e.g. CHQ-00123" className={inputCls} />
                        </label>
                    </div>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Notes</span>
                        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" className={`${inputCls} resize-none`} />
                    </label>

                    {entered > 0 && entered < remaining && (
                        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                            <AlertCircle size={13} className="mt-0.5 shrink-0" /> A part payment — {formatCurrency(remaining - entered)} will still be due.
                        </p>
                    )}
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={submitting || !(entered > 0)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} Pay {entered > 0 ? formatCurrency(entered) : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Disbursements() {
    const { hasPermission } = useAuth();
    const { success, error } = useToast();
    const [view, setView] = useViewPreference('disbursements', 'card');
    const canPay = hasPermission('funds.disburse');

    const [tab, setTab] = useState(canPay ? 'pending' : 'paid');
    const [payments, setPayments] = useState(null);
    const [pending, setPending] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(null);
    const [search, setSearch] = useState('');
    const [month, setMonth] = useState('');
    const [sort, setSort] = useState('oldest');
    const [programme, setProgramme] = useState('');
    const [college, setCollege] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            api.get('/disbursements'),
            api.get('/disbursements/stats'),
            canPay ? api.get('/disbursements/pending') : Promise.resolve(null),
        ])
            .then(([d, s, p]) => {
                setPayments(d.data?.data ?? []);
                setStats(s.data?.data ?? {});
                if (p) setPending(p.data?.data ?? []);
            })
            .catch(() => { setPayments((v) => v ?? []); error('Could not load disbursements.'); })
            .finally(() => setLoading(false));
    }, [canPay]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const q = search.trim().toLowerCase();
    const matches = (p) => (!programme || p?.category === programme)
        && (!college || p?.college_id === college)
        && (!q || [p?.tracker_number, p?.title, p?.pi?.name].some((v) => v?.toLowerCase().includes(q)));
    const projects = [...pending.map((r) => r.proposal), ...(payments ?? []).map((d) => d.budget_request?.proposal)].filter(Boolean);
    const colleges = [...new Map(projects.filter((p) => p.college).map((p) => [p.college_id, p.college.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const usedProgrammes = [...new Set(projects.map((p) => p.category).filter(Boolean))];
    const filtersOn = !!(search || programme || college || month);
    const clearFilters = () => { setSearch(''); setProgramme(''); setCollege(''); setMonth(''); };

    const toPay = useMemo(() => {
        const list = pending.filter((r) => !r.disbursement_complete && matches(r.proposal));
        const by = {
            oldest: (a, b) => new Date(a.approved_at ?? 0) - new Date(b.approved_at ?? 0),
            largest: (a, b) => money(b.remaining_amount) - money(a.remaining_amount),
        };
        return [...list].sort(by[sort] ?? by.oldest);
    }, [pending, q, sort, programme, college]); // eslint-disable-line react-hooks/exhaustive-deps

    const all = payments ?? [];
    const months = [...new Set(all.map((d) => monthKey(d.disbursed_at)))].sort().reverse();
    const paid = all.filter((d) => (!month || monthKey(d.disbursed_at) === month) && matches(d.budget_request?.proposal));
    const paidTotal = paid.reduce((s, d) => s + money(d.amount), 0);
    const toPayTotal = toPay.reduce((s, r) => s + money(r.remaining_amount), 0);
    const overdue = toPay.filter((r) => (daysSince(r.approved_at) ?? 0) > 14).length;

    const byMonth = useMemo(() => {
        const groups = new Map();
        paid.forEach((d) => {
            const k = monthKey(d.disbursed_at);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(d);
        });
        return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    }, [paid]);

    const paidExport = [
        { label: 'Date', value: (d) => (d.disbursed_at ? formatDate(d.disbursed_at) : '') },
        { label: 'Tracker', value: (d) => d.budget_request?.proposal?.tracker_number },
        { label: 'Title', value: (d) => d.budget_request?.proposal?.title },
        { label: 'PI', value: (d) => d.budget_request?.proposal?.pi?.name },
        { label: term('college'), value: (d) => d.budget_request?.proposal?.college?.name },
        { label: 'Round', value: (d) => d.budget_request?.funding_round },
        { label: 'Amount', value: (d) => money(d.amount) },
        { label: 'Transaction', value: (d) => d.transaction_id },
        { label: 'Cheque', value: (d) => d.cheque_number },
        { label: 'Paid by', value: (d) => d.disbursed_by?.name },
        { label: 'Notes', value: (d) => d.notes },
    ];
    const toPayExport = [
        { label: 'Tracker', value: (r) => r.proposal?.tracker_number },
        { label: 'Title', value: (r) => r.proposal?.title },
        { label: 'PI', value: (r) => r.proposal?.pi?.name },
        { label: term('college'), value: (r) => r.proposal?.college?.name },
        { label: 'Round', value: (r) => r.funding_round },
        { label: 'Approved', value: (r) => money(r.total_amount) },
        { label: 'Paid', value: (r) => money(r.disbursed_amount) },
        { label: 'To pay', value: (r) => money(r.remaining_amount) },
        { label: 'Approved on', value: (r) => (r.approved_at ? formatDate(r.approved_at) : '') },
        { label: 'Days waiting', value: (r) => daysSince(r.approved_at) ?? '' },
    ];

    const columns = [
        { key: 'date', label: 'Date', render: (d) => <span className="text-xs text-gray-600">{d.disbursed_at ? formatDate(d.disbursed_at) : '—'}</span> },
        { key: 'proj', label: 'Project', render: (d) => (
            <div className="min-w-0">
                <ProposalHover id={d.budget_request?.proposal?.id} className="font-mono text-xs font-bold text-indigo-600">{d.budget_request?.proposal?.tracker_number}</ProposalHover>
                <p className="max-w-64 truncate text-xs text-gray-500">{d.budget_request?.proposal?.title}</p>
            </div>
        ) },
        { key: 'round', label: 'Round', render: (d) => <span className="text-xs">{d.budget_request?.funding_round}</span> },
        { key: 'ref', label: 'Reference', render: (d) => d.transaction_id || d.cheque_number ? <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px]">{d.transaction_id || `CHQ ${d.cheque_number}`}</code> : <span className="text-xs text-gray-400">—</span> },
        { key: 'by', label: 'Paid by', render: (d) => <span className="text-xs">{d.disbursed_by?.name ?? '—'}</span> },
        { key: 'amount', label: 'Amount', align: 'right', render: (d) => <span className="font-semibold text-teal-700">{formatCurrency(d.amount)}</span> },
    ];

    const tabs = [
        ...(canPay ? [{ key: 'pending', label: 'To pay', count: toPay.length }] : []),
        { key: 'paid', label: 'Paid', count: paid.length },
    ];

    return (
        <AppLayout breadcrumb="Disbursements">
            <div className="mx-auto max-w-6xl space-y-5">
                <PageHeader icon={CreditCard} color="sky" title="Disbursements"
                    description={canPay ? 'Pay approved budget requests and keep a record of every payment.' : 'Payments made to your projects.'}>
                    {tab === 'paid' && <ViewToggle view={view} onChange={setView} />}
                    {tab === 'pending'
                        ? <DownloadMenu filename="disbursements-to-pay" title="Waiting to be paid" subtitle={`Total ${formatCurrency(toPayTotal)}`} columns={toPayExport} rows={toPay} />
                        : <DownloadMenu filename="disbursements" title="Payments made" subtitle={`${month ? monthLabel(month) : 'All months'} · total ${formatCurrency(paidTotal)}`} columns={paidExport} rows={paid} />}
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {stats === null ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        {canPay ? (
                            <StatCard icon={Clock} color="amber" label="Waiting to be paid" value={formatCurrency(pending.reduce((s, r) => s + (r.disbursement_complete ? 0 : money(r.remaining_amount)), 0))}
                                hint={overdue ? `${overdue} waiting over two weeks` : `${pending.filter((r) => !r.disbursement_complete).length} request(s)`} hintTone={overdue ? 'text-red-600 font-medium' : undefined} />
                        ) : (
                            <StatCard icon={Clock} color="amber" label="Approved, not yet paid" value={stats.pending_count ?? 0} hint="Requests" />
                        )}
                        <StatCard icon={CalendarDays} color="sky" label="Paid this month" value={formatCurrency(stats.this_month)} hint={new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} />
                        <StatCard icon={TrendingUp} color="emerald" label="Paid in total" value={formatCurrency(stats.total_disbursed)} hint="All time" />
                        <StatCard icon={Receipt} color="indigo" label="Payments" value={stats.disbursement_count ?? 0} hint="Recorded" />
                    </div>
                )}

                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <label className="relative min-w-0 flex-1">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tracker number, title or PI…"
                                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:text-sm" />
                        </label>
                        {tab === 'pending' ? (
                            <Select label="Sort" value={sort} onChange={setSort} className="sm:w-48">
                                <option value="oldest">Waiting longest</option>
                                <option value="largest">Largest first</option>
                            </Select>
                        ) : months.length > 1 && (
                            <Select label="Month" value={month} onChange={setMonth} className="sm:w-48">
                                <option value="">All months</option>
                                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                            </Select>
                        )}
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
                        {filtersOn && <ClearButton onClick={clearFilters} />}
                    </div>
                    {tabs.length > 1 && (
                        <div className="flex gap-1">
                            {tabs.map((t) => (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                    {t.label}
                                    <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === t.key ? 'bg-white/20' : t.key === 'pending' && t.count ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {payments === null ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
                ) : tab === 'pending' && canPay ? (
                    toPay.length === 0 ? (
                        <Panel bodyClassName="p-0">
                            <EmptyState icon={CheckCircle2} title={q ? 'Nothing matches' : 'All caught up'} text={q ? 'Try another search.' : 'No approved budget request is waiting for money.'} />
                        </Panel>
                    ) : (
                        <div className="space-y-3">
                            <p className="flex items-center justify-between px-1 text-xs text-gray-500">
                                <span>{toPay.length} request{toPay.length === 1 ? '' : 's'}</span>
                                <span>Total to pay <span className="font-bold tabular-nums text-gray-900">{formatCurrency(toPayTotal)}</span></span>
                            </p>
                            {toPay.map((r) => <PendingCard key={r.id} request={r} onDisburse={() => setPaying(r)} />)}
                        </div>
                    )
                ) : paid.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={CreditCard} title={all.length ? 'Nothing matches' : 'No payments yet'}
                            text={all.length ? 'Try another month or search.' : canPay ? 'Payments you record from “To pay” appear here.' : 'Payments to your projects will appear here.'} />
                    </Panel>
                ) : view === 'table' ? (
                    <Panel bodyClassName="p-0" title={`${paid.length} payment${paid.length === 1 ? '' : 's'}`} subtitle={`Total ${formatCurrency(paidTotal)}`}>
                        <DataTable columns={columns} rows={paid} rowKey={(d) => d.id} minWidth={720} />
                    </Panel>
                ) : (
                    <div className="space-y-4">
                        {byMonth.map(([key, rows]) => (
                            <Panel key={key} bodyClassName="p-0" title={monthLabel(key)} subtitle={`${rows.length} payment${rows.length === 1 ? '' : 's'}`}
                                actions={<span className="text-sm font-bold tabular-nums text-teal-700">{formatCurrency(rows.reduce((s, d) => s + money(d.amount), 0))}</span>}>
                                <ul className="divide-y divide-gray-100">{rows.map((d) => <PaymentRow key={d.id} d={d} />)}</ul>
                            </Panel>
                        ))}
                    </div>
                )}

                {!canPay && pending.length === 0 && stats?.pending_count > 0 && (
                    <Link href="/budget-requests" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">See your approved requests <ArrowRight size={14} /></Link>
                )}
            </div>

            {paying && (
                <DisburseModal request={paying} onClose={() => setPaying(null)}
                    onSuccess={(amount) => { setPaying(null); success(`${formatCurrency(amount)} paid. The team has been told.`); load(); }} />
            )}
        </AppLayout>
    );
}
