import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, FlaskConical, FileCheck2, ShieldCheck, LineChart } from 'lucide-react';

const HIGHLIGHTS = [
    { icon: FileCheck2, title: 'Proposals, end to end', text: 'Submit, track and revise from call to completion.' },
    { icon: ShieldCheck, title: 'Fair, blind review', text: 'Structured scoring with a clear audit trail.' },
    { icon: LineChart, title: 'Funding you can follow', text: 'Budgets, milestones and reports in one place.' },
];

/** A faint dot grid that gives the coloured panels some texture. */
const DOTS = { backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)', backgroundSize: '22px 22px' };

function Brand({ logo, name, tagline, width, height, light = true }) {
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            {logo ? (
                <img src={logo} alt={name} style={{ width, height }} className="rounded-lg object-contain shrink-0" />
            ) : (
                <span style={{ width, height }} className="rounded-lg bg-white/20 ring-1 ring-white/25 flex items-center justify-center shrink-0">
                    <FlaskConical size={Math.round(width * 0.5)} className="text-white" />
                </span>
            )}
            <div className="min-w-0">
                <p className={`text-sm font-bold leading-none truncate ${light ? 'text-white' : 'text-gray-900'}`}>{name}</p>
                <p className={`text-[11px] mt-1 truncate ${light ? 'text-white/65' : 'text-gray-400'}`}>{tagline}</p>
            </div>
        </div>
    );
}

export default function GuestLayout({
    children,
    panelHeading  = 'Welcome Back!',
    panelSubtext  = 'Sign in with your institutional credentials to access the research management platform.',
    panelLinkText = null,
    panelLinkHref = null,
    contentWidth  = 'max-w-sm',
    card          = false,
}) {
    const appSettings = usePage().props.app_settings ?? {};

    const systemName      = appSettings.system_name            || 'RTT Platform';
    const systemTagline   = appSettings.system_tagline         || 'Research & Tech Transfer';
    const systemLogo      = appSettings.system_logo            || null;
    const institutionText = appSettings.login_institution_text || 'Haramaya University — Research & Technology Transfer Office';
    const logoW           = parseInt(appSettings.logo_width  || '32', 10);
    const logoH           = parseInt(appSettings.logo_height || '32', 10);
    const panelFrom       = appSettings.auth_panel_from_color || '#047857';
    const panelTo         = appSettings.auth_panel_to_color   || '#0e7490';
    const panelGradient   = `linear-gradient(135deg, ${panelFrom} 0%, color-mix(in srgb, ${panelFrom} 55%, ${panelTo}) 50%, ${panelTo} 100%)`;
    const brand           = { logo: systemLogo, name: systemName, tagline: systemTagline, width: logoW, height: logoH };

    return (
        <div className="min-h-dvh bg-slate-50 flex flex-col lg:flex-row">

            {/* ── Desktop: brand panel ─────────────────────────────────────── */}
            <aside className="hidden lg:flex lg:w-[46%] xl:w-[44%] relative overflow-hidden flex-col justify-between p-10 xl:p-14 text-white shrink-0"
                   style={{ background: panelGradient }}>
                <span className="pointer-events-none absolute inset-0" style={DOTS} />
                <span className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
                <span className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-300/15 blur-3xl" />

                <div className="relative z-10">
                    <Brand {...brand} />
                </div>

                <div className="relative z-10 max-w-md">
                    <h2 className="text-4xl xl:text-[2.75rem] font-extrabold leading-[1.1] tracking-tight">{panelHeading}</h2>
                    <p className="mt-4 text-[15px] text-white/75 leading-relaxed">{panelSubtext}</p>

                    <ul className="mt-10 space-y-5">
                        {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                            <li key={title} className="flex items-start gap-3.5">
                                <span className="h-10 w-10 rounded-xl bg-white/12 ring-1 ring-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                                    <Icon size={18} className="text-white" />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold">{title}</p>
                                    <p className="text-[13px] text-white/65 mt-0.5">{text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative z-10 text-xs text-white/50 leading-snug max-w-md">{institutionText}</p>
            </aside>

            {/* ── Form side ───────────────────────────────────────────────── */}
            <main className="flex flex-1 flex-col min-w-0">

                {/* Mobile: brand hero the card sits on */}
                <header className="lg:hidden relative overflow-hidden text-white px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-20 rounded-b-[2rem]"
                        style={{ background: panelGradient }}>
                    <span className="pointer-events-none absolute inset-0" style={DOTS} />
                    <span className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative z-10 flex items-center justify-between gap-3">
                        <Brand {...brand} />
                        <Link href="/" className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/15 ring-1 ring-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm active:bg-white/25">
                            <ArrowLeft size={13} /> Home
                        </Link>
                    </div>
                    <div className="relative z-10 mt-8">
                        <h2 className="text-[1.65rem] font-extrabold leading-tight tracking-tight">{panelHeading}</h2>
                        <p className="mt-1.5 text-sm text-white/75 leading-relaxed max-w-md">{panelSubtext}</p>
                    </div>
                </header>

                {/* Desktop: slim top bar */}
                <div className="hidden lg:flex items-center justify-between px-10 pt-8 text-sm">
                    <Link href="/" className="inline-flex items-center gap-1.5 font-medium text-gray-500 hover:text-gray-900 transition-colors">
                        <ArrowLeft size={15} /> Back to home
                    </Link>
                    {panelLinkText && panelLinkHref && (
                        <Link href={panelLinkHref} className="rounded-full border border-gray-200 bg-white px-4 py-1.5 font-semibold text-gray-700 shadow-sm hover:border-gray-300 hover:text-gray-900 transition-colors">
                            {panelLinkText}
                        </Link>
                    )}
                </div>

                <div className="flex flex-1 flex-col items-center px-4 sm:px-6 -mt-14 lg:mt-0 lg:justify-center lg:py-10">
                    <div className={`relative z-10 w-full ${contentWidth}`}>
                        {card ? (
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-slate-900/5 px-5 py-7 sm:px-8 sm:py-9">
                                {children}
                            </div>
                        ) : children}
                    </div>
                </div>

                <footer className="px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[11px] text-gray-400 leading-snug">
                    <span className="lg:hidden block mb-1">{institutionText}</span>
                    © {new Date().getFullYear()} {systemName}
                </footer>
            </main>
        </div>
    );
}
