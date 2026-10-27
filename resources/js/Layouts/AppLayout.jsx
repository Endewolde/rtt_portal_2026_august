import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, usePage, router } from '@inertiajs/react'
import {
    LayoutDashboard, FileText, Megaphone, PlusCircle, Search,
    CheckSquare, ClipboardCheck, AlertCircle, AlertTriangle,
    PieChart, DollarSign, CreditCard, CheckCircle,
    Activity, Award, BookOpen, Database, FileLock2, LifeBuoy,
    BarChart, BarChart2, TrendingUp, TrendingDown, ChartNoAxesCombined, Handshake, Webhook, Layers,
    Users, Building, Building2, Shield, Settings, Bell, Key,
    Globe, LogOut, FlaskConical, Brain, ChevronLeft, ChevronRight, X, Menu,
    FolderOpen, EyeOff, Presentation, ClipboardList,
    BadgeDollarSign, Trophy, Archive, ListChecks, ShieldCheck,
    User, ChevronDown, ChevronUp, Lock, Clock, UserX,
    CalendarDays, Banknote, Landmark, MessageSquareHeart, LogIn, Scale, ScrollText, Milestone, FileBarChart2, FolderSearch,
    HelpCircle, Sliders, FileSignature, ShieldAlert, CalendarClock, CalendarPlus, Timer, UserPlus,
} from 'lucide-react'
import NotificationBell from '../Components/NotificationBell'
import FeedbackPopup from '../Components/FeedbackPopup'
import ProfileCompleteModal from '../Components/ProfileCompleteModal'
import SwitchLoginModal from '../Components/SwitchLoginModal'
import ConfirmDialog from '../Components/ConfirmDialog'
import OpenDefenceHoldModal from '../Components/OpenDefenceHoldModal'
import CommandPalette from '../Components/CommandPalette'
import AssistantPanel from '../Components/AssistantPanel'
import PendingInvitationsModal from '../Components/PendingInvitationsModal'
import InvitationResponsePopup from '../Components/InvitationResponsePopup'
import { OnboardingProvider } from '../onboarding/OnboardingContext'
import HelpMenu from '../onboarding/HelpMenu'
import { useToast } from '../Components/Toast'
import { useAuth } from '../hooks/useAuth'
import { useFeature } from '../hooks/useFeature'
import { useActionCounts } from '../hooks/useActionCounts'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import { cn } from '../lib/utils'
import api from '../lib/api'
import { canOpenPath } from '../lib/routeAccess'
import { translate as tr } from '../lib/i18n'
import LanguageSwitch from '../Components/LanguageSwitch'
import { term } from '../lib/terms'
import { roleLabel, rememberRoleLabels } from '../lib/roles';

// Sub-feature gate per page — mirrors every hasSubFeature(...) check already used to
// hide/show the matching sidebar nav item below. Turning a sub-feature off in Feature
// Management only hid the nav link; a user who already had role/permission access
// could still reach the page by typing its URL directly, since routeAllowed (below)
// never consulted this. This map closes that gap by extending the same guard.
// Matched by prefix except '/proposals' (see SUBFEATURE_EXACT_ONLY below), so
// longer/more-specific paths must come before shorter ones in this object.
const ROUTE_SUBFEATURE = {
    '/proposals/create':          'proposals.new_application',
    '/proposals':                 'proposals.all',
    '/proposal-calls':            'proposals.calls',
    '/tracker':                   'proposals.track',
    '/my-proposals':              'proposals.my_proposals',
    '/admin/awarded':             'proposals.awarded',
    '/admin/contracts':           'proposals.contracts',
    '/admin/completed-archive':   'proposals.archive',
    '/admin/validation-queue':    'evaluation.validation',
    '/admin/blind-review':        'evaluation.blind_review',
    '/admin/open-defence':        'evaluation.open_defence',
    '/admin/central-evaluation':  'evaluation.central',
    '/reviews':                   'evaluation.assigned_reviews',
    '/admin/evaluation-criteria': 'evaluation.criteria',
    '/admin/reviewer-workload':   'evaluation.reviewer_workload',
    '/admin/review-deadlines':    'evaluation.review_deadlines',
    '/admin/coi-conflicts':       'evaluation.coi_conflicts',
    '/complaints':                'complaints.manage',
    '/admin/similarity-flags':    'similarity.flags',
    '/budget-allocations':        'finance.allocations',
    '/finance/milestones':        'finance.requests',
    '/budget-requests':           'finance.requests',
    '/admin/funding':             'finance.funding',
    '/disbursements':             'finance.disbursements',
    '/settlements':               'finance.settlements',
    '/ongoing-proposals':         'monitoring.ongoing',
    '/projects-at-risk':          'monitoring.ongoing',
    '/midterm-evaluations':       'monitoring.midterm',
    '/completion-workshops':      'monitoring.completion',
    '/research-outputs':          'monitoring.outputs',
    '/admin/repository':          'repository.manage',
    '/repository':                'repository.view',
    '/reports/builder':           'reports.generate',
    '/reports/annual':            'reports.generate',
    '/reports':                   'reports.generate',
    '/admin/analytics':           'reports.analytics',
    '/admin/proposal-pipeline':   'reports.analytics',
    '/admin/college-phase-completion': 'reports.analytics',
    '/admin/conferences':         'events.conferences',
    '/admin/abstracts':           'events.abstracts',
    '/admin/external-funds':      'external_funds.manage',
}

// '/proposals' is a bare list page whose URL happens to prefix many unrelated
// nested routes ('/proposals/{id}', '/proposals/{id}/award', ...) — those must NOT
// inherit the "All Proposals" list's sub-feature gate (a PI viewing their own
// proposal has nothing to do with that admin list toggle). Every other entry here
// is a flat dashboard page, so prefix matching is safe and correctly also covers
// their action sub-routes (e.g. '/reviews/{id}/score' under '/reviews').
const SUBFEATURE_EXACT_ONLY = ['/proposals']

function getRequiredSubFeature(path) {
    const bare = path.split('?')[0]
    const entry = Object.entries(ROUTE_SUBFEATURE).find(([prefix]) =>
        bare === prefix || (! SUBFEATURE_EXACT_ONLY.includes(prefix) && bare.startsWith(prefix + '/'))
    )
    return entry?.[1] ?? null
}

// ─── Unauthorized view ────────────────────────────────────────────────────────

function UnauthorizedView({ user, reason }) {
    const roles = (user?.roles ?? []).map(r => typeof r === 'string' ? r : r.name)
    const isDisabledFeature = reason === 'feature_disabled'
    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl
                                bg-red-50 mb-5">
                    <Lock size={28} className="text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                    {isDisabledFeature ? 'Feature Unavailable' : 'Access Denied'}
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                    {isDisabledFeature
                        ? 'This feature has been turned off by an administrator and is not currently available.'
                        : (<>
                            You don't have permission to view this page.
                            {roles.length > 0 && (
                                <> Your current role is <strong className="text-gray-700">
                                    {roleLabel(roles[0])}
                                </strong>.</>
                            )}
                        </>)
                    }
                </p>
                <Link href="/dashboard"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600
                               text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                    <LayoutDashboard size={15} /> {tr("Go to Dashboard")}
                </Link>
            </div>
        </div>
    )
}

// ─── Session warning modal ────────────────────────────────────────────────────

function SessionWarningModal({ secondsLeft, onContinue, onLogout }) {
    return (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                                bg-amber-50 mb-4">
                    <Clock size={26} className="text-amber-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">{tr("Session Expiring")}</h2>
                <p className="text-sm text-gray-500 mb-2">
                    {tr("You've been inactive. Your session will expire in")}
                </p>
                <div className="text-4xl font-bold text-amber-600 mb-5 tabular-nums">
                    {secondsLeft}s
                </div>
                <div className="flex gap-3 justify-center">
                    <button onClick={onContinue}
                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold
                                   rounded-xl hover:bg-indigo-700 transition-colors">
                        {tr("Continue Session")}
                    </button>
                    <button onClick={onLogout}
                        className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm
                                   font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                        {tr("Logout")}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Sidebar color helpers ────────────────────────────────────────────────────

function isDarkColor(hex) {
    if (!hex || !hex.startsWith('#')) return false
    const raw  = hex.replace('#', '')
    const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128
}

// Class sets for light and dark sidebar backgrounds
const LIGHT = {
    border:       'border-r border-gray-100',
    logoBorder:   'border-b border-gray-100',
    logoTitle:    'text-gray-900',
    logoSub:      'text-gray-400',
    scrollbar:    'scrollbar-thumb-gray-200',
    separator:    'border-t border-gray-100',
    groupLabel:   (a) => a ? 'text-indigo-600' : 'text-gray-500',
    // Active = vivid gradient pill with glow; inactive = ghost
    navItem:      (a) => a
        ? 'bg-linear-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-300/50'
        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/80',
    icon:         (a) => a
        ? 'text-white/90'
        : 'text-gray-400 group-hover:text-indigo-500 transition-colors',
    // Collapsed active icon square
    iconSquare:   (a) => a
        ? 'bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-300/40'
        : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/80',
    footerBorder: 'border-t border-gray-100',
    profileRow:   'hover:bg-gray-100/70',
    userName:     'text-gray-900',
    userRole:     'text-gray-400',
    logout:       'text-gray-400 hover:text-rose-500 hover:bg-red-50/80',
    toggle:       'bg-white border-gray-200 shadow-sm text-gray-400 hover:text-indigo-600 hover:border-indigo-300',
    avatarRing:   'ring-2 ring-white shadow-sm',
    collapseRow:  'text-gray-400 hover:text-gray-700 hover:bg-gray-100/80',
}

const DARK = {
    border:       'border-r border-white/7',
    logoBorder:   'border-b border-white/7',
    logoTitle:    'text-white',
    logoSub:      'text-slate-500',
    scrollbar:    'scrollbar-thumb-slate-700/50',
    separator:    'border-t border-white/7',
    groupLabel:   (a) => a ? 'text-indigo-400' : 'text-slate-400',
    navItem:      (a) => a
        ? 'bg-linear-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
        : 'text-slate-400 hover:text-slate-100 hover:bg-white/5',
    icon:         (a) => a
        ? 'text-white/90'
        : 'text-slate-500 group-hover:text-slate-200 transition-colors',
    iconSquare:   (a) => a
        ? 'bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30'
        : 'text-slate-500 hover:text-white hover:bg-white/8',
    footerBorder: 'border-t border-white/7',
    profileRow:   'hover:bg-white/5',
    userName:     'text-white',
    userRole:     'text-slate-500',
    logout:       'text-slate-500 hover:text-rose-400 hover:bg-white/6',
    toggle:       'bg-white/8 border-white/10 text-slate-400 hover:text-white hover:bg-indigo-500 hover:border-indigo-500/50 shadow-sm',
    avatarRing:   'ring-2 ring-white/15',
    collapseRow:  'text-slate-500 hover:text-slate-200 hover:bg-white/5',
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICONS = {
    LayoutDashboard, FileText, Megaphone, PlusCircle, Search,
    CheckSquare, ClipboardCheck, AlertCircle, AlertTriangle,
    PieChart, DollarSign, CreditCard, CheckCircle,
    Activity, Award, BookOpen, Database, FileLock2, LifeBuoy,
    BarChart, BarChart2, TrendingUp, TrendingDown,
    Users, Building, Building2, Shield, Settings, Bell, Key,
    FolderOpen, EyeOff, Presentation, ClipboardList,
    BadgeDollarSign, Trophy, Archive, ListChecks, ShieldCheck,
    Globe, CalendarDays, Banknote, Landmark,
    FlaskConical, Brain, MessageSquareHeart, Scale, ScrollText, Milestone, FileBarChart2, FolderSearch,
    HelpCircle, Sliders, Clock, FileSignature, ShieldAlert, CalendarClock, CalendarPlus, Timer, UserPlus, Handshake, Webhook, Layers,
    BuildingOffice: Building2,
}

// ─── Group icon map ───────────────────────────────────────────────────────────

const GROUP_ICONS = {
    'Main':                LayoutDashboard,
    'Proposals':           FileText,
    'Review & Evaluation': ClipboardCheck,
    'Budget':              DollarSign,
    'Monitoring':          Activity,
    'Insights':            ChartNoAxesCombined,
    'User':                Bell,
    'Events':              CalendarDays,
    'External Funds':      Banknote,
    'Administration':      Shield,
    'Settings':            Settings,
}

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_COLORS = {
    super_admin:        'from-red-500 to-rose-600',
    admin:              'from-orange-500 to-amber-600',
    central_officer:    'from-violet-500 to-purple-600',
    research_officer:   'from-indigo-500 to-blue-600',
    community_officer:  'from-pink-500 to-rose-600',
    technology_officer: 'from-cyan-500 to-blue-600',
    college_officer:    'from-teal-500 to-green-600',
    college_rtt_manager: 'from-blue-600 to-indigo-700',
    finance_officer:    'from-amber-500 to-yellow-600',
    support_officer:    'from-yellow-500 to-amber-500',
    staff:              'from-emerald-500 to-teal-600',
    guest:              'from-gray-400 to-gray-500',
    default:            'from-indigo-500 to-purple-600',
}

// ─── User Menu dropdown ───────────────────────────────────────────────────────

function UserMenu({ user, logout, unreadNotifications, isSuperAdmin, collapsed, canImpersonate, onSwitchLogin }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [])

    rememberRoleLabels(user?.role_labels)
    const roles    = user?.roles?.map(r => typeof r === 'string' ? r : r.name) ?? []
    const role     = roles[0] ?? 'guest'
    const initials = (user?.name ?? 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    const gradient = ROLE_COLORS[role] ?? ROLE_COLORS.default
    const allRolesLabel = roles.map(roleLabel).join(', ')

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl
                           hover:bg-gray-100 transition-colors"
            >
                {/* Avatar */}
                <div className="relative shrink-0">
                    <div className={`h-8 w-8 rounded-full bg-linear-to-br ${gradient}
                                     flex items-center justify-center text-white text-xs font-bold
                                     overflow-hidden`}>
                        {user?.avatar
                            ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                            : initials
                        }
                    </div>
                    {unreadNotifications > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 flex items-center justify-center
                                         rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-white">
                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                    )}
                </div>
                <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-gray-800 leading-none max-w-28 truncate">{user?.name}</p>
                </div>
                <ChevronDown size={13} className={`text-gray-400 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-gray-200
                                bg-white shadow-xl overflow-hidden">

                    {/* Identity header */}
                    <div className={`px-4 py-3 bg-linear-to-r ${gradient}`}>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center
                                            justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                                {user?.avatar
                                    ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                                    : initials
                                }
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                                <p className="text-xs text-white/70 truncate">{user?.email}</p>
                                <span className="inline-block mt-0.5 text-[10px] text-white/80 capitalize">
                                    {allRolesLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                        <Link href="/profile" onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <User size={14} className="text-indigo-500" />
                            <span>{tr("My Profile")}</span>
                        </Link>
                        <Link href="/notifications" onClick={() => setOpen(false)}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Bell size={14} className="text-blue-500" />
                                <span>{tr("Notifications")}</span>
                            </div>
                            {unreadNotifications > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full
                                                 bg-red-500 text-[10px] font-bold text-white px-1">
                                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                                </span>
                            )}
                        </Link>
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 sm:hidden">
                            <span>{tr('Language')}</span>
                            <LanguageSwitch reload className="text-gray-500" />
                        </div>
                        {isSuperAdmin && (
                            <Link href="/admin/settings" onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                <Settings size={14} className="text-gray-400" />
                                <span>{tr("Settings")}</span>
                            </Link>
                        )}
                        {canImpersonate && (
                            <button onClick={() => { setOpen(false); onSwitchLogin?.() }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                <LogIn size={14} className="text-emerald-500" />
                                <span>{tr("Switch Login")}</span>
                            </button>
                        )}

                        <div className="mx-4 my-1 border-t border-gray-100" />

                        <button onClick={() => { setOpen(false); logout() }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                            <LogOut size={14} />
                            <span>{tr("Sign out")}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Nav badge ────────────────────────────────────────────────────────────────

function NavBadge({ count, collapsed }) {
    if (!count || count <= 0) return null
    if (collapsed) {
        return <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-rose-500" />
    }
    return (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full
                         bg-rose-500 text-[10px] font-bold text-white px-1 shrink-0">
            {count > 99 ? '99+' : count}
        </span>
    )
}

// ─── Guest access banner ──────────────────────────────────────────────────────

function GuestBanner() {
    const [dismissed, setDismissed] = useState(false)
    if (dismissed) return null
    return (
        <div className="flex items-center justify-between gap-3 px-5 py-3
                        bg-amber-50 border-b border-amber-200 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="shrink-0 h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                    <UserX size={14} className="text-amber-600" />
                </div>
                <p className="text-xs text-amber-800 leading-snug">
                    <span className="font-semibold">{tr("You are logged in as a Guest.")}</span>
                    {' '}{tr("You have limited access. Please contact the administrator to be assigned the appropriate role.")}
                </p>
            </div>
            <button
                onClick={() => setDismissed(true)}
                className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors"
                title={tr("Dismiss")}
            >
                <X size={14} />
            </button>
        </div>
    )
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export default function AppLayout({ children, breadcrumb }) {
    const { user, setUser, logout, hasPermission, refreshUser, isImpersonating, stopImpersonating, impersonate } = useAuth()
    const toast = useToast()
    const canImpersonate = hasPermission('users.impersonate') && !isImpersonating
    const [switchLoginOpen, setSwitchLoginOpen] = useState(false)
    const [switchTarget, setSwitchTarget] = useState(null)
    const [switching, setSwitching] = useState(false)
    const [openDefenceHold, setOpenDefenceHold] = useState(null)

    // College officers can only enter the open defence phase once every proposal in
    // their college has finished blind review — check before navigating, so they see
    // why instead of landing on a page they can't act on.
    // The signed-in user's data scope ('all' | 'college' | 'category' | 'own'), from /auth/me.
    const scope = user?.access_scope?.type ?? 'own'
    const isOpenDefenceGated = scope === 'college' && hasPermission('reviews.manage')

    const handleNavClick = async (e, href) => {
        setMobileOpen(false)
        if (href !== '/admin/open-defence' || !isOpenDefenceGated) return

        e.preventDefault()
        try {
            const res = await api.get('/defence/college-readiness')
            const readiness = res.data?.data
            if (readiness && !readiness.can_schedule) {
                setOpenDefenceHold({
                    collegeName: readiness.college_name,
                    pending: readiness.pending_blind_review ?? [],
                })
                return
            }
        } catch { /* fall through — the page itself re-checks */ }
        router.visit(href)
    }

    const handleSwitchSelect = (target) => {
        setSwitchLoginOpen(false)
        setSwitchTarget(target)
    }

    const confirmSwitchLogin = async () => {
        if (!switchTarget) return
        setSwitching(true)
        try {
            await impersonate(switchTarget.id)
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Could not log in as this user.')
            setSwitching(false)
            setSwitchTarget(null)
        }
    }
    const { hasFeature, hasSubFeature } = useFeature()
    const counts    = useActionCounts()
    const [paletteOpen, setPaletteOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
    const [mobileOpen, setMobileOpen] = useState(false)

    const toggleCollapsed = () => {
        setCollapsed(v => {
            const next = !v
            localStorage.setItem('sidebar_collapsed', String(next))
            return next
        })
    }

    const [expandedGroups, setExpandedGroups] = useState(new Set())

    const toggleGroup = (groupName) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupName)) { next.delete(groupName) } else { next.add(groupName) }
            return next
        })
    }
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [isOnline, setIsOnline] = useState(() => navigator.onLine)
    // authReady gates the route guard — prevents a stale-localStorage "Access Denied"
    // flash while the fresh /auth/me call is in flight.
    const [authReady, setAuthReady] = useState(false)
    const { url } = usePage()

    useEffect(() => {
        const token = localStorage.getItem('rtt_token')
        if (!token) { window.location.href = '/login'; return }
        // Always fetch fresh user data (roles + permissions) on every page load
        // so admin changes (role/permission assignment) are picked up immediately
        // without requiring the affected user to log out and back in.
        refreshUser().finally(() => setAuthReady(true))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (localStorage.getItem('rtt_session_evicted_notice')) {
            localStorage.removeItem('rtt_session_evicted_notice')
            toast.info('Your previous session on another device has been logged out.')
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const goOnline  = () => setIsOnline(true)
        const goOffline = () => setIsOnline(false)
        window.addEventListener('online',  goOnline)
        window.addEventListener('offline', goOffline)
        return () => {
            window.removeEventListener('online',  goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [])

    // Global ⌘K / Ctrl+K shortcut for command palette
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setPaletteOpen(v => !v)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // All appearance / general settings come from the Inertia shared props
    const appSettings = usePage().props.app_settings ?? {}
    const sidebarBg          = appSettings.sidebar_color      || '#ffffff'
    const systemName         = appSettings.system_name        || 'RTT Platform'
    const systemTagline      = appSettings.system_tagline     || 'Research & Tech Transfer'
    const systemLogo         = appSettings.system_logo        || null
    const logoW              = parseInt(appSettings.logo_width  || '28', 10)
    const logoH              = parseInt(appSettings.logo_height || '28', 10)
    const announcementActive = appSettings.announcement_active === 'true'
    const announcementMsg    = appSettings.announcement_message || ''
    const footerText         = appSettings.footer_text        || ''
    const sessionTimeoutMins = parseInt(appSettings.session_timeout_minutes ?? '0', 10)

    const [announcementDismissed, setAnnouncementDismissed] = useState(false)

    // ── Profile completeness prompt ─────────────────────────────────────────────
    const showProfileComplete = !!user && (
        !user.gender || !user.college_id || !(user.expertise?.length > 0)
    )

    // ── Feedback popup ──────────────────────────────────────────────────────────
    const feedbackPopupEnabled = appSettings.feedback_popup_enabled === 'true'
    const feedbackSubmitted    = user?.feedback_submitted ?? true
    const [feedbackDismissed, setFeedbackDismissed] = useState(false)
    const showFeedbackPopup = feedbackPopupEnabled && !feedbackSubmitted && !feedbackDismissed && !showProfileComplete

    // ── Session timeout ────────────────────────────────────────────────────────
    const [sessionWarning, setSessionWarning] = useState(null) // { secondsLeft }

    const handleSessionWarn = useCallback((secsLeft) => {
        setSessionWarning({ secondsLeft: secsLeft })
    }, [])

    const handleSessionLogout = useCallback(() => {
        setSessionWarning(null)
        logout()
    }, [logout])

    const { resetActivity } = useSessionTimeout({
        timeoutMinutes: sessionTimeoutMins,
        onWarn:         handleSessionWarn,
        onLogout:       handleSessionLogout,
    })

    // Countdown tick for the warning modal
    useEffect(() => {
        if (!sessionWarning) return
        if (sessionWarning.secondsLeft <= 0) { handleSessionLogout(); return }
        const t = setTimeout(() =>
            setSessionWarning(prev => prev ? { secondsLeft: prev.secondsLeft - 1 } : null)
        , 1000)
        return () => clearTimeout(t)
    }, [sessionWarning, handleSessionLogout])

    // ── Sidebar group accordion — auto-expand the active group ────────────
    // Initialize: open only the group containing the current route
    useEffect(() => {
        if (authReady) {
            const path = window.location.pathname
            const active = navGroups.find(g =>
                g.items.some(i => path === i.href || path.startsWith(i.href + '/'))
            )
            setExpandedGroups(new Set(active ? [active.group] : []))
        }
    }, [authReady]) // eslint-disable-line

    // Auto-expand when navigating via Inertia links
    useEffect(() => {
        const path = window.location.pathname
        const active = navGroups.find(g =>
            g.items.some(i => path === i.href || path.startsWith(i.href + '/'))
        )
        if (active) {
            setExpandedGroups(prev => {
                if (prev.has(active.group)) return prev
                return new Set([...prev, active.group])
            })
        }
    }, [url]) // eslint-disable-line

    // ── Route permission guard ─────────────────────────────────────────────────
    const currentPath      = url || window.location.pathname
    const requiredSubFeature = getRequiredSubFeature(currentPath)
    // Pages are opened by permission. A path under /admin/ with no entry is denied
    // (safety net); any other unlisted path is open to every signed-in user.
    const canOpen = (path) => canOpenPath(path, hasPermission)
    const roleAndPermAllowed = !user || canOpen(currentPath)
    // A page whose sub-feature has been switched off in Feature Management is
    // blocked even for a user who otherwise has the role/permission to view it —
    // matches what the sidebar already does by hiding the link, but now also
    // enforced against direct URL navigation, not just link visibility.
    const subFeatureAllowed = !user || requiredSubFeature === null || hasSubFeature(requiredSubFeature)
    const routeAllowed = roleAndPermAllowed && subFeatureAllowed
    const unauthorizedReason = !roleAndPermAllowed ? 'permission' : !subFeatureAllowed ? 'feature_disabled' : null

    const isDark = isDarkColor(sidebarBg)
    const sc     = isDark ? DARK : LIGHT

    const isActive = (href) => {
        const currentPath   = window.location.pathname
        const currentSearch = window.location.search
        if (href.includes('?')) return currentPath + currentSearch === href
        const exactOnly = ['/dashboard', '/researcher-hub', '/proposals', '/my-proposals', '/reviews', '/complaints', '/repository']
        if (exactOnly.includes(href)) return currentPath === href
        return currentPath === href || currentPath.startsWith(href + '/')
    }

    const isGroupActive = (group) => group.items.some(item => isActive(item.href))


    // perm() = true if user has this Spatie permission (works for ANY role, including custom)
    const perm = (p) => hasPermission(p)

    const navGroups = [
        {
            group: 'Main',
            items: [
                { label: 'Dashboard',       href: '/dashboard',      icon: 'LayoutDashboard', show: true },
                { label: 'My Research Hub', href: '/researcher-hub', icon: 'Brain',           show: true },
                { label: 'Mentorship',      href: '/mentorship',     icon: 'Handshake',       show: true },
                { label: 'Calendar',        href: '/calendar',       icon: 'CalendarDays',    show: true },
                { label: 'Help Centre',     href: '/help',           icon: 'LifeBuoy',        show: true },
            ],
        },
        {
            group: 'Proposals',
            items: [
                {
                    label: 'All Proposals', href: '/proposals', icon: 'FileText',
                    show: canOpen('/proposals') && scope !== 'own' && hasSubFeature('proposals.all'),
                },
                {
                    label: 'Proposal Calls', href: '/proposal-calls', icon: 'Megaphone',
                    show: canOpen('/proposal-calls') && hasSubFeature('proposals.calls'),
                    badge: c => c.proposal_calls_active,
                },
                {
                    label: 'New Application', href: '/proposals/create', icon: 'PlusCircle',
                    show: canOpen('/proposals/create') && hasSubFeature('proposals.new_application'),
                },
                {
                    label: 'Track Proposal', href: '/tracker', icon: 'Search',
                    show: hasSubFeature('proposals.track'),
                },
                {
                    label: 'My Proposals', href: '/my-proposals', icon: 'FolderOpen',
                    show: canOpen('/my-proposals') && hasSubFeature('proposals.my_proposals'),
                    badge: c => c.my_proposals_draft,
                },
                {
                    label: 'Funded Proposals', href: '/my-research', icon: 'Trophy',
                    show: perm('proposals.submit'),
                },
                {
                    label: 'My Complaints', href: '/complaints', icon: 'AlertCircle',
                    show: perm('complaints.create') && !perm('complaints.respond') && hasSubFeature('complaints.manage'),
                    badge: c => c.my_complaints_answered,
                },
                {
                    label: 'Awarded Proposals', href: '/admin/awarded', icon: 'Trophy',
                    show: canOpen('/admin/awarded') && hasSubFeature('proposals.awarded'),
                    badge: c => c.awarded_without_allocation,
                },
                {
                    label: 'Contracts', href: '/admin/contracts', icon: 'FileSignature',
                    show: canOpen('/admin/contracts') && hasSubFeature('proposals.contracts'),
                    badge: c => c.contracts_pending_review,
                },
                {
                    label: 'Budget Revisions', href: '/admin/budget-revisions', icon: 'BadgeDollarSign',
                    show: canOpen('/admin/budget-revisions'),
                    badge: c => c.budget_revisions_pending,
                },
                {
                    label: 'Completed Archive', href: '/admin/completed-archive', icon: 'Archive',
                    show: canOpen('/admin/completed-archive') && hasSubFeature('proposals.archive'),
                },
            ],
        },
        {
            group: 'Review & Evaluation',
            items: [
                {
                    label: 'Validation Queue', href: '/admin/validation-queue', icon: 'CheckSquare',
                    show: canOpen('/admin/validation-queue') && hasSubFeature('evaluation.validation'),
                    badge: c => c.validation_queue,
                },
                {
                    label: 'Appeals', href: '/admin/appeals', icon: 'Scale',
                    show: canOpen('/admin/appeals'),
                },
                {
                    label: 'Approval Reports', href: '/admin/approval-reports', icon: 'ShieldAlert',
                    show: canOpen('/admin/approval-reports'),
                    badge: c => c.approval_reports_open,
                },
                {
                    label: 'Deadline Extensions', href: '/admin/deadline-extensions', icon: 'CalendarClock',
                    show: canOpen('/admin/deadline-extensions'),
                    badge: c => c.deadline_extensions_pending,
                },
                {
                    label: 'Reviewer Certificates', href: '/admin/review-certificates', icon: 'Award',
                    show: canOpen('/admin/review-certificates'),
                },
                {
                    label: 'Defence Extensions', href: '/admin/defence-extensions', icon: 'CalendarPlus',
                    show: canOpen('/admin/defence-extensions'),
                    badge: c => c.defence_extensions_pending,
                },
                {
                    label: 'No-Cost Extensions', href: '/admin/no-cost-extensions', icon: 'CalendarDays',
                    show: canOpen('/admin/no-cost-extensions'),
                    badge: c => c.no_cost_extensions_pending,
                },
                {
                    label: 'Ethical Clearance', href: '/admin/ethical-clearance', icon: 'ShieldCheck',
                    show: canOpen('/admin/ethical-clearance'),
                    badge: c => c.ethical_clearances_pending,
                },
                {
                    label: 'Grant Letters', href: '/admin/grant-letters', icon: 'ScrollText',
                    show: canOpen('/admin/grant-letters'),
                },
                {
                    label: 'Blind Review', href: '/admin/blind-review', icon: 'EyeOff',
                    show: canOpen('/admin/blind-review') && hasSubFeature('evaluation.blind_review'),
                    badge: c => c.blind_review_queue,
                },
                {
                    label: 'Open Defence', href: '/admin/open-defence', icon: 'Presentation',
                    show: canOpen('/admin/open-defence') && hasSubFeature('evaluation.open_defence'),
                    badge: c => c.open_defence_queue,
                },
                {
                    label: 'Central Evaluation', href: '/admin/central-evaluation', icon: 'ClipboardList',
                    show: canOpen('/admin/central-evaluation') && hasSubFeature('evaluation.central'),
                    badge: c => c.central_eval_queue,
                },
                {
                    label: 'Assigned Reviews', href: '/reviews', icon: 'ClipboardCheck',
                    show: canOpen('/reviews') && hasSubFeature('evaluation.assigned_reviews'),
                    badge: c => c.pending_reviews,
                },
                {
                    label: 'Evaluation Criteria', href: '/admin/evaluation-criteria', icon: 'ListChecks',
                    show: canOpen('/admin/evaluation-criteria') && hasSubFeature('evaluation.criteria'),
                },
                {
                    label: 'Reviewer Workload', href: '/admin/reviewer-workload', icon: 'Users',
                    show: canOpen('/admin/reviewer-workload') && hasSubFeature('evaluation.reviewer_workload'),
                },
                {
                    label: 'Reviewer Applications', href: '/admin/reviewer-applications', icon: 'UserPlus',
                    show: canOpen('/admin/reviewer-applications'),
                },
                {
                    label: 'Review Deadlines', href: '/admin/review-deadlines', icon: 'Clock',
                    show: canOpen('/admin/review-deadlines') && hasSubFeature('evaluation.review_deadlines'),
                    badge: c => c.overdue_reviews,
                },
                {
                    label: 'COI Conflicts', href: '/admin/coi-conflicts', icon: 'ShieldAlert',
                    show: canOpen('/admin/coi-conflicts') && hasSubFeature('evaluation.coi_conflicts'),
                    badge: c => c.coi_conflicts_pending,
                },
                {
                    label: 'Complaints', href: '/complaints', icon: 'AlertCircle',
                    show: perm('complaints.respond') && hasSubFeature('complaints.manage'),
                    badge: c => c.open_complaints,
                },
                {
                    label: 'Similarity Flags', href: '/admin/similarity-flags', icon: 'AlertTriangle',
                    show: canOpen('/admin/similarity-flags') && hasSubFeature('similarity.flags'),
                    badge: c => c.similarity_flags_pending,
                },
            ],
        },
        {
            group: 'Budget',
            items: [
                {
                    label: 'Budget Allocations', href: '/budget-allocations', icon: 'PieChart',
                    show: canOpen('/budget-allocations') && hasSubFeature('finance.allocations'),
                    badge: c => c.pending_allocations,
                },
                {
                    label: 'Budget Requests', href: '/budget-requests', icon: 'DollarSign',
                    show: canOpen('/budget-requests') && hasSubFeature('finance.requests'),
                    badge: c => (c.pending_signatures ?? 0) + (c.budget_requests_review ?? 0),
                },
                {
                    label: 'Proposal Funding', href: '/admin/funding', icon: 'BadgeDollarSign',
                    show: canOpen('/admin/funding') && hasSubFeature('finance.funding'),
                    badge: c => c.proposal_funding_queue,
                },
                {
                    label: 'Disbursements', href: '/disbursements', icon: 'CreditCard',
                    show: canOpen('/disbursements') && hasSubFeature('finance.disbursements'),
                    badge: c => c.pending_disbursements,
                },
                {
                    label: 'Settlements', href: '/settlements', icon: 'CheckCircle',
                    show: canOpen('/settlements') && hasSubFeature('finance.settlements'),
                    badge: c => c.pending_settlements,
                },
                {
                    label: 'Budget Milestones', href: '/finance/milestones', icon: 'Milestone',
                    show: canOpen('/finance/milestones') && hasSubFeature('finance.requests'),
                },
            ],
        },
        {
            group: 'Monitoring',
            items: [
                {
                    label: 'Ongoing Proposals', href: '/ongoing-proposals', icon: 'TrendingUp',
                    show: canOpen('/ongoing-proposals') && hasSubFeature('monitoring.ongoing'),
                    badge: c => c.ongoing_awaiting_midterm,
                },
                {
                    label: 'Projects at Risk', href: '/projects-at-risk', icon: 'ShieldAlert',
                    show: canOpen('/projects-at-risk') && hasSubFeature('monitoring.ongoing'),
                },
                {
                    label: 'Progress Reports', href: '/progress-reports', icon: 'ClipboardList',
                    show: canOpen('/progress-reports'),
                },
                {
                    label: 'Midterm Evaluations', href: '/midterm-evaluations', icon: 'Activity',
                    show: canOpen('/midterm-evaluations') && hasSubFeature('monitoring.midterm'),
                    badge: c => c.midterm_pending,
                },
                {
                    label: 'Completion Workshops', href: '/completion-workshops', icon: 'Award',
                    show: canOpen('/completion-workshops') && hasSubFeature('monitoring.completion'),
                    badge: c => c.completion_workshops_pending,
                },
                {
                    label: 'Research Outputs', href: '/research-outputs', icon: 'BookOpen',
                    show: canOpen('/research-outputs') && hasSubFeature('monitoring.outputs'),
                },
                {
                    label: 'Repository', href: '/repository', icon: 'Database',
                    show: perm('repository.view_any') && hasSubFeature('repository.view'),
                },
                {
                    label: 'Research Impact', href: '/research-impact', icon: 'TrendingUp',
                    show: canOpen('/research-impact'),
                },
                {
                    label: 'Manage Repository', href: '/admin/repository', icon: 'Database',
                    show: canOpen('/admin/repository') && hasSubFeature('repository.manage'),
                },
            ],
        },
        {
            // One analytics area: every page here also carries the shared Insights tab bar.
            group: 'Insights',
            items: [
                {
                    label: 'Overview', href: '/insights', icon: 'LayoutDashboard',
                    show: canOpen('/insights'),
                },
                {
                    label: 'Reports', href: '/reports', icon: 'BarChart',
                    show: canOpen('/reports') && hasSubFeature('reports.generate'),
                },
                {
                    label: 'Analytics', href: '/admin/analytics', icon: 'Brain',
                    show: canOpen('/admin/analytics') && hasSubFeature('reports.analytics'),
                },
                {
                    label: 'Proposal Pipeline', href: '/admin/proposal-pipeline', icon: 'Activity',
                    show: canOpen('/admin/proposal-pipeline') && hasSubFeature('reports.analytics'),
                },
                {
                    label: 'Turnaround', href: '/admin/turnaround', icon: 'Timer',
                    show: canOpen('/admin/turnaround'),
                },
                {
                    label: `${term('college')} Phase Completion`, href: '/admin/college-phase-completion', icon: 'ListChecks',
                    show: canOpen('/admin/college-phase-completion') && hasSubFeature('reports.analytics'),
                },
                {
                    label: `${term('college')} Dashboard`, href: '/reports/college-dashboard', icon: 'Building2',
                    show: canOpen('/reports/college-dashboard'),
                },
                {
                    label: 'Annual RTT Report', href: '/reports/annual', icon: 'FileBarChart2',
                    show: canOpen('/reports/annual') && hasSubFeature('reports.generate'),
                },
                {
                    label: 'Report Builder', href: '/reports/builder', icon: 'Sliders',
                    show: canOpen('/reports/builder') && hasSubFeature('reports.generate'),
                },
                {
                    label: 'Proposal Archive', href: '/admin/proposal-archive', icon: 'FolderSearch',
                    show: canOpen('/admin/proposal-archive'),
                },
            ],
        },
        {
            group: 'Events',
            items: [
                {
                    label: 'Conferences', href: '/admin/conferences', icon: 'CalendarDays',
                    show: canOpen('/admin/conferences') && hasSubFeature('events.conferences'),
                },
                {
                    // Abstract submission management is admin-only now — reviewers (staff/external)
                    // reach their assigned abstracts via the "Assigned Reviews" link to /reviews instead.
                    label: 'Abstracts', href: '/admin/abstracts', icon: 'FileText',
                    show: canOpen('/admin/abstracts') && hasSubFeature('events.abstracts'),
                },
            ],
        },
        {
            group: 'External Funds',
            items: [
                {
                    label: 'External Funds', href: '/admin/external-funds', icon: 'Banknote',
                    show: canOpen('/admin/external-funds') && hasSubFeature('external_funds.manage'),
                },
            ],
        },
        {
            group: 'Administration',
            items: [
                {
                    label: 'Users', href: '/admin/users', icon: 'Users',
                    show: canOpen('/admin/users'),
                },
                { label: 'Roles',       href: '/admin/roles',      icon: 'ShieldCheck', show: canOpen('/admin/roles') },
                { label: 'Permissions', href: '/admin/permissions', icon: 'Key',         show: canOpen('/admin/permissions') },
                {
                    label: term('college', { plural: true }), href: '/admin/colleges', icon: 'Building',
                    show: canOpen('/admin/colleges'),
                },
                {
                    label: term('department', { plural: true }), href: '/admin/departments', icon: 'BuildingOffice',
                    show: canOpen('/admin/departments'),
                },
                {
                    label: 'Thematic Areas', href: '/admin/thematic-areas', icon: 'FlaskConical',
                    show: canOpen('/admin/thematic-areas'),
                },
                {
                    label: 'Dropdown Options', href: '/admin/dropdown-options', icon: 'ListChecks',
                    show: canOpen('/admin/dropdown-options'),
                },
                {
                    label: 'Resources', href: '/admin/resources', icon: 'FolderOpen',
                    show: canOpen('/admin/resources'),
                },
                {
                    label: 'Audit Logs', href: '/admin/audit-logs', icon: 'Shield',
                    show: canOpen('/admin/audit-logs'),
                },
                {
                    label: 'System Monitor', href: '/admin/system-monitor', icon: 'Activity',
                    show: canOpen('/admin/system-monitor'),
                },
                {
                    label: 'Feature Management', href: '/admin/features', icon: 'Settings',
                    show: canOpen('/admin/features'),
                },
            ],
        },
        {
            group: 'Settings',
            items: [
                { label: 'General',       href: '/admin/settings',      icon: 'Settings',    show: canOpen('/admin/settings') },
                { label: 'Public Site',    href: '/admin/public-site',   icon: 'Globe',       show: canOpen('/admin/public-site') },
                { label: 'Programmes',     href: '/admin/programmes',    icon: 'Layers',      show: canOpen('/admin/programmes') },
                { label: 'API & Webhooks', href: '/admin/integrations',  icon: 'Webhook',     show: canOpen('/admin/integrations') },
                { label: 'Login Notices',  href: '/admin/login-notices', icon: 'Megaphone',   show: canOpen('/admin/login-notices') },
                { label: 'FAQs',           href: '/admin/faqs',          icon: 'HelpCircle',  show: canOpen('/admin/faqs') },
                { label: 'Help Articles',  href: '/admin/help-articles', icon: 'BookOpen',    show: canOpen('/admin/help-articles') },
                { label: 'Data Requests',  href: '/admin/data-requests', icon: 'FileLock2',   show: canOpen('/admin/data-requests') },
                { label: 'Feedback',       href: '/admin/feedback',      icon: 'MessageSquareHeart', show: canOpen('/admin/feedback') },
            ],
        },
    ]

    const visibleGroups = navGroups
        .map(g => ({ ...g, items: g.items.filter(item => item.show) }))
        .filter(g => g.items.length > 0)

    // Onboarding tours may only visit pages in this user's own menu.
    const allowedRoutesKey = visibleGroups.flatMap(g => g.items.map(i => i.href.split('?')[0])).join('|')
    const allowedRoutes = useMemo(() => new Set(allowedRoutesKey.split('|').filter(Boolean)), [allowedRoutesKey])
    const revealNav = useCallback((href) => {
        const group = visibleGroups.find(g => g.items.some(i => i.href.split('?')[0] === href))
        if (group) setExpandedGroups(prev => (prev.has(group.group) ? prev : new Set([...prev, group.group])))
        if (window.matchMedia('(max-width: 767px)').matches) setMobileOpen(true)
    }, [allowedRoutesKey]) // eslint-disable-line react-hooks/exhaustive-deps
    const hideMobileNav = useCallback(() => setMobileOpen(false), [])

    rememberRoleLabels(user?.role_labels)
    const roles      = user?.roles?.map(r => typeof r === 'string' ? r : r.name) ?? []
    const primaryRole = roles[0] ?? 'guest'
    const gradient    = ROLE_COLORS[primaryRole] ?? ROLE_COLORS.default
    const initials    = (user?.name ?? 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    const rolesText   = roles.length > 1
        ? roles.map(roleLabel).join(' · ')
        : roleLabel(primaryRole)

    return (
        <OnboardingProvider
            user={authReady ? user : null}
            allowedRoutes={allowedRoutes}
            revealNav={revealNav}
            hideMobileNav={hideMobileNav}
            readOnly={isImpersonating}
            suspended={showProfileComplete}
        >
        <div className="relative flex h-screen bg-gray-50/50 overflow-hidden">

            {/* ── Offline banner ────────────────────────────────────────────── */}
            {!isOnline && (
                <div className="fixed top-0 inset-x-0 z-9999 flex items-center justify-center gap-2.5
                                px-4 py-2.5 bg-gray-900 text-white text-sm font-medium
                                animate-in slide-in-from-top duration-300">
                    <span className="flex h-2 w-2 relative shrink-0">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    {tr("No internet connection — changes you make may not be saved until you reconnect.")}
                </div>
            )}

            {/* ── Mobile sidebar backdrop ───────────────────────────────────── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Sidebar ──────────────────────────────────────────────────── */}
            <aside
                data-tour="sidebar"
                style={{ backgroundColor: sidebarBg }}
                className={cn(
                    // Mobile: off-canvas drawer (fixed, full height, slides in from left)
                    'fixed inset-y-0 left-0 z-50 flex flex-col w-72',
                    'transition-all duration-200 ease-in-out',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    // Desktop: in-flow sidebar, controlled width
                    'md:relative md:inset-auto md:z-auto md:translate-x-0 md:shrink-0',
                    collapsed ? 'md:w-15' : 'md:w-60',
                    sc.border
                )}>

                {/* Logo */}
                <div className={cn(
                    'flex items-center h-14 shrink-0',
                    sc.logoBorder,
                    collapsed ? 'justify-center px-3' : 'px-4 gap-3'
                )}>
                    {/* Logo icon — custom image or default icon */}
                    {systemLogo ? (
                        <img src={systemLogo} alt={systemName}
                            style={{ width: logoW, height: logoH }}
                            className="rounded-lg object-contain shrink-0" />
                    ) : (
                        <div style={{ width: logoW, height: logoH }}
                            className="rounded-lg bg-linear-to-br from-indigo-500 to-violet-600
                                        flex items-center justify-center shrink-0 shadow-sm">
                            <FlaskConical size={Math.round(logoW * 0.5)} className="text-white" />
                        </div>
                    )}
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className={cn('text-sm font-extrabold leading-none truncate tracking-tight', sc.logoTitle)}>{systemName}</p>
                            <p className={cn('text-[10px] mt-0.5 truncate font-semibold', sc.logoSub)}>{systemTagline}</p>
                        </div>
                    )}
                </div>

                {/* Nav scroll area */}
                <nav
                    className={cn(
                        'flex-1 overflow-y-auto py-3 overflow-x-hidden scrollbar-thin scrollbar-track-transparent',
                        sc.scrollbar
                    )}
                >
                    {visibleGroups.map((group, gi) => {
                        const groupIsActive = isGroupActive(group)
                        const isExpanded    = collapsed || expandedGroups.has(group.group)

                        return (
                            <div key={group.group}>

                                {/* ── Group header ───────────────────────────────── */}
                                {(() => {
                                    const GroupIcon = GROUP_ICONS[group.group]
                                    return collapsed ? (
                                        /* Collapsed: group icon as a tooltip trigger */
                                        <Link
                                            href={group.items[0]?.href ?? '#'}
                                            title={tr(group.group)}
                                            onClick={() => setMobileOpen(false)}
                                            className="relative flex items-center justify-center my-0.5"
                                        >
                                            <span className={cn(
                                                'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 mx-1.5',
                                                groupIsActive
                                                    ? isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                                                    : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/6' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/70'
                                            )}>
                                                {GroupIcon && <GroupIcon size={15} />}
                                            </span>
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => toggleGroup(group.group)}
                                            className={cn(
                                                'group/hdr w-full flex items-center gap-2.5 select-none',
                                                'mx-2 px-2.5 rounded-lg transition-all duration-150',
                                                gi > 0 ? 'mt-4 py-1.5' : 'mt-2 py-1.5',
                                                sc.groupLabel(groupIsActive),
                                                isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100/60'
                                            )}
                                        >
                                            {/* Section icon */}
                                            {GroupIcon && (
                                                <span className={cn(
                                                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                                                    groupIsActive
                                                        ? 'bg-indigo-500/15 text-indigo-500'
                                                        : isDark ? 'bg-white/6 text-slate-400' : 'bg-gray-100 text-gray-500'
                                                )}>
                                                    <GroupIcon size={11} />
                                                </span>
                                            )}
                                            <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-widest leading-none">
                                                {tr(group.group)}
                                            </span>
                                            <ChevronDown
                                                size={12}
                                                className={cn(
                                                    'shrink-0 transition-transform duration-200 ease-in-out',
                                                    isExpanded ? 'rotate-0' : '-rotate-90',
                                                    'opacity-60 group-hover/hdr:opacity-100'
                                                )}
                                            />
                                        </button>
                                    )
                                })()}

                                {/* ── Items (CSS grid height animation) ──────────── */}
                                <div className={cn(
                                    'grid transition-all duration-200 ease-out',
                                    isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                )}>
                                    <div className="min-h-0 overflow-hidden">
                                        <div className={cn('py-1', collapsed ? 'px-1.5' : 'px-2')}>
                                            {group.items.map(item => {
                                                const Icon       = ICONS[item.icon]
                                                const active     = isActive(item.href)
                                                const badgeCount = item.badge ? (item.badge(counts) ?? 0) : 0

                                                /* Collapsed: centered icon square */
                                                if (collapsed) {
                                                    return (
                                                        <Link key={item.href} href={item.href} title={tr(item.label)}
                                                            data-tour={`nav:${item.href.split('?')[0]}`}
                                                            onClick={(e) => handleNavClick(e, item.href)}
                                                            className="relative flex items-center justify-center my-0.5">
                                                            <span className={cn(
                                                                'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150',
                                                                sc.iconSquare(active)
                                                            )}>
                                                                {Icon && <Icon size={16} />}
                                                            </span>
                                                            {badgeCount > 0 && (
                                                                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-rose-500" />
                                                            )}
                                                        </Link>
                                                    )
                                                }

                                                /* Expanded: clean full-width row, no icon bg on inactive */
                                                return (
                                                    <Link key={item.href} href={item.href}
                                                        data-tour={`nav:${item.href.split('?')[0]}`}
                                                        onClick={(e) => handleNavClick(e, item.href)}
                                                        className={cn(
                                                            'group flex items-center gap-3 rounded-xl px-3 py-2 mb-px',
                                                            'transition-all duration-150',
                                                            sc.navItem(active)
                                                        )}>

                                                        {/* Active: icon in frosted pill. Inactive: bare icon */}
                                                        {Icon && (
                                                            active ? (
                                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/20">
                                                                    <Icon size={13} className="text-white/90" />
                                                                </span>
                                                            ) : (
                                                                <Icon size={15} className={cn('shrink-0', sc.icon(false))} />
                                                            )
                                                        )}

                                                        <span className={cn(
                                                            'flex-1 truncate text-[13px] leading-snug',
                                                            active ? 'font-semibold tracking-tight' : 'font-medium'
                                                        )}>
                                                            {tr(item.label)}
                                                        </span>

                                                        <NavBadge count={badgeCount} collapsed={false} />
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </nav>

                {/* In-sidebar collapse toggle — desktop only */}
                <div className={cn('hidden md:block shrink-0 px-2 py-2', sc.separator)}>
                    {collapsed ? (
                        <button onClick={toggleCollapsed} title={tr("Expand sidebar")}
                            className={cn(
                                'flex h-9 w-9 mx-auto items-center justify-center rounded-xl transition-all duration-150',
                                sc.collapseRow
                            )}>
                            <ChevronRight size={15} />
                        </button>
                    ) : (
                        <button onClick={toggleCollapsed} title={tr("Collapse sidebar")}
                            className={cn(
                                'group flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all duration-150',
                                sc.collapseRow
                            )}>
                            <ChevronLeft size={15} className="shrink-0" />
                            <span className="flex-1 text-left text-[13px] font-medium">{tr("Collapse Sidebar")}</span>
                        </button>
                    )}
                </div>

                {/* User footer */}
                <div className={cn('p-2 shrink-0', sc.footerBorder)} onClick={() => setMobileOpen(false)}>
                    {!collapsed ? (
                        <div className={cn(
                            'flex items-center gap-1 p-1 rounded-xl',
                            isDark ? 'bg-white/5 border border-white/7' : 'bg-gray-50/80 border border-gray-100'
                        )}>
                            <Link href="/profile"
                                className={cn(
                                    'group flex items-center gap-2.5 flex-1 min-w-0 px-1.5 py-1.5 rounded-lg transition-colors',
                                    sc.profileRow
                                )}
                            >
                                <div className={cn(
                                    `h-8 w-8 rounded-full bg-linear-to-br ${gradient}`,
                                    'flex items-center justify-center text-white text-xs font-bold',
                                    'shrink-0 overflow-hidden',
                                    sc.avatarRing
                                )}>
                                    {user?.avatar
                                        ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                                        : initials
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-xs font-semibold truncate leading-tight', sc.userName)}>
                                        {user?.name}
                                    </p>
                                    <p className={cn('text-[10px] truncate capitalize', sc.userRole)}>
                                        {rolesText}
                                    </p>
                                </div>
                            </Link>
                            <button onClick={logout} title={tr("Sign out")}
                                className={cn('p-2 rounded-xl transition-colors shrink-0', sc.logout)}>
                                <LogOut size={13} />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <Link href="/profile" title={tr("My Profile")}
                                className={cn(
                                    'flex w-full items-center justify-center py-2 rounded-xl transition-colors',
                                    sc.profileRow
                                )}>
                                <div className={cn(
                                    `h-7 w-7 rounded-full bg-linear-to-br ${gradient}`,
                                    'flex items-center justify-center text-white text-[10px] font-bold overflow-hidden',
                                    sc.avatarRing
                                )}>
                                    {user?.avatar
                                        ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                                        : initials
                                    }
                                </div>
                            </Link>
                            <button onClick={logout} title={tr("Sign out")}
                                className={cn(
                                    'flex w-full items-center justify-center p-2 rounded-xl transition-colors',
                                    sc.logout
                                )}>
                                <LogOut size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Collapse toggle — desktop only, floating edge button */}
                <button
                    onClick={toggleCollapsed}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className={cn(
                        'hidden md:flex absolute -right-3 top-13.5 z-20',
                        'h-6 w-6 rounded-full border items-center justify-center',
                        'transition-all duration-200',
                        sc.toggle
                    )}
                >
                    {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
                </button>
            </aside>

            {/* ── Main area ─────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-200">

                {/* Top header */}
                <header className="relative h-14 bg-white border-b border-gray-100 flex items-center
                                   justify-between px-4 shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                    {/* Brand accent line */}
                    <div className="absolute top-0 inset-x-0 h-0.5 bg-linear-to-r from-indigo-500 via-violet-500 to-indigo-400" />
                    <div className="flex items-center gap-1.5 min-w-0">
                        {/* Hamburger — mobile only */}
                        <button
                            className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
                            onClick={() => setMobileOpen(v => !v)}
                            aria-label={tr("Open menu")}
                            data-tour="menu-toggle"
                        >
                            <Menu size={20} />
                        </button>
                        {/* Home crumb — desktop only */}
                        <Link href="/dashboard"
                            className="hidden md:flex shrink-0 h-7 w-7 items-center justify-center
                                       rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                       transition-colors">
                            <LayoutDashboard size={14} />
                        </Link>
                        {breadcrumb && breadcrumb !== 'Dashboard' && (
                            <ChevronRight size={12} className="text-gray-300 shrink-0 hidden md:block" />
                        )}
                        <p className="text-sm font-semibold text-gray-800 truncate">
                            {breadcrumb ?? 'Dashboard'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* ⌘K command palette trigger */}
                        <button
                            onClick={() => setPaletteOpen(true)}
                            data-tour="search"
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200
                                       text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500
                                       bg-gray-50 hover:bg-indigo-50 transition-all"
                        >
                            <Search size={12} />
                            <span>{tr("Search")}</span>
                            <kbd className="flex items-center gap-0.5 text-[10px] opacity-60">
                                <span>⌘</span><span>K</span>
                            </kbd>
                        </button>
                        <LanguageSwitch reload className="hidden text-gray-500 sm:flex" />
                        {user && <HelpMenu />}
                        <span data-tour="notifications" className="flex">
                            <NotificationBell key={user?.id} onCountChange={setUnreadNotifications} />
                        </span>
                        {user && (
                            <span data-tour="user-menu" className="flex">
                            <UserMenu
                                user={user}
                                logout={logout}
                                unreadNotifications={unreadNotifications}
                                isSuperAdmin={canOpen('/admin/settings')}
                                collapsed={collapsed}
                                canImpersonate={canImpersonate}
                                onSwitchLogin={() => setSwitchLoginOpen(true)}
                            />
                            </span>
                        )}
                    </div>
                </header>

                {/* Impersonation banner */}
                {isImpersonating && (
                    <div className="flex items-center justify-between gap-3 px-5 py-2.5
                                    bg-indigo-600 text-white shrink-0">
                        <p className="text-xs font-medium flex-1 min-w-0 truncate">
                            {tr("Viewing as :name — actions you take affect this account.", { name: user?.name })}
                        </p>
                        <button onClick={stopImpersonating}
                            className="shrink-0 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1 rounded-lg transition-colors">
                            {tr("Return to Admin")}
                        </button>
                    </div>
                )}

                {/* Guest access banner */}
                {primaryRole === 'guest' && <GuestBanner />}

                {/* Announcement banner */}
                {announcementActive && announcementMsg && !announcementDismissed && (
                    <div className="flex items-center justify-between gap-3 px-5 py-2.5
                                    bg-amber-50 border-b border-amber-200 text-amber-800 shrink-0">
                        <p className="text-xs font-medium flex-1 min-w-0 truncate">{announcementMsg}</p>
                        <button onClick={() => setAnnouncementDismissed(true)}
                            className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Page content — guarded by role/permission check */}
                {/* relative: absolutely positioned elements inside a page (e.g. visually hidden
                    file inputs) are placed within this scrolling panel. Without it they are placed
                    against the whole document and stretch it, leaving blank space below the app. */}
                <main className="relative flex-1 overflow-y-auto p-5 md:p-6">
                    {/* A signed-in user's saved permissions already allow this page: show it
                        at once and let the fresh /auth/me check finish in the background. Only a
                        page the saved data would refuse waits, so there is no false "denied" flash. */}
                    {!authReady && !(user && routeAllowed)
                        ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-3 text-gray-400">
                                    <div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-xs font-medium">{tr("Loading…")}</p>
                                </div>
                            </div>
                        )
                        : routeAllowed ? children : <UnauthorizedView user={user} reason={unauthorizedReason} />
                    }
                </main>

                {/* Footer */}
                {footerText && (
                    <footer className="shrink-0 border-t border-gray-100 bg-white px-5 py-2.5">
                        <p className="text-xs text-gray-400 text-center">{footerText}</p>
                    </footer>
                )}
            </div>

            {/* Session expiry warning modal */}
            {sessionWarning && (
                <SessionWarningModal
                    secondsLeft={sessionWarning.secondsLeft}
                    onContinue={() => { resetActivity(); setSessionWarning(null) }}
                    onLogout={handleSessionLogout}
                />
            )}

            {showProfileComplete && (
                <ProfileCompleteModal
                    user={user}
                    onSaved={(updates) => {
                        const updated = { ...user, ...updates }
                        localStorage.setItem('rtt_user', JSON.stringify(updated))
                        setUser(updated)
                    }}
                />
            )}

            {showFeedbackPopup && (
                <FeedbackPopup
                    open
                    onClose={() => setFeedbackDismissed(true)}
                    onSubmitted={() => setFeedbackDismissed(true)}
                />
            )}

            <SwitchLoginModal
                open={switchLoginOpen}
                onClose={() => setSwitchLoginOpen(false)}
                onSelect={handleSwitchSelect}
            />

            {switchTarget && (
                <ConfirmDialog
                    open
                    title={tr("Login as this user?")}
                    description={`You will be signed in as "${switchTarget.name}" (${switchTarget.email}). Use "Return to Admin" in the banner to come back to your own account.`}
                    confirmLabel={switching ? 'Logging in…' : 'Login as User'}
                    onConfirm={confirmSwitchLogin}
                    onCancel={() => setSwitchTarget(null)}
                />
            )}

            <OpenDefenceHoldModal
                open={!!openDefenceHold}
                collegeName={openDefenceHold?.collegeName}
                pending={openDefenceHold?.pending}
                onClose={() => setOpenDefenceHold(null)}
            />

            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
            <AssistantPanel />

            {/* Pending co-PI invitation modal — only for staff when feature is on */}
            {authReady && hasSubFeature('workflow.co_pi_acceptance') && hasPermission('proposals.submit') && (
                <PendingInvitationsModal userId={user?.id} />
            )}

            {/* Co-PI invitation response popup — notifies the inviting PI whether their invite was accepted/declined */}
            {authReady && hasSubFeature('workflow.co_pi_acceptance') && hasPermission('proposals.submit') && (
                <InvitationResponsePopup userId={user?.id} />
            )}
        </div>
        </OnboardingProvider>
    )
}
