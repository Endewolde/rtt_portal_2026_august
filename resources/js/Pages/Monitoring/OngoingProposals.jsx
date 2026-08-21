import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    TrendingUp, RefreshCw, Search, ChevronLeft, ChevronRight, ExternalLink,
    ArrowUp, ArrowDown, ArrowUpDown, Building2, Wallet, Download, AlertTriangle, Archive,
    Gavel, X, ArrowLeft,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import AppLayout from '../../Layouts/AppLayout';
import FilterBar from '../../Components/FilterBar';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { get, post } from '../../lib/api';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';

const CATEGORY_OPTIONS = ['research', 'community_engagement', 'technology_transfer'];
const CATEGORY_COLORS = { research: '#6366f1', community_engagement: '#ec4899', technology_transfer: '#14b8a6' };

const MIDTERM_LABELS = {
    scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
    report_submitted: { label: 'Report Submitted', cls: 'bg-amber-100 text-amber-700' },
    scored: { label: 'Scored', cls: 'bg-purple-100 text-purple-700' },
    completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
};

function MidtermBadge({ status }) {
    if (!status) {
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Not Scheduled</span>;
    }
    const meta = MIDTERM_LABELS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>;
}

const WORKSHOP_LABELS = {
    scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
    postponed: { label: 'Postponed', cls: 'bg-amber-100 text-amber-700' },
};

// The completion workshop only happens once the midterm is scored with
// recommendation=continue — there's no separate proposal status for it, so
// "needsWorkshop" is what tells us whether "no status yet" means "not due yet"
// or "overdue to schedule."
function WorkshopBadge({ status, needsWorkshop }) {
    if (!status) {
        return needsWorkshop
            ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Needs Scheduling</span>
            : <span className="text-xs text-gray-400">—</span>;
    }
    const meta = WORKSHOP_LABELS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>;
}

const CONTRACT_LABELS = {
    approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

function ContractBadge({ status }) {
    if (!status) {
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Not Submitted</span>;
    }
    const meta = CONTRACT_LABELS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>;
}

function UtilizationBar({ allocated, utilized }) {
    const pct = allocated > 0 ? Math.min(100, Math.round((utilized / allocated) * 100)) : 0;
    return (
        <div className="min-w-24">
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span>{pct}%</span>
                <span className="text-gray-400">{formatCurrency(allocated)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─── Hover detail card ──────────────────────────────────────────────────────────

function HoverDetailCard({ info }) {
    if (!info) return null;
    const { p, x, y } = info;
    const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300);

    return (
        <div className="fixed z-50 w-72 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-4 pointer-events-none" style={{ left, top: y }}>
            <p className="font-semibold text-white leading-snug mb-2 line-clamp-3">{p.title || 'Untitled'}</p>
            <div className="space-y-1 text-gray-300">
                <p><span className="text-gray-500">Tracker:</span> {p.tracker_number ?? '—'}</p>
                <p><span className="text-gray-500">PI:</span> {p.pi?.name ?? '—'}</p>
                <p><span className="text-gray-500">College:</span> {p.college?.name ?? '—'}</p>
                <p><span className="text-gray-500">Category:</span> {getCategoryLabel(p.category)}</p>
                <p><span className="text-gray-500">Funded:</span> {p.funded_at ? formatDate(p.funded_at) : '—'}</p>
                <p><span className="text-gray-500">Research Outputs:</span> {p.outputs_count ?? 0}</p>
                <p><span className="text-gray-500">Contract:</span> {p.contract_status ? p.contract_status.charAt(0).toUpperCase() + p.contract_status.slice(1) : 'Not Submitted'}</p>
            </div>
        </div>
    );
}

// ─── Grant legacy proposal (super_admin override) ──────────────────────────────
//
// For proposals that were actually funded outside — or before — this system's
// normal submit/review/award workflow (legacy data, or a status that never
// reflected reality). This bypasses that workflow entirely, so it's kept as a
// deliberately narrow, two-step flow: pick the proposal, then justify + record it.

function GrantLegacyModal({ onClose, onGranted }) {
    const toast = useToast();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState(null);
    const [justification, setJustification] = useState('');
    const [awardedAmount, setAwardedAmount] = useState('');
    const [grantReference, setGrantReference] = useState('');
    const [approvedAt, setApprovedAt] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (selected) return;
        setSearching(true);
        const t = setTimeout(() => {
            get('/ongoing-proposals/grantable', { q: query || undefined })
                .then(r => setResults(r.data ?? []))
                .catch(() => {})
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(t);
    }, [query, selected]);

    const submit = async () => {
        if (!selected) return;
        setSubmitting(true);
        try {
            await post(`/ongoing-proposals/${selected.id}/grant-legacy`, {
                justification,
                awarded_amount: awardedAmount,
                grant_reference: grantReference || undefined,
                approved_at: approvedAt || undefined,
            });
            toast.success(`${selected.tracker_number} granted — now tracked as ongoing.`);
            onGranted();
            onClose();
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Could not grant this proposal.');
        }
        setSubmitting(false);
    };

    const canSubmit = justification.trim().length >= 10 && awardedAmount !== '' && Number(awardedAmount) >= 0;

    return createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                <div className="bg-linear-to-r from-slate-900 to-emerald-950 px-6 py-5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <Gavel size={18} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Grant Legacy Proposal</h2>
                                <p className="text-xs text-slate-300 mt-0.5">Administrative override — bypasses the normal review workflow</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
                            <X size={16} className="text-white" />
                        </button>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-4 overflow-y-auto">
                    {!selected ? (
                        <>
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search tracker # or title…"
                                    className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                />
                            </div>
                            <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
                                {searching && (
                                    <p className="px-4 py-6 text-center text-xs text-gray-400">Searching…</p>
                                )}
                                {!searching && results.length === 0 && (
                                    <p className="px-4 py-6 text-center text-xs text-gray-400">
                                        No eligible proposals found. Only proposals not already funded, ongoing, or archived — and without an existing award — show up here.
                                    </p>
                                )}
                                {!searching && results.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelected(p)}
                                        className="w-full text-left px-4 py-3 hover:bg-emerald-50/60 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{p.tracker_number}</span>
                                            <span className="text-[11px] text-gray-400">{p.status}</span>
                                        </div>
                                        <p className="text-sm text-gray-800 mt-1 line-clamp-1">{p.title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{p.pi?.name ?? '—'} · {p.college?.name ?? '—'}</p>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700">
                                <ArrowLeft size={12} /> Choose a different proposal
                            </button>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{selected.tracker_number}</span>
                                    <span className="text-[11px] text-gray-400">currently {selected.status}</span>
                                </div>
                                <p className="text-sm text-gray-800 mt-1">{selected.title}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-600">Justification <span className="text-red-500">*</span></label>
                                <textarea
                                    value={justification}
                                    onChange={e => setJustification(e.target.value)}
                                    rows={3}
                                    placeholder="Why is this proposal being granted outside the normal workflow? (min 10 characters — recorded in the audit trail)"
                                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-600">Awarded Amount (ETB) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        value={awardedAmount}
                                        onChange={e => setAwardedAmount(e.target.value)}
                                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600">Grant Date</label>
                                    <input
                                        type="date"
                                        value={approvedAt}
                                        onChange={e => setApprovedAt(e.target.value)}
                                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-600">Grant Reference <span className="text-gray-400 font-normal">(optional — auto-generated if left blank)</span></label>
                                <input
                                    value={grantReference}
                                    onChange={e => setGrantReference(e.target.value)}
                                    placeholder="e.g. an official pre-existing grant number"
                                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                />
                            </div>

                            <button
                                onClick={submit}
                                disabled={!canSubmit || submitting}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Granting…' : 'Grant Proposal'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Sortable header ─────────────────────────────────────────────────────────

const SORT_COLUMNS = [
    { key: 'tracker', label: 'Proposal' },
    { key: 'pi', label: 'PI' },
    { key: 'college', label: 'College' },
    { key: 'funded_at', label: 'Funded' },
];

function SortableHeader({ column, sortKey, sortDir, onSort }) {
    const active = sortKey === column.key;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
            <button onClick={() => onSort(column.key)} className={`flex items-center gap-1 transition-colors ${active ? 'text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                {column.label}
                <Icon size={11} className={active ? 'opacity-100' : 'opacity-40'} />
            </button>
        </th>
    );
}

// Single source of truth for "what's the one thing blocking this proposal right
// now" — ordered roughly by how blocking each gap is. Shared by the desktop
// table and mobile cards so the two can never show different actions.
function primaryAction(p) {
    if (p.needs_contract) return { type: 'link', href: '/admin/awarded', label: 'Review Contract', cls: 'text-red-700 hover:text-red-900' };
    if (p.needs_midterm) return { type: 'link', href: '/midterm-evaluations', label: 'Schedule Midterm', cls: 'text-amber-700 hover:text-amber-900' };
    if (p.needs_completion_workshop) return { type: 'link', href: '/completion-workshops', label: 'Schedule Workshop', cls: 'text-purple-700 hover:text-purple-900' };
    if (p.needs_disbursement) return { type: 'link', href: '/disbursements', label: 'Process Disbursement', cls: 'text-blue-700 hover:text-blue-900' };
    if (p.needs_archiving) return { type: 'archive' };
    return { type: 'view' };
}

function ActionCell({ p, canArchive, onRequestArchive }) {
    const action = primaryAction(p);

    if (action.type === 'link') {
        return (
            <a href={action.href} className={`flex items-center gap-1 text-xs font-semibold ${action.cls}`}>
                {action.label} <ExternalLink size={11} />
            </a>
        );
    }
    if (action.type === 'archive') {
        return canArchive ? (
            <button onClick={() => onRequestArchive(p)} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                <Archive size={11} /> Archive
            </button>
        ) : (
            <span className="text-xs text-gray-400">Awaiting archive</span>
        );
    }
    return <a href={`/proposals/${p.id}`} className="text-xs font-semibold text-gray-500 hover:text-gray-700">View</a>;
}

function daysSince(date) {
    if (!date) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

// ─── Table ────────────────────────────────────────────────────────────────────

function OngoingTable({ proposals, loading, sortKey, sortDir, onSort, canArchive, onRequestArchive }) {
    const [hoverInfo, setHoverInfo] = useState(null);
    const showHover = (e, p) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverInfo({ p, x: rect.left, y: rect.bottom + 8 });
    };
    const hideHover = () => setHoverInfo(null);

    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="divide-y divide-gray-100">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="px-4 py-3.5 flex items-center gap-4">
                            {Array.from({ length: 6 }).map((_, j) => (
                                <div key={j} className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: `${12 + j * 4}%` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <TrendingUp size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium text-sm">No ongoing proposals match these filters.</p>
            </div>
        );
    }

    return (
        <>
            <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                {SORT_COLUMNS.map(col => (
                                    <SortableHeader key={col.key} column={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                                ))}
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Since Funded</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Midterm</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Completion Workshop</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contract</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {proposals.map((p, i) => (
                                <tr key={p.id} className={`transition-colors hover:bg-indigo-50/40 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                    <td className="px-4 py-3 max-w-xs">
                                        <a href={`/proposals/${p.id}`}
                                            onMouseEnter={e => showHover(e, p)}
                                            onMouseLeave={hideHover}
                                            className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                                            {p.tracker_number ?? '—'}
                                        </a>
                                        <p className="text-xs text-gray-600 line-clamp-1 mt-1">{p.title ?? 'Untitled'}</p>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 font-medium">{p.pi?.name ?? '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{p.college?.name ?? '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{p.funded_at ? formatDate(p.funded_at) : '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">{getCategoryLabel(p.category)}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs tabular-nums">
                                        {p.is_overdue ? (
                                            <span className="flex items-center gap-1 text-red-600 font-bold">
                                                <AlertTriangle size={11} /> {daysSince(p.funded_at)}
                                            </span>
                                        ) : (
                                            <span className="text-gray-600">{daysSince(p.funded_at) ?? '—'}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap"><MidtermBadge status={p.midterm_status} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap"><WorkshopBadge status={p.completion_workshop_status} needsWorkshop={p.needs_completion_workshop} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap"><ContractBadge status={p.contract_status} /></td>
                                    <td className="px-4 py-3"><UtilizationBar allocated={p.budget_allocated} utilized={p.budget_utilized} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <ActionCell p={p} canArchive={canArchive} onRequestArchive={onRequestArchive} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                    {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} on this page
                </div>
            </div>

            {/* Mobile: stacked cards */}
            <div className="sm:hidden space-y-3">
                {proposals.map(p => (
                    <div key={p.id} className={`bg-white border rounded-xl p-4 ${p.is_overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <a href={`/proposals/${p.id}`} className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded shrink-0">
                                {p.tracker_number ?? '—'}
                            </a>
                            <MidtermBadge status={p.midterm_status} />
                        </div>
                        <p className="font-medium text-gray-900 text-sm leading-snug mb-2.5">{p.title || 'Untitled'}</p>
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs mb-3">
                            <p><span className="text-gray-400">PI:</span> <span className="text-gray-600">{p.pi?.name ?? '—'}</span></p>
                            <p><span className="text-gray-400">College:</span> <span className="text-gray-600">{p.college?.name ?? '—'}</span></p>
                            <p><span className="text-gray-400">Category:</span> <span className="text-gray-600">{getCategoryLabel(p.category)}</span></p>
                            <p><span className="text-gray-400">Funded:</span> <span className="text-gray-600">{p.funded_at ? formatDate(p.funded_at) : '—'}</span></p>
                            <p className="flex items-center gap-1"><span className="text-gray-400">Workshop:</span> <WorkshopBadge status={p.completion_workshop_status} needsWorkshop={p.needs_completion_workshop} /></p>
                            <p className="flex items-center gap-1"><span className="text-gray-400">Contract:</span> <ContractBadge status={p.contract_status} /></p>
                        </div>
                        {p.is_overdue && (
                            <p className="flex items-center gap-1 text-xs font-bold text-red-600 mb-2">
                                <AlertTriangle size={11} /> Midterm overdue — {daysSince(p.funded_at)} days since funded
                            </p>
                        )}
                        <UtilizationBar allocated={p.budget_allocated} utilized={p.budget_utilized} />
                        {primaryAction(p).type !== 'view' && (
                            <div className="mt-3">
                                <ActionCell p={p} canArchive={canArchive} onRequestArchive={onRequestArchive} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <HoverDetailCard info={hoverInfo} />
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OngoingProposals() {
    const { hasRole, hasAnyRole } = useAuth();
    const toast = useToast();
    const isCollegeOfficer = hasRole('college_officer');
    const isCategoryOfficer = hasAnyRole(['research_officer', 'community_officer', 'technology_officer']);
    // Matches ARCHIVE_ROLES server-side — no plain 'admin', that's intentional.
    const canArchive = hasAnyRole(['super_admin', 'central_officer']);
    // Matches LEGACY_GRANT_ROLES server-side — tighter than canArchive, since this
    // bypasses the entire review workflow rather than closing out an already-vetted one.
    const canGrantLegacy = hasRole('super_admin');

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [archiveTarget, setArchiveTarget] = useState(null);
    const [archiving, setArchiving] = useState(false);
    const [grantModalOpen, setGrantModalOpen] = useState(false);
    const [data, setData] = useState(null);

    const [status, setStatus] = useState('');
    const [collegeFilter, setCollegeFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState('funded_at');
    const [sortDir, setSortDir] = useState('desc');

    const filterParams = {
        status: status || undefined,
        college_id: collegeFilter || undefined,
        category: categoryFilter || undefined,
        q: q || undefined,
        sort: sortKey,
        direction: sortDir,
    };

    const load = useCallback((opts = {}) => {
        opts.silent ? setRefreshing(true) : setLoading(true);
        return get('/ongoing-proposals', { ...filterParams, page })
            .then(r => setData(r.data ?? null))
            .catch(() => {})
            .finally(() => { setLoading(false); setRefreshing(false); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, collegeFilter, categoryFilter, q, sortKey, sortDir, page]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [status, collegeFilter, categoryFilter, q, sortKey, sortDir]);

    const handleSort = (key) => {
        if (key === sortKey) {
            setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const toggleStatus = (key) => setStatus(prev => (prev === key ? '' : key));

    const downloadExcel = async () => {
        setDownloading(true);
        try {
            const token = localStorage.getItem('rtt_token');
            const params = new URLSearchParams(
                Object.fromEntries(Object.entries(filterParams).filter(([, v]) => v))
            );
            const res = await fetch(`/api/v1/ongoing-proposals/export?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ongoing_proposals.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Export failed. Please try again.');
        }
        setDownloading(false);
    };

    const confirmArchive = async () => {
        if (!archiveTarget) return;
        setArchiving(true);
        try {
            await post(`/ongoing-proposals/${archiveTarget.id}/archive`);
            toast.success(`${archiveTarget.tracker_number} archived.`);
            setArchiveTarget(null);
            load({ silent: true });
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Could not archive this proposal.');
        }
        setArchiving(false);
    };

    const kpis = data?.kpis ?? {
        total_ongoing: 0, awaiting_midterm: 0, overdue_awaiting_midterm: 0, in_midterm: 0, awaiting_archive: 0,
        needs_contract: 0, needs_disbursement: 0, total_budget_allocated: 0, total_budget_utilized: 0,
    };
    const byCollege = data?.by_college ?? [];
    const byCategory = data?.by_category ?? {};
    const proposals = data?.proposals?.data ?? [];
    const pagination = data?.proposals ?? null;
    const colleges = data?.colleges ?? [];
    const activeFilterCount = [collegeFilter, categoryFilter, q].filter(Boolean).length;
    const utilizationPct = kpis.total_budget_allocated > 0
        ? Math.round((kpis.total_budget_utilized / kpis.total_budget_allocated) * 100)
        : 0;

    const categoryChartData = CATEGORY_OPTIONS
        .filter(c => byCategory[c])
        .map(c => ({ name: getCategoryLabel(c), value: byCategory[c], fill: CATEGORY_COLORS[c] }));

    return (
        <AppLayout breadcrumb="Ongoing Proposals">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="rounded-2xl bg-linear-to-r from-slate-900 via-emerald-950 to-slate-900 px-6 py-7 text-white">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                <TrendingUp size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Ongoing Proposals</h1>
                                <p className="text-sm text-slate-300 mt-0.5">
                                    Funded proposals still in progress — post-award monitoring in one place
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-start lg:self-auto">
                            {canGrantLegacy && (
                                <button
                                    onClick={() => setGrantModalOpen(true)}
                                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 transition-colors"
                                >
                                    <Gavel size={14} />
                                    Grant Legacy Proposal
                                </button>
                            )}
                            <button
                                onClick={() => load({ silent: true })}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 disabled:opacity-60 transition-colors"
                            >
                                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                {refreshing ? 'Refreshing…' : 'Refresh'}
                            </button>
                            <button
                                onClick={downloadExcel}
                                disabled={downloading || proposals.length === 0}
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Download size={14} className={downloading ? 'animate-bounce' : ''} />
                                {downloading ? 'Preparing…' : 'Download'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* KPI cards — tap/click narrows the status filter below */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                        { key: '', label: 'Total Ongoing', value: kpis.total_ongoing, color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
                        { key: 'awaiting_midterm', label: 'Awaiting Midterm', value: kpis.awaiting_midterm, color: '#b45309', bg: '#fffbeb', border: '#fde68a', overdue: kpis.overdue_awaiting_midterm },
                        { key: 'in_midterm', label: 'In Midterm', value: kpis.in_midterm, color: '#7e22ce', bg: '#faf5ff', border: '#e9d5ff' },
                        { key: 'awaiting_archive', label: 'Awaiting Archive', value: kpis.awaiting_archive, color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
                        { key: 'needs_contract', label: 'Contract Pending', value: kpis.needs_contract, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
                        { key: 'needs_disbursement', label: 'Needs Disbursement', value: kpis.needs_disbursement, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
                    ].map(card => {
                        const active = status === card.key && card.key !== '';
                        return (
                            <button
                                key={card.label}
                                onClick={() => card.key && toggleStatus(card.key)}
                                className={`text-left rounded-2xl border-2 p-4 transition-all duration-150 active:scale-95 touch-manipulation ${active ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm'} ${!card.key ? 'cursor-default' : 'cursor-pointer'}`}
                                style={{ borderColor: active ? card.border : '#e5e7eb', backgroundColor: active ? card.bg : '#ffffff' }}
                            >
                                <p className="text-2xl font-extrabold tabular-nums" style={{ color: card.color }}>{card.value}</p>
                                <p className="text-xs font-semibold text-gray-500 mt-0.5">{card.label}</p>
                                {!!card.overdue && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={e => { e.stopPropagation(); toggleStatus('overdue'); }}
                                        className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${status === 'overdue' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'}`}
                                    >
                                        <AlertTriangle size={9} /> {card.overdue} overdue
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Wallet size={14} className="text-emerald-600" />
                            <p className="text-xs font-semibold text-gray-500">Budget Utilized</p>
                        </div>
                        <p className="text-lg font-extrabold text-emerald-700">{formatCurrency(kpis.total_budget_utilized)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{utilizationPct}% of {formatCurrency(kpis.total_budget_allocated)}</p>
                    </div>
                </div>

                {/* Charts — omitted where they'd only ever show one meaningless bar/slice */}
                {(!isCollegeOfficer || !isCategoryOfficer) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {!isCollegeOfficer && byCollege.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                <p className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-1.5"><Building2 size={14} /> Ongoing by College</p>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={byCollege} margin={{ left: -20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                        {!isCategoryOfficer && categoryChartData.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                <p className="text-sm font-bold text-gray-800 mb-4">Ongoing by Category</p>
                                <div className="flex items-center gap-4">
                                    <ResponsiveContainer width="55%" height={200}>
                                        <PieChart>
                                            <Pie data={categoryChartData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                                                {categoryChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex-1 space-y-1.5 min-w-0">
                                        {categoryChartData.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: c.fill }} />
                                                    <span className="text-[11px] text-gray-600 truncate">{c.name}</span>
                                                </div>
                                                <span className="text-[11px] font-bold text-gray-800 shrink-0">{c.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Filters + table */}
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Search tracker #, title or PI…"
                                className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>

                        <FilterBar accent="indigo" activeCount={activeFilterCount}>
                            {!isCollegeOfficer && colleges.length > 1 && (
                                <select
                                    value={collegeFilter}
                                    onChange={e => setCollegeFilter(e.target.value)}
                                    className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                >
                                    <option value="">All Colleges</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            {!isCategoryOfficer && (
                                <select
                                    value={categoryFilter}
                                    onChange={e => setCategoryFilter(e.target.value)}
                                    className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                >
                                    <option value="">All Categories</option>
                                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                                </select>
                            )}
                        </FilterBar>
                    </div>

                    <OngoingTable
                        proposals={proposals}
                        loading={loading}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        canArchive={canArchive}
                        onRequestArchive={setArchiveTarget}
                    />

                    {pagination && pagination.last_page > 1 && (
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs text-gray-400">
                                Page {pagination.current_page} of {pagination.last_page} · {pagination.total} proposals
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={pagination.current_page <= 1}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={13} /> Prev
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                                    disabled={pagination.current_page >= pagination.last_page}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {archiveTarget && (
                <ConfirmDialog
                    open
                    title="Archive Proposal"
                    description={`Archive ${archiveTarget.tracker_number} — "${archiveTarget.title}"? This closes the proposal out permanently and it will no longer appear on this dashboard.`}
                    confirmLabel={archiving ? 'Archiving…' : 'Archive'}
                    onConfirm={confirmArchive}
                    onCancel={() => setArchiveTarget(null)}
                />
            )}

            {grantModalOpen && (
                <GrantLegacyModal
                    onClose={() => setGrantModalOpen(false)}
                    onGranted={() => load({ silent: true })}
                />
            )}
        </AppLayout>
    );
}
