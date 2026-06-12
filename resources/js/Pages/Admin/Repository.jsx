import { useState, useEffect, useCallback } from 'react'
import {
    Database, Star, BookOpen, Award, BarChart3, Building2,
    Calendar, Globe, Plus, X, CheckCircle2, Archive,
    Search, RefreshCw, Tag, Users, Pencil,
    Microscope, Lightbulb, Handshake, TrendingUp,
    Eye, FlaskConical, Sparkles,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import { useConfirm } from '../../hooks/useConfirm'
import { getCategoryLabel, cn } from '../../lib/utils'
import api from '../../lib/api'

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CFG = {
    research:             { icon: Microscope, bg: 'bg-blue-500',   light: 'bg-blue-50 text-blue-700 border-blue-200',     accent: 'border-l-blue-500' },
    community_engagement: { icon: Handshake,  bg: 'bg-green-500',  light: 'bg-green-50 text-green-700 border-green-200',   accent: 'border-l-green-500' },
    technology_transfer:  { icon: TrendingUp, bg: 'bg-purple-500', light: 'bg-purple-50 text-purple-700 border-purple-200', accent: 'border-l-purple-500' },
    innovation:           { icon: Lightbulb,  bg: 'bg-orange-500', light: 'bg-orange-50 text-orange-700 border-orange-200', accent: 'border-l-orange-500' },
}

const catCfg = (cat) => CATEGORY_CFG[cat] ?? { icon: FlaskConical, bg: 'bg-gray-400', light: 'bg-gray-50 text-gray-600 border-gray-200', accent: 'border-l-gray-300' }

function CatBadge({ category }) {
    const c    = catCfg(category)
    const Icon = c.icon
    return (
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border', c.light)}>
            <Icon size={10} />{getCategoryLabel(category)}
        </span>
    )
}

function StatusPill({ status }) {
    return status === 'published'
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={9} />Published</span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200"><Archive size={9} />Archived</span>
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats, loading }) {
    const items = [
        { label: 'Published',    value: stats?.total_published,  icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Featured',     value: stats?.featured_count,   icon: Star,         color: 'text-amber-600',   bg: 'bg-amber-50' },
        { label: 'Archived',     value: stats?.total_archived,   icon: Archive,      color: 'text-gray-500',    bg: 'bg-gray-100' },
        { label: 'Ready',        value: stats?.publishable,      icon: Plus,         color: 'text-indigo-600',  bg: 'bg-indigo-50' },
        { label: 'Total Outputs',value: stats?.total_outputs,    icon: BarChart3,    color: 'text-blue-600',    bg: 'bg-blue-50' },
    ]

    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-7">
            {items.map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 hover:shadow-md transition-shadow">
                    <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center mb-2', bg)}>
                        <Icon size={14} className={color} />
                    </div>
                    {loading
                        ? <div className="h-7 w-12 bg-gray-100 rounded-lg animate-pulse mb-1" />
                        : <p className={cn('text-2xl font-bold leading-none', color)}>{value ?? 0}</p>
                    }
                    <p className="text-[11px] text-gray-400 mt-1 font-medium">{label}</p>
                </div>
            ))}
        </div>
    )
}

// ─── Publish modal (new record) ───────────────────────────────────────────────

function PublishModal({ proposal, onClose, onSuccess }) {
    const { error }        = useToast()
    const [saving, setSaving] = useState(false)
    const [form, setForm]  = useState({ abstract: '', keywords: '', is_featured: false })
    const set = (k, v)     => setForm(p => ({ ...p, [k]: v }))

    const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
    const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5'

    const submit = async () => {
        setSaving(true)
        try {
            await api.post(`/admin/repository/${proposal.id}/publish`, form)
            onSuccess(`"${proposal.title}" published to the repository.`)
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to publish.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col">
                <div className="bg-linear-to-r from-indigo-600 to-violet-600 rounded-t-3xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Publish to Repository</h2>
                        <p className="text-indigo-100 text-xs mt-0.5 line-clamp-1">{proposal.title}</p>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Proposal info */}
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <CatBadge category={proposal.category} />
                            <span className="font-mono text-[10px] text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">{proposal.tracker_number}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {[['PI', proposal.pi?.name], ['College', proposal.college?.name], ['Year', proposal.academic_year], ['Status', proposal.status]].map(([lbl, val]) => val ? (
                                <p key={lbl}><span className="text-gray-400 font-medium">{lbl}: </span><span className="text-gray-700 font-semibold">{val}</span></p>
                            ) : null)}
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Abstract <span className="text-gray-300 font-normal">(optional — leave blank to use proposal abstract)</span></label>
                        <textarea value={form.abstract} onChange={e => set('abstract', e.target.value)}
                            rows={4} className={`${inputCls} resize-none`} placeholder="Leave blank to use the proposal's abstract…" />
                    </div>
                    <div>
                        <label className={labelCls}>Keywords <span className="text-gray-300 font-normal">(comma-separated)</span></label>
                        <input value={form.keywords} onChange={e => set('keywords', e.target.value)}
                            className={inputCls} placeholder="machine learning, agriculture, water…" />
                    </div>
                    <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
                        <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)}
                            className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800 flex items-center gap-1"><Star size={13} className="text-amber-500" /> Mark as Featured Research</p>
                            <p className="text-xs text-amber-600 mt-0.5">Featured research appears highlighted in the public repository</p>
                        </div>
                    </label>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-3xl">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 shadow-sm shadow-indigo-200">
                        {saving ? 'Publishing…' : 'Publish to Repository'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Edit record modal ────────────────────────────────────────────────────────

function EditRecordModal({ record, onClose, onSuccess }) {
    const { error }        = useToast()
    const [saving, setSaving] = useState(false)
    const [form, setForm]  = useState({
        abstract:    record.abstract    ?? '',
        keywords:    record.keywords    ?? '',
        is_featured: !!record.is_featured,
        status:      record.status      ?? 'published',
    })
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

    const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
    const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5'

    const submit = async () => {
        setSaving(true)
        try {
            await api.patch(`/admin/repository/${record.id}`, form)
            onSuccess('Repository record updated.')
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to update record.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col">
                <div className="bg-linear-to-r from-slate-700 to-slate-900 rounded-t-3xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Edit Repository Record</h2>
                        <p className="text-slate-300 text-xs mt-0.5 line-clamp-1">{record.title}</p>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className={labelCls}>Abstract</label>
                        <textarea value={form.abstract} onChange={e => set('abstract', e.target.value)}
                            rows={5} className={`${inputCls} resize-none`} placeholder="Public-facing abstract…" />
                    </div>
                    <div>
                        <label className={labelCls}>Keywords <span className="text-gray-300 font-normal">(comma-separated)</span></label>
                        <input value={form.keywords} onChange={e => set('keywords', e.target.value)}
                            className={inputCls} placeholder="keyword1, keyword2, keyword3…" />
                    </div>
                    <div>
                        <label className={labelCls}>Visibility Status</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { val: 'published', label: 'Published', desc: 'Visible in public repository', icon: CheckCircle2, color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                                { val: 'archived',  label: 'Archived',  desc: 'Hidden from public view',      icon: Archive,       color: 'border-gray-400 bg-gray-50 text-gray-600' },
                            ].map(({ val, label, desc, icon: Icon, color }) => (
                                <button key={val} type="button" onClick={() => set('status', val)}
                                    className={cn('flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                                        form.status === val ? color : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300')}>
                                    <Icon size={16} className="shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold">{label}</p>
                                        <p className="text-[10px] opacity-70">{desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
                        <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)}
                            className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800 flex items-center gap-1"><Star size={13} className="text-amber-500" /> Featured Research</p>
                            <p className="text-xs text-amber-600">Highlighted in the public repository hero section</p>
                        </div>
                    </label>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-3xl">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-all disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Published / archived record card ────────────────────────────────────────

function RecordCard({ record, onEdit, onToggleFeatured, onArchive, onRepublish }) {
    const c = catCfg(record.category)
    return (
        <article className={cn(
            'bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200',
            'overflow-hidden flex flex-col border-l-4', c.accent
        )}>
            {/* Body */}
            <div className="p-4 flex-1">
                <div className="flex items-start gap-3">
                    <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0', c.bg)}>
                        <c.icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <CatBadge category={record.category} />
                            <StatusPill status={record.status} />
                            {record.is_featured && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    <Star size={9} fill="currentColor" />Featured
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">{record.title}</h3>
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {record.college?.name && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Building2 size={10} className="shrink-0" />{record.college.name}
                        </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Users size={10} className="shrink-0" />{record.pi_name}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={10} className="shrink-0" />{record.academic_year}
                    </span>
                </div>

                {/* Output counts */}
                {(record.total_outputs > 0 || record.publications_count > 0 || record.patents_count > 0) && (
                    <div className="flex items-center gap-3 mt-2.5">
                        {record.total_outputs > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                                <BarChart3 size={10} className="text-indigo-400" />{record.total_outputs} output{record.total_outputs !== 1 ? 's' : ''}
                            </span>
                        )}
                        {record.publications_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                                <BookOpen size={10} className="text-blue-400" />{record.publications_count} pub{record.publications_count !== 1 ? 's' : ''}
                            </span>
                        )}
                        {record.patents_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                                <Award size={10} className="text-amber-400" />{record.patents_count} patent{record.patents_count !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                )}

                {/* Keywords */}
                {record.keywords && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-50">
                        {String(record.keywords).split(',').slice(0, 4).map(kw => (
                            <span key={kw.trim()} className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-lg border border-gray-100">
                                <Tag size={8} />{kw.trim()}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Action toolbar */}
            <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/50 flex items-center justify-between gap-2">
                <a href="/repository" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors font-medium">
                    <Eye size={12} /> View public
                </a>
                <div className="flex items-center gap-1">
                    <button onClick={() => onToggleFeatured(record)}
                        className={cn('h-7 w-7 rounded-lg flex items-center justify-center transition-colors',
                            record.is_featured ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-white text-gray-300 hover:text-amber-500 hover:bg-amber-50 border border-gray-200')}
                        title={record.is_featured ? 'Remove from featured' : 'Mark as featured'}>
                        <Star size={13} fill={record.is_featured ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => onEdit(record)}
                        className="h-7 w-7 rounded-lg bg-white border border-gray-200 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 flex items-center justify-center transition-colors"
                        title="Edit record">
                        <Pencil size={12} />
                    </button>
                    {record.status === 'published'
                        ? <button onClick={() => onArchive(record)}
                            className="h-7 w-7 rounded-lg bg-white border border-gray-200 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                            title="Archive (remove from public)">
                            <Archive size={12} />
                          </button>
                        : <button onClick={() => onRepublish(record)}
                            className="h-7 w-7 rounded-lg bg-white border border-gray-200 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 flex items-center justify-center transition-colors"
                            title="Re-publish">
                            <CheckCircle2 size={12} />
                          </button>
                    }
                </div>
            </div>
        </article>
    )
}

// ─── Publishable proposal card ────────────────────────────────────────────────

function PublishableCard({ proposal, onPublish }) {
    const c = catCfg(proposal.category)
    return (
        <article className={cn(
            'bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200',
            'flex flex-col border-l-4 border-l-dashed', c.accent
        )}>
            <div className="p-4 flex items-start gap-3">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center text-white/80 bg-gray-100 shrink-0')}>
                    <c.icon size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <CatBadge category={proposal.category} />
                        <span className="font-mono text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">{proposal.tracker_number}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">{proposal.title}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                        {proposal.college?.name && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Building2 size={10} />{proposal.college.name}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar size={10} />{proposal.academic_year}
                        </span>
                    </div>
                </div>
            </div>
            <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/50">
                <button onClick={() => onPublish(proposal)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-200">
                    <Plus size={14} /> Publish to Repository
                </button>
            </div>
        </article>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, text, action }) {
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex items-center justify-center mb-5">
                <Icon size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">{title}</h3>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">{text}</p>
            {action && <div className="mt-5">{action}</div>}
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'published',   label: 'Published',        icon: CheckCircle2 },
    { key: 'archived',    label: 'Archived',          icon: Archive },
    { key: 'publishable', label: 'Ready to Publish',  icon: Sparkles },
]

export default function RepositoryAdmin() {
    const { success, error } = useToast()
    const { confirm }        = useConfirm()

    const [tab,         setTab]         = useState('published')
    const [records,     setRecords]     = useState([])
    const [publishable, setPublishable] = useState([])
    const [stats,       setStats]       = useState(null)
    const [loading,     setLoading]     = useState(true)
    const [search,      setSearch]      = useState('')
    const [publishing,  setPublishing]  = useState(null)   // proposal to publish
    const [editing,     setEditing]     = useState(null)   // record to edit

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [recRes, pubRes, statsRes] = await Promise.all([
                api.get('/admin/repository', { params: { per_page: 100 } }),
                api.get('/admin/repository/publishable'),
                api.get('/admin/repository/stats'),
            ])
            setRecords(recRes.data?.data?.data ?? recRes.data?.data ?? [])
            setPublishable(pubRes.data?.data ?? [])
            setStats(statsRes.data?.data ?? null)
        } catch {
            error('Failed to load repository data.')
        }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const handleToggleFeatured = async (record) => {
        try {
            await api.patch(`/admin/repository/${record.id}`, { is_featured: !record.is_featured })
            success(record.is_featured ? 'Removed from featured.' : 'Marked as featured.')
            load()
        } catch { error('Failed to update featured status.') }
    }

    const handleArchive = async (record) => {
        const ok = await confirm({
            title:   'Archive this record?',
            message: `"${record.title}" will be hidden from the public repository.`,
            danger:  true,
        })
        if (!ok) return
        try {
            await api.delete(`/admin/repository/${record.id}`)
            success('Record archived.')
            load()
        } catch { error('Failed to archive record.') }
    }

    const handleRepublish = async (record) => {
        try {
            await api.patch(`/admin/repository/${record.id}`, { status: 'published' })
            success('Record re-published.')
            load()
        } catch { error('Failed to re-publish record.') }
    }

    const q = search.toLowerCase()
    const matchRecord = (r) => !search || r.title.toLowerCase().includes(q) || (r.pi_name ?? '').toLowerCase().includes(q)
    const matchProposal = (p) => !search || p.title.toLowerCase().includes(q) || (p.tracker_number ?? '').toLowerCase().includes(q)

    const published         = records.filter(r => r.status === 'published' && matchRecord(r))
    const archived          = records.filter(r => r.status === 'archived'  && matchRecord(r))
    const filteredPublishable = publishable.filter(matchProposal)

    const tabCount = { published: published.length, archived: archived.length, publishable: filteredPublishable.length }

    return (
        <AppLayout breadcrumb="Repository Management">
            {/* Header */}
            <div className="flex items-start justify-between mb-7 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200">
                            <Database size={15} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Research Repository</h1>
                    </div>
                    <p className="text-sm text-gray-500">Publish completed research, manage visibility, and curate featured records</p>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            <StatsBar stats={stats} loading={loading} />

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
                <div className="relative w-full sm:w-72">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search title, PI, or tracker…"
                        className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                </div>

                <div className="flex items-center gap-1.5">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
                                tab === key
                                    ? key === 'publishable'
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                                        : 'bg-gray-900 text-white border-gray-900 shadow-sm'
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                            )}>
                            <Icon size={13} />
                            {label}
                            <span className={cn(
                                'text-[10px] font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center',
                                tab === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                            )}>{tabCount[key]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-3 border-l-4 border-l-gray-100 h-48" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {tab === 'published' && (
                        published.length === 0
                            ? <EmptyState icon={Globe} title="No published records"
                                text="Publish completed proposals from the 'Ready to Publish' tab to make them visible in the public repository."
                                action={<button onClick={() => setTab('publishable')} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-200"><Sparkles size={14} />View ready proposals</button>} />
                            : published.map(r => (
                                <RecordCard key={r.id} record={r}
                                    onEdit={setEditing}
                                    onToggleFeatured={handleToggleFeatured}
                                    onArchive={handleArchive}
                                    onRepublish={handleRepublish} />
                              ))
                    )}

                    {tab === 'archived' && (
                        archived.length === 0
                            ? <EmptyState icon={Archive} title="No archived records" text="Records removed from the public repository appear here. You can re-publish them at any time." />
                            : archived.map(r => (
                                <RecordCard key={r.id} record={r}
                                    onEdit={setEditing}
                                    onToggleFeatured={handleToggleFeatured}
                                    onArchive={handleArchive}
                                    onRepublish={handleRepublish} />
                              ))
                    )}

                    {tab === 'publishable' && (
                        filteredPublishable.length === 0
                            ? <EmptyState icon={CheckCircle2} title="Nothing ready to publish" text="Completed proposals that haven't been published yet will appear here." />
                            : filteredPublishable.map(p => (
                                <PublishableCard key={p.id} proposal={p} onPublish={setPublishing} />
                              ))
                    )}
                </div>
            )}

            {/* Modals */}
            {publishing && (
                <PublishModal
                    proposal={publishing}
                    onClose={() => setPublishing(null)}
                    onSuccess={(msg) => { success(msg); setPublishing(null); load(); setTab('published') }}
                />
            )}
            {editing && (
                <EditRecordModal
                    record={editing}
                    onClose={() => setEditing(null)}
                    onSuccess={(msg) => { success(msg); setEditing(null); load() }}
                />
            )}
        </AppLayout>
    )
}
