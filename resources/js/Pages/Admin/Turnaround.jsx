import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import { Timer, AlertTriangle, CheckCircle2, BellRing, Hourglass, Gauge, Inbox, UserCheck, Users, Grid3x3, Layers } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import InsightsNav from '../../Components/InsightsNav';
import { PageHeader, Select, RefreshButton, StatCard, Panel, EmptyState, StatSkeletons, Skeleton, DataTable } from '../../Components/Insights/Kit';
import { get, post } from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { term } from '../../lib/terms';
import { programmeKeys } from '../../lib/programmes';

const fmt = (v) => (v === null || v === undefined ? '—' : `${v}d`);

/** One bar per stage: median days, with the target as a marker; over-target says so in words and an icon. */
function StageBars({ stages }) {
    const scale = Math.max(...stages.map((s) => Math.max(s.median ?? 0, s.target)), 1) * 1.15;

    return (
        <div className="space-y-4">
            {stages.map((s) => {
                const over = s.median !== null && s.median > s.target;
                return (
                    <div key={s.stage} title={`${s.label}: median ${fmt(s.median)}, average ${fmt(s.average)}, target ${s.target}d, ${s.count} proposals`}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate text-gray-700">{s.label} <span className="text-xs text-gray-400">· {s.count}</span></span>
                            <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                                <span className="font-semibold text-gray-900">{fmt(s.median)}</span>
                                {over
                                    ? <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-px text-[10px] font-semibold text-red-700"><AlertTriangle size={10} /> over {s.target}d</span>
                                    : s.median !== null && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-700"><CheckCircle2 size={10} /> on target</span>}
                            </span>
                        </div>
                        <div className="relative h-2.5 rounded-full bg-gray-100">
                            {s.median !== null && (
                                <div className={`h-2.5 rounded-full transition-all duration-700 ${over ? 'bg-linear-to-r from-indigo-500 to-red-500' : 'bg-indigo-500'}`} style={{ width: `${(s.median / scale) * 100}%` }} />
                            )}
                            <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-gray-800" style={{ left: `${(s.target / scale) * 100}%` }} />
                        </div>
                    </div>
                );
            })}
            <p className="flex items-center gap-2 pt-1 text-[11px] text-gray-400">
                <span className="inline-block h-2 w-4 rounded-full bg-indigo-500" /> median days in stage
                <span className="ml-3 inline-block h-3 w-0.5 bg-gray-800" /> target
            </p>
        </div>
    );
}

/** College × stage: average days, one hue light→dark; over-target cells also get an icon. */
function CollegeMatrix({ colleges, stages }) {
    const values = colleges.flatMap((c) => Object.values(c.stages)).filter((v) => v !== null);
    const max = Math.max(...values, 1);
    const shade = (v) => {
        const t = v / max;
        return t > 0.75 ? 'bg-indigo-600 text-white' : t > 0.5 ? 'bg-indigo-400 text-white' : t > 0.25 ? 'bg-indigo-200 text-indigo-900' : 'bg-indigo-50 text-indigo-900';
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
                <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500"><th className="px-4 py-2.5 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                        <th className="px-4 py-2.5 text-left">{term('college')}</th>
                        {stages.map((s) => <th key={s.stage} className="px-1 py-2.5 text-center">{s.label}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {colleges.map((c, rowIdx) => (
                        <tr key={c.college}><td className="px-4 py-2 w-10 text-xs font-medium tabular-nums text-gray-400">{rowIdx + 1}</td>
                            <td className="px-4 py-2 text-gray-800">{c.college}<span className="ml-1 text-xs text-gray-400">({c.proposals})</span></td>
                            {stages.map((s) => {
                                const v = c.stages[s.stage];
                                return (
                                    <td key={s.stage} className="px-1 py-2 text-center">
                                        {v === null ? <span className="text-gray-300">—</span> : (
                                            <span className={`inline-flex min-w-14 items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-xs font-semibold tabular-nums ${shade(v)}`}
                                                title={`${c.college} · ${s.label}: ${v} days on average (target ${s.target})`}>
                                                {v > s.target && <AlertTriangle size={10} />} {v}d
                                            </span>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function Turnaround() {
    const { accessScope } = useAuth();
    const toast = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ academic_year: '', college_id: '', category: '' });
    const [reminding, setReminding] = useState(null);

    const isCentral = accessScope.type === 'all';

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await get('/analytics/turnaround', Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
            setData(res.data);
            if (!filters.academic_year && res.data?.filters?.academic_year) {
                setFilters((f) => ({ ...f, academic_year: res.data.filters.academic_year }));
            }
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Could not load the turnaround report.');
        }
        setLoading(false);
    }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const remind = async (row) => {
        setReminding(row.id);
        try {
            const res = await post(`/analytics/turnaround/${row.id}/remind`, {});
            toast.success(res.message ?? 'Reminder sent.');
            load();
        } catch (e) {
            toast.warning(e.response?.data?.message ?? 'Could not send the reminder.');
        }
        setReminding(null);
    };

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

    return (
        <AppLayout breadcrumb="Turnaround">
            <InsightsNav />
            <div className="mx-auto max-w-7xl space-y-6">
                <PageHeader icon={Timer} color="indigo" title="Turnaround" description="How long proposals wait at each stage, what is stuck, and who to nudge.">
                    <Select label={term('academic_year')} value={filters.academic_year} onChange={(v) => setFilter('academic_year', v)}>
                        {(data?.academic_years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
                    </Select>
                    {isCentral && (
                        <Select label={term('college')} value={filters.college_id} onChange={(v) => setFilter('college_id', v)}>
                            <option value="">All {term('college', { plural: true, lower: true })}</option>
                            {(data?.college_options ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    )}
                    {isCentral && (
                        <Select label="Category" value={filters.category} onChange={(v) => setFilter('category', v)}>
                            <option value="">All categories</option>
                            {programmeKeys().map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                        </Select>
                    )}
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {loading && !data ? (
                    <>
                        <StatSkeletons />
                        <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
                    </>
                ) : data && (
                    <div className={`space-y-6 transition ${loading ? 'opacity-60' : ''}`}>
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <StatCard icon={Inbox} color="indigo" label="In progress" value={data.kpis.in_progress} hint="Submitted, not yet decided" />
                            <StatCard icon={AlertTriangle} color={data.stuck.length ? 'red' : 'emerald'} label="Stuck now" value={data.stuck.length} hint="Over the target for their stage" />
                            <StatCard icon={Gauge} color="violet" label="Submission → blind decision" value={fmt(data.kpis.median_days_to_blind_decision)} hint="Median days" />
                            <StatCard icon={Hourglass} color="amber" label="Submission → funding" value={fmt(data.kpis.median_days_to_funding)} hint="Median days" />
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <Panel title="Days per stage" subtitle="Median time a proposal spends in each stage" icon={Layers}>
                                <StageBars stages={data.stages} />
                            </Panel>

                            <Panel title="Reviewer turnaround" icon={Users} bodyClassName=""
                                subtitle={`Average ${fmt(data.reviewers.average_days)} from assignment to score · ${data.reviewers.overdue} review${data.reviewers.overdue === 1 ? '' : 's'} overdue now`}>
                                <DataTable
                                    rows={data.reviewers.slowest}
                                    rowKey={(r) => r.name}
                                    minWidth={360}
                                    empty={<EmptyState icon={Users} title="No reviews in this period yet" />}
                                    columns={[
                                        { key: 'name', label: 'Reviewer', className: 'font-medium text-gray-900' },
                                        { key: 'completed', label: 'Done', align: 'right' },
                                        { key: 'average_days', label: 'Avg days', align: 'right', render: (r) => fmt(r.average_days), className: 'font-semibold text-gray-900' },
                                        {
                                            key: 'overdue', label: 'Overdue', align: 'right',
                                            render: (r) => (r.overdue > 0
                                                ? <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"><AlertTriangle size={11} /> {r.overdue}</span>
                                                : <span className="text-xs text-gray-400">0</span>),
                                        },
                                    ]}
                                />
                            </Panel>
                        </div>

                        {data.colleges.length > 1 && (
                            <Panel title="Average days per stage, by college" icon={Grid3x3} bodyClassName=""
                                subtitle="Darker means longer; a warning icon marks averages over the stage target.">
                                <CollegeMatrix colleges={data.colleges} stages={data.stages} />
                            </Panel>
                        )}

                        <Panel title="Stuck proposals" icon={AlertTriangle} bodyClassName=""
                            subtitle="Longest over target first. Remind notifies whoever has to take the next step (at most once a day per stage).">
                            {data.stuck.length === 0 ? (
                                <EmptyState icon={UserCheck} title="Nothing is over its target" text="Everything is moving." />
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {data.stuck.map((row) => (
                                        <li key={row.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                                            <div className="min-w-0 flex-1">
                                                <Link href={`/proposals/${row.id}`} className="block text-sm font-medium text-gray-900 hover:text-indigo-700">
                                                    <span className="mr-2 font-mono text-xs font-semibold text-slate-500">{row.tracker_number}</span>
                                                    <span className="line-clamp-1 inline">{row.title}</span>
                                                </Link>
                                                <p className="mt-0.5 text-xs text-gray-500">{row.college ?? '—'} · {row.stage_label}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-red-700 ring-1 ring-red-200">
                                                    <AlertTriangle size={11} /> {row.days}d · {row.overdue_by}d over
                                                </span>
                                                <button
                                                    onClick={() => remind(row)}
                                                    disabled={reminding === row.id || !!row.reminder_cooldown_until}
                                                    title={row.reminder_cooldown_until ? 'Already reminded in the last 24 hours' : 'Notify whoever has to act next'}
                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                                                >
                                                    <BellRing size={13} /> {row.reminder_cooldown_until ? 'Reminded' : reminding === row.id ? 'Sending…' : 'Remind'}
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
