import { useState, useEffect, useCallback } from 'react';
import { usePage, Link } from '@inertiajs/react';
import {
    BarChart2, RefreshCw, Download, Clock, Sliders, ArrowRight,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { post, get } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { REPORT_META, COLOR_MAP, DownloadExcelButton, renderChart } from '../../Components/Reports/ReportShared';

// ─── Typed report view ────────────────────────────────────────────────────────

function TypedReportView({ type }) {
    const meta = REPORT_META[type];
    const colors = COLOR_MAP[meta?.color ?? 'indigo'];
    const Icon = meta?.icon ?? BarChart2;

    const [snapshot,    setSnapshot]    = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [generating,  setGenerating]  = useState(false);

    const loadLatest = useCallback(async () => {
        setLoading(true);
        try {
            const r = await get('/reports');
            const snaps = r.data?.data ?? [];
            const latest = snaps.filter(s => s.report_type === type && s.status === 'ready')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ?? null;
            setSnapshot(latest);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [type]);

    useEffect(() => { loadLatest(); }, [loadLatest]);

    const generate = async () => {
        setGenerating(true);
        try {
            const r = await post('/reports/generate', { type });
            const snap = r.data?.data ?? r.data;
            if (snap?.status === 'ready') {
                setSnapshot(snap);
            } else {
                // poll every 5 s (max ~2 min) until ready
                let attempts = 0;
                const poll = setInterval(async () => {
                    attempts++;
                    try {
                        const p = await get(`/reports/${snap.id}`);
                        const s = p.data?.data ?? p.data;
                        if (s?.status === 'ready') {
                            setSnapshot(s);
                            clearInterval(poll);
                            setGenerating(false);
                        } else if (s?.status === 'failed') {
                            clearInterval(poll);
                            setGenerating(false);
                        }
                    } catch { clearInterval(poll); setGenerating(false); }
                    if (attempts > 24) { clearInterval(poll); setGenerating(false); }
                }, 5000);
                return;
            }
        } catch (e) {
            alert(e.response?.data?.message ?? 'Report generation failed.');
        }
        setGenerating(false);
    };

    return (
        <div className="space-y-5">
            {/* Header card */}
            <div className={`rounded-2xl p-5 flex items-center justify-between gap-4`}
                style={{ backgroundColor: colors.soft }}>
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.bar + '20' }}>
                        <Icon size={22} style={{ color: colors.bar }} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{meta?.label ?? type}</h2>
                        <p className="text-sm text-gray-500 mt-0.5">{meta?.desc}</p>
                        {snapshot && (
                            <p className="text-xs text-gray-400 mt-1">
                                Last generated: {formatDateTime(snapshot.completed_at ?? snapshot.created_at)}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <DownloadExcelButton snapshot={snapshot} />
                    <button
                        onClick={generate}
                        disabled={generating}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shrink-0"
                        style={{ backgroundColor: colors.bar }}
                    >
                        <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                        {generating ? 'Generating…' : snapshot ? 'Refresh' : 'Generate'}
                    </button>
                </div>
            </div>

            {/* Chart area */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : generating && !snapshot ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <RefreshCw size={36} className="mb-3 animate-spin text-indigo-500" />
                        <p className="text-sm font-medium">Generating report…</p>
                    </div>
                ) : !snapshot ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Icon size={40} className="mb-3 opacity-40" />
                        <p className="text-sm font-medium text-gray-500">No report generated yet</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Generate" to create this report</p>
                    </div>
                ) : (
                    renderChart(type, snapshot.result)
                )}
            </div>
        </div>
    );
}

// ─── Generate & history view ──────────────────────────────────────────────────

function GenerateView() {
    const [snapshots,  setSnapshots]  = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [type,       setType]       = useState('proposal_count_by_category');
    const [generating, setGenerating] = useState(false);
    const [selected,   setSelected]   = useState(null);

    const load = useCallback(() =>
        get('/reports')
            .then(r => setSnapshots(r.data?.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false)),
    []);

    useEffect(() => { load(); }, [load]);

    const generateFixed = async () => {
        setGenerating(true);
        try {
            const res = await post('/reports/generate', { type });
            await load();
            setSelected(res.data?.data ?? res.data ?? null);
        } catch (e) {
            alert(e.response?.data?.message ?? 'Generation failed.');
        }
        setGenerating(false);
    };

    const quickReportTypes = Object.entries(REPORT_META).filter(([v]) => v !== 'custom_builder');

    return (
        <div className="space-y-6">

            {/* ── Report Builder promo ── */}
            <Link
                href="/reports/builder"
                className="group flex items-center gap-5 rounded-2xl border border-slate-200 bg-linear-to-r from-slate-800 to-slate-700 px-6 py-5 shadow-sm hover:shadow-md transition-shadow"
            >
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Sliders size={22} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-white">Report Builder</h2>
                    <p className="text-xs text-slate-300 mt-0.5">Pick a subject, choose what to group by and measure, and build your own report</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-white shrink-0 group-hover:gap-2.5 transition-all">
                    Open <ArrowRight size={16} />
                </div>
            </Link>

            {/* ── Quick reports + history ── */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* Quick reports panel */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 lg:col-span-1">
                    <div>
                        <div className="flex items-center gap-3">
                            <BarChart2 size={18} className="text-purple-600" />
                            <h2 className="text-sm font-bold text-gray-800">Quick Reports</h2>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Pre-configured reports — one click to generate</p>
                    </div>

                    <div className="space-y-2">
                        {quickReportTypes.map(([value, meta]) => {
                            const Icon = meta.icon;
                            const colors = COLOR_MAP[meta.color];
                            return (
                                <label key={value} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border-2 transition-all ${type === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                                    <input type="radio" name="report_type" value={value} checked={type === value} onChange={() => setType(value)} className="hidden" />
                                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.soft }}>
                                        <Icon size={13} style={{ color: colors.bar }} />
                                    </div>
                                    <p className="text-xs font-medium text-gray-800">{meta.label}</p>
                                </label>
                            );
                        })}
                    </div>

                    <button
                        onClick={generateFixed}
                        disabled={generating}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                    >
                        {generating ? <><RefreshCw size={14} className="animate-spin" /> Generating…</> : 'Generate Report'}
                    </button>
                </div>

                {/* History */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-gray-800">Report History</h2>
                        <button onClick={load} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                            <RefreshCw size={11} /> Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : snapshots.length === 0 ? (
                        <div className="py-12 text-center text-gray-400">
                            <Download size={32} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No reports generated yet</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {snapshots.map(s => {
                                const meta   = REPORT_META[s.report_type];
                                const colors = COLOR_MAP[meta?.color ?? 'indigo'];
                                const Icon   = meta?.icon ?? BarChart2;
                                return (
                                    <li key={s.id}
                                        className={`flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer transition-all hover:shadow-sm ${selected?.id === s.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-100 bg-white'}`}
                                        onClick={() => setSelected(selected?.id === s.id ? null : s)}>
                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: colors.soft }}>
                                            <Icon size={14} style={{ color: colors.bar }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800">{meta?.label ?? s.report_type}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Clock size={10} className="text-gray-400" />
                                                <p className="text-xs text-gray-400">{formatDateTime(s.completed_at ?? s.created_at)}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                            s.status === 'ready'      ? 'bg-green-100 text-green-700' :
                                            s.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>{s.status}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {selected?.result && (
                        <div className="mt-4 rounded-xl border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    {REPORT_META[selected.report_type]?.label ?? selected.report_type}
                                </p>
                                <DownloadExcelButton snapshot={selected} className="py-1.5 px-3 text-xs" />
                            </div>
                            {renderChart(selected.report_type, selected.result)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsIndex() {
    const { url } = usePage();
    const typeParam = new URLSearchParams(url.split('?')[1] ?? '').get('type');

    // Quick-link chips at the top
    const quickLinks = [
        { label: 'Generate',            href: '/reports' },
        { label: 'Proposal Statistics', href: '/reports?type=proposal_count_by_category' },
        { label: 'College Performance', href: '/reports?type=college_performance' },
        { label: 'Reviewer Workload',   href: '/reports?type=reviewer_workload' },
        { label: 'Budget Utilization',  href: '/reports?type=budget_utilization' },
        { label: 'Complaints Summary',  href: '/reports?type=complaint_summary' },
    ];

    const currentMeta = typeParam ? REPORT_META[typeParam] : null;
    const Icon = currentMeta?.icon ?? BarChart2;

    return (
        <AppLayout breadcrumb={currentMeta?.label ?? 'Reports'}>
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Page header */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Icon size={24} className="text-indigo-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{currentMeta?.label ?? 'Reports'}</h1>
                            {currentMeta && (
                                <p className="text-sm text-gray-500 mt-0.5">{currentMeta.desc}</p>
                            )}
                        </div>
                    </div>
                    <a
                        href="/api/v1/reports/proposals/export"
                        download
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Download size={14} /> Export CSV
                    </a>
                </div>

                {/* Navigation chips — use Inertia Link to avoid full page reloads */}
                <div className="flex flex-wrap gap-2">
                    {quickLinks.map(l => {
                        const isActive = typeParam
                            ? l.href.includes(typeParam)
                            : l.href === '/reports';
                        return (
                            <Link
                                key={l.href}
                                href={l.href}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                    isActive
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {l.label}
                            </Link>
                        );
                    })}
                    <Link
                        href="/reports/builder"
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-700 text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
                    >
                        <Sliders size={11} /> Report Builder
                    </Link>
                </div>

                {/* Content */}
                {typeParam ? (
                    <TypedReportView key={typeParam} type={typeParam} />
                ) : (
                    <GenerateView />
                )}
            </div>
        </AppLayout>
    );
}
