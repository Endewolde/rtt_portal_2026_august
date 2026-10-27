import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@inertiajs/react';
import {
    Loader2, Mail, Phone, Building2, BadgeCheck, ShieldCheck, Lock, Clock, FileText, ClipboardCheck, Users, Handshake, ArrowRight, IdCard,
} from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';

/** Cards already fetched this visit, keyed by user id. */
const cache = new Map();

const ago = (iso) => {
    if (!iso) return 'Never';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : formatDate(iso);
};

const STATUS = {
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    inactive: 'bg-gray-100 text-gray-600 ring-gray-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    suspended: 'bg-red-50 text-red-700 ring-red-200',
};

function Stat({ icon: Icon, value, label, hint }) {
    return (
        <div className="rounded-xl bg-gray-50 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[10px] text-gray-500"><Icon size={10} /> {label}</p>
            <p className="text-sm font-bold tabular-nums text-gray-900">{value}</p>
            {hint && <p className="truncate text-[10px] text-gray-400">{hint}</p>}
        </div>
    );
}

function Card({ data, error, style, onEnter, onLeave }) {
    const initials = (data?.name ?? '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div role="tooltip" style={style} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={(e) => e.stopPropagation()}
            className="fixed z-[60] w-[340px] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-2xl">
            {error ? (
                <p className="px-4 py-6 text-center text-xs text-gray-500">{error}</p>
            ) : !data ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : (
                <div className="max-h-[70vh] overflow-y-auto">
                    <div className="flex items-start gap-3 border-b border-gray-100 bg-linear-to-br from-indigo-50 to-white px-4 py-3">
                        {data.avatar
                            ? <img src={data.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white" />
                            : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white ring-2 ring-white">{initials}</span>}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">{[data.title, data.name].filter(Boolean).join(' ')}</p>
                            <a href={`mailto:${data.email}`} className="flex items-center gap-1 truncate text-[11px] text-gray-600 hover:text-indigo-600"><Mail size={10} className="shrink-0" /> <span className="truncate">{data.email}</span></a>
                            {data.phone && <a href={`tel:${data.phone}`} className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-indigo-600"><Phone size={10} /> {data.phone}</a>}
                        </div>
                        {data.status && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ${STATUS[data.status] ?? STATUS.inactive}`}>{data.status}</span>}
                    </div>

                    <div className="space-y-3 px-4 py-3 text-xs">
                        {data.roles?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {data.roles.map((r) => <span key={r} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"><ShieldCheck size={10} /> {r}</span>)}
                            </div>
                        )}

                        <div className="space-y-1 text-[11px] text-gray-600">
                            {(data.college || data.department) && <p className="flex items-start gap-1.5"><Building2 size={11} className="mt-0.5 shrink-0 text-gray-400" /> {[data.department, data.college].filter(Boolean).join(' · ')}</p>}
                            {data.affiliation && !data.college && <p className="flex items-start gap-1.5"><Building2 size={11} className="mt-0.5 shrink-0 text-gray-400" /> {data.affiliation}</p>}
                            {(data.employee_id || data.gender) && <p className="flex items-center gap-1.5"><IdCard size={11} className="text-gray-400" /> {[data.employee_id && `ID ${data.employee_id}`, data.gender && <span key="g" className="capitalize">{data.gender}</span>].filter(Boolean).reduce((a, b) => [a, ' · ', b])}</p>}
                            {data.expertise && <p className="line-clamp-2 text-gray-500">{Array.isArray(data.expertise) ? data.expertise.join(', ') : data.expertise}</p>}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                            <Stat icon={FileText} label="Proposals" value={data.activity.proposals} hint={data.activity.funded ? `${data.activity.funded} funded` : data.activity.in_review ? `${data.activity.in_review} in review` : null} />
                            <Stat icon={Users} label="Team of" value={data.activity.team_of} />
                            <Stat icon={ClipboardCheck} label="Reviews" value={data.activity.reviews_done} hint={data.activity.reviews_open ? `${data.activity.reviews_open} open` : null} />
                        </div>

                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${data.email_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><BadgeCheck size={10} /> {data.email_verified ? 'Email verified' : 'Email not verified'}</span>
                            {data.two_factor && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700"><ShieldCheck size={10} /> Two-step sign-in</span>}
                            {data.locked && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700"><Lock size={10} /> Locked</span>}
                            {data.mentor_available && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700"><Handshake size={10} /> Mentor</span>}
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                            <span className="inline-flex items-center gap-1"><Clock size={10} /> Last sign-in</span><span className="text-right text-gray-700">{ago(data.last_login_at)}</span>
                            <span>Last active</span><span className="text-right text-gray-700">{ago(data.last_activity_at)}</span>
                            <span>Joined</span><span className="text-right text-gray-700">{data.joined_at ? formatDate(data.joined_at) : '—'}{data.registration_method ? ` · ${String(data.registration_method).replace(/_/g, ' ')}` : ''}</span>
                        </div>
                    </div>

                    <Link href={`/admin/users/${data.id}`} className="flex items-center justify-center gap-1 border-t border-gray-100 px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
                        Open full profile <ArrowRight size={12} />
                    </Link>
                </div>
            )}
        </div>
    );
}

/**
 * Wrap a user's name (or avatar) on admin pages: hovering or focusing it shows
 * their details, roles and activity.
 */
export default function UserHover({ id, children, className = '' }) {
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

    const show = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            const r = anchor.current.getBoundingClientRect();
            const width = Math.min(340, window.innerWidth - 16);
            const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
            const below = window.innerHeight - r.bottom > 380 || r.top < 380;
            setStyle(below ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 });
            setOpen(true);
            if (cache.has(id)) { setData(cache.get(id)); return; }
            api.get(`/users/${id}/card`)
                .then((res) => { cache.set(id, res.data?.data); setData(res.data?.data); })
                .catch(() => setError('The user could not be loaded.'));
        }, 350);
    };
    const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 150); };
    const keep = () => clearTimeout(timer.current);

    return (
        <span ref={anchor} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} className={`cursor-help ${className}`}>
            {children}
            {open && createPortal(<Card data={data} error={error} style={style} onEnter={keep} onLeave={hide} />, document.body)}
        </span>
    );
}
