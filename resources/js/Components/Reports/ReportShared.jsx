import { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line,
} from 'recharts';
import {
    TrendingUp, Users, TrendingDown, Building2, BookOpen, AlertCircle, Globe2,
    Sliders, FileSpreadsheet, ChevronRight, CheckCircle2, BarChart2, Layers,
    CalendarRange,
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useToast } from '../Toast';
import { currency, term } from '../../lib/terms';
import { sdgByNumber } from '../../lib/sdgs';

// ─── Excel export (shared by every report view) ────────────────────────────────

export async function downloadSnapshotExcel(snapshot, onError) {
    if (!snapshot?.id) return;
    try {
        const token = localStorage.getItem('rtt_token');
        const res = await fetch(`/api/v1/reports/${snapshot.id}/export`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { onError?.('Export failed. Please try again.'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${snapshot.report_type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    } catch {
        onError?.('Export failed. Please try again.');
    }
}

export function DownloadExcelButton({ snapshot, className = '' }) {
    const [downloading, setDownloading] = useState(false);
    const { error } = useToast();
    if (!snapshot || snapshot.status !== 'ready') return null;

    return (
        <button
            onClick={async () => {
                setDownloading(true);
                await downloadSnapshotExcel(snapshot, error);
                setDownloading(false);
            }}
            disabled={downloading}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition-colors shrink-0 ${className}`}
        >
            <FileSpreadsheet size={14} className={downloading ? 'animate-pulse' : ''} />
            {downloading ? 'Preparing…' : 'Download Excel'}
        </button>
    );
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const REPORT_META = {
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
    proposal_trend_by_year: {
        label: 'Year-over-Year Trends',
        icon:  CalendarRange,
        color: 'indigo',
        desc:  'Submissions, funding, and funding rate compared across every academic year',
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
    complaint_summary: {
        label: 'Complaints Summary',
        icon:  AlertCircle,
        color: 'rose',
        desc:  'Complaint volume, resolution outcomes, and average resolution time per college',
    },
    sdg_alignment: {
        label: 'SDG Alignment',
        icon:  Globe2,
        color: 'emerald',
        desc:  'Proposals, funded projects and money per UN Sustainable Development Goal',
    },
    custom_builder: {
        label: 'Report Builder',
        icon:  Sliders,
        color: 'slate',
        desc:  'Pick a subject, dimensions, and metrics to build your own report',
    },
};

export const COLOR_MAP = {
    indigo:  { bar: '#6366f1', soft: '#eef2ff', text: 'text-indigo-600'  },
    blue:    { bar: '#3b82f6', soft: '#eff6ff', text: 'text-blue-600'    },
    purple:  { bar: '#a855f7', soft: '#faf5ff', text: 'text-purple-600'  },
    amber:   { bar: '#f59e0b', soft: '#fffbeb', text: 'text-amber-600'   },
    emerald: { bar: '#10b981', soft: '#ecfdf5', text: 'text-emerald-600' },
    green:   { bar: '#22c55e', soft: '#f0fdf4', text: 'text-green-600'   },
    cyan:    { bar: '#06b6d4', soft: '#ecfeff', text: 'text-cyan-600'    },
    rose:    { bar: '#f43f5e', soft: '#fff1f2', text: 'text-rose-600'    },
    slate:   { bar: '#475569', soft: '#f1f5f9', text: 'text-slate-600'   },
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
    accepted:             'Central Evaluation',
    funded:               'Funded',
    midterm_evaluation:   'Midterm',
    completed:            'Completed',
};

export const SUBJECT_ICONS = {
    proposals: BookOpen,
    complaints: AlertCircle,
    review_workload: Users,
};

export function SubjectIcon({ subject, ...props }) {
    const Icon = SUBJECT_ICONS[subject] ?? Layers;
    return <Icon {...props} />;
}

// ─── Chart components ─────────────────────────────────────────────────────────

const GRID = { strokeDasharray: '4 4', stroke: '#eef0f3', vertical: false };
const AXIS = { tick: { fontSize: 12, fill: '#6b7280' }, tickLine: false, axisLine: { stroke: '#e5e7eb' } };
const TOOLTIP = {
    cursor: { fill: 'rgba(99,102,241,0.06)' },
    contentStyle: { borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px -10px rgba(15,23,42,0.25)', fontSize: 12, padding: '8px 12px' },
    labelStyle: { fontWeight: 600, color: '#111827', marginBottom: 4 },
};
const LEGEND = { iconType: 'circle', iconSize: 8, wrapperStyle: { fontSize: 12, paddingTop: 8 } };

/** Recharts click handler that hands the original report row to onDrill. */
const drill = (onDrill) => (entry) => {
    const row = entry?.payload?.raw ?? entry?.raw;
    if (onDrill && row) onDrill(row);
};

function ProposalStatisticsChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
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
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={40} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Total"     fill="#6366f1" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="In Review" fill="#f59e0b" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Accepted"  fill="#10b981" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Rejected"  fill="#ef4444" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
                columns={['Category', 'Total', 'In Review', 'Accepted', 'Rejected']}
                rows={rows.map(r => [r.name, r['Total'], r['In Review'], r['Accepted'], r['Rejected']])}
            />
        </div>
    );
}

function ProposalTrendChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
        name:      r.academic_year,
        Submitted: r.submitted ?? 0,
        Funded:    r.funded ?? 0,
        Rejected:  r.rejected ?? 0,
        'Funded %': parseFloat(r.funded_rate_percent ?? 0),
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }} onClick={(e) => onDrill && e?.activePayload?.[0] && onDrill(e.activePayload[0].payload.raw)} style={onDrill ? { cursor: 'pointer' } : undefined}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={40} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Line type="monotone" dataKey="Submitted" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Funded"    stroke="#10b981" strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Rejected"  stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                </LineChart>
            </ResponsiveContainer>
            <SummaryTable
                onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
                columns={[term('academic_year'), 'Submitted', 'Funded', 'Rejected', 'Funded %']}
                rows={rows.map(r => [r.name, r['Submitted'], r['Funded'], r['Rejected'], `${r['Funded %']}%`])}
            />
        </div>
    );
}

function CollegePerformanceChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
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
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={40} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Submitted" fill="#6366f1" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Accepted"  fill="#10b981" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Outputs"   fill="#f59e0b" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
                columns={[term('college'), 'Submitted', 'Accepted', 'Total Awarded', 'Outputs', 'Publications']}
                rows={rows.map(r => [r.name, r.Submitted, r.Accepted, formatCurrency(r.Awarded), r.Outputs, r.Pubs])}
            />
        </div>
    );
}

function ReviewerWorkloadChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
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
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={40} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Assigned"  fill="#6366f1" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Submitted" fill="#10b981" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Pending"   fill="#f59e0b" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
                columns={['Reviewer', 'Assigned', 'Submitted', 'Pending', 'Avg Days']}
                rows={rows.map(r => [r.name, r.Assigned, r.Submitted, r.Pending, r['Avg Days']])}
            />
        </div>
    );
}

function BudgetUtilizationChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
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
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} {...AXIS} axisLine={false} width={48} />
                    <Tooltip {...TOOLTIP} formatter={v => formatCurrency(v)} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Allocated"  fill="#6366f1" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Disbursed"  fill="#10b981" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Settled"    fill="#06b6d4" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {['#', 'Tracker #', 'Title', 'Allocated', 'Disbursed', 'Settled', 'Utilization'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map((r, i) => (
                            <tr key={i} onClick={onDrill ? () => onDrill(r.raw) : undefined} className={`hover:bg-indigo-50/30 ${onDrill ? 'cursor-pointer' : ''}`}>
                                <td className="px-4 py-3 text-xs font-medium text-gray-400 tabular-nums w-10">{i + 1}</td>
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

function ReviewPipelineChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
        name:  STAGE_LABEL[r.stage] ?? r.stage,
        count: r.count ?? 0,
    }));

    const COLORS = ['#6366f1','#3b82f6','#f59e0b','#f97316','#a855f7','#10b981','#059669','#0d9488','#06b6d4'];

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                        <CartesianGrid {...GRID} />
                        <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 10, fill: '#6b7280' }} interval={0} angle={-20} textAnchor="end" height={55} />
                        <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={40} />
                        <Tooltip {...TOOLTIP} />
                        <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={44} onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined}>
                            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>

                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={rows} onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={105} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP} />
                        <Legend {...LEGEND} layout="vertical" align="right" verticalAlign="middle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function ApprovalRateChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
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
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={40} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Total"    fill="#6366f1" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Accepted" fill="#10b981" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
                columns={['Category', 'Total', 'Accepted', 'Approval %', 'Rejection %']}
                rows={rows.map(r => [r.name, r.Total, r.Accepted, `${r['Approval %']}%`, `${r['Rejection %']}%`])}
            />
        </div>
    );
}

function ProposalsByCollegeChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
        name:       r.college_name,
        Total:      r.total_proposals ?? 0,
        Accepted:   r.accepted        ?? 0,
        'Rejection %': parseFloat(r.rejection_rate_percent ?? 0),
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={40} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Total"    fill="#3b82f6" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Accepted" fill="#10b981" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
                columns={[term('college'), 'Total Proposals', 'Accepted', 'Rejection Rate']}
                rows={rows.map(r => [r.name, r.Total, r.Accepted, `${r['Rejection %']}%`])}
            />
        </div>
    );
}

function ComplaintsByCollegeChart({ data, onDrill }) {
    const rows = data.map(r => ({
        raw: r,
        name:        r.college_name,
        Total:       r.total_complaints ?? 0,
        Resolved:    (r.resolved ?? 0) + (r.dismissed ?? 0),
        Unresolved:  r.unresolved ?? 0,
        avgDays:     r.avg_resolution_days,
        level1:      r.level_1_college ?? 0,
        level2:      r.level_2_officer ?? 0,
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} {...AXIS} axisLine={false} width={40} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Resolved"   fill="#10b981" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                    <Bar dataKey="Unresolved" fill="#f43f5e" onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} radius={[6,6,0,0]} maxBarSize={44} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
                columns={[term('college'), 'Total', 'Resolved', 'Unresolved', 'Level 1 (College)', 'Level 2 (Officer)', 'Avg Resolution']}
                rows={rows.map(r => [
                    r.name, r.Total, r.Resolved, r.Unresolved, r.level1, r.level2,
                    r.avgDays != null ? `${r.avgDays}d` : '—',
                ])}
            />
        </div>
    );
}

/** One bar per goal in the goal's own colour; goals nobody tagged are left out of the chart, kept in the table. */
function SdgAlignmentChart({ data, onDrill }) {
    const rows = data.map(r => ({ raw: r, name: `${r.sdg}. ${r.goal}`, Proposals: Number(r.proposals ?? 0), Funded: Number(r.funded ?? 0), awarded: Number(r.awarded ?? 0), color: sdgByNumber(r.sdg)?.color ?? '#6366f1' }));
    const tagged = rows.filter(r => r.Proposals > 0);

    return (
        <div className="space-y-6">
            {tagged.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center">
                    <Globe2 size={28} className="text-gray-300" />
                    <p className="mt-2 text-sm font-medium text-gray-600">No proposals are tagged with SDGs yet</p>
                    <p className="mt-0.5 text-xs text-gray-400">Researchers choose goals in the first step of the proposal form.</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, tagged.length * 34)}>
                    <BarChart data={tagged} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                        <CartesianGrid {...GRID} horizontal={false} vertical />
                        <XAxis type="number" allowDecimals={false} {...AXIS} />
                        <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} />
                        <Tooltip {...TOOLTIP} />
                        <Legend {...LEGEND} />
                        <Bar dataKey="Proposals" radius={[0, 6, 6, 0]} maxBarSize={16} onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined}>
                            {tagged.map(r => <Cell key={r.raw.sdg} fill={r.color} />)}
                        </Bar>
                        <Bar dataKey="Funded" fill="#0f172a" radius={[0, 6, 6, 0]} maxBarSize={16} onClick={drill(onDrill)} cursor={onDrill ? 'pointer' : undefined} />
                    </BarChart>
                </ResponsiveContainer>
            )}
            <SummaryTable
                onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
                columns={['Goal', 'Proposals', 'Funded', 'Awarded']}
                rows={rows.map(r => [r.name, r.Proposals, r.Funded, r.awarded ? formatCurrency(r.awarded) : '—'])}
            />
        </div>
    );
}

const BUILDER_LABELS = {
    college: 'College', college_id: 'College', category: 'Category', status: 'Status', academic_year: 'Academic Year',
    level: 'Level', complaint_type: 'Complaint Type',
    count: 'Count', funded_count: 'Funded', rejected_count: 'Rejected',
    avg_resolution_days: 'Avg Resolution (days)', submitted_count: 'Submitted',
    avg_days_to_review: 'Avg Days to Review',
    department: 'Department', department_id: 'Department', call: 'Call', proposal_call_id: 'Call',
    research_type: 'Research Type', focus_area: 'Focus Area', pi_gender: 'PI Gender',
    submitted_month: 'Month Submitted', raised_month: 'Month Raised', assigned_month: 'Month Assigned',
    reviewer: 'Reviewer', review_type: 'Review Type', reviewer_kind: 'Internal / External',
    under_review_count: 'Under Review', completed_count: 'Completed', success_rate: 'Success Rate',
    total_budget: 'Total Budget', avg_budget: 'Avg Budget', open_count: 'Still Open', resolved_count: 'Resolved',
    escalated_count: 'Escalated', overdue_count: 'Overdue', declined_count: 'Declined', completion_rate: 'Completion Rate',
    review_workload: 'Review Workload',
};

export function builderLabel(key) {
    return BUILDER_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function ReportBuilderTable({ data }) {
    const dimensions = data?.dimensions ?? [];
    const metrics = data?.metrics ?? [];
    const rows = data?.rows ?? [];
    const columns = [...dimensions, ...metrics];

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Sliders size={36} className="mb-3" />
                <p className="text-sm font-medium">No rows matched this configuration</p>
            </div>
        );
    }

    return (
        <SummaryTable
            onRowClick={onDrill ? (i) => onDrill(rows[i].raw) : undefined}
            columns={columns.map(builderLabel)}
            rows={rows.map(r => columns.map(c => r[c] ?? '—'))}
        />
    );
}

export function SummaryTable({ columns, rows, onRowClick }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50/80">
                    <tr>
                        <th className="w-10 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">#</th>
                        {columns.map((c, j) => (
                            <th key={c} className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${j === 0 ? 'text-left' : 'text-right'}`}>{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => (
                        <tr key={i} onClick={onRowClick ? () => onRowClick(i) : undefined}
                            className={`transition-colors hover:bg-indigo-50/30 ${onRowClick ? 'cursor-pointer' : ''}`}>
                            <td className="px-4 py-2.5 text-xs font-medium tabular-nums text-gray-400">{i + 1}</td>
                            {row.map((cell, j) => (
                                <td key={j} className={`px-4 py-2.5 text-sm ${j === 0 ? 'text-left font-medium text-gray-900' : 'text-right tabular-nums text-gray-600'}`}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function renderChart(type, data, { onDrill } = {}) {
    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <AlertCircle size={36} className="mb-3" />
                <p className="text-sm font-medium">No data available for this report</p>
            </div>
        );
    }
    switch (type) {
        case 'proposal_count_by_category':  return <ProposalStatisticsChart data={data} onDrill={onDrill} />;
        case 'proposal_count_by_college':   return <ProposalsByCollegeChart data={data} onDrill={onDrill} />;
        case 'proposal_trend_by_year':      return <ProposalTrendChart data={data} onDrill={onDrill} />;
        case 'college_performance':          return <CollegePerformanceChart data={data} onDrill={onDrill} />;
        case 'reviewer_workload':            return <ReviewerWorkloadChart data={data} onDrill={onDrill} />;
        case 'budget_utilization':           return <BudgetUtilizationChart data={data} onDrill={onDrill} />;
        case 'approval_rate_by_category':    return <ApprovalRateChart data={data} onDrill={onDrill} />;
        case 'review_progress_pipeline':     return <ReviewPipelineChart data={data} onDrill={onDrill} />;
        case 'complaint_summary':            return <ComplaintsByCollegeChart data={data} onDrill={onDrill} />;
        case 'sdg_alignment':                return <SdgAlignmentChart data={data} onDrill={onDrill} />;
        case 'custom_builder':               return <ReportBuilderTable data={data} />;
        default:                             return <pre className="text-xs text-gray-600 overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
    }
}

// ─── Headline figures per report ──────────────────────────────────────────────

const num = (v) => Number(v ?? 0);
const sum = (rows, key) => rows.reduce((s, r) => s + num(r[key]), 0);
const pct = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
const compact = (v) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/**
 * Four headline figures for a report's rows: [{ label, value, hint?, tone }].
 * Tones: indigo, emerald, amber, red, slate.
 */
export function reportKpis(type, rows = []) {
    switch (type) {
        case 'proposal_count_by_category': {
            const total = sum(rows, 'total');
            return [
                { label: 'Proposals', value: total, tone: 'indigo' },
                { label: 'Under review', value: sum(rows, 'under_review'), tone: 'amber' },
                { label: 'Accepted', value: sum(rows, 'accepted'), hint: `${pct(sum(rows, 'accepted'), total)} of all`, tone: 'emerald' },
                { label: 'Rejected', value: sum(rows, 'rejected'), hint: `${pct(sum(rows, 'rejected'), total)} of all`, tone: 'red' },
            ];
        }
        case 'proposal_count_by_college': {
            const total = sum(rows, 'total_proposals');
            const top = [...rows].sort((a, b) => num(b.total_proposals) - num(a.total_proposals))[0];
            return [
                { label: 'Colleges', value: rows.length, tone: 'slate' },
                { label: 'Proposals', value: total, tone: 'indigo' },
                { label: 'Accepted', value: sum(rows, 'accepted'), hint: `${pct(sum(rows, 'accepted'), total)} acceptance`, tone: 'emerald' },
                { label: 'Most active', value: top ? num(top.total_proposals) : '—', hint: top?.college_name, tone: 'amber' },
            ];
        }
        case 'proposal_trend_by_year': {
            const last = rows[rows.length - 1];
            const prev = rows[rows.length - 2];
            const change = last && prev && num(prev.submitted) > 0 ? Math.round(((num(last.submitted) - num(prev.submitted)) / num(prev.submitted)) * 100) : null;
            return [
                { label: 'Years covered', value: rows.length, tone: 'slate' },
                { label: `Submitted ${last?.academic_year ?? ''}`.trim(), value: last ? num(last.submitted) : '—', hint: change != null ? `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs ${prev.academic_year}` : undefined, tone: 'indigo' },
                { label: 'Funded', value: last ? num(last.funded) : '—', hint: last?.academic_year, tone: 'emerald' },
                { label: 'Funding rate', value: last ? `${num(last.funded_rate_percent)}%` : '—', hint: last?.academic_year, tone: 'amber' },
            ];
        }
        case 'approval_rate_by_category': {
            const total = sum(rows, 'total_submitted');
            const accepted = sum(rows, 'total_accepted');
            const best = [...rows].sort((a, b) => num(b.approval_rate_percent) - num(a.approval_rate_percent))[0];
            return [
                { label: 'Submitted', value: total, tone: 'indigo' },
                { label: 'Accepted', value: accepted, tone: 'emerald' },
                { label: 'Approval rate', value: pct(accepted, total), tone: 'amber' },
                { label: 'Highest rate', value: best ? `${num(best.approval_rate_percent)}%` : '—', hint: best ? (CATEGORY_LABEL[best.category] ?? best.category) : undefined, tone: 'slate' },
            ];
        }
        case 'review_progress_pipeline': {
            const by = Object.fromEntries(rows.map((r) => [r.stage, num(r.count)]));
            const total = rows.reduce((s, r) => s + num(r.count), 0);
            const inReview = (by.under_blind_review ?? 0) + (by.blind_review_passed ?? 0) + (by.under_open_defence ?? 0) + (by.accepted ?? 0);
            const funded = (by.funded ?? 0) + (by.midterm_evaluation ?? 0) + (by.completed ?? 0);
            const busiest = [...rows].sort((a, b) => num(b.count) - num(a.count))[0];
            return [
                { label: 'In the pipeline', value: total, tone: 'indigo' },
                { label: 'In review', value: inReview, hint: 'Blind review to central evaluation', tone: 'amber' },
                { label: 'Funded & running', value: funded, tone: 'emerald' },
                { label: 'Busiest stage', value: busiest ? num(busiest.count) : '—', hint: busiest ? (STAGE_LABEL[busiest.stage] ?? busiest.stage) : undefined, tone: 'slate' },
            ];
        }
        case 'college_performance': {
            const submitted = sum(rows, 'proposals_submitted');
            return [
                { label: 'Proposals', value: submitted, tone: 'indigo' },
                { label: 'Accepted', value: sum(rows, 'proposals_accepted'), hint: `${pct(sum(rows, 'proposals_accepted'), submitted)} acceptance`, tone: 'emerald' },
                { label: 'Total awarded', value: `${currency()} ${compact(sum(rows, 'total_awarded'))}`, tone: 'amber' },
                { label: 'Research outputs', value: sum(rows, 'outputs_produced'), hint: `${sum(rows, 'publications_count')} journal articles`, tone: 'slate' },
            ];
        }
        case 'reviewer_workload': {
            const assigned = sum(rows, 'total_assigned');
            const submitted = sum(rows, 'submitted');
            const timed = rows.filter((r) => r.average_days_to_review != null && num(r.submitted) > 0);
            const avgDays = timed.length ? (timed.reduce((s, r) => s + num(r.average_days_to_review) * num(r.submitted), 0) / timed.reduce((s, r) => s + num(r.submitted), 0)).toFixed(1) : '—';
            return [
                { label: 'Reviewers', value: rows.length, tone: 'slate' },
                { label: 'Assignments', value: assigned, tone: 'indigo' },
                { label: 'Completed', value: submitted, hint: `${pct(submitted, assigned)} completion`, tone: 'emerald' },
                { label: 'Avg days to review', value: avgDays, tone: 'amber' },
            ];
        }
        case 'budget_utilization': {
            const allocated = sum(rows, 'allocated');
            const disbursed = sum(rows, 'disbursed');
            return [
                { label: 'Funded projects', value: rows.length, tone: 'slate' },
                { label: 'Allocated', value: `${currency()} ${compact(allocated)}`, tone: 'indigo' },
                { label: 'Disbursed', value: `${currency()} ${compact(disbursed)}`, hint: `${pct(disbursed, allocated)} of allocation`, tone: 'emerald' },
                { label: 'Settled', value: `${currency()} ${compact(sum(rows, 'settled'))}`, tone: 'amber' },
            ];
        }
        case 'complaint_summary': {
            const total = sum(rows, 'total_complaints');
            const closed = sum(rows, 'resolved') + sum(rows, 'dismissed');
            const timed = rows.filter((r) => r.avg_resolution_days != null);
            return [
                { label: 'Complaints', value: total, tone: 'indigo' },
                { label: 'Unresolved', value: sum(rows, 'unresolved'), tone: 'red' },
                { label: 'Resolution rate', value: pct(closed, total), tone: 'emerald' },
                { label: 'Avg days to resolve', value: timed.length ? (timed.reduce((s, r) => s + num(r.avg_resolution_days), 0) / timed.length).toFixed(1) : '—', tone: 'amber' },
            ];
        }
        case 'sdg_alignment': {
            const tagged = rows.filter((r) => num(r.proposals) > 0);
            const top = [...tagged].sort((a, b) => num(b.proposals) - num(a.proposals))[0];
            return [
                { label: 'Goals addressed', value: `${tagged.length} / 17`, tone: 'emerald' },
                { label: 'Top goal', value: top ? `SDG ${top.sdg}` : '—', hint: top?.goal, tone: 'indigo' },
                { label: 'Funded (goal links)', value: sum(rows, 'funded'), hint: 'A project can serve several goals', tone: 'amber' },
                { label: 'Awarded (goal links)', value: `${currency()} ${compact(sum(rows, 'awarded'))}`, tone: 'slate' },
            ];
        }
        default:
            return [];
    }
}
