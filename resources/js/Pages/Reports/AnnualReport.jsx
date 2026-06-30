import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import {
    FileBarChart2, Download, RefreshCw, ChevronDown,
    FileText, DollarSign, BookOpen, TrendingUp,
    Building2, CheckCircle2, XCircle, ClipboardCheck,
    Layers, Award, BarChart3, Activity, Coins, ArrowDownToLine,
    Wallet, FlaskConical,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';

// ─── Academic year helpers ─────────────────────────────────────────────────────

function buildAcademicYears(from = 2020, to = 2049) {
    const years = [];
    for (let y = to; y >= from; y--) {
        years.push({ label: `${y}–${y + 1}`, value: `${y}-${y + 1}` });
    }
    return years;
}

const CURRENT_YEAR  = new Date().getFullYear();
const ACADEMIC_YEARS = buildAcademicYears(2020, 2049);
const DEFAULT_AY     = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt       = (n) => Number(n ?? 0).toLocaleString();
const fmtEtb    = (n) => `ETB ${fmt(n)}`;
const titleCase = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const PALETTE = [
    { bg: 'bg-blue-500/15',   text: 'text-blue-400',   bar: 'bg-blue-500',   border: 'border-blue-500/30'   },
    { bg: 'bg-violet-500/15', text: 'text-violet-400', bar: 'bg-violet-500', border: 'border-violet-500/30' },
    { bg: 'bg-amber-500/15',  text: 'text-amber-400',  bar: 'bg-amber-500',  border: 'border-amber-500/30'  },
    { bg: 'bg-emerald-500/15',text: 'text-emerald-400',bar: 'bg-emerald-500',border: 'border-emerald-500/30'},
    { bg: 'bg-rose-500/15',   text: 'text-rose-400',   bar: 'bg-rose-500',   border: 'border-rose-500/30'   },
    { bg: 'bg-cyan-500/15',   text: 'text-cyan-400',   bar: 'bg-cyan-500',   border: 'border-cyan-500/30'   },
];

// ─── Components ───────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, gradient, ring }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 ${ring}`}
            style={{ background: gradient }}>
            <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-white/10">
                    <Icon size={18} className="text-white" />
                </div>
                {sub && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/80 tabular-nums">
                        {sub}
                    </span>
                )}
            </div>
            <div>
                <div className="text-3xl font-bold text-white tracking-tight leading-none">{value}</div>
                <div className="text-sm text-white/65 mt-1.5 leading-snug">{label}</div>
            </div>
            <div className="absolute -right-5 -bottom-5 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
        </div>
    );
}

function Panel({ number, title, icon: Icon, children, className = '' }) {
    return (
        <div className={`rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-800 shadow-sm ${className}`}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700/60 bg-slate-800/80">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-bold ring-1 ring-blue-500/30 shrink-0">
                    {number}
                </span>
                <Icon size={14} className="text-slate-400 shrink-0" />
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    );
}

function CategoryCard({ label, value, total, palette }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className={`flex items-center gap-4 p-4 rounded-xl border ${palette.border} bg-slate-750`} style={{ background: 'rgba(30,41,59,0.8)' }}>
            <div className={`text-2xl font-bold tabular-nums ${palette.text} w-10 shrink-0 text-center`}>{value}</div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">{label}</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${palette.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
            </div>
            <div className={`text-xs font-semibold tabular-nums shrink-0 ${palette.text}`}>{pct}%</div>
        </div>
    );
}

function FinanceStat({ icon: Icon, label, value, colorBg, colorText, colorRing }) {
    return (
        <div className={`flex items-center gap-4 p-4 rounded-xl border ${colorRing}`} style={{ background: 'rgba(30,41,59,0.9)' }}>
            <div className={`p-2.5 rounded-xl bg-white/10 ${colorText}`}>
                <Icon size={18} />
            </div>
            <div>
                <div className={`text-xl font-bold tabular-nums ${colorText}`}>{value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
        </div>
    );
}

function OutputTypeCard({ label, value, total, palette, icon: Icon }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className={`flex items-center justify-between p-3.5 rounded-xl border ${palette.border}`} style={{ background: 'rgba(30,41,59,0.8)' }}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${palette.bg} ${palette.text}`}>
                    <Icon size={14} />
                </div>
                <span className="text-sm text-slate-300">{label}</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-20 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${palette.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-sm font-bold tabular-nums w-6 text-right ${palette.text}`}>{value}</span>
            </div>
        </div>
    );
}

function Empty({ text }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                <FileText size={16} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">{text}</p>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnnualReport() {
    const appSettings  = usePage().props.app_settings ?? {};
    const orgName      = appSettings.organization_name || 'RTT Office';

    const [academicYear, setAcademicYear] = useState(appSettings.current_academic_year || DEFAULT_AY);
    const [data, setData]                 = useState(null);
    const [loading, setLoading]           = useState(false);
    const [downloading, setDownloading]   = useState(false);

    const load = async (ay) => {
        setLoading(true);
        setData(null);
        try {
            const r = await get(`/annual-report/preview?academic_year=${ay}`);
            setData(r.data ?? null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(academicYear); }, [academicYear]);

    const download = async () => {
        setDownloading(true);
        try {
            const token = localStorage.getItem('rtt_token');
            const res   = await fetch(`/api/v1/annual-report/download?academic_year=${academicYear}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            const blob = await res.blob();
            const a    = document.createElement('a');
            a.href     = URL.createObjectURL(blob);
            a.download = `RTT-Annual-Report-${academicYear}.pdf`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (e) {
            console.error('PDF download failed:', e);
        } finally {
            setDownloading(false);
        }
    };

    const ayLabel = ACADEMIC_YEARS.find(y => y.value === academicYear)?.label ?? academicYear;
    const [ayStart, ayEnd] = academicYear.split('-');

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* ── Hero ──────────────────────────────────────────────── */}
                <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-linear-to-br from-blue-950/70 via-slate-900 to-slate-900 px-7 py-6">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-blue-600/8 blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-violet-600/8 blur-2xl" />
                    </div>
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-blue-600/20 ring-1 ring-blue-500/30 shrink-0">
                                <FileBarChart2 size={24} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-blue-400/80 uppercase tracking-[0.15em] mb-1">
                                    {orgName}
                                </p>
                                <h1 className="text-xl font-bold text-white leading-tight">Annual RTT Report</h1>
                                <p className="text-xs text-slate-400 mt-1">
                                    Academic Year {ayLabel} &nbsp;·&nbsp; Jul {ayStart} – Jun {ayEnd}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <div className="relative flex items-center gap-2 bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2 hover:border-white/20 transition-colors">
                                <BarChart3 size={13} className="text-slate-400 shrink-0" />
                                <select
                                    value={academicYear}
                                    onChange={e => setAcademicYear(e.target.value)}
                                    className="bg-transparent text-sm text-white focus:outline-none cursor-pointer appearance-none pr-5"
                                >
                                    {ACADEMIC_YEARS.map(y => (
                                        <option key={y.value} value={y.value}>{y.label}</option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="text-slate-500 absolute right-2.5 pointer-events-none" />
                            </div>

                            <button
                                onClick={() => load(academicYear)}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 text-slate-300 text-sm hover:bg-slate-700 border border-white/8 transition-colors disabled:opacity-40"
                            >
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                                Refresh
                            </button>

                            <button
                                onClick={download}
                                disabled={downloading || !data}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Download size={14} className={downloading ? 'animate-bounce' : ''} />
                                {downloading ? 'Generating…' : 'Download PDF'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Skeleton ──────────────────────────────────────────── */}
                {loading && (
                    <div className="space-y-5 animate-pulse">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-slate-800/50" />)}
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-800/40" />)}
                        </div>
                        {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-slate-800/40" />)}
                    </div>
                )}

                {data && !loading && (
                    <div className="space-y-5">

                        {/* ── KPI row 1 ─────────────────────────────────────── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard icon={FileText}     label="Proposals Submitted" value={fmt(data.proposals.total)}
                                gradient="linear-gradient(135deg,#1e3a8a,#2563eb)" ring="border-blue-700/30" />
                            <KpiCard icon={CheckCircle2} label="Proposals Funded"    value={fmt(data.proposals.funded)}
                                sub={data.proposals.total > 0 ? `${Math.round((data.proposals.funded / data.proposals.total) * 100)}% rate` : null}
                                gradient="linear-gradient(135deg,#064e3b,#059669)" ring="border-emerald-700/30" />
                            <KpiCard icon={Award}        label="Completed Projects"  value={fmt(data.proposals.completed)}
                                gradient="linear-gradient(135deg,#4c1d95,#7c3aed)" ring="border-violet-700/30" />
                            <KpiCard icon={XCircle}      label="Rejected"            value={fmt(data.proposals.rejected)}
                                gradient="linear-gradient(135deg,#7f1d1d,#dc2626)" ring="border-red-800/30" />
                        </div>

                        {/* ── KPI row 2 ─────────────────────────────────────── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard icon={Coins}         label="Budget Allocated"   value={fmtEtb(data.finance.allocated)}
                                gradient="linear-gradient(135deg,#78350f,#d97706)" ring="border-amber-700/30" />
                            <KpiCard icon={TrendingUp}    label="Budget Utilization" value={`${data.finance.utilization}%`}
                                gradient="linear-gradient(135deg,#0c4a6e,#0891b2)" ring="border-cyan-700/30" />
                            <KpiCard icon={BookOpen}      label="Research Outputs"   value={fmt(data.outputs.total)}
                                gradient="linear-gradient(135deg,#3b0764,#9333ea)" ring="border-purple-700/30" />
                            <KpiCard icon={ClipboardCheck} label="Reviews Completed" value={fmt(data.reviews.completed)}
                                sub={`of ${fmt(data.reviews.total)}`}
                                gradient="linear-gradient(135deg,#1e3a5f,#3b82f6)" ring="border-blue-700/30" />
                        </div>

                        {/* ── Section 01: Proposals by Category ─────────────── */}
                        <Panel number="01" title="Proposals by Research Category" icon={Layers}>
                            {Object.keys(data.proposals.by_category).length === 0
                                ? <Empty text={`No proposals submitted in ${ayLabel}.`} />
                                : (
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {Object.entries(data.proposals.by_category).map(([cat, count], i) => (
                                            <CategoryCard
                                                key={cat}
                                                label={titleCase(cat)}
                                                value={count}
                                                total={data.proposals.total}
                                                palette={PALETTE[i % PALETTE.length]}
                                            />
                                        ))}
                                    </div>
                                )
                            }
                        </Panel>

                        {/* ── Section 02: Finance ───────────────────────────── */}
                        <Panel number="02" title="Finance & Budget Summary" icon={DollarSign}>
                            <div className="space-y-5">
                                <div className="grid sm:grid-cols-3 gap-3">
                                    <FinanceStat icon={Coins}          label="Total Allocated" value={fmtEtb(data.finance.allocated)}
                                        colorBg="bg-amber-500/10" colorText="text-amber-400" colorRing="border-amber-500/25" />
                                    <FinanceStat icon={ArrowDownToLine} label="Total Disbursed" value={fmtEtb(data.finance.disbursed)}
                                        colorBg="bg-emerald-500/10" colorText="text-emerald-400" colorRing="border-emerald-500/25" />
                                    <FinanceStat icon={Wallet}          label="Remaining Balance" value={fmtEtb(data.finance.allocated - data.finance.disbursed)}
                                        colorBg="bg-blue-500/10" colorText="text-blue-400" colorRing="border-blue-500/25" />
                                </div>

                                <div className="rounded-xl p-4 border border-slate-700/60" style={{ background: 'rgba(30,41,59,0.9)' }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-slate-400 font-medium">Budget Utilization Rate</span>
                                        <span className="text-2xl font-bold text-amber-400 tabular-nums">{data.finance.utilization}%</span>
                                    </div>
                                    <div className="h-4 rounded-full bg-slate-700/60 overflow-hidden">
                                        <div
                                            className="h-4 rounded-full bg-linear-to-r from-amber-600 to-amber-400 transition-all duration-1000 relative"
                                            style={{ width: `${Math.min(data.finance.utilization, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600 mt-2">
                                        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        {/* ── Section 03 & 04: Outputs + Impacts ────────────── */}
                        <div className="grid sm:grid-cols-2 gap-5">
                            <Panel number="03" title="Research Outputs" icon={BookOpen}>
                                {data.outputs.total === 0
                                    ? <Empty text={`No outputs recorded in ${ayLabel}.`} />
                                    : (
                                        <div className="space-y-2">
                                            {Object.entries(data.outputs.by_type).map(([type, count], i) => (
                                                <OutputTypeCard
                                                    key={type}
                                                    label={titleCase(type)}
                                                    value={count}
                                                    total={data.outputs.total}
                                                    palette={PALETTE[i % PALETTE.length]}
                                                    icon={FlaskConical}
                                                />
                                            ))}
                                        </div>
                                    )
                                }
                            </Panel>

                            <Panel number="04" title="Research Impacts" icon={Activity}>
                                {data.impacts.total === 0
                                    ? <Empty text={`No impacts recorded in ${ayLabel}.`} />
                                    : (
                                        <div className="space-y-2">
                                            {Object.entries(data.impacts.by_type).map(([type, count], i) => (
                                                <OutputTypeCard
                                                    key={type}
                                                    label={titleCase(type)}
                                                    value={count}
                                                    total={data.impacts.total}
                                                    palette={PALETTE[(i + 2) % PALETTE.length]}
                                                    icon={TrendingUp}
                                                />
                                            ))}
                                        </div>
                                    )
                                }
                            </Panel>
                        </div>

                        {/* ── Section 05: College Performance ───────────────── */}
                        {data.colleges.length > 0 && (
                            <Panel number="05" title="College Performance" icon={Building2}>
                                <div className="space-y-2">
                                    {data.colleges.map((c, i) => {
                                        const rate = c.submitted > 0 ? Math.round((c.funded / c.submitted) * 100) : 0;
                                        const pal  = PALETTE[i % PALETTE.length];
                                        return (
                                            <div key={c.name} className={`flex items-center gap-4 p-4 rounded-xl border ${pal.border}`} style={{ background: 'rgba(30,41,59,0.8)' }}>
                                                <div className={`w-1 h-10 rounded-full ${pal.bar} shrink-0`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-slate-200 truncate">{c.name}</div>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                                                            <div className={`h-1.5 rounded-full ${pal.bar}`} style={{ width: `${rate}%` }} />
                                                        </div>
                                                        <span className={`text-xs font-semibold tabular-nums shrink-0 ${pal.text}`}>{rate}% funded</span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-bold text-white tabular-nums">{c.submitted}</div>
                                                    <div className="text-xs text-slate-500">submitted</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className={`text-sm font-bold tabular-nums ${pal.text}`}>{c.funded}</div>
                                                    <div className="text-xs text-slate-500">funded</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Panel>
                        )}

                        {/* ── Section 06: Proposal Calls ────────────────────── */}
                        {data.calls.length > 0 && (
                            <Panel number="06" title="Proposal Calls Issued" icon={FileText}>
                                <div className="space-y-2">
                                    {data.calls.map((c, i) => (
                                        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-slate-700/60 hover:border-slate-600 transition-colors" style={{ background: 'rgba(30,41,59,0.8)' }}>
                                            <div className={`w-1 h-10 rounded-full ${PALETTE[i % PALETTE.length].bar} shrink-0`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-200 truncate">{c.title}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{titleCase(c.category)}</div>
                                            </div>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                                                c.status === 'active'
                                                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                                                    : 'bg-slate-600/30 text-slate-400 ring-1 ring-white/8'
                                            }`}>
                                                {titleCase(c.status)}
                                            </span>
                                            <div className="text-xs text-slate-400 text-right shrink-0">
                                                {c.end_date
                                                    ? new Date(c.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                    : '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        )}

                        <div className="flex items-center justify-between pt-1 pb-2">
                            <span className="text-xs text-slate-600">{orgName} · RTT Platform</span>
                            <span className="text-xs text-slate-600">Generated {data.generated_at}</span>
                        </div>

                    </div>
                )}
            </div>
        </AppLayout>
    );
}
