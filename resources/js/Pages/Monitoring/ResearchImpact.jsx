import { useState, useEffect, useRef } from 'react'
import {
    TrendingUp, BookOpen, Award, Lightbulb, Globe, Star,
    Plus, X, Search, ExternalLink, Edit2, Trash2, ChevronDown,
    Loader2, Hash, BarChart2, Calendar,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import ConfirmDialog from '../../Components/ConfirmDialog'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../Components/Toast'
import { get, post, put, del } from '../../lib/api'
import { cn } from '../../lib/utils'

const TYPE_CONFIG = {
    publication:  { label: 'Publication',   icon: BookOpen,  color: 'bg-blue-600',    soft: 'bg-blue-50 text-blue-700 border-blue-200'   },
    patent:       { label: 'Patent',         icon: Award,     color: 'bg-amber-500',   soft: 'bg-amber-50 text-amber-700 border-amber-200'  },
    citation:     { label: 'Citation',       icon: Hash,      color: 'bg-indigo-600',  soft: 'bg-indigo-50 text-indigo-700 border-indigo-200'},
    award:        { label: 'Award',          icon: Star,      color: 'bg-yellow-500',  soft: 'bg-yellow-50 text-yellow-700 border-yellow-200'},
    conference:   { label: 'Conference',     icon: Globe,     color: 'bg-teal-600',    soft: 'bg-teal-50 text-teal-700 border-teal-200'     },
    technology:   { label: 'Technology',     icon: Lightbulb, color: 'bg-purple-600',  soft: 'bg-purple-50 text-purple-700 border-purple-200'},
    other:        { label: 'Other',          icon: TrendingUp,color: 'bg-slate-500',   soft: 'bg-slate-50 text-slate-600 border-slate-200'  },
}

const EMPTY_FORM = {
    proposal_id: '', type: 'publication', title: '', authors: '',
    journal_or_venue: '', year: '', doi_or_url: '', impact_factor: '', description: '',
}

function ImpactBadge({ type }) {
    const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.other
    const Icon = cfg.icon
    return (
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border', cfg.soft)}>
            <Icon size={10} /> {cfg.label}
        </span>
    )
}

function StatCard({ label, value, icon: Icon, color }) {
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
            <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', color)}>
                <Icon size={16} className="text-white" />
            </div>
            <div>
                <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
        </div>
    )
}

function ImpactForm({ open, onClose, onSaved, initial }) {
    const [form, setForm] = useState(initial ?? EMPTY_FORM)
    const [proposals, setProposals] = useState([])
    const [saving, setSaving] = useState(false)
    const { error } = useToast()

    useEffect(() => {
        if (open) {
            setForm(initial ?? EMPTY_FORM)
            get('/proposals', { status: 'funded,completed,midterm_evaluation', per_page: 100 })
                .then(r => setProposals(r.data?.data?.data ?? []))
                .catch(() => {})
        }
    }, [open])

    const save = async () => {
        if (!form.proposal_id || !form.title) { error('Proposal and title are required.'); return }
        setSaving(true)
        try {
            if (initial?.id) {
                const r = await put(`/research-impacts/${initial.id}`, form)
                onSaved(r.data?.data)
            } else {
                const r = await post('/research-impacts', form)
                onSaved(r.data?.data)
            }
            onClose()
        } catch (e) {
            error(e?.response?.data?.message ?? 'Failed to save impact.')
        } finally { setSaving(false) }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">{initial?.id ? 'Edit Impact' : 'Record Research Impact'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Proposal *</label>
                        <select value={form.proposal_id} onChange={e => setForm(p => ({ ...p, proposal_id: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">Select funded proposal…</option>
                            {proposals.map(p => (
                                <option key={p.id} value={p.id}>{p.tracker_number} — {p.title?.slice(0, 60)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Type *</label>
                            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
                            <input type="number" min="2000" max="2100" value={form.year}
                                onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder={new Date().getFullYear()} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
                        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Publication or output title" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Authors / Inventors</label>
                        <input value={form.authors} onChange={e => setForm(p => ({ ...p, authors: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Comma-separated names" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Journal / Venue</label>
                            <input value={form.journal_or_venue} onChange={e => setForm(p => ({ ...p, journal_or_venue: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Journal name or conference" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Impact Factor / Grade</label>
                            <input value={form.impact_factor} onChange={e => setForm(p => ({ ...p, impact_factor: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g. Q1, 3.4, Gold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">DOI / URL</label>
                        <input value={form.doi_or_url} onChange={e => setForm(p => ({ ...p, doi_or_url: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="https://doi.org/…" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Description / Notes</label>
                        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="Additional context…" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                        {saving && <Loader2 size={13} className="animate-spin" />}
                        {initial?.id ? 'Save Changes' : 'Record Impact'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function ResearchImpact() {
    const { hasPermission } = useAuth()
    const { success, error } = useToast()
    const canEdit = hasPermission('research_outputs.create') || hasPermission('research_outputs.update')

    const [impacts, setImpacts] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [yearFilter, setYearFilter] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [deleting, setDeleting] = useState(null)
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState(null)

    const load = async (p = 1) => {
        setLoading(true)
        try {
            const params = { page: p, per_page: 20 }
            if (search)     params.q    = search
            if (typeFilter) params.type = typeFilter
            if (yearFilter) params.year = yearFilter
            const r = await get('/research-impacts', params)
            setImpacts(r.data?.data?.data ?? [])
            setPagination(r.data?.data)
            setStats(r.data?.meta?.stats ?? null)
        } catch { error('Failed to load research impacts.') }
        finally { setLoading(false) }
    }

    useEffect(() => { load(1) }, [search, typeFilter, yearFilter])

    const handleSaved = (item) => {
        if (editing?.id) {
            setImpacts(prev => prev.map(i => i.id === item.id ? item : i))
            success('Impact updated.')
        } else {
            setImpacts(prev => [item, ...prev])
            success('Impact recorded.')
        }
        setEditing(null)
    }

    const handleDelete = async () => {
        try {
            await del(`/research-impacts/${deleting.id}`)
            setImpacts(prev => prev.filter(i => i.id !== deleting.id))
            success('Impact deleted.')
        } catch { error('Failed to delete.') }
        finally { setDeleting(null) }
    }

    const years = stats?.by_year ? Object.keys(stats.by_year).sort((a, b) => b - a) : []

    return (
        <AppLayout breadcrumb="Research Impact">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Research Impact Tracker</h1>
                        <p className="text-sm text-gray-500 mt-1">Publications, patents, awards and other outcomes from funded research</p>
                    </div>
                    {canEdit && (
                        <button onClick={() => { setEditing(null); setFormOpen(true) }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                            <Plus size={14} /> Record Impact
                        </button>
                    )}
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label="Total Impacts"    value={stats.total ?? 0}                        icon={TrendingUp} color="bg-indigo-600" />
                        <StatCard label="Publications"     value={stats.by_type?.publication ?? 0}         icon={BookOpen}   color="bg-blue-600"   />
                        <StatCard label="Patents"          value={stats.by_type?.patent ?? 0}              icon={Award}      color="bg-amber-500"  />
                        <StatCard label="Awards"           value={stats.by_type?.award ?? 0}               icon={Star}       color="bg-yellow-500" />
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-48">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by title, author, journal…"
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">All Types</option>
                        {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {(search || typeFilter || yearFilter) && (
                        <button onClick={() => { setSearch(''); setTypeFilter(''); setYearFilter('') }}
                            className="flex items-center gap-1 px-3 py-2 border border-red-200 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-50">
                            <X size={12} /> Clear
                        </button>
                    )}
                </div>

                {/* List */}
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                                <div className="h-3 bg-gray-100 rounded w-2/3" />
                            </div>
                        ))}
                    </div>
                ) : impacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-100 rounded-2xl">
                        <TrendingUp size={36} className="text-gray-200 mb-3" />
                        <p className="text-gray-500 font-medium">No research impacts recorded yet</p>
                        {canEdit && (
                            <button onClick={() => { setEditing(null); setFormOpen(true) }}
                                className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 px-4 py-2 border border-indigo-200 rounded-xl hover:bg-indigo-50">
                                <Plus size={13} /> Record first impact
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {impacts.map(item => {
                            const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.other
                            const Icon = cfg.icon
                            return (
                                <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-sm transition-all">
                                    <div className="flex items-start gap-3">
                                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.color)}>
                                            <Icon size={14} className="text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <ImpactBadge type={item.type} />
                                                        {item.year && (
                                                            <span className="text-[11px] text-gray-400 font-medium">{item.year}</span>
                                                        )}
                                                        {item.impact_factor && (
                                                            <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">{item.impact_factor}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-900 leading-snug">{item.title}</p>
                                                    {item.authors && <p className="text-xs text-gray-500 mt-0.5">{item.authors}</p>}
                                                    {item.journal_or_venue && (
                                                        <p className="text-xs text-indigo-500 italic mt-0.5">{item.journal_or_venue}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-2">
                                                        {item.proposal && (
                                                            <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                                {item.proposal.tracker_number}
                                                            </span>
                                                        )}
                                                        {item.doi_or_url && (
                                                            <a href={item.doi_or_url} target="_blank" rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700">
                                                                <ExternalLink size={10} /> View
                                                            </a>
                                                        )}
                                                        <span className="text-[11px] text-gray-400">by {item.recorder?.name}</span>
                                                    </div>
                                                </div>
                                                {canEdit && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button onClick={() => { setEditing(item); setFormOpen(true) }}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button onClick={() => setDeleting(item)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {item.description && (
                                                <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">{item.description}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.last_page > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                        <button onClick={() => load(page - 1)} disabled={page <= 1}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
                            Previous
                        </button>
                        <span className="text-sm text-gray-500">Page {pagination.current_page} of {pagination.last_page}</span>
                        <button onClick={() => load(page + 1)} disabled={page >= pagination.last_page}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
                            Next
                        </button>
                    </div>
                )}
            </div>

            <ImpactForm
                open={formOpen}
                onClose={() => { setFormOpen(false); setEditing(null) }}
                onSaved={handleSaved}
                initial={editing}
            />

            {deleting && (
                <ConfirmDialog
                    open
                    title="Delete this impact record?"
                    description={`"${deleting.title}" will be permanently removed.`}
                    confirmLabel="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </AppLayout>
    )
}
