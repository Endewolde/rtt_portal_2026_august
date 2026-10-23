import { useState, useEffect } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
    Files, Hourglass, Trophy, Target, Wallet, ShieldAlert, ArrowRight, ChevronDown, Users, MessageSquareWarning,
    Sparkles, TrendingUp, TrendingDown,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import InsightsNav, { useInsightsPages } from '../../Components/InsightsNav';
import { useAuth } from '../../hooks/useAuth';
import { get } from '../../lib/api';
import { getStatusLabel } from '../../lib/utils';

const STAGE_COLORS = ['#6366f1', '#4f46e5', '#f59e0b', '#f97316', '#8b5cf6', '#14b8a6', '#10b981', '#06b6d4', '#0ea5e9'];
const compact = (v) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v ?? 0));
const n = (v) => Number(v ?? 0);

/** Load one widget's data; a widget the person may not see simply stays empty. */
function useData(path, params, enabled = true) {
    const [state, setState] = useState({ loading: enabled, data: null, meta: null });
    const key = JSON.stringify(params);
    useEffect(() => {
        if (!enabled) { setState({ loading: false, data: null, meta: null }); return; }
        let alive = true;
        setState((s) => ({ ...s, loading: true }));
        get(path, params)
            .then((r) => alive && setState({ loading: false, data: r.data ?? null, meta: r.meta ?? null }))
            .catch(() => alive && setState({ loading: false, data: null, meta: null }));
        return () => { alive = false; };
    }, [path, key, enabled]);
    return state;
}

function Kpi({ icon: Icon, label, value, hint, tone, loading, href }) {
    const body = (
        <div className="group relative h-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon size={15} /></span>
            </div>
            {loading
                ? <div className="mt-3 h-7 w-16 animate-pulse rounded bg-gray-100" />
                : <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>}
            <p className="mt-0.5 min-h-4 truncate text-[11px] text-gray-400">{loading ? '' : hint}</p>
        </div>
    );
    return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Panel({ title, subtitle, href, children, className = '' }) {
    return (
        <section className={`flex flex-col rounded-2xl border border-gray-200 bg-white ${className}`}>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div>
                    <h2 className="font-semibold text-gray-900">{title}</h2>
                    {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
                </div>
                {href && (
                    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                        Open <ArrowRight size={13} />
                    </Link>
                )}
            </div>
            <div className="flex-1 p-5">{children}</div>
        </section>
    );
}

function Skeleton({ h = 'h-48' }) {
    return <div className={`${h} animate-pulse rounded-xl bg-gray-100`} />;
}

function Meter({ label, value, max, color }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="text-gray-600">{label}</span>
                <span className="font-semibold tabular-nums text-gray-900">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
        </div>
    );
}

export default function InsightsIndex() {
    const { app_settings } = usePage().props;
    const { hasPermission } = useAuth();
    const pages = useInsightsPages();
    const [year, setYear] = useState(app_settings?.current_academic_year ?? '');

    const canReports = hasPermission('reports.view_any');
    const canRisk = hasPermission('monitoring.ongoing');
    const yearParams = year ? { academic_year: year } : {};

    const stats = useData('/proposals/statistics', yearParams);
    const pipeline = useData('/reports/live/review_progress_pipeline', yearParams, canReports);
    const trend = useData('/reports/live/proposal_trend_by_year', {}, canReports);
    const budget = useData('/reports/live/budget_utilization', yearParams, canReports);
    const reviewers = useData('/reports/live/reviewer_workload', yearParams, canReports);
    const complaints = useData('/reports/live/complaint_summary', yearParams, canReports);
    const risk = useData('/projects-at-risk', {}, canRisk);

    const totals = stats.data?.totals ?? {};
    const decided = n(totals.funded) + n(totals.rejected);
    const successRate = decided > 0 ? Math.round((n(totals.funded) / decided) * 100) : null;
    const years = stats.data?.available_years ?? [];

    const allocated = (budget.data ?? []).reduce((s, r) => s + n(r.allocated), 0);
    const disbursed = (budget.data ?? []).reduce((s, r) => s + n(r.disbursed), 0);
    const settled = (budget.data ?? []).reduce((s, r) => s + n(r.settled), 0);

    const stages = (pipeline.data ?? []).filter((s) => n(s.count) > 0);
    const maxStage = Math.max(1, ...stages.map((s) => n(s.count)));

    const trendRows = (trend.data ?? []).map((r) => ({ year: r.academic_year, Submitted: n(r.submitted), Funded: n(r.funded) }));
    const last = trendRows[trendRows.length - 1];
    const prev = trendRows[trendRows.length - 2];
    const growth = last && prev && prev.Submitted > 0 ? Math.round(((last.Submitted - prev.Submitted) / prev.Submitted) * 100) : null;

    const assigned = (reviewers.data ?? []).reduce((s, r) => s + n(r.total_assigned), 0);
    const reviewed = (reviewers.data ?? []).reduce((s, r) => s + n(r.submitted), 0);
    const pendingReviews = (reviewers.data ?? []).reduce((s, r) => s + n(r.pending), 0);
    const timed = (reviewers.data ?? []).filter((r) => r.average_days_to_review != null && n(r.submitted) > 0);
    const avgDays = timed.length ? (timed.reduce((s, r) => s + n(r.average_days_to_review) * n(r.submitted), 0) / timed.reduce((s, r) => s + n(r.submitted), 0)).toFixed(1) : null;

    const complaintTotal = (complaints.data ?? []).reduce((s, r) => s + n(r.total_complaints), 0);
    const unresolved = (complaints.data ?? []).reduce((s, r) => s + n(r.unresolved), 0);

    const riskSummary = risk.data?.summary;
    const tools = pages.filter((p) => p.href !== '/insights');

    return (
        <AppLayout breadcrumb="Insights">
            <InsightsNav />
            <div className="mx-auto max-w-7xl space-y-6">

                {/* Hero */}
                <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 py-7 text-white sm:px-8">
                    <span className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
                    <span className="absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-200 ring-1 ring-white/15">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                </span>
                                Live
                            </span>
                            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Insights</h1>
                            <p className="mt-1 max-w-xl text-sm text-slate-300">Research, community engagement and technology transfer at a glance — proposals, reviews, money and service, as of right now.</p>
                        </div>
                        <label className="relative self-start md:self-auto">
                            <span className="sr-only">Academic year</span>
                            <select value={year} onChange={(e) => setYear(e.target.value)}
                                className="appearance-none rounded-xl bg-white/10 py-2.5 pl-4 pr-10 text-sm font-semibold text-white ring-1 ring-white/20 focus:outline-none focus:ring-white/50">
                                <option value="" className="text-gray-900">All academic years</option>
                                {[...new Set([year, ...years].filter(Boolean))].map((y) => <option key={y} value={y} className="text-gray-900">{y}</option>)}
                            </select>
                            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        </label>
                    </div>
                </div>

                {/* Headline figures */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <Kpi icon={Files} label="Submitted" value={n(totals.submitted)} tone="bg-indigo-100 text-indigo-600" loading={stats.loading} hint={`${n(totals.draft)} still in draft`} href="/proposals" />
                    <Kpi icon={Hourglass} label="Under review" value={n(totals.under_review)} tone="bg-amber-100 text-amber-600" loading={stats.loading} hint="Blind review to evaluation" href="/admin/proposal-pipeline" />
                    <Kpi icon={Trophy} label="Funded" value={n(totals.funded)} tone="bg-emerald-100 text-emerald-600" loading={stats.loading} hint="Including running projects" />
                    <Kpi icon={Target} label="Success rate" value={successRate != null ? `${successRate}%` : '—'} tone="bg-violet-100 text-violet-600" loading={stats.loading} hint="Funded of all decided" />
                    {canReports && (
                        <Kpi icon={Wallet} label="Disbursed" value={`ETB ${compact(disbursed)}`} tone="bg-teal-100 text-teal-600" loading={budget.loading}
                            hint={allocated > 0 ? `${Math.round((disbursed / allocated) * 100)}% of ETB ${compact(allocated)}` : 'Nothing allocated'} href="/reports?type=budget_utilization" />
                    )}
                    {canRisk && (
                        <Kpi icon={ShieldAlert} label="Projects at risk" value={n(riskSummary?.high)} tone="bg-red-100 text-red-600" loading={risk.loading}
                            hint={riskSummary ? `${n(riskSummary.watch)} more to watch` : ''} href="/projects-at-risk" />
                    )}
                </div>

                {canReports && (
                    <div className="grid gap-6 lg:grid-cols-5">
                        {/* Funnel */}
                        <Panel title="Where proposals are" subtitle={year || 'All academic years'} href={`/reports?type=review_progress_pipeline${year ? `&academic_year=${year}` : ''}`} className="lg:col-span-2">
                            {pipeline.loading ? <Skeleton h="h-64" /> : stages.length === 0 ? (
                                <p className="py-16 text-center text-sm text-gray-400">No proposals in the pipeline.</p>
                            ) : (
                                <ul className="space-y-2.5">
                                    {stages.map((s, i) => (
                                        <li key={s.stage}>
                                            <Link href={`/proposals?status=${s.stage}${year ? `&academic_year=${year}` : ''}`} className="group block">
                                                <div className="mb-1 flex items-baseline justify-between text-sm">
                                                    <span className="text-gray-600 group-hover:text-gray-900">{getStatusLabel(s.stage)}</span>
                                                    <span className="font-semibold tabular-nums text-gray-900">{n(s.count)}</span>
                                                </div>
                                                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                                                    <div className="h-full rounded-full transition-all duration-700 group-hover:opacity-80"
                                                        style={{ width: `${(n(s.count) / maxStage) * 100}%`, backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }} />
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>

                        {/* Trend */}
                        <Panel title="Year over year" subtitle="Submitted and funded proposals" href="/reports?type=proposal_trend_by_year" className="lg:col-span-3">
                            {trend.loading ? <Skeleton h="h-64" /> : trendRows.length === 0 ? (
                                <p className="py-16 text-center text-sm text-gray-400">No history yet.</p>
                            ) : (
                                <>
                                    {growth != null && (
                                        <p className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${growth >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                            {growth >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                            {Math.abs(growth)}% {growth >= 0 ? 'more' : 'fewer'} submissions in {last.year} than {prev.year}
                                        </p>
                                    )}
                                    <ResponsiveContainer width="100%" height={240}>
                                        <AreaChart data={trendRows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                            <defs>
                                                <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                                                <linearGradient id="gFun" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="4 4" stroke="#eef0f3" vertical={false} />
                                            <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                                            <Area type="monotone" dataKey="Submitted" stroke="#6366f1" strokeWidth={2.5} fill="url(#gSub)" />
                                            <Area type="monotone" dataKey="Funded" stroke="#10b981" strokeWidth={2.5} fill="url(#gFun)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </>
                            )}
                        </Panel>
                    </div>
                )}

                {canReports && (
                    <div className="grid gap-6 md:grid-cols-3">
                        <Panel title="Money" subtitle="Allocated, released and settled" href={`/reports?type=budget_utilization${year ? `&academic_year=${year}` : ''}`}>
                            {budget.loading ? <Skeleton h="h-32" /> : (
                                <div className="space-y-4">
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-2xl font-bold tabular-nums text-gray-900">ETB {compact(allocated)}</p>
                                        <p className="text-xs text-gray-400">allocated</p>
                                    </div>
                                    <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                                        <div className="bg-emerald-600" style={{ width: `${allocated > 0 ? Math.min(100, (settled / allocated) * 100) : 0}%` }} />
                                        <div className="bg-emerald-300" style={{ width: `${allocated > 0 ? Math.min(100, (Math.max(0, disbursed - settled) / allocated) * 100) : 0}%` }} />
                                    </div>
                                    <ul className="space-y-1.5 text-sm">
                                        {[
                                            ['bg-emerald-600', 'Settled', settled],
                                            ['bg-emerald-300', 'Released, not yet settled', Math.max(0, disbursed - settled)],
                                            ['bg-gray-200', 'Not yet released', Math.max(0, allocated - disbursed)],
                                        ].map(([dot, label, value]) => (
                                            <li key={label} className="flex items-center gap-2">
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                                                <span className="flex-1 text-gray-600">{label}</span>
                                                <span className="font-semibold tabular-nums text-gray-900">ETB {compact(value)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Panel>

                        <Panel title="Reviews" subtitle="Reviewer assignments" href={`/reports?type=reviewer_workload${year ? `&academic_year=${year}` : ''}`}>
                            {reviewers.loading ? <Skeleton h="h-32" /> : (
                                <div className="space-y-4">
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-2xl font-bold tabular-nums text-gray-900">{assigned > 0 ? Math.round((reviewed / assigned) * 100) : 0}%</p>
                                        <p className="text-xs text-gray-400">completed</p>
                                    </div>
                                    <Meter label="Completed" value={reviewed} max={assigned} color="#6366f1" />
                                    <Meter label="Waiting to start" value={pendingReviews} max={assigned} color="#f59e0b" />
                                    <p className="flex items-center gap-1.5 text-xs text-gray-500"><Users size={13} /> {(reviewers.data ?? []).length} reviewers{avgDays && <> · {avgDays} days on average</>}</p>
                                </div>
                            )}
                        </Panel>

                        <Panel title="Complaints" subtitle="Raised on proposals" href={`/reports?type=complaint_summary${year ? `&academic_year=${year}` : ''}`}>
                            {complaints.loading ? <Skeleton h="h-32" /> : complaintTotal === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center py-6 text-center">
                                    <Sparkles size={22} className="text-emerald-400" />
                                    <p className="mt-2 text-sm font-medium text-gray-600">No complaints</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-2xl font-bold tabular-nums text-gray-900">{complaintTotal}</p>
                                        <p className="text-xs text-gray-400">complaints</p>
                                    </div>
                                    <Meter label="Resolved or dismissed" value={complaintTotal - unresolved} max={complaintTotal} color="#10b981" />
                                    <Meter label="Still open" value={unresolved} max={complaintTotal} color="#f43f5e" />
                                    <p className="flex items-center gap-1.5 text-xs text-gray-500"><MessageSquareWarning size={13} /> {Math.round(((complaintTotal - unresolved) / complaintTotal) * 100)}% resolution rate</p>
                                </div>
                            )}
                        </Panel>
                    </div>
                )}

                {/* Tools */}
                {tools.length > 0 && (
                    <section>
                        <div className="mb-3 flex items-center gap-2">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Explore</h2>
                            <span className="h-px flex-1 bg-gray-200" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {tools.map(({ href, label, icon: Icon, desc }) => (
                                <Link key={href} href={href}
                                    className="group flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                                        <Icon size={18} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-1 font-semibold text-gray-900">{label} <ArrowRight size={13} className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" /></span>
                                        <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{desc}</span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </AppLayout>
    );
}
