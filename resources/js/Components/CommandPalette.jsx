import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from '@inertiajs/react'
import {
    Search, X, LayoutDashboard, FileText, Megaphone, PlusCircle,
    CheckSquare, ClipboardList, EyeOff, Presentation, Trophy,
    Archive, Users, Building, Shield, Settings, BarChart, CalendarDays,
    Database, Activity, Award, BookOpen, DollarSign, CreditCard,
    BadgeDollarSign, CheckCircle, AlertCircle, Brain, Globe,
    ScrollText, Scale, FolderOpen, TrendingUp, Loader2, ArrowRight,
    Hash, Clock,
} from 'lucide-react'
import { get } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/utils'

const STATUS_COLORS = {
    submitted:           'bg-blue-500',
    validated:           'bg-indigo-500',
    under_blind_review:  'bg-yellow-500',
    blind_review_passed: 'bg-orange-500',
    under_open_defence:  'bg-purple-500',
    accepted:            'bg-green-500',
    funded:              'bg-emerald-600',
    midterm_evaluation:  'bg-teal-500',
    completed:           'bg-cyan-600',
    rejected:            'bg-red-500',
    archived:            'bg-slate-400',
    draft:               'bg-gray-400',
}

function buildNavItems(hasPermission, hasRole, hasAnyRole) {
    const p = hasPermission
    const r = hasRole
    const ra = hasAnyRole
    const ADMIN = ['super_admin', 'admin', 'central_officer']
    const OFFICERS = ['research_officer', 'community_officer', 'technology_officer']

    return [
        { group: 'Navigation', label: 'Dashboard',           href: '/dashboard',                icon: LayoutDashboard, show: true },
        { group: 'Navigation', label: 'My Research Hub',     href: '/researcher-hub',           icon: Brain, show: true },
        { group: 'Navigation', label: 'Calendar',            href: '/calendar',                 icon: CalendarDays, show: true },
        { group: 'Navigation', label: 'Notifications',       href: '/notifications',            icon: Activity, show: true },
        { group: 'Navigation', label: 'My Profile',          href: '/profile',                  icon: Users, show: true },

        { group: 'Proposals',  label: 'All Proposals',       href: '/proposals',                icon: FileText, show: p('proposals.view_any') },
        { group: 'Proposals',  label: 'New Application',     href: '/proposals/create',         icon: PlusCircle, show: p('proposals.create') },
        { group: 'Proposals',  label: 'My Proposals',        href: '/my-proposals',             icon: FolderOpen, show: p('proposals.submit') },
        { group: 'Proposals',  label: 'Proposal Calls',      href: '/proposal-calls',           icon: Megaphone, show: true },
        { group: 'Proposals',  label: 'Awarded Proposals',   href: '/admin/awarded',            icon: Trophy, show: p('proposals.view_any') },
        { group: 'Proposals',  label: 'Completed Archive',   href: '/admin/completed-archive',  icon: Archive, show: p('proposals.view_any') },

        { group: 'Review',     label: 'Validation Queue',    href: '/admin/validation-queue',   icon: CheckSquare, show: p('proposals.validate') },
        { group: 'Review',     label: 'Central Evaluation',  href: '/admin/central-evaluation', icon: ClipboardList, show: p('proposals.validate') },
        { group: 'Review',     label: 'Blind Review',        href: '/admin/blind-review',       icon: EyeOff, show: p('reviews.view_any') },
        { group: 'Review',     label: 'Open Defence',        href: '/admin/open-defence',       icon: Presentation, show: p('defence_sessions.view_any') },
        { group: 'Review',     label: 'Assigned Reviews',    href: '/reviews',                  icon: CheckSquare, show: p('review_assignments.view_any') },
        { group: 'Review',     label: 'Grant Letters',       href: '/admin/grant-letters',      icon: ScrollText, show: ra([...ADMIN, ...OFFICERS]) },
        { group: 'Review',     label: 'Appeals',             href: '/admin/appeals',            icon: Scale, show: ra([...ADMIN, ...OFFICERS]) },

        { group: 'Finance',    label: 'Proposal Funding',    href: '/admin/funding',            icon: BadgeDollarSign, show: p('proposals.validate') },
        { group: 'Finance',    label: 'Budget Allocations',  href: '/budget-allocations',       icon: DollarSign, show: p('budget_allocations.view_any') },
        { group: 'Finance',    label: 'Budget Requests',     href: '/budget-requests',          icon: DollarSign, show: p('budget_requests.view_any') },
        { group: 'Finance',    label: 'Disbursements',       href: '/disbursements',            icon: CreditCard, show: p('disbursements.view_any') },
        { group: 'Finance',    label: 'Settlements',         href: '/settlements',              icon: CheckCircle, show: p('settlements.view_any') },

        { group: 'Monitoring', label: 'Midterm Evaluations', href: '/midterm-evaluations',      icon: Activity, show: p('midterm_evaluations.view_any') },
        { group: 'Monitoring', label: 'Completion Workshops',href: '/completion-workshops',     icon: Award, show: p('completion_workshops.view_any') },
        { group: 'Monitoring', label: 'Research Outputs',    href: '/research-outputs',         icon: BookOpen, show: p('research_outputs.view_any') },
        { group: 'Monitoring', label: 'Repository',          href: '/repository',               icon: Database, show: p('repository.view_any') },
        { group: 'Monitoring', label: 'Research Impact',     href: '/research-impact',          icon: TrendingUp, show: p('research_outputs.view_any') },

        { group: 'Reports',    label: 'Generate Reports',    href: '/reports',                  icon: BarChart, show: p('reports.view_any') },
        { group: 'Reports',    label: 'Proposal Statistics', href: '/proposals',                icon: TrendingUp, show: p('reports.view_any') },
        { group: 'Reports',    label: 'Analytics Dashboard', href: '/admin/analytics',          icon: BarChart, show: ra(ADMIN) },

        { group: 'Admin',      label: 'Users',               href: '/admin/users',              icon: Users, show: p('users.view_any') },
        { group: 'Admin',      label: 'Colleges',            href: '/admin/colleges',           icon: Building, show: p('colleges.view_any') },
        { group: 'Admin',      label: 'Audit Logs',          href: '/admin/audit-logs',         icon: Shield, show: p('audit_logs.view_any') },
        { group: 'Admin',      label: 'Settings',            href: '/admin/settings',           icon: Settings, show: ra(['super_admin', 'admin']) },
        { group: 'Admin',      label: 'Public Site',         href: '/admin/public-site',        icon: Globe, show: ra(['super_admin', 'admin']) },
    ].filter(item => item.show)
}

const RECENT_KEY = 'rtt_cmd_recent'
function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function saveRecent(href, label) {
    const prev = getRecent().filter(r => r.href !== href)
    localStorage.setItem(RECENT_KEY, JSON.stringify([{ href, label, ts: Date.now() }, ...prev].slice(0, 5)))
}

export default function CommandPalette({ open, onClose }) {
    const { hasPermission, hasRole, hasAnyRole } = useAuth()
    const [query, setQuery] = useState('')
    const [proposalResults, setProposalResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [activeIdx, setActiveIdx] = useState(0)
    const inputRef = useRef(null)
    const listRef = useRef(null)

    const navItems = buildNavItems(hasPermission, hasRole, hasAnyRole)

    const filteredNav = query.trim()
        ? navItems.filter(item =>
            item.label.toLowerCase().includes(query.toLowerCase()) ||
            item.group.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 8)
        : []

    const recent = !query.trim() ? getRecent() : []
    const topNav  = !query.trim() ? navItems.slice(0, 6) : []

    const allItems = [
        ...recent.map(r => ({ ...r, isRecent: true })),
        ...topNav.filter(n => !recent.find(r => r.href === n.href)),
        ...filteredNav,
        ...proposalResults.map(p => ({
            label: p.title,
            href: `/proposals/${p.id}`,
            sub: p.tracker_number,
            status: p.status,
            isProposal: true,
        })),
    ]

    useEffect(() => {
        if (open) { setQuery(''); setProposalResults([]); setActiveIdx(0) }
    }, [open])

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 40)
    }, [open])

    useEffect(() => {
        if (!query || query.length < 2) { setProposalResults([]); return }
        const t = setTimeout(async () => {
            setLoading(true)
            try {
                const r = await get('/proposals', { search: query, per_page: 5 })
                setProposalResults(r.data?.data?.data ?? r.data?.data ?? [])
            } catch { setProposalResults([]) }
            finally { setLoading(false) }
        }, 280)
        return () => clearTimeout(t)
    }, [query])

    useEffect(() => { setActiveIdx(0) }, [query])

    const scrollActive = useCallback((idx) => {
        const el = listRef.current?.children[idx]
        el?.scrollIntoView({ block: 'nearest' })
    }, [])

    const navigate = useCallback((item) => {
        saveRecent(item.href, item.label)
        onClose()
        // Use full navigation for Inertia links
        window.location.href = item.href
    }, [onClose])

    const handleKey = useCallback((e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIdx(i => { const next = Math.min(i + 1, allItems.length - 1); scrollActive(next); return next })
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIdx(i => { const prev = Math.max(i - 1, 0); scrollActive(prev); return prev })
        } else if (e.key === 'Enter') {
            const item = allItems[activeIdx]
            if (item) navigate(item)
        } else if (e.key === 'Escape') {
            onClose()
        }
    }, [allItems, activeIdx, navigate, onClose, scrollActive])

    if (!open) return null

    const groupedNav = filteredNav.reduce((acc, item) => {
        if (!acc[item.group]) acc[item.group] = []
        acc[item.group].push(item)
        return acc
    }, {})

    let flatIdx = 0

    return (
        <div className="fixed inset-0 z-[9980] flex items-start justify-center pt-16 sm:pt-24 px-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200/60 animate-in fade-in slide-in-from-top-4 duration-200">

                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                    {loading
                        ? <Loader2 size={16} className="text-indigo-500 shrink-0 animate-spin" />
                        : <Search size={16} className="text-gray-400 shrink-0" />
                    }
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Search pages, proposals…"
                        className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none"
                    />
                    {query ? (
                        <button onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-500 transition-colors">
                            <X size={14} />
                        </button>
                    ) : (
                        <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded-md">
                            ESC
                        </kbd>
                    )}
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[28rem] overflow-y-auto py-2">
                    {allItems.length === 0 && query.length >= 2 && !loading && (
                        <div className="flex flex-col items-center py-10 text-center">
                            <Search size={24} className="text-gray-200 mb-2" />
                            <p className="text-sm text-gray-400">No results for <strong>"{query}"</strong></p>
                        </div>
                    )}

                    {/* Recent (no query) */}
                    {recent.length > 0 && !query && (
                        <div className="mb-1">
                            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recent</p>
                            {recent.map(item => {
                                const idx = flatIdx++
                                const isActive = idx === activeIdx
                                return (
                                    <button key={item.href} onClick={() => navigate(item)}
                                        onMouseEnter={() => setActiveIdx(idx)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                            isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                        )}>
                                        <Clock size={13} className="text-gray-400 shrink-0" />
                                        <span className="text-sm text-gray-700">{item.label}</span>
                                        <ArrowRight size={11} className={cn('ml-auto transition-opacity', isActive ? 'opacity-100 text-indigo-400' : 'opacity-0')} />
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Top nav (no query, non-recent) */}
                    {topNav.filter(n => !recent.find(r => r.href === n.href)).length > 0 && !query && (
                        <div className="mb-1">
                            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Quick Links</p>
                            {topNav.filter(n => !recent.find(r => r.href === n.href)).map(item => {
                                const Icon = item.icon
                                const idx = flatIdx++
                                const isActive = idx === activeIdx
                                return (
                                    <button key={item.href} onClick={() => navigate(item)}
                                        onMouseEnter={() => setActiveIdx(idx)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                            isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                        )}>
                                        <Icon size={14} className={cn('shrink-0', isActive ? 'text-indigo-500' : 'text-gray-400')} />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm text-gray-700">{item.label}</span>
                                            <span className="ml-2 text-[10px] text-gray-400">{item.group}</span>
                                        </div>
                                        <ArrowRight size={11} className={cn('transition-opacity', isActive ? 'opacity-100 text-indigo-400' : 'opacity-0')} />
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Filtered nav (with query) */}
                    {Object.entries(groupedNav).map(([group, items]) => (
                        <div key={group} className="mb-1">
                            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group}</p>
                            {items.map(item => {
                                const Icon = item.icon
                                const idx = flatIdx++
                                const isActive = idx === activeIdx
                                return (
                                    <button key={item.href} onClick={() => navigate(item)}
                                        onMouseEnter={() => setActiveIdx(idx)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                            isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                        )}>
                                        <Icon size={14} className={cn('shrink-0', isActive ? 'text-indigo-500' : 'text-gray-400')} />
                                        <span className="text-sm text-gray-700">{item.label}</span>
                                        <ArrowRight size={11} className={cn('ml-auto transition-opacity', isActive ? 'opacity-100 text-indigo-400' : 'opacity-0')} />
                                    </button>
                                )
                            })}
                        </div>
                    ))}

                    {/* Proposal results */}
                    {proposalResults.length > 0 && (
                        <div className="mt-1 border-t border-gray-100 pt-1">
                            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Proposals</p>
                            {proposalResults.map(p => {
                                const idx = flatIdx++
                                const isActive = idx === activeIdx
                                const statusColor = STATUS_COLORS[p.status] ?? 'bg-gray-400'
                                return (
                                    <button key={p.id} onClick={() => navigate({ href: `/proposals/${p.id}`, label: p.title })}
                                        onMouseEnter={() => setActiveIdx(idx)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                            isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                        )}>
                                        <div className={cn('h-2 w-2 rounded-full shrink-0', statusColor)} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800 truncate">{p.title}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">{p.tracker_number}</p>
                                        </div>
                                        <ArrowRight size={11} className={cn('shrink-0 transition-opacity', isActive ? 'opacity-100 text-indigo-400' : 'opacity-0')} />
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer hint */}
                <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
                    <span className="text-[10px] text-gray-400">
                        <kbd className="border border-gray-200 rounded px-1 py-0.5 mr-1">↑↓</kbd> navigate
                    </span>
                    <span className="text-[10px] text-gray-400">
                        <kbd className="border border-gray-200 rounded px-1 py-0.5 mr-1">↵</kbd> open
                    </span>
                    <span className="text-[10px] text-gray-400">
                        <kbd className="border border-gray-200 rounded px-1 py-0.5 mr-1">esc</kbd> close
                    </span>
                </div>
            </div>
        </div>
    )
}
