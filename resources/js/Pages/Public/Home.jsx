import { useEffect, useState, useRef } from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
    ArrowRight, Search, ChevronRight, ChevronLeft, ChevronDown, Globe,
    FileText, Award,
    Calendar, Clock, HelpCircle, TrendingUp, Users, Layers,
    Microscope, Zap, Handshake, Rocket, Lightbulb, ClipboardList, Sprout, HeartPulse,
    Globe2, GraduationCap, Telescope, Laptop, BarChart3, Scale, Wallet, Landmark,
} from 'lucide-react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';
import { resolveFeatures } from '../../lib/publicFeatures';
import { useT } from '../../lib/i18n';
import { SLIDE_DEFAULTS, STEP_DEFAULTS } from '../../lib/publicSite';

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
    const t = useT();
    const num      = parseInt(String(value ?? 0).replace(/\D/g, ''), 10);
    const animated = useCountUp(num, enabled && num > 0);
    const display  = num > 0 ? animated.toLocaleString() : '—';
    return (
        <div className="flex flex-col items-start gap-0.5">
            <span className="text-2xl font-extrabold tabular-nums text-white">{display}</span>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-400 font-medium">{t(label)}</span>
            </div>
        </div>
    );
}

// ─── Donut chart with center label ────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'];
const CHART_LABELS = ['Proposals (Year)', 'Funded Projects', 'Colleges', 'Departments'];

function StatsDonut({ stats, primaryColor, academicYear }) {
    const { ref, inView } = useInView();

    const raw = [
        stats.total_proposals,
        stats.funded,
        stats.colleges,
        stats.departments,
    ].map(v => parseInt(String(v ?? 0).replace(/\D/g, ''), 10));

    const hasData = raw.some(v => v > 0);
    const total   = raw.reduce((a, b) => a + b, 0);

    // Use primaryColor for first slice
    const colors = [primaryColor, CHART_COLORS[1], CHART_COLORS[2], CHART_COLORS[3]];

    const labels = [
        academicYear ? `${academicYear} Proposals` : 'Proposals (Year)',
        academicYear ? `${academicYear} Funded` : 'Funded Projects',
        'Colleges',
        'Departments',
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
            <p className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-5">
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
                            <span className="text-[10px] text-slate-300 mt-0.5 font-medium uppercase tracking-wide">Total</span>
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
                            <div className="text-[11px] text-slate-300 leading-tight font-medium">{d.name}</div>
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
    research:             { label: 'Research',      gradient: 'from-blue-500 to-indigo-600',   icon: Microscope,    color: '#3b82f6' },
    community_engagement: { label: 'Community',     gradient: 'from-emerald-500 to-green-700', icon: Handshake,     color: '#10b981' },
    technology_transfer:  { label: 'Tech Transfer', gradient: 'from-purple-500 to-violet-700', icon: Rocket,        color: '#8b5cf6' },
    innovation:           { label: 'Innovation',    gradient: 'from-orange-500 to-amber-600',  icon: Lightbulb,     color: '#f59e0b' },
    other:                { label: 'Other',         gradient: 'from-slate-500 to-slate-700',   icon: ClipboardList, color: '#64748b' },
};

// ─── Thematic areas ───────────────────────────────────────────────────────────

// Admins pick emoji for thematic areas and hero slides; show the matching line icon so the page stays consistent.
const AREA_ICONS = {
    '🔬': Microscope, '🌱': Sprout, '💡': Lightbulb, '🚀': Rocket, '🤝': Handshake, '📊': BarChart3,
    '🏥': HeartPulse, '⚡': Zap, '🌍': Globe2, '🎓': GraduationCap, '🔭': Telescope, '💻': Laptop,
    '💰': Wallet, '⚖️': Scale, '🏛️': Landmark, '🌐': Globe,
};

function AreaIcon({ emoji, size = 20 }) {
    const Icon = AREA_ICONS[emoji?.trim()];
    if (Icon) return <Icon size={size} strokeWidth={1.75} />;
    // An emoji outside the preset list: keep the admin's choice rather than guess.
    return emoji?.trim() ? <span>{emoji}</span> : <Layers size={size} strokeWidth={1.75} />;
}

/** Sub-topics as tags: from `sub_topics`, or the numbered lines of the description. */
function areaTopics(area) {
    if (Array.isArray(area.sub_topics) && area.sub_topics.length) return area.sub_topics;
    return (area.description ?? '')
        .split(/\n|(?=\b\d{1,2}\.\s)/)
        .map((line) => line.replace(/^\s*\d{1,2}\.\s*/, '').trim())
        .filter(Boolean);
}

function SubTopics({ area }) {
    const t = useT();
    const topics = areaTopics(area);
    const shown = topics.slice(0, 3);
    if (!topics.length) return null;

    return (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
            {shown.map((t) => (
                <span key={t} className="max-w-full truncate rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-slate-600" title={t}>
                    {t.length > 42 ? `${t.slice(0, 40)}…` : t}
                </span>
            ))}
            {topics.length > shown.length && (
                <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400" title={topics.slice(3).join(' · ')}>
                    {t(':count more', { count: topics.length - shown.length })}
                </span>
            )}
        </div>
    );
}

// ─── Proposal call card ───────────────────────────────────────────────────────

function CallCard({ call }) {
    const t = useT();
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
                                     bg-linear-to-br ${cfg.gradient} shrink-0 shadow-sm`}>
                        <cfg.icon size={20} className="text-white" strokeWidth={2} />
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5
                                         rounded-full border"
                            style={{ color: cfg.color, borderColor: `${cfg.color}30`,
                                     backgroundColor: `${cfg.color}10` }}>
                            {t(cfg.label)}
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
                        : <><span>{t('Apply Now')}</span> <ArrowRight size={13} /></>}
                </button>
            </div>
        </article>
    );
}

// ─── Platform features ────────────────────────────────────────────────────────


const DEFAULT_STEPS = STEP_DEFAULTS;

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ eyebrow, title, action, actionHref, light = false }) {
    const t = useT();
    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                {eyebrow && (
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5
                                   ${light ? 'text-white/40' : 'text-slate-400'}`}>
                        {t(eyebrow)}
                    </p>
                )}
                <h2 className={`text-2xl font-extrabold ${light ? 'text-white' : 'text-slate-900'}`}>{t(title)}</h2>
            </div>
            {action && (
                <Link href={actionHref}
                    className={`flex items-center gap-1 text-xs font-semibold transition-colors
                                ${light ? 'text-white/50 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                    {t(action)} <ChevronRight size={13} />
                </Link>
            )}
        </div>
    );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const DEFAULT_FAQS = [
    {
        q: 'Who can submit a research proposal?',
        a: 'Any registered staff member or researcher affiliated with the university can submit a proposal during an active call period. Guest users have read-only access and cannot submit.',
    },
    {
        q: 'How do I know which proposal call to apply to?',
        a: 'Browse the "Open Calls" section on this page or visit the Proposal Calls page. Each call lists its eligible category, focus areas, deadline, and a downloadable guidelines document. Read the guidelines carefully before applying.',
    },
    {
        q: 'Can I edit my proposal after submitting it?',
        a: 'No — once submitted, a proposal is locked for editing unless a validation officer returns it to you for revision. You will receive a notification with comments if a revision is requested.',
    },
    {
        q: 'What is a Tracker Number and how do I use it?',
        a: 'A Tracker Number (for example RES-2026-2027-000123) is assigned to your proposal when you submit it. Enter it on the Track Proposal page to see the current stage at any time — no login required. When you are signed in, the proposal page also shows a step-by-step status guide and anything you need to do next.',
    },
    {
        q: 'How long does the review process take?',
        a: 'Each stage has a target time: validation about 1 week, assigning reviewers about 1 week, blind review about 3 weeks, scheduling the open defence about 2 weeks, scoring the defence about 1 week, and central evaluation about 2 weeks — roughly ten weeks from submission to a funding decision. The office tracks every stage against these targets, and you can follow your proposal with its Tracker Number.',
    },
    {
        q: 'What happens after my proposal is accepted?',
        a: 'After the open defence, the central evaluation committee makes the final funding decision. If your proposal is funded, you receive an award with a grant reference, sign a research contract, and request your budget in stages. You then submit a progress report every few months, take part in a mid-term evaluation, and present your results at a completion workshop.',
    },
    {
        q: 'Can I add co-investigators to my proposal?',
        a: 'Yes. In Step 3 of the proposal wizard you can search for and invite co-investigators. They must be registered system users. Each invited member will receive a notification and must accept before the proposal is submitted.',
    },
    {
        q: 'What file formats are accepted for document uploads?',
        a: 'The system accepts PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files. PDFs are recommended for proposal documents. Each file must be within the size limit set by your administrator (typically 10 MB).',
    },
    {
        q: 'How is my identity kept from the blind reviewers?',
        a: 'Blind reviewers never see who wrote a proposal. When you submit, the system also scans the documents sent to reviewers for the names, emails and phone numbers of your team, so anything that could identify you is caught and removed before review.',
    },
    {
        q: 'What is the open defence?',
        a: 'Proposals that pass blind review are presented by the research team to a panel at a scheduled open defence. Panel members score the presentation during the session or by the end of the following day. The blind review and defence scores are then combined for central evaluation.',
    },
    {
        q: 'Do reviewers receive a certificate, and how can it be verified?',
        a: 'Yes. Reviewers who complete the minimum number of reviews in an academic year receive a certificate of review service once the central office releases that year\'s certificates. Each certificate has a unique number and QR code — anyone can confirm it is genuine on the Verify Certificate page.',
    },
];

function FaqItem({ item, open, onToggle, primaryColor }) {
    return (
        <div className="border border-gray-200 rounded-2xl overflow-hidden transition-shadow duration-200 hover:shadow-sm">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left bg-white hover:bg-gray-50 transition-colors duration-150"
            >
                <span className="font-semibold text-slate-800 text-sm leading-snug pr-2">{item.question ?? item.q}</span>
                <ChevronDown
                    size={18}
                    className="shrink-0 transition-transform duration-300"
                    style={{
                        color: primaryColor,
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                />
            </button>
            <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: open ? '300px' : '0px' }}
            >
                <p className="px-6 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-gray-100">
                    {item.answer ?? item.a}
                </p>
            </div>
        </div>
    );
}

// ─── Validated-by-category breakdown ───────────────────────────────────────────

// Colors/icons mirror ProposalCallCard's CATEGORY_CONFIG so category identity stays
// consistent across the public site.
const VALIDATED_CATEGORY_META = {
    research:             { color: '#3b82f6', icon: Microscope },
    community_engagement: { color: '#10b981', icon: Users },
    technology_transfer:  { color: '#a855f7', icon: Zap },
};

function ValidatedByCategory({ items }) {
    const t = useT();
    const max = Math.max(1, ...items.map(i => i.count));

    return (
        <div className="space-y-3.5">
            {items.map((item) => {
                const meta = VALIDATED_CATEGORY_META[item.category] ?? { color: '#64748b', icon: Layers };
                const Icon = meta.icon;
                const pct  = Math.round((item.count / max) * 100);

                return (
                    <div key={item.category}>
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: `${meta.color}22`, color: meta.color }}>
                                    <Icon size={12} />
                                </span>
                                <span className="text-xs font-medium text-slate-300 truncate">{t(item.label)}</span>
                            </div>
                            <span className="text-sm font-bold text-white tabular-nums shrink-0 ml-2">
                                {item.count.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Hero Stat Card ───────────────────────────────────────────────────────────

function HeroStatCard({ stat, label, color, icon, inView, secondaryStats, ringPct, categoryBreakdown }) {
    const t = useT();
    const num      = parseInt(String(stat ?? 0).replace(/\D/g, ''), 10);
    const animated = useCountUp(num, inView && num > 0, 1400);
    const radius   = 44;
    const circ     = 2 * Math.PI * radius;
    const showRing  = ringPct !== null && ringPct !== undefined;
    const targetPct = showRing ? Math.min(Math.max(ringPct, 0), 100) : 0;
    const [pct, setPct] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setPct(targetPct), 120);
        return () => clearTimeout(t);
    }, [targetPct]);
    const offset = circ * (1 - pct / 100);

    return (
        <div className="relative rounded-3xl overflow-hidden border border-white/10 p-7 backdrop-blur-xl"
            style={{ background: 'rgba(255,255,255,0.045)' }}>
            {/* Corner glow */}
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-35 pointer-events-none transition-all duration-700"
                style={{ background: color }} />

            {/* Icon badge */}
            <div className={`${showRing ? 'inline-flex' : 'flex mx-auto'} items-center justify-center w-12 h-12 rounded-2xl mb-5 text-xl`}
                style={{ background: `${color}22`, border: `1.5px solid ${color}35`, color }}>
                <AreaIcon emoji={icon} size={22} />
            </div>

            {/* Stat + ring row */}
            <div className={`flex items-center gap-4 mb-1 ${showRing ? 'justify-between' : 'justify-center'}`}>
                <div className={showRing ? '' : 'text-center'}>
                    <div className="text-5xl font-extrabold text-white tabular-nums tracking-tight leading-none">
                        {num > 0 ? animated.toLocaleString() : '—'}
                    </div>
                    <div className="text-sm font-semibold mt-2 transition-colors duration-700" style={{ color }}>
                        {t(label)}
                    </div>
                </div>
                {showRing && (
                    <svg width="80" height="80" viewBox="0 0 110 110" className="shrink-0">
                        <circle cx="55" cy="55" r={radius} fill="none"
                            stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
                        <circle cx="55" cy="55" r={radius} fill="none"
                            stroke={color} strokeWidth="9" strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={offset}
                            style={{
                                transition: 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)',
                                transform: 'rotate(-90deg)',
                                transformOrigin: '55px 55px',
                            }}
                        />
                        <text x="55" y="60" textAnchor="middle" fill="rgba(255,255,255,0.5)"
                            fontSize="11" fontWeight="600" fontFamily="monospace">
                            {pct + '%'}
                        </text>
                    </svg>
                )}
            </div>

            {/* Divider */}
            <div className="my-5 h-px" style={{ background: `linear-gradient(90deg, ${color}50, transparent 80%)` }} />

            {categoryBreakdown ? (
                <>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        {t('Validated by Category')}
                    </div>
                    <ValidatedByCategory items={categoryBreakdown} />
                </>
            ) : (
                /* Secondary stats */
                <div className="grid grid-cols-2 gap-3">
                    {secondaryStats.map((s, i) => (
                        <div key={i} className="rounded-xl px-3.5 py-3 border border-white/5"
                            style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="text-xl font-bold text-white tabular-nums">
                                {parseInt(String(s.value ?? 0)) > 0 ? parseInt(String(s.value ?? 0)).toLocaleString() : '—'}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">{t(s.label)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Hero Slider ──────────────────────────────────────────────────────────────

const SLIDE_STAT_KEYS   = ['total_proposals', 'funded', 'colleges', 'departments', 'total_proposals', 'funded'];
const SLIDE_STAT_LABELS = ['Proposals This Year', 'Funded Projects', 'Participating Colleges', 'Departments Engaged', 'Proposals Submitted', 'Funded Projects'];
const SLIDE_DEFAULT_COLORS = SLIDE_DEFAULTS.map((d) => d.color);
const SLIDE_DEFAULT_ICONS = SLIDE_DEFAULTS.map((d) => d.icon);
const SLIDE_DEFAULT_EYEBROWS = SLIDE_DEFAULTS.map((d) => d.eyebrow);
const SLIDE_DEFAULT_HEADINGS = SLIDE_DEFAULTS.map((d) => d.heading);
const SLIDE_DEFAULT_HIGHLIGHTS = SLIDE_DEFAULTS.map((d) => d.highlight);
const SLIDE_DEFAULT_SUBTITLES  = SLIDE_DEFAULTS.map((d) => d.subtitle);

function HeroSlider({ stats, primaryColor, heroBg, orgName, ctaPrimary, ctaSecondary, s }) {
    const t = useT();
    const slideCount = Math.min(6, Math.max(1, parseInt(s['slider_slide_count'] || 4)));
    const SLIDES = Array.from({ length: slideCount }, (_, i) => i + 1).map((n, i) => {
        const k = f => s[`slider_slide_${n}_${f}`];
        const color = k('color') || SLIDE_DEFAULT_COLORS[i] || primaryColor;
        return {
            eyebrow:   k('eyebrow')   || (i === 0 ? `${orgName} · Research Platform` : SLIDE_DEFAULT_EYEBROWS[i]),
            heading:   k('heading')   || SLIDE_DEFAULT_HEADINGS[i],
            highlight: k('highlight') || SLIDE_DEFAULT_HIGHLIGHTS[i],
            subtitle:  k('subtitle')  || SLIDE_DEFAULT_SUBTITLES[i],
            cta1: { text: k('cta1_text') || (i === 0 ? ctaPrimary || 'Explore Open Calls' : 'View Open Calls'),
                    href: k('cta1_href') || '/proposal-calls/public' },
            cta2: { text: k('cta2_text') || (i === 0 ? ctaSecondary || 'Track Proposal' : 'Track Proposal'),
                    href: k('cta2_href') || '/tracker' },
            color,
            icon:     k('icon')     || SLIDE_DEFAULT_ICONS[i],
            image:    k('image')    || '',
            statKey:  SLIDE_STAT_KEYS[i],
            statLabel: stats.academic_year && i === 0
                ? t(':year Proposals', { year: stats.academic_year })
                : SLIDE_STAT_LABELS[i],
        };
    });

    const [current, setCurrent]   = useState(0);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused]     = useState(false);
    const { ref: statsRef, inView: statsInView } = useInView(0.2);

    const slide = SLIDES[current];

    const goTo = (idx) => {
        setCurrent(idx);
        setProgress(0);
    };

    // Auto-advance + progress bar
    useEffect(() => {
        if (paused) return;
        setProgress(0);
        const start = performance.now();
        let raf;
        const DURATION = 5800;
        const tick = (now) => {
            const p = Math.min((now - start) / DURATION, 1);
            setProgress(p * 100);
            if (p < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                setCurrent(prev => (prev + 1) % SLIDES.length);
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [current, paused]); // eslint-disable-line react-hooks/exhaustive-deps

    const allStatsMeta = [
        { key: 'total_proposals', value: stats.total_proposals, label: 'Proposals'       },
        { key: 'funded',          value: stats.funded,          label: 'Funded Projects'  },
        { key: 'colleges',        value: stats.colleges,        label: 'Colleges'         },
        { key: 'departments',     value: stats.departments,     label: 'Departments'      },
    ];
    const secondaryStats = allStatsMeta.filter(s => s.key !== slide.statKey).slice(0, 2);
    // The Total Proposals card breaks validated proposals down per category instead of a
    // single count, since validation no longer shrinks the headline number itself.
    const validatedByCategory = stats.validated_by_category ?? [];

    return (
        <section
            className="relative overflow-hidden"
            style={{ background: heroBg }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <style>{`
                @keyframes heroSlideUp {
                    from { opacity: 0; transform: translateY(26px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                @keyframes orbDriftA {
                    0%,100% { transform: translate(0,0) scale(1);          }
                    40%     { transform: translate(40px,-50px) scale(1.1);  }
                    70%     { transform: translate(-20px,25px) scale(0.95); }
                }
                @keyframes orbDriftB {
                    0%,100% { transform: translate(0,0) scale(1) rotate(0deg);   }
                    50%     { transform: translate(-50px,35px) scale(1.12) rotate(12deg); }
                }
                @keyframes orbDriftC {
                    0%,100% { transform: translate(0,0) scale(1);          }
                    60%     { transform: translate(30px,40px) scale(0.9);   }
                }
                .hero-animate { animation: heroSlideUp 0.6s cubic-bezier(.16,1,.3,1) both; }
                .orb-a { animation: orbDriftA 10s ease-in-out infinite; }
                .orb-b { animation: orbDriftB 14s ease-in-out infinite; }
                .orb-c { animation: orbDriftC  8s ease-in-out infinite; }
            `}</style>

            {/* ── Background: image (with overlay) or animated gradient ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden transition-all duration-700">
                {slide.image ? (
                    <>
                        {/* Full-bleed photo */}
                        <img
                            key={slide.image}
                            src={slide.image}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                        />
                        {/* Dark gradient overlay for text readability */}
                        <div className="absolute inset-0"
                            style={{ background: 'linear-gradient(120deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.25) 100%)' }} />
                        {/* Subtle color tint to keep slide accent visible */}
                        <div className="absolute inset-0 opacity-20 transition-all duration-700"
                            style={{ background: `radial-gradient(ellipse at 20% 50%, ${slide.color}88, transparent 60%)` }} />
                    </>
                ) : (
                    <>
                        <div className="orb-a absolute -top-40 -left-40 w-175 h-175 rounded-full blur-3xl opacity-20 transition-all duration-1000"
                            style={{ background: `radial-gradient(circle, ${slide.color}cc, transparent 65%)` }} />
                        <div className="orb-b absolute -bottom-48 -right-48 w-150 h-150 rounded-full blur-3xl opacity-18 transition-all duration-1000"
                            style={{ background: `radial-gradient(circle, ${slide.color}99, transparent 65%)` }} />
                        <div className="orb-c absolute top-1/4 right-1/4 w-72 h-72 rounded-full blur-2xl opacity-12 transition-all duration-1000"
                            style={{ background: `radial-gradient(circle, ${slide.color}77, transparent 65%)` }} />
                    </>
                )}
                {/* Dot matrix (both modes) */}
                <div className="absolute inset-0 opacity-[0.035]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
                        backgroundSize: '30px 30px',
                    }} />
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px transition-all duration-700"
                    style={{ background: `linear-gradient(90deg, transparent, ${slide.color}70, transparent)` }} />
            </div>

            {/* ── Slide content ── */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-8 lg:pt-28 lg:pb-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                    {/* Left — text */}
                    <div key={`left-${current}`}>
                        {/* Eyebrow */}
                        <div className="hero-animate inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full mb-7
                                        border border-white/10 bg-white/5 backdrop-blur-sm"
                            style={{ animationDelay: '0ms' }}>
                            <span className="w-2 h-2 rounded-full animate-pulse transition-colors duration-700"
                                style={{ background: slide.color }} />
                            <span className="text-xs font-semibold text-white/55">{t(slide.eyebrow)}</span>
                        </div>

                        {/* Heading */}
                        <h1 className="hero-animate text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.1]
                                       tracking-tight text-white mb-5"
                            style={{ animationDelay: '70ms' }}>
                            {t(slide.heading)}
                            <br />
                            <span className="bg-clip-text text-transparent transition-all duration-700"
                                style={{ backgroundImage: `linear-gradient(130deg, ${slide.color}, ${slide.color}88 60%, #e2e8f0)` }}>
                                {t(slide.highlight)}
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="hero-animate text-base text-slate-400 leading-relaxed mb-9 max-w-lg"
                            style={{ animationDelay: '150ms' }}>
                            {t(slide.subtitle)}
                        </p>

                        {/* CTAs */}
                        <div className="hero-animate flex flex-wrap gap-3 mb-12"
                            style={{ animationDelay: '230ms' }}>
                            <a href={slide.cta1.href}
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold
                                           text-white shadow-xl transition-all duration-200 hover:scale-105"
                                style={{ background: `linear-gradient(135deg, ${slide.color}, ${slide.color}bb)`,
                                         boxShadow: `0 8px 30px ${slide.color}40` }}>
                                {t(slide.cta1.text)} <ArrowRight size={15} />
                            </a>
                            <a href={slide.cta2.href}
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold
                                           text-white/65 border border-white/15 bg-white/5 backdrop-blur-sm
                                           transition-all duration-200 hover:bg-white/10 hover:text-white">
                                {t(slide.cta2.text)}
                            </a>
                        </div>

                        {/* Navigation */}
                        <div className="hero-animate flex items-center gap-5" style={{ animationDelay: '310ms' }}>
                            {/* Dots */}
                            <div className="flex items-center gap-2">
                                {SLIDES.map((_, i) => (
                                    <button key={i} onClick={() => goTo(i)}
                                        className="rounded-full transition-all duration-400 hover:opacity-80"
                                        style={{
                                            width:      i === current ? '30px' : '8px',
                                            height:     '8px',
                                            background: i === current ? slide.color : 'rgba(255,255,255,0.22)',
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Arrows */}
                            <div className="flex items-center gap-2">
                                <button onClick={() => goTo((current - 1 + SLIDES.length) % SLIDES.length)}
                                    className="w-9 h-9 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm
                                               flex items-center justify-center text-white/50 transition-all
                                               hover:bg-white/12 hover:text-white/80">
                                    <ChevronLeft size={16} />
                                </button>
                                <button onClick={() => goTo((current + 1) % SLIDES.length)}
                                    className="w-9 h-9 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm
                                               flex items-center justify-center text-white/50 transition-all
                                               hover:bg-white/12 hover:text-white/80">
                                    <ChevronRight size={16} />
                                </button>
                                <span className="text-xs text-white/25 ml-1 tabular-nums font-mono">
                                    {String(current + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right — stat card */}
                    <div key={`card-${current}`} className="flex justify-center lg:justify-end">
                        <div className="hero-animate w-full max-w-sm" style={{ animationDelay: '100ms' }}>
                            <HeroStatCard
                                stat={stats[slide.statKey]}
                                label={slide.statLabel}
                                color={slide.color}
                                icon={slide.icon}
                                inView={true}
                                secondaryStats={secondaryStats}
                                categoryBreakdown={slide.statKey === 'total_proposals' && validatedByCategory.length > 0 ? validatedByCategory : null}
                                ringPct={
                                    slide.statKey === 'total_proposals' ? (stats.validated_rate ?? null)
                                        : slide.statKey === 'funded' ? (stats.funded_rate ?? null)
                                        : null
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom stats bar ── */}
            <div ref={statsRef} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pb-10">
                <div className="border border-white/8 rounded-2xl px-6 py-5 backdrop-blur-xl"
                    style={{ background: 'rgba(255,255,255,0.035)' }}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/8">
                        {[
                            { value: stats.total_proposals, label: stats.academic_year ? t(':year Proposals', { year: stats.academic_year }) : 'Proposals', color: primaryColor,  icon: <FileText  size={13} /> },
                            { value: stats.funded,          label: 'Funded Projects',    color: '#10b981', icon: <Award     size={13} /> },
                            { value: stats.colleges,        label: 'Colleges',           color: '#f59e0b', icon: <Layers    size={13} /> },
                            { value: stats.departments,     label: 'Departments',        color: '#8b5cf6', icon: <Users     size={13} /> },
                        ].map((s, i) => (
                            <div key={i} className={`flex items-center gap-4 ${i > 0 ? 'pl-6' : ''} ${i < 3 ? 'pr-6' : ''}`}>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: `${s.color}20`, color: s.color }}>
                                    {s.icon}
                                </div>
                                <StatCounter label={s.label} value={s.value} enabled={statsInView} color={s.color} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
                <div className="h-full" style={{ width: `${progress}%`, background: slide.color, transition: 'width 0.1s linear' }} />
            </div>

            {/* Page fade to next section */}
            <div className="h-12" style={{ background: 'linear-gradient(to bottom, transparent, rgb(249 250 251))' }} />
        </section>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
    const t = useT();
    const [calls, setCalls]               = useState([]);
    const [stats, setStats]               = useState({});
    const [thematicAreas, setThematicAreas] = useState([]);
    const [faqs, setFaqs]                 = useState(null); // null = loading
    const [openFaq, setOpenFaq]           = useState(null);

    const s            = usePage().props.app_settings ?? {};
    const primaryColor = s.primary_color     || '#6366f1';
    const orgName      = s.organization_name || 'University';
    const heroBg       = s.public_hero_bg     || '#0f172a';
    const cardsBg      = s.public_cards_bg    || '#f9fafb';
    const featuresBg   = s.public_features_bg || '#0f172a';

    const badge        = s.public_hero_badge        || `${orgName} · RTT Management`;
    const heading      = s.public_hero_heading      || 'Accelerate Your Research';
    const highlight    = s.public_hero_highlight    || 'From Idea to Impact';
    const subtitle     = s.public_hero_subtitle     || 'Submit proposals, track progress, and manage grants — all in one platform built for academic excellence.';
    const ctaPrimary   = s.public_hero_cta_primary  || 'Explore Open Calls';
    const ctaSecondary = s.public_hero_cta_secondary || 'Track Your Proposal';

    const showCalls    = s.public_show_open_calls   !== 'false';
    const showHIW      = s.public_show_how_it_works !== 'false';
    const showFeatures = s.public_show_features     !== 'false';
    const showFaq      = s.public_show_faq          !== 'false';
    const showCTA      = s.public_show_cta          !== 'false';

    const featTitle = s.public_features_title    || 'Everything You Need to Manage RTT';
    const featSub   = s.public_features_subtitle || 'A complete platform for the full research lifecycle.';
    const ctaTitle  = s.public_cta_title         || 'Ready to Start Your Research Journey?';
    const ctaSub    = s.public_cta_subtitle      || `Join researchers from ${orgName} and transform your ideas into impactful funded work.`;
    const ctaBtn1   = s.public_cta_primary       || 'View Open Calls';
    const ctaBtn2   = s.public_cta_secondary     || 'Track Proposal';

    const features = resolveFeatures(s);

    const steps = DEFAULT_STEPS.map((d, i) => ({
        title: s[`public_step_${i + 1}_title`] || d.title,
        desc:  s[`public_step_${i + 1}_desc`]  || d.desc,
    }));

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
        get('/faqs/public')
            .then(r => setFaqs(r?.data ?? []))
            .catch(() => setFaqs([]));
        get('/thematic-areas/public')
            .then(r => setThematicAreas(r?.data ?? []))
            .catch(() => {});
    }, []);

    return (
        <PublicLayout>

            {/* ── Hero Slider ───────────────────────────────────────────────── */}
            <HeroSlider
                stats={stats}
                primaryColor={primaryColor}
                heroBg={heroBg}
                orgName={orgName}
                ctaPrimary={ctaPrimary}
                ctaSecondary={ctaSecondary}
                s={s}
            />

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
                                {t('Browse all open calls')} <ArrowRight size={14} />
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {steps.map((step, i) => (
                                <div key={i} className="relative group">
                                    {/* Connector line (desktop, within a row of three) */}
                                    {i < steps.length - 1 && i % 3 !== 2 && (
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
                                        <h3 className="font-bold text-slate-900 mb-2 text-sm">{t(step.title)}</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">{t(step.desc)}</p>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {thematicAreas.map((area) => (
                                <div
                                    key={area.id}
                                    className="group p-5 rounded-2xl border border-gray-100 hover:border-gray-200
                                               hover:shadow-md transition-all duration-200 bg-gray-50/50 flex flex-col gap-3"
                                >
                                    <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${area.color}18`, color: area.color }}
                                    >
                                        <AreaIcon emoji={area.icon} />
                                    </div>
                                    <div>
                                        <div
                                            className="w-8 h-1 rounded-full mb-2"
                                            style={{ backgroundColor: area.color }}
                                        />
                                        <h3 className="font-bold text-slate-900 text-sm leading-snug">
                                            {area.name}
                                        </h3>
                                        <SubTopics area={area} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── Platform Features ─────────────────────────────────────────── */}
            {showFeatures && features.length > 0 && (
                <section className="py-14"
                    style={{ background: `linear-gradient(135deg, ${featuresBg} 0%, ${featuresBg}dd 100%)` }}>
                    <div className="max-w-7xl mx-auto px-6">
                        <SectionHead eyebrow="Platform Capabilities" title={featTitle} light />
                        <p className="text-slate-300 text-sm mb-10 max-w-lg -mt-4">{t(featSub)}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {features.map((f) => (
                                <div key={f.title}
                                    className="group p-6 rounded-2xl border border-white/10 bg-white/5
                                               hover:bg-white/8 hover:border-white/20 transition-all duration-200">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                                        style={{ backgroundColor: `${primaryColor}33` }}>
                                        <f.icon size={18} className="text-blue-300" />
                                    </div>
                                    <h3 className="font-semibold text-white text-sm mb-1.5">{t(f.title)}</h3>
                                    <p className="text-xs text-slate-300 leading-relaxed">{t(f.desc)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── FAQ ───────────────────────────────────────────────────────── */}
            {showFaq && (
                <section className="bg-white py-14 border-t border-gray-100">
                    <div className="max-w-4xl mx-auto px-6">
                        <SectionHead
                            eyebrow="Got Questions?"
                            title="Frequently Asked Questions"
                        />

                        <div className="flex flex-col gap-3">
                            {(faqs === null ? DEFAULT_FAQS : faqs.length > 0 ? faqs : DEFAULT_FAQS).map((item, i) => (
                                <FaqItem
                                    key={item.id ?? i}
                                    item={item}
                                    open={openFaq === i}
                                    onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                                    primaryColor={primaryColor}
                                />
                            ))}
                        </div>

                        {/* Still have questions CTA */}
                        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-gray-100 p-6"
                            style={{ background: `linear-gradient(135deg, ${primaryColor}06, ${primaryColor}02)` }}>
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${primaryColor}15` }}>
                                <HelpCircle size={22} style={{ color: primaryColor }} />
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <p className="font-semibold text-slate-800 text-sm">{t('Still have questions?')}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {t('Contact the Research & Technology Transfer office or use the feedback form below.')}
                                </p>
                            </div>
                            <a href="/tracker"
                                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                                           text-xs font-bold text-white transition-all hover:opacity-90"
                                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
                                {t('Track Your Proposal')} <ArrowRight size={13} />
                            </a>
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
                                    {t(ctaTitle)}
                                </h2>
                                <p className="text-slate-500 text-sm leading-relaxed">{t(ctaSub)}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                                <a href="/proposal-calls/public"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl
                                               text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 hover:scale-105"
                                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
                                    {t(ctaBtn1)} <ArrowRight size={15} />
                                </a>
                                <a href="/tracker"
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl
                                               text-sm font-semibold border-2 text-slate-700 hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: `${primaryColor}50` }}>
                                    {t(ctaBtn2)}
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            )}

        </PublicLayout>
    );
}
