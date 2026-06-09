import { useState, useEffect, useCallback } from 'react';
import { usePage, Link } from '@inertiajs/react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import {
    BarChart2, TrendingUp, Users, TrendingDown, RefreshCw,
    Download, ChevronRight, Clock, CheckCircle2, XCircle,
    Building2, DollarSign, BookOpen, AlertCircle,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { post, get } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_META = {
    proposal_count_by_category: {
        label: 'Proposal Statistics',
        icon:  TrendingUp,
        color: 'indigo',
        desc:  'Proposal counts by category, broken down by pipeline stage',
    },
    proposal_count_by_college: {
        label: 'Proposals by College',
        icon:  Building2,
        color: 'blue',
        desc:  'Submission and acceptance rates per college',
    },
    college_performance: {
        label: 'College Performance',
        icon:  BarChart2,
        color: 'purple',
        desc:  'Comparative performance metrics across colleges',
    },
    reviewer_workload: {
        label: 'Reviewer Workload',
        icon:  Users,
        color: 'amber',
        desc:  'Assignment load, completion rate, and turnaround time per reviewer',
    },
    budget_utilization: {
        label: 'Budget Utilization',
        icon:  TrendingDown,
        color: 'emerald',
        desc:  'Allocated vs disbursed vs settled amounts per funded proposal',
    },
    approval_rate_by_category: {
        label: 'Approval Rates',
        icon:  CheckCircle2,
        color: 'green',
        desc:  'Approval and rejection rates by research category',
    },
    review_progress_pipeline: {
        label: 'Review Pipeline',
        icon:  ChevronRight,
        color: 'cyan',
        desc:  'Proposal volume at each stage of the review pipeline',
    },
};

const COLOR_MAP = {
    indigo:  { bar: '#6366f1', soft: '#eef2ff', text: 'text-indigo-600'  },
    blue:    { bar: '#3b82f6', soft: '#eff6ff', text: 'text-blue-600'    },
    purple:  { bar: '#a855f7', soft: '#faf5ff', text: 'text-purple-600'  },
    amber:   { bar: '#f59e0b', soft: '#fffbeb', text: 'text-amber-600'   },
    emerald: { bar: '#10b981', soft: '#ecfdf5', text: 'text-emerald-600' },
    green:   { bar: '#22c55e', soft: '#f0fdf4', text: 'text-green-600'   },
    cyan:    { bar: '#06b6d4', soft: '#ecfeff', text: 'text-cyan-600'    },
};

const CATEGORY_LABEL = {
    research:             'Research',
    community_engagement: 'Community',
    technology_transfer:  'Technology',
};

const STAGE_LABEL = {
    submitted:            'Submitted',
    validated:            'Validated',
    under_blind_review:   'Blind Review',
    blind_review_passed:  'Review Passed',
    under_open_defence:   'Open Defence',
    accepted:             'Accepted',
    funded:               'Funded',
    midterm_evaluation:   'Midterm',
    completed:            'Completed',
};

// ─── Chart components ─────────────────────────────────────────────────────────

function ProposalStatisticsChart({ data }) {
    const rows = data.map(r => ({
        name:         CATEGORY_LABEL[r.category] ?? r.category,
        'Total':      r.total        ?? 0,
        'In Review':  r.under_review ?? 0,
        'Accepted':   r.accepted     ?? 0,
        'Rejected':   r.rejected     ?? 0,
        'Submitted':  r.submitted    ?? 0,
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Total"     fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="In Review" fill="#f59e0b" radius={[4,4,0,0]} />
                    <Bar dataKey="Accepted"  fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="Rejected"  fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                columns={['Category', 'Total', 'In Review', 'Accepted', 'Rejected']}
                rows={rows.map(r => [r.name, r['Total'], r['In Review'], r['Accepted'], r['Rejected']])}
            />
        </div>
    );
}

function CollegePerformanceChart({ data }) {
    const rows = data.map(r => ({
        name:       r.college_name,
        Submitted:  r.proposals_submitted  ?? 0,
        Accepted:   r.proposals_accepted   ?? 0,
        Awarded:    parseFloat(r.total_awarded ?? 0),
        Outputs:    r.outputs_produced     ?? 0,
        Pubs:       r.publications_count   ?? 0,
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Submitted" fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="Accepted"  fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="Outputs"   fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                columns={['College', 'Submitted', 'Accepted', 'Total Awarded', 'Outputs', 'Publications']}
                rows={rows.map(r => [r.name, r.Submitted, r.Accepted, formatCurrency(r.Awarded), r.Outputs, r.Pubs])}
            />
        </div>
    );
}

function ReviewerWorkloadChart({ data }) {
    const rows = data.map(r => ({
        name:      r.reviewer_name,
        Assigned:  r.total_assigned ?? 0,
        Submitted: r.submitted      ?? 0,
        Pending:   r.pending        ?? 0,
        'Avg Days': parseFloat(r.average_days_to_review ?? 0),
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Assigned"  fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="Submitted" fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="Pending"   fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                columns={['Reviewer', 'Assigned', 'Submitted', 'Pending', 'Avg Days']}
                rows={rows.map(r => [r.name, r.Assigned, r.Submitted, r.Pending, r['Avg Days']])}
            />
        </div>
    );
}

function BudgetUtilizationChart({ data }) {
    const rows = data.map(r => ({
        name:       r.tracker_number,
        title:      r.proposal_title,
        Allocated:  parseFloat(r.allocated  ?? 0),
        Disbursed:  parseFloat(r.disbursed  ?? 0),
        Settled:    parseFloat(r.settled    ?? 0),
        pct:        parseFloat(r.utilization_percent ?? 0),
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="Allocated"  fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="Disbursed"  fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="Settled"    fill="#06b6d4" radius={[4,4,0,0]} />
                </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {['Tracker #', 'Title', 'Allocated', 'Disbursed', 'Settled', 'Utilization'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold">{r.name}</td>
                                <td className="px-4 py-3 text-xs text-gray-700 max-w-48 truncate" title={r.title}>{r.title}</td>
                                <td className="px-4 py-3 text-xs font-medium">{formatCurrency(r.Allocated)}</td>
                                <td className="px-4 py-3 text-xs font-medium text-emerald-700">{formatCurrency(r.Disbursed)}</td>
                                <td className="px-4 py-3 text-xs font-medium text-cyan-700">{formatCurrency(r.Settled)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-16">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(r.pct, 100)}%` }} />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-700">{r.pct}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ReviewPipelineChart({ data }) {
    const rows = data.map(r => ({
        name:  STAGE_LABEL[r.stage] ?? r.stage,
        count: r.count ?? 0,
    }));

    const COLORS = ['#6366f1','#3b82f6','#f59e0b','#f97316','#a855f7','#10b981','#059669','#0d9488','#06b6d4'];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={55} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[4,4,0,0]}>
                            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>

                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={rows} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function ApprovalRateChart({ data }) {
    const rows = data.map(r => ({
        name:       CATEGORY_LABEL[r.category] ?? r.category,
        Total:      r.total_submitted   ?? 0,
        Accepted:   r.total_accepted    ?? 0,
        'Approval %': parseFloat(r.approval_rate_percent  ?? 0),
        'Rejection %': parseFloat(r.rejection_rate_percent ?? 0),
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Total"    fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="Accepted" fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                columns={['Category', 'Total', 'Accepted', 'Approval %', 'Rejection %']}
                rows={rows.map(r => [r.name, r.Total, r.Accepted, `${r['Approval %']}%`, `${r['Rejection %']}%`])}
            />
        </div>
    );
}

function ProposalsByCollegeChart({ data }) {
    const rows = data.map(r => ({
        name:       r.college_name,
        Total:      r.total_proposals ?? 0,
        Accepted:   r.accepted        ?? 0,
        'Rejection %': parseFloat(r.rejection_rate_percent ?? 0),
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Total"    fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="Accepted" fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                columns={['College', 'Total Proposals', 'Accepted', 'Rejection Rate']}
                rows={rows.map(r => [r.name, r.Total, r.Accepted, `${r['Rejection %']}%`])}
            />
        </div>
    );
}

function SummaryTable({ columns, rows }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        {columns.map(c => (
                            <th key={c} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                            {row.map((cell, j) => (
                                <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function renderChart(type, data) {
    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <AlertCircle size={36} className="mb-3" />
                <p className="text-sm font-medium">No data available for this report</p>
            </div>
        );
    }
    switch (type) {
        case 'proposal_count_by_category':  return <ProposalStatisticsChart data={data} />;
        case 'proposal_count_by_college':   return <ProposalsByCollegeChart data={data} />;
        case 'college_performance':          return <CollegePerformanceChart data={data} />;
        case 'reviewer_workload':            return <ReviewerWorkloadChart data={data} />;
        case 'budget_utilization':           return <BudgetUtilizationChart data={data} />;
        case 'approval_rate_by_category':    return <ApprovalRateChart data={data} />;
        case 'review_progress_pipeline':     return <ReviewPipelineChart data={data} />;
        default:                             return <pre className="text-xs text-gray-600 overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
    }
}

// ─── Typed report view ────────────────────────────────────────────────────────

function TypedReportView({ type }) {
    const meta = REPORT_META[type];
    const colors = COLOR_MAP[meta?.color ?? 'indigo'];
    const Icon = meta?.icon ?? BarChart2;

    const [snapshot,    setSnapshot]    = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [generating,  setGenerating]  = useState(false);

    const loadLatest = useCallback(async () => {
        setLoading(true);
        try {
            const r = await get('/reports');
            const snaps = r.data?.data ?? [];
            const latest = snaps.filter(s => s.report_type === type && s.status === 'ready')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ?? null;
            setSnapshot(latest);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [type]);

    useEffect(() => { loadLatest(); }, [loadLatest]);

    const generate = async () => {
        setGenerating(true);
        try {
            const r = await post('/reports/generate', { type });
            const snap = r.data?.data ?? r.data;
            if (snap?.status === 'ready') {
                setSnapshot(snap);
            } else {
                // poll every 5 s (max ~2 min) until ready
                let attempts = 0;
                const poll = setInterval(async () => {
                    attempts++;
                    try {
                        const p = await get(`/reports/${snap.id}`);
                        const s = p.data?.data ?? p.data;
                        if (s?.status === 'ready') {
                            setSnapshot(s);
                            clearInterval(poll);
                            setGenerating(false);
                        } else if (s?.status === 'failed') {
                            clearInterval(poll);
                            setGenerating(false);
                        }
                    } catch { clearInterval(poll); setGenerating(false); }
                    if (attempts > 24) { clearInterval(poll); setGenerating(false); }
                }, 5000);
                return;
            }
        } catch (e) {
            alert(e.response?.data?.message ?? 'Report generation failed.');
        }
        setGenerating(false);
    };

    return (
        <div className="space-y-5">
            {/* Header card */}
            <div className={`rounded-2xl p-5 flex items-center justify-between gap-4`}
                style={{ backgroundColor: colors.soft }}>
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.bar + '20' }}>
                        <Icon size={22} style={{ color: colors.bar }} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{meta?.label ?? type}</h2>
                        <p className="text-sm text-gray-500 mt-0.5">{meta?.desc}</p>
                        {snapshot && (
                            <p className="text-xs text-gray-400 mt-1">
                                Last generated: {formatDateTime(snapshot.completed_at ?? snapshot.created_at)}
                            </p>
                        )}
                    </div>
                </div>
                <button
                    onClick={generate}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shrink-0"
                    style={{ backgroundColor: colors.bar }}
                >
                    <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                    {generating ? 'Generating…' : snapshot ? 'Refresh' : 'Generate'}
                </button>
            </div>

            {/* Chart area */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : generating && !snapshot ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <RefreshCw size={36} className="mb-3 animate-spin text-indigo-500" />
                        <p className="text-sm font-medium">Generating report…</p>
                    </div>
                ) : !snapshot ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Icon size={40} className="mb-3 opacity-40" />
                        <p className="text-sm font-medium text-gray-500">No report generated yet</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Generate" to create this report</p>
                    </div>
                ) : (
                    renderChart(type, snapshot.result)
                )}
            </div>
        </div>
    );
}

// ─── Generate & history view ──────────────────────────────────────────────────

function GenerateView() {
    const [snapshots,  setSnapshots]  = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [type,       setType]       = useState('proposal_count_by_category');
    const [generating, setGenerating] = useState(false);
    const [selected,   setSelected]   = useState(null);

    const load = useCallback(() =>
        get('/reports')
            .then(r => setSnapshots(r.data?.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false)),
    []);

    useEffect(() => { load(); }, [load]);

    const generate = async () => {
        setGenerating(true);
        try {
            await post('/reports/generate', { type });
            await load();
        } catch (e) {
            alert(e.response?.data?.message ?? 'Generation failed.');
        }
        setGenerating(false);
    };

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            {/* Generate panel */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 lg:col-span-1">
                <div className="flex items-center gap-3">
                    <BarChart2 size={20} className="text-purple-600" />
                    <h2 className="text-sm font-bold text-gray-800">Generate Report</h2>
                </div>

                <div className="space-y-3">
                    {Object.entries(REPORT_META).map(([value, meta]) => {
                        const Icon = meta.icon;
                        const colors = COLOR_MAP[meta.color];
                        return (
                            <label key={value} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${type === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                                <input type="radio" name="report_type" value={value} checked={type === value} onChange={() => setType(value)} className="hidden" />
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.soft }}>
                                    <Icon size={15} style={{ color: colors.bar }} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{meta.label}</p>
                                    <p className="text-xs text-gray-400 leading-tight">{meta.desc}</p>
                                </div>
                            </label>
                        );
                    })}
                </div>

                <button
                    onClick={generate}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                    {generating ? <><RefreshCw size={14} className="animate-spin" /> Generating…</> : 'Generate Report'}
                </button>
            </div>

            {/* History */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-800">Report History</h2>
                    <button onClick={load} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                        <RefreshCw size={11} /> Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : snapshots.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        <Download size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No reports generated yet</p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {snapshots.map(s => {
                            const meta   = REPORT_META[s.report_type];
                            const colors = COLOR_MAP[meta?.color ?? 'indigo'];
                            const Icon   = meta?.icon ?? BarChart2;
                            return (
                                <li key={s.id}
                                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer transition-all hover:shadow-sm ${selected?.id === s.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-100 bg-white'}`}
                                    onClick={() => setSelected(selected?.id === s.id ? null : s)}>
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.soft }}>
                                        <Icon size={14} style={{ color: colors.bar }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800">{meta?.label ?? s.report_type}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Clock size={10} className="text-gray-400" />
                                            <p className="text-xs text-gray-400">{formatDateTime(s.completed_at ?? s.created_at)}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                        s.status === 'ready'      ? 'bg-green-100 text-green-700' :
                                        s.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>{s.status}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {selected?.result && (
                    <div className="mt-4 rounded-xl border border-gray-200 p-5">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                            {REPORT_META[selected.report_type]?.label ?? selected.report_type}
                        </p>
                        {renderChart(selected.report_type, selected.result)}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsIndex() {
    const { url } = usePage();
    const typeParam = new URLSearchParams(url.split('?')[1] ?? '').get('type');

    // Quick-link chips at the top
    const quickLinks = [
        { label: 'Generate',            href: '/reports' },
        { label: 'Proposal Statistics', href: '/reports?type=proposal_count_by_category' },
        { label: 'College Performance', href: '/reports?type=college_performance' },
        { label: 'Reviewer Workload',   href: '/reports?type=reviewer_workload' },
        { label: 'Budget Utilization',  href: '/reports?type=budget_utilization' },
    ];

    const currentMeta = typeParam ? REPORT_META[typeParam] : null;
    const Icon = currentMeta?.icon ?? BarChart2;

    return (
        <AppLayout breadcrumb={currentMeta?.label ?? 'Reports'}>
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Page header */}
                <div className="flex items-center gap-3">
                    <Icon size={24} className="text-indigo-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{currentMeta?.label ?? 'Reports'}</h1>
                        {currentMeta && (
                            <p className="text-sm text-gray-500 mt-0.5">{currentMeta.desc}</p>
                        )}
                    </div>
                </div>

                {/* Navigation chips — use Inertia Link to avoid full page reloads */}
                <div className="flex flex-wrap gap-2">
                    {quickLinks.map(l => {
                        const isActive = typeParam
                            ? l.href.includes(typeParam)
                            : l.href === '/reports';
                        return (
                            <Link
                                key={l.href}
                                href={l.href}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                    isActive
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {l.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Content */}
                {typeParam ? (
                    <TypedReportView key={typeParam} type={typeParam} />
                ) : (
                    <GenerateView />
                )}
            </div>
        </AppLayout>
    );
}
