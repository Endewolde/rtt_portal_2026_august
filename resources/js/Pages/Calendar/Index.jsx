import { useState, useEffect } from 'react'
import { Link } from '@inertiajs/react'
import {
    ChevronLeft, ChevronRight, CalendarDays, Download,
    Circle, Clock, MapPin,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { get } from '../../lib/api'
import { cn } from '../../lib/utils'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const TYPE_CONFIG = {
    call:    { label: 'Call Deadline', color: 'bg-blue-500',   soft: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-500'   },
    fund:    { label: 'Fund Deadline', color: 'bg-amber-500',  soft: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500'  },
    review:  { label: 'Review Due',    color: 'bg-purple-500', soft: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500'},
    defence: { label: 'Defence',       color: 'bg-green-500',  soft: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500'  },
}

function EventPill({ event, compact }) {
    const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.call
    if (compact) {
        return (
            <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} title={event.label} />
        )
    }
    return (
        <Link href={event.url ?? '#'}
            className={cn(
                'flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border truncate',
                'hover:opacity-80 transition-opacity',
                cfg.soft
            )}>
            <Circle size={5} className="shrink-0 fill-current" />
            <span className="truncate">{event.label}</span>
        </Link>
    )
}

function DayCell({ day, date, events, isToday, isCurrentMonth, onSelect, selected }) {
    const hasEvents = events?.length > 0
    const MAX_VISIBLE = 2

    return (
        <button
            onClick={() => hasEvents && onSelect(date)}
            className={cn(
                'min-h-20 p-1.5 text-left rounded-xl border transition-all',
                isCurrentMonth ? 'bg-white' : 'bg-gray-50/50',
                isToday ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-transparent hover:border-gray-200',
                selected === date && 'border-indigo-400 ring-2 ring-indigo-100',
                hasEvents && 'cursor-pointer'
            )}
        >
            <div className={cn(
                'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1',
                isToday ? 'bg-indigo-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
            )}>
                {day}
            </div>
            <div className="space-y-0.5">
                {events?.slice(0, MAX_VISIBLE).map(e => (
                    <EventPill key={e.id} event={e} compact={false} />
                ))}
                {events?.length > MAX_VISIBLE && (
                    <p className="text-[10px] text-gray-400 font-medium pl-1">
                        +{events.length - MAX_VISIBLE} more
                    </p>
                )}
            </div>
        </button>
    )
}

function EventPanel({ date, events, onClose }) {
    if (!date || !events?.length) return null
    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-800">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-2">
                {events.map(e => {
                    const cfg = TYPE_CONFIG[e.type] ?? TYPE_CONFIG.call
                    return (
                        <Link key={e.id} href={e.url ?? '#'}
                            className={cn('flex flex-col gap-0.5 p-3 rounded-xl border text-left hover:opacity-80 transition-opacity', cfg.soft)}>
                            <div className="flex items-center gap-1.5">
                                <div className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                                <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">{cfg.label}</span>
                            </div>
                            <p className="text-xs font-semibold leading-snug">{e.label}</p>
                            {e.time && (
                                <div className="flex items-center gap-1 text-[10px] opacity-70 mt-0.5">
                                    <Clock size={9} />
                                    {e.time}
                                    {e.venue && <><MapPin size={9} className="ml-1" />{e.venue}</>}
                                </div>
                            )}
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

export default function CalendarIndex() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year,  setYear]  = useState(now.getFullYear())
    const [events, setEvents] = useState({})
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)

    const load = async () => {
        setLoading(true)
        try {
            const r = await get('/calendar/events', { month, year })
            setEvents(r.data?.data ?? {})
            setMeta(r.data?.meta ?? null)
        } catch {}
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [month, year])

    const prev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
    const next = () => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

    const daysInMonth = meta?.days_in_month ?? new Date(year, month, 0).getDate()
    const firstWeekday = meta?.first_weekday ?? new Date(year, month - 1, 1).getDay()

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const totalCount = Object.values(events).reduce((s, arr) => s + arr.length, 0)

    const exportUrl = `/api/v1/calendar/export?token=${localStorage.getItem('rtt_token') ?? ''}`

    return (
        <AppLayout breadcrumb="Calendar">
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Proposal deadlines, review due dates, and defence sessions
                        </p>
                    </div>
                    <a href={exportUrl} download="rtt-calendar.ics"
                        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        <Download size={14} /> Export iCal
                    </a>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4">
                    {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                        <div key={type} className="flex items-center gap-1.5">
                            <div className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
                            <span className="text-xs text-gray-500">{cfg.label}</span>
                        </div>
                    ))}
                    <span className="ml-auto text-xs text-gray-400">{totalCount} event{totalCount !== 1 ? 's' : ''} this month</span>
                </div>

                {/* Month nav */}
                <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm">
                    <button onClick={prev}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                        <ChevronLeft size={16} />
                    </button>
                    <h2 className="text-base font-bold text-gray-900">{MONTHS[month - 1]} {year}</h2>
                    <button onClick={next}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* Grid */}
                <div className={cn('transition-opacity duration-200', loading && 'opacity-50 pointer-events-none')}>
                    {/* Weekday labels */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAYS.map(d => (
                            <p key={d} className="text-center text-[11px] font-semibold text-gray-400 py-2">{d}</p>
                        ))}
                    </div>
                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Leading empty cells */}
                        {Array.from({ length: firstWeekday }).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {/* Day cells */}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                            return (
                                <DayCell
                                    key={day}
                                    day={day}
                                    date={dateStr}
                                    events={events[dateStr] ?? []}
                                    isToday={dateStr === todayStr}
                                    isCurrentMonth
                                    onSelect={setSelected}
                                    selected={selected}
                                />
                            )
                        })}
                    </div>
                </div>

                {/* Selected day panel */}
                {selected && events[selected] && (
                    <EventPanel
                        date={selected}
                        events={events[selected]}
                        onClose={() => setSelected(null)}
                    />
                )}

                {/* Empty state */}
                {!loading && totalCount === 0 && (
                    <div className="flex flex-col items-center py-10 text-center">
                        <CalendarDays size={36} className="text-gray-200 mb-3" />
                        <p className="text-gray-500 font-medium">No events this month</p>
                        <p className="text-sm text-gray-400 mt-1">Proposal call deadlines, reviews, and defence sessions will appear here.</p>
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
