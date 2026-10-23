import { useState, useEffect } from 'react'
import { Link } from '@inertiajs/react'
import { Search, Building2, ChevronLeft, ChevronRight, Users, FolderOpen } from 'lucide-react'
import PublicLayout from '../../Layouts/PublicLayout'
import { get } from '../../lib/api'

export function Initials({ name, className = '' }) {
    const initials = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    return <span className={`flex items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 ${className}`}>{initials || '?'}</span>
}

function ResearcherCard({ r }) {
    return (
        <Link href={`/researchers/${r.slug}`}
            className="group flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md">
            <div className="flex items-center gap-3">
                {r.avatar
                    ? <img src={r.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    : <Initials name={r.name} className="h-12 w-12 shrink-0 text-sm" />}
                <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900 group-hover:text-indigo-700">{r.title ? `${r.title} ` : ''}{r.name}</p>
                    {r.department && <p className="truncate text-xs text-gray-500">{r.department}</p>}
                </div>
            </div>
            {r.expertise?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {r.expertise.map(e => <span key={e} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{e}</span>)}
                </div>
            )}
            <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-2 text-[11px] text-gray-500">
                <span className="flex min-w-0 items-center gap-1 truncate"><Building2 size={11} className="shrink-0" /> {r.college ?? '—'}</span>
                <span className="flex shrink-0 items-center gap-1"><FolderOpen size={11} /> {r.projects} project{r.projects === 1 ? '' : 's'}</span>
            </div>
        </Link>
    )
}

export default function Researchers() {
    const [items, setItems] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [collegeId, setCollegeId] = useState('')
    const [colleges, setColleges] = useState([])
    const [page, setPage] = useState(1)

    useEffect(() => {
        get('/colleges/public').then(r => setColleges(r.data ?? [])).catch(() => {})
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(true)
            get('/researchers', { q: query || undefined, college_id: collegeId || undefined, page })
                .then(r => { setItems(r.data?.data ?? []); setMeta(r.data ?? null) })
                .catch(() => setItems([]))
                .finally(() => setLoading(false))
        }, query ? 300 : 0)
        return () => clearTimeout(timer)
    }, [query, collegeId, page])

    return (
        <PublicLayout>
            <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Our Researchers</h1>
                    <p className="mx-auto max-w-2xl text-sm text-gray-500">
                        The people behind the university's funded research, community engagement and technology transfer projects.
                    </p>
                    <p className="text-xs text-gray-400">
                        An expert outside the university? <Link href="/reviewers/apply" className="font-medium text-indigo-600 hover:underline">Apply to review proposals</Link>
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 focus-within:ring-2 focus-within:ring-indigo-500">
                        <Search size={15} className="text-gray-400" />
                        <input value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Search by name or expertise…"
                            className="h-11 flex-1 bg-transparent text-sm outline-none" />
                    </div>
                    <select value={collegeId} onChange={e => { setCollegeId(e.target.value); setPage(1) }} aria-label="College"
                        className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 sm:w-64">
                        <option value="">All colleges</option>
                        {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />)}
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                        <Users size={28} className="mx-auto text-gray-300" />
                        <p className="mt-3 text-sm text-gray-500">{query || collegeId ? 'No researchers match your search.' : 'No researcher profiles have been published yet.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map(r => <ResearcherCard key={r.slug} r={r} />)}
                    </div>
                )}

                {meta?.last_page > 1 && (
                    <div className="flex items-center justify-center gap-3 text-sm">
                        <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} aria-label="Previous page"
                            className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"><ChevronLeft size={15} /></button>
                        <span className="text-gray-500">Page {meta.current_page} of {meta.last_page}</span>
                        <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.last_page} aria-label="Next page"
                            className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"><ChevronRight size={15} /></button>
                    </div>
                )}
            </div>
        </PublicLayout>
    )
}
