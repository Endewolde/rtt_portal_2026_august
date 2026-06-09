import { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { FlaskConical, Menu, X } from 'lucide-react';

const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/proposal-calls/public', label: 'Proposal Calls' },
    { href: '/explore', label: 'Explore' },
    { href: '/repository', label: 'Repository' },
    { href: '/tracker', label: 'Track Proposal' },
];

export default function PublicLayout({ children }) {
    const [menuOpen,         setMenuOpen]         = useState(false);
    const [bannerDismissed, setBannerDismissed]   = useState(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('rtt_token') : null;

    const appSettings       = usePage().props.app_settings ?? {};
    const systemName        = appSettings.system_name        || 'RTT Platform';
    const systemLogo        = appSettings.system_logo        || null;
    const orgName           = appSettings.organization_name  || 'University';
    const primaryColor      = appSettings.primary_color      || '#1d4ed8';
    const footerText        = appSettings.footer_text        || `© ${new Date().getFullYear()} All rights reserved.`;
    const announcementActive = appSettings.announcement_active === 'true';
    const announcementMsg   = appSettings.announcement_message || '';

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">

            {/* Announcement banner */}
            {announcementActive && announcementMsg && !bannerDismissed && (
                <div className="flex items-center justify-between gap-3 px-5 py-2.5
                                bg-amber-50 border-b border-amber-200 text-amber-800 shrink-0">
                    <p className="text-xs font-medium flex-1 min-w-0 text-center">{announcementMsg}</p>
                    <button onClick={() => setBannerDismissed(true)}
                        className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Header / Nav */}
            <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">

                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2.5 shrink-0">
                            {systemLogo
                                ? <img src={systemLogo} alt={systemName}
                                    className="h-8 w-auto max-w-35 object-contain" />
                                : <FlaskConical size={22} style={{ color: primaryColor }} />
                            }
                            <span className="font-bold text-gray-900 text-lg">{systemName}</span>
                        </Link>

                        {/* Desktop nav */}
                        <nav className="hidden md:flex items-center gap-6">
                            {navLinks.map((l) => (
                                <Link key={l.href} href={l.href}
                                    className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                                    style={{ '--hover-color': primaryColor }}>
                                    {l.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Desktop auth buttons */}
                        <div className="hidden md:flex items-center gap-3">
                            {token ? (
                                <Link href="/dashboard"
                                    className="text-sm font-semibold hover:underline"
                                    style={{ color: primaryColor }}>
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link href="/login"
                                        className="text-sm font-medium text-gray-700 hover:text-gray-900">
                                        Login
                                    </Link>
                                    <Link href="/register"
                                        className="rounded-lg px-4 py-2 text-sm font-semibold text-white
                                                   hover:opacity-90 transition-opacity"
                                        style={{ backgroundColor: primaryColor }}>
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile toggle */}
                        <button className="md:hidden p-2 text-gray-600"
                            onClick={() => setMenuOpen(!menuOpen)}>
                            {menuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>

                    {/* Mobile nav */}
                    {menuOpen && (
                        <nav className="md:hidden pb-4 space-y-1">
                            {navLinks.map((l) => (
                                <Link key={l.href} href={l.href}
                                    onClick={() => setMenuOpen(false)}
                                    className="block py-2 px-2 rounded-lg text-sm font-medium text-gray-700
                                               hover:bg-gray-50 hover:text-gray-900">
                                    {l.label}
                                </Link>
                            ))}
                            <div className="pt-3 flex flex-col gap-2 border-t border-gray-100">
                                {token ? (
                                    <Link href="/dashboard"
                                        className="text-sm font-semibold text-center py-2"
                                        style={{ color: primaryColor }}>
                                        Go to Dashboard
                                    </Link>
                                ) : (
                                    <>
                                        <Link href="/login"
                                            className="text-sm font-medium text-gray-700 text-center py-2">
                                            Login
                                        </Link>
                                        <Link href="/register"
                                            className="rounded-lg py-2 text-sm font-semibold text-white text-center"
                                            style={{ backgroundColor: primaryColor }}>
                                            Register
                                        </Link>
                                    </>
                                )}
                            </div>
                        </nav>
                    )}
                </div>
            </header>

            <main className="flex-1">{children}</main>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 text-sm py-8 mt-16">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row
                                items-center justify-between gap-4">
                    <span className="flex items-center gap-2">
                        {systemLogo
                            ? <img src={systemLogo} alt={systemName}
                                className="h-5 w-auto object-contain opacity-60" />
                            : <FlaskConical size={16} className="text-blue-400" />
                        }
                        <span>{systemName} — {orgName}</span>
                    </span>
                    <div className="flex gap-6">
                        <Link href="/explore"    className="hover:text-white transition-colors">Explore</Link>
                        <Link href="/repository" className="hover:text-white transition-colors">Repository</Link>
                        <Link href="/tracker"    className="hover:text-white transition-colors">Tracker</Link>
                    </div>
                    <span>{footerText}</span>
                </div>
            </footer>
        </div>
    );
}
