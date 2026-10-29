import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
    Sliders, RefreshCw, Clock, Layers, Wand2, RotateCcw, Check,
    BarChart3, Table2, ArrowUpDown, ArrowUp, ArrowDown, History, Copy, Lock, Sparkles, Rows3,
    Plus, X, ChevronDown, Search,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import InsightsNav from '../../Components/InsightsNav';
import { PageHeader, CHART } from '../../Components/Insights/Kit';
import { post, get } from '../../lib/api';
import { programmes } from '../../lib/programmes';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDateTime, getStatusLabel } from '../../lib/utils';
import { DownloadExcelButton, builderLabel, SubjectIcon } from '../../Components/Reports/ReportShared';
import { useToast } from '../../Components/Toast';
import { term } from '../../lib/terms';

const SUBJECT_INFO = {
    proposals: { blurb: 'Submissions, funding and rejections across colleges and years.', tone: 'from-indigo-500 to-violet-600' },
    complaints: { blurb: 'Complaints raised, their type, level and how fast they were resolved.', tone: 'from-rose-500 to-orange-500' },
    review_workload: { blurb: 'Review assignments per reviewer and how long reviews take.', tone: 'from-emerald-500 to-teal-600' },
};

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const categoryOptions = () => programmes({ includeInactive: true }).map((p) => ({ value: p.key, label: p.name }));

const LEVEL_OPTIONS = [
    { value: 'college', label: 'College (Level 1)' },
    { value: 'officer', label: 'Officer (Level 2)' },
];

const COMPLAINT_TYPE_OPTIONS = [
    { value: 'budget', label: 'Budget' },
    { value: 'rejection', label: 'Rejection' },
    { value: 'other', label: 'Other' },
];

const PROPOSAL_STATUSES = [
    'draft', 'submitted', 'validated', 'under_blind_review', 'blind_review_passed',
    'under_open_defence', 'accepted', 'funded', 'midterm_evaluation', 'completed',
    'archived', 'rejected',
];
const COMPLAINT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'];
const REVIEW_STATUSES = ['pending', 'accepted', 'in_progress', 'submitted', 'declined', 'overdue', 'reassigned', 'completed'];

const STATUS_OPTIONS_BY_SUBJECT = {
    proposals: PROPOSAL_STATUSES.map(s => ({ value: s, label: getStatusLabel(s) })),
    complaints: COMPLAINT_STATUSES.map(s => ({ value: s, label: builderLabel(s) })),
    review_workload: REVIEW_STATUSES.map(s => ({ value: s, label: builderLabel(s) })),
};

/** Rates and averages are averaged in the totals, never added up. */
const isAverage = (metric) => metric.startsWith('avg_') || metric.endsWith('_rate');

const MONTH_DIMENSIONS = ['submitted_month', 'raised_month', 'assigned_month'];
const STATIC_LABELS = {
    pi_gender: { female: 'Female', male: 'Male' },
    review_type: { blind_review: 'Blind review', open_defence: 'Open defence', other: 'Other' },
    reviewer_kind: { internal: 'Internal', external: 'External' },
};

/** The value of a grouping field as a person reads it. */
function displayValue(dimension, value) {
    if (value === null || value === undefined || value === '') return dimension === 'pi_gender' ? 'Not stated' : '—';
    if (dimension === 'status') return getStatusLabel(value);
    if (dimension === 'category') return categoryOptions().find(o => o.value === value)?.label ?? builderLabel(String(value));
    if (STATIC_LABELS[dimension]) return STATIC_LABELS[dimension][value] ?? builderLabel(String(value));
    if (dimension === 'level' || dimension === 'complaint_type') return builderLabel(String(value));
    if (MONTH_DIMENSIONS.includes(dimension)) {
        const [y, m] = String(value).split('-').map(Number);
        return y && m ? new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : String(value);
    }
    return String(value);
}

const formatNumber = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }));

/** A measure as a person reads it: 64.5%, ETB 1,200,000, 12. */
function formatMetric(metric, n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    if (metric.endsWith('_rate')) return `${formatNumber(n)}%`;
    if (metric.endsWith('_budget')) return formatCurrency(Math.round(Number(n))).replace(/\.00$/, '');
    return formatNumber(n);
}

/** "Proposals by College and Status" */
function describe(subject, dimensions = []) {
    const head = builderLabel(subject || 'Report');
    return dimensions.length ? `${head} by ${dimensions.map(builderLabel).join(' and ')}` : head;
}

/** The choices for one filter, as [{ value, label, group? }]. */
function filterChoices(filterKey, subject, { colleges, years, choices, selectedColleges }) {
    switch (filterKey) {
        case 'college_id': return colleges.map(c => ({ value: String(c.id), label: c.name }));
        case 'academic_year': return years.map(y => ({ value: String(y), label: String(y) }));
        case 'category': return categoryOptions();
        case 'status': return STATUS_OPTIONS_BY_SUBJECT[subject] ?? [];
        case 'level': return LEVEL_OPTIONS;
        case 'complaint_type': return COMPLAINT_TYPE_OPTIONS;
        case 'department_id': {
            // With colleges chosen, offer only their departments.
            const names = colleges.filter(c => selectedColleges.includes(String(c.id))).map(c => c.name);
            const all = choices.department_id ?? [];
            return names.length ? all.filter(d => names.includes(d.group)) : all;
        }
        default: return choices[filterKey] ?? [];
    }
}

const FILTER_NOUN = {
    college_id: 'colleges', department_id: 'departments', academic_year: 'years', category: 'categories', status: 'statuses',
    level: 'levels', complaint_type: 'types', proposal_call_id: 'calls', research_type: 'research types', focus_area: 'focus areas',
    pi_gender: 'genders', review_type: 'review types', reviewer_kind: 'reviewers',
};

/** The order filters are offered in: the most used first. */
const FILTER_ORDER = ['college_id', 'department_id', 'academic_year', 'category', 'status', 'proposal_call_id', 'review_type', 'reviewer_kind', 'level', 'complaint_type', 'research_type', 'focus_area', 'pi_gender'];
const PRIMARY_FILTERS = 5;

/**
 * A filter chip — "College · All" — and the panel it opens. On a phone the
 * panel slides up from the bottom.
 */
function ChipShell({ label, active, summary, onClear, panelLabel, panelClass = 'sm:w-72', children, footer }) {
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
    }, [open]);

    return (
        <div ref={boxRef} className="relative">
            <span className={`inline-flex h-9 items-center rounded-full border text-xs font-medium transition ${active ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-dashed border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50'}`}>
                <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="dialog"
                    className="inline-flex h-full items-center gap-1.5 pl-3 pr-2.5">
                    {!active && <Plus size={13} className="text-gray-400" />}
                    {label}
                    <span className={active ? 'text-indigo-300' : 'text-gray-300'}>·</span>
                    <span className={`max-w-36 truncate font-semibold ${active ? 'text-indigo-700' : 'text-gray-800'}`}>{summary}</span>
                    <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''} ${active ? 'text-indigo-400' : 'text-gray-400'}`} />
                </button>
                {active && (
                    <button type="button" onClick={onClear} aria-label={`Clear ${label}`}
                        className="mr-1 flex h-6 w-6 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700">
                        <X size={13} />
                    </button>
                )}
            </span>

            {open && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={() => setOpen(false)} />
                    <div role="dialog" aria-label={panelLabel ?? label}
                        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:max-h-96 sm:rounded-xl ${panelClass}`}>
                        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
                        <div className="flex items-center justify-between px-4 pb-1 pt-3 sm:hidden">
                            <p className="text-sm font-semibold text-gray-900">{label}</p>
                            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-sm font-semibold text-indigo-600">Done</button>
                        </div>
                        {children}
                        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                            <span className="text-xs text-gray-500">{footer}</span>
                            <div className="flex gap-1">
                                {active && <button type="button" onClick={onClear} className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100">Clear</button>}
                                <button type="button" onClick={() => setOpen(false)} className="hidden rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 sm:block">Done</button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/** A searchable list where several values can be ticked, grouped when the values have groups. */
function FilterChip({ filterKey, label, choices, selected, onChange, locked }) {
    const [query, setQuery] = useState('');

    if (locked) {
        return (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-500" title="You can only report on your own college">
                <Lock size={12} /> {label} · <span className="max-w-40 truncate font-semibold text-gray-700">{locked}</span>
            </span>
        );
    }

    const active = selected.length > 0;
    const names = selected.map(v => choices.find(c => c.value === v)?.label ?? v);
    const summary = !active ? 'All' : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
    const needle = query.trim().toLowerCase();
    const visible = needle ? choices.filter(c => `${c.label} ${c.group ?? ''}`.toLowerCase().includes(needle)) : choices;
    const toggle = (value) => onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
    const allVisibleOn = visible.length > 0 && visible.every(c => selected.includes(c.value));
    const toggleVisible = () => onChange(allVisibleOn
        ? selected.filter(v => !visible.some(c => c.value === v))
        : [...new Set([...selected, ...visible.map(c => c.value)])]);

    return (
        <ChipShell label={label} active={active} summary={summary} onClear={() => onChange([])}
            footer={active ? `${selected.length} selected` : `All ${FILTER_NOUN[filterKey] ?? ''}`}>
            {choices.length > 6 && (
                <div className="border-b border-gray-100 p-2">
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 focus-within:ring-2 focus-within:ring-indigo-200">
                        <Search size={14} className="text-gray-400" />
                        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${FILTER_NOUN[filterKey] ?? label.toLowerCase()}…`}
                            className="h-9 flex-1 bg-transparent text-base outline-none sm:text-sm" />
                    </div>
                </div>
            )}
            <ul role="listbox" aria-multiselectable="true" className="flex-1 overflow-y-auto p-1.5">
                {choices.length === 0 && <li className="px-3 py-6 text-center text-xs text-gray-400">Nothing to choose from yet</li>}
                {choices.length > 0 && visible.length === 0 && <li className="px-3 py-6 text-center text-xs text-gray-400">No matches</li>}
                {visible.length > 3 && (
                    <li>
                        <button type="button" onClick={toggleVisible} className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
                            {allVisibleOn ? 'Untick these' : needle ? `Tick all ${visible.length} matches` : 'Tick all'}
                        </button>
                    </li>
                )}
                {visible.map((c, i) => {
                    const on = selected.includes(c.value);
                    const heading = c.group && c.group !== visible[i - 1]?.group;
                    return (
                        <li key={c.value}>
                            {heading && <p className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{c.group}</p>}
                            <button type="button" role="option" aria-selected={on} onClick={() => toggle(c.value)}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition sm:py-2 ${on ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                    {on && <Check size={11} strokeWidth={3.5} />}
                                </span>
                                <span className="truncate">{c.label}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </ChipShell>
    );
}

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Quick ranges, worked out from today. */
function datePresets() {
    const today = new Date();
    const y = today.getFullYear();
    const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return isoDay(d); };
    return [
        { key: '30d', label: 'Last 30 days', from: daysAgo(30), to: isoDay(today) },
        { key: '90d', label: 'Last 3 months', from: daysAgo(90), to: isoDay(today) },
        { key: '12m', label: 'Last 12 months', from: daysAgo(365), to: isoDay(today) },
        { key: 'ytd', label: 'This year', from: `${y}-01-01`, to: isoDay(today) },
        { key: 'last_year', label: 'Last year', from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    ];
}

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function describeRange(range) {
    if (!range?.from && !range?.to) return 'Any time';
    const preset = datePresets().find(p => p.from === range.from && p.to === range.to);
    if (preset) return preset.label;
    if (range.from && range.to) return `${shortDate(range.from)} – ${shortDate(range.to)}`;
    return range.from ? `From ${shortDate(range.from)}` : `Until ${shortDate(range.to)}`;
}

/** "Submitted · Any time" with quick ranges and custom from/to dates. */
function DateRangeChip({ label, value, onChange }) {
    const range = value ?? {};
    const active = Boolean(range.from || range.to);
    const presets = datePresets();
    const input = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-base text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:h-9 sm:text-sm';

    return (
        <ChipShell label={label} active={active} summary={describeRange(range)} onClear={() => onChange(null)} panelClass="sm:w-80"
            footer={active ? describeRange(range) : 'Any time'}>
            <div className="overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-1.5">
                    {presets.map(p => {
                        const on = range.from === p.from && range.to === p.to;
                        return (
                            <button key={p.key} type="button" onClick={() => onChange({ from: p.from, to: p.to })}
                                className={`rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
                                {p.label}
                            </button>
                        );
                    })}
                </div>
                <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Custom range</p>
                <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                        <span className="mb-1 block text-xs text-gray-500">From</span>
                        <input type="date" value={range.from ?? ''} max={range.to || undefined}
                            onChange={e => onChange({ ...range, from: e.target.value || undefined })} className={input} />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs text-gray-500">To</span>
                        <input type="date" value={range.to ?? ''} min={range.from || undefined}
                            onChange={e => onChange({ ...range, to: e.target.value || undefined })} className={input} />
                    </label>
                </div>
            </div>
        </ChipShell>
    );
}

/** One numbered step of the builder, with a line joining it to the next. */
function Step({ n, title, hint, done, last = false, aside, children }) {
    return (
        <section className="relative flex gap-4">
            {!last && <span aria-hidden className="absolute left-3.75 top-9 bottom-0 w-px bg-gray-200" />}
            <span className={`relative z-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white transition ${done ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {done ? <Check size={15} strokeWidth={3} /> : n}
            </span>
            <div className={`min-w-0 flex-1 ${last ? '' : 'pb-7'}`}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
                    </div>
                    {aside}
                </div>
                <div className="mt-3">{children}</div>
            </div>
        </section>
    );
}

function Chip({ active, onClick, children, order }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${active
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
            {active && (order ? <span className="flex h-4 w-4 items-center justify-center rounded bg-white/25 text-[10px]">{order}</span> : <Check size={13} strokeWidth={3} />)}
            {children}
        </button>
    );
}

/** What a measure counts in — a chart only puts measures of one kind on its axis. */
const metricKind = (m) => (m.endsWith('_budget') ? 'money' : m.endsWith('_rate') ? 'percent' : m.startsWith('avg_') ? 'days' : 'count');

/** A bar chart when the result is grouped by exactly one field. */
function ResultChart({ data }) {
    const dims = data?.dimensions ?? [];
    const rows = data?.rows ?? [];
    const numeric = (data?.metrics ?? []).filter((m) => rows.some((r) => r[m] != null && !Number.isNaN(Number(r[m]))));
    if (dims.length !== 1 || numeric.length === 0 || rows.length < 1 || rows.length > 40) return null;

    // One kind of measure per chart (never counts and money on one axis); the rest stay in the table.
    const kind = metricKind(numeric[0]);
    const metrics = numeric.filter(m => metricKind(m) === kind);
    const left = numeric.filter(m => metricKind(m) !== kind);

    const dim = dims[0];
    const ordered = MONTH_DIMENSIONS.includes(dim) ? [...rows].sort((a, b) => String(a[dim] ?? '').localeCompare(String(b[dim] ?? ''))) : rows;
    const chartRows = ordered.map((r) => ({ name: displayValue(dim, r[dim]), ...Object.fromEntries(metrics.map((m) => [m, Number(r[m] ?? 0)])) }));
    const tick = (v) => (kind === 'money' ? Number(v).toLocaleString(undefined, { notation: 'compact' }) : kind === 'percent' ? `${v}%` : v);
    const tooltip = { ...CHART.tooltip, formatter: (v, name, item) => [formatMetric(item.dataKey, v), name] };
    // Many or long names read better as horizontal bars.
    const horizontal = chartRows.length > 8 || chartRows.some(r => r.name.length > 18);
    const height = horizontal ? Math.max(260, chartRows.length * (metrics.length > 1 ? 44 : 34) + 40) : 320;

    return (
        <div>
            <ResponsiveContainer width="100%" height={height}>
                {horizontal ? (
                    <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                        <CartesianGrid {...CHART.grid} horizontal={false} vertical />
                        <XAxis type="number" allowDecimals={false} tickFormatter={tick} {...CHART.axis} />
                        <YAxis type="category" dataKey="name" width={150} {...CHART.yAxis} tick={{ fontSize: 11, fill: '#4b5563' }} />
                        <Tooltip {...tooltip} />
                        {metrics.length > 1 && <Legend {...CHART.legend} />}
                        {metrics.map((m, i) => <Bar key={m} dataKey={m} name={builderLabel(m)} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} maxBarSize={22} />)}
                    </BarChart>
                ) : (
                    <BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid {...CHART.grid} />
                        <XAxis dataKey="name" {...CHART.axis} tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} />
                        <YAxis allowDecimals={false} tickFormatter={tick} {...CHART.yAxis} width={kind === 'money' ? 56 : 40} />
                        <Tooltip {...tooltip} />
                        {metrics.length > 1 && <Legend {...CHART.legend} />}
                        {metrics.map((m, i) => <Bar key={m} dataKey={m} name={builderLabel(m)} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={48} />)}
                    </BarChart>
                )}
            </ResponsiveContainer>
            {left.length > 0 && <p className="mt-2 text-xs text-gray-400">{left.map(builderLabel).join(', ')} {left.length === 1 ? 'is' : 'are'} measured differently — see the table.</p>}
        </div>
    );
}

/** The result as a sortable table with a totals row. */
function ResultTable({ data, totals }) {
    const dimensions = data?.dimensions ?? [];
    const metrics = data?.metrics ?? [];
    const rows = data?.rows ?? [];
    const [sort, setSort] = useState({ key: null, dir: 'desc' });

    const sorted = useMemo(() => {
        if (!sort.key) return rows;
        const numeric = metrics.includes(sort.key);
        return [...rows].sort((a, b) => {
            const x = numeric ? Number(a[sort.key] ?? -Infinity) : displayValue(sort.key, a[sort.key]);
            const y = numeric ? Number(b[sort.key] ?? -Infinity) : displayValue(sort.key, b[sort.key]);
            const c = numeric ? x - y : String(x).localeCompare(String(y));
            return sort.dir === 'asc' ? c : -c;
        });
    }, [rows, sort, metrics]);

    const toggle = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: metrics.includes(key) ? 'desc' : 'asc' });
    const SortIcon = ({ k }) => sort.key !== k ? <ArrowUpDown size={12} className="opacity-40" /> : sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;

    return (
        <div className="max-h-128 overflow-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-120 text-sm">
                <thead className="sticky top-0 z-1 bg-gray-50 text-xs text-gray-500">
                    <tr>
                        <th className="w-10 px-3 py-2.5 text-left font-medium">#</th>
                        {[...dimensions, ...metrics].map(col => (
                            <th key={col} className={`px-3 py-2.5 font-medium ${metrics.includes(col) ? 'text-right' : 'text-left'}`}>
                                <button type="button" onClick={() => toggle(col)} className={`inline-flex items-center gap-1 hover:text-gray-900 ${sort.key === col ? 'text-gray-900' : ''}`}>
                                    {builderLabel(col)} <SortIcon k={col} />
                                </button>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {sorted.map((r, i) => (
                        <tr key={i} className="hover:bg-indigo-50/40">
                            <td className="px-3 py-2.5 text-xs tabular-nums text-gray-400">{i + 1}</td>
                            {dimensions.map(d => <td key={d} className="px-3 py-2.5 text-gray-800">{displayValue(d, r[d])}</td>)}
                            {metrics.map(m => <td key={m} className="px-3 py-2.5 text-right font-medium tabular-nums text-gray-900">{formatMetric(m, r[m])}</td>)}
                        </tr>
                    ))}
                </tbody>
                {dimensions.length > 0 && rows.length > 1 && (
                    <tfoot className="sticky bottom-0 bg-gray-50 text-sm font-semibold text-gray-900">
                        <tr className="border-t border-gray-200">
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5" colSpan={dimensions.length}>Total</td>
                            {metrics.map(m => <td key={m} className="px-3 py-2.5 text-right tabular-nums">{formatMetric(m, totals[m])}{isAverage(m) && <span className="ml-1 text-[10px] font-normal text-gray-400">avg</span>}</td>)}
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}

export default function ReportBuilder() {
    const { error: toastError, success } = useToast();
    const { user: currentUser, accessScope } = useAuth();
    const isCollegeOfficer = accessScope?.type === 'college';
    const [options,      setOptions]      = useState(null);
    const [optionsError, setOptionsError] = useState(null);
    const [subject,      setSubject]      = useState('');
    const [dimensions,   setDimensions]   = useState([]);
    const [metrics,      setMetrics]      = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [generating,   setGenerating]   = useState(false);
    const [result,       setResult]       = useState(null);
    const [view,         setView]         = useState('chart');
    const [choices,      setChoices]      = useState({});
    const [moreFilters,  setMoreFilters]  = useState(false);

    const [colleges,       setColleges]       = useState([]);
    const [years,          setYears]          = useState([]);
    const [history,        setHistory]        = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const resultRef = useRef(null);

    useEffect(() => {
        get('/reports/builder-options')
            .then(r => { setOptions(r.data ?? {}); setChoices(r.meta?.choices ?? {}); })
            .catch(e => {
                setOptions({});
                setOptionsError(
                    e.response?.status === 403
                        ? "You don't have permission to use the Report Builder."
                        : 'Could not load report subjects. Please refresh and try again.'
                );
            });
        get('/colleges').then(r => setColleges(r.data ?? [])).catch(() => {});
        // Only years that actually have proposals.
        get('/reports/live-options').then(r => setYears(r.data?.years ?? [])).catch(() => {});
    }, []);

    const loadHistory = useCallback(() => {
        setHistoryLoading(true);
        return get('/reports')
            .then(r => setHistory((r.data?.data ?? []).filter(s => s.report_type === 'custom_builder')))
            .catch(() => {})
            .finally(() => setHistoryLoading(false));
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const lockedCollege = isCollegeOfficer ? colleges.find(c => c.id === currentUser?.college_id) : null;
    const subjectOptions = subject && options ? options[subject] : null;
    const hasValue = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v?.from || v?.to));
    const activeFilters = Object.fromEntries(Object.entries(filterValues).filter(([, v]) => hasValue(v)));
    const filterCount = Object.keys(activeFilters).length;
    const ready = Boolean(subject) && metrics.length > 0;

    const chooseSubject = (s) => {
        setSubject(s);
        setDimensions([]);
        setFilterValues({});
        setMoreFilters(false);
        const m = options?.[s]?.metrics ?? [];
        setMetrics(m.includes('count') ? ['count'] : []);
    };

    const toggleIn = (list, setList, value) => setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
    const setFilterValue = (key, value) => setFilterValues(prev => ({ ...prev, [key]: value }));

    const generate = async () => {
        setGenerating(true);
        try {
            const res = await post('/reports/generate', {
                type: 'custom_builder',
                filters: { subject, dimensions, metrics, ...activeFilters },
            });
            setResult(res.data?.data ?? res.data ?? null);
            setView('chart');
            loadHistory();
            // On a phone the result sits below the builder.
            if (window.matchMedia('(max-width: 1023px)').matches) {
                setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
            }
        } catch (e) {
            toastError(e.response?.data?.message ?? 'Generation failed.');
        }
        setGenerating(false);
    };

    const reset = () => {
        setSubject('');
        setDimensions([]);
        setMetrics([]);
        setFilterValues({});
        setResult(null);
    };

    /** Put a past report's settings back into the builder. */
    const reuse = (snapshot) => {
        const f = snapshot.filters ?? {};
        const s = f.subject ?? snapshot.result?.subject;
        if (!s || !options?.[s]) return;
        setSubject(s);
        setDimensions((f.dimensions ?? snapshot.result?.dimensions ?? []).filter(d => options[s].dimensions.includes(d)));
        setMetrics((f.metrics ?? snapshot.result?.metrics ?? []).filter(m => options[s].metrics.includes(m)));
        setFilterValues({
            ...Object.fromEntries(options[s].filters.filter(k => f[k] && f[k].length !== 0).map(k => [k, [f[k]].flat().map(String)])),
            ...(f.date_range && hasValue(f.date_range) ? { date_range: f.date_range } : {}),
        });
        setResult(snapshot);
        success('Settings loaded — change anything and generate again.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const data = result?.result;
    const rows = data?.rows ?? [];
    const totals = useMemo(() => Object.fromEntries((data?.metrics ?? []).map(m => {
        const values = rows.map(r => r[m]).filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v))).map(Number);
        const sum = values.reduce((a, b) => a + b, 0);
        return [m, isAverage(m) ? (values.length ? sum / values.length : null) : sum];
    })), [data, rows]);
    const canChart = (data?.dimensions ?? []).length === 1 && rows.length >= 1 && rows.length <= 40;
    const shownView = canChart ? view : 'table';
    const resultFilters = Object.entries(result?.filters ?? {}).filter(([k, v]) => !['subject', 'dimensions', 'metrics'].includes(k) && v && (Array.isArray(v) ? v.length : typeof v === 'object' ? hasValue(v) : true));
    const resultDateLabel = options?.[data?.subject]?.date ?? 'Date';

    const filterLabel = (key, value) => {
        if (key === 'college_id') return colleges.find(c => String(c.id) === String(value))?.name ?? 'College';
        if (key === 'status') return getStatusLabel(value);
        if (['department_id', 'proposal_call_id'].includes(key)) return choices[key]?.find(c => c.value === String(value))?.label ?? '—';
        if (key === 'category' || STATIC_LABELS[key]) return displayValue(key, value);
        return String(value);
    };

    // The most used filters first; the rest behind "More filters" unless already in use.
    const orderedFilters = (subjectOptions?.filters ?? []).slice().sort((a, b) => (FILTER_ORDER.indexOf(a) + 1 || 99) - (FILTER_ORDER.indexOf(b) + 1 || 99));
    const shownFilters = moreFilters ? orderedFilters : orderedFilters.filter((k, i) => i < PRIMARY_FILTERS || hasValue(filterValues[k] ?? []));
    const hiddenFilterCount = orderedFilters.length - shownFilters.length;

    return (
        <AppLayout breadcrumb="Report Builder">
            <InsightsNav />
            <div className="mx-auto max-w-7xl space-y-6">
                <PageHeader icon={Sliders} color="violet" title="Report Builder"
                    description="Build your own report in four steps — then chart it, export it to Excel or come back to it later.">
                    {(subject || result) && (
                        <button onClick={reset} type="button"
                            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                            <RotateCcw size={14} /> Start over
                        </button>
                    )}
                </PageHeader>

                <div className="grid items-start gap-6 lg:grid-cols-12">
                    {/* ── Builder ──────────────────────────────────────────── */}
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-4 lg:col-span-5">
                        <div className="p-5 sm:p-6">
                            <Step n={1} done={Boolean(subject)} title="What do you want to report on?" hint="Pick one subject." last={!subjectOptions}>
                                {!options ? (
                                    <div className="grid gap-2">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}</div>
                                ) : optionsError ? (
                                    <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-medium text-red-600">{optionsError}</p>
                                ) : (
                                    <div className="grid gap-2">
                                        {Object.keys(options).map(s => {
                                            const active = subject === s;
                                            const info = SUBJECT_INFO[s];
                                            return (
                                                <button key={s} type="button" onClick={() => chooseSubject(s)} aria-pressed={active}
                                                    className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-sm ${info?.tone ?? 'from-slate-500 to-slate-700'}`}>
                                                        <SubjectIcon subject={s} size={18} />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-semibold text-gray-900">{builderLabel(s)}</span>
                                                        {info && <span className="block text-xs leading-snug text-gray-500">{info.blurb}</span>}
                                                    </span>
                                                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'}`}>
                                                        {active && <Check size={12} strokeWidth={3} />}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </Step>

                            {subjectOptions && (
                                <>
                                    <Step n={2} done={filterCount > 0} title="Narrow it down" hint="Optional. Tap a filter to pick one or more values."
                                        aside={filterCount > 0 && (
                                            <button type="button" onClick={() => setFilterValues({})} className="shrink-0 text-xs font-semibold text-indigo-600 hover:underline">Clear {filterCount}</button>
                                        )}>
                                        <div className="flex flex-wrap gap-2">
                                            {subjectOptions.date && (
                                                <DateRangeChip key={`${subject}-date`} label={subjectOptions.date} value={filterValues.date_range}
                                                    onChange={v => setFilterValue('date_range', v)} />
                                            )}
                                            {shownFilters.map(key => (
                                                <FilterChip key={`${subject}-${key}`} filterKey={key} label={builderLabel(key)}
                                                    choices={filterChoices(key, subject, { colleges, years, choices, selectedColleges: filterValues.college_id ?? [] })}
                                                    selected={filterValues[key] ?? []}
                                                    onChange={v => setFilterValue(key, v)}
                                                    locked={key === 'college_id' && lockedCollege ? lockedCollege.name : null} />
                                            ))}
                                            {(hiddenFilterCount > 0 || moreFilters) && orderedFilters.length > PRIMARY_FILTERS && (
                                                <button type="button" onClick={() => setMoreFilters(v => !v)}
                                                    className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
                                                    {moreFilters ? 'Fewer filters' : `+ ${hiddenFilterCount} more filter${hiddenFilterCount === 1 ? '' : 's'}`}
                                                </button>
                                            )}
                                        </div>
                                    </Step>

                                    <Step n={3} done={dimensions.length > 0} title="Group the results by" hint="Optional. One field gives you a chart; pick two for a cross-table.">
                                        <div className="flex flex-wrap gap-2">
                                            {subjectOptions.dimensions.map(dim => (
                                                <Chip key={dim} active={dimensions.includes(dim)} order={dimensions.includes(dim) && dimensions.length > 1 ? dimensions.indexOf(dim) + 1 : null}
                                                    onClick={() => toggleIn(dimensions, setDimensions, dim)}>
                                                    {builderLabel(dim)}
                                                </Chip>
                                            ))}
                                        </div>
                                    </Step>

                                    <Step n={4} done={metrics.length > 0} title="What should be measured?" hint="Pick at least one." last>
                                        <div className="flex flex-wrap gap-2">
                                            {subjectOptions.metrics.map(metric => (
                                                <Chip key={metric} active={metrics.includes(metric)} onClick={() => toggleIn(metrics, setMetrics, metric)}>
                                                    {builderLabel(metric)}
                                                </Chip>
                                            ))}
                                        </div>
                                    </Step>
                                </>
                            )}
                        </div>

                        {subjectOptions && (
                            <div className="rounded-b-2xl border-t border-gray-100 bg-gray-50/80 px-5 py-4 sm:px-6">
                                <p className="mb-3 text-xs text-gray-500">
                                    <span className="font-semibold text-gray-800">{metrics.length ? metrics.map(builderLabel).join(', ') : 'Nothing measured yet'}</span>
                                    {' '}of {describe(subject, dimensions).toLowerCase()}
                                    {filterCount > 0 && <> · {filterCount} filter{filterCount === 1 ? '' : 's'}</>}
                                </p>
                                <button onClick={generate} disabled={generating || !ready}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                                    {generating ? <><RefreshCw size={15} className="animate-spin" /> Generating…</> : <><Wand2 size={15} /> Generate report</>}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Result ───────────────────────────────────────────── */}
                    <div ref={resultRef} className="scroll-mt-4 space-y-6 lg:col-span-7">
                        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            {generating && !result ? (
                                <div className="flex flex-col items-center justify-center px-6 py-28 text-center">
                                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50"><RefreshCw size={24} className="animate-spin text-indigo-500" /></span>
                                    <p className="mt-4 text-sm font-semibold text-gray-800">Building your report…</p>
                                </div>
                            ) : result ? (
                                <>
                                    <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                                        <div className="min-w-0">
                                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600"><Sparkles size={12} /> Result</p>
                                            <h2 className="mt-1 text-lg font-bold tracking-tight text-gray-900">{describe(data?.subject, data?.dimensions)}</h2>
                                            <p className="mt-0.5 text-xs text-gray-500">Generated {formatDateTime(result.completed_at ?? result.created_at)}</p>
                                            {resultFilters.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {resultFilters.map(([k, v]) => (
                                                        <span key={k} className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{k === 'date_range' ? `${resultDateLabel}: ${describeRange(v)}` : `${builderLabel(k)}: ${[v].flat().map(x => filterLabel(k, x)).join(', ')}`}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {canChart && (
                                                <div className="flex rounded-lg bg-gray-100 p-0.5" role="tablist" aria-label="View">
                                                    {[['chart', BarChart3, 'Chart'], ['table', Table2, 'Table']].map(([key, Icon, label]) => (
                                                        <button key={key} role="tab" aria-selected={shownView === key} onClick={() => setView(key)}
                                                            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${shownView === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                                                            <Icon size={14} /> {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            <DownloadExcelButton snapshot={result} />
                                        </div>
                                    </div>

                                    {rows.length === 0 ? (
                                        <div className="px-6 py-20 text-center">
                                            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><Layers size={22} className="text-gray-300" /></span>
                                            <p className="mt-3 text-sm font-semibold text-gray-700">Nothing matched these settings</p>
                                            <p className="mt-1 text-xs text-gray-500">Try removing a filter.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5 p-5 sm:p-6">
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                                                {(data?.dimensions ?? []).length > 0 && (
                                                    <div className="rounded-xl border border-gray-200 p-3.5">
                                                        <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><Rows3 size={13} /> Groups</p>
                                                        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{rows.length}</p>
                                                    </div>
                                                )}
                                                {(data?.metrics ?? []).map((m, i) => (
                                                    <div key={m} className="rounded-xl border border-gray-200 p-3.5">
                                                        <p className="flex items-center gap-1.5 truncate text-xs font-medium text-gray-500">
                                                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /> {builderLabel(m)}
                                                        </p>
                                                        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{formatMetric(m, totals[m])}</p>
                                                        {isAverage(m) && rows.length > 1 && <p className="text-[11px] text-gray-400">average across groups</p>}
                                                    </div>
                                                ))}
                                            </div>

                                            {shownView === 'chart' ? <ResultChart data={data} /> : <ResultTable data={data} totals={totals} />}
                                            {!canChart && (data?.dimensions ?? []).length !== 1 && (
                                                <p className="text-xs text-gray-400">Group by exactly one field to see a chart.</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="px-6 py-20 text-center sm:py-28">
                                    <div className="mx-auto flex w-fit items-end gap-1.5" aria-hidden>
                                        {[40, 64, 30, 80, 52].map((h, i) => (
                                            <span key={i} className="w-5 rounded-t-md bg-linear-to-t from-indigo-100 to-indigo-200" style={{ height: h }} />
                                        ))}
                                    </div>
                                    <h2 className="mt-5 text-base font-semibold text-gray-900">{subject ? 'Choose what to measure, then generate' : 'Your report will appear here'}</h2>
                                    <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                                        {subject ? 'Group by one field to get a chart as well as the table.' : 'Start by picking a subject on the left — proposals, complaints or review workload.'}
                                    </p>
                                </div>
                            )}
                        </section>

                        {/* ── Recent reports ─────────────────────────────── */}
                        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><History size={15} className="text-gray-400" /> Your recent reports</h2>
                                <button onClick={loadHistory} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                                    <RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} /> Refresh
                                </button>
                            </div>
                            {historyLoading && history.length === 0 ? (
                                <div className="space-y-2 p-4">{[1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}</div>
                            ) : history.length === 0 ? (
                                <p className="px-5 py-10 text-center text-sm text-gray-400">Reports you generate are kept here so you can open them again.</p>
                            ) : (
                                <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
                                    {history.map(s => {
                                        const subj = s.result?.subject ?? s.filters?.subject;
                                        const active = result?.id === s.id;
                                        return (
                                            <li key={s.id} className={`flex items-center gap-3 px-5 py-3 transition ${active ? 'bg-indigo-50/60' : 'hover:bg-gray-50'}`}>
                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white ${SUBJECT_INFO[subj]?.tone ?? 'from-slate-500 to-slate-700'}`}>
                                                    <SubjectIcon subject={subj} size={15} />
                                                </span>
                                                <button type="button" onClick={() => setResult(s)} className="min-w-0 flex-1 text-left">
                                                    <p className="truncate text-sm font-semibold text-gray-800">{describe(subj, s.result?.dimensions ?? s.filters?.dimensions)}</p>
                                                    <p className="flex items-center gap-1 text-xs text-gray-400">
                                                        <Clock size={11} /> {formatDateTime(s.completed_at ?? s.created_at)}
                                                        {s.status !== 'ready' && <span className={`ml-1 rounded px-1.5 py-px text-[10px] font-semibold ${s.status === 'processing' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>}
                                                    </p>
                                                </button>
                                                <button type="button" onClick={() => reuse(s)} title="Load these settings into the builder"
                                                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-700">
                                                    <Copy size={12} /> <span className="hidden sm:inline">Reuse</span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
