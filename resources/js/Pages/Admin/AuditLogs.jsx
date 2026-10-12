import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Activity, LogIn, LogOut, Shield, Eye, Users, Settings,
    Search, X, ChevronLeft, ChevronRight, RefreshCw, Filter,
    Clock, Globe, Monitor, CheckCircle, XCircle, PlusCircle,
    Pencil, Trash2, Send, Lock, Unlock, Upload, Download,
    ToggleRight, UserPlus, AlertCircle, CalendarDays, BarChart2,
    DollarSign, Award, FileText, Star, Zap, TrendingUp,
    Database, Building2, BookOpen, FlaskConical, GitBranch,
    BadgeCheck, RotateCcw, UserX, MessageSquare, PlayCircle,
    Package, Radio, ChevronDown,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';
import { cn, timeAgo } from '../../lib/utils';

// ─── Resource → colour/icon mapping ──────────────────────────────────────────

const RESOURCE_CONFIG = {
    user:                 { color: '#3b82f6', bg: 'bg-blue-500',    soft: 'bg-blue-50 text-blue-700',        border: 'border-l-blue-400',    icon: Users        },
    proposal:             { color: '#8b5cf6', bg: 'bg-violet-500',  soft: 'bg-violet-50 text-violet-700',    border: 'border-l-violet-400',  icon: FileText     },
    proposal_call:        { color: '#6366f1', bg: 'bg-indigo-500',  soft: 'bg-indigo-50 text-indigo-700',    border: 'border-l-indigo-400',  icon: Radio        },
    role:                 { color: '#a855f7', bg: 'bg-purple-500',  soft: 'bg-purple-50 text-purple-700',    border: 'border-l-purple-400',  icon: Shield       },
    college:              { color: '#10b981', bg: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700',  border: 'border-l-emerald-400', icon: Building2    },
    department:           { color: '#14b8a6', bg: 'bg-teal-500',    soft: 'bg-teal-50 text-teal-700',        border: 'border-l-teal-400',    icon: Building2    },
    budget_request:       { color: '#22c55e', bg: 'bg-green-500',   soft: 'bg-green-50 text-green-700',      border: 'border-l-green-400',   icon: DollarSign   },
    budget_allocation:    { color: '#16a34a', bg: 'bg-green-600',   soft: 'bg-green-50 text-green-800',      border: 'border-l-green-500',   icon: DollarSign   },
    award:                { color: '#f59e0b', bg: 'bg-amber-500',   soft: 'bg-amber-50 text-amber-700',      border: 'border-l-amber-400',   icon: Award        },
    settlement:           { color: '#0d9488', bg: 'bg-teal-600',    soft: 'bg-teal-50 text-teal-800',        border: 'border-l-teal-500',    icon: TrendingUp   },
    disbursement:         { color: '#059669', bg: 'bg-emerald-600', soft: 'bg-emerald-50 text-emerald-800',  border: 'border-l-emerald-500', icon: DollarSign   },
    review:               { color: '#0ea5e9', bg: 'bg-sky-500',     soft: 'bg-sky-50 text-sky-700',          border: 'border-l-sky-400',     icon: Star         },
    review_assignment:    { color: '#0284c7', bg: 'bg-sky-600',     soft: 'bg-sky-50 text-sky-800',          border: 'border-l-sky-500',     icon: Star         },
    complaint:            { color: '#ef4444', bg: 'bg-red-500',     soft: 'bg-red-50 text-red-700',          border: 'border-l-red-400',     icon: MessageSquare},
    midterm_evaluation:   { color: '#0891b2', bg: 'bg-cyan-600',    soft: 'bg-cyan-50 text-cyan-800',        border: 'border-l-cyan-500',    icon: FlaskConical },
    completion_workshop:  { color: '#7c3aed', bg: 'bg-violet-600',  soft: 'bg-violet-50 text-violet-800',    border: 'border-l-violet-500',  icon: PlayCircle   },
    research_output:      { color: '#0369a1', bg: 'bg-blue-700',    soft: 'bg-blue-50 text-blue-800',        border: 'border-l-blue-600',    icon: BookOpen     },
    repository:           { color: '#64748b', bg: 'bg-slate-500',   soft: 'bg-slate-50 text-slate-700',      border: 'border-l-slate-400',   icon: Database     },
    thematic_area:        { color: '#d946ef', bg: 'bg-fuchsia-500', soft: 'bg-fuchsia-50 text-fuchsia-700',  border: 'border-l-fuchsia-400', icon: Package      },
    setting:              { color: '#f97316', bg: 'bg-orange-500',  soft: 'bg-orange-50 text-orange-700',    border: 'border-l-orange-400',  icon: Settings     },
    feature:              { color: '#ec4899', bg: 'bg-pink-500',    soft: 'bg-pink-50 text-pink-700',        border: 'border-l-pink-400',    icon: Zap          },
    external_fund:        { color: '#06b6d4', bg: 'bg-cyan-500',    soft: 'bg-cyan-50 text-cyan-700',        border: 'border-l-cyan-400',    icon: Globe        },
    report:               { color: '#9333ea', bg: 'bg-purple-600',  soft: 'bg-purple-50 text-purple-800',    border: 'border-l-purple-500',  icon: BarChart2    },
    defence_session:      { color: '#1d4ed8', bg: 'bg-blue-700',    soft: 'bg-blue-50 text-blue-800',        border: 'border-l-blue-600',    icon: GitBranch    },
    appeal:               { color: '#dc2626', bg: 'bg-red-600',     soft: 'bg-red-50 text-red-800',          border: 'border-l-red-500',     icon: RotateCcw    },
};

const ACTION_ICONS = {
    created:              PlusCircle,
    updated:              Pencil,
    deleted:              Trash2,
    approved:             CheckCircle,
    rejected:             XCircle,
    submitted:            Send,
    imported:             Upload,
    exported:             Download,
    login:                LogIn,
    logout:               LogOut,
    registered:           UserPlus,
    status_changed:       ToggleRight,
    roles_changed:        Shield,
    role_changed:         Shield,
    impersonated:         Eye,
    impersonation_started:Eye,
    closed:               Lock,
    reopened:             Unlock,
    validated:            BadgeCheck,
    revoked:              XCircle,
    funded:               Award,
    bulk_approved:        CheckCircle,
    bulk_updated:         Pencil,
    assigned:             Star,
    reassigned:           RefreshCw,
    removed:              UserX,
    resolved:             CheckCircle,
    escalated:            TrendingUp,
    session_evicted:      Zap,
    finalized:            Lock,
    verified:             BadgeCheck,
    published:            Globe,
    unpublished:          Lock,
    scored:               Star,
    appealed:             RotateCcw,
    scheduled:            CalendarDays,
    funding_changed:      DollarSign,
    central_decision:     BadgeCheck,
    result_processed:     CheckCircle,
};

const DEFAULT_RESOURCE_CONFIG = { color: '#6b7280', bg: 'bg-gray-400', soft: 'bg-gray-100 text-gray-600', border: 'border-l-gray-300', icon: Activity };

// ─── Category tab definitions ─────────────────────────────────────────────────

const CATEGORIES = [
    { id: 'all',        label: 'All Activity',    icon: Activity,    color: '#6366f1' },
    { id: 'auth',       label: 'Auth & Access',   icon: LogIn,       color: '#3b82f6' },
    { id: 'proposals',  label: 'Proposals',       icon: FileText,    color: '#8b5cf6' },
    { id: 'people',     label: 'People & Roles',  icon: Users,       color: '#10b981' },
    { id: 'finance',    label: 'Finance',         icon: DollarSign,  color: '#f59e0b' },
    { id: 'system',     label: 'Administration',  icon: Settings,    color: '#f97316' },
    { id: 'monitoring', label: 'Monitoring',      icon: FlaskConical,color: '#0891b2' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humanize(str) {
    if (!str) return '';
    return str.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getEventParts(eventStr) {
    const parts  = (eventStr ?? '').split('.');
    const resource = parts[0] ?? 'unknown';
    const action   = parts.slice(1).join('_') || 'changed';
    return { resource, action };
}

function getEventConfig(eventStr) {
    const { resource } = getEventParts(eventStr);
    return RESOURCE_CONFIG[resource] ?? DEFAULT_RESOURCE_CONFIG;
}

function getActionIcon(action) {
    return ACTION_ICONS[action] ?? Activity;
}

function eventSummary(log) {
    const actor = log.actor?.name ?? 'Unknown user';
    const nv    = log.new_values ?? {};
    const ov    = log.old_values ?? {};
    const { resource, action } = getEventParts(log.event);

    // The person/record acted ON — new-style logs store this explicitly as
    // target_name; older logs (before this was added) only had a bare `name`
    // sometimes, so fall back gracefully rather than showing nothing.
    const target = nv.target_name ?? ov.target_name ?? nv.name ?? ov.name ?? null;
    const targetSuffix = target ? ` — ${target}` : '';

    // Known explicit events
    const explicit = {
        'user.login':                 `${actor} signed in`,
        'user.logout':                `${actor} signed out`,
        'user.registered':            `${actor} created an account`,
        'user.created':               `${actor} created a new user account${targetSuffix}`,
        'user.super_admin_created':   `${actor} created a new super admin account${targetSuffix}`,
        'user.updated':               `${actor} updated a user profile${targetSuffix}`,
        'user.deleted':               `${actor} deleted a user account${targetSuffix}`,
        'user.status_changed':        `${actor} ${nv.status === 'inactive' || nv.status === 'suspended' ? 'deactivated' : 'activated'} an account${targetSuffix}`,
        'user.role_changed':          `${actor} changed role${targetSuffix ? ` for${targetSuffix}` : ''}${nv.role ? ` to "${nv.role}"` : ''}`,
        'user.roles_changed':         `${actor} updated roles${targetSuffix ? ` for${targetSuffix}` : ''}`,
        'user.impersonation_started': `${actor} started impersonating${targetSuffix || ' another user'}`,
        'user.session_evicted':       `${actor}'s session was terminated`,
        'user.imported':              `${actor} bulk-imported users`,
        'proposal.created':           `${actor} created a new proposal`,
        'proposal.updated':           `${actor} updated proposal details`,
        'proposal.deleted':           `${actor} deleted a proposal`,
        'proposal.submitted':         `${actor} submitted a proposal for review`,
        'proposal.approved':          `${actor} approved a proposal`,
        'proposal.rejected':          `${actor} rejected a proposal`,
        'proposal.validated':         `${actor} validated a proposal`,
        'proposal.transitioned':      `Proposal moved${ov.status ? ` from "${ov.status}"` : ''}${nv.status ? ` → "${nv.status}"` : ''}`,
        'proposal.funding_changed':   `${actor} changed funding status of a proposal`,
        'proposal_call.created':      `${actor} created a proposal call${nv.title ? ` — "${nv.title}"` : ''}`,
        'proposal_call.updated':      `${actor} updated a proposal call`,
        'proposal_call.deleted':      `${actor} deleted a proposal call`,
        'proposal_call.closed':       `${actor} closed a proposal call`,
        'proposal_call.reopened':     `${actor} reopened a proposal call`,
        'proposal_call.exported':     `${actor} exported proposal call data`,
        'role.created':               `${actor} created role${nv.name ? ` "${nv.name}"` : ''}`,
        'role.updated':               `${actor} updated a role`,
        'role.deleted':               `${actor} deleted a role`,
        'role.permissions_changed':   `${actor} updated permissions for a role`,
        'college.created':            `${actor} added college${nv.name ? ` "${nv.name}"` : ''}`,
        'college.updated':            `${actor} updated college details`,
        'college.deleted':            `${actor} deleted a college`,
        'department.created':         `${actor} added department${nv.name ? ` "${nv.name}"` : ''}`,
        'department.updated':         `${actor} updated department details`,
        'department.deleted':         `${actor} deleted a department`,
        'budget_request.created':     `${actor} submitted a budget request`,
        'budget_request.approved':    `${actor} approved a budget request`,
        'budget_request.updated':     `${actor} updated a budget request`,
        'budget_allocation.updated':  `${actor} updated budget allocation`,
        'award.created':              `${actor} issued an award`,
        'award.updated':              `${actor} updated award details`,
        'settlement.created':         `${actor} filed a settlement report`,
        'settlement.verified':        `${actor} verified a settlement`,
        'settlement.finalized':       `${actor} finalized a settlement`,
        'disbursement.created':       `${actor} recorded a disbursement`,
        'review.assigned':            `${actor} assigned reviewer(s)`,
        'review.updated':             `${actor} updated a review`,
        'review_assignment.extended': `${actor} extended a review deadline`,
        'review_assignment.removed':  `${actor} removed a reviewer`,
        'review_assignment.reassigned':`${actor} reassigned a reviewer`,
        'setting.updated':            `${actor} updated system setting${nv.key ? ` "${nv.key}"` : ''}`,
        'feature.updated':            `${actor} toggled a feature flag`,
        'midterm_evaluation.created': `${actor} scheduled a midterm evaluation`,
        'midterm_evaluation.updated': `${actor} updated a midterm evaluation`,
        'completion_workshop.created':`${actor} scheduled a completion workshop`,
        'research_output.created':    `${actor} recorded a research output`,
        'research_output.updated':    `${actor} updated a research output`,
        'repository.published':       `${actor} published to the repository`,
        'repository.unpublished':     `${actor} unpublished from repository`,
        'appeal.created':             `${actor} filed an appeal`,
        'appeal.resolved':            `${actor} resolved an appeal`,
        'complaint.created':          `${actor} submitted a complaint`,
        'complaint.resolved':         `${actor} resolved a complaint`,
        'complaint.escalated':        `${actor} escalated a complaint`,
    };

    if (explicit[log.event]) return explicit[log.event];

    // Fallback: auto-generate from event string
    const rLabel = humanize(resource);
    const aLabel = humanize(action);
    return `${actor} — ${rLabel} ${aLabel}`;
}

function parseUA(ua) {
    if (!ua) return null;
    let browser = 'Unknown', os = 'Unknown';
    if      (ua.includes('Edg'))    browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox'))browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    if      (ua.includes('Windows'))os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Android'))os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux'))  os = 'Linux';
    return `${browser} · ${os}`;
}

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function roleColor(roleName) {
    const map = {
        super_admin:       'bg-rose-100 text-rose-700',
        admin:             'bg-amber-100 text-amber-700',
        central_officer:   'bg-indigo-100 text-indigo-700',
        college_officer:   'bg-sky-100 text-sky-700',
        research_officer:  'bg-violet-100 text-violet-700',
        community_officer: 'bg-emerald-100 text-emerald-700',
        technology_officer:'bg-cyan-100 text-cyan-700',
        finance_officer:   'bg-green-100 text-green-700',
        staff:             'bg-blue-100 text-blue-700',
    };
    return map[roleName] ?? 'bg-gray-100 text-gray-600';
}

// ─── Diff viewer ──────────────────────────────────────────────────────────────

function ChangeDiff({ oldValues, newValues }) {
    const old  = oldValues  ?? {};
    const next = newValues  ?? {};
    const allOld  = Object.keys(old);
    const allNext = Object.keys(next);

    // If one side is huge/complex, just show pretty-print
    const isComplex = allOld.length === 0 && allNext.length > 0;
    if (isComplex && allNext.length > 10) {
        return (
            <pre className="text-[11px] font-mono bg-gray-950 text-gray-300 p-4 rounded-xl overflow-x-auto leading-relaxed">
                {JSON.stringify(next, null, 2)}
            </pre>
        );
    }

    const keys = [...new Set([...allOld, ...allNext])];
    if (!keys.length) return <p className="text-xs text-gray-400 italic">No field data recorded.</p>;

    const fmt = (v) => {
        if (v == null) return '—';
        if (typeof v === 'object') return JSON.stringify(v, null, 2);
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        return String(v);
    };

    return (
        <div className="space-y-1.5">
            {keys.map(key => {
                const ov = old[key];
                const nv = next[key];
                const isAdded   = ov === undefined;
                const isRemoved = nv === undefined;
                const isChanged = !isAdded && !isRemoved && String(ov) !== String(nv);
                if (!isAdded && !isRemoved && !isChanged) return null;
                return (
                    <div key={key}
                        className={cn(
                            'grid grid-cols-[120px_1fr] gap-3 items-start px-3 py-2 rounded-lg text-xs',
                            isAdded   ? 'bg-emerald-50' :
                            isRemoved ? 'bg-red-50' :
                                        'bg-gray-50'
                        )}>
                        <span className="text-gray-500 font-mono font-medium truncate self-center">{key}</span>
                        {isAdded ? (
                            <span className="font-mono text-emerald-700 break-all">
                                <span className="text-emerald-400 mr-1">+</span>{fmt(nv)}
                            </span>
                        ) : isRemoved ? (
                            <span className="font-mono text-red-500 line-through opacity-70 break-all">
                                {fmt(ov)}
                            </span>
                        ) : (
                            <div className="flex items-start gap-2 flex-wrap">
                                <span className="font-mono text-red-500 line-through opacity-60 break-all">{fmt(ov)}</span>
                                <ChevronRight size={11} className="text-gray-400 mt-0.5 shrink-0" />
                                <span className="font-mono text-emerald-700 break-all">{fmt(nv)}</span>
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
    const cfg    = getEventConfig(log.event);
    const { resource, action } = getEventParts(log.event);
    const ActionIcon = getActionIcon(action);
    const ResourceIcon = cfg.icon;
    const hasDiff = !!(log.old_values || log.new_values);
    const ua      = parseUA(log.user_agent);
    const ts      = new Date(log.created_at);
    const primaryRole = log.actor?.roles?.[0]?.name;

    return (
        <div className={cn(
            'group bg-white rounded-2xl border border-gray-100 border-l-[3px] shadow-xs',
            'hover:shadow-md hover:border-gray-200 transition-all duration-200',
            cfg.border,
        )}>
            {/* Main row */}
            <div className="flex items-start gap-3.5 px-4 py-3.5">

                {/* Icon stack */}
                <div className="relative shrink-0 mt-0.5">
                    <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', cfg.bg)}>
                        <ResourceIcon size={15} className="text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-4.5 w-4.5 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-xs">
                        <ActionIcon size={9} style={{ color: cfg.color }} />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Badge row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.soft)}>
                            {humanize(resource)}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                            {humanize(action)}
                        </span>
                    </div>

                    {/* Summary */}
                    <p className="text-sm font-semibold text-gray-800 leading-snug mb-2.5">
                        {eventSummary(log)}
                    </p>

                    {/* Actor + meta */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {log.actor ? (
                            <div className="flex items-center gap-1.5">
                                {log.actor.avatar ? (
                                    <img src={log.actor.avatar} alt={log.actor.name}
                                        className="h-5 w-5 rounded-full object-cover ring-1 ring-gray-200 shrink-0" />
                                ) : (
                                    <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center
                                                    text-[8px] font-extrabold text-indigo-600 shrink-0">
                                        {initials(log.actor.name)}
                                    </div>
                                )}
                                <span className="text-xs font-semibold text-gray-700">{log.actor.name}</span>
                                {primaryRole && (
                                    <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md', roleColor(primaryRole))}>
                                        {primaryRole.replace(/_/g, ' ')}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-400 italic">System</span>
                        )}

                        {log.ip_address && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Globe size={9} className="shrink-0" /> {log.ip_address}
                            </span>
                        )}
                        {ua && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Monitor size={9} className="shrink-0" /> {ua}
                            </span>
                        )}
                    </div>
                </div>

                {/* Time + expand */}
                <div className="flex flex-col items-end gap-2 shrink-0 ml-1">
                    <div className="text-right">
                        <time title={ts.toLocaleString()}
                            className="flex items-center gap-1 text-[10px] text-gray-400 font-medium justify-end">
                            <Clock size={9} /> {timeAgo(log.created_at)}
                        </time>
                        <span className="text-[9px] text-gray-300 block mt-0.5">
                            {ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>

                    {hasDiff && (
                        <button onClick={onToggle}
                            className={cn(
                                'flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all',
                                expanded
                                    ? 'text-white shadow-sm'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                            )}
                            style={expanded ? { backgroundColor: cfg.color } : {}}>
                            <ChevronDown size={10} className={cn('transition-transform', expanded && 'rotate-180')} />
                            {expanded ? 'Hide' : 'Details'}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded diff */}
            {expanded && hasDiff && (
                <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
                        <Database size={10} /> Payload
                    </p>
                    <ChangeDiff oldValues={log.old_values} newValues={log.new_values} />
                </div>
            )}
        </div>
    );
}

// ─── Top actor card ───────────────────────────────────────────────────────────

function TopActorCard({ actor, total, rank }) {
    if (!actor?.user) return null;
    const u = actor.user;
    const primaryRole = u.roles?.[0]?.name;
    const colors = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
    return (
        <div className="flex items-center gap-2.5 py-2">
            <span className={cn('text-xs font-black w-5 text-center', colors[rank] ?? 'text-gray-300')}>
                {rank + 1}
            </span>
            {u.avatar ? (
                <img src={u.avatar} alt={u.name} className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20 shrink-0" />
            ) : (
                <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-extrabold text-white shrink-0">
                    {initials(u.name)}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{u.name}</p>
                {primaryRole && (
                    <p className="text-[9px] text-white/40 truncate">{primaryRole.replace(/_/g, ' ')}</p>
                )}
            </div>
            <span className="text-xs font-bold text-white/60 tabular-nums shrink-0">{total}</span>
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

    return (
        <div className="flex items-center justify-between pt-5 border-t border-gray-100">
            <span className="text-xs text-gray-400">
                Showing <strong className="text-gray-600">{meta.from ?? 0}–{meta.to ?? 0}</strong> of{' '}
                <strong className="text-gray-600">{meta.total?.toLocaleString()}</strong> entries
            </span>
            <div className="flex items-center gap-1">
                <button onClick={() => onChange(page - 1)} disabled={page === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14} />
                </button>
                {start > 1 && (
                    <>
                        <button onClick={() => onChange(1)}
                            className="h-8 min-w-8 px-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">1</button>
                        {start > 2 && <span className="text-gray-400 text-xs px-1">…</span>}
                    </>
                )}
                {pages.map(p => (
                    <button key={p} onClick={() => onChange(p)}
                        className={cn(
                            'h-8 min-w-8 px-2 rounded-lg text-xs font-semibold transition-all',
                            p === page
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                        )}>{p}</button>
                ))}
                {end < meta.last_page && (
                    <>
                        {end < meta.last_page - 1 && <span className="text-gray-400 text-xs px-1">…</span>}
                        <button onClick={() => onChange(meta.last_page)}
                            className="h-8 min-w-8 px-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">{meta.last_page}</button>
                    </>
                )}
                <button onClick={() => onChange(page + 1)} disabled={page === meta.last_page}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={14} />
                </button>
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
    const [perPage,    setPerPage]    = useState(50);
    const [expandedId, setExpandedId] = useState(null);
    const [category,   setCategory]   = useState('all');
    const [liveRefresh,setLiveRefresh]= useState(false);
    const [filters,    setFilters]    = useState({ q: '', date_from: '', date_to: '' });
    const [search,     setSearch]     = useState('');
    const searchTimer = useRef(null);
    const liveTimer   = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                ...filters,
                page,
                per_page: perPage,
                ...(category !== 'all' ? { category } : {}),
            };
            const r = await get('/audit-logs', params);
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
    }, [filters, page, perPage, category]);

    useEffect(() => { load(); }, [load]);

    // Live refresh
    useEffect(() => {
        if (liveRefresh) {
            liveTimer.current = setInterval(() => load(), 30_000);
        } else {
            clearInterval(liveTimer.current);
        }
        return () => clearInterval(liveTimer.current);
    }, [liveRefresh, load]);

    const handleSearch = (val) => {
        setSearch(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setFilters(f => ({ ...f, q: val }));
            setPage(1);
        }, 350);
    };

    const setFilter = (key, val) => { setFilters(f => ({ ...f, [key]: val })); setPage(1); };
    const clearFilters = () => { setFilters({ q: '', date_from: '', date_to: '' }); setSearch(''); setPage(1); };
    const hasFilters = filters.q || filters.date_from || filters.date_to;

    const changeCategory = (id) => { setCategory(id); setPage(1); setExpandedId(null); };

    // Group logs by date
    const grouped = logs.reduce((acc, log) => {
        const day = new Date(log.created_at).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        (acc[day] = acc[day] ?? []).push(log);
        return acc;
    }, {});

    const totalEvents = stats ? Object.values(stats.by_event ?? {}).reduce((a, b) => a + b, 0) : 0;

    return (
        <AppLayout breadcrumb="Audit Logs">
            <div className="max-w-6xl mx-auto space-y-5 pb-10">

                {/* ── Hero ─────────────────────────────────────────────────── */}
                <div className="rounded-3xl overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#1d4ed8 100%)' }}>

                    <div className="h-px w-full"
                        style={{ background: 'linear-gradient(90deg,transparent,#818cf860,transparent)' }} />

                    <div className="px-6 pt-6 pb-5 flex flex-col lg:flex-row gap-6">

                        {/* Left: title + stats */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                                        <Activity size={20} className="text-indigo-300" />
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-extrabold text-white tracking-tight">Activity Audit Log</h1>
                                        <p className="text-xs text-white/40 mt-0.5">Every CRUD operation across all modules</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Live refresh toggle */}
                                    <button onClick={() => setLiveRefresh(v => !v)}
                                        className={cn(
                                            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all font-semibold',
                                            liveRefresh
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                                        )}>
                                        <Radio size={11} className={liveRefresh ? 'animate-pulse' : ''} />
                                        {liveRefresh ? 'Live' : 'Live off'}
                                    </button>
                                    <button onClick={load} disabled={loading}
                                        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white
                                                   px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20
                                                   bg-white/5 hover:bg-white/10 transition-all">
                                        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            {/* Stat grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {[
                                    { label: "Today",        value: stats?.today,         icon: CalendarDays, color: '#818cf8' },
                                    { label: "This week",    value: stats?.this_week,     icon: TrendingUp,   color: '#34d399' },
                                    { label: "Active users", value: stats?.unique_actors, icon: Users,        color: '#fb923c' },
                                    { label: "Total events", value: meta?.total,          icon: BarChart2,    color: '#a78bfa' },
                                ].map(s => (
                                    <div key={s.label} className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10 flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: `${s.color}25` }}>
                                            <s.icon size={15} style={{ color: s.color }} />
                                        </div>
                                        <div>
                                            <p className="text-lg font-extrabold text-white tabular-nums leading-none">
                                                {s.value?.toLocaleString() ?? '—'}
                                            </p>
                                            <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: top actors */}
                        {stats?.top_actors?.length > 0 && (
                            <div className="lg:w-60 shrink-0 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 flex items-center gap-1.5">
                                    <Star size={10} /> Most active (30 days)
                                </p>
                                <div className="divide-y divide-white/5">
                                    {stats.top_actors.map((a, i) => (
                                        <TopActorCard key={i} actor={a} total={a.total} rank={i} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Category tabs ─────────────────────────────────────────── */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-xs p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
                    {CATEGORIES.map(cat => {
                        const count = cat.id === 'all'
                            ? totalEvents
                            : (stats?.by_category?.[cat.id] ?? 0);
                        const active = category === cat.id;
                        return (
                            <button key={cat.id} onClick={() => changeCategory(cat.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-1 justify-center',
                                    active
                                        ? 'text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                )}
                                style={active ? { backgroundColor: cat.color } : {}}>
                                <cat.icon size={12} />
                                <span className="hidden sm:inline">{cat.label}</span>
                                {count > 0 && (
                                    <span className={cn(
                                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
                                        active ? 'bg-white/25' : 'bg-gray-100 text-gray-500'
                                    )}>{count.toLocaleString()}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Filters bar ───────────────────────────────────────────── */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-xs p-3.5">
                    <div className="flex flex-wrap gap-3 items-center">
                        <Filter size={13} className="text-gray-300 shrink-0" />

                        {/* Search */}
                        <div className="relative flex-1 min-w-56">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            {search && (
                                <button onClick={() => handleSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={12} />
                                </button>
                            )}
                            <input value={search} onChange={e => handleSearch(e.target.value)}
                                placeholder="Search by name, email, IP, or event…"
                                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50
                                           focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 transition-all" />
                        </div>

                        {/* Date range */}
                        <div className="flex items-center gap-2">
                            <CalendarDays size={12} className="text-gray-400 shrink-0" />
                            <input type="date" value={filters.date_from}
                                onChange={e => setFilter('date_from', e.target.value)}
                                className="py-2 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all" />
                            <span className="text-gray-400 text-xs">—</span>
                            <input type="date" value={filters.date_to}
                                onChange={e => setFilter('date_to', e.target.value)}
                                className="py-2 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all" />
                        </div>

                        {/* Per page */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 shrink-0">Show</span>
                            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                                className="py-2 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all">
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>

                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 border border-red-100 transition-all font-semibold">
                                <X size={12} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Timeline ──────────────────────────────────────────────── */}
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 border-l-[3px] border-l-gray-200 p-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="h-9 w-9 rounded-xl bg-gray-200 animate-pulse shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="flex gap-2">
                                            <div className="h-4 w-16 bg-gray-200 rounded-full animate-pulse" />
                                            <div className="h-4 w-12 bg-gray-100 rounded-full animate-pulse" />
                                        </div>
                                        <div className="h-4 w-72 bg-gray-200 rounded animate-pulse" />
                                        <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
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
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or category</p>
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-4 py-2 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors">
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(grouped).map(([day, dayLogs]) => (
                            <div key={day}>
                                {/* Day label */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-2.5 pr-3 py-1.5 shadow-xs shrink-0">
                                        <CalendarDays size={11} className="text-indigo-500" />
                                        <span className="text-[11px] font-bold text-gray-700">{day}</span>
                                    </div>
                                    <div className="flex-1 h-px bg-linear-to-r from-gray-200 to-transparent" />
                                    <span className="text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 px-2.5 py-1 rounded-full shrink-0">
                                        {dayLogs.length} {dayLogs.length === 1 ? 'event' : 'events'}
                                    </span>
                                </div>

                                {/* Entries with left timeline rail */}
                                <div className="relative pl-4 border-l-2 border-gray-100 space-y-2.5 ml-3">
                                    {dayLogs.map(log => (
                                        <div key={log.id} className="relative">
                                            {/* Rail dot */}
                                            <div className="absolute -left-5.25 top-4 h-2.5 w-2.5 rounded-full border-2 border-white ring-1 ring-gray-200 bg-gray-300" />
                                            <LogEntry
                                                log={log}
                                                expanded={expandedId === log.id}
                                                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Pagination ────────────────────────────────────────────── */}
                <Pagination meta={meta} page={page} onChange={p => { setPage(p); setExpandedId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </div>
        </AppLayout>
    );
}
