import { Link } from '@inertiajs/react';
import { ChevronDown, Inbox, RefreshCw } from 'lucide-react';

/**
 * Building blocks shared by every Insights page, so headers, figures, panels and
 * filters look and behave the same everywhere.
 */

export const TONES = {
    indigo: { chip: 'bg-indigo-100 text-indigo-600', bar: 'bg-indigo-500', tile: 'from-indigo-500 to-indigo-700 shadow-indigo-200' },
    violet: { chip: 'bg-violet-100 text-violet-600', bar: 'bg-violet-500', tile: 'from-violet-500 to-violet-700 shadow-violet-200' },
    emerald: { chip: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-500', tile: 'from-emerald-500 to-teal-600 shadow-emerald-200' },
    amber: { chip: 'bg-amber-100 text-amber-600', bar: 'bg-amber-500', tile: 'from-amber-400 to-orange-500 shadow-amber-200' },
    red: { chip: 'bg-red-100 text-red-600', bar: 'bg-red-500', tile: 'from-rose-500 to-red-600 shadow-red-200' },
    sky: { chip: 'bg-sky-100 text-sky-600', bar: 'bg-sky-500', tile: 'from-sky-500 to-blue-600 shadow-sky-200' },
    slate: { chip: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', tile: 'from-slate-700 to-slate-900 shadow-slate-200' },
};
const tone = (name) => TONES[name] ?? TONES.indigo;

/** Recharts styling: horizontal grid only, quiet axes, card-style tooltip. */
export const CHART = {
    grid: { strokeDasharray: '4 4', stroke: '#eef0f3', vertical: false },
    axis: { tick: { fontSize: 12, fill: '#6b7280' }, tickLine: false, axisLine: { stroke: '#e5e7eb' } },
    yAxis: { tick: { fontSize: 12, fill: '#6b7280' }, tickLine: false, axisLine: false, width: 40 },
    tooltip: {
        cursor: { fill: 'rgba(99,102,241,0.06)' },
        contentStyle: { borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px -10px rgba(15,23,42,0.25)', fontSize: 12, padding: '8px 12px' },
        labelStyle: { fontWeight: 600, color: '#111827', marginBottom: 4 },
    },
    legend: { iconType: 'circle', iconSize: 8, wrapperStyle: { fontSize: 12, paddingTop: 8 } },
};

export function PageHeader({ icon: Icon, title, description, color = 'indigo', badge, children }) {
    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3.5">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg ${tone(color).tile}`}>
                    <Icon size={22} />
                </span>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
                        {badge}
                    </div>
                    {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
                </div>
            </div>
            {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
    );
}

export function LiveBadge({ label = 'Live' }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {label}
        </span>
    );
}

export function Select({ value, onChange, label, children, className = '' }) {
    return (
        <label className={`relative min-w-0 ${className}`}>
            <span className="sr-only">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className={`w-full appearance-none rounded-xl border bg-white py-2 pl-3 pr-8 text-base transition focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:text-sm ${value ? 'border-indigo-300 font-medium text-indigo-700' : 'border-gray-200 text-gray-700'}`}>
                {children}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </label>
    );
}

export function RefreshButton({ onClick, loading, label = 'Refresh' }) {
    return (
        <button onClick={onClick} disabled={loading} title={label}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

export function StatCard({ icon: Icon, label, value, hint, color = 'indigo', loading, href, hintTone }) {
    const body = (
        <div className={`group relative h-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 transition ${href ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${tone(color).bar}`} />
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-gray-500">{label}</span>
                {Icon && <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone(color).chip}`}><Icon size={15} /></span>}
            </div>
            {loading
                ? <div className="mt-3 h-7 w-16 animate-pulse rounded bg-gray-100" />
                : <p className="mt-1.5 truncate text-2xl font-bold tabular-nums text-gray-900">{value}</p>}
            <p className={`mt-0.5 min-h-4 truncate text-[11px] ${hintTone ?? 'text-gray-400'}`}>{loading ? '' : hint}</p>
        </div>
    );
    return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Panel({ title, subtitle, icon: Icon, actions, children, className = '', bodyClassName = 'p-5', id }) {
    return (
        <section id={id} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white ${className}`}>
            {(title || actions) && (
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-2.5">
                        {Icon && <Icon size={16} className="mt-0.5 shrink-0 text-gray-400" />}
                        <div className="min-w-0">
                            <h2 className="font-semibold text-gray-900">{title}</h2>
                            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={`flex-1 ${bodyClassName}`}>{children}</div>
        </section>
    );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing to show', text, children }) {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 ring-1 ring-gray-100"><Icon size={22} className="text-gray-400" /></span>
            <p className="mt-3 text-sm font-semibold text-gray-700">{title}</p>
            {text && <p className="mt-1 max-w-sm text-xs text-gray-400">{text}</p>}
            {children}
        </div>
    );
}

export function Skeleton({ className = 'h-40' }) {
    return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

/** Four placeholder figure cards. */
export function StatSkeletons({ count = 4 }) {
    return (
        <div className={`grid grid-cols-2 gap-3 ${count >= 4 ? 'xl:grid-cols-4' : ''}`}>
            {[...Array(count)].map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}
        </div>
    );
}

/** A table that sits flush inside a Panel: quiet header, aligned numbers, row hover. */
export function DataTable({ columns, rows, rowKey, onRowClick, minWidth = 560, empty }) {
    if (rows.length === 0) return empty ?? <EmptyState />;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth }}>
                <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                        {columns.map((c) => (
                            <th key={c.key} className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}>
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => (
                        <tr key={rowKey ? rowKey(row) : i} onClick={onRowClick ? () => onRowClick(row) : undefined}
                            className={`transition-colors hover:bg-indigo-50/30 ${onRowClick ? 'cursor-pointer' : ''}`}>
                            {columns.map((c) => (
                                <td key={c.key} className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left'} ${c.className ?? 'text-gray-700'}`}>
                                    {c.render ? c.render(row) : row[c.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
