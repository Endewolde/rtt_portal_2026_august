import { useState, useEffect, useRef } from 'react';
import { Clock, Calendar, ArrowRight, Download } from 'lucide-react';
import { downloadFile } from '../lib/download';

const CATEGORY_CONFIG = {
    research: {
        label:    'Research',
        gradient: 'from-blue-500 to-indigo-600',
        light:    'bg-blue-50 text-blue-700 border-blue-200',
        icon:     '🔬',
    },
    community_engagement: {
        label:    'Community Engagement',
        gradient: 'from-green-500 to-emerald-600',
        light:    'bg-green-50 text-green-700 border-green-200',
        icon:     '🤝',
    },
    technology_transfer: {
        label:    'Technology Transfer',
        gradient: 'from-purple-500 to-violet-600',
        light:    'bg-purple-50 text-purple-700 border-purple-200',
        icon:     '🚀',
    },
    innovation: {
        label:    'Innovation',
        gradient: 'from-orange-500 to-amber-600',
        light:    'bg-orange-50 text-orange-700 border-orange-200',
        icon:     '💡',
    },
    other: {
        label:    'Other',
        gradient: 'from-gray-500 to-slate-600',
        light:    'bg-gray-50 text-gray-700 border-gray-200',
        icon:     '📋',
    },
};

// Accepts the server-calculated remaining seconds so the countdown is
// anchored to server time — no client timezone conversion needed.
function useCountdown(initialSeconds) {
    const endTs = useRef(Date.now() + (initialSeconds ?? 0) * 1000);

    const calculate = () => {
        const diff = endTs.current - Date.now();
        if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
        return {
            expired: false,
            total:   diff,
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
    if (days <= 1) return { level: 'critical', color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    pulse: true };
    if (days <= 3) return { level: 'urgent',   color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', pulse: true };
    if (days <= 7) return { level: 'soon',     color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  pulse: false };
    return          { level: 'normal',  color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200',  pulse: false };
}

function TimeUnit({ value, label, urgent }) {
    return (
        <div className="flex flex-col items-center">
            <div className={`
                min-w-10 h-10 flex items-center justify-center rounded-lg
                font-mono font-bold text-lg tabular-nums transition-all duration-300
                ${urgent
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                }
            `}>
                {String(value).padStart(2, '0')}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide font-medium">{label}</span>
        </div>
    );
}

export default function ProposalCallCard({ call, onApply }) {
    const config = CATEGORY_CONFIG[call.category] ?? CATEGORY_CONFIG.other;
    const countdown = useCountdown(call.countdown_seconds ?? 0);
    const urgency = getUrgency(countdown.days);

    // Use server-pre-formatted strings to avoid timezone conversion in the browser.
    // Format from server: "07 Jun 2026, 15:34" — split on ", " to get date and time.
    const [startDateStr, startTimeStr] = (call.start_date_formatted ?? '').split(', ');
    const [endDateStr,   endTimeStr]   = (call.end_date_formatted   ?? '').split(', ');

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

    const elapsedPct = (() => {
        const start = new Date(call.start_date).getTime();
        const end   = new Date(call.end_date).getTime();
        const total = end - start;
        if (total <= 0) return 100;
        return Math.max(0, Math.min(100, ((Date.now() - start) / total) * 100));
    })();

    return (
        <div className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden
                        hover:border-slate-300 hover:shadow-xl hover:shadow-slate-100
                        transition-all duration-300 ease-out hover:-translate-y-1 flex flex-col">

            {/* Coloured top bar */}
            <div className={`h-1.5 w-full bg-linear-to-r ${config.gradient}`} />

            <div className="p-5 flex-1 flex flex-col">

                {/* Category + year */}
                <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.light}`}>
                        <span>{config.icon}</span>
                        {config.label}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{call.academic_year}</span>
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold text-slate-900 leading-snug mb-2
                               group-hover:text-blue-700 transition-colors line-clamp-2">
                    {call.title}
                </h3>

                {/* Description */}
                {call.description && (
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4">
                        {call.description}
                    </p>
                )}

                <div className="flex-1" />

                {/* Opens date + optional guidelines download */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar size={12} />
                        <span>Opens {startDateStr} at {startTimeStr}</span>
                    </div>
                    {call.guidelines_filename && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                downloadFile(
                                    `/proposal-calls/${call.id}/guidelines/download`,
                                    call.guidelines_filename
                                ).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline bg-transparent border-none cursor-pointer p-0">
                            <Download size={12} />
                            Guidelines
                        </button>
                    )}
                </div>

                {/* Countdown / closed state */}
                {countdown.expired ? (
                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        <span className="text-sm font-medium text-slate-500">This call has closed</span>
                    </div>
                ) : (
                    <div className={`rounded-xl px-3 py-2.5 mb-4 border ${urgency.bg} ${urgency.border}`}>
                        <div className="flex items-center justify-between mb-2">
                            <div className={`flex items-center gap-1.5 text-xs font-medium ${urgency.color}`}>
                                <Clock size={12} className={urgency.pulse ? 'animate-pulse' : ''} />
                                <span>
                                    {urgency.level === 'critical' ? 'Closing very soon!' :
                                     urgency.level === 'urgent'   ? 'Closing soon' :
                                     urgency.level === 'soon'     ? 'Closing this week' :
                                                                    'Time remaining'}
                                </span>
                            </div>
                            <span className="text-xs text-slate-400">
                                {endDateStr} at {endTimeStr}
                            </span>
                        </div>

                        <div className="flex items-end gap-1.5">
                            {countdown.days > 0 && (
                                <TimeUnit value={countdown.days} label="days" urgent={urgency.level === 'critical'} />
                            )}
                            <TimeUnit value={countdown.hours}   label="hrs" urgent={urgency.level === 'critical'} />
                            <TimeUnit value={countdown.minutes} label="min" urgent={urgency.level === 'critical'} />
                            <TimeUnit value={countdown.seconds} label="sec" urgent={urgency.level === 'critical'} />

                            {/* Progress bar */}
                            <div className="flex-1 ml-2 mb-4">
                                <div className="h-1.5 bg-white rounded-full overflow-hidden border border-slate-200">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 bg-linear-to-r ${config.gradient}`}
                                        style={{ width: `${elapsedPct}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 text-right">
                                    {Math.round(elapsedPct)}% elapsed
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Apply button */}
                <button
                    onClick={handleApply}
                    disabled={countdown.expired}
                    className={`
                        w-full flex items-center justify-center gap-2 py-2.5 px-4
                        rounded-xl font-medium text-sm transition-all duration-200
                        ${countdown.expired
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : `bg-linear-to-r ${config.gradient} text-white
                               hover:shadow-lg hover:shadow-blue-100 hover:scale-[1.02]
                               active:scale-[0.98]`
                        }
                    `}
                >
                    {countdown.expired ? 'Call Closed' : 'Apply Now'}
                    {!countdown.expired && (
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    )}
                </button>
            </div>
        </div>
    );
}
