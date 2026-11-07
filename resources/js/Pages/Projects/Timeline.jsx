import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import {
    CalendarRange, CheckCircle2, AlertTriangle, Clock, Circle, Flag, FileText, Users, Banknote, Presentation, PlayCircle, ArrowLeft,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, EmptyState, Skeleton } from '../../Components/Insights/Kit';
import api from '../../lib/api';
import { cn, formatDate } from '../../lib/utils';

const KIND = {
    start: { icon: PlayCircle, label: 'Start' },
    milestone: { icon: Flag, label: 'Milestone' },
    report: { icon: FileText, label: 'Report' },
    midterm: { icon: Users, label: 'Evaluation' },
    release: { icon: Banknote, label: 'Funds' },
    workshop: { icon: Presentation, label: 'Workshop' },
    end: { icon: Flag, label: 'End' },
};
const STATE = {
    done: { label: 'Done', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2 },
    overdue: { label: 'Overdue', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500', icon: AlertTriangle },
    due: { label: 'Due soon', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500', icon: Clock },
    later: { label: 'Later', cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-300', icon: Circle },
};

const day = (d) => new Date(`${d}T00:00:00`).getTime();

/** Months across the project, with every dated item placed on its row. */
function Chart({ data }) {
    const from = new Date(`${data.from}T00:00:00`);
    from.setDate(1);
    const to = new Date(`${data.to}T00:00:00`);
    to.setMonth(to.getMonth() + 1, 1);
    const span = Math.max(1, to - from);
    const at = (d) => `${((day(d) - from) / span) * 100}%`;
    const months = [];
    for (const m = new Date(from); m < to; m.setMonth(m.getMonth() + 1)) months.push(new Date(m));
    const rows = data.items.filter((i) => !['start', 'end'].includes(i.kind));
    const end = data.items.find((i) => i.kind === 'end');
    const start = data.items.find((i) => i.kind === 'start');

    return (
        <div className="overflow-x-auto">
            <div className="min-w-180">
                <div className="relative ml-56 flex h-7 border-b border-gray-200 text-[10px] font-semibold uppercase text-gray-400">
                    {months.map((m, i) => (
                        <div key={i} className="flex-1 border-l border-gray-100 pl-1 pt-1.5">{m.toLocaleDateString(undefined, { month: 'short' })}{(m.getMonth() === 0 || i === 0) && ` ${m.getFullYear()}`}</div>
                    ))}
                </div>
                <div className="relative">
                    {/* The project period, and today. */}
                    <div className="pointer-events-none absolute inset-y-0 left-56 right-0">
                        {start && <div className="absolute inset-y-0 bg-indigo-50/40" style={{ left: at(start.date), right: end ? `calc(100% - ${at(end.date)})` : 0 }} />}
                        {day(data.today) >= from && day(data.today) <= to && <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: at(data.today) }} title="Today" />}
                    </div>
                    {rows.map((it, i) => {
                        const st = STATE[it.state];
                        const K = KIND[it.kind];
                        return (
                            <div key={i} className="relative flex h-9 items-center border-b border-gray-50">
                                <div className="flex w-56 shrink-0 items-center gap-2 truncate pr-3 text-xs text-gray-700"><K.icon size={13} className="shrink-0 text-gray-400" /> <span className="truncate">{it.label}</span></div>
                                <div className="relative h-full flex-1">
                                    {it.start && <div className={cn('absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-40', st.dot)} style={{ left: at(it.start), width: `calc(${at(it.date)} - ${at(it.start)})` }} />}
                                    <span className={cn('absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white', st.dot)} style={{ left: at(it.date) }} title={`${it.label}: ${formatDate(it.date)} — ${st.label}`} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <p className="mt-2 flex flex-wrap gap-4 text-[11px] text-gray-500">
                {Object.entries(STATE).map(([k, s]) => <span key={k} className="inline-flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} /> {s.label}</span>)}
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-px bg-red-400" /> Today</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-indigo-50" /> Project period</span>
            </p>
        </div>
    );
}

export default function Timeline() {
    const id = window.location.pathname.split('/').filter(Boolean)[1];
    const [data, setData] = useState(null);
    useEffect(() => { api.get(`/projects/${id}/timeline`, { skipErrorToast: true }).then((r) => setData(r.data?.data)).catch(() => setData(false)); }, [id]);

    const s = data?.summary ?? {};
    return (
        <AppLayout breadcrumb="Project timeline">
            <div className="mx-auto max-w-6xl space-y-5">
                <Link href={`/proposals/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"><ArrowLeft size={14} /> Back to the project</Link>
                <PageHeader icon={CalendarRange} color="indigo" title={data ? data.project.title : 'Project timeline'}
                    description={data ? `${data.project.tracker_number} · what is done, what is due, and what is late` : ' '} />
                {data === false ? <Panel bodyClassName="p-0"><EmptyState icon={CalendarRange} title="No timeline" text="Timelines are for funded projects you work on or oversee." /></Panel>
                    : !data ? <Skeleton className="h-80" /> : (
                        <>
                            <div className="flex flex-wrap gap-2">
                                {['overdue', 'due', 'done', 'later'].map((k) => s[k] > 0 && (
                                    <span key={k} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', STATE[k].cls)}>{s[k]} {STATE[k].label.toLowerCase()}</span>
                                ))}
                            </div>
                            <Panel title="At a glance"><Chart data={data} /></Panel>
                            <Panel title="Everything in order" bodyClassName="p-0">
                                <ol className="divide-y divide-gray-100">
                                    {data.items.map((it, i) => {
                                        const st = STATE[it.state];
                                        const K = KIND[it.kind];
                                        return (
                                            <li key={i} className="flex items-center gap-3 px-5 py-3">
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500"><K.icon size={15} /></span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-medium text-gray-900">{it.label}</span>
                                                    <span className="block text-xs text-gray-500">
                                                        {it.start ? `${formatDate(it.start)} – ` : ''}{formatDate(it.date)}
                                                        {it.done_at && it.done_at !== it.date && ` · done ${formatDate(it.done_at)}`}
                                                        {it.amount ? ` · ${Number(it.amount).toLocaleString()} ETB` : ''}
                                                    </span>
                                                </span>
                                                <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', st.cls)}><st.icon size={12} /> {st.label}</span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </Panel>
                        </>
                    )}
            </div>
        </AppLayout>
    );
}
