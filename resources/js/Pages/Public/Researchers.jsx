import { useState, useEffect } from 'react'
import { Link } from '@inertiajs/react'
import { Search, Building2, ChevronLeft, ChevronRight, Users, FolderOpen, X } from 'lucide-react'
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

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Filters live in the address bar, so a filtered list can be shared or reloaded. */
function readFilters() {
    const p = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
    return {
        q: p.get('q') ?? '',
        letter: p.get('letter') ?? '',
        college_id: p.get('college_id') ?? '',
        department_id: p.get('department_id') ?? '',
        with_projects: p.get('with_projects') === '1',
        sort: p.get('sort') ?? 'name_asc',
        page: Number(p.get('page')) || 1,
    }
}

function writeFilters(f) {
    const p = new URLSearchParams()
    if (f.q) p.set('q', f.q)
    if (f.letter) p.set('letter', f.letter)
    if (f.college_id) p.set('college_id', f.college_id)
    if (f.department_id) p.set('department_id', f.department_id)
    if (f.with_projects) p.set('with_projects', '1')
    if (f.sort !== 'name_asc') p.set('sort', f.sort)
    if (f.page > 1) p.set('page', f.page)
    const qs = p.toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
}

/** Page numbers around the current one, with gaps: 1 … 4 5 6 … 12 */
function pageList(current, last) {
    const pages = new Set([1, last, current - 1, current, current + 1].filter(n => n >= 1 && n <= last))
    const sorted = [...pages].sort((a, b) => a - b)
    return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? ['gap-' + n, n] : [n]))
}

function AlphabetBar({ letter, counts, onPick }) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const btn = 'flex h-9 items-center justify-center rounded-lg text-sm font-semibold transition'
    const idle = 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-indigo-50 hover:text-indigo-700'
    return (
        <nav aria-label="Browse by first letter" className="grid grid-cols-9 gap-1 sm:grid-cols-[repeat(27,minmax(0,1fr))]">
            <button onClick={() => onPick('')} aria-pressed={!letter} title={`All ${total} researchers`}
                className={`${btn} ${!letter ? 'bg-indigo-600 text-white shadow-sm' : idle}`}>
                All
            </button>
            {ALPHABET.map(l => {
                const n = counts[l] ?? 0
                const active = letter === l
                return (
                    <button key={l} onClick={() => onPick(active ? '' : l)} disabled={!n && !active} aria-pressed={active}
                        title={n ? `${n} researcher${n === 1 ? '' : 's'}` : 'No researchers'}
                        className={`${btn} ${active ? 'bg-indigo-600 text-white shadow-sm' : n ? idle : 'cursor-not-allowed text-gray-300'}`}>
                        {l}
                    </button>
                )
            })}
        </nav>
    )
}

export default function Researchers() {
    const [filters, setFilters] = useState(readFilters)
    const [items, setItems] = useState([])
    const [meta, setMeta] = useState(null)
    const [letters, setLetters] = useState({})
    const [loading, setLoading] = useState(true)
    const [colleges, setColleges] = useState([])
    const [departments, setDepartments] = useState([])

    /** Any filter change goes back to page 1; the page buttons pass their own page. */
    const update = (patch) => setFilters(f => ({ ...f, page: 1, ...patch }))

    useEffect(() => {
        get('/colleges/public').then(r => setColleges(r.data ?? [])).catch(() => {})
    }, [])

    useEffect(() => {
        setDepartments([])
        if (!filters.college_id) return
        get(`/colleges/${filters.college_id}/departments/public`).then(r => setDepartments(r.data ?? [])).catch(() => {})
    }, [filters.college_id])

    useEffect(() => {
        writeFilters(filters)
        const timer = setTimeout(() => {
            setLoading(true)
            get('/researchers', {
                q: filters.q || undefined,
                letter: filters.letter || undefined,
                college_id: filters.college_id || undefined,
                department_id: filters.department_id || undefined,
                with_projects: filters.with_projects ? 1 : undefined,
                sort: filters.sort,
                page: filters.page,
            })
                .then(r => { setItems(r.data?.data ?? []); setMeta(r.data ?? null); setLetters(r.meta?.letters ?? {}) })
                .catch(() => setItems([]))
                .finally(() => setLoading(false))
        }, filters.q ? 300 : 0)
        return () => clearTimeout(timer)
    }, [filters])

    const goToPage = (page) => {
        setFilters(f => ({ ...f, page }))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const activeChips = [
        filters.letter && { key: 'letter', label: `Starts with ${filters.letter}`, clear: { letter: '' } },
        filters.q && { key: 'q', label: `“${filters.q}”`, clear: { q: '' } },
        filters.college_id && { key: 'college', label: colleges.find(c => String(c.id) === String(filters.college_id))?.name ?? 'College', clear: { college_id: '', department_id: '' } },
        filters.department_id && { key: 'dept', label: departments.find(d => String(d.id) === String(filters.department_id))?.name ?? 'Department', clear: { department_id: '' } },
        filters.with_projects && { key: 'projects', label: 'With funded projects', clear: { with_projects: false } },
    ].filter(Boolean)

    const select = 'h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
    const from = meta?.from ?? 0
    const to = meta?.to ?? 0

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

                <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                        <Search size={16} className="text-gray-400" />
                        <input value={filters.q} onChange={e => update({ q: e.target.value })} placeholder="Search by name or expertise…" type="search"
                            className="h-11 flex-1 bg-transparent text-base outline-none sm:text-sm" />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <select value={filters.college_id} onChange={e => update({ college_id: e.target.value, department_id: '' })} aria-label="College" className={select}>
                            <option value="">All colleges</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select value={filters.department_id} onChange={e => update({ department_id: e.target.value })} aria-label="Department"
                            disabled={!filters.college_id} className={`${select} disabled:bg-gray-50 disabled:text-gray-400`}>
                            <option value="">{filters.college_id ? 'All departments' : 'Choose a college first'}</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select value={filters.sort} onChange={e => update({ sort: e.target.value })} aria-label="Sort" className={select}>
                            <option value="name_asc">Name A → Z</option>
                            <option value="name_desc">Name Z → A</option>
                        </select>
                        <label className="flex h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 text-sm text-gray-700">
                            <span className="flex items-center gap-2"><FolderOpen size={15} className="text-gray-400" /> With funded projects</span>
                            <input type="checkbox" checked={filters.with_projects} onChange={e => update({ with_projects: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        </label>
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                        <AlphabetBar letter={filters.letter} counts={letters} onPick={l => update({ letter: l })} />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-gray-500" aria-live="polite">
                        {loading ? 'Loading…' : meta?.total
                            ? <>Showing <b className="text-gray-900">{from}–{to}</b> of <b className="text-gray-900">{meta.total}</b> researcher{meta.total === 1 ? '' : 's'}</>
                            : 'No results'}
                    </p>
                    {activeChips.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {activeChips.map(c => (
                                <button key={c.key} onClick={() => update(c.clear)}
                                    className="inline-flex max-w-56 items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                                    <span className="truncate">{c.label}</span> <X size={12} className="shrink-0" />
                                </button>
                            ))}
                            <button onClick={() => setFilters({ q: '', letter: '', college_id: '', department_id: '', with_projects: false, sort: 'name_asc', page: 1 })}
                                className="px-2 text-xs font-semibold text-gray-500 hover:text-gray-800">Clear all</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />)}
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                        <Users size={28} className="mx-auto text-gray-300" />
                        <p className="mt-3 text-sm text-gray-500">{activeChips.length ? 'No researchers match these filters.' : 'No researcher profiles have been published yet.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map(r => <ResearcherCard key={r.slug} r={r} />)}
                    </div>
                )}

                {meta?.last_page > 1 && (
                    <nav aria-label="Pages" className="flex items-center justify-center gap-1 text-sm">
                        <button onClick={() => goToPage(filters.page - 1)} disabled={filters.page <= 1} aria-label="Previous page"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"><ChevronLeft size={15} /></button>
                        {pageList(meta.current_page, meta.last_page).map(n => typeof n === 'string'
                            ? <span key={n} className="px-1 text-gray-400">…</span>
                            : <button key={n} onClick={() => goToPage(n)} aria-current={n === meta.current_page ? 'page' : undefined}
                                className={`h-9 min-w-9 rounded-lg px-2 font-semibold tabular-nums ${n === meta.current_page ? 'bg-indigo-600 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>{n}</button>)}
                        <button onClick={() => goToPage(filters.page + 1)} disabled={filters.page >= meta.last_page} aria-label="Next page"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"><ChevronRight size={15} /></button>
                    </nav>
                )}
            </div>
        </PublicLayout>
    )
}
