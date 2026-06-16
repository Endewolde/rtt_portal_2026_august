import { useState, useEffect } from 'react'
import {
    MessageSquareHeart, Lightbulb, Bug, ClipboardList, Star, ChevronLeft, ChevronRight, Trash2, RotateCcw,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import ConfirmDialog from '../../Components/ConfirmDialog'
import { useToast } from '../../Components/Toast'
import { get, del, post } from '../../lib/api'

const TYPES = [
    { value: 'feedback',        label: 'Feedback',        icon: MessageSquareHeart, bg: 'bg-indigo-50',  text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700'  },
    { value: 'feature_request', label: 'Feature Request', icon: Lightbulb,          bg: 'bg-amber-50',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700'    },
    { value: 'bug_report',      label: 'Bug Report',      icon: Bug,                bg: 'bg-rose-50',    text: 'text-rose-600',    badge: 'bg-rose-100 text-rose-700'      },
    { value: 'survey',          label: 'Survey',          icon: ClipboardList,      bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700'},
]

const typeOf = (v) => TYPES.find((t) => t.value === v) ?? TYPES[0]

function fmt(dt) {
    if (!dt) return '–'
    return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Feedback() {
    const toast = useToast()
    const [submissions, setSubmissions] = useState([])
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1 })
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [delTarget, setDelTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const [currentRound, setCurrentRound] = useState(1)
    const [confirmNewRound, setConfirmNewRound] = useState(false)
    const [startingRound, setStartingRound] = useState(false)

    const load = async (p = 1) => {
        setLoading(true)
        try {
            const res = await get(`/feedback?page=${p}`)
            const data = res.data
            setSubmissions(data?.data ?? [])
            setMeta({ current_page: data?.current_page ?? 1, last_page: data?.last_page ?? 1 })
            setCurrentRound(res.meta?.current_round ?? 1)
        } catch {
            toast.error('Could not load feedback submissions.')
        }
        setLoading(false)
    }

    useEffect(() => { load(page) }, [page])

    const destroy = async () => {
        if (!delTarget) return
        setDeleting(true)
        try {
            await del(`/feedback/${delTarget.id}`)
            toast.success('Feedback deleted.')
            setDelTarget(null)
            load(page)
        } catch {
            toast.error('Could not delete feedback.')
        }
        setDeleting(false)
    }

    const startNewRound = async () => {
        setStartingRound(true)
        try {
            const res = await post('/feedback/new-round')
            toast.success(res.message ?? 'New round started.')
            setConfirmNewRound(false)
            load(page)
        } catch {
            toast.error('Could not start a new round.')
        }
        setStartingRound(false)
    }

    const counts = TYPES.reduce((acc, t) => {
        acc[t.value] = submissions.filter((s) => s.type === t.value).length
        return acc
    }, {})

    return (
        <AppLayout title="Feedback">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Feedback, feature requests, bug reports, and survey responses submitted by users
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                        Round {currentRound}
                    </span>
                    <button
                        onClick={() => setConfirmNewRound(true)}
                        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                        <RotateCcw size={14} />
                        Start New Round
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {TYPES.map((t) => (
                    <div key={t.value} className={`rounded-2xl border ${t.bg} border-gray-100 p-4 text-center`}>
                        <p className={`text-2xl font-bold ${t.text}`}>{counts[t.value] ?? 0}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t.label}</p>
                    </div>
                ))}
            </div>

            {/* Submissions list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-300 text-sm">Loading…</div>
                ) : submissions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                            <MessageSquareHeart size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400">No feedback submitted yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {submissions.map((s) => {
                            const t = typeOf(s.type)
                            const TypeIcon = t.icon
                            return (
                                <div key={s.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                                    <div className={`w-9 h-9 rounded-xl ${t.bg} flex items-center justify-center shrink-0`}>
                                        <TypeIcon size={16} className={t.text} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-gray-900">{s.user?.name ?? 'Unknown user'}</p>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${t.badge}`}>
                                                {t.label}
                                            </span>
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                                Round {s.round}
                                            </span>
                                            {s.rating && (
                                                <span className="flex items-center gap-0.5">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <Star key={i} size={11}
                                                            className={i < s.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{s.user?.email}</p>
                                        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{s.message}</p>
                                        <p className="text-[11px] text-gray-300 mt-2">
                                            {fmt(s.created_at)}{s.page_url && ` · ${s.page_url}`}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => setDelTarget(s)}
                                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {meta.last_page > 1 && (
                <div className="flex items-center justify-center gap-3 mt-5">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-gray-500">Page {meta.current_page} of {meta.last_page}</span>
                    <button
                        onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                        disabled={page >= meta.last_page}
                        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {delTarget && (
                <ConfirmDialog
                    open
                    title="Delete feedback?"
                    description={`This submission from "${delTarget.user?.name ?? 'this user'}" will be permanently removed.`}
                    confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                    confirmVariant="danger"
                    onConfirm={destroy}
                    onCancel={() => setDelTarget(null)}
                />
            )}

            {confirmNewRound && (
                <ConfirmDialog
                    open
                    title={`Start round ${currentRound + 1}?`}
                    description="The feedback popup will reappear for every user, including those who already submitted in a previous round. Past submissions are kept."
                    confirmLabel={startingRound ? 'Starting…' : 'Start New Round'}
                    onConfirm={startNewRound}
                    onCancel={() => setConfirmNewRound(false)}
                />
            )}
        </AppLayout>
    )
}
