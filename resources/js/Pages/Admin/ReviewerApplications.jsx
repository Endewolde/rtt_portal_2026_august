import { useState, useEffect } from 'react'
import {
    UserPlus, Search, RefreshCw, CheckCircle2, XCircle, Clock, FileDown, X, Mail, Building2, GraduationCap, ExternalLink,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { get, post } from '../../lib/api'
import { downloadFile } from '../../lib/download'
import { formatDate } from '../../lib/utils'
import { useToast } from '../../Components/Toast'

const TABS = [
    { key: 'pending', label: 'Pending', icon: Clock },
    { key: 'approved', label: 'Approved', icon: CheckCircle2 },
    { key: 'rejected', label: 'Declined', icon: XCircle },
]

function DecisionModal({ application, onClose, onDone }) {
    const { success, error } = useToast()
    const [mode, setMode] = useState('approve')
    const [expertise, setExpertise] = useState(application.expertise ?? [])
    const [tag, setTag] = useState('')
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)

    const addTag = () => {
        const v = tag.trim().replace(/,$/, '')
        if (v && !expertise.includes(v)) setExpertise(l => [...l, v])
        setTag('')
    }

    const submit = async () => {
        setSaving(true)
        try {
            const res = mode === 'approve'
                ? await post(`/reviewer-applications/${application.id}/approve`, { expertise, note: note || null })
                : await post(`/reviewer-applications/${application.id}/reject`, { note })
            success(res.message)
            onDone()
        } catch (e) {
            const errors = e.response?.data?.errors ?? {}
            error(Object.values(errors)[0]?.[0] ?? e.response?.data?.message ?? 'Could not save the decision.')
        }
        setSaving(false)
    }

    const downloadCv = () => downloadFile(`/reviewer-applications/${application.id}/cv`, `${application.name}-cv.pdf`).catch(() => error('Could not download the CV.'))

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-gray-900">{application.title ? `${application.title} ` : ''}{application.name}</h2>
                        <p className="mt-0.5 text-xs text-gray-500">{[application.position, application.organization].filter(Boolean).join(' · ')}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs text-gray-500">Email</dt><dd className="break-all text-gray-900">{application.email}</dd></div>
                        <div><dt className="text-xs text-gray-500">Phone</dt><dd className="text-gray-900">{application.phone || '—'}</dd></div>
                        <div><dt className="text-xs text-gray-500">Highest qualification</dt><dd className="text-gray-900">{application.qualification}</dd></div>
                        <div><dt className="text-xs text-gray-500">ORCID iD</dt><dd>{application.orcid
                            ? <a href={`https://orcid.org/${application.orcid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">{application.orcid} <ExternalLink size={11} /></a>
                            : '—'}</dd></div>
                    </dl>
                    {application.bio && <p className="whitespace-pre-line rounded-xl bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">{application.bio}</p>}
                    <button onClick={downloadCv} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <FileDown size={14} /> Download CV
                    </button>

                    {application.status === 'pending' ? (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setMode('approve')}
                                    className={`rounded-xl border-2 p-3 text-left text-sm font-semibold ${mode === 'approve' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                                    <CheckCircle2 size={15} className="mb-1 text-emerald-600" /> Approve into the pool
                                </button>
                                <button type="button" onClick={() => setMode('reject')}
                                    className={`rounded-xl border-2 p-3 text-left text-sm font-semibold ${mode === 'reject' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                    <XCircle size={15} className="mb-1 text-red-600" /> Decline
                                </button>
                            </div>
                            {mode === 'approve' && (
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">Expertise used for matching</label>
                                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-300 px-2 py-2">
                                        {expertise.map(x => (
                                            <span key={x} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                                                {x}<button type="button" onClick={() => setExpertise(l => l.filter(y => y !== x))} aria-label={`Remove ${x}`}><X size={11} /></button>
                                            </span>
                                        ))}
                                        <input value={tag} onChange={e => setTag(e.target.value)} onBlur={addTag}
                                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                                            placeholder="Add…" className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none" />
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500">Approving creates an external reviewer account and emails a link to set a password. They can then be matched to proposals.</p>
                                </div>
                            )}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                    {mode === 'approve' ? 'Internal note (optional)' : <>Reason <span className="text-red-500">*</span></>}
                                </label>
                                <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                                    placeholder={mode === 'approve' ? '' : 'The applicant sees this, e.g. "Your field is outside our current calls."'}
                                    className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                            </div>
                        </>
                    ) : (
                        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                            {application.status === 'approved' ? 'Approved' : 'Declined'} by {application.reviewed_by?.name ?? '—'} on {formatDate(application.reviewed_at)}
                            {application.review_note && <> — {application.review_note}</>}
                        </p>
                    )}
                </div>

                {application.status === 'pending' && (
                    <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                        <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                        <button onClick={submit} disabled={saving || (mode === 'approve' ? expertise.length === 0 : note.trim().length < 10)}
                            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${mode === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                            {saving ? 'Saving…' : mode === 'approve' ? 'Approve' : 'Decline'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ReviewerApplications() {
    const { error } = useToast()
    const [status, setStatus] = useState('pending')
    const [query, setQuery] = useState('')
    const [items, setItems] = useState([])
    const [counts, setCounts] = useState({})
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState(null)

    const load = () => {
        setLoading(true)
        get('/reviewer-applications', { status, q: query || undefined })
            .then(r => { setItems(r.data?.data ?? []); setCounts(r.meta?.counts ?? {}) })
            .catch(() => error('Could not load applications.'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { const t = setTimeout(load, query ? 300 : 0); return () => clearTimeout(t) }, [status, query]) // eslint-disable-line react-hooks/exhaustive-deps

    const applyUrl = `${window.location.origin}/reviewers/apply`

    return (
        <AppLayout breadcrumb="Reviewer Applications">
            <div className="mx-auto max-w-5xl space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100"><UserPlus size={20} className="text-indigo-600" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Reviewer Applications</h1>
                            <p className="text-sm text-gray-500">Outside experts asking to join the reviewer pool. Share the form: <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-600 hover:underline">{applyUrl}</a></p>
                        </div>
                    </div>
                    <button onClick={load} aria-label="Refresh" className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button key={key} onClick={() => setStatus(key)}
                                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${status === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <Icon size={13} /> {label}
                                <span className="rounded-full bg-gray-100 px-1.5 text-[11px] tabular-nums text-gray-600">{counts[key] ?? 0}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 focus-within:ring-2 focus-within:ring-indigo-500">
                        <Search size={14} className="text-gray-400" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, organization or expertise…" className="h-10 flex-1 bg-transparent text-sm outline-none" />
                    </div>
                </div>

                {loading && items.length === 0 ? (
                    <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-500">
                        {status === 'pending' ? 'No applications waiting.' : 'Nothing here yet.'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map(a => (
                            <button key={a.id} onClick={() => setOpen(a)} className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left transition-shadow hover:shadow-md">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900">{a.title ? `${a.title} ` : ''}{a.name}</p>
                                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><Building2 size={11} /> {a.organization}</span>
                                            <span className="flex items-center gap-1"><GraduationCap size={11} /> {a.qualification}</span>
                                            <span className="flex items-center gap-1 break-all"><Mail size={11} /> {a.email}</span>
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-xs text-gray-400">{formatDate(a.created_at)}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {(a.expertise ?? []).map(x => <span key={x} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">{x}</span>)}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {open && <DecisionModal application={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load() }} />}
        </AppLayout>
    )
}
