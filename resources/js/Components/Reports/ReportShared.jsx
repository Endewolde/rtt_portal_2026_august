import { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line,
} from 'recharts';
import {
    TrendingUp, Users, TrendingDown, Building2, BookOpen, AlertCircle,
    Sliders, FileSpreadsheet, ChevronRight, CheckCircle2, BarChart2, Layers,
    CalendarRange,
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

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
    if (!snapshot || snapshot.status !== 'ready') return null;

    return (
        <button
            onClick={async () => {
                setDownloading(true);
                await downloadSnapshotExcel(snapshot, msg => alert(msg));
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

function ProposalTrendChart({ data }) {
    const rows = data.map(r => ({
        name:      r.academic_year,
        Submitted: r.submitted ?? 0,
        Funded:    r.funded ?? 0,
        Rejected:  r.rejected ?? 0,
        'Funded %': parseFloat(r.funded_rate_percent ?? 0),
    }));

    return (
        <div className="space-y-6">
            <ResponsiveContainer width="100%" height={320}>
                <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Submitted" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Funded"    stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Rejected"  stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
            </ResponsiveContainer>
            <SummaryTable
                columns={['Academic Year', 'Submitted', 'Funded', 'Rejected', 'Funded %']}
                rows={rows.map(r => [r.name, r['Submitted'], r['Funded'], r['Rejected'], `${r['Funded %']}%`])}
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
                            {['#', 'Tracker #', 'Title', 'Allocated', 'Disbursed', 'Settled', 'Utilization'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
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

function ComplaintsByCollegeChart({ data }) {
    const rows = data.map(r => ({
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Resolved"   fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="Unresolved" fill="#f43f5e" radius={[4,4,0,0]} />
                </BarChart>
            </ResponsiveContainer>
            <SummaryTable
                columns={['College', 'Total', 'Resolved', 'Unresolved', 'Level 1 (College)', 'Level 2 (Officer)', 'Avg Resolution']}
                rows={rows.map(r => [
                    r.name, r.Total, r.Resolved, r.Unresolved, r.level1, r.level2,
                    r.avgDays != null ? `${r.avgDays}d` : '—',
                ])}
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
            columns={columns.map(builderLabel)}
            rows={rows.map(r => columns.map(c => r[c] ?? '—'))}
        />
    );
}

export function SummaryTable({ columns, rows }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide w-10">#</th>
                        {columns.map(c => (
                            <th key={c} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs font-medium text-gray-400 tabular-nums">{i + 1}</td>
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

export function renderChart(type, data) {
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
        case 'proposal_trend_by_year':      return <ProposalTrendChart data={data} />;
        case 'college_performance':          return <CollegePerformanceChart data={data} />;
        case 'reviewer_workload':            return <ReviewerWorkloadChart data={data} />;
        case 'budget_utilization':           return <BudgetUtilizationChart data={data} />;
        case 'approval_rate_by_category':    return <ApprovalRateChart data={data} />;
        case 'review_progress_pipeline':     return <ReviewPipelineChart data={data} />;
        case 'complaint_summary':            return <ComplaintsByCollegeChart data={data} />;
        case 'custom_builder':               return <ReportBuilderTable data={data} />;
        default:                             return <pre className="text-xs text-gray-600 overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
    }
}
