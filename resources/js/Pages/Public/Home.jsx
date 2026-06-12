import { useEffect, useState, useRef } from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
    ArrowRight, Search, ChevronRight, Globe,
    FileText, CheckSquare, Award, BookOpen, BarChart2, Shield,
    Calendar, Clock,
} from 'lucide-react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(target, enabled, duration = 1800) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!enabled) return;
        const num = parseInt(String(target ?? 0).replace(/\D/g, ''), 10);
        if (!num) return;
        let frame;
        const start = performance.now();
        const tick = (now) => {
            const t     = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(eased * num));
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, enabled, duration]);
    return value;
}

function useInView(threshold = 0.3) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
            { threshold },
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, inView };
}

// ─── Stat counter (hook must live at component level) ─────────────────────────

function StatCounter({ label, value, enabled, color }) {
    const num      = parseInt(String(value ?? 0).replace(/\D/g, ''), 10);
    const animated = useCountUp(num, enabled && num > 0);
    const display  = num > 0 ? animated.toLocaleString() : '—';
    return (
        <div className="flex flex-col items-start gap-0.5">
            <span className="text-2xl font-extrabold tabular-nums text-white">{display}</span>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-400 font-medium">{label}</span>
            </div>
        </div>
    );
}

// ─── Donut chart with center label ────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'];
const CHART_LABELS = ['Proposals (Year)', 'Funded Projects', 'Colleges', 'Publications'];

function StatsDonut({ stats, primaryColor, academicYear }) {
    const { ref, inView } = useInView();

    const raw = [
        stats.total_proposals,
        stats.funded,
        stats.colleges,
        stats.publications,
    ].map(v => parseInt(String(v ?? 0).replace(/\D/g, ''), 10));

    const hasData = raw.some(v => v > 0);
    const total   = raw.reduce((a, b) => a + b, 0);

    // Use primaryColor for first slice
    const colors = [primaryColor, CHART_COLORS[1], CHART_COLORS[2], CHART_COLORS[3]];

    const labels = [
        academicYear ? `${academicYear} Proposals` : 'Proposals (Year)',
        academicYear ? `${academicYear} Funded` : 'Funded Projects',
        'Colleges',
        'Publications',
    ];

    const data = labels.map((name, i) => ({
        name,
        value: raw[i] || 0,
        color: colors[i],
    }));

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const { name, value, color } = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-slate-300 font-medium">{name}</span>
                </div>
                <span className="text-white font-bold text-sm">{value.toLocaleString()}</span>
            </div>
        );
    };

    return (
        <div ref={ref} className="relative bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
            {/* Title */}
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">
                {academicYear ? `${academicYear} Overview` : 'Platform Overview'}
            </p>

            {/* Chart */}
            <div className="relative flex items-center justify-center" style={{ height: 220 }}>
                {hasData ? (
                    <>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={68}
                                    outerRadius={100}
                                    paddingAngle={3}
                                    dataKey="value"
                                    animationBegin={inView ? 0 : 99999}
                                    animationDuration={1000}
                                >
                                    {data.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} stroke="transparent" />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-extrabold text-white tabular-nums">
                                {total.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-wide">Total</span>
                        </div>
                    </>
                ) : (
                    /* Skeleton while loading */
                    <div className="w-52 h-52 rounded-full border-18 border-white/5 animate-pulse" />
                )}
            </div>

            {/* Legend grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4">
                {data.map((d) => (
                    <div key={d.name} className="flex items-start gap-2.5">
                        <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: d.color }} />
                        <div>
                            <div className="text-[11px] text-slate-400 leading-tight">{d.name}</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                                {d.value > 0 ? d.value.toLocaleString() : '—'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Category config ──────────────────────────────────────────────────────────

const CAT = {
    research:             { label: 'Research',      gradient: 'from-blue-500 to-indigo-600',   icon: '🔬', color: '#3b82f6' },
    community_engagement: { label: 'Community',     gradient: 'from-emerald-500 to-green-700', icon: '🤝', color: '#10b981' },
    technology_transfer:  { label: 'Tech Transfer', gradient: 'from-purple-500 to-violet-700', icon: '🚀', color: '#8b5cf6' },
    innovation:           { label: 'Innovation',    gradient: 'from-orange-500 to-amber-600',  icon: '💡', color: '#f59e0b' },
    other:                { label: 'Other',         gradient: 'from-slate-500 to-slate-700',   icon: '📋', color: '#64748b' },
};

// ─── Proposal call card ───────────────────────────────────────────────────────

function CallCard({ call }) {
    const cfg = CAT[call.category] ?? CAT.other;

    const handleApply = () => {
        const token = localStorage.getItem('rtt_token');
        if (!token) {
            localStorage.setItem('redirect_after_login', `/proposals/create?call_id=${call.id}`);
            window.location.href = '/login';
        } else {
            window.location.href = `/proposals/create?call_id=${call.id}`;
        }
    };

    const deadline = (() => {
        if (!call.end_date) return null;
        const diff = new Date(call.end_date) - Date.now();
        if (diff <= 0) return { days: 0, text: 'Closed', closed: true, urgent: false };
        const days = Math.floor(diff / 86400000);
        if (days === 0) return { days: 0, text: 'Today',  closed: false, urgent: true };
        if (days <= 7)  return { days,   text: `${days}d`,closed: false, urgent: true };
        return              { days,   text: `${days}d`,  closed: false, urgent: false };
    })();

    return (
        <article className="group bg-white flex flex-col h-full
                            hover:shadow-2xl hover:shadow-black/8
                            transition-all duration-300 hover:-translate-y-1">

            {/* Thick gradient accent strip */}
            <div className={`h-2 w-full shrink-0 bg-linear-to-r ${cfg.gradient}`} />

            {/* Card body */}
            <div className="p-5 flex flex-col flex-1 gap-4">

                {/* Row 1: icon + category pill + year */}
                <div className="flex items-start justify-between gap-3">
                    {/* Icon circle */}
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center
                                     text-2xl bg-linear-to-br ${cfg.gradient} shrink-0 shadow-sm`}>
                        <span className="drop-shadow-sm">{cfg.icon}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                                         rounded-full border"
                            style={{ color: cfg.color, borderColor: `${cfg.color}30`,
                                     backgroundColor: `${cfg.color}10` }}>
                            {cfg.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{call.academic_year}</span>
                    </div>
                </div>

                {/* Row 2: title */}
                <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-3
                               group-hover:text-slate-700 transition-colors">
                    {call.title}
                </h3>

                {/* Row 3: description */}
                {call.description && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 -mt-1">
                        {call.description}
                    </p>
                )}

                <div className="flex-1" />

                {/* Row 4: deadline display */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Calendar size={11} />
                        <span>
                            {call.end_date
                                ? new Date(call.end_date).toLocaleDateString('en-GB',
                                    { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Open-ended'}
                        </span>
                    </div>

                    {deadline && (
                        <div className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            deadline.closed
                                ? 'bg-slate-100 text-slate-400'
                                : deadline.urgent
                                ? 'bg-red-50 text-red-500 ring-1 ring-red-200'
                                : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                        }`}>
                            <Clock size={9} className={deadline.urgent && !deadline.closed ? 'animate-pulse' : ''} />
                            {deadline.closed ? 'Closed' : deadline.text}
                        </div>
                    )}
                </div>

                {/* Row 5: apply button */}
                <button
                    onClick={handleApply}
                    disabled={deadline?.closed}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                text-xs font-bold tracking-wide text-white transition-all duration-200
                                ${deadline?.closed
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : `bg-linear-to-r ${cfg.gradient} shadow-sm
                                       hover:shadow-md hover:opacity-95 active:scale-[0.98]`}`}>
                    {deadline?.closed
                        ? 'Call Closed'
                        : <><span>Apply Now</span> <ArrowRight size={13} /></>}
                </button>
            </div>
        </article>
    );
}

// ─── Platform features ────────────────────────────────────────────────────────

const FEATURES = [
    { icon: FileText,    title: 'Proposal Management',  desc: 'Guided 7-step wizard from draft to submission.' },
    { icon: CheckSquare, title: 'Blind Peer Review',    desc: 'Anonymous multi-stage scoring pipeline.'        },
    { icon: Award,       title: 'Grant Funding',        desc: 'Award letters, budgets, and disbursements.'     },
    { icon: BarChart2,   title: 'Analytics & Reports',  desc: 'Performance and budget utilization dashboards.' },
    { icon: BookOpen,    title: 'Research Repository',  desc: 'Discover published outputs and publications.'   },
    { icon: Shield,      title: 'Compliance & Audit',   desc: 'Full audit trails and similarity detection.'    },
];

const DEFAULT_STEPS = [
    { title: 'Submit Proposal',       desc: 'Complete the 7-step wizard with research details, team, and budget.' },
    { title: 'Validation',            desc: 'Central Office reviews and routes to the review pipeline.'           },
    { title: 'Peer Review & Defence', desc: 'Expert reviewers score proposals. Top ones advance to defence.'      },
    { title: 'Funding & Support',     desc: 'Accepted proposals receive funding and M&E support.'                },
];

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ eyebrow, title, action, actionHref, light = false }) {
    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                {eyebrow && (
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5
                                   ${light ? 'text-white/40' : 'text-slate-400'}`}>
                        {eyebrow}
                    </p>
                )}
                <h2 className={`text-2xl font-extrabold ${light ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
            </div>
            {action && (
                <Link href={actionHref}
                    className={`flex items-center gap-1 text-xs font-semibold transition-colors
                                ${light ? 'text-white/50 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                    {action} <ChevronRight size={13} />
                </Link>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
    const [calls, setCalls]               = useState([]);
    const [stats, setStats]               = useState({});
    const [thematicAreas, setThematicAreas] = useState([]);

    const s            = usePage().props.app_settings ?? {};
    const primaryColor = s.primary_color     || '#6366f1';
    const orgName      = s.organization_name || 'University';
    const heroBg       = s.public_hero_bg     || '#0f172a';
    const cardsBg      = s.public_cards_bg    || '#f9fafb';
    const featuresBg   = s.public_features_bg || '#0f172a';

    const badge        = s.public_hero_badge        || `${orgName} · Research Management`;
    const heading      = s.public_hero_heading      || 'Accelerate Your Research';
    const highlight    = s.public_hero_highlight    || 'From Idea to Impact';
    const subtitle     = s.public_hero_subtitle     || 'Submit proposals, track progress, and manage grants — all in one platform built for academic excellence.';
    const ctaPrimary   = s.public_hero_cta_primary  || 'Explore Open Calls';
    const ctaSecondary = s.public_hero_cta_secondary || 'Track Your Proposal';

    const showCalls    = s.public_show_open_calls   !== 'false';
    const showHIW      = s.public_show_how_it_works !== 'false';
    const showFeatures = s.public_show_features     !== 'false';
    const showCTA      = s.public_show_cta          !== 'false';

    const featTitle = s.public_features_title    || 'Everything You Need to Manage Research';
    const featSub   = s.public_features_subtitle || 'A complete platform for the full research lifecycle.';
    const ctaTitle  = s.public_cta_title         || 'Ready to Start Your Research Journey?';
    const ctaSub    = s.public_cta_subtitle      || `Join researchers from ${orgName} and transform your ideas into impactful funded work.`;
    const ctaBtn1   = s.public_cta_primary       || 'View Open Calls';
    const ctaBtn2   = s.public_cta_secondary     || 'Track Proposal';

    const steps = DEFAULT_STEPS.map((d, i) => ({
        title: s[`public_step_${i + 1}_title`] || d.title,
        desc:  s[`public_step_${i + 1}_desc`]  || d.desc,
    }));

    const { ref: heroRef, inView: heroVisible } = useInView();

    useEffect(() => {
        const now = new Date();
        get('/proposal-calls')
            .then(r => {
                const raw   = r?.data ?? r ?? [];
                const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
                setCalls(items.filter(c => !c.end_date || new Date(c.end_date) > now).slice(0, 8));
            })
            .catch(() => {});
        get('/stats')
            .then(r => setStats(r?.data ?? r ?? {}))
            .catch(() => {});
        get('/thematic-areas/public')
            .then(r => setThematicAreas(r?.data ?? []))
            .catch(() => {});
    }, []);

    return (
        <PublicLayout>

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <section style={{
                background: `linear-gradient(135deg, ${heroBg} 0%, ${heroBg}ee 55%, ${primaryColor}18 100%)`,
            }}>
                {/* Top decorative line */}
                <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${primaryColor}60, transparent)` }} />

                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

                        {/* Left ── text */}
                        <div>
                            {/* Eyebrow */}
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-7
                                            border border-white/10 bg-white/5 backdrop-blur-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-semibold text-white/60">{badge}</span>
                            </div>

                            {/* Heading */}
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1]
                                           tracking-tight text-white mb-5">
                                {heading}
                                <br />
                                <span className="bg-clip-text text-transparent"
                                    style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, #a78bfa 60%, #38bdf8)` }}>
                                    {highlight}
                                </span>
                            </h1>

                            {/* Subtitle */}
                            <p className="text-base text-slate-400 leading-relaxed mb-9 max-w-lg">{subtitle}</p>

                            {/* CTAs */}
                            <div className="flex flex-wrap gap-3 mb-10">
                                <a href="/proposal-calls/public"
                                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold
                                               text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl"
                                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
                                    {ctaPrimary} <ArrowRight size={16} />
                                </a>
                                <a href="/tracker"
                                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold
                                               text-white border border-white/15 bg-white/5 backdrop-blur-sm
                                               transition-all duration-200 hover:bg-white/10">
                                    <Search size={15} /> {ctaSecondary}
                                </a>
                            </div>

                            {/* Inline stat counters */}
                            <div ref={heroRef} className="grid grid-cols-2 gap-5">
                                <StatCounter
                                    label={stats.academic_year ? `${stats.academic_year} Proposals` : 'Proposals This Year'}
                                    value={stats.total_proposals}
                                    enabled={heroVisible}
                                    color={primaryColor} />
                                <StatCounter
                                    label={stats.academic_year ? `${stats.academic_year} Funded` : 'Funded Projects'}
                                    value={stats.funded} enabled={heroVisible} color="#10b981" />
                                <StatCounter label="Colleges"        value={stats.colleges}     enabled={heroVisible} color="#f59e0b" />
                                <StatCounter label="Publications"    value={stats.publications} enabled={heroVisible} color="#8b5cf6" />
                            </div>
                        </div>

                        {/* Right ── donut chart */}
                        <div className="flex justify-center lg:justify-end">
                            <div className="w-full max-w-sm">
                                <StatsDonut stats={stats} primaryColor={primaryColor} academicYear={stats.academic_year} />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Bottom fade */}
                <div className="h-12"
                    style={{ background: 'linear-gradient(to bottom, transparent, rgb(249 250 251))' }} />
            </section>

            {/* ── Open Calls ────────────────────────────────────────────────── */}
            {showCalls && (
                <section className="py-14" style={{ backgroundColor: cardsBg }}>
                    <div className="max-w-7xl mx-auto px-6">
                        <SectionHead
                            eyebrow="Active Opportunities"
                            title="Open for Applications"
                            action="View All"
                            actionHref="/proposal-calls/public"
                        />

                        {calls.length === 0 ? (
                            <div className="flex flex-col items-center py-20 bg-white border border-gray-200 rounded-2xl text-slate-400">
                                <Globe size={40} className="mb-3 opacity-20" />
                                <p className="font-semibold">No active calls at this time</p>
                                <p className="text-sm mt-1">Check back soon for new research opportunities.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                {calls.slice(0, 4).map((call, i) => (
                                    <div key={call.id}
                                        className={i < Math.min(calls.length, 4) - 1 ? 'border-r border-gray-200' : ''}>
                                        <CallCard call={call} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {calls.length > 4 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-t-0 border-gray-200 rounded-b-2xl overflow-hidden">
                                {calls.slice(4).map((call, i) => (
                                    <div key={call.id}
                                        className={i < calls.slice(4).length - 1 ? 'border-r border-gray-200' : ''}>
                                        <CallCard call={call} />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 text-center">
                            <Link href="/proposal-calls/public"
                                className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-70"
                                style={{ color: primaryColor }}>
                                Browse all open calls <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* ── How It Works ──────────────────────────────────────────────── */}
            {showHIW && (
                <section className="bg-white py-14 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6">
                        <SectionHead eyebrow="The Process" title="How It Works" />

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {steps.map((step, i) => (
                                <div key={i} className="relative group">
                                    {/* Connector line (desktop) */}
                                    {i < steps.length - 1 && (
                                        <div className="hidden lg:block absolute top-5 left-full w-6 h-px z-10"
                                            style={{ background: `linear-gradient(90deg, ${primaryColor}40, transparent)` }} />
                                    )}
                                    <div className="p-6 rounded-2xl border border-gray-100 hover:border-gray-200
                                                    hover:shadow-md transition-all duration-200 h-full bg-gray-50/50">
                                        {/* Step number */}
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4
                                                        text-white text-sm font-extrabold shadow-sm"
                                            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
                                            {String(i + 1).padStart(2, '0')}
                                        </div>
                                        <h3 className="font-bold text-slate-900 mb-2 text-sm">{step.title}</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── Thematic Areas ────────────────────────────────────────────── */}
            {thematicAreas.length > 0 && (
                <section className="bg-white py-14 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6">
                        <SectionHead eyebrow="Research Focus" title="Thematic Areas" />

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {thematicAreas.map((area) => (
                                <div
                                    key={area.id}
                                    className="group p-5 rounded-2xl border border-gray-100 hover:border-gray-200
                                               hover:shadow-md transition-all duration-200 bg-gray-50/50 flex flex-col gap-3"
                                >
                                    <div
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                                        style={{
                                            backgroundColor: `${area.color}18`,
                                            border: `1.5px solid ${area.color}30`,
                                        }}
                                    >
                                        {area.icon}
                                    </div>
                                    <div>
                                        <div
                                            className="w-8 h-1 rounded-full mb-2"
                                            style={{ backgroundColor: area.color }}
                                        />
                                        <h3 className="font-bold text-slate-900 text-sm leading-snug">
                                            {area.name}
                                        </h3>
                                        {area.description && (
                                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                                                {area.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── Platform Features ─────────────────────────────────────────── */}
            {showFeatures && (
                <section className="py-14"
                    style={{ background: `linear-gradient(135deg, ${featuresBg} 0%, ${featuresBg}dd 100%)` }}>
                    <div className="max-w-7xl mx-auto px-6">
                        <SectionHead eyebrow="Platform Capabilities" title={featTitle} light />
                        <p className="text-slate-400 text-sm mb-10 max-w-lg -mt-4">{featSub}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {FEATURES.map((f) => (
                                <div key={f.title}
                                    className="group p-6 rounded-2xl border border-white/5 bg-white/3
                                               hover:bg-white/6 hover:border-white/10 transition-all duration-200">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                                        style={{ backgroundColor: `${primaryColor}22` }}>
                                        <f.icon size={18} style={{ color: primaryColor }} />
                                    </div>
                                    <h3 className="font-semibold text-white text-sm mb-1.5">{f.title}</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── CTA ───────────────────────────────────────────────────────── */}
            {showCTA && (
                <section className="bg-white py-14 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="rounded-3xl px-10 py-12 flex flex-col md:flex-row items-center
                                        justify-between gap-8 border border-gray-100 shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${primaryColor}04)` }}>
                            <div className="max-w-lg">
                                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                                    style={{ color: primaryColor }}>
                                    Get Started
                                </p>
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 leading-snug">
                                    {ctaTitle}
                                </h2>
                                <p className="text-slate-500 text-sm leading-relaxed">{ctaSub}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                                <a href="/proposal-calls/public"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl
                                               text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 hover:scale-105"
                                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
                                    {ctaBtn1} <ArrowRight size={15} />
                                </a>
                                <a href="/tracker"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl
                                               text-sm font-semibold border-2 text-slate-700 hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: `${primaryColor}50` }}>
                                    {ctaBtn2}
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            )}

        </PublicLayout>
    );
}
