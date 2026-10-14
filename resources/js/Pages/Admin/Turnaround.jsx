import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import { Timer, RefreshCw, AlertTriangle, CheckCircle2, BellRing, Hourglass, Gauge, Inbox, UserCheck } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';

const fmt = (v) => (v === null || v === undefined ? '—' : `${v}d`);

function Kpi({ icon: Icon, label, value, hint }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500"><Icon size={14} /> {label}</div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
        </div>
    );
}

/** One bar per stage: median days (single hue) with the target as a marker; over-target says so in words + icon. */
function StageBars({ stages }) {
    const scale = Math.max(...stages.map((s) => Math.max(s.median ?? 0, s.target)), 1) * 1.15;

    return (
        <div className="space-y-3.5">
            {stages.map((s) => {
                const over = s.median !== null && s.median > s.target;
                return (
                    <div key={s.stage} className="grid grid-cols-[9.5rem_1fr_6.5rem] items-center gap-3 text-sm" title={`${s.label}: median ${fmt(s.median)}, average ${fmt(s.average)}, target ${s.target}d, ${s.count} proposals`}>
                        <span className="truncate text-gray-700">{s.label}</span>
                        <div className="relative h-3 rounded bg-gray-100">
                            {s.median !== null && (
                                <div className="h-3 rounded-r bg-indigo-500" style={{ width: `${(s.median / scale) * 100}%` }} />
                            )}
                            <div className="absolute -top-1 h-5 w-0.5 bg-gray-800" style={{ left: `${(s.target / scale) * 100}%` }} />
                        </div>
                        <span className="flex items-center justify-end gap-1 tabular-nums">
                            <span className="font-semibold text-gray-900">{fmt(s.median)}</span>
                            {over
                                ? <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-600"><AlertTriangle size={11} /> over</span>
                                : s.median !== null && <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600"><CheckCircle2 size={11} /> ok</span>}
                        </span>
                    </div>
                );
            })}
            <p className="flex items-center gap-2 text-[11px] text-gray-400">
                <span className="inline-block h-2 w-4 rounded-sm bg-indigo-500" /> median days in stage
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
                    <tr className="text-left text-xs font-semibold text-gray-500">
                        <th className="py-2 pr-3">College</th>
                        {stages.map((s) => <th key={s.stage} className="px-1 py-2 text-center">{s.label}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {colleges.map((c) => (
                        <tr key={c.college} className="border-t border-gray-100">
                            <td className="py-1.5 pr-3 text-gray-800">{c.college}<span className="ml-1 text-xs text-gray-400">({c.proposals})</span></td>
                            {stages.map((s) => {
                                const v = c.stages[s.stage];
                                return (
                                    <td key={s.stage} className="px-1 py-1.5 text-center">
                                        {v === null ? <span className="text-gray-300">—</span> : (
                                            <span className={`inline-flex min-w-[3.5rem] items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-semibold tabular-nums ${shade(v)}`}
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
    const { hasAnyRole } = useAuth();
    const toast = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ academic_year: '', college_id: '', category: '' });
    const [reminding, setReminding] = useState(null);

    const isCentral = hasAnyRole(['super_admin', 'admin', 'central_officer']);

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
            <div className="mx-auto max-w-7xl space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white"><Timer size={20} /></span>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Turnaround</h1>
                            <p className="text-sm text-gray-500">How long proposals wait at each stage, what is stuck, and who to nudge</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select value={filters.academic_year} onChange={(e) => setFilter('academic_year', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            {(data?.academic_years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {isCentral && (
                            <select value={filters.college_id} onChange={(e) => setFilter('college_id', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                                <option value="">All colleges</option>
                                {(data?.college_options ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        )}
                        {isCentral && (
                            <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                                <option value="">All categories</option>
                                {['research', 'community_engagement', 'technology_transfer'].map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                            </select>
                        )}
                        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                {loading && !data ? (
                    <div className="grid animate-pulse gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-gray-100" />)}</div>
                ) : data && (
                    <>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <Kpi icon={Inbox} label="In progress" value={data.kpis.in_progress} hint="Submitted, not yet decided" />
                            <Kpi icon={AlertTriangle} label="Stuck now" value={data.stuck.length} hint="Over the target for their stage" />
                            <Kpi icon={Gauge} label="Submission → blind decision" value={fmt(data.kpis.median_days_to_blind_decision)} hint="Median days" />
                            <Kpi icon={Hourglass} label="Submission → funding" value={fmt(data.kpis.median_days_to_funding)} hint="Median days" />
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                            <section className="rounded-2xl border border-gray-200 bg-white p-5">
                                <h2 className="mb-4 text-sm font-semibold text-gray-900">Days per stage</h2>
                                <StageBars stages={data.stages} />
                            </section>

                            <section className="rounded-2xl border border-gray-200 bg-white p-5">
                                <h2 className="mb-1 text-sm font-semibold text-gray-900">Reviewer turnaround</h2>
                                <p className="mb-3 text-xs text-gray-500">
                                    Average {fmt(data.reviewers.average_days)} from assignment to score · {data.reviewers.overdue} review{data.reviewers.overdue === 1 ? '' : 's'} overdue now
                                </p>
                                {data.reviewers.slowest.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-gray-400">No reviews in this period yet.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-left text-xs font-semibold text-gray-500"><th className="py-1.5">Reviewer</th><th className="py-1.5 text-right">Done</th><th className="py-1.5 text-right">Avg days</th><th className="py-1.5 text-right">Overdue</th></tr></thead>
                                        <tbody>
                                            {data.reviewers.slowest.map((r) => (
                                                <tr key={r.name} className="border-t border-gray-100">
                                                    <td className="py-1.5 text-gray-800">{r.name}</td>
                                                    <td className="py-1.5 text-right tabular-nums text-gray-600">{r.completed}</td>
                                                    <td className="py-1.5 text-right tabular-nums text-gray-900">{fmt(r.average_days)}</td>
                                                    <td className="py-1.5 text-right">
                                                        {r.overdue > 0
                                                            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle size={11} /> {r.overdue}</span>
                                                            : <span className="text-xs text-gray-400">0</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </section>
                        </div>

                        {data.colleges.length > 1 && (
                            <section className="rounded-2xl border border-gray-200 bg-white p-5">
                                <h2 className="mb-1 text-sm font-semibold text-gray-900">Average days per stage, by college</h2>
                                <p className="mb-3 text-xs text-gray-500">Darker = longer. <AlertTriangle size={11} className="inline" /> marks averages over the stage target.</p>
                                <CollegeMatrix colleges={data.colleges} stages={data.stages} />
                            </section>
                        )}

                        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                            <div className="border-b border-gray-100 px-5 py-3">
                                <h2 className="text-sm font-semibold text-gray-900">Stuck proposals</h2>
                                <p className="text-xs text-gray-500">Longest over target first. Remind notifies whoever has to take the next step (at most once a day per stage).</p>
                            </div>
                            {data.stuck.length === 0 ? (
                                <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><UserCheck size={16} className="text-emerald-500" /> Nothing is over its target — everything is moving.</div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {data.stuck.map((row) => (
                                        <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                                            <div className="min-w-0 flex-1">
                                                <Link href={`/proposals/${row.id}`} className="block truncate text-sm font-medium text-gray-900 hover:text-indigo-700">
                                                    <span className="mr-2 font-mono text-xs text-indigo-600">{row.tracker_number}</span>{row.title}
                                                </Link>
                                                <p className="mt-0.5 text-xs text-gray-500">{row.college ?? '—'} · {row.stage_label}</p>
                                            </div>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 tabular-nums">
                                                <AlertTriangle size={11} /> {row.days}d · {row.overdue_by}d over
                                            </span>
                                            <button
                                                onClick={() => remind(row)}
                                                disabled={reminding === row.id || !!row.reminder_cooldown_until}
                                                title={row.reminder_cooldown_until ? 'Already reminded in the last 24 hours' : 'Notify whoever has to act next'}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <BellRing size={13} /> {row.reminder_cooldown_until ? 'Reminded' : reminding === row.id ? 'Sending…' : 'Remind'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
