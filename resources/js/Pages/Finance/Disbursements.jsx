import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    CreditCard, CheckCircle2, Clock, X, TrendingUp,
    AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ViewToggle from '../../Components/ViewToggle';
import { useAuth } from '../../hooks/useAuth';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useToast } from '../../Components/Toast';
import { formatDate, formatDateTime, formatCurrency } from '../../lib/utils';
import api from '../../lib/api';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={20} className="text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 leading-none truncate">{value}</p>
                <p className="text-sm text-gray-600 mt-0.5">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
            </div>
        </div>
    );
}

// ─── Pending disbursement card ────────────────────────────────────────────────

function PendingCard({ request, onDisburse }) {
    const [expanded, setExpanded] = useState(false);
    const total     = parseFloat(request.total_amount ?? 0);
    const disbursed = parseFloat(request.disbursed_amount ?? 0);
    const remaining = parseFloat(request.remaining_amount ?? total - disbursed);
    const pct       = total > 0 ? Math.round((disbursed / total) * 100) : 0;

    return (
        <div className="bg-white border-2 border-amber-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {request.proposal?.tracker_number}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">
                            {request.proposal?.category?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium border border-amber-200">
                            Round {request.funding_round}
                        </span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            Approved
                        </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{request.proposal?.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        PI: {request.proposal?.pi?.name} · {request.proposal?.college?.name}
                    </p>

                    {/* Progress bar */}
                    <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Disbursed: {formatCurrency(disbursed)}</span>
                            <span>Total: {formatCurrency(total)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-blue-600 font-semibold">{pct}% disbursed</span>
                            <span className="text-amber-600 font-semibold">
                                {formatCurrency(remaining)} remaining
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={onDisburse}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-colors">
                        <CreditCard size={14} /> Disburse
                    </button>
                    <Link href={`/budget-requests/${request.id}`}
                        className="text-center text-xs text-blue-600 hover:underline font-medium">
                        View Request →
                    </Link>
                </div>
            </div>

            {/* Expandable items */}
            {(request.items ?? []).length > 0 && (
                <>
                    <button onClick={() => setExpanded(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-2 border-t border-amber-100 bg-amber-50/40 text-xs text-amber-700 hover:bg-amber-50">
                        <span className="font-medium">{request.items.length} budget item{request.items.length !== 1 ? 's' : ''}</span>
                        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {expanded && (
                        <div className="px-5 py-3 border-t border-amber-100 space-y-1.5 bg-amber-50/20">
                            {request.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-xs text-gray-600">
                                    <span className="truncate pr-4"><span className="font-medium">{item.category}</span> — {item.description}</span>
                                    <span className="font-semibold shrink-0">{formatCurrency(item.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Disbursement history card ────────────────────────────────────────────────

function DisbursementCard({ disbursement }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                    <CreditCard size={18} className="text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold text-blue-600">
                            {disbursement.budget_request?.proposal?.tracker_number}
                        </span>
                        <span className="text-xs text-gray-400">
                            Round {disbursement.budget_request?.funding_round}
                        </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                        {disbursement.budget_request?.proposal?.title}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                        {disbursement.transaction_id && (
                            <span>Txn: <code className="bg-gray-100 px-1 rounded">{disbursement.transaction_id}</code></span>
                        )}
                        {disbursement.cheque_number && (
                            <span>Cheque: <code className="bg-gray-100 px-1 rounded">{disbursement.cheque_number}</code></span>
                        )}
                        <span>By: {disbursement.disbursed_by?.name ?? '—'}</span>
                        <span>{disbursement.disbursed_at ? formatDateTime(disbursement.disbursed_at) : '—'}</span>
                    </div>
                    {disbursement.notes && (
                        <p className="text-xs text-gray-400 italic mt-1">{disbursement.notes}</p>
                    )}
                </div>
                <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-teal-700">{formatCurrency(disbursement.amount)}</p>
                    <p className="text-xs text-gray-400">disbursed</p>
                </div>
            </div>
        </div>
    );
}

// ─── Disburse modal ───────────────────────────────────────────────────────────

function DisburseModal({ request, onClose, onSuccess }) {
    const { error } = useToast();
    const [form, setForm] = useState({
        amount:         String(request.remaining_amount ?? request.total_amount ?? ''),
        transaction_id: '',
        cheque_number:  '',
        notes:          '',
    });
    const [submitting, setSubmitting] = useState(false);

    const total     = parseFloat(request.total_amount    ?? 0);
    const disbursed = parseFloat(request.disbursed_amount ?? 0);
    const remaining = parseFloat(request.remaining_amount ?? total - disbursed);
    const entered   = parseFloat(form.amount || 0);
    const isPartial = entered > 0 && entered < remaining;

    const submit = async () => {
        if (!entered || entered <= 0)        return error('Please enter a valid amount.');
        if (entered > remaining + 0.01)      return error(`Amount exceeds remaining balance of ${formatCurrency(remaining)}.`);
        setSubmitting(true);
        try {
            await api.post('/disbursements', {
                budget_request_id: request.id,
                amount:            entered,
                transaction_id:    form.transaction_id || null,
                cheque_number:     form.cheque_number  || null,
                notes:             form.notes          || null,
            });
            onSuccess();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to disburse funds.');
        }
        setSubmitting(false);
    };

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-t-2xl px-6 py-5 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Disburse Funds</h2>
                        <p className="text-blue-100 text-xs mt-0.5">
                            {request.proposal?.tracker_number} · Round {request.funding_round}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                        {[
                            { label: 'Total Approved', value: formatCurrency(total),     cls: 'text-gray-900' },
                            { label: 'Disbursed',      value: formatCurrency(disbursed), cls: 'text-blue-600' },
                            { label: 'Remaining',      value: formatCurrency(remaining), cls: 'text-green-600' },
                        ].map(({ label, value, cls }) => (
                            <div key={label}>
                                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                                <p className={`text-base font-bold ${cls}`}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Disbursement Amount (ETB) <span className="text-red-500">*</span>
                        </label>
                        <input type="number" min="0.01" step="0.01" value={form.amount}
                            onChange={e => set('amount', e.target.value)}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00" />
                        <p className="text-xs text-gray-400 mt-1">
                            Maximum: {formatCurrency(remaining)}
                        </p>
                    </div>

                    {/* Payment reference */}
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: 'Transaction ID', key: 'transaction_id', placeholder: 'e.g. TXN-2026-001' },
                            { label: 'Cheque Number',  key: 'cheque_number',  placeholder: 'e.g. CHQ-00123'    },
                        ].map(({ label, key, placeholder }) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                                <input type="text" value={form[key]}
                                    onChange={e => set(key, e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        ))}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea rows={2} value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            placeholder="Optional notes about this disbursement…"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>

                    {/* Partial notice */}
                    {isPartial && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                            <AlertCircle size={13} className="shrink-0 mt-0.5" />
                            <span>
                                <strong>Partial disbursement:</strong> {formatCurrency(remaining - entered)} will remain to disburse later.
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={submitting || !entered || entered <= 0}
                        className="flex-1 px-4 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                        {submitting ? (
                            <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing…</>
                        ) : (
                            <><CreditCard size={15} /> Disburse {entered > 0 ? formatCurrency(entered) : ''}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Disbursements() {
    const { user, hasPermission }  = useAuth();
    const { success, error }    = useToast();
    const [view, setView]       = useViewPreference('disbursements', 'card');

    const isFinance = hasPermission('funds.disburse');
    const canDisburse = isFinance;

    const [activeTab,       setActiveTab]       = useState(canDisburse ? 'pending' : 'disbursed');
    const [disbursements,   setDisbursements]   = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [stats,           setStats]           = useState(null);
    const [loading,         setLoading]         = useState(true);
    const [disburseTarget,  setDisburseTarget]  = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        const calls = [
            api.get('/disbursements'),
            api.get('/disbursements/stats'),
            ...(canDisburse ? [api.get('/disbursements/pending')] : []),
        ];

        Promise.all(calls)
            .then(([disbRes, statsRes, pendRes]) => {
                setDisbursements(disbRes.data?.data ?? []);
                setStats(statsRes.data?.data ?? {});
                if (pendRes) setPendingRequests(pendRes.data?.data ?? []);
            })
            .catch(() => error('Failed to load disbursements.'))
            .finally(() => setLoading(false));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const pendingIncomplete = pendingRequests.filter(r => !r.disbursement_complete);
    const disbursedTotal    = disbursements.reduce((s, d) => s + parseFloat(d.amount ?? 0), 0);

    const TABS = [
        ...(canDisburse ? [{ key: 'pending',   label: 'Pending Disbursement', count: pendingIncomplete.length, amber: true }] : []),
        { key: 'disbursed', label: 'Disbursed', count: disbursements.length, amber: false },
    ];

    return (
        <AppLayout breadcrumb="Disbursements">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Disbursements</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {canDisburse ? 'Manage fund disbursements for approved budget requests' : 'Track fund disbursements for your proposals'}
                        </p>
                    </div>
                    <ViewToggle view={view} onChange={setView} />
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Total Disbursed"   value={formatCurrency(stats.total_disbursed)}    sub="All time"                                                       color="bg-blue-600"    icon={TrendingUp}    />
                        <StatCard label="This Month"        value={formatCurrency(stats.this_month)}         sub={new Date().toLocaleString('en-GB', { month:'long', year:'numeric' })} color="bg-teal-600" icon={CreditCard}    />
                        <StatCard label="Pending Requests"  value={stats.pending_count ?? 0}                 sub="Approved, awaiting disbursement"                               color="bg-amber-500"   icon={Clock}         />
                        <StatCard label="Transactions"      value={stats.disbursement_count ?? 0}            sub="Total disbursements made"                                      color="bg-indigo-600"  icon={CheckCircle2}  />
                    </div>
                )}

                {/* Main card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        {TABS.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.key
                                        ? 'border-blue-600 text-blue-700 bg-blue-50/40'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                        activeTab === tab.key
                                            ? (tab.amber ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>{tab.count}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="p-5">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            </div>

                        ) : activeTab === 'pending' && canDisburse ? (
                            pendingIncomplete.length === 0 ? (
                                <div className="text-center py-12">
                                    <CheckCircle2 size={36} className="mx-auto text-green-400 mb-3" />
                                    <p className="text-gray-600 font-medium">All caught up!</p>
                                    <p className="text-sm text-gray-400 mt-1">No approved budget requests awaiting disbursement.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingIncomplete.map(req => (
                                        <PendingCard key={req.id} request={req}
                                            onDisburse={() => setDisburseTarget(req)} />
                                    ))}
                                </div>
                            )

                        ) : disbursements.length === 0 ? (
                            <div className="text-center py-12">
                                <CreditCard size={36} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-600 font-medium">No disbursements yet</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {isFinance ? 'Approved budget requests will appear in the Pending tab.' : 'Disbursements for your proposals will appear here.'}
                                </p>
                            </div>

                        ) : view === 'card' ? (
                            <div className="space-y-3">
                                <p className="text-xs text-gray-400">
                                    {disbursements.length} disbursement{disbursements.length !== 1 ? 's' : ''} · Total: <strong className="text-gray-700">{formatCurrency(disbursedTotal)}</strong>
                                </p>
                                {disbursements.map(d => <DisbursementCard key={d.id} disbursement={d} />)}
                            </div>

                        ) : (
                            /* Table view */
                            <>
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-gray-200">
                                            <tr>
                                                {['#', 'Proposal', 'Round', 'Amount', 'Transaction', 'Disbursed By', 'Date'].map(h => (
                                                    <th key={h} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {disbursements.map((d, i) => (
                                                <tr key={d.id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-3 text-xs font-medium text-gray-400 tabular-nums w-10">{i + 1}</td>
                                                    <td className="px-3 py-3">
                                                        <p className="font-mono text-xs font-bold text-blue-600">{d.budget_request?.proposal?.tracker_number}</p>
                                                        <p className="text-xs text-gray-500 truncate max-w-48">{d.budget_request?.proposal?.title}</p>
                                                    </td>
                                                    <td className="px-3 py-3 text-xs font-bold text-gray-700">Round {d.budget_request?.funding_round}</td>
                                                    <td className="px-3 py-3 text-sm font-bold text-teal-700">{formatCurrency(d.amount)}</td>
                                                    <td className="px-3 py-3 text-xs">
                                                        {d.transaction_id
                                                            ? <code className="bg-gray-100 px-1.5 py-0.5 rounded">{d.transaction_id}</code>
                                                            : d.cheque_number
                                                            ? <code className="bg-gray-100 px-1.5 py-0.5 rounded">CHQ: {d.cheque_number}</code>
                                                            : <span className="text-gray-400">—</span>}
                                                    </td>
                                                    <td className="px-3 py-3 text-xs text-gray-700">{d.disbursed_by?.name ?? '—'}</td>
                                                    <td className="px-3 py-3 text-xs text-gray-500">{d.disbursed_at ? formatDate(d.disbursed_at) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="border-t border-gray-200 bg-gray-50">
                                            <tr>
                                                <td className="px-3 py-2.5 text-sm font-semibold text-gray-700" colSpan={3}>
                                                    {disbursements.length} disbursement{disbursements.length !== 1 ? 's' : ''}
                                                </td>
                                                <td className="px-3 py-2.5 text-sm font-bold text-blue-700">{formatCurrency(disbursedTotal)}</td>
                                                <td colSpan={3} />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Mobile: fall back to the same cards used by card view */}
                                <div className="sm:hidden space-y-3">
                                    <p className="text-xs text-gray-400">
                                        {disbursements.length} disbursement{disbursements.length !== 1 ? 's' : ''} · Total: <strong className="text-gray-700">{formatCurrency(disbursedTotal)}</strong>
                                    </p>
                                    {disbursements.map(d => <DisbursementCard key={d.id} disbursement={d} />)}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {disburseTarget && (
                <DisburseModal
                    request={disburseTarget}
                    onClose={() => setDisburseTarget(null)}
                    onSuccess={() => {
                        setDisburseTarget(null);
                        success(`Funds disbursed successfully.`);
                        load();
                    }}
                />
            )}
        </AppLayout>
    );
}
