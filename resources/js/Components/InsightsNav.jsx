import { Link, usePage } from '@inertiajs/react';
import { LayoutDashboard, BarChart2, Brain, Activity, Timer, ListChecks, Building2, FileBarChart2, Sliders } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useFeature } from '../hooks/useFeature';
import { canOpenPath } from '../lib/routeAccess';

/** Every page of the Insights area, in the order people usually need them. */
export const INSIGHTS_PAGES = [
    { href: '/insights', label: 'Overview', icon: LayoutDashboard, desc: 'The whole university at a glance.' },
    { href: '/reports', label: 'Reports', icon: BarChart2, feature: 'reports.generate', desc: 'Live reports you can filter, drill into and export.' },
    { href: '/admin/analytics', label: 'Analytics', icon: Brain, feature: 'reports.analytics', desc: 'Submissions, pass rates, funnels, money and call outcomes.' },
    { href: '/admin/proposal-pipeline', label: 'Pipeline', icon: Activity, feature: 'reports.analytics', desc: 'Where every proposal sits right now, across phases.' },
    { href: '/admin/turnaround', label: 'Turnaround', icon: Timer, desc: 'How long each step takes, and where work waits.' },
    { href: '/admin/college-phase-completion', label: 'Phase Completion', icon: ListChecks, feature: 'reports.analytics', desc: 'Blind review and defence completion per college.' },
    { href: '/reports/college-dashboard', label: 'College Dashboard', icon: Building2, desc: 'One college’s proposals, reviews and money.' },
    { href: '/reports/annual', label: 'Annual Report', icon: FileBarChart2, feature: 'reports.generate', desc: 'The year’s RTT report, ready to download.' },
    { href: '/reports/builder', label: 'Report Builder', icon: Sliders, feature: 'reports.generate', desc: 'Group and measure anything for a custom report.' },
];

/** The Insights pages this person can open. */
export function useInsightsPages() {
    const { hasPermission } = useAuth();
    const { hasSubFeature } = useFeature();
    return INSIGHTS_PAGES.filter((p) => canOpenPath(p.href, hasPermission) && (!p.feature || hasSubFeature(p.feature)));
}

/** Tab bar shared by every Insights page, so moving between them never needs the sidebar. */
export default function InsightsNav() {
    const { url } = usePage();
    const pages = useInsightsPages();
    const path = url.split('?')[0];
    // The longest matching href wins, so /reports/annual isn't also "Reports".
    const active = [...pages].sort((a, b) => b.href.length - a.href.length).find((p) => path === p.href || path.startsWith(`${p.href}/`))?.href;

    if (pages.length < 2) return null;

    return (
        <nav aria-label="Insights" className="mx-auto mb-5 max-w-7xl">
            <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0 [scrollbar-width:none]">
                <div className="flex w-max items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
                    <span className="hidden px-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:inline">Insights</span>
                    {pages.map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href}
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition ${active === href ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                            <Icon size={14} /> {label}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
