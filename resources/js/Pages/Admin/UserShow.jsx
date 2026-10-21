import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, Radar,
    ResponsiveContainer, Tooltip,
} from 'recharts';
import {
    ArrowLeft, Mail, Phone, Building2, BookOpen,
    ShieldCheck, CheckCircle2, XCircle, AlertTriangle, FileText, Star,
    DollarSign, GitBranch, Users, MessageSquare, Flag, Scale,
    Award, Globe, Microscope, Bell, Monitor, Clock, Activity,
    TrendingUp, ChevronRight, ChevronDown, Eye, Zap, Database,
    Send, UserX, RefreshCw, ExternalLink,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { get, put } from '../../lib/api';
import { formatDate, formatDateTime, formatCurrency, cn, getStatusLabel } from '../../lib/utils';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ROLE_LABELS = {
    admin: 'Admin', super_admin: 'Super Admin', central_officer: 'Central Officer',
    college_officer: 'College Officer', finance_officer: 'Finance Officer',
    research_officer: 'Research Officer', community_officer: 'Community Officer', college_rtt_manager: 'College RTT Manager',
    technology_officer: 'Technology Officer', support_officer: 'Support Officer',
    staff: 'Staff', guest: 'Guest',
};
const DARK_ROLE_COLORS = {
    admin:              'bg-rose-500/15 text-rose-300 border border-rose-500/25',
    super_admin:        'bg-rose-500/20 text-rose-200 border border-rose-400/30',
    central_officer:    'bg-orange-500/15 text-orange-300 border border-orange-500/25',
    college_officer:    'bg-teal-500/15 text-teal-300 border border-teal-500/25',
    finance_officer:    'bg-amber-500/15 text-amber-300 border border-amber-500/25',
    research_officer:   'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25',
    community_officer:  'bg-pink-500/15 text-pink-300 border border-pink-500/25',
    technology_officer: 'bg-violet-500/15 text-violet-300 border border-violet-500/25',
    support_officer:    'bg-sky-500/15 text-sky-300 border border-sky-500/25',
    staff:              'bg-white/8 text-zinc-300 border border-white/12',
    guest:              'bg-white/5 text-zinc-400 border border-white/8',
};
const PROPOSAL_STATUS_COLORS = {
    draft:              'bg-gray-100 text-gray-500',
    submitted:          'bg-blue-50 text-blue-700',
    validated:          'bg-cyan-50 text-cyan-700',
    under_blind_review: 'bg-purple-50 text-purple-700',
    accepted:           'bg-indigo-50 text-indigo-700',
    funded:             'bg-emerald-50 text-emerald-700',
    midterm_evaluation: 'bg-yellow-50 text-yellow-700',
    completed:          'bg-green-50 text-green-700',
    archived:           'bg-gray-100 text-gray-400',
    rejected:           'bg-red-50 text-red-600',
};
const AVATAR_GRADIENTS = [
    ['from-blue-500', 'to-indigo-600'],
    ['from-violet-500', 'to-purple-600'],
    ['from-emerald-500', 'to-teal-600'],
    ['from-orange-500', 'to-amber-600'],
    ['from-pink-500', 'to-rose-600'],
    ['from-cyan-500', 'to-sky-600'],
];
const ACTIVE_STATUSES = [
    'submitted', 'validated', 'under_blind_review', 'blind_review_passed',
    'accepted', 'funded', 'midterm_evaluation',
];
const TABS = [
    { id: 'overview',  label: 'Overview',    icon: TrendingUp },
    { id: 'timeline',  label: 'Timeline',    icon: Activity   },
    { id: 'proposals', label: 'Proposals',   icon: FileText   },
    { id: 'reviews',   label: 'Reviews',     icon: Star       },
    { id: 'finance',   label: 'Finance',     icon: DollarSign },
    { id: 'admin',     label: 'Admin & Log', icon: Database   },
];
const KPI_ACCENT = {
    indigo: 'bg-indigo-500', amber:  'bg-amber-400',  green: 'bg-emerald-500',
    teal:   'bg-teal-500',   rose:   'bg-rose-500',   blue:  'bg-blue-500',
    purple: 'bg-violet-500', gray:   'bg-gray-300',   orange: 'bg-orange-500',
};

// ── ANIMATED COUNTER ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
    const [value, setValue] = useState(0);
    const frameRef = useRef();
    useEffect(() => {
        if (!target) { setValue(0); return; }
        const start = Date.now();
        const tick = () => {
            const p = Math.min((Date.now() - start) / duration, 1);
            setValue(Math.round((1 - Math.pow(1 - p, 4)) * target));
            if (p < 1) frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameRef.current);
    }, [target, duration]);
    return value;
}

// ── SKELETON ──────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
    return <div className={cn('animate-pulse bg-gray-100 rounded-lg', className)} />;
}

// ── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, numericValue, sub, color = 'indigo' }) {
    const accentCls = KPI_ACCENT[color] ?? KPI_ACCENT.indigo;
    const num       = useCountUp(numericValue ?? 0);
    const display   = numericValue != null ? num.toLocaleString() : value;
    return (
        <div className="relative bg-white rounded-xl border border-gray-100 px-5 pt-4 pb-4 overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all group">
            <div className={cn('absolute left-0 inset-y-3 w-0.75 rounded-r-full', accentCls)} />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">{label}</p>
            <p className="text-[2.25rem] font-black text-gray-900 tracking-tight leading-none tabular-nums">{display}</p>
            {sub && <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>}
        </div>
    );
}

// ── SECTION CARD ──────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, count, children }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100">
                <Icon size={13} className="text-gray-350 shrink-0" />
                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex-1">{title}</h3>
                {count != null && (
                    <span className="text-[11px] font-semibold tabular-nums bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{count}</span>
                )}
            </div>
            <div className="divide-y divide-gray-50">
                {children ?? (
                    <div className="px-5 py-10 text-center">
                        <p className="text-sm text-gray-300 font-medium">No records</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── EXPANDABLE PROPOSAL ROW ───────────────────────────────────────────────────
function ProposalRow({ p, roleLabel }) {
    const [open, setOpen] = useState(false);
    const statusCls = PROPOSAL_STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-500';
    return (
        <div>
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left group"
            >
                <FileText size={13} className="text-gray-300 shrink-0 group-hover:text-gray-400 transition-colors" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{p.tracker_number}</span>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize', statusCls)}>
                            {getStatusLabel(p.status)}
                        </span>
                        {roleLabel && <span className="text-[10px] font-medium bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full capitalize">{roleLabel}</span>}
                        {p.college_name && <span className="text-[10px] text-gray-400">{p.college_name}</span>}
                        {p.academic_year && <span className="text-[10px] text-gray-400">{p.academic_year}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {p.awarded_amount > 0 && (
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full tabular-nums">
                            {formatCurrency(p.awarded_amount)}
                        </span>
                    )}
                    {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                </div>
            </button>
            {open && (
                <div className="px-5 pb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                        {[
                            { label: 'Category',   value: p.category?.replace(/_/g, ' ') || '—' },
                            { label: 'Submitted',  value: p.submitted_at ? formatDate(p.submitted_at) : '—' },
                            { label: 'Department', value: p.department_name || p.pi_name || '—' },
                            { label: 'Awarded',    value: p.awarded_amount > 0 ? formatCurrency(p.awarded_amount) : '—' },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                                <p className="font-semibold text-gray-700 capitalize">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── REVIEW ROW ────────────────────────────────────────────────────────────────
function ReviewRow({ r }) {
    const [open, setOpen] = useState(false);
    const statusCls = {
        submitted:   'bg-emerald-50 text-emerald-700',
        pending:     'bg-amber-50 text-amber-700',
        in_progress: 'bg-blue-50 text-blue-700',
    }[r.status] ?? 'bg-gray-100 text-gray-500';
    return (
        <div>
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left group"
            >
                <Star size={13} className="text-gray-300 shrink-0 group-hover:text-gray-400 transition-colors" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.proposal_title}</p>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{r.tracker_number}</span>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize', statusCls)}>
                            {r.status?.replace(/_/g, ' ')}
                        </span>
                        {r.evaluation_type && <span className="text-[10px] text-gray-400">{r.evaluation_type}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-gray-400">{formatDate(r.assigned_at)}</span>
                    {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                </div>
            </button>
            {open && (
                <div className="px-5 pb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                        {[
                            { label: 'Assigned by', value: r.assigned_by_name || '—' },
                            { label: 'Due date',    value: r.due_date ? formatDate(r.due_date) : '—' },
                            { label: 'Submitted',   value: r.submitted_at ? formatDate(r.submitted_at) : 'Not yet' },
                            { label: 'Type',        value: r.is_external ? 'External' : 'Internal' },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                                <p className="font-semibold text-gray-700">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── SIMPLE ROW ────────────────────────────────────────────────────────────────
function SimpleRow({ icon: Icon, label, sub, right, iconColor = 'text-gray-300' }) {
    return (
        <div className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <Icon size={13} className={cn('shrink-0', iconColor)} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
                {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    );
}

// ── ACTIVITY HEATMAP ──────────────────────────────────────────────────────────
const HEAT_CLS = ['bg-gray-100', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-400', 'bg-indigo-600'];
function heatLevel(n) { return n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 10 ? 3 : 4; }

function ActivityHeatmap({ data }) {
    if (!data?.length) {
        return <p className="text-sm text-gray-300 text-center py-8">No activity data</p>;
    }
    const firstDay = new Date(data[0].date).getDay();
    const padded   = [...Array(firstDay).fill(null), ...data];
    const weeks    = [];
    for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
    const total = data.reduce((s, d) => s + d.count, 0);
    return (
        <div>
            <div className="flex items-end gap-0.75 overflow-x-auto pb-1">
                {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-0.75">
                        {week.map((day, di) => (
                            day === null
                                ? <div key={di} className="w-3 h-3" />
                                : (
                                    <div
                                        key={di}
                                        title={`${day.date}: ${day.count} action${day.count !== 1 ? 's' : ''}`}
                                        className={cn('w-3 h-3 rounded-sm cursor-default', HEAT_CLS[heatLevel(day.count)])}
                                    />
                                )
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-gray-400">{total.toLocaleString()} actions · past 12 months</span>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 mr-0.5">Less</span>
                    {HEAT_CLS.map((cls, i) => <div key={i} className={cn('w-2.5 h-2.5 rounded-sm', cls)} />)}
                    <span className="text-[10px] text-gray-400 ml-0.5">More</span>
                </div>
            </div>
        </div>
    );
}

// ── RADAR FINGERPRINT ─────────────────────────────────────────────────────────
function RadarFingerprint({ summary: s }) {
    const dims = [
        { label: 'Research',      value: Math.min(100, ((s.proposals_as_pi    ?? 0) / 20)  * 100) },
        { label: 'Collaboration', value: Math.min(100, ((s.proposals_as_member ?? 0) / 10) * 100) },
        { label: 'Review',        value: Math.min(100, ((s.reviews_assigned   ?? 0) / 20)  * 100) },
        { label: 'Finance',       value: Math.min(100, (((s.budget_requests ?? 0) + (s.budget_approvals ?? 0) + (s.disbursements ?? 0)) / 15) * 100) },
        { label: 'Operations',    value: Math.min(100, ((s.workflow_actions   ?? 0) / 30)  * 100) },
        { label: 'External',      value: Math.min(100, (((s.ef_applications ?? 0) + (s.ef_memberships ?? 0) + (s.abstract_reviews ?? 0)) / 10) * 100) },
    ];
    return (
        <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={dims} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                <PolarGrid stroke="#f0f0f0" />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 500 }} />
                <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.12} strokeWidth={1.5} dot={{ r: 2.5, fill: '#6366f1', strokeWidth: 0 }} />
                <Tooltip formatter={(v) => [`${Math.round(v)}%`, 'Score']} contentStyle={{ fontSize: 11 }} />
            </RadarChart>
        </ResponsiveContainer>
    );
}

// ── TIMELINE EVENT ────────────────────────────────────────────────────────────
const TIMELINE_MAP = {
    file:         { icon: FileText,     cls: 'bg-blue-50 text-blue-500'    },
    send:         { icon: Send,         cls: 'bg-indigo-50 text-indigo-500' },
    zap:          { icon: Zap,          cls: 'bg-teal-50 text-teal-500'    },
    star:         { icon: Star,         cls: 'bg-amber-50 text-amber-500'  },
    check:        { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-500' },
    check_circle: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-500' },
    dollar:       { icon: DollarSign,   cls: 'bg-amber-50 text-amber-500'  },
    microscope:   { icon: Microscope,   cls: 'bg-teal-50 text-teal-500'    },
    flag:         { icon: Flag,         cls: 'bg-red-50 text-red-500'      },
    scale:        { icon: Scale,        cls: 'bg-yellow-50 text-yellow-600'},
    globe:        { icon: Globe,        cls: 'bg-rose-50 text-rose-500'    },
};

function TimelineEvent({ event, isLast }) {
    const cfg  = TIMELINE_MAP[event.icon] ?? TIMELINE_MAP.file;
    const Icon = cfg.icon;
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center shrink-0">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', cfg.cls)}>
                    <Icon size={13} />
                </div>
                {!isLast && <div className="w-px flex-1 bg-gray-100 mt-2" />}
            </div>
            <div className="pb-6 flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{event.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{event.description}</p>
                        {event.sub && <p className="text-[11px] text-gray-400 mt-1">{event.sub}</p>}
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 font-mono mt-0.5">{formatDate(event.date)}</span>
                </div>
            </div>
        </div>
    );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AdminUserShow() {
    const id = window.location.pathname.split('/').pop();
    const { hasPermission, impersonate } = useAuth();

    const [user,    setUser]    = useState(null);
    const [profile, setProfile] = useState(null);
    const [timeline, setTimeline] = useState(null);
    const [heatmap,  setHeatmap]  = useState(null);
    const [phase,    setPhase]    = useState('loading');
    const [tab,      setTab]      = useState('overview');
    const [impersonateTarget, setImpersonateTarget] = useState(null);
    const [statusTarget,      setStatusTarget]      = useState(null);
    const [timelineFilter,    setTimelineFilter]    = useState('all');

    const canImpersonate = hasPermission('users.impersonate');
    const canManageUsers = hasPermission('users.update');

    // Phase 1: user + profile-360 together
    useEffect(() => {
        Promise.all([get(`/users/${id}`), get(`/users/${id}/profile-360`)])
            .then(([u, p]) => { setUser(u.data); setProfile(p.data); setPhase('header'); })
            .catch(() => setPhase('error'));
    }, [id]);

    // Phase 2: timeline + heatmap after phase 1
    useEffect(() => {
        if (phase !== 'header') return;
        Promise.all([get(`/users/${id}/activity-timeline`), get(`/users/${id}/activity-heatmap`)])
            .then(([tl, hm]) => { setTimeline(tl.data); setHeatmap(hm.data); setPhase('full'); });
    }, [phase, id]);

    const doImpersonate = useCallback(async () => {
        if (!impersonateTarget) return;
        await impersonate(impersonateTarget.id);
        setImpersonateTarget(null);
    }, [impersonateTarget, impersonate]);

    const doStatusChange = useCallback(async () => {
        if (!statusTarget) return;
        await put(`/users/${user.id}/status`, { status: statusTarget });
        setUser(u => ({ ...u, status: statusTarget }));
        setStatusTarget(null);
    }, [statusTarget, user]);

    // ── Loading ───────────────────────────────────────────────────────────
    if (phase === 'loading') {
        return (
            <AppLayout breadcrumb="User 360°">
                <div className="max-w-6xl mx-auto space-y-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-56 w-full rounded-2xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <div className="grid grid-cols-4 gap-3">
                        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (phase === 'error' || !user) {
        return (
            <AppLayout breadcrumb="User Not Found">
                <p className="text-gray-400 text-sm">User not found.</p>
            </AppLayout>
        );
    }

    // ── Derived ───────────────────────────────────────────────────────────
    const roles    = (user.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
    const name     = user.name ?? '';
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const [gradFrom, gradTo] = AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
    const s = profile?.summary ?? {};

    const activePi      = (profile?.proposals_as_pi     ?? []).filter(p => ACTIVE_STATUSES.includes(p.status));
    const historyPi     = (profile?.proposals_as_pi     ?? []).filter(p => !ACTIVE_STATUSES.includes(p.status));
    const activeMember  = (profile?.proposals_as_member ?? []).filter(p => ACTIVE_STATUSES.includes(p.status));
    const historyMember = (profile?.proposals_as_member ?? []).filter(p => !ACTIVE_STATUSES.includes(p.status));
    const pendingReviews   = (profile?.review_assignments ?? []).filter(r => ['pending', 'in_progress'].includes(r.status));
    const completedReviews = (profile?.review_assignments ?? []).filter(r => r.status === 'submitted');

    const filteredTimeline = (timeline ?? []).filter(e =>
        timelineFilter === 'all' || e.type?.startsWith(timelineFilter)
    );

    const statusDot = { active: 'bg-emerald-400', inactive: 'bg-gray-500', suspended: 'bg-rose-400' }[user.status] ?? 'bg-gray-500';
    const statusLabel = { active: 'Active', inactive: 'Inactive', suspended: 'Suspended' }[user.status] ?? user.status;

    return (
        <AppLayout breadcrumb="User 360°">
            <div className="max-w-6xl mx-auto space-y-0">

                {/* ── BACK ───────────────────────────────────────────────── */}
                <div className="pb-4">
                    <Link href="/admin/users"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium">
                        <ArrowLeft size={13} /> All users
                    </Link>
                </div>

                {/* ── DARK PROFILE HEADER ────────────────────────────────── */}
                <div className="bg-zinc-950 rounded-2xl overflow-hidden">
                    <div className="px-7 pt-7 pb-6">

                        {/* Top row: avatar + identity + stats */}
                        <div className="flex flex-wrap items-start gap-6">
                            {/* Avatar */}
                            <div className={cn(
                                `w-18 h-18 rounded-2xl bg-linear-to-br ${gradFrom} ${gradTo}`,
                                'flex items-center justify-center text-white text-2xl font-black shrink-0',
                                'ring-1 ring-white/10 shadow-2xl overflow-hidden',
                            )}>
                                {user.avatar
                                    ? <img src={user.avatar} alt={name} className="w-full h-full object-cover" />
                                    : initials}
                            </div>

                            {/* Name + roles */}
                            <div className="flex-1 min-w-0 pt-1">
                                <div className="flex items-center gap-3 mb-1.5">
                                    <h1 className="text-xl font-bold text-white tracking-tight truncate">
                                        {user.title && <span className="text-zinc-500 font-normal mr-2 text-lg">{user.title}</span>}
                                        {name}
                                    </h1>
                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 bg-white/8 border border-white/10 px-2.5 py-1 rounded-full shrink-0">
                                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot)} />
                                        {statusLabel}
                                    </span>
                                </div>
                                <p className="text-sm text-zinc-500 mb-3">{user.email}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {roles.length === 0
                                        ? <span className="text-xs text-zinc-600 italic">No role assigned</span>
                                        : roles.map(r => (
                                            <span key={r} className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize', DARK_ROLE_COLORS[r] ?? 'bg-white/8 text-zinc-300 border border-white/10')}>
                                                {ROLE_LABELS[r] ?? r.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                </div>
                            </div>

                            {/* Hero stats */}
                            <div className="flex items-center divide-x divide-white/8 shrink-0 self-center">
                                {[
                                    { label: 'PI Proposals', value: s.proposals_as_pi ?? 0 },
                                    { label: 'Reviews',      value: s.reviews_assigned ?? 0 },
                                    { label: 'Actions',      value: s.workflow_actions ?? 0 },
                                ].map(({ label, value }) => (
                                    <div key={label} className="px-5 first:pl-0 last:pr-0 text-center">
                                        <p className="text-[1.75rem] font-black text-white tabular-nums leading-none">{value.toLocaleString()}</p>
                                        <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mt-1">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Meta row + actions */}
                        <div className="mt-6 pt-5 border-t border-white/8 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-zinc-500">
                                {user.college?.name    && <span className="flex items-center gap-1.5"><Building2 size={11} className="text-zinc-600" />{user.college.name}</span>}
                                {user.department?.name && <span className="flex items-center gap-1.5"><BookOpen   size={11} className="text-zinc-600" />{user.department.name}</span>}
                                {user.phone            && <span className="flex items-center gap-1.5"><Phone      size={11} className="text-zinc-600" />{user.phone}</span>}
                                {user.last_login_at    && <span className="flex items-center gap-1.5"><Clock      size={11} className="text-zinc-600" />Last seen {formatDate(user.last_login_at)}</span>}
                                {s.total_funded_amount > 0 && <span className="flex items-center gap-1.5"><Award size={11} className="text-zinc-600" />{formatCurrency(s.total_funded_amount)} funded</span>}
                            </div>

                            {/* Quick actions on dark bg */}
                            <div className="flex flex-wrap gap-2">
                                {canImpersonate && user.status === 'active' && (
                                    <button onClick={() => setImpersonateTarget(user)}
                                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/25 transition-all">
                                        <Eye size={11} /> Impersonate
                                    </button>
                                )}
                                {canManageUsers && user.status === 'active' && (
                                    <button onClick={() => setStatusTarget('suspended')}
                                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20 transition-all">
                                        <UserX size={11} /> Suspend
                                    </button>
                                )}
                                {canManageUsers && (user.status === 'suspended' || user.status === 'inactive') && (
                                    <button onClick={() => setStatusTarget('active')}
                                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all">
                                        <RefreshCw size={11} /> Reactivate
                                    </button>
                                )}
                                <a href={`mailto:${user.email}`}
                                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/6 text-zinc-300 hover:bg-white/10 border border-white/8 transition-all">
                                    <Mail size={11} /> Email
                                </a>
                                <Link href={`/proposals?pi_search=${encodeURIComponent(name)}`}
                                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/6 text-zinc-300 hover:bg-white/10 border border-white/8 transition-all">
                                    <ExternalLink size={11} /> Proposals
                                </Link>
                            </div>
                        </div>

                        {/* Expertise tags */}
                        {user.expertise?.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {user.expertise.map((tag, i) => (
                                    <span key={i} className="text-[10px] font-medium bg-white/6 text-zinc-400 border border-white/8 px-2 py-0.5 rounded-full">{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── TAB BAR (underline style, sticky) ─────────────────── */}
                <div className="sticky top-0 z-20 bg-white border-b border-gray-100 mx-0 mt-5 mb-5">
                    <div className="flex gap-0 overflow-x-auto">
                        {TABS.map(({ id: tid, label, icon: Icon }) => (
                            <button key={tid} onClick={() => setTab(tid)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all',
                                    tab === tid
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200',
                                )}>
                                <Icon size={13} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ════════════════════════════════════════════════════════ */}
                {/* TAB: OVERVIEW                                           */}
                {/* ════════════════════════════════════════════════════════ */}
                {tab === 'overview' && (
                    <div className="space-y-5">
                        {/* Primary KPIs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="PI Proposals"     numericValue={s.proposals_as_pi ?? 0}      color="indigo" />
                            <KpiCard label="Team Member"      numericValue={s.proposals_as_member ?? 0}  color="purple" />
                            <KpiCard label="Reviews assigned" numericValue={s.reviews_assigned ?? 0}     color="amber"  />
                            <KpiCard label="Reviews done"     numericValue={s.reviews_completed ?? 0}    color="green"  />
                        </div>

                        {/* Heatmap — full width */}
                        <div className="bg-white rounded-xl border border-gray-100 p-5">
                            <div className="flex items-center gap-2 mb-5">
                                <Activity size={13} className="text-gray-300" />
                                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Activity — last 12 months</h3>
                                {phase !== 'full' && <span className="text-[10px] text-gray-300 animate-pulse ml-1">Loading…</span>}
                            </div>
                            {phase === 'full'
                                ? <ActivityHeatmap data={heatmap} />
                                : <Skeleton className="h-20 w-full" />}
                        </div>

                        {/* Radar + Summary side by side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-white rounded-xl border border-gray-100 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <GitBranch size={13} className="text-gray-300" />
                                    <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Role fingerprint</h3>
                                </div>
                                <p className="text-[11px] text-gray-400 mb-3">Relative involvement across system dimensions</p>
                                <RadarFingerprint summary={s} />
                            </div>

                            <div className="bg-white rounded-xl border border-gray-100 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Eye size={13} className="text-gray-300" />
                                    <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Executive summary</h3>
                                </div>
                                <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
                                    <p>
                                        <span className="font-semibold text-gray-900">{name}</span> is a{' '}
                                        <span className="italic">{roles.map(r => ROLE_LABELS[r] ?? r.replace(/_/g, ' ')).join(', ') || 'system user'}</span>
                                        {user.college?.name ? ` in ${user.college.name}` : ''}.
                                        {user.status !== 'active' && <span className="text-rose-600 font-semibold"> Account is {user.status}.</span>}
                                    </p>
                                    {s.proposals_as_pi > 0 && (
                                        <p>PI on <span className="font-semibold text-gray-900">{s.proposals_as_pi}</span> proposal{s.proposals_as_pi !== 1 ? 's' : ''}
                                            {s.total_funded_amount > 0 ? ` · ${formatCurrency(s.total_funded_amount)} funded` : ''}
                                            {activePi.length > 0 ? ` · ${activePi.length} active` : ''}.
                                        </p>
                                    )}
                                    {s.proposals_as_member > 0 && (
                                        <p>Team member on <span className="font-semibold text-gray-900">{s.proposals_as_member}</span> additional proposal{s.proposals_as_member !== 1 ? 's' : ''}.</p>
                                    )}
                                    {s.reviews_assigned > 0 && (
                                        <p>Reviewed <span className="font-semibold text-gray-900">{s.reviews_completed}/{s.reviews_assigned}</span>
                                            {s.reviews_pending > 0 ? ` · ${s.reviews_pending} pending` : ''}.
                                        </p>
                                    )}
                                    {s.workflow_actions > 0 && (
                                        <p><span className="font-semibold text-gray-900">{s.workflow_actions}</span> workflow transitions performed.</p>
                                    )}
                                    {s.audit_actions > 0 && (
                                        <p><span className="font-semibold text-gray-900">{s.audit_actions}</span> audit log entries.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Secondary KPIs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="Workflow actions" numericValue={s.workflow_actions ?? 0}   color="teal"   />
                            <KpiCard label="Budget requests"  numericValue={s.budget_requests ?? 0}    color="amber"  />
                            <KpiCard label="EF applications"  numericValue={s.ef_applications ?? 0}    color="rose"   />
                            <KpiCard label="Total funded"     value={formatCurrency(s.total_funded_amount ?? 0)} color="green" />
                        </div>

                        {/* Recent activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <SectionCard title="Recent workflow actions" icon={Zap} count={s.workflow_actions}>
                                {(profile?.workflow_actions ?? []).slice(0, 6).map((w, i) => (
                                    <SimpleRow key={i} icon={ChevronRight} iconColor="text-teal-400"
                                        label={`${w.action?.replace(/_/g, ' ')} — ${w.proposal_title}`}
                                        sub={`${getStatusLabel(w.from_stage)} → ${getStatusLabel(w.to_stage)}`}
                                        right={<span className="text-[11px] text-gray-400">{formatDate(w.created_at)}</span>}
                                    />
                                ))}
                            </SectionCard>
                            <SectionCard title="Recent reviews" icon={Star} count={s.reviews_assigned}>
                                {(profile?.review_assignments ?? []).slice(0, 6).map((r, i) => (
                                    <ReviewRow key={i} r={r} />
                                ))}
                            </SectionCard>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════ */}
                {/* TAB: TIMELINE                                           */}
                {/* ════════════════════════════════════════════════════════ */}
                {tab === 'timeline' && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2 items-center">
                            {[
                                { key: 'all',      label: 'All'           },
                                { key: 'proposal', label: 'Proposals'     },
                                { key: 'workflow', label: 'Workflow'      },
                                { key: 'review',   label: 'Reviews'       },
                                { key: 'budget',   label: 'Finance'       },
                                { key: 'ef',       label: 'External Funds'},
                            ].map(({ key, label }) => (
                                <button key={key} onClick={() => setTimelineFilter(key)}
                                    className={cn(
                                        'text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all',
                                        timelineFilter === key
                                            ? 'bg-zinc-900 text-white border-zinc-900'
                                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700',
                                    )}>
                                    {label}
                                </button>
                            ))}
                            <span className="text-[11px] text-gray-400 ml-1">
                                {filteredTimeline.length} event{filteredTimeline.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-100 p-6">
                            {phase !== 'full' && timeline === null
                                ? (
                                    <div className="space-y-6">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="flex gap-4">
                                                <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                                                <div className="flex-1 space-y-2 pt-1">
                                                    <Skeleton className="h-4 w-40" />
                                                    <Skeleton className="h-3 w-64" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                                : filteredTimeline.length === 0
                                    ? <p className="text-sm text-gray-300 text-center py-10">No events match this filter.</p>
                                    : filteredTimeline.map((event, i) => (
                                        <TimelineEvent key={i} event={event} isLast={i === filteredTimeline.length - 1} />
                                    ))
                            }
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════ */}
                {/* TAB: PROPOSALS                                          */}
                {/* ════════════════════════════════════════════════════════ */}
                {tab === 'proposals' && (
                    <div className="space-y-4">
                        {(profile?.proposals_as_pi ?? []).length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 p-5">
                                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">PI proposals by status</h3>
                                {Object.entries(
                                    profile.proposals_as_pi.reduce((acc, p) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc; }, {})
                                ).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                                    <div key={status} className="flex items-center gap-3 mb-2 last:mb-0">
                                        <span className="text-[11px] text-gray-500 w-40 shrink-0 capitalize font-medium">{getStatusLabel(status)}</span>
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                                                style={{ width: `${Math.round((count / s.proposals_as_pi) * 100)}%` }} />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-600 w-5 text-right tabular-nums">{count}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <SectionCard title={`Active PI proposals`} icon={FileText} count={activePi.length}>
                            {activePi.length > 0 ? activePi.map((p, i) => <ProposalRow key={i} p={p} />) : null}
                        </SectionCard>
                        <SectionCard title="Past PI proposals" icon={FileText} count={historyPi.length}>
                            {historyPi.length > 0 ? historyPi.map((p, i) => <ProposalRow key={i} p={p} />) : null}
                        </SectionCard>
                        <SectionCard title="Active team memberships" icon={Users} count={activeMember.length}>
                            {activeMember.length > 0 ? activeMember.map((p, i) => <ProposalRow key={i} p={p} roleLabel={p.member_role?.replace(/_/g, ' ')} />) : null}
                        </SectionCard>
                        <SectionCard title="Past team memberships" icon={Users} count={historyMember.length}>
                            {historyMember.length > 0 ? historyMember.map((p, i) => <ProposalRow key={i} p={p} roleLabel={p.member_role?.replace(/_/g, ' ')} />) : null}
                        </SectionCard>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════ */}
                {/* TAB: REVIEWS                                            */}
                {/* ════════════════════════════════════════════════════════ */}
                {tab === 'reviews' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="Total assigned"  numericValue={s.reviews_assigned ?? 0}    color="amber"  />
                            <KpiCard label="Completed"       numericValue={s.reviews_completed ?? 0}   color="green"  />
                            <KpiCard label="Pending"         numericValue={s.reviews_pending ?? 0}     color="rose"   />
                            <KpiCard label="Criteria scored" numericValue={s.review_scores_given ?? 0} color="indigo" />
                        </div>
                        <SectionCard title="Pending reviews" icon={AlertTriangle} count={pendingReviews.length}>
                            {pendingReviews.length > 0 ? pendingReviews.map((r, i) => <ReviewRow key={i} r={r} />) : null}
                        </SectionCard>
                        <SectionCard title="Completed reviews" icon={CheckCircle2} count={completedReviews.length}>
                            {completedReviews.length > 0 ? completedReviews.map((r, i) => <ReviewRow key={i} r={r} />) : null}
                        </SectionCard>
                        <SectionCard title="Abstract reviews (conferences)" icon={BookOpen} count={s.abstract_reviews ?? 0}>
                            {(profile?.abstract_reviews ?? []).map((r, i) => (
                                <SimpleRow key={i} icon={BookOpen} iconColor="text-sky-400"
                                    label={r.abstract_title}
                                    sub={`${r.conference_title}${r.score != null ? ` · Score ${r.score}/10` : ''}`}
                                    right={r.recommendation && (
                                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', r.recommendation === 'accept' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                                            {r.recommendation}
                                        </span>
                                    )}
                                />
                            ))}
                        </SectionCard>
                        <SectionCard title="Assignments made by this user" icon={Users} count={s.assignments_made ?? 0}>
                            {(profile?.assignments_made ?? []).map((a, i) => (
                                <SimpleRow key={i} icon={Star} iconColor="text-indigo-400"
                                    label={`${a.reviewer_name} → ${a.proposal_title}`}
                                    sub={a.status?.replace(/_/g, ' ')}
                                    right={<span className="text-[11px] text-gray-400">{formatDate(a.assigned_at)}</span>}
                                />
                            ))}
                        </SectionCard>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════ */}
                {/* TAB: FINANCE                                            */}
                {/* ════════════════════════════════════════════════════════ */}
                {tab === 'finance' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="Budget requests"  numericValue={s.budget_requests ?? 0}     color="amber"  />
                            <KpiCard label="Approvals given"  numericValue={s.budget_approvals ?? 0}    color="green"  />
                            <KpiCard label="Disbursements"    numericValue={s.disbursements ?? 0}       color="teal"   />
                            <KpiCard label="Total funded (PI)" value={formatCurrency(s.total_funded_amount ?? 0)} color="indigo" />
                        </div>
                        <SectionCard title="Budget requests submitted" icon={DollarSign} count={s.budget_requests ?? 0}>
                            {(profile?.budget_requests ?? []).map((b, i) => (
                                <SimpleRow key={i} icon={DollarSign} iconColor="text-amber-400"
                                    label={b.proposal_title}
                                    sub={`Round ${b.funding_round} · ${b.status?.replace(/_/g, ' ')}`}
                                    right={<span className="text-[11px] font-semibold text-gray-700 tabular-nums">{formatCurrency(b.total_amount)}</span>}
                                />
                            ))}
                        </SectionCard>
                        <SectionCard title="Budget approvals given" icon={CheckCircle2} count={s.budget_approvals ?? 0}>
                            {(profile?.budget_approvals ?? []).map((a, i) => (
                                <SimpleRow key={i} icon={CheckCircle2} iconColor="text-emerald-400"
                                    label={a.proposal_title}
                                    sub={`Type: ${a.approval_type}${a.notes ? ` · ${a.notes}` : ''}`}
                                    right={<span className="text-[11px] text-gray-400">{formatDate(a.approved_at)}</span>}
                                />
                            ))}
                        </SectionCard>
                        <SectionCard title="Disbursements made" icon={DollarSign} count={s.disbursements ?? 0}>
                            {(profile?.disbursements ?? []).map((d, i) => (
                                <SimpleRow key={i} icon={DollarSign} iconColor="text-emerald-400"
                                    label={d.proposal_title}
                                    sub={d.transaction_id ? `TXN: ${d.transaction_id}` : 'No transaction ID'}
                                    right={<span className="text-[11px] font-semibold text-gray-700 tabular-nums">{formatCurrency(d.amount)}</span>}
                                />
                            ))}
                        </SectionCard>
                        <SectionCard title="Budget settlements" icon={FileText} count={(profile?.settlements ?? []).length}>
                            {(profile?.settlements ?? []).map((st, i) => (
                                <SimpleRow key={i} icon={FileText} iconColor="text-amber-400"
                                    label={st.proposal_title}
                                    sub={`Status: ${st.status?.replace(/_/g, ' ')}`}
                                    right={<span className="text-[11px] text-gray-600 font-semibold tabular-nums">{st.total_spent != null ? formatCurrency(st.total_spent) : formatDate(st.created_at)}</span>}
                                />
                            ))}
                        </SectionCard>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <SectionCard title="EF applications (as PI)" icon={Globe} count={s.ef_applications ?? 0}>
                                {(profile?.ef_applications ?? []).map((a, i) => (
                                    <SimpleRow key={i} icon={Globe} iconColor="text-rose-400"
                                        label={a.title}
                                        sub={`${a.agency_name} · ${a.ref_number}`}
                                        right={<span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full capitalize">{a.status?.replace(/_/g, ' ')}</span>}
                                    />
                                ))}
                            </SectionCard>
                            <SectionCard title="EF team memberships" icon={Users} count={s.ef_memberships ?? 0}>
                                {(profile?.ef_memberships ?? []).map((m, i) => (
                                    <SimpleRow key={i} icon={Users} iconColor="text-orange-400"
                                        label={m.title}
                                        sub={`${m.agency_name} · PI: ${m.pi_name} · ${m.role?.replace(/_/g, ' ')}`}
                                        right={<span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full capitalize">{m.status?.replace(/_/g, ' ')}</span>}
                                    />
                                ))}
                            </SectionCard>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════ */}
                {/* TAB: ADMIN & LOG                                        */}
                {/* ════════════════════════════════════════════════════════ */}
                {tab === 'admin' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="Workflow actions"   numericValue={s.workflow_actions ?? 0}    color="teal"   />
                            <KpiCard label="Complaints filed"   numericValue={s.complaints_filed ?? 0}   color="rose"   />
                            <KpiCard label="Complaints handled" numericValue={s.complaints_handled ?? 0} color="teal"   />
                            <KpiCard label="Appeals"            numericValue={(s.appeals_submitted ?? 0) + (s.appeals_resolved ?? 0)} color="amber" />
                            <KpiCard label="Audit entries"      numericValue={s.audit_actions ?? 0}      color="gray"   />
                            <KpiCard label="Notifications"      numericValue={s.notifications_total ?? 0} sub={`${s.notifications_unread ?? 0} unread`} color="blue" />
                            <KpiCard label="Active sessions"    numericValue={s.active_sessions ?? 0}    color="gray"   />
                            <KpiCard label="Research outputs"   numericValue={s.research_outputs ?? 0}   color="teal"   />
                        </div>

                        <SectionCard title="All workflow actions" icon={Zap} count={s.workflow_actions}>
                            {(profile?.workflow_actions ?? []).map((w, i) => (
                                <SimpleRow key={i} icon={ChevronRight} iconColor="text-teal-400"
                                    label={`${w.action?.replace(/_/g, ' ')} — ${w.proposal_title}`}
                                    sub={`${getStatusLabel(w.from_stage)} → ${getStatusLabel(w.to_stage)}${w.notes ? ` · ${w.notes}` : ''}`}
                                    right={<span className="text-[11px] text-gray-400">{formatDate(w.created_at)}</span>}
                                />
                            ))}
                        </SectionCard>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <SectionCard title="Complaints filed" icon={Flag} count={s.complaints_filed}>
                                {(profile?.complaints_filed ?? []).map((c, i) => (
                                    <SimpleRow key={i} icon={Flag} iconColor="text-red-400"
                                        label={c.proposal_title}
                                        sub={`Stage: ${c.stage?.replace(/_/g, ' ')} · ${c.status}`}
                                        right={<span className="text-[11px] text-gray-400">{formatDate(c.created_at)}</span>}
                                    />
                                ))}
                            </SectionCard>
                            <SectionCard title="Complaints handled" icon={ShieldCheck} count={s.complaints_handled}>
                                {(profile?.complaints_handled ?? []).map((c, i) => (
                                    <SimpleRow key={i} icon={ShieldCheck} iconColor="text-teal-400"
                                        label={c.proposal_title}
                                        sub={`Stage: ${c.stage?.replace(/_/g, ' ')} · ${c.status}`}
                                        right={<span className="text-[11px] text-gray-400">{formatDate(c.resolved_at ?? c.created_at)}</span>}
                                    />
                                ))}
                            </SectionCard>
                            <SectionCard title="Appeals submitted" icon={Scale} count={s.appeals_submitted}>
                                {(profile?.appeals_submitted ?? []).map((a, i) => (
                                    <SimpleRow key={i} icon={Scale} iconColor="text-yellow-500"
                                        label={a.proposal_title}
                                        sub={`Status: ${a.status}`}
                                        right={<span className="text-[11px] text-gray-400">{formatDate(a.created_at)}</span>}
                                    />
                                ))}
                            </SectionCard>
                            <SectionCard title="Appeals resolved" icon={CheckCircle2} count={s.appeals_resolved}>
                                {(profile?.appeals_resolved ?? []).map((a, i) => (
                                    <SimpleRow key={i} icon={CheckCircle2} iconColor="text-emerald-400"
                                        label={a.proposal_title}
                                        sub={`Decision: ${a.status}`}
                                        right={<span className="text-[11px] text-gray-400">{formatDate(a.resolved_at)}</span>}
                                    />
                                ))}
                            </SectionCard>
                        </div>

                        <SectionCard title="Research outputs recorded" icon={Microscope} count={s.research_outputs}>
                            {(profile?.research_outputs ?? []).map((o, i) => (
                                <SimpleRow key={i} icon={Microscope} iconColor="text-teal-400"
                                    label={o.title}
                                    sub={`${o.output_type?.replace(/_/g, ' ')} · ${o.proposal_title}`}
                                    right={<span className="text-[11px] text-gray-400">{formatDate(o.created_at)}</span>}
                                />
                            ))}
                        </SectionCard>

                        {/* Audit log table */}
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100">
                                <Database size={13} className="text-gray-300" />
                                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex-1">Audit log — recent 15</h3>
                                <span className="text-[11px] font-semibold tabular-nums bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{s.audit_actions ?? 0} total</span>
                            </div>
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="border-b border-gray-50">
                                            {['Timestamp', 'Event', 'Model', 'Record ID', 'IP'].map(h => (
                                                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(profile?.recent_audit_logs ?? []).map((l, i) => (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-2.5 font-mono text-gray-400">{formatDateTime(l.created_at)}</td>
                                                <td className="px-4 py-2.5 font-semibold text-indigo-600">{l.event}</td>
                                                <td className="px-4 py-2.5 text-gray-600">{l.auditable_type?.split('\\').pop()}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-400">{l.auditable_id?.slice(-8)}</td>
                                                <td className="px-4 py-2.5 text-gray-400">{l.ip_address}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile: stacked cards */}
                            <div className="sm:hidden divide-y divide-gray-50">
                                {(profile?.recent_audit_logs ?? []).map((l, i) => (
                                    <div key={i} className="px-4 py-2.5 text-[11px]">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className="font-semibold text-indigo-600">{l.event}</span>
                                            <span className="font-mono text-gray-400 shrink-0">{formatDateTime(l.created_at)}</span>
                                        </div>
                                        <p className="text-gray-500">{l.auditable_type?.split('\\').pop()} · <span className="font-mono">{l.auditable_id?.slice(-8)}</span> · {l.ip_address}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <SectionCard title="Active sessions" icon={Monitor} count={s.active_sessions}>
                            {(profile?.active_sessions ?? []).map((sess, i) => (
                                <SimpleRow key={i} icon={Monitor} iconColor="text-gray-300"
                                    label={sess.name ?? 'API Token'}
                                    sub={`Created ${formatDate(sess.created_at)}`}
                                    right={<span className="text-[11px] text-gray-400">{sess.last_used_at ? `Used ${formatDate(sess.last_used_at)}` : 'Never used'}</span>}
                                />
                            ))}
                        </SectionCard>

                        {profile?.feedback && (
                            <div className="bg-white rounded-xl border border-gray-100 p-5">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <MessageSquare size={13} className="text-gray-300" />
                                    <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">User feedback</h3>
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full capitalize">{profile.feedback.type?.replace(/_/g, ' ')}</span>
                                    {profile.feedback.rating && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full">Rating {profile.feedback.rating}/5</span>}
                                </div>
                                <p className="text-sm text-gray-600">{profile.feedback.message}</p>
                                <p className="text-[11px] text-gray-400 mt-2">{formatDate(profile.feedback.created_at)}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="h-8" />
            </div>

            {/* ── DIALOGS ──────────────────────────────────────────────── */}
            {impersonateTarget && (
                <ConfirmDialog open
                    title="Impersonate user?"
                    description={`You will be signed in as "${impersonateTarget.name}". Use the banner to return to your account.`}
                    confirmLabel="Impersonate"
                    onConfirm={doImpersonate}
                    onCancel={() => setImpersonateTarget(null)}
                />
            )}
            {statusTarget && (
                <ConfirmDialog open
                    title={statusTarget === 'active' ? 'Reactivate account?' : 'Suspend account?'}
                    description={statusTarget === 'active'
                        ? `${name}'s access to the system will be restored.`
                        : `${name} will be immediately blocked from all system activities.`}
                    confirmLabel={statusTarget === 'active' ? 'Reactivate' : 'Suspend'}
                    onConfirm={doStatusChange}
                    onCancel={() => setStatusTarget(null)}
                />
            )}
        </AppLayout>
    );
}
