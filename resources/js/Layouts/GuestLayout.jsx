import { Link, usePage } from '@inertiajs/react';
import { FlaskConical } from 'lucide-react';

export default function GuestLayout({
    children,
    panelHeading  = 'Welcome Back!',
    panelSubtext  = 'Sign in with your institutional credentials to access the research management platform.',
    panelLinkText = null,
    panelLinkHref = null,
}) {
    const appSettings = usePage().props.app_settings ?? {}

    const systemName         = appSettings.system_name          || 'RTT Platform'
    const systemTagline      = appSettings.system_tagline        || 'Research & Tech Transfer'
    const systemLogo         = appSettings.system_logo           || null
    const institutionText    = appSettings.login_institution_text || 'Haramaya University — Research & Technology Transfer Office'
    const logoW              = parseInt(appSettings.logo_width  || '32', 10)
    const logoH              = parseInt(appSettings.logo_height || '32', 10)
    const panelFrom          = appSettings.auth_panel_from_color || '#047857'
    const panelTo            = appSettings.auth_panel_to_color   || '#0e7490'
    const panelGradient      = `linear-gradient(135deg, ${panelFrom} 0%, color-mix(in srgb, ${panelFrom} 60%, ${panelTo}) 50%, ${panelTo} 100%)`

    return (
        <div className="min-h-screen flex bg-gray-50">

            {/* ── Left branding panel ─────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden
                            flex-col items-center justify-center p-12 text-white shrink-0"
                 style={{ background: panelGradient }}>

                {/* Decorative blobs */}
                <span className="pointer-events-none absolute -top-20 -left-20 h-72 w-72
                                 rounded-full bg-white/5 blur-3xl" />
                <span className="pointer-events-none absolute bottom-0 right-0 h-80 w-80
                                 rounded-full bg-teal-500/20 blur-3xl" />
                <span className="pointer-events-none absolute top-1/3 right-10 h-40 w-40
                                 rounded-full bg-cyan-400/10 blur-2xl" />

                {/* Floating diamond shapes */}
                <span className="absolute top-16 left-16 h-8 w-8 rotate-45 rounded-md
                                 border-2 border-white/20" />
                <span className="absolute bottom-24 left-24 h-5 w-5 rotate-45 rounded-sm
                                 bg-white/15" />
                <span className="absolute top-1/2 right-16 h-6 w-6 rotate-45 rounded-md
                                 border border-white/20" />
                <span className="absolute bottom-40 right-10 h-3 w-3 rotate-45
                                 bg-white/20 rounded-sm" />

                {/* Logo — top-left */}
                <div className="absolute top-8 left-8 flex items-center gap-2.5">
                    {systemLogo ? (
                        <img
                            src={systemLogo}
                            alt={systemName}
                            style={{ width: logoW, height: logoH }}
                            className="rounded-lg object-contain shrink-0"
                        />
                    ) : (
                        <div
                            style={{ width: logoW, height: logoH }}
                            className="rounded-lg bg-white/20 flex items-center justify-center shrink-0"
                        >
                            <FlaskConical size={Math.round(logoW * 0.5)} className="text-white" />
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-bold leading-none">{systemName}</p>
                        <p className="text-[10px] text-white/60 mt-0.5">{systemTagline}</p>
                    </div>
                </div>

                {/* Main panel content */}
                <div className="relative z-10 max-w-xs text-center">
                    <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-white/15
                                    flex items-center justify-center backdrop-blur-sm">
                        <FlaskConical size={30} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-extrabold leading-tight mb-3">
                        {panelHeading}
                    </h2>
                    <p className="text-sm text-white/70 leading-relaxed">
                        {panelSubtext}
                    </p>
                    {panelLinkText && panelLinkHref && (
                        <Link
                            href={panelLinkHref}
                            className="mt-8 inline-flex items-center justify-center px-8 py-2.5
                                       rounded-full border-2 border-white/70 text-sm font-semibold
                                       text-white hover:bg-white hover:text-teal-700
                                       transition-all duration-200"
                        >
                            {panelLinkText}
                        </Link>
                    )}
                </div>

                {/* Institution text — bottom, now from settings */}
                <p className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-white/40 px-6 leading-snug">
                    {institutionText}
                </p>
            </div>

            {/* ── Right form panel ─────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto">

                {/* Mobile-only logo */}
                <div className="lg:hidden mb-8 flex items-center gap-2.5">
                    {systemLogo ? (
                        <img
                            src={systemLogo}
                            alt={systemName}
                            style={{ width: logoW, height: logoH }}
                            className="rounded-lg object-contain"
                        />
                    ) : (
                        <div
                            style={{ width: logoW, height: logoH }}
                            className="rounded-lg bg-teal-600 flex items-center justify-center"
                        >
                            <FlaskConical size={Math.round(logoW * 0.5)} className="text-white" />
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-bold text-gray-900">{systemName}</p>
                        <p className="text-[10px] text-gray-400">{systemTagline}</p>
                    </div>
                </div>

                <div className="w-full max-w-sm">
                    {children}
                </div>
            </div>
        </div>
    )
}
