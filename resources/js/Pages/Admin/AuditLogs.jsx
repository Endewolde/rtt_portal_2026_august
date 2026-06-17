import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Activity, LogIn, LogOut, UserPlus, Shield, ToggleRight,
    GitBranch, Settings, Search, X, ChevronDown, ChevronLeft,
    ChevronRight, Filter, Monitor, Globe, Clock, RefreshCw,
    User, FileText, AlertCircle, Users, Zap, Eye,
    BarChart2, CalendarDays, TrendingUp, CheckSquare, DollarSign, Award,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';
import { cn, timeAgo } from '../../lib/utils';

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CONFIG = {
    // Auth
    'user.login':                  { icon: LogIn,       color: '#3b82f6', bg: 'bg-blue-500',    soft: 'bg-blue-50 text-blue-700',      label: 'Login',                border: 'border-l-blue-400'    },
    'user.logout':                 { icon: LogOut,      color: '#94a3b8', bg: 'bg-slate-400',   soft: 'bg-slate-100 text-slate-600',   label: 'Logout',               border: 'border-l-slate-300'   },
    'user.registered':             { icon: UserPlus,    color: '#22c55e', bg: 'bg-green-500',   soft: 'bg-green-50 text-green-700',    label: 'Registered',           border: 'border-l-green-400'   },
    'user.created':                { icon: UserPlus,    color: '#6366f1', bg: 'bg-indigo-500',  soft: 'bg-indigo-50 text-indigo-700',  label: 'User Created',         border: 'border-l-indigo-400'  },
    'user.role_changed':           { icon: Shield,      color: '#a855f7', bg: 'bg-purple-500',  soft: 'bg-purple-50 text-purple-700',  label: 'Role Changed',         border: 'border-l-purple-400'  },
    'user.status_changed':         { icon: ToggleRight, color: '#f97316', bg: 'bg-orange-500',  soft: 'bg-orange-50 text-orange-700',  label: 'Status Changed',       border: 'border-l-orange-400'  },
    'user.session_evicted':        { icon: Zap,         color: '#ef4444', bg: 'bg-red-500',     soft: 'bg-red-50 text-red-700',        label: 'Session Evicted',      border: 'border-l-red-400'     },
    'user.impersonation_started':  { icon: Eye,         color: '#0ea5e9', bg: 'bg-sky-500',     soft: 'bg-sky-50 text-sky-700',        label: 'Impersonation',        border: 'border-l-sky-400'     },
    'users.imported':              { icon: Users,       color: '#14b8a6', bg: 'bg-teal-500',    soft: 'bg-teal-50 text-teal-700',      label: 'Users Imported',       border: 'border-l-teal-400'    },
    // Proposals
    'proposal.transitioned':       { icon: GitBranch,   color: '#8b5cf6', bg: 'bg-violet-600',  soft: 'bg-violet-50 text-violet-700',  label: 'Proposal Status',      border: 'border-l-violet-400'  },
    // Review
    'review.assigned':             { icon: FileText,    color: '#0284c7', bg: 'bg-sky-600',     soft: 'bg-sky-50 text-sky-700',        label: 'Review Assigned',      border: 'border-l-sky-500'     },
    'review.score_submitted':      { icon: BarChart2,   color: '#7c3aed', bg: 'bg-violet-500',  soft: 'bg-violet-50 text-violet-700',  label: 'Score Submitted',      border: 'border-l-violet-400'  },
    'review.reassigned':           { icon: RefreshCw,   color: '#d97706', bg: 'bg-amber-500',   soft: 'bg-amber-50 text-amber-700',    label: 'Reviewer Reassigned',  border: 'border-l-amber-400'   },
    'review.due_extended':         { icon: CalendarDays,color: '#0891b2', bg: 'bg-cyan-500',    soft: 'bg-cyan-50 text-cyan-700',      label: 'Due Date Extended',    border: 'border-l-cyan-400'    },
    // Budget
    'budget.request_approved':     { icon: CheckSquare, color: '#16a34a', bg: 'bg-green-600',   soft: 'bg-green-50 text-green-700',    label: 'Budget Approved',      border: 'border-l-green-500'   },
    'budget.disbursed':            { icon: DollarSign,  color: '#15803d', bg: 'bg-green-700',   soft: 'bg-emerald-50 text-emerald-800',label: 'Funds Disbursed',      border: 'border-l-emerald-500' },
    'budget.settlement_submitted': { icon: TrendingUp,  color: '#0d9488', bg: 'bg-teal-600',    soft: 'bg-teal-50 text-teal-700',      label: 'Settlement Filed',     border: 'border-l-teal-500'    },
    'budget.settlement_verified':  { icon: CheckSquare, color: '#0369a1', bg: 'bg-blue-700',    soft: 'bg-blue-50 text-blue-800',      label: 'Settlement Verified',  border: 'border-l-blue-500'    },
    'budget.settlement_finalized': { icon: Award,       color: '#7e22ce', bg: 'bg-purple-700',  soft: 'bg-purple-50 text-purple-800',  label: 'Settlement Finalized', border: 'border-l-purple-500'  },
    // Awards
    'award.issued':                { icon: Award,       color: '#b45309', bg: 'bg-amber-600',   soft: 'bg-amber-50 text-amber-800',    label: 'Award Issued',         border: 'border-l-amber-500'   },
    'award.updated':               { icon: Settings,    color: '#92400e', bg: 'bg-amber-700',   soft: 'bg-amber-50 text-amber-700',    label: 'Award Updated',        border: 'border-l-amber-400'   },
    // Evaluation / Monitoring
    'evaluation.midterm_scheduled':{ icon: CalendarDays,color: '#0e7490', bg: 'bg-cyan-600',    soft: 'bg-cyan-50 text-cyan-800',      label: 'Midterm Scheduled',    border: 'border-l-cyan-500'    },
    'evaluation.midterm_scored':   { icon: BarChart2,   color: '#155e75', bg: 'bg-cyan-700',    soft: 'bg-cyan-50 text-cyan-700',      label: 'Midterm Scored',       border: 'border-l-cyan-400'    },
    // Settings
    'setting.updated':             { icon: Settings,    color: '#f59e0b', bg: 'bg-amber-500',   soft: 'bg-amber-50 text-amber-700',    label: 'Setting Updated',      border: 'border-l-amber-400'   },
};

const DEFAULT_CFG = { icon: Activity, color: '#6b7280', bg: 'bg-gray-400', soft: 'bg-gray-100 text-gray-600', label: 'Event', border: 'border-l-gray-300' };

const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseUA(ua) {
    if (!ua) return null;
    let browser = 'Unknown', os = 'Unknown';
    if      (ua.includes('Edg'))     browser = 'Edge';
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
    const actor = log.actor?.name ?? 'Unknown user';
    const old   = log.old_values  ?? {};
    const next  = log.new_values  ?? {};
    switch (log.event) {
        // Auth & Users
        case 'user.login':                  return `${actor} signed in`;
        case 'user.logout':                 return `${actor} signed out`;
        case 'user.registered':             return `${actor} created an account`;
        case 'user.created':                return `${actor}'s account was created`;
        case 'user.role_changed':           return `${actor}'s role changed${old.role ? ` from ${old.role}` : ''}${next.role ? ` → ${next.role}` : ''}`;
        case 'user.status_changed':         return `${actor}'s status changed${old.status ? ` from ${old.status}` : ''}${next.status ? ` → ${next.status}` : ''}`;
        case 'user.session_evicted':        return `${actor}'s session was terminated by the system`;
        case 'user.impersonation_started':  return `${actor} started an impersonation session`;
        case 'users.imported':              return `Bulk import: ${next.count ?? '?'} users added`;
        // Proposals
        case 'proposal.transitioned':       return `Proposal${next.tracker ? ` ${next.tracker}` : ''} moved${old.status ? ` from "${old.status}"` : ''}${next.status ? ` → "${next.status}"` : ''}`;
        // Review
        case 'review.assigned':             return `${next.reviewers ?? '?'} reviewer(s) assigned to proposal ${next.tracker ?? ''}`;
        case 'review.score_submitted':      return `${actor} submitted review scores`;
        case 'review.reassigned':           return `${actor} reassigned a reviewer`;
        case 'review.due_extended':         return `Review due date extended${old.due_date ? ` from ${old.due_date}` : ''}${next.due_date ? ` → ${next.due_date}` : ''}`;
        // Budget
        case 'budget.request_approved':     return `${actor} approved budget request for ${next.tracker ?? 'a proposal'}`;
        case 'budget.disbursed':            return `${actor} disbursed ETB ${Number(next.amount ?? 0).toLocaleString()} to ${next.tracker ?? 'a proposal'}`;
        case 'budget.settlement_submitted': return `${actor} submitted settlement (ETB ${Number(next.total_spent ?? 0).toLocaleString()})`;
        case 'budget.settlement_verified':  return `${actor} verified settlement report`;
        case 'budget.settlement_finalized': return `${actor} finalized settlement`;
        // Awards
        case 'award.issued':                return `Award issued to ${next.tracker ?? 'proposal'} — Grant ${next.grant_reference ?? '?'}, ETB ${Number(next.awarded_amount ?? 0).toLocaleString()}`;
        case 'award.updated':               return `Award updated for ${next.tracker ?? 'proposal'}`;
        // Evaluation / Monitoring
        case 'evaluation.midterm_scheduled':return `Midterm evaluation scheduled for ${next.tracker ?? 'a proposal'} on ${next.evaluation_date ?? '?'}`;
        case 'evaluation.midterm_scored':   return `Midterm scored: ${next.score ?? '?'}/100 — Recommendation: ${next.recommendation ?? '?'}`;
        // Settings
        case 'setting.updated':             return `Setting "${next.key ?? old.key ?? '?'}" was updated`;
        default:                            return log.event?.replace(/[._]/g, ' ') ?? 'Unknown event';
    }
}

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function roleBadge(roles) {
    const role = roles?.[0]?.name;
    if (!role) return null;
    const map = {
        pi:       'bg-blue-100 text-blue-700',
        reviewer: 'bg-purple-100 text-purple-700',
        staff:    'bg-green-100 text-green-700',
        admin:    'bg-amber-100 text-amber-700',
    };
    return (
        <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md', map[role] ?? 'bg-gray-100 text-gray-600')}>
            {role}
        </span>
    );
}

// ─── Diff viewer ──────────────────────────────────────────────────────────────

function ChangeDiff({ oldValues, newValues }) {
    const old  = oldValues ?? {};
    const next = newValues ?? {};
    const keys = [...new Set([...Object.keys(old), ...Object.keys(next)])];
    if (!keys.length) return <span className="text-xs text-gray-400 italic">No field data recorded</span>;

    const fmt = (v) => v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

    return (
        <div className="space-y-2">
            {keys.map(key => {
                const ov = old[key];
                const nv = next[key];
                const isAdded   = ov === undefined;
                const isRemoved = nv === undefined;
                const isChanged = !isAdded && !isRemoved && String(ov) !== String(nv);
                if (!isAdded && !isRemoved && !isChanged) return null;
                return (
                    <div key={key} className="flex items-start gap-3 text-xs">
                        <span className="text-gray-400 font-mono min-w-28 shrink-0 truncate pt-0.5">{key}</span>
                        {isAdded ? (
                            <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                + {fmt(nv)}
                            </span>
                        ) : isRemoved ? (
                            <span className="font-mono text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg line-through opacity-70">
                                {fmt(ov)}
                            </span>
                        ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg line-through opacity-70">
                                    {fmt(ov)}
                                </span>
                                <ChevronRight size={10} className="text-gray-400 shrink-0" />
                                <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
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

// ─── Log entry card ───────────────────────────────────────────────────────────

function LogEntry({ log, expanded, onToggle }) {
    const cfg     = EVENT_CONFIG[log.event] ?? DEFAULT_CFG;
    const Icon    = cfg.icon;
    const hasDiff = !!(log.old_values || log.new_values);
    const ua      = parseUA(log.user_agent);
    const ts      = new Date(log.created_at);

    return (
        <div className={cn(
            'bg-white rounded-2xl border border-gray-100 border-l-4 shadow-sm overflow-hidden',
            'hover:shadow-md hover:border-gray-200 transition-all duration-200',
            cfg.border,
        )}>
            {/* Main row */}
            <div className="flex items-start gap-3 px-4 py-3.5">
                {/* Icon */}
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                    <Icon size={15} className="text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Top: badge + entity */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', cfg.soft)}>
                            {cfg.label}
                        </span>
                        {log.auditable_type && (
                            <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md font-medium">
                                {entityLabel(log.auditable_type)}
                            </span>
                        )}
                    </div>

                    {/* Summary */}
                    <p className="text-sm font-semibold text-gray-800 leading-snug mb-2">
                        {eventSummary(log)}
                    </p>

                    {/* Actor + meta row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {log.actor ? (
                            <div className="flex items-center gap-1.5">
                                {log.actor.avatar ? (
                                    <img src={log.actor.avatar} alt={log.actor.name}
                                        className="h-5 w-5 rounded-full object-cover ring-1 ring-gray-200" />
                                ) : (
                                    <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center
                                                    text-[9px] font-bold text-indigo-600 ring-1 ring-indigo-200">
                                        {initials(log.actor.name)}
                                    </div>
                                )}
                                <span className="text-xs font-semibold text-gray-700">{log.actor.name}</span>
                                {roleBadge(log.actor.roles)}
                                <span className="text-[10px] text-gray-400">{log.actor.email}</span>
                            </div>
                        ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                                <User size={10} /> System
                            </span>
                        )}

                        {log.ip_address && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Globe size={9} /> {log.ip_address}
                            </span>
                        )}

                        {ua && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Monitor size={9} /> {ua}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: time + expand */}
                <div className="flex flex-col items-end gap-2 shrink-0 ml-2">
                    <div className="text-right">
                        <time title={ts.toLocaleString()}
                            className="flex items-center gap-1 text-[10px] text-gray-400 font-medium justify-end">
                            <Clock size={9} /> {timeAgo(log.created_at)}
                        </time>
                        <span className="text-[9px] text-gray-300 mt-0.5 block">
                            {ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    {hasDiff && (
                        <button onClick={onToggle}
                            className={cn(
                                'flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all',
                                expanded
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                            )}>
                            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            {expanded ? 'Hide' : 'Changes'}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded diff */}
            {expanded && hasDiff && (
                <div className="border-t border-gray-100 bg-linear-to-r from-gray-50 to-white px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Field changes</p>
                    <ChangeDiff oldValues={log.old_values} newValues={log.new_values} />
                </div>
            )}
        </div>
    );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, color }) {
    return (
        <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}30` }}>
                <Icon size={15} style={{ color }} />
            </div>
            <div>
                <p className="text-lg font-extrabold text-white tabular-nums leading-none">{value?.toLocaleString() ?? '—'}</p>
                <p className="text-[10px] text-white/50 font-medium mt-0.5">{label}</p>
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
        <button key={String(label)} onClick={onClick} disabled={disabled}
            className={cn(
                'h-8 min-w-8 px-2 rounded-lg text-xs font-semibold transition-all',
                active   ? 'bg-indigo-600 text-white shadow-sm'
                         : 'text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed'
            )}>
            {label}
        </button>
    );

    return (
        <div className="flex items-center justify-between pt-5 border-t border-gray-100">
            <span className="text-xs text-gray-400">
                Showing <strong>{meta.from ?? 0}–{meta.to ?? 0}</strong> of <strong>{meta.total?.toLocaleString()}</strong> entries
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
    const [stats,      setStats]      = useState(null);
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
            if (r.meta?.stats) setStats(r.meta.stats);
        } catch {}
        setLoading(false);
    }, [filters, page]);

    useEffect(() => { load(); }, [load]);

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
        setExpandedId(null);
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
            <div className="max-w-5xl mx-auto space-y-5 pb-10">

                {/* ── Hero header ──────────────────────────────────────────── */}
                <div className="rounded-3xl overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%)' }}>

                    {/* Top decoration */}
                    <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #6366f180, transparent)' }} />

                    <div className="px-6 py-6">
                        {/* Title row */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
                                    <Activity size={20} className="text-indigo-300" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-extrabold text-white tracking-tight">System Activity</h1>
                                    <p className="text-xs text-white/40 mt-0.5">All user actions — super admins excluded</p>
                                </div>
                            </div>

                            <button onClick={load} disabled={loading}
                                className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white
                                           px-3 py-2 rounded-xl border border-white/10 hover:border-white/20
                                           bg-white/5 hover:bg-white/10 transition-all">
                                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                            </button>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <StatChip icon={CalendarDays} label="Today's events"    value={stats?.today}         color="#818cf8" />
                            <StatChip icon={TrendingUp}   label="This week"         value={stats?.this_week}     color="#34d399" />
                            <StatChip icon={Users}        label="Active users"      value={stats?.unique_actors} color="#fb923c" />
                            <StatChip icon={BarChart2}    label="Total logged"      value={meta?.total}          color="#a78bfa" />
                        </div>
                    </div>
                </div>

                {/* ── Event type quick-filter pills ────────────────────────── */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                    <button
                        onClick={() => setFilter('event', '')}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-all',
                            !filters.event
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                        )}>
                        <Activity size={11} /> All
                        {stats?.by_event && (
                            <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded-full ml-0.5',
                                !filters.event ? 'bg-white/20' : 'bg-gray-100 text-gray-500')}>
                                {Object.values(stats.by_event).reduce((a, b) => a + b, 0)}
                            </span>
                        )}
                    </button>

                    {ALL_EVENT_TYPES.map(evt => {
                        const cfg    = EVENT_CONFIG[evt];
                        const Icon   = cfg.icon;
                        const count  = stats?.by_event?.[evt] ?? 0;
                        if (!count && !filters.event) return null;
                        const active = filters.event === evt;
                        return (
                            <button key={evt}
                                onClick={() => setFilter('event', active ? '' : evt)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-all',
                                    active
                                        ? 'text-white border-transparent shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                )}
                                style={active ? { backgroundColor: cfg.color, boxShadow: `0 2px 8px ${cfg.color}40` } : {}}>
                                <Icon size={11} />
                                {cfg.label}
                                {count > 0 && (
                                    <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded-full ml-0.5',
                                        active ? 'bg-white/25' : 'bg-gray-100 text-gray-500')}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Search + date filters ─────────────────────────────────── */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <Filter size={14} className="text-gray-400 shrink-0" />

                        {/* Search */}
                        <div className="relative flex-1 min-w-52">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            {search && (
                                <button onClick={() => handleSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={12} />
                                </button>
                            )}
                            <input
                                value={search}
                                onChange={e => handleSearch(e.target.value)}
                                placeholder="Search by name, email, IP, or event type…"
                                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50
                                           focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 transition-all"
                            />
                        </div>

                        {/* Date range */}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <CalendarDays size={12} />
                            <input type="date" value={filters.date_from}
                                onChange={e => setFilter('date_from', e.target.value)}
                                className="py-2 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50
                                           focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all" />
                            <span>—</span>
                            <input type="date" value={filters.date_to}
                                onChange={e => setFilter('date_to', e.target.value)}
                                className="py-2 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50
                                           focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all" />
                        </div>

                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700
                                           px-3 py-2 rounded-xl hover:bg-red-50 border border-red-100 transition-all">
                                <X size={12} /> Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Timeline ─────────────────────────────────────────────── */}
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 border-l-4 border-l-gray-200 p-4 space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-gray-200 animate-pulse shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                                        <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
                                        <div className="h-3 w-44 bg-gray-200 rounded animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                        <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                            <AlertCircle size={28} className="opacity-40" />
                        </div>
                        <p className="text-sm font-semibold text-gray-500">No activity found</p>
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or date range</p>
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-4 py-2 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors">
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(grouped).map(([day, dayLogs]) => (
                            <div key={day}>
                                {/* Day separator */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm shrink-0">
                                        <CalendarDays size={11} className="text-indigo-500" />
                                        <span className="text-[11px] font-bold text-gray-700">{day}</span>
                                    </div>
                                    <div className="flex-1 h-px bg-linear-to-r from-gray-200 to-transparent" />
                                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full shrink-0">
                                        {dayLogs.length} {dayLogs.length === 1 ? 'event' : 'events'}
                                    </span>
                                </div>

                                {/* Entries */}
                                <div className="space-y-2.5">
                                    {dayLogs.map(log => (
                                        <LogEntry
                                            key={log.id}
                                            log={log}
                                            expanded={expandedId === log.id}
                                            onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Pagination ───────────────────────────────────────────── */}
                <Pagination meta={meta} page={page} onChange={(p) => { setPage(p); setExpandedId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </div>
        </AppLayout>
    );
}
