import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import {
    FileBarChart2, Download, FileText, BookOpen, TrendingUp, Building2, CheckCircle2, XCircle, ClipboardCheck,
    Layers, Award, Activity, Coins, ArrowDownToLine, Wallet, FlaskConical, Loader2, Megaphone, Percent,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import InsightsNav from '../../Components/InsightsNav';
import { PageHeader, Select, RefreshButton, StatCard, Panel, EmptyState, StatSkeletons, Skeleton } from '../../Components/Insights/Kit';
import { get } from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { useToast } from '../../Components/Toast';

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_AY = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`;

const fmt = (n) => Number(n ?? 0).toLocaleString();
const fmtEtb = (n) => `ETB ${fmt(n)}`;
const titleCase = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const yearLabel = (ay) => ay.replace('-', '–');

const BARS = ['bg-indigo-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-sky-500'];

/** Numbered section heading, like the chapters of the printed report. */
function Section({ number, title, icon, children, className = '' }) {
    return (
        <Panel className={className} icon={icon}
            title={<span className="flex items-center gap-2"><span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600">{number}</span>{title}</span>}>
            {children}
        </Panel>
    );
}

function ShareRow({ label, value, total, bar, icon: Icon }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-gray-700">
                    {Icon && <Icon size={13} className="shrink-0 text-gray-400" />}
                    <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">{fmt(value)} <span className="text-xs font-normal text-gray-400">{pct}%</span></span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export default function AnnualReport() {
    const { error } = useToast();
    const appSettings = usePage().props.app_settings ?? {};
    const orgName = appSettings.organization_name || 'RTT Office';

    const [academicYear, setAcademicYear] = useState(appSettings.current_academic_year || DEFAULT_AY);
    const [years, setYears] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const load = async (ay) => {
        setLoading(true);
        try {
            const r = await get(`/annual-report/preview?academic_year=${ay}`);
            setData(r.data ?? null);
            if (r.meta?.academic_years) setYears(r.meta.academic_years);
        } catch {
            error('Could not load the annual report.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(academicYear); }, [academicYear]); // eslint-disable-line react-hooks/exhaustive-deps

    const download = async () => {
        setDownloading(true);
        try {
            await downloadFile(`/annual-report/download?academic_year=${academicYear}`, `RTT-Annual-Report-${academicYear}.pdf`);
        } catch (e) {
            error(e.response?.data?.message ?? 'The PDF could not be generated. Please try again.');
        }
        setDownloading(false);
    };

    const [ayStart, ayEnd] = academicYear.split('-');
    const yearOptions = [...new Set([academicYear, ...years])].sort().reverse();
    const p = data?.proposals;
    const fundedRate = p?.total > 0 ? Math.round((p.funded / p.total) * 100) : null;

    return (
        <AppLayout breadcrumb="Annual Report">
            <InsightsNav />
            <div className="mx-auto max-w-6xl space-y-6">
                <PageHeader icon={FileBarChart2} color="sky" title="Annual RTT Report"
                    description={`${orgName} · Academic year ${yearLabel(academicYear)} · July ${ayStart} – June ${ayEnd}`}>
                    <Select label="Academic year" value={academicYear} onChange={setAcademicYear}>
                        {yearOptions.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
                    </Select>
                    <RefreshButton onClick={() => load(academicYear)} loading={loading} />
                    <button onClick={download} disabled={downloading || !data}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                        {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {downloading ? 'Preparing PDF…' : 'Download PDF'}
                    </button>
                </PageHeader>

                {loading && !data ? (
                    <div className="space-y-6">
                        <StatSkeletons />
                        <StatSkeletons />
                        <Skeleton className="h-48" />
                    </div>
                ) : data && (
                    <div className={`space-y-6 transition ${loading ? 'opacity-60' : ''}`}>
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <StatCard icon={FileText} color="indigo" label="Proposals submitted" value={fmt(p.total)} hint="Excluding drafts" />
                            <StatCard icon={CheckCircle2} color="emerald" label="Proposals funded" value={fmt(p.funded)} hint={fundedRate != null ? `${fundedRate}% of submitted` : ''} />
                            <StatCard icon={Award} color="violet" label="Completed projects" value={fmt(p.completed)} />
                            <StatCard icon={XCircle} color="red" label="Rejected" value={fmt(p.rejected)} />
                            <StatCard icon={Coins} color="amber" label="Budget allocated" value={fmtEtb(data.finance.allocated)} />
                            <StatCard icon={Percent} color="sky" label="Budget utilization" value={`${data.finance.utilization}%`} hint="Disbursed of allocated" />
                            <StatCard icon={BookOpen} color="violet" label="Research outputs" value={fmt(data.outputs.total)} />
                            <StatCard icon={ClipboardCheck} color="indigo" label="Reviews completed" value={fmt(data.reviews.completed)} hint={`of ${fmt(data.reviews.total)} assigned`} />
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <Section number="01" title="Proposals by category" icon={Layers}>
                                {Object.keys(p.by_category).length === 0 ? <EmptyState icon={Layers} title={`No proposals in ${yearLabel(academicYear)}`} /> : (
                                    <div className="space-y-4">
                                        {Object.entries(p.by_category).map(([cat, count], i) => (
                                            <ShareRow key={cat} label={titleCase(cat)} value={count} total={p.total} bar={BARS[i % BARS.length]} />
                                        ))}
                                    </div>
                                )}
                            </Section>

                            <Section number="02" title="Finance and budget" icon={Wallet}>
                                <div className="space-y-5">
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            [Coins, 'Allocated', data.finance.allocated, 'text-amber-600'],
                                            [ArrowDownToLine, 'Disbursed', data.finance.disbursed, 'text-emerald-600'],
                                            [Wallet, 'Remaining', data.finance.allocated - data.finance.disbursed, 'text-sky-600'],
                                        ].map(([Icon, label, value, tone]) => (
                                            <div key={label} className="rounded-xl border border-gray-100 bg-linear-to-br from-gray-50 to-white p-3">
                                                <Icon size={15} className={tone} />
                                                <p className="mt-2 truncate text-sm font-bold tabular-nums text-gray-900" title={fmtEtb(value)}>{fmtEtb(value)}</p>
                                                <p className="text-[11px] text-gray-500">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <div className="mb-2 flex items-baseline justify-between">
                                            <span className="text-sm text-gray-600">Utilization</span>
                                            <span className="text-xl font-bold tabular-nums text-gray-900">{data.finance.utilization}%</span>
                                        </div>
                                        <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                                            <div className="h-full rounded-full bg-linear-to-r from-amber-500 to-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(data.finance.utilization, 100)}%` }} />
                                        </div>
                                        <div className="mt-1.5 flex justify-between text-[10px] text-gray-400"><span>0%</span><span>50%</span><span>100%</span></div>
                                    </div>
                                </div>
                            </Section>

                            <Section number="03" title="Research outputs" icon={BookOpen}>
                                {data.outputs.total === 0 ? <EmptyState icon={BookOpen} title={`No outputs recorded in ${yearLabel(academicYear)}`} /> : (
                                    <div className="space-y-4">
                                        {Object.entries(data.outputs.by_type).map(([type, count], i) => (
                                            <ShareRow key={type} label={titleCase(type)} value={count} total={data.outputs.total} bar={BARS[i % BARS.length]} icon={FlaskConical} />
                                        ))}
                                    </div>
                                )}
                            </Section>

                            <Section number="04" title="Research impacts" icon={Activity}>
                                {data.impacts.total === 0 ? <EmptyState icon={Activity} title={`No impacts recorded in ${yearLabel(academicYear)}`} /> : (
                                    <div className="space-y-4">
                                        {Object.entries(data.impacts.by_type).map(([type, count], i) => (
                                            <ShareRow key={type} label={titleCase(type)} value={count} total={data.impacts.total} bar={BARS[(i + 2) % BARS.length]} icon={TrendingUp} />
                                        ))}
                                    </div>
                                )}
                            </Section>
                        </div>

                        {data.colleges.length > 0 && (
                            <Section number="05" title="College performance" icon={Building2}>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-120 text-sm">
                                        <thead>
                                            <tr className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                                <th className="pb-2 text-left">College</th>
                                                <th className="w-2/5 pb-2 text-left">Funded share</th>
                                                <th className="pb-2 text-right">Submitted</th>
                                                <th className="pb-2 text-right">Funded</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {data.colleges.map((c, i) => {
                                                const rate = c.submitted > 0 ? Math.round((c.funded / c.submitted) * 100) : 0;
                                                return (
                                                    <tr key={c.name}>
                                                        <td className="py-2.5 pr-3 font-medium text-gray-900">{c.name}</td>
                                                        <td className="py-2.5 pr-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                                                    <div className={`h-full rounded-full ${BARS[i % BARS.length]}`} style={{ width: `${rate}%` }} />
                                                                </div>
                                                                <span className="w-9 text-right text-xs font-semibold tabular-nums text-gray-600">{rate}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 text-right tabular-nums text-gray-700">{c.submitted}</td>
                                                        <td className="py-2.5 text-right font-semibold tabular-nums text-emerald-600">{c.funded}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Section>
                        )}

                        {data.calls.length > 0 && (
                            <Section number="06" title="Proposal calls issued" icon={Megaphone}>
                                <ul className="divide-y divide-gray-100">
                                    {data.calls.map((c, i) => (
                                        <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                            <span className={`h-9 w-1 shrink-0 rounded-full ${BARS[i % BARS.length]}`} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-gray-900">{c.title}</p>
                                                <p className="text-xs text-gray-500">{titleCase(c.category)}</p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
                                                {titleCase(c.status)}
                                            </span>
                                            <span className="hidden w-24 shrink-0 text-right text-xs text-gray-400 sm:block">
                                                {c.end_date ? new Date(c.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        <p className="flex justify-between text-xs text-gray-400">
                            <span>{orgName} · RTT Platform</span>
                            <span>Generated {data.generated_at}</span>
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
