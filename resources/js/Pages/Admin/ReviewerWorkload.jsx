import { useState, useEffect, useMemo } from 'react';
import {
    Users, Download, Filter, Search, X, RefreshCw,
    Building2, ClipboardList, EyeOff, Presentation,
    ChevronDown, ChevronRight, FileDown,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
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

function ProposalRow({ proposal }) {
    const [open, setOpen] = useState(false);
    const assignments = proposal.assignments ?? [];

    return (
        <>
            <tr
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setOpen(o => !o)}
            >
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
                        <p className="text-sm font-medium text-gray-800">{a.reviewer?.name ?? '—'}</p>
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
    const [search, setSearch]           = useState('');
    const [tab, setTab]                 = useState('summary'); // 'summary' | 'all'

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

    useEffect(() => { load(); }, [filterCollege]);

    // ── Derived data ──────────────────────────────────────────────────────────

    const filteredAssignments = useMemo(() => {
        let list = assignments;
        if (filterEvalType === 'blind') {
            list = list.filter(a => a.evaluation_type?.name?.startsWith('blind'));
        } else if (filterEvalType === 'open') {
            list = list.filter(a => a.evaluation_type?.name?.startsWith('open'));
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
    }, [assignments, filterEvalType, search]);

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
                </div>

                {/* Table */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : tab === 'summary' ? (
                    <SummaryTable proposals={proposalMap} />
                ) : (
                    <AllAssignmentsTable assignments={filteredAssignments} />
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
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-linear-to-r from-indigo-600 to-indigo-700">
                            {['Tracker', 'Proposal Title', 'College', 'Blind Review', 'Open Defence', 'Total'].map(h => (
                                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide whitespace-nowrap">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {proposals.map(p => <ProposalRow key={p.id} proposal={p} />)}
                    </tbody>
                </table>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} · Click a row to see individual reviewers
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

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-400 uppercase border-b border-gray-50">
                                    <th className="px-5 py-2.5 text-left font-medium">Tracker</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Proposal Title</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Evaluation Type</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Reviewer</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Status</th>
                                    <th className="px-5 py-2.5 text-left font-medium">Assigned</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {items.map(a => (
                                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
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
                                            <p className="font-medium text-gray-800">{a.reviewer?.name ?? '—'}</p>
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
                </div>
            ))}
            <p className="text-xs text-gray-400 text-center pb-2">
                {assignments.length} total assignment{assignments.length !== 1 ? 's' : ''} shown
            </p>
        </div>
    );
}
