import { useEffect, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ArrowRight, Search } from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import ProposalCallCard from '../../Components/ProposalCallCard';
import { get } from '../../lib/api';

const STEP_ICONS = ['📝', '✅', '🔍', '🏆'];
const STEPS = [
    { title: 'Submit Proposal', desc: 'Complete the 7-step wizard with your research details, team, and budget.' },
    { title: 'Validation',      desc: 'Central Office reviews completeness and assigns it to the review pipeline.' },
    { title: 'Peer Review & Defence', desc: 'Expert reviewers score your proposal. Top proposals advance to open defence.' },
    { title: 'Funding & Support',     desc: 'Accepted proposals receive funding and ongoing M&E support.' },
];

export default function Home() {
    const [calls, setCalls] = useState([]);
    const [stats, setStats] = useState({});

    const appSettings  = usePage().props.app_settings ?? {};
    const primaryColor = appSettings.primary_color    || '#1d4ed8';
    const orgName      = appSettings.organization_name || 'University';

    useEffect(() => {
        const now = new Date();
        get('/proposal-calls')
            .then((r) => {
                const raw   = r.data?.data ?? r.data ?? [];
                const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
                setCalls(items.filter(c => !c.end_date || new Date(c.end_date) > now).slice(0, 6));
            })
            .catch(() => {});
        get('/stats')
            .then((r) => setStats(r.data ?? {}))
            .catch(() => {});
    }, []);

    return (
        <PublicLayout>
            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden text-white"
                style={{ background: `linear-gradient(135deg, #0f172a 0%, ${primaryColor}cc 60%, #0f172a 100%)` }}>
                {/* Blurred decorative blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10 blur-3xl"
                        style={{ backgroundColor: primaryColor }} />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10 blur-3xl"
                        style={{ backgroundColor: primaryColor }} />
                </div>

                <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-6
                                    border border-white/20 bg-white/10 text-white/80">
                        <span className="w-2 h-2 rounded-full animate-pulse bg-white/60" />
                        {orgName} Research Management Platform
                    </div>

                    <h1 className="text-5xl font-bold leading-tight mb-4 tracking-tight">
                        Turn Research Ideas Into
                        <span className="bg-clip-text text-transparent"
                            style={{ backgroundImage: `linear-gradient(to right, #93c5fd, #67e8f9)` }}>
                            {' '}Funded Reality
                        </span>
                    </h1>

                    <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Submit proposals, track progress, and manage grants —
                        all in one platform built for university excellence.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
                        <a href="/proposal-calls/public"
                            className="inline-flex items-center gap-2 text-white font-semibold px-8 py-3.5
                                       rounded-xl transition-all hover:opacity-90 hover:scale-105 shadow-lg"
                            style={{ backgroundColor: primaryColor }}>
                            View Open Calls <ArrowRight size={18} />
                        </a>
                        <a href="/tracker"
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20
                                       text-white font-semibold px-8 py-3.5 rounded-xl
                                       border border-white/20 transition-all hover:scale-105">
                            <Search size={18} /> Track Your Proposal
                        </a>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
                        {[
                            { label: 'Total Proposals', value: stats.total_proposals ?? '—', icon: '📄' },
                            { label: 'Funded Projects',  value: stats.funded          ?? '—', icon: '🏆' },
                            { label: 'Colleges',         value: stats.colleges        ?? '—', icon: '🏛️' },
                            { label: 'Publications',     value: stats.publications    ?? '—', icon: '📚' },
                        ].map((s) => (
                            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="text-2xl mb-1">{s.icon}</div>
                                <div className="text-2xl font-bold text-white">{s.value}</div>
                                <div className="text-sm text-slate-400">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Open Calls ────────────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-6 py-16">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Open for Applications</h2>
                    <Link href="/proposal-calls/public"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        View all <ArrowRight size={14} />
                    </Link>
                </div>

                {calls.length === 0 ? (
                    <p className="text-gray-500 text-center py-12">No active calls at this time.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {calls.map((call) => (
                            <ProposalCallCard key={call.id} call={call} />
                        ))}
                    </div>
                )}
            </section>

            {/* ── How it works ──────────────────────────────────────────────── */}
            <section className="bg-gray-900 text-white py-16 px-4">
                <div className="max-w-5xl mx-auto text-center mb-12">
                    <h2 className="text-2xl font-bold">How It Works</h2>
                    <p className="text-gray-400 mt-2">Four simple stages from idea to funded research.</p>
                </div>
                <div className="max-w-5xl mx-auto grid sm:grid-cols-2 md:grid-cols-4 gap-8">
                    {STEPS.map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="text-4xl mb-3">{STEP_ICONS[i]}</div>
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">{i + 1}</div>
                            <h3 className="font-semibold mb-2">{s.title}</h3>
                            <p className="text-sm text-gray-400">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </PublicLayout>
    );
}
