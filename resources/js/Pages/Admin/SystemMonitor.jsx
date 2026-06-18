import { useState, useEffect, useCallback, useRef } from 'react'
import {
    AreaChart, Area, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from 'recharts'
import {
    Cpu, MemoryStick, HardDrive, Activity, Users, Zap,
    AlertTriangle, CheckCircle2, XCircle, Clock, Database,
    RefreshCw, Bell, BellOff, TrendingUp, Server, Layers,
    X, ShieldAlert, Wifi, CircleDot, Settings, Mail, FlaskConical,
    Search, ToggleLeft, ToggleRight, Save, RotateCcw, Trash2,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { get, post, put, del } from '../../lib/api'

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (v) => v == null ? '—' : String(v)
const fmtMs = (v) => v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`
const fmtTime = (ts) => {
    if (!ts) { return '' }
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
const fmtDateTime = (ts) => {
    if (!ts) { return '' }
    const d = new Date(ts)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

const healthOf = (v) => {
    if (v == null) { return 'unknown' }
    if (v >= 90) { return 'critical' }
    if (v >= 75) { return 'warning' }
    if (v >= 50) { return 'moderate' }
    return 'good'
}

const HEALTH = {
    good:     { stroke: '#10b981', glow: '#10b981', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', label: 'Good' },
    moderate: { stroke: '#eab308', glow: '#eab308', text: 'text-yellow-400',  badge: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/25',   label: 'Moderate' },
    warning:  { stroke: '#f97316', glow: '#f97316', text: 'text-orange-400',  badge: 'bg-orange-500/15 text-orange-400 ring-orange-500/25',   label: 'Warning' },
    critical: { stroke: '#ef4444', glow: '#ef4444', text: 'text-red-400',     badge: 'bg-red-500/15 text-red-400 ring-red-500/25',           label: 'Critical' },
    unknown:  { stroke: '#64748b', glow: '#64748b', text: 'text-slate-400',   badge: 'bg-slate-500/15 text-slate-400 ring-slate-500/25',     label: 'N/A' },
}

const CHART_TOOLTIP = {
    contentStyle: {
        borderRadius: 12, border: '1px solid rgba(148,163,184,0.12)',
        background: 'rgba(15,23,42,0.95)', color: '#f1f5f9', fontSize: 12,
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    },
    labelStyle: { color: '#94a3b8', marginBottom: 6, fontWeight: 600 },
}

const SEVERITY = {
    critical: { color: 'text-red-400',   bg: 'bg-red-950/60',    border: 'border-l-red-500',   ring: 'ring-red-500/20',   icon: XCircle },
    warning:  { color: 'text-amber-400', bg: 'bg-amber-950/60',  border: 'border-l-amber-500', ring: 'ring-amber-500/20', icon: AlertTriangle },
    info:     { color: 'text-blue-400',  bg: 'bg-blue-950/60',   border: 'border-l-blue-500',  ring: 'ring-blue-500/20',  icon: Bell },
}

// ─── Ring Gauge ──────────────────────────────────────────────────────────────

function RingGauge({ value, label, icon: Icon, meta, size = 120 }) {
    const h = HEALTH[healthOf(value)]
    const r = 44
    const circ = 2 * Math.PI * r
    const pct = value != null ? Math.min(100, Math.max(0, value)) : 0
    const dash = (pct / 100) * circ
    const gap = circ - dash

    return (
        <div className="relative flex flex-col items-center gap-3 p-5 rounded-2xl bg-slate-900 border border-white/6 overflow-hidden group hover:border-white/10 hover:bg-slate-800/60 transition-all duration-300">
            {/* subtle gradient glow behind ring */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(circle at 50% 50%, ${h.glow}08 0%, transparent 70%)` }} />

            <div className="flex items-center gap-2 self-start w-full">
                <div className={`p-1.5 rounded-lg ring-1 ${h.badge}`}>
                    <Icon size={13} />
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
            </div>

            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    {/* track */}
                    <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="8" />
                    {/* glow duplicate */}
                    {pct > 0 && (
                        <circle cx="50" cy="50" r={r} fill="none"
                            stroke={h.stroke} strokeWidth="8" strokeLinecap="round" opacity="0.2"
                            strokeDasharray={`${dash + 4} ${gap - 4}`} />
                    )}
                    {/* fill */}
                    {pct > 0 && (
                        <circle cx="50" cy="50" r={r} fill="none"
                            stroke={h.stroke} strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={`${dash} ${gap}`}
                            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
                    )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white tabular-nums leading-none">
                        {value != null ? value : '—'}
                    </span>
                    {value != null && <span className="text-xs text-slate-500 mt-0.5">%</span>}
                </div>
            </div>

            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${h.badge}`}>{h.label}</span>
            {meta && <p className="text-xs text-slate-500 text-center">{meta}</p>}
        </div>
    )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

const CARD_ACCENT = {
    indigo:  { icon: 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/25',  val: 'text-indigo-300' },
    emerald: { icon: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', val: 'text-emerald-300' },
    amber:   { icon: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',   val: 'text-amber-300' },
    red:     { icon: 'bg-red-500/15 text-red-400 ring-red-500/25',         val: 'text-red-300' },
    blue:    { icon: 'bg-blue-500/15 text-blue-400 ring-blue-500/25',      val: 'text-blue-300' },
    violet:  { icon: 'bg-violet-500/15 text-violet-400 ring-violet-500/25', val: 'text-violet-300' },
    cyan:    { icon: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/25',      val: 'text-cyan-300' },
    rose:    { icon: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',      val: 'text-rose-300' },
}

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
    const c = CARD_ACCENT[color]
    return (
        <div className="relative flex flex-col justify-between gap-5 p-5 rounded-2xl bg-slate-900 border border-white/6 overflow-hidden group hover:border-white/10 hover:bg-slate-800/60 transition-all duration-200">
            <div className={`w-9 h-9 flex items-center justify-center rounded-xl ring-1 shrink-0 ${c.icon}`}>
                <Icon size={15} />
            </div>
            <div>
                <p className={`text-2xl font-bold tabular-nums tracking-tight ${c.val}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-1.5 font-medium leading-tight">{label}</p>
                {sub && <p className="text-xs text-slate-700 mt-1">{sub}</p>}
            </div>
        </div>
    )
}

// ─── Chart Panel ─────────────────────────────────────────────────────────────

function ChartPanel({ title, subtitle, children, action }) {
    return (
        <div className="rounded-2xl bg-slate-900 border border-white/6 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/6 bg-white/2">
                <div>
                    <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
                    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                {action}
            </div>
            <div className="p-6">{children}</div>
        </div>
    )
}

// ─── Alert Badge & Item ───────────────────────────────────────────────────────

function AlertBadge({ count }) {
    if (!count) { return null }
    return (
        <span className="ml-1.5 inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {count > 9 ? '9+' : count}
        </span>
    )
}

function AlertItem({ alert, onResolve }) {
    const cfg = SEVERITY[alert.severity] ?? SEVERITY.warning
    const Icon = cfg.icon
    const ctx = alert.context
        ? (typeof alert.context === 'string' ? JSON.parse(alert.context) : alert.context) : null

    return (
        <div className={`flex items-start gap-4 p-4 rounded-xl border-l-4 ring-1 ${cfg.bg} ${cfg.border} ${cfg.ring} transition-all`}>
            <div className={`p-1.5 rounded-lg bg-white/5 shrink-0 mt-0.5`}>
                <Icon size={14} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 leading-snug">{alert.message}</p>
                {ctx && (
                    <p className="text-xs text-slate-500 mt-1">
                        Current: <span className={cfg.color}>{ctx.value}</span>
                        <span className="mx-1.5">·</span>
                        Threshold: {ctx.threshold}
                    </p>
                )}
                <p className="text-xs text-slate-600 mt-1">{fmtDateTime(alert.triggered_at)}</p>
            </div>
            {onResolve && (
                <button onClick={() => onResolve(alert.id)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-slate-600 hover:text-slate-300 transition-colors">
                    <X size={13} />
                </button>
            )}
        </div>
    )
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

function StatusDot({ value, label }) {
    const h = HEALTH[healthOf(value)]
    return (
        <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${value == null ? 'bg-slate-600' : value >= 75 ? 'bg-red-400' : value >= 50 ? 'bg-amber-400' : 'bg-emerald-400'} shrink-0`} />
            <span className="text-xs text-slate-400">{label}</span>
            <span className={`text-xs font-semibold ${h.text}`}>{value != null ? `${value}%` : '—'}</span>
        </div>
    )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview',  label: 'Overview',  icon: Activity },
    { id: 'server',    label: 'Server',    icon: Server },
    { id: 'requests',  label: 'Requests',  icon: Zap },
    { id: 'database',  label: 'Database',  icon: Database },
    { id: 'alerts',    label: 'Alerts',    icon: ShieldAlert },
    { id: 'alerting',  label: 'Alerting',  icon: Settings },
]

const HISTORY_OPTIONS = [
    { label: '30m', value: 30 },
    { label: '1h',  value: 60 },
    { label: '3h',  value: 180 },
    { label: '6h',  value: 360 },
    { label: '24h', value: 1440 },
]

// ─── Main ────────────────────────────────────────────────────────────────────

export default function SystemMonitor() {
    const [tab, setTab] = useState('overview')
    const [current, setCurrent] = useState(null)
    const [history, setHistory] = useState({})
    const [reqStats, setReqStats] = useState(null)
    const [alerts, setAlerts] = useState({ active: [], recent: [] })
    const [historyMinutes, setHistoryMinutes] = useState(60)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const intervalRef = useRef(null)

    // Failed jobs state
    const [failedJobs, setFailedJobs] = useState(null)
    const [failedJobsLoading, setFailedJobsLoading] = useState(false)
    const [jobAction, setJobAction] = useState(null) // { type: 'retry'|'delete'|'retry-all'|'flush', uuid? }

    // Alerting preferences state
    const [prefs, setPrefs] = useState(null)
    const [prefsLoading, setPrefsLoading] = useState(false)
    const [prefsSaving, setPrefsSaving] = useState(false)
    const [prefsSaved, setPrefsSaved] = useState(false)
    const [testSending, setTestSending] = useState(false)
    const [testResult, setTestResult] = useState(null)

    const fetchCurrent = useCallback(async () => {
        const r = await get('/system-monitor/current').catch(() => null)
        if (r?.data) { setCurrent(r.data); setLastRefresh(new Date()) }
    }, [])

    const fetchHistory = useCallback(async () => {
        const r = await get(`/system-monitor/history?minutes=${historyMinutes}`).catch(() => null)
        if (r?.data) { setHistory(r.data) }
    }, [historyMinutes])

    const fetchRequests = useCallback(async () => {
        const r = await get(`/system-monitor/requests?minutes=${historyMinutes}`).catch(() => null)
        if (r?.data) { setReqStats(r.data) }
    }, [historyMinutes])

    const fetchAlerts = useCallback(async () => {
        const r = await get('/system-monitor/alerts').catch(() => null)
        if (r?.data) { setAlerts(r.data) }
    }, [])

    const fetchAll = useCallback(async () => {
        await Promise.all([fetchCurrent(), fetchHistory(), fetchRequests(), fetchAlerts()])
        setLoading(false)
    }, [fetchCurrent, fetchHistory, fetchRequests, fetchAlerts])

    const manualRefresh = async () => {
        setRefreshing(true)
        await fetchAll()
        setRefreshing(false)
    }

    useEffect(() => { fetchAll() }, [fetchAll])

    useEffect(() => {
        if (autoRefresh) { intervalRef.current = setInterval(fetchAll, 10000) }
        else { clearInterval(intervalRef.current) }
        return () => clearInterval(intervalRef.current)
    }, [autoRefresh, fetchAll])

    const resolveAlert = async (id) => {
        await post(`/system-monitor/alerts/${id}/resolve`).catch(() => {})
        fetchAlerts()
    }

    const fetchPrefs = useCallback(async () => {
        if (prefsLoading) { return }
        setPrefsLoading(true)
        const r = await get('/system-monitor/preferences').catch(() => null)
        if (r?.data) { setPrefs(r.data) }
        setPrefsLoading(false)
    }, []) // eslint-disable-line

    const savePrefs = async () => {
        if (!prefs) { return }
        setPrefsSaving(true)
        await put('/system-monitor/preferences', prefs).catch(() => {})
        setPrefsSaving(false)
        setPrefsSaved(true)
        setTimeout(() => setPrefsSaved(false), 3000)
    }

    const sendTestAlert = async () => {
        setTestSending(true)
        setTestResult(null)
        const r = await post('/system-monitor/test-alert').catch(() => null)
        setTestResult(r?.message ?? 'Test alert sent.')
        setTestSending(false)
    }

    useEffect(() => {
        if (tab === 'alerting' && !prefs) { fetchPrefs() }
    }, [tab, prefs, fetchPrefs])

    const setThreshold = (key, val) => {
        setPrefs(p => ({ ...p, thresholds: { ...p.thresholds, [key]: Number(val) } }))
    }

    const fetchFailedJobs = useCallback(async () => {
        setFailedJobsLoading(true)
        const r = await get('/system-monitor/failed-jobs').catch(() => null)
        if (r?.data) { setFailedJobs(r.data) }
        setFailedJobsLoading(false)
    }, [])

    useEffect(() => {
        if (tab === 'database') { fetchFailedJobs() }
    }, [tab, fetchFailedJobs])

    const retryJob = async (uuid) => {
        setJobAction({ type: 'retry', uuid })
        await post(`/system-monitor/failed-jobs/${uuid}/retry`).catch(() => {})
        await fetchFailedJobs()
        setJobAction(null)
    }

    const deleteJob = async (uuid) => {
        setJobAction({ type: 'delete', uuid })
        await del(`/system-monitor/failed-jobs/${uuid}`).catch(() => {})
        setFailedJobs(j => j?.filter(x => x.uuid !== uuid))
        setJobAction(null)
    }

    const retryAllJobs = async () => {
        setJobAction({ type: 'retry-all' })
        await post('/system-monitor/failed-jobs/retry-all').catch(() => {})
        await fetchFailedJobs()
        setJobAction(null)
    }

    const flushJobs = async () => {
        setJobAction({ type: 'flush' })
        await del('/system-monitor/failed-jobs/flush').catch(() => {})
        setFailedJobs([])
        setJobAction(null)
    }

    const buildSeries = (metrics, keys) => {
        const times = new Set()
        Object.values(metrics).forEach(arr => arr?.forEach(p => times.add(p.recorded_at)))
        return [...times].sort().map(ts => {
            const pt = { time: fmtTime(ts) }
            keys.forEach(k => {
                const found = (metrics[k] ?? []).find(p => p.recorded_at === ts)
                pt[k] = found ? +found.value : null
            })
            return pt
        })
    }

    const serverSeries  = buildSeries(history, ['cpu_usage_pct', 'memory_used_pct', 'disk_used_pct'])
    const loadSeries    = buildSeries(history, ['load_1m', 'load_5m', 'load_15m'])
    const queueSeries   = buildSeries(history, ['queue_pending', 'queue_failed'])
    const dbSeries      = buildSeries(history, ['db_connections', 'queue_pending', 'queue_failed'])
    const rpmSeries     = (reqStats?.rpm_timeline ?? []).map(r => ({
        time: fmtTime(r.minute), rpm: +r.count, avg_ms: Math.round(+r.avg_ms),
    }))

    const activeAlerts = alerts.active?.length ?? 0
    const s = current?.server ?? {}
    const a = current?.app ?? {}

    // Derive overall health
    const overallHealth = [s.cpu_pct, s.memory_pct, s.disk_pct].some(v => v >= 90) ? 'critical'
        : activeAlerts > 0 ? 'warning'
        : [s.cpu_pct, s.memory_pct, s.disk_pct].some(v => v >= 75) ? 'warning' : 'good'
    const oh = HEALTH[overallHealth]

    return (
        <AppLayout breadcrumb="System Monitor">
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-3xl mb-6 border border-white/6"
                style={{ background: 'linear-gradient(135deg, #06090f 0%, #0d1424 35%, #131b3a 65%, #0d1a38 100%)' }}>
                {/* Dot grid */}
                <div className="absolute inset-0 opacity-[0.025]"
                    style={{ backgroundImage: 'radial-gradient(rgba(148,163,184,0.8) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                {/* Ambient glows */}
                <div className="absolute -top-16 left-1/3 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #4f46e5, transparent 70%)' }} />
                <div className="absolute -bottom-8 right-1/4 w-56 h-56 rounded-full opacity-15 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)' }} />

                <div className="relative px-8 py-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                        {/* Left */}
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shrink-0">
                                <Server size={22} className="text-indigo-300" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-tight">System Monitor</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Real-time performance &amp; health</p>

                                {/* Status dots */}
                                {!loading && (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
                                        <StatusDot value={s.cpu_pct} label="CPU" />
                                        <span className="w-px h-3 bg-white/10" />
                                        <StatusDot value={s.memory_pct} label="Memory" />
                                        <span className="w-px h-3 bg-white/10" />
                                        <StatusDot value={s.disk_pct} label="Disk" />
                                        <span className="w-px h-3 bg-white/10" />
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${a.queue_failed > 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                            <span className="text-xs text-slate-400">Queue</span>
                                            <span className={`text-xs font-semibold ${a.queue_failed > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {a.queue_failed > 0 ? `${a.queue_failed} failed` : 'healthy'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right — controls */}
                        <div className="flex flex-col items-start sm:items-end gap-3">
                            {/* Overall status pill */}
                            {!loading && (
                                <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full ring-1 text-xs font-semibold backdrop-blur-sm ${oh.badge}`}>
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: oh.stroke }} />
                                    System {oh.label}
                                </div>
                            )}

                            <div className="flex items-center gap-2 flex-wrap">
                                {lastRefresh && (
                                    <span className="text-xs text-slate-600 tabular-nums">
                                        {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                    </span>
                                )}
                                <button onClick={manualRefresh} disabled={refreshing}
                                    className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-white/6 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 transition-all disabled:opacity-50 backdrop-blur-sm">
                                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                                <button onClick={() => setAutoRefresh(v => !v)}
                                    className={`flex items-center gap-1.5 text-xs font-medium rounded-xl px-3 py-1.5 border transition-all backdrop-blur-sm ${autoRefresh
                                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                                    {autoRefresh
                                        ? <><CircleDot size={12} className="text-emerald-400 animate-pulse" /> Live</>
                                        : <><BellOff size={12} /> Paused</>}
                                </button>
                                {activeAlerts > 0 && (
                                    <button onClick={() => setTab('alerts')}
                                        className="flex items-center gap-1.5 text-xs font-semibold bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl px-3 py-1.5 hover:bg-red-500/25 transition-all backdrop-blur-sm">
                                        <ShieldAlert size={12} />
                                        {activeAlerts} Alert{activeAlerts > 1 ? 's' : ''}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            <div className="flex gap-1 p-1.5 bg-slate-900 border border-white/6 rounded-2xl mb-6 overflow-x-auto">
                {TABS.map(t => {
                    const Icon = t.icon
                    const active = tab === t.id
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${active
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/60'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                            <Icon size={13} />
                            {t.label}
                            {t.id === 'alerts' && <AlertBadge count={activeAlerts} />}
                        </button>
                    )
                })}
            </div>

            {/* ── Time range (history tabs) ─────────────────────────────────── */}
            {['server', 'requests', 'database'].includes(tab) && (
                <div className="flex items-center gap-2 mb-5">
                    <span className="text-xs text-slate-600 font-medium">Range</span>
                    <div className="flex gap-1 p-1 rounded-xl bg-slate-900 border border-white/6">
                        {HISTORY_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => setHistoryMinutes(opt.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${historyMinutes === opt.value
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950/60'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Skeleton ─────────────────────────────────────────────────── */}
            {loading && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-52 rounded-2xl bg-slate-900 border border-white/6 animate-pulse" />
                        ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-28 rounded-2xl bg-slate-900 border border-white/6 animate-pulse" />
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* OVERVIEW                                                       */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {!loading && tab === 'overview' && (
                <div className="space-y-5">
                    {/* Ring gauges */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <RingGauge value={s.cpu_pct} label="CPU" icon={Cpu}
                            meta={s.load_1m != null ? `Load avg ${s.load_1m?.toFixed(2)}` : null} />
                        <RingGauge value={s.memory_pct} label="Memory" icon={MemoryStick}
                            meta={s.memory_meta ? `${s.memory_meta.used_gb} / ${s.memory_meta.total_gb} GB` : null} />
                        <RingGauge value={s.disk_pct} label="Disk" icon={HardDrive}
                            meta={s.disk_meta ? `${s.disk_meta.free_gb} GB free` : null} />
                        <RingGauge
                            value={a.requests_5m > 0 ? Math.round((a.requests_5m - a.failed_5m) / a.requests_5m * 100) : (a.requests_5m === 0 ? 100 : null)}
                            label="Success Rate" icon={CheckCircle2}
                            meta={`${a.requests_5m ?? 0} req / 5 min`} />
                    </div>

                    {/* App stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard icon={Users}    label="Active Users (5 min)" value={fmt(a.active_users)}     color="indigo" />
                        <StatCard icon={Zap}      label="Requests / min"        value={fmt(a.rpm)}              color="cyan" />
                        <StatCard icon={Clock}    label="Avg Response (5 min)"  value={fmtMs(a.avg_response_ms)} color="violet" />
                        <StatCard icon={Database} label="DB Connections"         value={fmt(a.db_connections)}   color="blue" />
                        <StatCard icon={Layers}   label="Queue Pending"          value={fmt(a.queue_pending)}    color="amber" />
                        <StatCard icon={XCircle}  label="Failed Jobs"            value={fmt(a.queue_failed)}
                            color={a.queue_failed > 0 ? 'red' : 'emerald'} />
                        <StatCard icon={ShieldAlert} label="Active Alerts"       value={fmt(activeAlerts)}
                            color={activeAlerts > 0 ? 'red' : 'emerald'} />
                        <StatCard icon={Activity} label="Failed Requests (5 min)" value={fmt(a.failed_5m)}
                            color={a.failed_5m > 0 ? 'rose' : 'emerald'} />
                    </div>

                    {/* Trend chart */}
                    {serverSeries.length > 1 && (
                        <ChartPanel title="Resource Usage" subtitle="CPU · Memory · Disk over time">
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={serverSeries} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                                    <defs>
                                        {[['cpu', '#6366f1'], ['mem', '#3b82f6'], ['disk', '#10b981']].map(([k, c]) => (
                                            <linearGradient key={k} id={`ov-${k}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={c} stopOpacity={0.25} />
                                                <stop offset="95%" stopColor={c} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
                                    <Tooltip {...CHART_TOOLTIP} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 12 }} />
                                    <Area type="monotone" dataKey="cpu_usage_pct"   name="CPU"    stroke="#6366f1" fill="url(#ov-cpu)"  strokeWidth={2} dot={false} />
                                    <Area type="monotone" dataKey="memory_used_pct" name="Memory" stroke="#3b82f6" fill="url(#ov-mem)"  strokeWidth={2} dot={false} />
                                    <Area type="monotone" dataKey="disk_used_pct"   name="Disk"   stroke="#10b981" fill="url(#ov-disk)" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartPanel>
                    )}

                    {/* Active alerts inline */}
                    {activeAlerts > 0 && (
                        <div className="rounded-2xl bg-slate-900 border border-red-500/25 border-l-4 border-l-red-500 overflow-hidden">
                            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/6">
                                <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                                    <ShieldAlert size={14} /> Active Alerts
                                </h3>
                                {activeAlerts > 3 && (
                                    <button onClick={() => setTab('alerts')}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                        View all {activeAlerts} →
                                    </button>
                                )}
                            </div>
                            <div className="p-4 space-y-2">
                                {alerts.active.slice(0, 3).map(al => (
                                    <AlertItem key={al.id} alert={al} onResolve={resolveAlert} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SERVER                                                         */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {!loading && tab === 'server' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <RingGauge value={s.cpu_pct} label="CPU Usage" icon={Cpu} />
                        <RingGauge value={s.memory_pct} label="Memory" icon={MemoryStick}
                            meta={s.memory_meta ? `${s.memory_meta.used_gb} / ${s.memory_meta.total_gb} GB` : null} />
                        <RingGauge value={s.disk_pct} label="Disk" icon={HardDrive}
                            meta={s.disk_meta ? `${s.disk_meta.free_gb} GB free of ${s.disk_meta.total_gb} GB` : null} />

                        {/* Load average card */}
                        <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-900 border border-white/6 border-t-2 border-t-violet-500/60">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl ring-1 bg-violet-500/10 text-violet-400 ring-violet-500/20">
                                    <TrendingUp size={15} />
                                </div>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Load Average</span>
                            </div>
                            <div className="space-y-3">
                                {[['1 min', s.load_1m], ['5 min', s.load_5m], ['15 min', s.load_15m]].map(([lbl, val]) => {
                                    const pct = val != null ? Math.min(100, (val / 8) * 100) : 0
                                    return (
                                        <div key={lbl}>
                                            <div className="flex justify-between text-xs mb-1.5">
                                                <span className="text-slate-500">{lbl}</span>
                                                <span className={`font-bold tabular-nums ${(val ?? 0) > 4 ? 'text-red-400' : (val ?? 0) > 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {val?.toFixed(2) ?? '—'}
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{
                                                        width: `${pct}%`,
                                                        background: (val ?? 0) > 4 ? '#ef4444' : (val ?? 0) > 2 ? '#f59e0b' : '#10b981',
                                                    }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {serverSeries.length > 0 && (
                        <ChartPanel title="CPU · Memory · Disk" subtitle={`Last ${historyMinutes} minutes`}>
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={serverSeries} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                                    <defs>
                                        {[['cpu2', '#6366f1'], ['mem2', '#3b82f6'], ['disk2', '#10b981']].map(([k, c]) => (
                                            <linearGradient key={k} id={k} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={c} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={c} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
                                    <Tooltip {...CHART_TOOLTIP} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 12 }} />
                                    <Area type="monotone" dataKey="cpu_usage_pct"   name="CPU %"    stroke="#6366f1" fill="url(#cpu2)"  strokeWidth={2} dot={false} />
                                    <Area type="monotone" dataKey="memory_used_pct" name="Memory %" stroke="#3b82f6" fill="url(#mem2)"  strokeWidth={2} dot={false} />
                                    <Area type="monotone" dataKey="disk_used_pct"   name="Disk %"   stroke="#10b981" fill="url(#disk2)" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartPanel>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {loadSeries.length > 0 && (
                            <ChartPanel title="Load Average" subtitle="1 · 5 · 15 minute averages">
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={loadSeries} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                                        <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip {...CHART_TOOLTIP} />
                                        <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 12 }} />
                                        <Line type="monotone" dataKey="load_1m"  name="1 min"  stroke="#f59e0b" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="load_5m"  name="5 min"  stroke="#fb923c" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="load_15m" name="15 min" stroke="#ef4444" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartPanel>
                        )}

                        {queueSeries.length > 0 && (
                            <ChartPanel title="Queue" subtitle="Pending · Failed jobs over time">
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={queueSeries} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                                        <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip {...CHART_TOOLTIP} />
                                        <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 12 }} />
                                        <Bar dataKey="queue_pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="queue_failed"  name="Failed"  fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartPanel>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* REQUESTS                                                       */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {!loading && tab === 'requests' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard icon={Zap}        label="Total Requests"      value={fmt(reqStats?.total)}       color="indigo" />
                        <StatCard icon={CheckCircle2} label="Success Rate"       value={`${reqStats?.success_rate ?? 100}%`}
                            color={(reqStats?.success_rate ?? 100) < 95 ? 'red' : 'emerald'} />
                        <StatCard icon={Clock}      label="Avg Response"         value={fmtMs(reqStats?.avg_ms)}    color="violet" />
                        <StatCard icon={AlertTriangle} label="Failed Requests"   value={fmt(reqStats?.failed)}
                            color={reqStats?.failed > 0 ? 'red' : 'emerald'} />
                        <StatCard icon={TrendingUp} label="P95 Response"         value={fmtMs(reqStats?.p95_ms)}    color="amber" />
                        <StatCard icon={TrendingUp} label="P99 Response"         value={fmtMs(reqStats?.p99_ms)}    color="rose" />
                        <StatCard icon={Activity}   label="Slow Requests (>2s)"  value={fmt(reqStats?.slow_count)}  color="amber" />
                        <StatCard icon={Wifi}       label="Time Window"           value={`${historyMinutes}m`}       color="blue" />
                    </div>

                    {rpmSeries.length > 0 && (
                        <ChartPanel title="Requests &amp; Latency" subtitle="Volume bars · Avg response time line">
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={rpmSeries} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis yAxisId="l" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis yAxisId="r" orientation="right" tick={{ fill: '#475569', fontSize: 11 }} unit="ms" axisLine={false} tickLine={false} />
                                    <Tooltip {...CHART_TOOLTIP} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 12 }} />
                                    <Bar yAxisId="l" dataKey="rpm" name="Requests" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.8} />
                                    <Line yAxisId="r" type="monotone" dataKey="avg_ms" name="Avg ms" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </ChartPanel>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* HTTP status */}
                        {reqStats?.by_status?.length > 0 && (
                            <ChartPanel title="HTTP Status Codes" subtitle="Distribution by response code">
                                <div className="flex flex-wrap gap-2">
                                    {reqStats.by_status.map(row => {
                                        const code = row.status_code
                                        const [bg, text] = code >= 500 ? ['bg-red-500/15 ring-red-500/25', 'text-red-400']
                                            : code >= 400 ? ['bg-amber-500/15 ring-amber-500/25', 'text-amber-400']
                                            : code >= 300 ? ['bg-blue-500/15 ring-blue-500/25', 'text-blue-400']
                                            : ['bg-emerald-500/15 ring-emerald-500/25', 'text-emerald-400']
                                        return (
                                            <div key={code} className={`flex items-baseline gap-2 px-3.5 py-2.5 rounded-xl ring-1 ${bg}`}>
                                                <span className={`text-lg font-bold tabular-nums ${text}`}>{code}</span>
                                                <span className="text-xs text-slate-500">{row.count.toLocaleString()} req</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </ChartPanel>
                        )}

                        {/* Error paths */}
                        {reqStats?.error_paths?.length > 0 && (
                            <ChartPanel title="Top Error Endpoints" subtitle="Most frequent 4xx / 5xx paths">
                                <div className="space-y-3">
                                    {reqStats.error_paths.map((row, i) => {
                                        const pct = Math.min(100, (row.count / (reqStats.error_paths[0]?.count ?? 1)) * 100)
                                        return (
                                            <div key={i}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-red-400 w-9 shrink-0">{row.status_code}</span>
                                                    <span className="text-xs text-slate-400 font-mono flex-1 truncate">{row.path}</span>
                                                    <span className="text-xs text-slate-600 shrink-0 tabular-nums">{row.count}×</span>
                                                </div>
                                                <div className="h-1 rounded-full bg-white/5 overflow-hidden ml-11">
                                                    <div className="h-full rounded-full bg-linear-to-r from-red-600 to-red-400 transition-all"
                                                        style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </ChartPanel>
                        )}
                    </div>

                    {/* Slowest requests table */}
                    {reqStats?.top_slow?.length > 0 && (
                        <ChartPanel title="Slowest Requests" subtitle="Top 10 by response time">
                            <div className="overflow-x-auto -mx-1">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-white/6">
                                            <th className="text-left pb-3 pr-4 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Method</th>
                                            <th className="text-left pb-3 pr-4 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Path</th>
                                            <th className="text-left pb-3 pr-4 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
                                            <th className="text-right pb-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/4">
                                        {reqStats.top_slow.map((row, i) => (
                                            <tr key={i} className="group hover:bg-white/3 transition-colors">
                                                <td className="py-2.5 pr-4">
                                                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-mono font-semibold text-[10px]">
                                                        {row.method}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 pr-4 text-slate-400 font-mono max-w-xs truncate">{row.path}</td>
                                                <td className="py-2.5 pr-4">
                                                    <span className={`font-semibold ${row.status_code >= 400 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {row.status_code}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 text-right font-bold tabular-nums text-amber-400">{fmtMs(row.duration_ms)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </ChartPanel>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* DATABASE                                                       */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {!loading && tab === 'database' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard icon={Database}     label="Active Connections" value={fmt(a.db_connections)} color="blue" />
                        <StatCard icon={Layers}       label="Queue Pending"      value={fmt(a.queue_pending)}  color="amber" />
                        <StatCard icon={XCircle}      label="Failed Jobs"        value={fmt(a.queue_failed)}
                            color={a.queue_failed > 0 ? 'red' : 'emerald'} />
                        <StatCard icon={Activity}     label="Slow Queries"       value={fmt((history.db_slow_queries ?? []).at(-1)?.value ?? 0)} color="rose" />
                    </div>

                    {dbSeries.length > 0 && (
                        <ChartPanel title="Database &amp; Queue History" subtitle={`Last ${historyMinutes} minutes`}>
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={dbSeries} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                                    <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip {...CHART_TOOLTIP} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 12 }} />
                                    <Line type="monotone" dataKey="db_connections"  name="DB Connections" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="queue_pending"   name="Queue Pending"  stroke="#f59e0b" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="queue_failed"    name="Queue Failed"   stroke="#ef4444" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartPanel>
                    )}

                    <div className="rounded-2xl bg-slate-900 border border-white/6 overflow-hidden">
                        <div className="px-6 pt-5 pb-4 border-b border-white/6">
                            <h3 className="text-sm font-semibold text-slate-200">Queue Health</h3>
                        </div>
                        <div className="p-6">
                            {a.queue_failed === 0 ? (
                                <div className="flex items-center gap-3 text-sm text-emerald-400">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                        <p className="font-semibold">No failed jobs</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Queue is processing normally</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3 text-sm text-amber-400">
                                    <div className="p-2 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 shrink-0">
                                        <AlertTriangle size={16} />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{a.queue_failed} failed job{a.queue_failed > 1 ? 's' : ''}</p>
                                        <p className="text-xs text-slate-500 mt-1">Use the panel below to inspect, retry, or delete.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Failed Jobs list */}
                    <div className="rounded-2xl bg-slate-900 border border-white/6 overflow-hidden">
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/6 bg-white/2">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${(failedJobs?.length ?? 0) > 0 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                    <XCircle size={14} />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-100">Failed Jobs</h3>
                                {failedJobs?.length > 0 && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{failedJobs.length}</span>
                                )}
                            </div>
                            {failedJobs?.length > 0 && (
                                <div className="flex gap-2">
                                    <button onClick={retryAllJobs} disabled={!!jobAction}
                                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/25 transition-all disabled:opacity-50">
                                        {jobAction?.type === 'retry-all'
                                            ? <RefreshCw size={12} className="animate-spin" />
                                            : <RotateCcw size={12} />}
                                        Retry All
                                    </button>
                                    <button onClick={flushJobs} disabled={!!jobAction}
                                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                        {jobAction?.type === 'flush'
                                            ? <RefreshCw size={12} className="animate-spin" />
                                            : <Trash2 size={12} />}
                                        Delete All
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-4">
                            {failedJobsLoading && (
                                <div className="space-y-2">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse" />
                                    ))}
                                </div>
                            )}

                            {!failedJobsLoading && failedJobs?.length === 0 && (
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                    <p className="text-sm text-emerald-400 font-medium">No failed jobs — queue is healthy</p>
                                </div>
                            )}

                            {!failedJobsLoading && failedJobs?.length > 0 && (
                                <div className="space-y-2">
                                    {failedJobs.map(job => {
                                        const busy = jobAction?.uuid === job.uuid
                                        return (
                                            <div key={job.uuid}
                                                className="flex items-start gap-4 p-4 rounded-xl bg-red-950/20 border border-red-500/15 hover:border-red-500/25 transition-all">
                                                <div className="p-2 rounded-lg bg-red-500/10 text-red-400 shrink-0 mt-0.5">
                                                    <XCircle size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-semibold text-slate-200">{job.job_name}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 border border-white/8 text-slate-400 font-mono">{job.queue}</span>
                                                    </div>
                                                    <p className="text-xs text-red-400/80 mt-1 font-mono leading-relaxed truncate" title={job.error}>{job.error}</p>
                                                    <p className="text-xs text-slate-600 mt-1">{fmtDateTime(job.failed_at)}</p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => retryJob(job.uuid)} disabled={!!jobAction}
                                                        title="Retry this job"
                                                        className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all disabled:opacity-50">
                                                        {busy && jobAction?.type === 'retry'
                                                            ? <RefreshCw size={13} className="animate-spin" />
                                                            : <RotateCcw size={13} />}
                                                    </button>
                                                    <button onClick={() => deleteJob(job.uuid)} disabled={!!jobAction}
                                                        title="Delete this job"
                                                        className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                                        {busy && jobAction?.type === 'delete'
                                                            ? <RefreshCw size={13} className="animate-spin" />
                                                            : <Trash2 size={13} />}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ALERTS                                                         */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {!loading && tab === 'alerts' && (
                <div className="space-y-5">
                    {/* Active */}
                    <div className="rounded-2xl bg-slate-900 border border-white/6 overflow-hidden">
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/6 bg-white/2">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${alerts.active?.length > 0 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                    <ShieldAlert size={14} />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-100">Active Alerts</h3>
                                {alerts.active?.length > 0 && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                                        {alerts.active.length}
                                    </span>
                                )}
                            </div>
                            {alerts.active?.length > 0 && (
                                <span className="text-xs text-slate-500">Click × to resolve</span>
                            )}
                        </div>
                        <div className="p-4">
                            {alerts.active?.length === 0 ? (
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-emerald-400">All systems operational</p>
                                        <p className="text-xs text-slate-500 mt-0.5">No active alerts detected</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {alerts.active.map(al => (
                                        <AlertItem key={al.id} alert={al} onResolve={resolveAlert} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Resolved */}
                    {alerts.recent?.length > 0 && (
                        <div className="rounded-2xl bg-slate-900 border border-white/6 overflow-hidden">
                            <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-white/6 bg-white/2">
                                <div className="p-1.5 rounded-lg bg-slate-500/15 text-slate-400">
                                    <CheckCircle2 size={14} />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-100">Resolved — last 24h</h3>
                                <span className="text-xs text-slate-600">({alerts.recent.length})</span>
                            </div>
                            <div className="p-4 space-y-2">
                                {alerts.recent.map(al => (
                                    <div key={al.id}
                                        className="flex items-start gap-3 p-3 rounded-xl bg-white/2 border border-white/5">
                                        <CheckCircle2 size={13} className="text-emerald-500/60 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-500 truncate">{al.message}</p>
                                            <p className="text-xs text-slate-700 mt-0.5">Resolved {fmtDateTime(al.resolved_at)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ALERTING CONFIG                                                */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {!loading && tab === 'alerting' && (
                <div className="space-y-5">
                    {prefsLoading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-40 rounded-2xl bg-slate-900 border border-white/6 animate-pulse" />
                            ))}
                        </div>
                    )}

                    {prefs && (
                        <>
                            {/* Channels + Severity side-by-side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Notification channels */}
                            <div className="rounded-2xl bg-slate-900 border border-white/6 overflow-hidden">
                                <div className="px-6 pt-5 pb-4 border-b border-white/6 bg-white/2 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 text-indigo-400">
                                        <Bell size={15} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-100">Notification Channels</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Where to send alert notifications</p>
                                    </div>
                                </div>
                                <div className="divide-y divide-white/6">
                                    {[
                                        { key: 'email_enabled', icon: Mail, iconCls: 'bg-blue-500/10 text-blue-400', label: 'Email notifications', desc: 'Send alert emails to your account', toggle: true },
                                        { key: null,            icon: Bell, iconCls: 'bg-violet-500/10 text-violet-400', label: 'In-app notifications', desc: 'Alerts in notification bell', alwaysOn: true },
                                        { key: 'anomaly_detection', icon: FlaskConical, iconCls: 'bg-violet-500/10 text-violet-400', label: 'Anomaly detection', desc: 'Statistical spikes, surges, error rate changes', toggle: true },
                                    ].map(row => (
                                        <div key={row.label} className="flex items-center justify-between px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ring-1 ring-white/10 ${row.iconCls}`}>
                                                    <row.icon size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-200">{row.label}</p>
                                                    <p className="text-xs text-slate-500">{row.desc}</p>
                                                </div>
                                            </div>
                                            {row.alwaysOn ? (
                                                <span className="text-xs text-emerald-400 font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20">Always on</span>
                                            ) : (
                                                <button onClick={() => setPrefs(p => ({ ...p, [row.key]: !p[row.key] }))} className="transition-colors shrink-0">
                                                    {prefs[row.key]
                                                        ? <ToggleRight size={30} className="text-indigo-400" />
                                                        : <ToggleLeft size={30} className="text-slate-600" />}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Minimum severity */}
                            <div className="rounded-2xl bg-slate-900 border border-white/6 overflow-hidden">
                                <div className="px-6 pt-5 pb-4 border-b border-white/6 bg-white/2 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-400">
                                        <AlertTriangle size={15} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-100">Minimum Severity</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Only notify for alerts at or above this level</p>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="flex flex-col gap-2">
                                        {[
                                            { v: 'warning',  label: 'Warning & above',  desc: 'Notified for both warning and critical alerts', icon: AlertTriangle, color: 'amber' },
                                            { v: 'critical', label: 'Critical only',     desc: 'Only notified for critical severity alerts',     icon: XCircle,       color: 'red' },
                                        ].map(opt => {
                                            const active = prefs.min_severity === opt.v
                                            const Icon = opt.icon
                                            return (
                                                <button key={opt.v} onClick={() => setPrefs(p => ({ ...p, min_severity: opt.v }))}
                                                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${active
                                                        ? opt.color === 'red'
                                                            ? 'bg-red-500/10 border-red-500/40 text-red-300'
                                                            : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                                        : 'bg-white/3 border-white/8 text-slate-400 hover:border-white/15 hover:bg-white/5'}`}>
                                                    <div className={`p-2 rounded-lg shrink-0 ${active
                                                        ? opt.color === 'red' ? 'bg-red-500/15' : 'bg-amber-500/15'
                                                        : 'bg-white/5'}`}>
                                                        <Icon size={14} className={active ? '' : 'opacity-50'} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold">{opt.label}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                                    </div>
                                                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active
                                                        ? opt.color === 'red' ? 'border-red-400 bg-red-400' : 'border-amber-400 bg-amber-400'
                                                        : 'border-slate-600'}`}>
                                                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                            </div>{/* end two-column grid */}

                            {/* Thresholds */}
                            <div className="rounded-2xl bg-slate-900 border border-white/6 overflow-hidden">
                                <div className="px-6 pt-5 pb-4 border-b border-white/6 bg-white/2 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20 text-rose-400">
                                        <Search size={15} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-100">Alert Thresholds</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Trigger values for each metric</p>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {[
                                            { group: 'CPU (%)',          warn: 'cpu_warning',    crit: 'cpu_critical',    icon: Cpu,         color: 'indigo' },
                                            { group: 'Memory (%)',       warn: 'memory_warning', crit: 'memory_critical', icon: MemoryStick, color: 'blue' },
                                            { group: 'Disk (%)',         warn: 'disk_warning',   crit: 'disk_critical',   icon: HardDrive,   color: 'emerald' },
                                            { group: 'Failed Jobs',      warn: null,             crit: 'failed_jobs',     icon: XCircle,     color: 'red' },
                                        ].map(({ group, warn, crit, icon: Icon, color }) => {
                                            const iconColors = {
                                                indigo: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20',
                                                blue: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
                                                emerald: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
                                                red: 'bg-red-500/10 text-red-400 ring-red-500/20',
                                            }
                                            return (
                                                <div key={group} className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg ring-1 ${iconColors[color]}`}>
                                                            <Icon size={12} />
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{group}</span>
                                                    </div>
                                                    {warn && (
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs text-amber-400 w-14 shrink-0">Warning</span>
                                                            <input type="range" min="10" max="99" step="5"
                                                                value={prefs.thresholds[warn]}
                                                                onChange={e => setThreshold(warn, e.target.value)}
                                                                className="flex-1 accent-amber-500 h-1.5 rounded-full" />
                                                            <span className="text-xs font-bold tabular-nums text-amber-400 w-10 text-right">
                                                                {prefs.thresholds[warn]}%
                                                            </span>
                                                        </div>
                                                    )}
                                                    {crit && (
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs text-red-400 w-14 shrink-0">Critical</span>
                                                            <input type="range" min="10" max="100" step="5"
                                                                value={prefs.thresholds[crit]}
                                                                onChange={e => setThreshold(crit, e.target.value)}
                                                                className="flex-1 accent-red-500 h-1.5 rounded-full" />
                                                            <span className="text-xs font-bold tabular-nums text-red-400 w-10 text-right">
                                                                {prefs.thresholds[crit]}{group === 'Failed Jobs' ? '' : '%'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Anomaly detection info */}
                            {prefs.anomaly_detection && (
                                <div className="rounded-2xl overflow-hidden border border-violet-500/20"
                                    style={{ background: 'linear-gradient(135deg, #0d0a1e 0%, #130d2e 50%, #0f0a20 100%)' }}>
                                    {/* Header */}
                                    <div className="relative px-6 pt-6 pb-5 border-b border-violet-500/15 overflow-hidden">
                                        <div className="absolute inset-0 opacity-30"
                                            style={{ background: 'radial-gradient(ellipse at 20% 50%, #7c3aed22 0%, transparent 60%)' }} />
                                        <div className="relative flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-400">
                                                    <FlaskConical size={16} />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-violet-100">Anomaly Detection</h3>
                                                    <p className="text-xs text-violet-400/60 mt-0.5">5 patterns · checked every 60s</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/25">
                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                                <span className="text-xs font-semibold text-violet-300">Active</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pattern cards */}
                                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {[
                                            { label: 'CPU Spike',           trigger: '>3σ + >20% jump',    icon: Cpu,           color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
                                            { label: 'Memory Spike',        trigger: '>3σ + >15% jump',    icon: MemoryStick,   color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
                                            { label: 'Response Time Spike', trigger: '>3× baseline 500ms', icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
                                            { label: 'Error Rate Surge',    trigger: '>15% of requests',   icon: AlertTriangle, color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
                                            { label: 'Queue Buildup',       trigger: '>4× baseline 50+',   icon: Layers,        color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
                                        ].map(item => (
                                            <div key={item.label}
                                                className={`flex flex-col gap-3 p-4 rounded-xl border ${item.bg} ${item.border}`}>
                                                <div className={`w-8 h-8 flex items-center justify-center rounded-lg border ${item.bg} ${item.border} ${item.color}`}>
                                                    <item.icon size={15} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-200 leading-tight">{item.label}</p>
                                                    <p className={`text-xs font-semibold mt-1 ${item.color} opacity-80`}>{item.trigger}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions row */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-5 rounded-2xl bg-slate-900 border border-white/6">
                                <button onClick={savePrefs} disabled={prefsSaving}
                                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all disabled:opacity-60 shadow-lg shadow-indigo-900/50">
                                    {prefsSaving
                                        ? <><RefreshCw size={14} className="animate-spin" /> Saving…</>
                                        : prefsSaved
                                            ? <><CheckCircle2 size={14} className="text-emerald-300" /> Saved!</>
                                            : <><Save size={14} /> Save Preferences</>}
                                </button>

                                <button onClick={sendTestAlert} disabled={testSending}
                                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm font-medium transition-all disabled:opacity-60">
                                    {testSending
                                        ? <><RefreshCw size={14} className="animate-spin" /> Sending…</>
                                        : <><FlaskConical size={14} /> Send Test Alert</>}
                                </button>

                                {testResult && (
                                    <span className="text-xs text-emerald-400 flex items-center gap-1.5 ml-1">
                                        <CheckCircle2 size={12} /> {testResult}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </AppLayout>
    )
}
