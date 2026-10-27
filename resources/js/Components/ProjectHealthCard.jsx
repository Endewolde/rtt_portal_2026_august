import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Eye, Gauge, HeartPulse, Wallet } from 'lucide-react';
import { get } from '../lib/api';
import { translate as tr } from '../lib/i18n';

const LEVELS = {
    high: { label: 'Needs attention', ring: 'border-red-200', head: 'bg-red-50', chip: 'bg-red-100 text-red-700', icon: AlertTriangle },
    watch: { label: 'Keep an eye on it', ring: 'border-amber-200', head: 'bg-amber-50', chip: 'bg-amber-100 text-amber-700', icon: Eye },
    on_track: { label: 'On track', ring: 'border-emerald-200', head: 'bg-emerald-50', chip: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

function Meter({ icon: Icon, label, value, marker, tone }) {
    return (
        <div className="min-w-0">
            <div className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 text-gray-500"><Icon size={11} /> {label}</span>
                <span className="font-semibold tabular-nums text-gray-800">{value == null ? '—' : `${value}%`}</span>
            </div>
            <div className="relative mt-1 h-1.5 rounded-full bg-gray-100">
                {value != null && <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${Math.max(2, value)}%` }} />}
                {marker != null && value != null && <div className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-gray-500" style={{ left: `calc(${marker}% - 1px)` }} />}
            </div>
        </div>
    );
}

/**
 * A running project's health on its own page: time used, money released and work
 * reported against each other, with the warnings in plain words. Shows nothing for
 * projects that are not running.
 */
export default function ProjectHealthCard({ proposalId }) {
    const [health, setHealth] = useState(null);

    useEffect(() => {
        get(`/proposals/${proposalId}/health`).then((r) => setHealth(r.data ?? null)).catch(() => setHealth(null));
    }, [proposalId]);

    if (!health) return null;

    const level = LEVELS[health.level] ?? LEVELS.on_track;
    const LevelIcon = level.icon;

    return (
        <section className={`overflow-hidden rounded-xl border bg-white ${level.ring}`}>
            <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${level.head}`}>
                <div className="flex items-center gap-2">
                    <HeartPulse size={16} className="text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">{tr('Project health')}</h3>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${level.chip}`}>
                        <LevelIcon size={11} /> {tr(level.label)}
                    </span>
                </div>
                {health.days_left != null && (
                    <span className={`text-xs font-semibold tabular-nums ${health.days_left < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {health.days_left < 0 ? tr(':days days past the end date', { days: Math.abs(health.days_left) }) : tr(':days days left', { days: health.days_left })}
                    </span>
                )}
            </div>
            <div className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <Meter icon={Clock} label={tr('Time used')} value={health.elapsed_pct} tone="bg-slate-400" />
                    <Meter icon={Wallet} label={tr('Money released')} value={health.released_pct} marker={health.elapsed_pct} tone="bg-blue-500" />
                    <Meter icon={Gauge} label={tr('Work done (reported)')} value={health.reported_progress} marker={health.elapsed_pct} tone="bg-emerald-500" />
                </div>
                {health.signals.length > 0 ? (
                    <ul className="space-y-1.5 border-t border-gray-100 pt-3">
                        {health.signals.map((s) => (
                            <li key={s.key} className="flex items-start gap-2 text-xs">
                                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${s.level === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                <span><span className="font-semibold text-gray-800">{tr(s.label)}.</span> <span className="text-gray-500">{s.detail}</span></span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">{tr('Time, money and reported progress are in step. Keep progress reports up to date to keep it that way.')}</p>
                )}
            </div>
        </section>
    );
}
