import { useState, useEffect, useCallback } from 'react';
import { Target, Pencil, Loader2, CheckCircle2, TrendingUp, AlertTriangle, Minus, Info } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, Select, Skeleton, EmptyState } from '../../Components/Insights/Kit';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { cn, formatDate } from '../../lib/utils';

const STATUS = {
    met: { label: 'Met', cls: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', icon: CheckCircle2 },
    on_track: { label: 'On track', cls: 'bg-sky-50 text-sky-700', bar: 'bg-sky-500', icon: TrendingUp },
    behind: { label: 'Behind', cls: 'bg-amber-50 text-amber-800', bar: 'bg-amber-500', icon: AlertTriangle },
    no_target: { label: 'No target', cls: 'bg-gray-100 text-gray-500', bar: 'bg-gray-300', icon: Minus },
};

const fmt = (n, money) => money ? `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : Number(n ?? 0).toLocaleString();

/** The academic years to choose from: this one, the two before and the next. */
const yearsAround = (year) => {
    const start = parseInt(String(year).slice(0, 4), 10) || new Date().getFullYear();
    return [start + 1, start, start - 1, start - 2].map((y) => `${y}-${y + 1}`);
};

export default function Targets() {
    const { success, error } = useToast();
    const [year, setYear] = useState('');
    const [data, setData] = useState(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        api.get('/insights/targets', { params: { academic_year: year || undefined } })
            .then((r) => { setData(r.data?.data); if (!year) setYear(r.data?.data?.academic_year); })
            .catch(() => setData(false));
    }, [year]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [load]);

    const startEdit = () => {
        setDraft(Object.fromEntries(data.metrics.map((m) => [m.key, m.target ?? ''])));
        setEditing(true);
    };
    const save = async () => {
        setSaving(true);
        try {
            const r = await api.put('/insights/targets', { academic_year: data.academic_year, targets: Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v === '' ? null : Number(v)])) });
            setData((d) => ({ ...d, ...r.data.data }));
            success('Targets saved.');
            setEditing(false);
        } catch (e) { error(e.response?.data?.message ?? 'Could not save the targets.'); }
        setSaving(false);
    };

    const withTarget = data ? data.metrics.filter((m) => m.target !== null) : [];
    const summary = Object.fromEntries(['met', 'on_track', 'behind'].map((k) => [k, withTarget.filter((m) => m.status === k).length]));

    return (
        <AppLayout breadcrumb="Strategic targets">
            <div className="mx-auto max-w-6xl space-y-5">
                <PageHeader icon={Target} color="violet" title="Strategic targets"
                    description="What the university set out to achieve this year, beside what it has achieved so far.">
                    {data && (
                        <Select label="Academic year" value={year} onChange={(v) => { setYear(v); setEditing(false); }} className="w-40">
                            {yearsAround(data.academic_year).map((y) => <option key={y} value={y}>{y}</option>)}
                        </Select>
                    )}
                    {data?.can_manage && !editing && (
                        <button onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Pencil size={14} /> Set targets</button>
                    )}
                </PageHeader>

                {data === false ? <Panel bodyClassName="p-0"><EmptyState icon={AlertTriangle} title="Could not load the targets" /></Panel> : !data ? <Skeleton className="h-96" /> : (
                    <>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm shadow-sm">
                            <span className="text-gray-600">{formatDate(data.window.from)} – {formatDate(data.window.to)} · <b className="text-gray-900">{data.year_elapsed}%</b> of the year gone</span>
                            {withTarget.length > 0 ? (
                                <span className="flex flex-wrap gap-2">
                                    {['met', 'on_track', 'behind'].map((k) => summary[k] > 0 && (
                                        <span key={k} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS[k].cls)}>{summary[k]} {STATUS[k].label.toLowerCase()}</span>
                                    ))}
                                </span>
                            ) : <span className="text-gray-500">No targets set for this year yet.</span>}
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <ul className="divide-y divide-gray-100">
                                {data.metrics.map((m) => {
                                    const st = STATUS[m.status];
                                    const pct = Math.min(100, m.progress ?? 0);
                                    return (
                                        <li key={m.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900">{m.label}</p>
                                                <p className="mt-0.5 flex items-start gap-1 text-[11px] text-gray-500"><Info size={11} className="mt-0.5 shrink-0" /> {m.how}</p>
                                            </div>
                                            <div>
                                                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                                                    <span><b className="tabular-nums text-gray-900">{fmt(m.actual, m.money)}</b>{m.target !== null && <span className="text-gray-500"> of {fmt(m.target, m.money)}</span>}</span>
                                                    {m.progress !== null && <span className="tabular-nums text-xs text-gray-500">{m.progress}%</span>}
                                                </div>
                                                <div className="relative h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                                                    <div className={cn('h-full rounded-full', st.bar)} style={{ width: `${m.target ? pct : 0}%` }} />
                                                    {/* Where the year is: on track means the bar has reached this line. */}
                                                    {m.target !== null && <div className="absolute inset-y-0 w-0.5 bg-gray-400" style={{ left: `${data.year_elapsed}%` }} />}
                                                </div>
                                            </div>
                                            <div className="sm:w-40 sm:text-right">
                                                {editing ? (
                                                    <input type="number" min="0" value={draft[m.key]} onChange={(e) => setDraft((d) => ({ ...d, [m.key]: e.target.value }))}
                                                        placeholder="No target" aria-label={`Target for ${m.label}`}
                                                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm tabular-nums focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-36" />
                                                ) : (
                                                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', st.cls)}><st.icon size={12} /> {st.label}</span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        {editing && (
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setEditing(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving && <Loader2 size={14} className="animate-spin" />} Save targets</button>
                            </div>
                        )}
                        <p className="text-xs text-gray-500">The grey line marks how much of the year has gone. A measure is on track when what has been achieved keeps pace with it.</p>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
