import { useState, useEffect, useMemo } from 'react';
import {
    Users, Download, Filter, Search, X, RefreshCw,
    Building2, ClipboardList, EyeOff, Presentation,
    ChevronDown, ChevronRight, FileDown, BarChart2,
    Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Minus, FileText, AlertTriangle,
    Wallet, FileSpreadsheet,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { useToast } from '../../Components/Toast';

// ─── CSV download helper ───────────────────────────────────────────────────────

function downloadCsv(filename, rows, headers) {
    const escape = (v) => {
        if (v == null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    };
    const lines = [
        headers.map(escape).join(','),
        ...rows.map(r => r.map(escape).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={22} className="text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
                {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-purple-100 text-purple-700',
    submitted:   'bg-emerald-100 text-emerald-700',
    declined:    'bg-red-100 text-red-700',
};

function AssignmentBadge({ status }) {
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
            {status?.replace('_', ' ')}
        </span>
    );
}

// ─── Reviewer type helpers ─────────────────────────────────────────────────────

function isExternalReviewer(reviewer) {
    return reviewer?.roles?.some(r => (typeof r === 'string' ? r : r.name) === 'external_reviewer') ?? false;
}

function ReviewerTypeBadge({ reviewer }) {
    if (!isExternalReviewer(reviewer)) { return null; }
    return (
        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
            External
        </span>
    );
}

// ─── Eval type badge ──────────────────────────────────────────────────────────

function EvalBadge({ name, label }) {
    const isBlind = name?.startsWith('blind');
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            isBlind ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
        }`}>
            {isBlind ? <EyeOff size={10} /> : <Presentation size={10} />}
            {label ?? name}
        </span>
    );
}

// ─── Summary row (per proposal) ───────────────────────────────────────────────

function ProposalRow({ proposal, rowNum }) {
    const [open, setOpen] = useState(false);
    const assignments = proposal.assignments ?? [];

    return (
        <>
            <tr
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setOpen(o => !o)}
            >
                <td className="px-5 py-3.5 text-xs font-medium text-gray-400 tabular-nums w-10">{rowNum}</td>
                <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                        <span className={`p-0.5 transition-transform text-gray-400 ${open ? 'rotate-90' : ''}`}>
                            <ChevronRight size={14} />
                        </span>
                        <span className="font-mono text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                            {proposal.tracker_number}
                        </span>
                    </div>
                </td>
                <td className="px-5 py-3.5 max-w-xs">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{proposal.title}</p>
                </td>
                <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Building2 size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{proposal.college_name ?? '—'}</span>
                    </div>
                </td>
                <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold ${
                        proposal.blind_count > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                        <EyeOff size={12} /> {proposal.blind_count}
                    </span>
                </td>
                <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold ${
                        proposal.open_count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                        <Presentation size={12} /> {proposal.open_count}
                    </span>
                </td>
                <td className="px-5 py-3.5 text-center">
                    <span className="text-sm font-semibold text-gray-700">{assignments.length}</span>
                </td>
            </tr>
            {open && assignments.map(a => (
                <tr key={a.id} className="bg-indigo-50/40 border-l-2 border-indigo-300">
                    <td className="px-5 py-2.5 pl-12" />
                    <td className="px-5 py-2.5">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-800">{a.reviewer?.name ?? '—'}</p>
                            <ReviewerTypeBadge reviewer={a.reviewer} />
                        </div>
                        <p className="text-xs text-gray-400">{a.reviewer?.email}</p>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-gray-500">{proposal.college_name}</td>
                    <td className="px-5 py-2.5" colSpan={2}>
                        <EvalBadge name={a.evaluationType?.name} label={a.evaluationType?.label} />
                    </td>
                    <td className="px-5 py-2.5">
                        <AssignmentBadge status={a.status} />
                    </td>
                </tr>
            ))}
        </>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewerWorkload() {
    const { error } = useToast();
    const [assignments, setAssignments] = useState([]);
    const [colleges, setColleges]       = useState([]);
    const [loading, setLoading]         = useState(true);
    const [filterCollege, setFilterCollege] = useState('');
    const [filterEvalType, setFilterEvalType] = useState('all'); // 'all' | 'blind' | 'open'
    const [filterReviewerType, setFilterReviewerType] = useState('all'); // 'all' | 'internal' | 'external'
    const [search, setSearch]           = useState('');
    const [tab, setTab]                 = useState('summary'); // 'summary' | 'all' | 'analytics'
    const [analytics, setAnalytics]     = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [paymentYear, setPaymentYear] = useState('');
    const [paymentDownloading, setPaymentDownloading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [aRes, cRes] = await Promise.all([
                api.get('/admin/reviewer-workload', {
                    params: filterCollege ? { college_id: filterCollege } : {},
                }),
                api.get('/colleges'),
            ]);
            setAssignments(aRes.data?.data ?? []);
            setColleges(cRes.data?.data ?? []);
        } catch {
            error('Failed to load reviewer workload.');
        }
        setLoading(false);
    };

    const loadAnalytics = async () => {
        if (analytics && !filterCollege) { return; }
        setAnalyticsLoading(true);
        try {
            const res = await api.get('/admin/reviewer-analytics', {
                params: filterCollege ? { college_id: filterCollege } : {},
            });
            setAnalytics(res.data?.data ?? null);
        } catch {
            error('Failed to load reviewer analytics.');
        }
        setAnalyticsLoading(false);
    };

    useEffect(() => { load(); }, [filterCollege]);
    useEffect(() => { if (tab === 'analytics') { loadAnalytics(); } }, [tab, filterCollege]);

    // ── Derived data ──────────────────────────────────────────────────────────

    const filteredAssignments = useMemo(() => {
        let list = assignments;
        if (filterEvalType === 'blind') {
            list = list.filter(a => a.evaluation_type?.name?.startsWith('blind'));
        } else if (filterEvalType === 'open') {
            list = list.filter(a => a.evaluation_type?.name?.startsWith('open'));
        }
        if (filterReviewerType === 'external') {
            list = list.filter(a => isExternalReviewer(a.reviewer));
        } else if (filterReviewerType === 'internal') {
            list = list.filter(a => !isExternalReviewer(a.reviewer));
        }
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(a =>
                a.proposal?.title?.toLowerCase().includes(q) ||
                a.proposal?.tracker_number?.toLowerCase().includes(q) ||
                a.reviewer?.name?.toLowerCase().includes(q) ||
                a.proposal?.college?.name?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [assignments, filterEvalType, filterReviewerType, search]);

    // Group by proposal for summary tab
    const proposalMap = useMemo(() => {
        const map = {};
        filteredAssignments.forEach(a => {
            const pid = a.proposal?.id;
            if (!pid) { return; }
            if (!map[pid]) {
                map[pid] = {
                    id:             pid,
                    title:          a.proposal?.title ?? '—',
                    tracker_number: a.proposal?.tracker_number ?? '—',
                    college_name:   a.proposal?.college?.name ?? '—',
                    assignments:    [],
                    blind_count:    0,
                    open_count:     0,
                };
            }
            map[pid].assignments.push(a);
            if (a.evaluation_type?.name?.startsWith('blind')) {
                map[pid].blind_count++;
            } else if (a.evaluation_type?.name?.startsWith('open')) {
                map[pid].open_count++;
            }
        });
        return Object.values(map).sort((a, b) => a.college_name.localeCompare(b.college_name));
    }, [filteredAssignments]);

    // Stats
    const totalProposals  = proposalMap.length;
    const totalAssign     = filteredAssignments.length;
    const blindCount      = filteredAssignments.filter(a => a.evaluation_type?.name?.startsWith('blind')).length;
    const openCount       = filteredAssignments.filter(a => a.evaluation_type?.name?.startsWith('open')).length;

    // ── Download helpers ──────────────────────────────────────────────────────

    const academicYears = useMemo(
        () => [...new Set(assignments.map(a => a.proposal?.academic_year).filter(Boolean))].sort().reverse(),
        [assignments],
    );

    // Excel built on the server: one row per review with the reviewer's totals, plus a payment summary sheet.
    const downloadPaymentReport = async () => {
        setPaymentDownloading(true);
        const params = new URLSearchParams();
        if (filterCollege) params.set('college_id', filterCollege);
        if (paymentYear) params.set('academic_year', paymentYear);
        params.set('review_type', filterEvalType);
        params.set('reviewer_type', filterReviewerType);
        try {
            await downloadFile(`/admin/reviewer-workload/payment-report?${params}`, `reviewer_payment_report${paymentYear ? `_${paymentYear}` : ''}.xlsx`);
        } catch (e) {
            error(e.response?.data?.message || 'Could not prepare the payment report.');
        }
        setPaymentDownloading(false);
    };

    const downloadAll = () => {
        const headers = [
            'College', 'Proposal Title', 'Tracker Number',
            'Evaluation Type', 'Reviewer Name', 'Reviewer Email',
            'Status', 'Assigned At',
        ];
        const rows = filteredAssignments.map(a => [
            a.proposal?.college?.name ?? '',
            a.proposal?.title ?? '',
            a.proposal?.tracker_number ?? '',
            a.evaluation_type?.label ?? a.evaluation_type?.name ?? '',
            a.reviewer?.name ?? '',
            a.reviewer?.email ?? '',
            a.status ?? '',
            a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '',
        ]);
        downloadCsv('reviewer_workload_all.csv', rows, headers);
    };

    const downloadByEvalType = (type) => {
        const typeLabel  = type === 'blind' ? 'blind_review' : 'open_defence';
        const typeFilter = filteredAssignments.filter(a => a.evaluation_type?.name?.startsWith(type));
        const headers    = [
            'College', 'Proposal Title', 'Tracker Number',
            'Evaluation Type', 'Reviewer Name', 'Reviewer Email', 'Status',
        ];
        const rows = typeFilter.map(a => [
            a.proposal?.college?.name ?? '',
            a.proposal?.title ?? '',
            a.proposal?.tracker_number ?? '',
            a.evaluation_type?.label ?? '',
            a.reviewer?.name ?? '',
            a.reviewer?.email ?? '',
            a.status ?? '',
        ]);
        downloadCsv(`reviewer_workload_${typeLabel}.csv`, rows, headers);
    };

    const downloadByCollege = () => {
        // Arranged by college: college name, eval type, proposal title, blind count, open defence count
        const headers = [
            'College', 'Proposal Title', 'Tracker Number',
            'Evaluation Type', '# Blind Review Reviewers', '# Open Defence Reviewers',
            'Reviewer Names',
        ];
        const rows = proposalMap.map(p => {
            const evalTypes = [...new Set(p.assignments.map(a => a.evaluation_type?.label ?? ''))].join('; ');
            const reviewers = p.assignments.map(a => a.reviewer?.name ?? '').filter(Boolean).join('; ');
            return [
                p.college_name,
                p.title,
                p.tracker_number,
                evalTypes,
                p.blind_count,
                p.open_count,
                reviewers,
            ];
        });
        downloadCsv('reviewer_workload_by_college.csv', rows, headers);
    };

    const downloadSummary = () => {
        const headers = [
            'College', 'Proposal Title', 'Tracker Number',
            '# Blind Review Reviewers', '# Open Defence Reviewers', 'Total Assignments',
        ];
        const rows = proposalMap.map(p => [
            p.college_name,
            p.title,
            p.tracker_number,
            p.blind_count,
            p.open_count,
            p.assignments.length,
        ]);
        downloadCsv('reviewer_workload_summary.csv', rows, headers);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumb="Reviewer Workload">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <Users size={24} className="text-indigo-600" />
                            Reviewer Workload
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Track reviewer assignments across proposals and evaluation types
                        </p>
                    </div>
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition shrink-0">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Proposals w/ Reviewers" value={totalProposals} icon={ClipboardList}  color="bg-indigo-500" />
                    <StatCard label="Total Assignments"       value={totalAssign}   icon={Users}          color="bg-slate-500" />
                    <StatCard label="Blind Review"            value={blindCount}    icon={EyeOff}         color="bg-purple-500" />
                    <StatCard label="Open Defence"            value={openCount}     icon={Presentation}   color="bg-blue-500" />
                </div>

                {/* Filters row */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="flex items-center border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm flex-1 min-w-56">
                        <Search size={15} className="text-gray-400 shrink-0" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search proposal, reviewer, college…"
                            className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* College filter */}
                    <select
                        value={filterCollege}
                        onChange={e => setFilterCollege(e.target.value)}
                        className="border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-gray-700 min-w-[180px]"
                    >
                        <option value="">All Colleges</option>
                        {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    {/* Eval type filter */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                        {[
                            { value: 'all',   label: 'All Types' },
                            { value: 'blind', label: 'Blind Review' },
                            { value: 'open',  label: 'Open Defence' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setFilterEvalType(opt.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    filterEvalType === opt.value
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Reviewer type filter */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                        {[
                            { value: 'all',      label: 'All Reviewers' },
                            { value: 'internal', label: 'Internal' },
                            { value: 'external', label: 'External' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setFilterReviewerType(opt.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    filterReviewerType === opt.value
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Payment report */}
                <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                            <Wallet size={17} />
                        </span>
                        <div>
                            <p className="text-sm font-semibold text-emerald-900">Reviewer payment report</p>
                            <p className="text-xs text-emerald-800/80">
                                Excel with every review — reviewer, proposal, type, status, college, completed and not completed — plus a per-reviewer payment summary. Uses the college, review-type and reviewer filters above.
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <select value={paymentYear} onChange={e => setPaymentYear(e.target.value)} aria-label="Academic year"
                            className="rounded-lg border border-emerald-200 bg-white px-2.5 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                            <option value="">All years</option>
                            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={downloadPaymentReport} disabled={paymentDownloading}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                            <FileSpreadsheet size={13} /> {paymentDownloading ? 'Preparing…' : 'Download Excel'}
                        </button>
                    </div>
                </div>

                {/* Download bar */}
                <div className="flex flex-wrap items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 mr-2">
                        <FileDown size={16} /> Download
                    </div>
                    <button
                        onClick={downloadAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
                    >
                        <Download size={12} /> All Assignments
                    </button>
                    <button
                        onClick={downloadSummary}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition"
                    >
                        <Download size={12} /> Summary (by Proposal)
                    </button>
                    <button
                        onClick={() => downloadByEvalType('blind')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition"
                    >
                        <EyeOff size={12} /> Blind Review Only
                    </button>
                    <button
                        onClick={() => downloadByEvalType('open')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                    >
                        <Presentation size={12} /> Open Defence Only
                    </button>
                    <button
                        onClick={downloadByCollege}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition"
                    >
                        <Building2 size={12} /> By College
                    </button>
                </div>

                {/* Tab toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                    <button
                        onClick={() => setTab('summary')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            tab === 'summary' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Summary by Proposal
                    </button>
                    <button
                        onClick={() => setTab('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            tab === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        All Assignments
                    </button>
                    <button
                        onClick={() => setTab('analytics')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            tab === 'analytics' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <BarChart2 size={13} /> Analytics
                    </button>
                </div>

                {/* Table / Analytics */}
                {loading && tab !== 'analytics' ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : tab === 'summary' ? (
                    <SummaryTable proposals={proposalMap} />
                ) : tab === 'all' ? (
                    <AllAssignmentsTable assignments={filteredAssignments} />
                ) : (
                    <AnalyticsTab
                        analytics={analytics}
                        loading={analyticsLoading}
                        reviewerTypeFilter={filterReviewerType}
                        onDownload={() => {
                            if (!analytics?.reviewers) { return; }
                            const headers = [
                                'Reviewer', 'Email', 'Proposal Total', 'Proposal Completed', 'Proposal Pending',
                                'Overdue', 'Declined', 'Avg Days', 'On-Time %', 'Avg Score %', 'Leniency vs Peers', 'At Risk',
                                'Abstract Total', 'Abstract Completed', 'Abstract Pending', 'Abstract Avg Score',
                                'Combined Pending',
                            ];
                            const rows = analytics.reviewers.map(r => [
                                r.reviewer?.name ?? '', r.reviewer?.email ?? '',
                                r.total, r.completed, r.pending, r.overdue, r.declined,
                                r.avg_days ?? '', r.on_time_rate != null ? r.on_time_rate + '%' : '',
                                r.avg_score_pct != null ? r.avg_score_pct + '%' : '',
                                r.leniency_delta ?? '', r.risk_flag ? 'Yes' : 'No',
                                r.abstract_reviews?.total ?? 0, r.abstract_reviews?.completed ?? 0,
                                r.abstract_reviews?.pending ?? 0, r.abstract_reviews?.avg_score ?? '',
                                r.combined_pending ?? 0,
                            ]);
                            downloadCsv('reviewer_analytics.csv', rows, headers);
                        }}
                    />
                )}
            </div>
        </AppLayout>
    );
}

// ─── Summary table (one row per proposal, expandable) ────────────────────────

function SummaryTable({ proposals }) {
    if (proposals.length === 0) {
        return (
            <div className="bg-white border border-gray-100 rounded-2xl p-14 text-center shadow-sm">
                <Users size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">No proposals with reviewer assignments found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-linear-to-r from-indigo-600 to-indigo-700">
                            {['#', 'Tracker', 'Proposal Title', 'College', 'Blind Review', 'Open Defence', 'Total'].map(h => (
                                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide whitespace-nowrap">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {proposals.map((p, i) => <ProposalRow key={p.id} proposal={p} rowNum={i + 1} />)}
                    </tbody>
                </table>
            </div>

            {/* Mobile: stacked, expandable cards */}
            <div className="sm:hidden divide-y divide-gray-50">
                {proposals.map(p => (
                    <details key={p.id} className="group">
                        <summary className="list-none cursor-pointer px-4 py-3.5">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-mono text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                                    {p.tracker_number}
                                </span>
                                <ChevronRight size={14} className="text-gray-400 transition-transform group-open:rotate-90 shrink-0" />
                            </div>
                            <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1.5">{p.title}</p>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                                <Building2 size={12} className="text-gray-400 shrink-0" />
                                <span className="truncate">{p.college_name ?? '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${p.blind_count > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                                    <EyeOff size={11} /> {p.blind_count}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${p.open_count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                    <Presentation size={11} /> {p.open_count}
                                </span>
                                <span className="text-xs text-gray-400">{(p.assignments ?? []).length} total</span>
                            </div>
                        </summary>
                        <div className="px-4 pb-3.5 space-y-2">
                            {(p.assignments ?? []).map(a => (
                                <div key={a.id} className="bg-indigo-50/40 border-l-2 border-indigo-300 rounded-r-lg px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-medium text-gray-800">{a.reviewer?.name ?? '—'}</p>
                                        <ReviewerTypeBadge reviewer={a.reviewer} />
                                    </div>
                                    <p className="text-[11px] text-gray-400 mb-1">{a.reviewer?.email}</p>
                                    <div className="flex items-center gap-2">
                                        <EvalBadge name={a.evaluationType?.name} label={a.evaluationType?.label} />
                                        <AssignmentBadge status={a.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </details>
                ))}
            </div>

            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} · Tap a row to see individual reviewers
            </div>
        </div>
    );
}

// ─── All assignments flat table ───────────────────────────────────────────────

function AllAssignmentsTable({ assignments }) {
    // Group by college for visual separation
    const byCollege = assignments.reduce((acc, a) => {
        const key = a.proposal?.college?.name ?? 'Unknown';
        if (!acc[key]) { acc[key] = []; }
        acc[key].push(a);
        return acc;
    }, {});

    if (assignments.length === 0) {
        return (
            <div className="bg-white border border-gray-100 rounded-2xl p-14 text-center shadow-sm">
                <Users size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">No assignments match current filters.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {Object.entries(byCollege).sort(([a], [b]) => a.localeCompare(b)).map(([collegeName, items]) => (
                <div key={collegeName} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* College header */}
                    <div className="px-5 py-3.5 bg-linear-to-r from-slate-50 to-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                <Building2 size={15} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-800">{collegeName}</p>
                                <p className="text-[10px] text-gray-400">{items.length} assignment{items.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                                <EyeOff size={10} /> {items.filter(a => a.evaluation_type?.name?.startsWith('blind')).length} blind
                            </span>
                            <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                <Presentation size={10} /> {items.filter(a => a.evaluation_type?.name?.startsWith('open')).length} open
                            </span>
                        </div>
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-400 uppercase border-b border-gray-50">
                                    <th className="px-5 py-2.5 text-left font-medium w-10">#</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Tracker</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Proposal Title</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Evaluation Type</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Reviewer</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Status</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Assigned</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {items.map((a, idx) => (
                                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3 text-xs font-medium text-gray-400 tabular-nums w-10">{idx + 1}</td>
                                        <td className="px-5 py-3">
                                            <span className="font-mono text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                                                {a.proposal?.tracker_number ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 max-w-xs">
                                            <p className="font-medium text-gray-900 line-clamp-1">{a.proposal?.title ?? '—'}</p>
                                        </td>
                                        <td className="px-5 py-3">
                                            <EvalBadge name={a.evaluation_type?.name} label={a.evaluation_type?.label} />
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-medium text-gray-800">{a.reviewer?.name ?? '—'}</p>
                                                <ReviewerTypeBadge reviewer={a.reviewer} />
                                            </div>
                                            <p className="text-xs text-gray-400">{a.reviewer?.email}</p>
                                        </td>
                                        <td className="px-5 py-3">
                                            <AssignmentBadge status={a.status} />
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                                            {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile: stacked cards */}
                    <div className="sm:hidden divide-y divide-gray-50">
                        {items.map(a => (
                            <div key={a.id} className="px-4 py-3">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="font-mono text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                                        {a.proposal?.tracker_number ?? '—'}
                                    </span>
                                    <AssignmentBadge status={a.status} />
                                </div>
                                <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1.5">{a.proposal?.title ?? '—'}</p>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <p className="text-xs font-medium text-gray-800">{a.reviewer?.name ?? '—'}</p>
                                    <ReviewerTypeBadge reviewer={a.reviewer} />
                                </div>
                                <p className="text-[11px] text-gray-400 mb-2">{a.reviewer?.email}</p>
                                <div className="flex items-center justify-between">
                                    <EvalBadge name={a.evaluation_type?.name} label={a.evaluation_type?.label} />
                                    <span className="text-[11px] text-gray-400">
                                        {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <p className="text-xs text-gray-400 text-center pb-2">
                {assignments.length} total assignment{assignments.length !== 1 ? 's' : ''} shown
            </p>
        </div>
    );
}

// ─── Analytics tab ────────────────────────────────────────────────────────────

function OnTimeBar({ rate }) {
    if (rate == null) {
        return <span className="text-xs text-gray-400">—</span>;
    }
    const color = rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-500';
    const textColor = rate >= 80 ? 'text-emerald-700' : rate >= 50 ? 'text-amber-700' : 'text-red-600';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-12">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
            </div>
            <span className={`text-xs font-semibold ${textColor}`}>{rate}%</span>
        </div>
    );
}

function LeniencyIndicator({ delta }) {
    if (delta == null) {
        return <span className="text-xs text-gray-400">—</span>;
    }
    if (Math.abs(delta) < 3) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Minus size={11} /> On par
            </span>
        );
    }
    const lenient = delta > 0;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${lenient ? 'text-amber-600' : 'text-blue-600'}`}>
            {lenient ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {lenient ? '+' : ''}{delta}pt {lenient ? 'vs peers' : 'vs peers'}
        </span>
    );
}

function RiskBadge({ flagged }) {
    if (!flagged) {
        return <span className="text-xs text-gray-300">—</span>;
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <AlertTriangle size={11} /> At Risk
        </span>
    );
}

function AnalyticsStatCard({ label, value, icon: Icon, color, sub }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={20} className="text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">{value ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
                {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}

function AnalyticsTab({ analytics, loading, onDownload, reviewerTypeFilter = 'all' }) {
    const [sortKey, setSortKey] = useState('total');
    const [sortDir, setSortDir] = useState('desc');

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const sortedReviewers = useMemo(() => {
        if (!analytics?.reviewers) { return []; }
        let list = analytics.reviewers;
        if (reviewerTypeFilter === 'external') {
            list = list.filter(r => isExternalReviewer(r.reviewer));
        } else if (reviewerTypeFilter === 'internal') {
            list = list.filter(r => !isExternalReviewer(r.reviewer));
        }
        return [...list].sort((a, b) => {
            const av = a[sortKey] ?? -1;
            const bv = b[sortKey] ?? -1;
            return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });
    }, [analytics, reviewerTypeFilter, sortKey, sortDir]);

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="bg-white border border-gray-100 rounded-2xl p-14 text-center shadow-sm">
                <BarChart2 size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">Analytics data not available.</p>
            </div>
        );
    }

    const { summary } = analytics;

    const SortHeader = ({ label, col }) => (
        <th
            className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-white"
            onClick={() => handleSort(col)}
        >
            {label} {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </th>
    );

    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <AnalyticsStatCard
                    label="Active Reviewers"
                    value={summary.total_reviewers}
                    icon={Users}
                    color="bg-indigo-500"
                />
                <AnalyticsStatCard
                    label="Avg Completion Rate"
                    value={summary.avg_completion_rate != null ? summary.avg_completion_rate + '%' : '—'}
                    icon={TrendingUp}
                    color="bg-emerald-500"
                    sub="assignments completed"
                />
                <AnalyticsStatCard
                    label="Total Overdue"
                    value={summary.total_overdue}
                    icon={AlertCircle}
                    color={summary.total_overdue > 0 ? 'bg-red-500' : 'bg-gray-400'}
                    sub="past due date"
                />
                <AnalyticsStatCard
                    label="Avg Days to Complete"
                    value={summary.avg_days_to_complete != null ? summary.avg_days_to_complete + ' days' : '—'}
                    icon={Clock}
                    color="bg-amber-500"
                    sub="submitted_at − assigned_at"
                />
                <AnalyticsStatCard
                    label="Abstract Reviews Pending"
                    value={summary.total_abstract_pending ?? 0}
                    icon={FileText}
                    color={(summary.total_abstract_pending ?? 0) > 0 ? 'bg-orange-500' : 'bg-gray-400'}
                    sub="awaiting a reviewer score"
                />
                <AnalyticsStatCard
                    label="Reviewers At Risk"
                    value={summary.total_at_risk ?? 0}
                    icon={AlertTriangle}
                    color={(summary.total_at_risk ?? 0) > 0 ? 'bg-red-500' : 'bg-gray-400'}
                    sub="late or declining a lot"
                />
            </div>

            {/* Per-reviewer table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">Per-Reviewer Performance</h3>
                    <button
                        onClick={onDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition"
                    >
                        <Download size={12} /> Export CSV
                    </button>
                </div>
                {sortedReviewers.length === 0 ? (
                    <div className="py-14 text-center text-gray-400">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No reviewer data yet.</p>
                    </div>
                ) : (
                    <>
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-linear-to-r from-indigo-600 to-indigo-700">
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-200 uppercase tracking-wide w-10">#</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide">Reviewer</th>
                                    <SortHeader label="Total"     col="total" />
                                    <SortHeader label="Completed" col="completed" />
                                    <SortHeader label="Pending"   col="pending" />
                                    <SortHeader label="Overdue"   col="overdue" />
                                    <SortHeader label="Declined"  col="declined" />
                                    <SortHeader label="Avg Days"  col="avg_days" />
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide whitespace-nowrap">On-Time Rate</th>
                                    <SortHeader label="Avg Score" col="avg_score_pct" />
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide whitespace-nowrap">Leniency</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide whitespace-nowrap">Risk</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide whitespace-nowrap">Abstract Reviews</th>
                                    <SortHeader label="Total Pending" col="combined_pending" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sortedReviewers.map((r, i) => (
                                    <tr key={r.reviewer_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3.5 text-xs font-medium text-gray-400 tabular-nums w-10">{i + 1}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-sm font-medium text-gray-900">{r.reviewer?.name ?? '—'}</p>
                                                <ReviewerTypeBadge reviewer={r.reviewer} />
                                            </div>
                                            <p className="text-xs text-gray-400">{r.reviewer?.email}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-semibold text-gray-700">{r.total}</td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm font-semibold text-emerald-600">{r.completed}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm text-amber-600">{r.pending}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {r.overdue > 0
                                                ? <span className="text-sm font-semibold text-red-600">{r.overdue}</span>
                                                : <span className="text-sm text-gray-400">0</span>
                                            }
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm text-gray-500">{r.declined}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm text-gray-600">{r.avg_days != null ? r.avg_days + 'd' : '—'}</span>
                                        </td>
                                        <td className="px-5 py-3.5 min-w-30">
                                            <OnTimeBar rate={r.on_time_rate} />
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm text-gray-600">{r.avg_score_pct != null ? r.avg_score_pct + '%' : '—'}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <LeniencyIndicator delta={r.leniency_delta} />
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <RiskBadge flagged={r.risk_flag} />
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {r.abstract_reviews?.total > 0 ? (
                                                <span className="text-sm text-gray-600">
                                                    <span className="font-semibold text-emerald-600">{r.abstract_reviews.completed}</span>
                                                    {' / '}{r.abstract_reviews.total}
                                                    {r.abstract_reviews.pending > 0 && (
                                                        <span className="text-amber-600 ml-1">({r.abstract_reviews.pending} pending)</span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`text-sm font-bold ${r.combined_pending > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                                                {r.combined_pending}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile: condensed stacked cards */}
                    <div className="sm:hidden divide-y divide-gray-50">
                        {sortedReviewers.map(r => (
                            <div key={r.reviewer_id} className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className="text-sm font-medium text-gray-900">{r.reviewer?.name ?? '—'}</p>
                                    <ReviewerTypeBadge reviewer={r.reviewer} />
                                </div>
                                <p className="text-xs text-gray-400 mb-2">{r.reviewer?.email}</p>
                                <div className="grid grid-cols-4 gap-2 mb-2 text-center">
                                    <div><p className="text-sm font-semibold text-gray-700">{r.total}</p><p className="text-[10px] text-gray-400">Total</p></div>
                                    <div><p className="text-sm font-semibold text-emerald-600">{r.completed}</p><p className="text-[10px] text-gray-400">Done</p></div>
                                    <div><p className="text-sm text-amber-600">{r.pending}</p><p className="text-[10px] text-gray-400">Pending</p></div>
                                    <div><p className={`text-sm font-semibold ${r.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{r.overdue}</p><p className="text-[10px] text-gray-400">Overdue</p></div>
                                </div>
                                <OnTimeBar rate={r.on_time_rate} />
                                <div className="flex items-center justify-between mt-2 text-xs">
                                    <span className="text-gray-500">Avg score: <span className="font-medium text-gray-700">{r.avg_score_pct != null ? r.avg_score_pct + '%' : '—'}</span></span>
                                    <span className={`font-bold ${r.combined_pending > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{r.combined_pending} total pending</span>
                                </div>
                                {(r.leniency_delta != null || r.risk_flag) && (
                                    <div className="flex items-center justify-between mt-1.5">
                                        <LeniencyIndicator delta={r.leniency_delta} />
                                        <RiskBadge flagged={r.risk_flag} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    </>
                )}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                    {sortedReviewers.length} reviewer{sortedReviewers.length !== 1 ? 's' : ''} · Click column headers to sort (desktop) · On-time rate: green ≥80%, amber ≥50%, red &lt;50%
                </div>
            </div>
        </div>
    );
}
