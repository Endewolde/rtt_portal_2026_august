import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Activity, LogIn, LogOut, UserPlus, Shield, ToggleRight,
    GitBranch, Settings, Search, X, ChevronDown, ChevronLeft,
    ChevronRight, Filter, Monitor, Globe, Clock, RefreshCw,
    User, FileText, AlertCircle,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';
import { cn, timeAgo } from '../../lib/utils';

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CONFIG = {
    'user.login':          { icon: LogIn,       ring: 'bg-blue-500',   soft: 'bg-blue-50 text-blue-700',   label: 'Login'           },
    'user.logout':         { icon: LogOut,      ring: 'bg-slate-400',  soft: 'bg-slate-100 text-slate-600', label: 'Logout'          },
    'user.registered':     { icon: UserPlus,    ring: 'bg-green-500',  soft: 'bg-green-50 text-green-700',  label: 'Registered'      },
    'user.created':        { icon: UserPlus,    ring: 'bg-indigo-500', soft: 'bg-indigo-50 text-indigo-700',label: 'User Created'    },
    'user.role_changed':   { icon: Shield,      ring: 'bg-purple-500', soft: 'bg-purple-50 text-purple-700',label: 'Role Changed'    },
    'user.status_changed': { icon: ToggleRight, ring: 'bg-orange-500', soft: 'bg-orange-50 text-orange-700',label: 'Status Changed'  },
    'proposal.transitioned':{ icon: GitBranch,  ring: 'bg-indigo-600', soft: 'bg-indigo-50 text-indigo-700',label: 'Status Change'   },
    'setting.updated':     { icon: Settings,    ring: 'bg-amber-500',  soft: 'bg-amber-50 text-amber-700',  label: 'Setting Updated' },
};

const DEFAULT_EVENT = { icon: Activity, ring: 'bg-gray-400', soft: 'bg-gray-100 text-gray-600', label: 'Event' };

const ALL_EVENT_TYPES = [
    'user.login', 'user.logout', 'user.registered', 'user.created',
    'user.role_changed', 'user.status_changed', 'proposal.transitioned', 'setting.updated',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseUA(ua) {
    if (!ua) return null;
    let browser = 'Unknown', os = 'Unknown';
    if (ua.includes('Edg'))        browser = 'Edge';
    else if (ua.includes('Chrome'))  browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari'))  browser = 'Safari';
    if      (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS'))  os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux'))   os = 'Linux';
    return `${browser} · ${os}`;
}

function entityLabel(type) {
    return type?.split('\\').pop() ?? type ?? '—';
}

function eventSummary(log) {
    const actor = log.actor?.name ?? 'System';
    switch (log.event) {
        case 'user.login':           return `${actor} signed in`;
        case 'user.logout':          return `${actor} signed out`;
        case 'user.registered':      return `${actor} created an account`;
        case 'user.created':         return `${actor} was created`;
        case 'user.role_changed':    return `${actor}'s role was updated`;
        case 'user.status_changed':  return `${actor}'s status was changed`;
        case 'proposal.transitioned':return `Proposal status changed`;
        case 'setting.updated':      return `A setting was updated`;
        default:                     return log.event?.replace(/[._]/g, ' ');
    }
}

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Diff viewer ──────────────────────────────────────────────────────────────

function ChangeDiff({ oldValues, newValues }) {
    const old  = oldValues  ?? {};
    const next = newValues  ?? {};
    const keys = [...new Set([...Object.keys(old), ...Object.keys(next)])];

    if (!keys.length) return <span className="text-xs text-gray-400 italic">No field data</span>;

    return (
        <div className="space-y-1.5">
            {keys.map(key => {
                const ov = old[key];
                const nv = next[key];
                const isAdded   = ov === undefined;
                const isRemoved = nv === undefined;
                const isChanged = !isAdded && !isRemoved && String(ov) !== String(nv);
                if (!isAdded && !isRemoved && !isChanged) return null;

                const fmt = (v) => v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

                return (
                    <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="text-gray-400 font-medium min-w-24 shrink-0 truncate">{key}</span>
                        {isAdded ? (
                            <span className="font-mono text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                                + {fmt(nv)}
                            </span>
                        ) : isRemoved ? (
                            <span className="font-mono text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded line-through">
                                {fmt(ov)}
                            </span>
                        ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded line-through">
                                    {fmt(ov)}
                                </span>
                                <ChevronRight size={10} className="text-gray-400 shrink-0" />
                                <span className="font-mono text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                                    {fmt(nv)}
                                </span>
                            </div>
                        )}
                    </div>
                );
            }).filter(Boolean)}
        </div>
    );
}

// ─── Log entry ────────────────────────────────────────────────────────────────

function LogEntry({ log, expanded, onToggle, isLast }) {
    const cfg     = EVENT_CONFIG[log.event] ?? DEFAULT_EVENT;
    const Icon    = cfg.icon;
    const hasDiff = log.old_values || log.new_values;
    const ua      = parseUA(log.user_agent);

    return (
        <div className="relative flex gap-4">
            {/* Vertical line */}
            {!isLast && (
                <div className="absolute left-5 top-10 bottom-0 w-px bg-gray-100" />
            )}

            {/* Icon bubble */}
            <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10', cfg.ring)}>
                <Icon size={16} className="text-white" />
            </div>

            {/* Content card */}
            <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm mb-3 overflow-hidden">
                {/* Main row */}
                <div className="flex items-start justify-between gap-3 px-4 py-3.5">
                    <div className="flex-1 min-w-0">
                        {/* Event badge + entity */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.soft)}>
                                {cfg.label}
                            </span>
                            <span className="text-xs text-gray-400">
                                {entityLabel(log.auditable_type)}
                            </span>
                        </div>

                        {/* Summary */}
                        <p className="text-sm font-semibold text-gray-800 mb-1.5">{eventSummary(log)}</p>

                        {/* Actor row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {log.actor ? (
                                <div className="flex items-center gap-1.5">
                                    {log.actor.avatar ? (
                                        <img src={log.actor.avatar} alt={log.actor.name}
                                            className="h-5 w-5 rounded-full object-cover" />
                                    ) : (
                                        <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center
                                                        justify-center text-[9px] font-bold text-indigo-600">
                                            {initials(log.actor.name)}
                                        </div>
                                    )}
                                    <span className="text-xs font-medium text-gray-700">{log.actor.name}</span>
                                    <span className="text-xs text-gray-400">{log.actor.email}</span>
                                </div>
                            ) : (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <User size={11} /> System
                                </span>
                            )}

                            {log.ip_address && (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Globe size={10} />
                                    {log.ip_address}
                                </span>
                            )}

                            {ua && (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Monitor size={10} />
                                    {ua}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Timestamp + expand */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <time title={new Date(log.created_at).toLocaleString()}
                            className="flex items-center gap-1 text-xs text-gray-400 cursor-default">
                            <Clock size={10} />
                            {timeAgo(log.created_at)}
                        </time>
                        {hasDiff && (
                            <button onClick={onToggle}
                                className={cn(
                                    'flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors',
                                    expanded
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                                )}>
                                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                {expanded ? 'Hide' : 'Changes'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Expanded diff */}
                {expanded && hasDiff && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                        <ChangeDiff oldValues={log.old_values} newValues={log.new_values} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ meta, page, onChange }) {
    if (!meta || meta.last_page <= 1) return null;

    const start = Math.max(1, Math.min(page - 2, meta.last_page - 4));
    const end   = Math.min(meta.last_page, start + 4);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);

    const btn = (label, disabled, onClick, active = false) => (
        <button key={label} onClick={onClick} disabled={disabled}
            className={cn(
                'h-8 min-w-8 px-2 rounded-lg text-xs font-semibold transition-colors',
                active   ? 'bg-indigo-600 text-white'
                         : 'text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed'
            )}>
            {label}
        </button>
    );

    return (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-400">
                Showing {meta.from ?? 0}–{meta.to ?? 0} of <strong>{meta.total}</strong> entries
            </span>
            <div className="flex items-center gap-1">
                {btn(<ChevronLeft size={13} />, page === 1, () => onChange(page - 1))}
                {start > 1 && <>{btn('1', false, () => onChange(1))}{start > 2 && <span className="text-gray-400 text-xs px-1">…</span>}</>}
                {pages.map(p => btn(p, false, () => onChange(p), p === page))}
                {end < meta.last_page && <>{end < meta.last_page - 1 && <span className="text-gray-400 text-xs px-1">…</span>}{btn(meta.last_page, false, () => onChange(meta.last_page))}</>}
                {btn(<ChevronRight size={13} />, page === meta.last_page, () => onChange(page + 1))}
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminAuditLogs() {
    const [logs,       setLogs]       = useState([]);
    const [meta,       setMeta]       = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [page,       setPage]       = useState(1);
    const [expandedId, setExpandedId] = useState(null);
    const [filters,    setFilters]    = useState({ event: '', date_from: '', date_to: '', q: '' });
    const [search,     setSearch]     = useState('');
    const searchTimer = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await get('/audit-logs', { ...filters, page });
            // r = { data: paginatorObj, message, errors, meta }
            // r.data = { current_page, data:[...logs], last_page, total, ... }
            const paginator = r.data;
            setLogs(paginator?.data ?? []);
            if (paginator?.total != null) {
                setMeta({
                    current_page: paginator.current_page,
                    last_page:    paginator.last_page,
                    total:        paginator.total,
                    per_page:     paginator.per_page,
                    from:         paginator.from ?? 0,
                    to:           paginator.to   ?? 0,
                });
            }
        } catch {}
        setLoading(false);
    }, [filters, page]);

    useEffect(() => { load(); }, [load]);

    // Debounce search input
    const handleSearch = (val) => {
        setSearch(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setFilters(f => ({ ...f, q: val }));
            setPage(1);
        }, 350);
    };

    const setFilter = (key, val) => {
        setFilters(f => ({ ...f, [key]: val }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ event: '', date_from: '', date_to: '', q: '' });
        setSearch('');
        setPage(1);
    };

    const hasFilters = filters.event || filters.date_from || filters.date_to || filters.q;

    // Group by date
    const grouped = logs.reduce((acc, log) => {
        const day = new Date(log.created_at).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        if (!acc[day]) acc[day] = [];
        acc[day].push(log);
        return acc;
    }, {});

    return (
        <AppLayout breadcrumb="Audit Logs">
            <div className="max-w-5xl mx-auto space-y-5 pb-8">

                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <Activity size={20} className="text-indigo-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
                                <p className="text-xs text-gray-400 mt-0.5">Immutable record of all system activity</p>
                            </div>
                        </div>
                    </div>

                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800
                                   px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {/* ── Filters ──────────────────────────────────────────────── */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <Filter size={14} className="text-gray-400 shrink-0" />

                        {/* Search */}
                        <div className="relative flex-1 min-w-48">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => handleSearch(e.target.value)}
                                placeholder="Search actor name, email, IP…"
                                className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Event type */}
                        <select
                            value={filters.event}
                            onChange={e => setFilter('event', e.target.value)}
                            className="py-2 px-3 text-sm border border-gray-200 rounded-xl bg-white
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">All Events</option>
                            {ALL_EVENT_TYPES.map(e => (
                                <option key={e} value={e}>
                                    {EVENT_CONFIG[e]?.label ?? e}
                                </option>
                            ))}
                        </select>

                        {/* Date from */}
                        <input type="date" value={filters.date_from}
                            onChange={e => setFilter('date_from', e.target.value)}
                            className="py-2 px-3 text-sm border border-gray-200 rounded-xl
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500" />

                        {/* Date to */}
                        <input type="date" value={filters.date_to}
                            onChange={e => setFilter('date_to', e.target.value)}
                            className="py-2 px-3 text-sm border border-gray-200 rounded-xl
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500" />

                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700
                                           px-3 py-2 rounded-xl hover:bg-red-50 transition-colors">
                                <X size={12} /> Clear
                            </button>
                        )}

                        {meta && (
                            <span className="ml-auto text-xs text-gray-400 shrink-0">
                                {meta.total.toLocaleString()} entries
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Timeline ─────────────────────────────────────────────── */}
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse shrink-0" />
                                <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                                    <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
                                    <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <AlertCircle size={36} className="mb-3 opacity-30" />
                        <p className="text-sm font-medium">No audit log entries found</p>
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="mt-2 text-xs text-indigo-600 hover:underline">
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(grouped).map(([day, dayLogs]) => (
                            <div key={day}>
                                {/* Day label */}
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-xs font-semibold text-gray-500 bg-gray-100
                                                     px-3 py-1.5 rounded-full">
                                        {day}
                                    </span>
                                    <div className="flex-1 h-px bg-gray-100" />
                                    <span className="text-xs text-gray-400">{dayLogs.length} events</span>
                                </div>

                                {/* Entries */}
                                {dayLogs.map((log, idx) => (
                                    <LogEntry
                                        key={log.id}
                                        log={log}
                                        expanded={expandedId === log.id}
                                        onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                        isLast={idx === dayLogs.length - 1}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Pagination ───────────────────────────────────────────── */}
                <Pagination meta={meta} page={page} onChange={(p) => { setPage(p); setExpandedId(null); }} />
            </div>
        </AppLayout>
    );
}
