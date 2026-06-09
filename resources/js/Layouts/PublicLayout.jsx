import { useState, useEffect } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { FlaskConical, Menu, X, Search, Download } from 'lucide-react';

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

// ─── Default nav items ────────────────────────────────────────────────────────

const DEFAULT_NAV = [
    { href: '/',                      label: 'Home'           },
    { href: '/proposal-calls/public', label: 'Open Calls'     },
    { href: '/explore',               label: 'Explore'        },
    { href: '/repository',            label: 'Repository'     },
    { href: '/tracker',               label: 'Track Proposal' },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function PublicLayout({ children }) {
    const [mobileOpen,      setMobileOpen]      = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [scrolled,        setScrolled]        = useState(false);

    const token = typeof window !== 'undefined' ? localStorage.getItem('rtt_token') : null;

    const s             = usePage().props.app_settings ?? {};
    const systemName    = s.system_name        || 'RTT Platform';
    const systemLogo    = s.system_logo        || null;
    const orgName       = s.organization_name  || 'University';
    const primaryColor  = s.primary_color      || '#c0392b';
    const footerBg      = s.public_footer_bg   || '#0f172a';
    const footerText    = s.footer_text        || `© ${new Date().getFullYear()} All rights reserved.`;
    const annActive     = s.announcement_active === 'true';
    const annMsg        = s.announcement_message || '';
    const headerTagline = s.public_header_tagline || `${orgName} — Research & Technology Transfer Platform`;

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
                <div className={`bg-slate-900 text-slate-400 text-xs hidden md:block overflow-hidden
                                 transition-all duration-300 ${scrolled ? 'max-h-0' : 'max-h-8'}`}>
                    <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-8">
                        <span className="flex items-center gap-1 text-slate-500 font-medium">
                            {headerTagline}
                        </span>
                        <div className="flex items-center gap-4">
                            {/* Downloads link — always shown */}
                            <Link
                                href="/download"
                                className={`flex items-center gap-1.5 transition-colors font-medium ${
                                    currentPath === '/download'
                                        ? 'text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Download size={11} />
                                Downloads
                            </Link>
                            <span className="w-px h-3 bg-slate-700" />
                            {token ? (
                                <Link href="/dashboard" className="hover:text-white transition-colors">
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link href="/login"    className="hover:text-white transition-colors">Sign In</Link>
                                    <span className="text-slate-700">|</span>
                                    <Link href="/register" className="hover:text-white transition-colors">Register</Link>
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
                                <img src={systemLogo} alt={systemName}
                                    className={`w-auto object-contain transition-all duration-300 ${scrolled ? 'h-7' : 'h-11'}`} />
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
                                    className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                                               text-gray-700 hover:bg-gray-50 transition-colors">
                                    {l.label}
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
                                    <img src={systemLogo} alt={systemName} className="h-7 w-auto opacity-80 object-contain" />
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
                        <p className="text-slate-600">Research & Technology Transfer Platform</p>
                    </div>
                </div>
            </footer>

        </div>
    );
}
