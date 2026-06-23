import { useState, useEffect, useRef } from 'react';
import { Clock, Calendar, ArrowRight, Download, Microscope, Users, Zap, Lightbulb, LayoutGrid } from 'lucide-react';
import { downloadFile } from '../lib/download';
import { cn } from '../lib/utils';

const CATEGORY_CONFIG = {
    research: {
        label:    'Research',
        gradient: 'from-blue-600 to-indigo-700',
        gradientLight: 'from-blue-50 to-indigo-50',
        accent:   'bg-blue-600',
        soft:     'bg-blue-100 text-blue-700',
        ring:     'ring-blue-200',
        icon:     Microscope,
        bar:      'bg-linear-to-r from-blue-500 to-indigo-600',
    },
    community_engagement: {
        label:    'Community Engagement',
        gradient: 'from-emerald-600 to-teal-700',
        gradientLight: 'from-emerald-50 to-teal-50',
        accent:   'bg-emerald-600',
        soft:     'bg-emerald-100 text-emerald-700',
        ring:     'ring-emerald-200',
        icon:     Users,
        bar:      'bg-linear-to-r from-emerald-500 to-teal-600',
    },
    technology_transfer: {
        label:    'Technology Transfer',
        gradient: 'from-purple-600 to-violet-700',
        gradientLight: 'from-purple-50 to-violet-50',
        accent:   'bg-purple-600',
        soft:     'bg-purple-100 text-purple-700',
        ring:     'ring-purple-200',
        icon:     Zap,
        bar:      'bg-linear-to-r from-purple-500 to-violet-600',
    },
    innovation: {
        label:    'Innovation',
        gradient: 'from-amber-500 to-orange-600',
        gradientLight: 'from-amber-50 to-orange-50',
        accent:   'bg-amber-500',
        soft:     'bg-amber-100 text-amber-700',
        ring:     'ring-amber-200',
        icon:     Lightbulb,
        bar:      'bg-linear-to-r from-amber-400 to-orange-500',
    },
    other: {
        label:    'Other',
        gradient: 'from-slate-500 to-gray-600',
        gradientLight: 'from-slate-50 to-gray-50',
        accent:   'bg-slate-500',
        soft:     'bg-slate-100 text-slate-600',
        ring:     'ring-slate-200',
        icon:     LayoutGrid,
        bar:      'bg-linear-to-r from-slate-400 to-gray-500',
    },
};

function useCountdown(initialSeconds) {
    const endTs = useRef(Date.now() + (initialSeconds ?? 0) * 1000);

    const calculate = () => {
        const diff = endTs.current - Date.now();
        if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
        return {
            expired: false, total: diff,
            days:    Math.floor(diff / 86400000),
            hours:   Math.floor((diff % 86400000) / 3600000),
            minutes: Math.floor((diff % 3600000) / 60000),
            seconds: Math.floor((diff % 60000) / 1000),
        };
    };

    const [time, setTime] = useState(calculate);

    useEffect(() => {
        endTs.current = Date.now() + (initialSeconds ?? 0) * 1000;
        setTime(calculate());
        if ((initialSeconds ?? 0) <= 0) return;
        const t = setInterval(() => setTime(calculate()), 1000);
        return () => clearInterval(t);
    }, [initialSeconds]);

    return time;
}

function getUrgency(days) {
    if (days <= 1) return { label: 'Closing today!',      color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    pulse: true  };
    if (days <= 3) return { label: 'Closing very soon',   color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', pulse: true  };
    if (days <= 7) return { label: 'Closing this week',   color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-400',  pulse: false };
    return          { label: 'Time remaining',            color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400',  pulse: false };
}

function TimeUnit({ value, label, critical }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={cn(
                'w-10 h-10 flex items-center justify-center rounded-xl font-mono font-extrabold text-base tabular-nums transition-all',
                critical
                    ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
                    : 'bg-white text-slate-800 ring-1 ring-slate-200 shadow-xs'
            )}>
                {String(value).padStart(2, '0')}
            </div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">{label}</span>
        </div>
    );
}

export default function ProposalCallCard({ call, onApply }) {
    const config   = CATEGORY_CONFIG[call.category] ?? CATEGORY_CONFIG.other;
    const countdown = useCountdown(call.countdown_seconds ?? 0);
    const urgency  = getUrgency(countdown.days);
    const Icon     = config.icon;
    const critical = urgency.label.includes('today') || urgency.label.includes('very soon');

    const [startDateStr, startTimeStr] = (call.start_date_formatted ?? '').split(', ');
    const [endDateStr,   endTimeStr]   = (call.end_date_formatted   ?? '').split(', ');

    const elapsedPct = (() => {
        const start = new Date(call.start_date).getTime();
        const end   = new Date(call.end_date).getTime();
        const total = end - start;
        if (total <= 0) return 100;
        return Math.max(0, Math.min(100, ((Date.now() - start) / total) * 100));
    })();

    const handleApply = () => {
        if (onApply) { onApply(call.id); return; }
        const token = localStorage.getItem('rtt_token');
        if (!token) {
            localStorage.setItem('redirect_after_login', `/proposals/create?call_id=${call.id}`);
            window.location.href = '/login';
        } else {
            window.location.href = `/proposals/create?call_id=${call.id}`;
        }
    };

    return (
        <div className="group relative bg-white rounded-3xl border border-slate-200 overflow-hidden
                        hover:border-slate-300 hover:shadow-2xl hover:shadow-slate-200/60
                        transition-all duration-300 ease-out hover:-translate-y-1.5 flex flex-col">

            {/* Gradient header */}
            <div className={cn(
                'relative px-5 pt-5 pb-8 bg-linear-to-br text-white overflow-hidden',
                config.gradient
            )}>
                {/* Decorative circle */}
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
                <div className="absolute top-2 right-2 w-16 h-16 rounded-full bg-white/5" />

                {/* Year badge */}
                <div className="flex items-center justify-between mb-4 relative">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 bg-white/10 px-2.5 py-1 rounded-full">
                        {call.academic_year}
                    </span>
                    {call.guidelines_filename && (
                        <button
                            type="button"
                            onClick={e => {
                                e.stopPropagation();
                                downloadFile(`/proposal-calls/${call.id}/guidelines/download`, call.guidelines_filename).catch(() => {});
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-full transition-colors">
                            <Download size={10} /> Guidelines
                        </button>
                    )}
                </div>

                {/* Category icon + label */}
                <div className="flex items-center gap-2 mb-3 relative">
                    <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-white" />
                    </div>
                    <span className="text-xs font-semibold text-white/80">{config.label}</span>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-white leading-snug line-clamp-2 relative">
                    {call.title}
                </h3>
            </div>

            {/* Pull-up card body — overlaps the header slightly */}
            <div className="relative -mt-4 mx-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col">
                <div className="p-4 flex-1 flex flex-col">

                    {/* Description */}
                    {call.description && (
                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4">
                            {call.description}
                        </p>
                    )}

                    {/* Opens date */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
                        <Calendar size={11} className="shrink-0" />
                        <span>Opens {startDateStr}</span>
                        {call.proposals_count > 0 && (
                            <>
                                <span className="mx-1 text-slate-200">·</span>
                                <span className="font-semibold text-slate-500">{call.proposals_count} submitted</span>
                            </>
                        )}
                    </div>

                    <div className="flex-1" />

                    {/* Countdown / closed */}
                    {countdown.expired ? (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-3">
                            <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                            <span className="text-sm font-semibold text-slate-400">This call has closed</span>
                        </div>
                    ) : (
                        <div className={cn('rounded-xl px-3 py-3 mb-3 border', urgency.bg, urgency.border)}>
                            {/* Label + deadline */}
                            <div className="flex items-center justify-between mb-2.5">
                                <div className={cn('flex items-center gap-1.5 text-xs font-semibold', urgency.color)}>
                                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', urgency.dot, urgency.pulse && 'animate-pulse')} />
                                    {urgency.label}
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {endDateStr} · {endTimeStr}
                                </span>
                            </div>

                            {/* Time units */}
                            <div className="flex items-end gap-1.5">
                                {countdown.days > 0 && (
                                    <TimeUnit value={countdown.days}    label="days" critical={critical} />
                                )}
                                <TimeUnit value={countdown.hours}   label="hrs"  critical={critical} />
                                <TimeUnit value={countdown.minutes} label="min"  critical={critical} />
                                <TimeUnit value={countdown.seconds} label="sec"  critical={critical} />

                                {/* Progress */}
                                <div className="flex-1 ml-2 mb-4 min-w-0">
                                    <div className="h-1.5 bg-white rounded-full overflow-hidden ring-1 ring-slate-200">
                                        <div className={cn('h-full rounded-full transition-all duration-1000', config.bar)}
                                            style={{ width: `${elapsedPct}%` }} />
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-1 text-right font-medium">
                                        {Math.round(elapsedPct)}% of time elapsed
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CTA */}
                    <button
                        onClick={handleApply}
                        disabled={countdown.expired}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200',
                            countdown.expired
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : `bg-linear-to-r ${config.gradient} text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]`
                        )}>
                        {countdown.expired ? 'Call Closed' : 'Apply Now'}
                        {!countdown.expired && (
                            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                        )}
                    </button>
                </div>
            </div>

            {/* Bottom spacing */}
            <div className="h-3" />
        </div>
    );
}
