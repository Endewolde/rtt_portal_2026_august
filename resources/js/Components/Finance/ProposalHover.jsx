import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@inertiajs/react';
import {
    Loader2, Mail, Phone, Building2, CalendarDays, Hash, Users, Milestone, ClipboardCheck, ArrowRight, AlertTriangle,
} from 'lucide-react';
import api from '../../lib/api';
import { formatCurrency, formatDate, getStatusLabel } from '../../lib/utils';
import { programmeLabel, programmeColor } from '../../lib/programmes';

/** Cards already fetched this visit, keyed by proposal id. */
const cache = new Map();

const ROUND_STATUS = {
    draft: 'Draft', pending_signatures: 'Signing', submitted: 'College review', finance_returned: 'Returned',
    college_approved: 'Finance review', approved: 'Approved', disbursed: 'Paid', settled: 'Settled', rejected: 'Rejected',
};
const SETTLEMENT = { submitted: 'settlement with college', college_verified: 'settlement with finance', finance_verified: 'settled' };

function Flow({ money }) {
    const base = Math.max(money.awarded, money.requested, money.disbursed, 1);
    const rows = [
        ['Awarded', money.awarded, 'bg-slate-400'],
        ['Approved', money.approved, 'bg-indigo-500'],
        ['Paid out', money.disbursed, 'bg-teal-500'],
        ['Spent (settled)', money.spent, 'bg-emerald-500'],
    ];
    return (
        <div className="space-y-1.5">
            {rows.map(([label, v, bar]) => (
                <div key={label} className="grid grid-cols-[88px_1fr_auto] items-center gap-2 text-[11px]">
                    <span className="text-gray-500">{label}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full rounded-full ${bar}`} style={{ width: `${(v / base) * 100}%` }} /></span>
                    <span className="font-semibold tabular-nums text-gray-800">{formatCurrency(v)}</span>
                </div>
            ))}
            <p className="flex justify-between border-t border-gray-100 pt-1.5 text-[11px]">
                <span className="text-gray-500">Still to pay out</span>
                <span className="font-bold tabular-nums text-gray-900">{formatCurrency(money.remaining)}</span>
            </p>
            {money.unspent > 0 && <p className="text-[11px] text-amber-700">{formatCurrency(money.unspent)} unspent returned in settlements</p>}
        </div>
    );
}

function Card({ data, error, style, onEnter, onLeave }) {
    return (
        // Clicks inside stay inside, even when the trigger sits within a link or button.
        <div role="tooltip" style={style} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={(e) => e.stopPropagation()}
            className="fixed z-[60] w-[340px] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-2xl">
            {error ? (
                <p className="px-4 py-6 text-center text-xs text-gray-500">{error}</p>
            ) : !data ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading project…</div>
            ) : (
                <div className="max-h-[70vh] overflow-y-auto">
                    <div className="border-b border-gray-100 px-4 py-3" style={{ backgroundColor: `${programmeColor(data.category)}0d` }}>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-indigo-600">{data.tracker_number}</span>
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${programmeColor(data.category)}1f`, color: programmeColor(data.category) }}>{programmeLabel(data.category)}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">{getStatusLabel(data.status)}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-snug text-gray-900">{data.title}</p>
                        {data.call && <p className="mt-0.5 truncate text-[11px] text-gray-500">{data.call}</p>}
                    </div>

                    <div className="space-y-3 px-4 py-3 text-xs">
                        {data.pi && (
                            <div>
                                <p className="font-semibold text-gray-800">{data.pi.name} <span className="font-normal text-gray-400">· PI</span></p>
                                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                                    {data.pi.email && <a href={`mailto:${data.pi.email}`} className="inline-flex items-center gap-1 hover:text-indigo-600"><Mail size={10} /> {data.pi.email}</a>}
                                    {data.pi.phone && <a href={`tel:${data.pi.phone}`} className="inline-flex items-center gap-1 hover:text-indigo-600"><Phone size={10} /> {data.pi.phone}</a>}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-600">
                            {data.college && <span className="inline-flex min-w-0 items-center gap-1"><Building2 size={10} className="shrink-0 text-gray-400" /> <span className="truncate">{data.college}</span></span>}
                            {data.department && <span className="truncate">{data.department}</span>}
                            {data.academic_year && <span className="inline-flex items-center gap-1"><CalendarDays size={10} className="text-gray-400" /> {data.academic_year}</span>}
                            {data.duration_months && <span>{data.duration_months} months</span>}
                            {data.award?.grant_reference && <span className="inline-flex items-center gap-1 font-mono"><Hash size={10} className="text-gray-400" /> {data.award.grant_reference}</span>}
                            {data.award?.approved_at && <span>Awarded {formatDate(data.award.approved_at)}</span>}
                        </div>

                        {data.team?.length > 0 && (
                            <p className="flex items-start gap-1 text-[11px] text-gray-500">
                                <Users size={10} className="mt-0.5 shrink-0 text-gray-400" />
                                <span>{data.team.slice(0, 5).map((m) => m.name).join(', ')}{data.team.length > 5 ? ` +${data.team.length - 5}` : ''}</span>
                            </p>
                        )}

                        <div className="rounded-xl bg-gray-50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Money</p>
                                {data.allocation ? (
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${data.allocation.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        Allocation {data.allocation.status}{data.allocation.fiscal_year ? ` · FY ${data.allocation.fiscal_year}` : ''}
                                    </span>
                                ) : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Not allocated</span>}
                            </div>
                            <Flow money={data.money} />
                        </div>

                        {data.rounds?.length > 0 && (
                            <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Funding rounds</p>
                                <ul className="space-y-1">
                                    {data.rounds.map((r) => (
                                        <li key={r.round} className="flex items-center justify-between gap-2 text-[11px]">
                                            <span className="text-gray-700">Round {r.round} · <span className="text-gray-500">{ROUND_STATUS[r.status] ?? r.status}{r.settlement && r.status !== 'settled' ? `, ${SETTLEMENT[r.settlement]}` : ''}</span></span>
                                            <span className="font-semibold tabular-nums text-gray-800">{formatCurrency(r.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                            {data.milestones.total > 0 && (
                                <span className={`inline-flex items-center gap-1 ${data.milestones.overdue ? 'font-semibold text-red-600' : 'text-gray-600'}`}>
                                    {data.milestones.overdue ? <AlertTriangle size={10} /> : <Milestone size={10} />}
                                    Milestones {data.milestones.done}/{data.milestones.total}{data.milestones.overdue ? ` · ${data.milestones.overdue} overdue` : ''}
                                </span>
                            )}
                            {data.milestones.next && <span className="text-gray-500">Next: {data.milestones.next.title} ({formatDate(data.milestones.next.due_date)})</span>}
                            {data.midterm && (
                                <span className="inline-flex items-center gap-1 text-gray-600"><ClipboardCheck size={10} /> Midterm {data.midterm.status}{data.midterm.recommendation ? ` · ${data.midterm.recommendation}` : ''}</span>
                            )}
                        </div>
                    </div>

                    <Link href={`/proposals/${data.id}`} className="flex items-center justify-center gap-1 border-t border-gray-100 px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
                        Open the project <ArrowRight size={12} />
                    </Link>
                </div>
            )}
        </div>
    );
}

/**
 * Wrap a project's tracker number or title on any budget page: hovering (or
 * focusing) it shows the project's full picture without leaving the page.
 */
export default function ProposalHover({ id, children, className = '' }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(() => cache.get(id) ?? null);
    const [error, setError] = useState(null);
    const [style, setStyle] = useState({});
    const anchor = useRef(null);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);
    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (!e.target?.closest?.('[role="tooltip"]')) setOpen(false); };
        window.addEventListener('scroll', close, true);
        return () => window.removeEventListener('scroll', close, true);
    }, [open]);

    if (!id) return <span className={className}>{children}</span>;

    const place = () => {
        const r = anchor.current.getBoundingClientRect();
        const width = Math.min(340, window.innerWidth - 16);
        const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
        const below = window.innerHeight - r.bottom > 360 || r.top < 360;
        setStyle(below ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 });
    };

    const show = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            place();
            setOpen(true);
            if (!cache.has(id)) {
                api.get(`/proposals/${id}/finance-card`)
                    .then((r) => { cache.set(id, r.data?.data); setData(r.data?.data); })
                    .catch((e) => setError(e.response?.status === 403 ? 'You can’t see this project’s details.' : 'The project could not be loaded.'));
            } else {
                setData(cache.get(id));
            }
        }, 350);
    };
    const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 150); };
    const keep = () => clearTimeout(timer.current);

    return (
        <span ref={anchor} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
            className={`cursor-help decoration-dotted underline-offset-2 hover:underline ${className}`}>
            {children}
            {open && createPortal(<Card data={data} error={error} style={style} onEnter={keep} onLeave={hide} />, document.body)}
        </span>
    );
}
