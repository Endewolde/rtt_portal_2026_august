import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, usePage, router } from '@inertiajs/react';
import {
    ArrowLeft, Megaphone, CalendarDays, Clock, Search, Download, RefreshCw, Inbox, FileCheck2, Microscope,
    ClipboardList, BadgeDollarSign, XCircle, MoreHorizontal, Eye, Copy, CheckCircle2, RotateCcw, UserPlus,
    CalendarClock, Presentation, Award, ShieldQuestion, ShieldAlert, Building2, X, Users, FilePen,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import ConfirmDialog from '../../Components/ConfirmDialog';
import RejectWithReasonModal from '../../Components/RejectWithReasonModal';
import ReportMistakenApprovalModal from '../../Components/ReportMistakenApprovalModal';
import { get, post } from '../../lib/api';
import { formatDate, getCategoryLabel, getStatusLabel } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_ORDER = [
    'submitted', 'validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence',
    'accepted', 'funded', 'midterm_evaluation', 'completed', 'archived', 'rejected',
];

const STATUS_BAR = {
    submitted: 'bg-blue-500', validated: 'bg-indigo-500', under_blind_review: 'bg-yellow-400',
    blind_review_passed: 'bg-orange-400', under_open_defence: 'bg-purple-500', accepted: 'bg-sky-500',
    funded: 'bg-emerald-500', midterm_evaluation: 'bg-teal-500', completed: 'bg-cyan-500',
    archived: 'bg-slate-400', rejected: 'bg-red-500',
};

const IN_REVIEW = ['validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence'];
const FUNDED_ONWARD = ['funded', 'midterm_evaluation', 'completed', 'archived'];
const REVIEW_PROGRESS_STATUSES = ['under_blind_review', 'blind_review_passed', 'under_open_defence'];
const REPORTABLE = ['validated', 'under_blind_review', 'blind_review_passed'];

const CALL_STATUS = {
    active: { label: 'Open', cls: 'bg-emerald-100 text-emerald-700' },
    draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
    closed: { label: 'Closed', cls: 'bg-slate-200 text-slate-700' },
    expired: { label: 'Expired', cls: 'bg-amber-100 text-amber-700' },
};

const SORTS = {
    newest: { label: 'Newest first', fn: (a, b) => new Date(b.submitted_at ?? b.created_at) - new Date(a.submitted_at ?? a.created_at) },
    oldest: { label: 'Oldest first', fn: (a, b) => new Date(a.submitted_at ?? a.created_at) - new Date(b.submitted_at ?? b.created_at) },
    tracker: { label: 'Tracker number', fn: (a, b) => (a.tracker_number ?? '').localeCompare(b.tracker_number ?? '') },
    stage: { label: 'Workflow stage', fn: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) },
};

function daysInStage(p) {
    if (!p.status_entered_at) return null;
    return Math.floor((Date.now() - new Date(p.status_entered_at).getTime()) / 86400000);
}

function exportCsv(call, rows) {
    const header = ['Tracker', 'Title', 'PI', 'PI Email', 'College', 'Department', 'Category', 'Status', 'Submitted', 'Reviews Submitted', 'Reviews Assigned'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((p) => [
        p.tracker_number, p.title, p.pi?.name, p.pi?.email, p.college?.name, p.department?.name,
        getCategoryLabel(p.category), getStatusLabel(p.status), p.submitted_at ? formatDate(p.submitted_at) : '',
        p.reviews_submitted, p.reviews_total,
    ].map(escape).join(','));
    const blob = new Blob([[header.map(escape).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(call.title || 'call').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, tone, active, onClick }) {
    const tones = {
        blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600', amber: 'bg-amber-50 text-amber-600',
        sky: 'bg-sky-50 text-sky-600', emerald: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600',
    };
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-all hover:shadow-md ${
                active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'
            }`}
        >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
                <Icon size={18} />
            </span>
            <span className="min-w-0">
                <span className="block text-2xl font-bold leading-none text-gray-900 tabular-nums">{value}</span>
                <span className="mt-1 block truncate text-xs font-medium text-gray-500">{label}</span>
            </span>
        </button>
    );
}

function ActionsMenu({ items }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btn = useRef(null);
    const menu = useRef(null);

    const toggle = () => {
        if (!open && btn.current) {
            const r = btn.current.getBoundingClientRect();
            const menuHeight = items.length * 40 + 16;
            const top = r.bottom + menuHeight > window.innerHeight ? r.top - menuHeight - 4 : r.bottom + 4;
            setPos({ top, left: Math.max(8, r.right - 240) });
        }
        setOpen((o) => !o);
    };

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onScroll = () => setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [open]);

    return (
        <>
            <button
                ref={btn}
                onClick={toggle}
                aria-label="Actions"
                className={`rounded-lg p-1.5 transition-colors ${open ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
            >
                <MoreHorizontal size={18} />
            </button>
            {open && createPortal(
                <div
                    ref={menu}
                    style={{ top: pos.top, left: pos.left }}
                    className="fixed z-50 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                >
                    {items.map((item, i) => item.divider ? (
                        <div key={`d${i}`} className="my-1 border-t border-gray-100" />
                    ) : (
                        <button
                            key={item.label}
                            onClick={() => { setOpen(false); item.onClick(); }}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                item.danger ? 'text-red-600 hover:bg-red-50' : item.primary ? 'font-semibold text-blue-700 hover:bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <item.icon size={15} className="shrink-0" /> {item.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}

function ReturnForCorrectionModal({ proposal, onClose, onDone }) {
    const { success, error } = useToast();
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (reason.trim().length < 10) { error('Please explain what needs correcting (at least 10 characters).'); return; }
        setSaving(true);
        try {
            await post(`/proposals/${proposal.id}/validation/return`, { reason });
            success('Proposal returned to the PI for correction.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not return the proposal.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><RotateCcw size={18} /></span>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Return for Correction</h2>
                            <p className="text-xs text-gray-500"><span className="font-mono">{proposal.tracker_number}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="space-y-2 p-6">
                    <label className="block text-xs font-semibold text-gray-700">What should the PI correct? <span className="text-red-500">*</span></label>
                    <textarea
                        rows={4}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Be specific so the PI can fix it and resubmit…"
                        className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <p className="text-xs text-gray-400">The proposal goes back to draft and the PI is notified.</p>
                </div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving} className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                        {saving ? 'Returning…' : 'Return to PI'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalCallSubmissions() {
    const { url } = usePage();
    const callId = url.split('/')[2];
    const { hasAnyRole, hasPermission } = useAuth();
    const toast = useToast();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [collegeFilter, setCollegeFilter] = useState('');
    const [sort, setSort] = useState('newest');
    const [selected, setSelected] = useState(new Set());
    const [modal, setModal] = useState(null); // { type, proposal }
    const [bulkApproving, setBulkApproving] = useState(false);

    const canValidate = hasPermission('proposals.validate');
    const isCentral = hasAnyRole(['super_admin', 'admin', 'central_officer']);
    const isDirector = hasAnyRole(['research_officer', 'community_officer', 'technology_officer']);
    const isCollegeOfficer = hasAnyRole(['college_officer']);
    const canAssign = isCentral || isDirector || isCollegeOfficer;
    const canRejectBlindReview = isCentral || isDirector;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await get(`/proposal-calls/${callId}/submissions`);
            setData(res.data ?? null);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load the submissions for this call.');
        }
        setSelected(new Set());
        setLoading(false);
    }, [callId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const call = data?.call;
    const proposals = data?.proposals ?? [];
    const stats = data?.stats;

    const colleges = useMemo(
        () => [...new Map(proposals.filter((p) => p.college).map((p) => [p.college.id, p.college.name])).entries()]
            .sort((a, b) => a[1].localeCompare(b[1])),
        [proposals]
    );

    const statusCounts = useMemo(() => proposals.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {}), [proposals]);

    const matchesStatus = (p) => {
        if (!statusFilter) return true;
        if (statusFilter === 'in_review') return IN_REVIEW.includes(p.status);
        if (statusFilter === 'funded_onward') return FUNDED_ONWARD.includes(p.status);
        return p.status === statusFilter;
    };

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return proposals
            .filter(matchesStatus)
            .filter((p) => !collegeFilter || p.college?.id === collegeFilter)
            .filter((p) => !term || [p.title, p.tracker_number, p.pi?.name, p.pi?.email, p.college?.name, p.department?.name]
                .some((v) => v?.toLowerCase().includes(term)))
            .sort(SORTS[sort].fn);
    }, [proposals, search, statusFilter, collegeFilter, sort]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectable = canValidate ? visible.filter((p) => p.status === 'submitted') : [];
    const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));

    const toggleSelect = (id) => setSelected((s) => {
        const next = new Set(s);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((p) => p.id)));

    const bulkApprove = async () => {
        setModal(null);
        setBulkApproving(true);
        try {
            const res = await post('/proposals/validation/bulk-approve', { ids: [...selected] });
            toast.success(res?.message ?? `${selected.size} proposal(s) approved and moved to blind review.`);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Bulk approval failed.');
        }
        setBulkApproving(false);
    };

    const approveOne = async (proposal) => {
        setModal(null);
        try {
            await post(`/proposals/${proposal.id}/validation/approve`, {});
            toast.success(`${proposal.tracker_number} approved — ready for reviewer assignment.`);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Approval failed.');
        }
    };

    const actionsFor = (p) => {
        const items = [
            { label: 'View details', icon: Eye, primary: true, onClick: () => router.visit(`/proposals/${p.id}`) },
            {
                label: 'Copy tracker number', icon: Copy, onClick: () => {
                    navigator.clipboard?.writeText(p.tracker_number ?? '');
                    toast.success('Tracker number copied.');
                },
            },
        ];
        const stage = [];

        if (p.status === 'submitted' && canValidate) {
            stage.push(
                { label: 'Approve for review', icon: CheckCircle2, onClick: () => setModal({ type: 'approve', proposal: p }) },
                { label: 'Return for correction', icon: RotateCcw, onClick: () => setModal({ type: 'return', proposal: p }) },
                { label: 'Reject', icon: XCircle, danger: true, onClick: () => setModal({ type: 'reject', proposal: p }) },
            );
        }
        if (p.status === 'validated' && canAssign) {
            stage.push({ label: 'Assign reviewers', icon: UserPlus, onClick: () => router.visit(`/proposals/${p.id}/assign-reviewers`) });
        }
        if (p.status === 'under_blind_review' && canRejectBlindReview) {
            stage.push({ label: 'Reject from blind review', icon: XCircle, danger: true, onClick: () => setModal({ type: 'reject_blind_review', proposal: p }) });
        }
        if (p.status === 'blind_review_passed' && canAssign) {
            stage.push({ label: 'Schedule open defence', icon: CalendarClock, onClick: () => router.visit(`/proposals/${p.id}/defence`) });
        }
        if (p.status === 'under_open_defence' && canAssign) {
            stage.push({ label: 'Manage open defence', icon: Presentation, onClick: () => router.visit('/admin/open-defence') });
        }
        if (p.status === 'accepted' && (isCentral || isDirector)) {
            stage.push({ label: 'Go to Central Evaluation', icon: ClipboardList, onClick: () => router.visit('/admin/central-evaluation') });
        }
        if (p.status === 'accepted' && isCentral) {
            stage.push({ label: 'Generate award', icon: Award, onClick: () => router.visit(`/proposals/${p.id}/award`) });
        }
        if (FUNDED_ONWARD.includes(p.status) && (isCentral || isDirector)) {
            stage.push({ label: 'Open in Funding', icon: BadgeDollarSign, onClick: () => router.visit('/admin/funding') });
        }
        if (REPORTABLE.includes(p.status) && isCollegeOfficer) {
            stage.push({ label: 'Report mistaken approval', icon: ShieldQuestion, danger: true, onClick: () => setModal({ type: 'report', proposal: p }) });
        }

        return stage.length ? [...items, { divider: true }, ...stage] : items;
    };

    // ── Loading / missing ──
    if (loading && !data) {
        return (
            <AppLayout breadcrumb="Proposal Calls / Submissions">
                <div className="mx-auto max-w-7xl space-y-5 animate-pulse">
                    <div className="h-36 rounded-2xl bg-gray-100" />
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
                    </div>
                    <div className="h-96 rounded-2xl bg-gray-100" />
                </div>
            </AppLayout>
        );
    }

    if (!call) {
        return (
            <AppLayout breadcrumb="Proposal Calls / Submissions">
                <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center">
                    <Inbox size={32} className="mx-auto text-gray-300" />
                    <p className="mt-3 text-sm text-gray-600">This call could not be loaded.</p>
                    <Link href="/proposal-calls" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
                        <ArrowLeft size={14} /> Back to Proposal Calls
                    </Link>
                </div>
            </AppLayout>
        );
    }

    const callStatus = CALL_STATUS[call.status] ?? CALL_STATUS.draft;
    const closesIn = call.countdown_seconds > 0 ? Math.ceil(call.countdown_seconds / 86400) : null;
    const total = stats.submitted;
    const statCards = [
        { key: '', label: 'Submitted', value: total, icon: Inbox, tone: 'blue' },
        { key: 'submitted', label: 'Awaiting validation', value: statusCounts.submitted ?? 0, icon: FileCheck2, tone: 'indigo' },
        { key: 'in_review', label: 'In review', value: IN_REVIEW.reduce((s, k) => s + (statusCounts[k] ?? 0), 0), icon: Microscope, tone: 'amber' },
        { key: 'accepted', label: 'Central Evaluation', value: statusCounts.accepted ?? 0, icon: ClipboardList, tone: 'sky' },
        { key: 'funded_onward', label: 'Funded', value: FUNDED_ONWARD.reduce((s, k) => s + (statusCounts[k] ?? 0), 0), icon: BadgeDollarSign, tone: 'emerald' },
        { key: 'rejected', label: 'Rejected', value: statusCounts.rejected ?? 0, icon: XCircle, tone: 'red' },
    ];

    return (
        <AppLayout breadcrumb={`Proposal Calls / ${call.title}`}>
            <div className="mx-auto max-w-7xl space-y-5">

                {/* ── Call header ── */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500" />
                    <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
                                <Megaphone size={22} />
                            </span>
                            <div className="min-w-0">
                                <Link href="/proposal-calls" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-blue-600">
                                    <ArrowLeft size={12} /> Proposal Calls
                                </Link>
                                <h1 className="text-xl font-bold leading-snug text-gray-900">{call.title}</h1>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${callStatus.cls}`}>{callStatus.label}</span>
                                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600">{getCategoryLabel(call.category)}</span>
                                    {call.academic_year && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600">{call.academic_year}</span>}
                                    <span className="inline-flex items-center gap-1 text-gray-500">
                                        <CalendarDays size={12} /> {call.start_date_formatted ?? formatDate(call.start_date)} → {call.end_date_formatted ?? formatDate(call.end_date)}
                                    </span>
                                    {closesIn && (
                                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                                            <Clock size={12} /> Closes in {closesIn} day{closesIn > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                                <FilePen size={13} /> {stats.drafts} draft{stats.drafts === 1 ? '' : 's'} in progress
                            </span>
                            <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                            </button>
                            <button
                                onClick={() => exportCsv(call, visible)}
                                disabled={visible.length === 0}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
                            >
                                <Download size={14} /> Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Status breakdown bar */}
                    {total > 0 && (
                        <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
                            <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                                {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
                                    <div
                                        key={s}
                                        className={STATUS_BAR[s]}
                                        style={{ width: `${(statusCounts[s] / total) * 100}%` }}
                                        title={`${getStatusLabel(s)}: ${statusCounts[s]}`}
                                    />
                                ))}
                            </div>
                            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                                {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                                        className={`inline-flex items-center gap-1.5 text-xs transition-colors ${statusFilter === s ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                                    >
                                        <span className={`h-2 w-2 rounded-full ${STATUS_BAR[s]}`} />
                                        {getStatusLabel(s)} <span className="tabular-nums text-gray-400">{statusCounts[s]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {statCards.map((c) => (
                        <StatCard key={c.label} {...c} active={statusFilter === c.key && c.key !== ''} onClick={() => setStatusFilter(statusFilter === c.key ? '' : c.key)} />
                    ))}
                </div>

                {/* ── Toolbar ── */}
                <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center rounded-xl border border-gray-200 px-3 focus-within:ring-2 focus-within:ring-blue-400">
                        <Search size={15} className="shrink-0 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search title, tracker, PI, college…"
                            className="w-full bg-transparent px-2.5 py-2.5 text-sm outline-none placeholder:text-gray-400"
                        />
                        {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={collegeFilter}
                            onChange={(e) => setCollegeFilter(e.target.value)}
                            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            <option value="">All colleges</option>
                            {colleges.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                        </select>
                        {(statusFilter || collegeFilter || search) && (
                            <button
                                onClick={() => { setStatusFilter(''); setCollegeFilter(''); setSearch(''); }}
                                className="rounded-xl px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Bulk bar ── */}
                {selected.size > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                        <span className="text-sm font-medium text-blue-900">{selected.size} proposal{selected.size > 1 ? 's' : ''} selected</span>
                        <div className="flex gap-2">
                            <button onClick={() => setSelected(new Set())} className="rounded-xl px-3 py-2 text-sm text-blue-700 hover:bg-blue-100">Clear</button>
                            <button
                                onClick={() => setModal({ type: 'bulk_approve' })}
                                disabled={bulkApproving}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                                <CheckCircle2 size={15} /> {bulkApproving ? 'Approving…' : 'Approve selected'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── List ── */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                        <p className="text-sm font-semibold text-gray-800">
                            {visible.length} of {total} submission{total === 1 ? '' : 's'}
                        </p>
                        {selectable.length > 0 && (
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
                                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                                Select all awaiting validation
                            </label>
                        )}
                    </div>

                    {visible.length === 0 ? (
                        <div className="py-16 text-center">
                            <Inbox size={32} className="mx-auto text-gray-300" />
                            <p className="mt-3 text-sm font-medium text-gray-700">{total === 0 ? 'No proposals have been submitted to this call yet.' : 'No submissions match your filters.'}</p>
                            {total === 0 && stats.drafts > 0 && (
                                <p className="mt-1 text-xs text-gray-400">{stats.drafts} draft{stats.drafts > 1 ? 's are' : ' is'} still being prepared.</p>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden overflow-x-auto lg:block">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            {canValidate && <th className="w-10 px-4 py-3" />}
                                            <th className="px-4 py-3">Proposal</th>
                                            <th className="px-4 py-3">Principal Investigator</th>
                                            <th className="px-4 py-3">College</th>
                                            <th className="px-4 py-3">Submitted</th>
                                            <th className="px-4 py-3">Stage</th>
                                            <th className="px-4 py-3">Reviews</th>
                                            <th className="w-12 px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {visible.map((p) => {
                                            const days = daysInStage(p);
                                            return (
                                                <tr key={p.id} className={`transition-colors hover:bg-gray-50/70 ${selected.has(p.id) ? 'bg-blue-50/40' : ''}`}>
                                                    {canValidate && (
                                                        <td className="px-4 py-3">
                                                            {p.status === 'submitted' && (
                                                                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="max-w-md px-4 py-3">
                                                        <Link href={`/proposals/${p.id}`} className="group block">
                                                            <span className="font-mono text-xs font-semibold text-blue-600">{p.tracker_number}</span>
                                                            <span className="mt-0.5 block truncate font-medium text-gray-900 group-hover:text-blue-700">{p.title}</span>
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="block text-gray-800">{p.pi?.name ?? '—'}</span>
                                                        <span className="block text-xs text-gray-400">{p.pi?.email}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="block text-gray-700">{p.college?.name ?? '—'}</span>
                                                        <span className="block text-xs text-gray-400">{p.department?.name}</span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{p.submitted_at ? formatDate(p.submitted_at) : '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={p.status} />
                                                        {p.anonymity_status === 'issues' && ['submitted', 'validated', 'under_blind_review'].includes(p.status) && (
                                                            <span title="The anonymity check found identifying details" className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                                                <ShieldAlert size={10} /> Identity found
                                                            </span>
                                                        )}
                                                        {days !== null && <span className="mt-1 block text-[11px] text-gray-400">{days === 0 ? 'today' : `${days}d in stage`}</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {REVIEW_PROGRESS_STATUSES.includes(p.status) && p.reviews_total > 0 ? (
                                                            <span className="block w-24">
                                                                <span className="text-xs font-semibold tabular-nums text-gray-700">{p.reviews_submitted}/{p.reviews_total}</span>
                                                                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                                                                    <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(p.reviews_submitted / p.reviews_total) * 100}%` }} />
                                                                </span>
                                                            </span>
                                                        ) : <span className="text-xs text-gray-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right"><ActionsMenu items={actionsFor(p)} /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile / tablet cards */}
                            <ul className="divide-y divide-gray-100 lg:hidden">
                                {visible.map((p) => (
                                    <li key={p.id} className="flex items-start gap-3 px-4 py-4">
                                        {canValidate && p.status === 'submitted' && (
                                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-blue-600">{p.tracker_number}</span>
                                                <StatusBadge status={p.status} />
                                            </div>
                                            <Link href={`/proposals/${p.id}`} className="mt-1 block font-medium text-gray-900 hover:text-blue-700">{p.title}</Link>
                                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                                <span className="inline-flex items-center gap-1"><Users size={11} /> {p.pi?.name ?? '—'}</span>
                                                <span className="inline-flex items-center gap-1"><Building2 size={11} /> {p.college?.name ?? '—'}</span>
                                                {p.submitted_at && <span>{formatDate(p.submitted_at)}</span>}
                                            </p>
                                        </div>
                                        <ActionsMenu items={actionsFor(p)} />
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>

            {/* ── Modals ── */}
            <ConfirmDialog
                open={modal?.type === 'approve'}
                title="Approve this proposal?"
                description={`${modal?.proposal?.tracker_number ?? ''} will be validated and become ready for reviewer assignment.`}
                confirmLabel="Approve"
                onConfirm={() => approveOne(modal.proposal)}
                onCancel={() => setModal(null)}
            />
            <ConfirmDialog
                open={modal?.type === 'bulk_approve'}
                title={`Approve ${selected.size} proposal${selected.size > 1 ? 's' : ''}?`}
                description={(() => {
                    const flagged = proposals.filter((p) => selected.has(p.id) && p.anonymity_status === 'issues').length;
                    return flagged > 0
                        ? `They will be validated and become ready for reviewer assignment. Warning: ${flagged} of them failed the anonymity check — reviewers may be able to identify the authors.`
                        : 'They will be validated and become ready for reviewer assignment.';
                })()}
                confirmLabel="Approve all"
                onConfirm={bulkApprove}
                onCancel={() => setModal(null)}
            />
            {modal?.type === 'return' && (
                <ReturnForCorrectionModal proposal={modal.proposal} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
            )}
            {(modal?.type === 'reject' || modal?.type === 'reject_blind_review') && (
                <RejectWithReasonModal
                    context={modal.type === 'reject' ? 'proposal_validation' : 'blind_review'}
                    title={modal.type === 'reject' ? 'Reject Proposal' : 'Reject From Blind Review'}
                    subtitle={`${modal.proposal.tracker_number ?? ''} · ${modal.proposal.title ?? ''}`}
                    note="The PI and co-investigators are notified with this reason."
                    confirmLabel="Reject Proposal"
                    onClose={() => setModal(null)}
                    onSubmit={async (payload) => {
                        const target = modal.type === 'reject' ? 'validation/reject' : 'blind-review/reject';
                        await post(`/proposals/${modal.proposal.id}/${target}`, payload);
                        toast.error(`${modal.proposal.tracker_number} has been rejected.`);
                        setModal(null);
                        load();
                    }}
                />
            )}
            {modal?.type === 'report' && (
                <ReportMistakenApprovalModal
                    proposal={modal.proposal}
                    onClose={() => setModal(null)}
                    onReported={() => { setModal(null); load(); }}
                />
            )}
        </AppLayout>
    );
}
