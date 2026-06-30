import { useState, useEffect, useRef } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { FlaskConical, Menu, X, Search, Download, ChevronDown, Clock, Calendar, ArrowRight, Flame, CalendarDays, MapPin, Video, Building2, Globe, Star } from 'lucide-react';
import { get } from '../lib/api';

// ─── Inline social SVG icons ──────────────────────────────────────────────────

const IconTelegram = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
    </svg>
);
const IconFacebook = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
);
const IconTwitterX = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
);
const IconLinkedIn = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
        <circle cx="4" cy="4" r="2"/>
    </svg>
);
const IconInstagram = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
);
const IconYouTube = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
        <polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
    </svg>
);

const SOCIAL_META = {
    public_social_telegram:  { label: 'Telegram',  Icon: IconTelegram  },
    public_social_facebook:  { label: 'Facebook',  Icon: IconFacebook  },
    public_social_twitter:   { label: 'Twitter/X', Icon: IconTwitterX  },
    public_social_linkedin:  { label: 'LinkedIn',  Icon: IconLinkedIn  },
    public_social_instagram: { label: 'Instagram', Icon: IconInstagram },
    public_social_youtube:   { label: 'YouTube',   Icon: IconYouTube   },
};

// ─── Category config (shared with the dropdown) ───────────────────────────────

const CAT = {
    research:             { label: 'Research',      color: '#3b82f6', bg: '#eff6ff' },
    community_engagement: { label: 'Community',     color: '#10b981', bg: '#f0fdf4' },
    technology_transfer:  { label: 'Tech Transfer', color: '#8b5cf6', bg: '#f5f3ff' },
    innovation:           { label: 'Innovation',    color: '#f59e0b', bg: '#fffbeb' },
    other:                { label: 'Other',         color: '#64748b', bg: '#f8fafc' },
};

// ─── Deadline helper ──────────────────────────────────────────────────────────

function calcDeadline(endDate) {
    if (!endDate) return null;
    const diff = new Date(endDate) - Date.now();
    if (diff <= 0) return { label: 'Closing today', urgent: true, veryUrgent: true };
    const days  = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    if (days === 0) return { label: `${hours}h left`, urgent: true, veryUrgent: true };
    if (days <= 3)  return { label: `${days}d left`,  urgent: true,  veryUrgent: false };
    if (days <= 14) return { label: `${days}d left`,  urgent: false, veryUrgent: false };
    return { label: new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), urgent: false, veryUrgent: false };
}

// ─── Open Calls dropdown ──────────────────────────────────────────────────────

function OpenCallsDropdown({ calls, loading, primaryColor, currentPath }) {
    const [open,    setOpen]    = useState(false);
    const [mounted, setMounted] = useState(false); // keeps DOM alive during fade-out
    const [shown,   setShown]   = useState(false); // drives CSS opacity/transform
    const timerRef              = useRef(null);
    const count                 = calls.length;
    const isActive              = currentPath.startsWith('/proposal-calls');

    const show = () => {
        clearTimeout(timerRef.current);
        setOpen(true);
        setMounted(true);
        // one rAF delay so the DOM element exists before we flip the visible class
        requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    };

    const hide = () => {
        setShown(false);
        timerRef.current = setTimeout(() => { setMounted(false); setOpen(false); }, 220);
    };

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handleApply = (callId) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('rtt_token') : null;
        if (!token) {
            localStorage.setItem('redirect_after_login', `/proposals/create?call_id=${callId}`);
            window.location.href = '/login';
        } else {
            window.location.href = `/proposals/create?call_id=${callId}`;
        }
    };

    return (
        <div
            className="relative h-full flex items-center"
            onMouseEnter={show}
            onMouseLeave={hide}
        >
            {/* ── Trigger button ── */}
            <button
                className={`relative px-4 h-10 flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    isActive || open ? 'text-white bg-black/20' : 'text-white/85 hover:text-white hover:bg-black/10'
                }`}
            >
                Open Calls

                {/* Badge with ping ripple blink */}
                {count > 0 && (
                    <span className="relative inline-flex">
                        {/* Ripple ring — blinks on/off continuously */}
                        <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                            style={{ backgroundColor: 'white' }}
                        />
                        {/* Solid badge */}
                        <span
                            className="relative inline-flex items-center justify-center h-4 min-w-4 px-1
                                       rounded-full bg-white text-[10px] font-bold leading-none tabular-nums"
                            style={{ color: primaryColor }}
                        >
                            {count}
                        </span>
                    </span>
                )}

                <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {/* ── Flyout panel — fade + slide ── */}
            {mounted && (
                <div
                    className={`absolute left-0 top-full w-96 bg-white rounded-b-2xl
                                shadow-2xl shadow-black/15 border border-gray-100 border-t-0
                                overflow-hidden z-50 origin-top
                                transition-all duration-200 ease-out
                                ${shown
                                    ? 'opacity-100 translate-y-0 scale-y-100'
                                    : 'opacity-0 -translate-y-2 scale-y-95'
                                }`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Flame size={13} className="animate-pulse" style={{ color: primaryColor }} />
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">
                                {loading ? 'Loading…' : count === 0 ? 'No Active Calls' : `${count} Active Call${count !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                        <Link href="/proposal-calls/public"
                            className="text-[11px] font-semibold hover:underline transition-opacity hover:opacity-70"
                            style={{ color: primaryColor }}>
                            View all
                        </Link>
                    </div>

                    {/* Loading skeleton */}
                    {loading && (
                        <div className="p-4 space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-1.5 rounded-full bg-gray-100 self-stretch" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                                        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && count === 0 && (
                        <div className="px-4 py-8 text-center">
                            <p className="text-sm text-gray-500">No funding calls are open right now.</p>
                            <p className="text-xs text-gray-400 mt-1">Check back soon for new opportunities.</p>
                        </div>
                    )}

                    {/* Call list — each row fades in with a stagger */}
                    {!loading && count > 0 && (
                        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                            {calls.slice(0, 5).map((call, idx) => {
                                const cat      = CAT[call.category] ?? CAT.other;
                                const deadline = calcDeadline(call.end_date);
                                return (
                                    <div
                                        key={call.id}
                                        className={`flex items-start gap-3 px-4 py-3.5
                                                    hover:bg-gray-50/70 transition-all duration-150
                                                    group/item
                                                    ${shown ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}
                                        style={{ transitionDelay: shown ? `${idx * 40}ms` : '0ms' }}
                                    >
                                        {/* Category accent bar */}
                                        <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                                            style={{ backgroundColor: cat.color }} />

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 leading-snug
                                                           line-clamp-2 group-hover/item:text-gray-700 transition-colors">
                                                {call.title}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                    style={{ color: cat.color, backgroundColor: cat.bg }}>
                                                    {cat.label}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                                                    <Calendar size={9} /> {call.academic_year}
                                                </span>
                                                {deadline && (
                                                    <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                        deadline.veryUrgent
                                                            ? 'bg-red-50 text-red-600'
                                                            : deadline.urgent
                                                            ? 'bg-orange-50 text-orange-600'
                                                            : 'bg-gray-50 text-gray-500'
                                                    }`}>
                                                        <Clock size={8} className={deadline.veryUrgent ? 'animate-pulse' : ''} />
                                                        {deadline.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Apply button — slides in on row hover */}
                                        <button
                                            onClick={() => handleApply(call.id)}
                                            className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5
                                                       rounded-lg text-white opacity-0 group-hover/item:opacity-100
                                                       translate-x-1 group-hover/item:translate-x-0
                                                       transition-all duration-150"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            Apply <ArrowRight size={9} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer */}
                    {!loading && count > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                            <Link href="/proposal-calls/public"
                                className="flex items-center justify-between text-sm font-semibold
                                           transition-all hover:gap-3 hover:opacity-80"
                                style={{ color: primaryColor }}>
                                <span>Browse all {count} open call{count !== 1 ? 's' : ''}</span>
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Conferences dropdown ─────────────────────────────────────────────────────

const CONF_TYPE_CFG = {
    physical: { label: 'In-Person', Icon: Building2, color: '#3b82f6' },
    virtual:  { label: 'Virtual',   Icon: Video,     color: '#10b981' },
    hybrid:   { label: 'Hybrid',    Icon: Globe,     color: '#8b5cf6' },
};

function fmtConfDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calcDaysTo(startDate) {
    if (!startDate) return null;
    const diff = new Date(startDate) - Date.now();
    if (diff <= 0) {
        return { label: 'Ongoing', ongoing: true };
    }
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return { label: 'Today!', urgent: true };
    if (days <= 7)  return { label: `${days}d away`, urgent: true };
    if (days <= 30) return { label: `${days}d away`, urgent: false };
    return { label: fmtConfDate(startDate), urgent: false };
}

function ConferencesDropdown({ conferences, loading, primaryColor, currentPath }) {
    const [open,    setOpen]    = useState(false);
    const [mounted, setMounted] = useState(false);
    const [shown,   setShown]   = useState(false);
    const timerRef              = useRef(null);
    const count                 = conferences.length;
    const isActive              = currentPath.startsWith('/conferences');

    const show = () => {
        clearTimeout(timerRef.current);
        setOpen(true);
        setMounted(true);
        requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    };

    const hide = () => {
        setShown(false);
        timerRef.current = setTimeout(() => { setMounted(false); setOpen(false); }, 220);
    };

    useEffect(() => () => clearTimeout(timerRef.current), []);

    return (
        <div className="relative h-full flex items-center" onMouseEnter={show} onMouseLeave={hide}>
            {/* Trigger */}
            <button className={`relative px-4 h-10 flex items-center gap-1.5 text-sm font-medium transition-colors ${
                isActive || open ? 'text-white bg-black/20' : 'text-white/85 hover:text-white hover:bg-black/10'
            }`}>
                Conferences
                {count > 0 && (
                    <span className="relative inline-flex">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                            style={{ backgroundColor: 'white' }} />
                        <span className="relative inline-flex items-center justify-center h-4 min-w-4 px-1
                                         rounded-full bg-white text-[10px] font-bold leading-none tabular-nums"
                            style={{ color: primaryColor }}>
                            {count}
                        </span>
                    </span>
                )}
                <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Flyout */}
            {mounted && (
                <div className={`absolute left-0 top-full w-105 bg-white rounded-b-2xl
                                 shadow-2xl shadow-black/15 border border-gray-100 border-t-0
                                 overflow-hidden z-50 origin-top transition-all duration-200 ease-out
                                 ${shown ? 'opacity-100 translate-y-0 scale-y-100' : 'opacity-0 -translate-y-2 scale-y-95'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <CalendarDays size={13} className="animate-pulse" style={{ color: primaryColor }} />
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">
                                {loading ? 'Loading…' : count === 0 ? 'No Upcoming Events' : `${count} Upcoming Conference${count !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                        <Link href="/conferences"
                            className="text-[11px] font-semibold hover:underline transition-opacity hover:opacity-70"
                            style={{ color: primaryColor }}>
                            View all
                        </Link>
                    </div>

                    {/* Skeleton */}
                    {loading && (
                        <div className="p-4 space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0" />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-3 bg-gray-100 rounded w-4/5" />
                                        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                                        <div className="h-2 bg-gray-100 rounded w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && count === 0 && (
                        <div className="px-4 py-8 text-center">
                            <CalendarDays size={32} className="mx-auto text-gray-200 mb-3" />
                            <p className="text-sm text-gray-500">No upcoming conferences right now.</p>
                            <p className="text-xs text-gray-400 mt-1">Check back soon for new events.</p>
                        </div>
                    )}

                    {/* Conference list */}
                    {!loading && count > 0 && (
                        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                            {conferences.slice(0, 5).map((conf, idx) => {
                                const type    = CONF_TYPE_CFG[conf.location_type] ?? CONF_TYPE_CFG.physical;
                                const TypeIcon = type.Icon;
                                const timing  = calcDaysTo(conf.start_date);
                                return (
                                    <Link
                                        key={conf.id}
                                        href={`/conferences/${conf.slug}`}
                                        className={`flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50/70
                                                    transition-all duration-150 group/item
                                                    ${shown ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}
                                        style={{ transitionDelay: shown ? `${idx * 40}ms` : '0ms' }}
                                    >
                                        {/* Date block */}
                                        <div className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white font-bold text-center"
                                            style={{ background: `linear-gradient(135deg, ${type.color}, ${type.color}cc)` }}>
                                            <span className="text-[10px] leading-none opacity-80 uppercase">
                                                {conf.start_date ? new Date(conf.start_date).toLocaleDateString('en-GB', { month: 'short' }) : '—'}
                                            </span>
                                            <span className="text-lg leading-none">
                                                {conf.start_date ? new Date(conf.start_date).getDate() : '—'}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                                    style={{ backgroundColor: type.color }}>
                                                    <TypeIcon size={8} /> {type.label}
                                                </span>
                                                {conf.is_featured && (
                                                    <Star size={9} className="text-amber-400 fill-amber-400" />
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1
                                                           group-hover/item:text-indigo-700 transition-colors">
                                                {conf.title}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[10px] text-gray-400">
                                                    {fmtConfDate(conf.start_date)}
                                                </span>
                                                {timing && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                        timing.ongoing
                                                            ? 'bg-green-50 text-green-600'
                                                            : timing.urgent
                                                            ? 'bg-orange-50 text-orange-600'
                                                            : 'bg-gray-50 text-gray-500'
                                                    }`}>
                                                        {timing.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <ArrowRight size={14} className="shrink-0 text-gray-300 group-hover/item:text-indigo-400
                                                                           group-hover/item:translate-x-0.5 transition-all duration-150 mt-1" />
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer */}
                    {!loading && count > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                            <Link href="/conferences"
                                className="flex items-center justify-between text-sm font-semibold transition-all hover:gap-3 hover:opacity-80"
                                style={{ color: primaryColor }}>
                                <span>Browse all {count} upcoming conference{count !== 1 ? 's' : ''}</span>
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Default nav items ────────────────────────────────────────────────────────

const DEFAULT_NAV = [
    { href: '/',                       label: 'Home'                  },
    { href: '/proposal-calls/public',  label: 'Open Calls'            },
    { href: '/conferences',            label: 'Conferences'           },
    { href: '/explore',                label: 'Explore'               },
    { href: '/funding-opportunities',  label: 'Funding Opportunities' },
    { href: '/repository',             label: 'Repository'            },
    { href: '/tracker',                label: 'Track Proposal'        },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function PublicLayout({ children }) {
    const [mobileOpen,      setMobileOpen]      = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [developerModal,  setDeveloperModal]  = useState(false);
    const [scrolled,        setScrolled]        = useState(false);
    const [openCalls,          setOpenCalls]          = useState([]);
    const [callsLoading,       setCallsLoading]       = useState(true);
    const [upcomingConferences, setUpcomingConferences] = useState([]);
    const [confsLoading,        setConfsLoading]        = useState(true);

    const token = typeof window !== 'undefined' ? localStorage.getItem('rtt_token') : null;

    const s             = usePage().props.app_settings ?? {};
    const systemName    = s.system_name        || 'RTT Platform';
    const systemLogo    = s.system_logo        || null;
    const logoWidth     = s.logo_width         || null;
    const logoHeight    = s.logo_height        || null;
    const orgName       = s.organization_name  || 'University';
    const primaryColor  = s.primary_color      || '#c0392b';
    const topbarBg      = s.public_topbar_bg   || '#0f172a';
    const topbarText    = s.public_topbar_text || '#94a3b8';
    const footerBg      = s.public_footer_bg   || '#0f172a';
    const developerCredits = (() => {
        try { return JSON.parse(s.developer_credits || '[]'); } catch { return []; }
    })();
    const footerText    = s.footer_text        || `© ${new Date().getFullYear()} All rights reserved.`;
    const annActive     = s.announcement_active === 'true';
    const annMsg        = s.announcement_message || '';
    const headerTagline  = s.public_header_tagline  || `${orgName} — Research & Technology Transfer Platform`;
    const footerTagline  = s.public_footer_tagline  || 'Research & Technology Transfer Platform';

    // Build dynamic nav from settings (falls back to defaults)
    const navItems = DEFAULT_NAV.map((d, i) => {
        const n    = i + 1;
        const show = s[`public_nav_item_${n}_show`] !== 'false';
        if (!show) return null;
        return {
            href:  s[`public_nav_item_${n}_href`]  || d.href,
            label: s[`public_nav_item_${n}_label`] || d.label,
        };
    }).filter(Boolean);

    // Social links — only those with a value set
    const socialLinks = Object.entries(SOCIAL_META)
        .filter(([key]) => s[key])
        .map(([key, meta]) => ({ ...meta, url: s[key] }));

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        get('/proposal-calls')
            .then(res => {
                const raw = res.data;
                const items = Array.isArray(raw) ? raw : (raw?.data ?? raw ?? []);
                setOpenCalls(Array.isArray(items) ? items : []);
            })
            .catch(() => {})
            .finally(() => setCallsLoading(false));
    }, []);

    useEffect(() => {
        get('/conferences', { scope: 'upcoming', per_page: 5 })
            .then(res => {
                const raw = res.data?.data ?? res.data ?? [];
                const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
                setUpcomingConferences(Array.isArray(items) ? items : []);
            })
            .catch(() => {})
            .finally(() => setConfsLoading(false));
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-white">

            {/* ── Announcement banner ──────────────────────────────────────────── */}
            {annActive && annMsg && !bannerDismissed && (
                <div className="flex items-center justify-between gap-3 px-4 py-2 text-white text-xs font-medium shrink-0"
                    style={{ backgroundColor: primaryColor }}>
                    <p className="flex-1 text-center">{annMsg}</p>
                    <button onClick={() => setBannerDismissed(true)} className="shrink-0 opacity-70 hover:opacity-100">
                        <X size={13} />
                    </button>
                </div>
            )}

            {/* ── Sticky navigation shell ──────────────────────────────────────── */}
            <div className="sticky top-0 z-50 bg-white shadow-sm">

                {/* ── Top utility bar (dark slim strip) — hidden after scroll ── */}
                <div className={`text-xs hidden md:block overflow-hidden transition-all duration-300 ${scrolled ? 'max-h-0' : 'max-h-9'}`}
                     style={{ backgroundColor: topbarBg }}>
                    <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-9">

                        {/* Left — tagline with pulsing dot */}
                        <div className="flex items-center gap-2.5">
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                                    style={{ backgroundColor: primaryColor }} />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                                    style={{ backgroundColor: primaryColor }} />
                            </span>
                            <span className="font-medium tracking-wide" style={{ color: topbarText }}>
                                {headerTagline}
                            </span>
                        </div>

                        {/* Right — links */}
                        <div className="flex items-center gap-1">
                            <Link
                                href="/download"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md transition-all hover:bg-white/10 font-medium"
                                style={{ color: topbarText }}
                            >
                                <Download size={10} />
                                Downloads
                            </Link>
                            <span className="w-px h-3 mx-1 opacity-20" style={{ backgroundColor: topbarText }} />
                            {token ? (
                                <Link href="/dashboard"
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all hover:bg-white/10"
                                    style={{ color: topbarText }}>
                                    Dashboard <ArrowRight size={10} />
                                </Link>
                            ) : (
                                <>
                                    <Link href="/login"
                                        className="px-2.5 py-1 rounded-md font-medium transition-all hover:bg-white/10"
                                        style={{ color: topbarText }}>
                                        Sign In
                                    </Link>
                                    <Link href="/register"
                                        className="px-2.5 py-1 rounded-md font-semibold transition-all"
                                        style={{
                                            color: topbarBg,
                                            backgroundColor: topbarText,
                                            opacity: 0.9,
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
                                    >
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Branding header — compacts on scroll ── */}
                <header className={`bg-white border-b border-gray-100 transition-all duration-300 ${scrolled ? 'py-0' : ''}`}>
                    <div className={`max-w-7xl mx-auto px-6 flex items-center justify-between
                                     transition-all duration-300 ${scrolled ? 'h-14' : 'h-20'}`}>

                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2.5 shrink-0">
                            {systemLogo ? (
                                <img
                                    src={systemLogo}
                                    alt={systemName}
                                    className="object-contain transition-all duration-300"
                                    style={logoWidth || logoHeight ? {
                                        width:     logoWidth  ? `${logoWidth}px`  : 'auto',
                                        height:    logoHeight ? `${logoHeight}px` : 'auto',
                                    } : {
                                        height: scrolled ? '28px' : '44px',
                                        width:  'auto',
                                    }}
                                />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className={`rounded-xl flex items-center justify-center shadow-sm
                                                     transition-all duration-300 ${scrolled ? 'h-8 w-8' : 'h-11 w-11'}`}
                                        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)` }}>
                                        <FlaskConical size={scrolled ? 15 : 20} className="text-white" />
                                    </div>
                                    <div>
                                        <div className={`font-extrabold leading-none tracking-tight transition-all duration-300 ${scrolled ? 'text-lg' : 'text-2xl'}`}
                                            style={{ color: primaryColor }}>
                                            {systemName}
                                        </div>
                                        {!scrolled && (
                                            <div className="text-[11px] text-slate-400 font-medium tracking-wide mt-0.5">
                                                {orgName}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Link>

                        {/* Desktop auth */}
                        <div className="hidden md:flex items-center gap-3">
                            {token ? (
                                <Link href="/dashboard"
                                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                                    style={{ backgroundColor: primaryColor }}>
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link href="/login"
                                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                                        Sign In
                                    </Link>
                                    <Link href="/register"
                                        className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                                        style={{ backgroundColor: primaryColor }}>
                                        Register Free
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile toggle */}
                        <button className="md:hidden p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            onClick={() => setMobileOpen(!mobileOpen)}>
                            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </header>

                {/* ── Coloured nav bar ── */}
                <nav className="hidden md:block" style={{ backgroundColor: primaryColor }}>
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="flex items-center h-10">
                            {navItems.map(l => {
                                // "Open Calls" gets the rich mega-dropdown treatment
                                if (l.href === '/proposal-calls/public') {
                                    return (
                                        <OpenCallsDropdown
                                            key={l.href}
                                            calls={openCalls}
                                            loading={callsLoading}
                                            primaryColor={primaryColor}
                                            currentPath={currentPath}
                                        />
                                    );
                                }
                                // "Conferences" gets a dropdown showing upcoming events
                                if (l.href === '/conferences') {
                                    return (
                                        <ConferencesDropdown
                                            key={l.href}
                                            conferences={upcomingConferences}
                                            loading={confsLoading}
                                            primaryColor={primaryColor}
                                            currentPath={currentPath}
                                        />
                                    );
                                }

                                const active = currentPath === l.href
                                    || (l.href !== '/' && currentPath.startsWith(l.href));
                                return (
                                    <Link key={l.href} href={l.href}
                                        className={`px-4 h-full flex items-center text-sm font-medium transition-colors ${
                                            active ? 'text-white bg-black/20' : 'text-white/80 hover:text-white hover:bg-black/10'
                                        }`}>
                                        {l.label}
                                    </Link>
                                );
                            })}
                            <div className="ml-auto">
                                <Link href="/tracker"
                                    className="flex items-center gap-1.5 h-10 px-4 text-white/80
                                               hover:text-white hover:bg-black/10 transition-colors text-sm">
                                    <Search size={15} /> Track
                                </Link>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* ── Mobile nav drawer ── */}
                {mobileOpen && (
                    <div className="md:hidden bg-white border-b border-gray-100 shadow-lg">
                        <nav className="px-4 py-3 space-y-0.5">
                            {navItems.map(l => (
                                <Link key={l.href} href={l.href}
                                    onClick={() => setMobileOpen(false)}
                                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium
                                               text-gray-700 hover:bg-gray-50 transition-colors">
                                    <span>{l.label}</span>
                                    {l.href === '/proposal-calls/public' && openCalls.length > 0 && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                            style={{ backgroundColor: primaryColor }}>
                                            {openCalls.length}
                                        </span>
                                    )}
                                </Link>
                            ))}
                            <Link href="/download"
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                <Download size={15} className="text-gray-400" /> Downloads
                            </Link>
                        </nav>
                        <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex flex-col gap-2">
                            {token ? (
                                <Link href="/dashboard"
                                    className="py-2.5 px-3 rounded-lg text-sm font-semibold text-white text-center"
                                    style={{ backgroundColor: primaryColor }}>
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link href="/login"
                                        className="py-2.5 px-3 rounded-lg text-sm font-medium text-center border border-gray-200 text-gray-700">
                                        Sign In
                                    </Link>
                                    <Link href="/register"
                                        className="py-2.5 px-3 rounded-lg text-sm font-semibold text-white text-center"
                                        style={{ backgroundColor: primaryColor }}>
                                        Register Free
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/* ── End sticky shell ── */}

            <main className="flex-1 bg-gray-50">{children}</main>

            {/* ── Footer ───────────────────────────────────────────────────────── */}
            <footer style={{ backgroundColor: footerBg }} className="text-slate-400">
                <div className="max-w-7xl mx-auto px-6 py-14">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10 border-b border-white/10">

                        {/* Brand + social */}
                        <div className="md:col-span-1">
                            <div className="flex items-center gap-2.5 mb-3">
                                {systemLogo ? (
                                    <img
                                        src={systemLogo}
                                        alt={systemName}
                                        className="opacity-80 object-contain"
                                        style={logoWidth || logoHeight ? {
                                            width:  logoWidth  ? `${logoWidth}px`  : 'auto',
                                            height: logoHeight ? `${logoHeight}px` : 'auto',
                                        } : { height: '28px', width: 'auto' }}
                                    />
                                ) : (
                                    <div className="h-7 w-7 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: primaryColor }}>
                                        <FlaskConical size={14} className="text-white" />
                                    </div>
                                )}
                                <span className="font-bold text-white text-base">{systemName}</span>
                            </div>
                            <p className="text-sm leading-relaxed mb-5">{orgName}</p>
                            {socialLinks.length > 0 && (
                                <div className="flex items-center flex-wrap gap-2">
                                    {socialLinks.map(({ label, Icon, url }) => (
                                        <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                                            title={label}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                                       bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white transition-all">
                                            <Icon size={15} />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Platform */}
                        <div>
                            <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Platform</h4>
                            <ul className="space-y-2.5 text-sm">
                                {navItems.map(l => (
                                    <li key={l.href}>
                                        <Link href={l.href} className="hover:text-white transition-colors">{l.label}</Link>
                                    </li>
                                ))}
                                <li>
                                    <Link href="/download" className="hover:text-white transition-colors">Downloads</Link>
                                </li>
                            </ul>
                        </div>

                        {/* Account */}
                        <div>
                            <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Account</h4>
                            <ul className="space-y-2.5 text-sm">
                                <li><Link href="/login"     className="hover:text-white transition-colors">Sign In</Link></li>
                                <li><Link href="/register"  className="hover:text-white transition-colors">Register</Link></li>
                                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                            </ul>
                        </div>

                        {/* Status */}
                        <div>
                            <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Status</h4>
                            <div className="flex items-center gap-2 text-sm text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                All systems operational
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <p>{footerText}</p>
                        <div className="flex items-center gap-4">
                            {developerCredits.length > 0 && (
                                <button
                                    onClick={() => setDeveloperModal(true)}
                                    className="text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
                                >
                                    {developerCredits.length === 1
                                        ? `Developed by ${developerCredits[0].name}`
                                        : developerCredits.length === 2
                                            ? `Developed by ${developerCredits[0].name} & ${developerCredits[1].name}`
                                            : `Developed by ${developerCredits[0].name} & ${developerCredits.length - 1} others`
                                    }
                                </button>
                            )}
                            <p className="text-slate-600">{footerTagline}</p>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ── Developer credit modal ──────────────────────────────────── */}
            {developerModal && (
                <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                     onClick={() => setDeveloperModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden"
                         onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900">Built by</h3>
                            <button onClick={() => setDeveloperModal(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        {/* Developer list */}
                        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                            {developerCredits.map((dev, i) => (
                                <div key={i} className="flex items-start gap-3 px-6 py-4">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <Globe size={16} className="text-indigo-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900">{dev.name}</p>
                                        {dev.tagline && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{dev.tagline}</p>}
                                        {dev.website && (
                                            <a href={dev.website} target="_blank" rel="noopener noreferrer"
                                               className="inline-flex items-center gap-1 mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                                                <Globe size={11} /> {dev.website.replace(/^https?:\/\//, '')}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
