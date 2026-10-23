import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from '@inertiajs/react';
import { ShieldAlert, RefreshCw, Search, AlertTriangle, Eye, CheckCircle2, Clock, Wallet, Gauge, ArrowRight, Download, FileSpreadsheet, FileText, FileType2, ChevronDown, Loader2 } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { useToast } from '../../Components/Toast';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';

const LEVELS = {
    high: { label: 'High risk', stripe: 'bg-red-500', pill: 'bg-red-50 text-red-700 ring-red-200', icon: AlertTriangle },
    watch: { label: 'Watch', stripe: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Eye },
    on_track: { label: 'On track', stripe: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 },
};

const SIGNAL_LABELS = {
    past_end: 'Past end date',
    no_funds: 'No money released',
    behind_schedule: 'Behind schedule',
    reports_overdue: 'Reports overdue',
    overspending: 'Spending ahead of progress',
    slow_spending: 'Little money used late',
    midterm_overdue: 'Midterm overdue',
    no_contract: 'No approved contract',
    no_start: 'No funding date',
};

const DOWNLOADS = [
    { format: 'xlsx', icon: FileSpreadsheet, tone: 'bg-emerald-50 text-emerald-600', label: 'Excel workbook', hint: 'Summary, projects and warnings on separate sheets' },
    { format: 'pdf', icon: FileText, tone: 'bg-red-50 text-red-600', label: 'PDF report', hint: 'Formatted report to print or share' },
    { format: 'csv', icon: FileType2, tone: 'bg-slate-100 text-slate-600', label: 'CSV file', hint: 'Plain data for other tools' },
];

/** Download menu: the list exactly as filtered on the page, in the chosen format. */
function DownloadMenu({ params, count }) {
    const { error } = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(null);
    const ref = useRef(null);

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const download = async (format) => {
        setBusy(format);
        try {
            const query = new URLSearchParams(Object.entries({ ...params, format }).filter(([, v]) => v)).toString();
            const date = new Date().toISOString().slice(0, 10);
            await downloadFile(`/projects-at-risk/export?${query}`, `projects-at-risk-${date}.${format}`);
            setOpen(false);
        } catch (e) {
            error(e.response?.data?.message ?? 'The download failed.');
        }
        setBusy(null);
    };

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
                <Download size={14} /> Download <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <p className="border-b border-gray-100 px-4 py-2.5 text-[11px] text-gray-500">
                        {count} project{count === 1 ? '' : 's'} · current filters applied
                    </p>
                    {DOWNLOADS.map(({ format, icon: Icon, tone, label, hint }) => (
                        <button key={format} onClick={() => download(format)} disabled={!!busy}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                                {busy === format ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-medium text-gray-800">{label}</span>
                                <span className="block text-[11px] text-gray-400">{hint}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function SummaryCard({ level, value, active, onClick }) {
    const tone = {
        all: ['border-gray-300 ring-gray-300', 'text-gray-900', 'bg-gray-100 text-gray-600', ShieldAlert, 'Running projects'],
        high: ['border-red-200 ring-red-200', 'text-red-700', 'bg-red-100 text-red-600', AlertTriangle, 'High risk'],
        watch: ['border-amber-200 ring-amber-200', 'text-amber-700', 'bg-amber-100 text-amber-600', Eye, 'Watch'],
        on_track: ['border-emerald-200 ring-emerald-200', 'text-emerald-700', 'bg-emerald-100 text-emerald-600', CheckCircle2, 'On track'],
    }[level];
    const [border, text, chip, Icon, label] = tone;

    return (
        <button onClick={onClick}
            className={`rounded-2xl border bg-white p-4 text-left transition hover:shadow-sm ${active ? `${border} ring-2 ring-offset-1` : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${chip}`}><Icon size={14} /></span>
            </div>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${text}`}>{value}</p>
        </button>
    );
}

/** A labelled bar; a second marker shows where the project should be (time used). */
function Meter({ icon: Icon, label, value, marker, tone, caption }) {
    return (
        <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 font-medium text-gray-500"><Icon size={11} /> {label}</span>
                <span className="font-semibold tabular-nums text-gray-800">{value == null ? '—' : `${value}%`}</span>
            </div>
            <div className="relative mt-1 h-1.5 rounded-full bg-gray-100">
                {value != null && <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${Math.max(2, value)}%` }} />}
                {marker != null && value != null && (
                    <div className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-gray-500" style={{ left: `calc(${marker}% - 1px)` }} title={`Time used: ${marker}%`} />
                )}
            </div>
            {caption && <p className="mt-1 truncate text-[10px] text-gray-400">{caption}</p>}
        </div>
    );
}

function ProjectCard({ p }) {
    const level = LEVELS[p.level];
    const LevelIcon = level.icon;
    const daysLeft = p.days_left;

    return (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className={`absolute inset-y-0 left-0 w-1 ${level.stripe}`} />
            <div className="p-4 pl-5 sm:p-5 sm:pl-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${level.pill}`}>
                                <LevelIcon size={11} /> {level.label}
                            </span>
                            <span className="font-mono text-[11px] text-gray-400">{p.tracker_number}</span>
                            <span className="text-[11px] text-gray-400">· {getCategoryLabel(p.category)}</span>
                        </div>
                        <Link href={`/proposals/${p.id}`} className="mt-1 block font-semibold leading-snug text-gray-900 hover:text-blue-700">{p.title}</Link>
                        <p className="mt-0.5 text-xs text-gray-500">{[p.pi, p.college].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                        {p.end_date ? (
                            <>
                                <p className={`text-sm font-semibold tabular-nums ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 60 ? 'text-amber-600' : 'text-gray-800'}`}>
                                    {daysLeft < 0 ? `${Math.abs(daysLeft)} days over` : `${daysLeft} days left`}
                                </p>
                                <p className="text-[11px] text-gray-400">{formatDate(p.start_date)} → {formatDate(p.end_date)}</p>
                            </>
                        ) : <p className="text-xs text-gray-400">No timeline</p>}
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Meter icon={Clock} label="Time used" value={p.elapsed_pct} tone="bg-slate-400" caption={`${p.duration_months} month${p.duration_months === 1 ? '' : 's'}`} />
                    <Meter icon={Wallet} label="Money released" value={p.released_pct} marker={p.elapsed_pct} tone="bg-blue-500"
                        caption={p.budget ? `${formatCurrency(p.released)} of ${formatCurrency(p.budget)}` : 'No budget recorded'} />
                    <Meter icon={Gauge} label="Work done (reported)" value={p.reported_progress} marker={p.elapsed_pct} tone="bg-emerald-500"
                        caption={p.last_report_at ? `Last report ${formatDate(p.last_report_at)}` : 'No progress report yet'} />
                </div>

                {p.signals.length > 0 && (
                    <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-3">
                        {p.signals.map((s) => (
                            <li key={s.key} className="flex items-start gap-2 text-xs">
                                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${s.level === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                <span><span className="font-semibold text-gray-800">{s.label}.</span> <span className="text-gray-500">{s.detail}</span></span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

/** Monitoring → running funded projects ranked by the attention they need, with the reasons. */
export default function ProjectsAtRisk() {
    const { error } = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [level, setLevel] = useState('all');
    const [signal, setSignal] = useState(null);
    const [search, setSearch] = useState('');
    const [collegeId, setCollegeId] = useState('');
    const [category, setCategory] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (collegeId) params.college_id = collegeId;
            if (category) params.category = category;
            const res = await get('/projects-at-risk', params);
            setData(res.data);
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not load projects.');
        }
        setLoading(false);
    }, [collegeId, category]);

    useEffect(() => { load(); }, [load]);

    const term = search.trim().toLowerCase();
    const projects = (data?.projects ?? []).filter((p) =>
        (level === 'all' || p.level === level)
        && (!signal || p.signals.some((s) => s.key === signal))
        && (!term || [p.title, p.tracker_number, p.pi, p.college].some((v) => (v ?? '').toLowerCase().includes(term))));
    const summary = data?.summary;
    const signalCounts = Object.entries(summary?.by_signal ?? {}).sort((a, b) => b[1] - a[1]);

    return (
        <AppLayout breadcrumb="Projects at Risk">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100"><ShieldAlert size={20} className="text-red-600" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Projects at Risk</h1>
                            <p className="mt-0.5 text-sm text-gray-500">Running funded projects compared on time used, money released and reported progress.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/ongoing-proposals" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            Ongoing Proposals <ArrowRight size={14} />
                        </Link>
                        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span>
                        </button>
                        {data && (
                            <DownloadMenu count={projects.length}
                                params={{ college_id: collegeId, category, level: level === 'all' ? '' : level, signal, search: search.trim() }} />
                        )}
                    </div>
                </div>

                {loading && !data ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-100" />)}</div>
                ) : (
                    <>
                        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {['all', 'high', 'watch', 'on_track'].map((l) => (
                                <SummaryCard key={l} level={l} value={l === 'all' ? summary?.total ?? 0 : summary?.[l] ?? 0}
                                    active={level === l} onClick={() => setLevel(l)} />
                            ))}
                        </div>

                        {signalCounts.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2">
                                {signalCounts.map(([key, count]) => (
                                    <button key={key} onClick={() => setSignal(signal === key ? null : key)}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${signal === key ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                                        {SIGNAL_LABELS[key] ?? key}
                                        <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${signal === key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                            <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                                <Search size={14} className="text-gray-400" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, tracker number, PI or college…"
                                    className="w-full text-sm focus:outline-none" />
                            </div>
                            {!data?.college_scoped && (
                                <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)}
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200">
                                    <option value="">All colleges</option>
                                    {(data?.colleges ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            <select value={category} onChange={(e) => setCategory(e.target.value)}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200">
                                <option value="">All categories</option>
                                {['research', 'community_engagement', 'technology_transfer'].map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                            </select>
                        </div>

                        {projects.length === 0 ? (
                            <div className="rounded-2xl border border-gray-200 bg-white p-14 text-center">
                                <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
                                <h3 className="mt-3 font-semibold text-gray-700">{summary?.total ? 'No projects match' : 'No running funded projects'}</h3>
                                <p className="mt-1 text-sm text-gray-400">{summary?.total ? 'Try another filter.' : 'Projects appear here once they are funded.'}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
                        )}

                        <p className="mt-5 text-[11px] leading-relaxed text-gray-400">
                            The dark tick on each bar marks the time used — money and work well behind it need attention.
                            High risk: past the end date, no money released after a quarter of the project, progress 40+ points behind time, reports long overdue, or three or more warnings together.
                        </p>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
