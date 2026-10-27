import { useEffect, useRef, useState } from 'react'
import {
    Users, Shield, Building2, UserPlus, Sparkles, Send, Eye, X, Loader2, Check, Mail, Bell, History,
    AlertTriangle, FlaskConical, Search,
} from 'lucide-react'
import RichTextEditor from './RichTextEditor'
import { useToast } from './Toast'
import api from '../lib/api'
import { roleLabel, rememberRoleLabels } from '../lib/roles'

const AUDIENCES = [
    { key: 'all', label: 'Everyone', hint: 'All active users', icon: Users },
    { key: 'by_role', label: 'By role', hint: 'One or more roles', icon: Shield },
    { key: 'by_college', label: 'By college', hint: 'One or more colleges', icon: Building2 },
    { key: 'segment', label: 'Ready-made group', hint: 'PIs, reviewers, staff…', icon: Sparkles },
    { key: 'specific', label: 'Chosen people', hint: 'Pick individuals', icon: UserPlus },
]

const SEGMENTS = [
    { key: 'running_pis', label: 'PIs of running funded projects' },
    { key: 'all_pis', label: 'Everyone who has submitted a proposal' },
    { key: 'reviewers_pending', label: 'Reviewers with reviews still to do' },
    { key: 'officers', label: 'Office staff (every non-researcher role)' },
]

const TEMPLATES = [
    { label: 'Call for proposals', subject: 'New call for proposals is open', message: '<p>A new call for proposals is now open on the platform.</p><p><strong>Deadline:</strong> …</p><p>Log in to read the call and start your application.</p>' },
    { label: 'Deadline reminder', subject: 'Reminder: deadline approaching', message: '<p>This is a reminder that the deadline for … is <strong>…</strong>.</p><p>Please complete and submit before then.</p>' },
    { label: 'System maintenance', subject: 'Scheduled maintenance', message: '<p>The platform will be unavailable on <strong>…</strong> from … to … for maintenance.</p><p>Please save your work before then.</p>' },
]

const ago = (iso) => {
    if (!iso) return ''
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 60) return `${Math.max(1, mins)} min ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} h ago`
    return new Date(iso).toLocaleDateString()
}

/** A list of toggleable chips, for picking several roles or colleges. */
function ChipPicker({ options, selected, onChange, empty }) {
    if (!options.length) return <p className="text-xs text-gray-400">{empty}</p>
    const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
                const on = selected.includes(o.value)
                return (
                    <button key={o.value} type="button" onClick={() => toggle(o.value)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-gray-600 ring-gray-200 hover:ring-indigo-300'}`}>
                        {on && <Check size={11} />} {o.label}
                    </button>
                )
            })}
        </div>
    )
}

/**
 * Broadcast email: choose the audience (with a live count of who it reaches), write
 * the message or start from a template, preview it, send a test to yourself, then send
 * after confirming. Past broadcasts are listed below.
 */
export default function BroadcastComposer({ colleges = [] }) {
    const { success, error } = useToast()
    const [to, setTo] = useState('all')
    const [roles, setRoles] = useState([])
    const [collegeIds, setCollegeIds] = useState([])
    const [segment, setSegment] = useState('running_pis')
    const [people, setPeople] = useState([])
    const [subject, setSubject] = useState('')
    const [message, setMessage] = useState('')
    const [inApp, setInApp] = useState(false)
    const [allRoles, setAllRoles] = useState([])
    const [reach, setReach] = useState(null)
    const [reachLoading, setReachLoading] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [previewing, setPreviewing] = useState(false)
    const [busy, setBusy] = useState('')
    const [history, setHistory] = useState(null)

    // Person search
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const searchTimer = useRef(null)

    useEffect(() => {
        api.get('/roles').then((r) => {
            const list = (r.data?.data ?? []).filter((x) => x.name !== 'super_admin')
            rememberRoleLabels(list)
            setAllRoles(list.map((x) => ({ value: x.name, label: roleLabel(x) })))
        }).catch(() => {})
        loadHistory()
    }, [])

    const loadHistory = () => api.get('/settings/broadcasts').then((r) => setHistory(r.data?.data ?? [])).catch(() => setHistory([]))

    const audience = () => ({
        to,
        roles: to === 'by_role' ? roles : undefined,
        college_ids: ['by_college', 'by_role', 'segment'].includes(to) ? collegeIds : undefined,
        segment: to === 'segment' ? segment : undefined,
        user_ids: to === 'specific' ? people.map((p) => p.id) : undefined,
    })

    const ready = to === 'all' || (to === 'by_role' && roles.length) || (to === 'by_college' && collegeIds.length)
        || (to === 'segment' && segment) || (to === 'specific' && people.length)

    // Live count of who the audience reaches.
    useEffect(() => {
        if (!ready) { setReach(null); return }
        setReachLoading(true)
        const t = setTimeout(() => {
            api.post('/settings/broadcast/preview', audience())
                .then((r) => setReach(r.data?.data ?? null))
                .catch(() => setReach(null))
                .finally(() => setReachLoading(false))
        }, 300)
        return () => clearTimeout(t)
    }, [to, roles.join(), collegeIds.join(), segment, people.map((p) => p.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

    const search = (q) => {
        setQuery(q)
        clearTimeout(searchTimer.current)
        if (q.trim().length < 2) { setResults([]); return }
        searchTimer.current = setTimeout(async () => {
            setSearching(true)
            try {
                const r = await api.get('/users', { params: { search: q, per_page: 8 } })
                setResults((r.data?.data?.data ?? []).filter((u) => !people.some((p) => p.id === u.id)))
            } catch { setResults([]) }
            setSearching(false)
        }, 280)
    }

    const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    const canSend = ready && subject.trim() && textOf(message) && (reach?.count ?? 0) > 0

    const send = async (test = false) => {
        if (!subject.trim() || !textOf(message)) { error('Add a subject and a message first.'); return }
        setBusy(test ? 'test' : 'send')
        try {
            const r = await api.post('/settings/send-email', { ...audience(), subject, message, test, in_app: inApp })
            success(r.data?.message ?? 'Sent.')
            if (!test) {
                setConfirming(false)
                setSubject('')
                setMessage('')
                loadHistory()
            }
        } catch (e) {
            error(e.response?.data?.message ?? 'The email could not be sent.')
        }
        setBusy('')
    }

    const collegeOptions = colleges.map((c) => ({ value: c.id, label: c.name }))

    return (
        <div className="space-y-5">
            {/* ── 1. Audience ─────────────────────────────────────────── */}
            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">1 · Who should receive it</p>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                    {AUDIENCES.map((a) => {
                        const on = to === a.key
                        return (
                            <button key={a.key} type="button" onClick={() => setTo(a.key)}
                                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${on ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}><a.icon size={15} /></span>
                                <span className="min-w-0">
                                    <span className={`block text-sm font-semibold ${on ? 'text-indigo-900' : 'text-gray-800'}`}>{a.label}</span>
                                    <span className="block truncate text-[11px] text-gray-500">{a.hint}</span>
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div className="mt-3 space-y-3">
                    {to === 'by_role' && (
                        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                            <p className="mb-2 text-xs font-medium text-gray-600">Roles</p>
                            <ChipPicker options={allRoles} selected={roles} onChange={setRoles} empty="Loading roles…" />
                        </div>
                    )}
                    {to === 'segment' && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {SEGMENTS.map((s) => (
                                <label key={s.key} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${segment === s.key ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                                    <input type="radio" name="segment" checked={segment === s.key} onChange={() => setSegment(s.key)} className="accent-indigo-600" />
                                    {s.label}
                                </label>
                            ))}
                        </div>
                    )}
                    {['by_college', 'by_role', 'segment'].includes(to) && (
                        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                            <p className="mb-2 text-xs font-medium text-gray-600">{to === 'by_college' ? 'Colleges' : 'Only in these colleges (optional)'}</p>
                            <ChipPicker options={collegeOptions} selected={collegeIds} onChange={setCollegeIds} empty="No colleges yet." />
                        </div>
                    )}
                    {to === 'specific' && (
                        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                            {people.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {people.map((p) => (
                                        <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{p.name?.[0]?.toUpperCase()}</span>
                                            {p.name}
                                            <button type="button" onClick={() => setPeople(people.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="relative">
                                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input value={query} onChange={(e) => search(e.target.value)} placeholder="Search people by name or email…"
                                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                                {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                                {results.length > 0 && (
                                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                                        {results.map((u) => (
                                            <button key={u.id} type="button" onMouseDown={() => { setPeople([...people, u]); setResults([]); setQuery('') }}
                                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-indigo-50">
                                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{u.name?.[0]?.toUpperCase()}</span>
                                                <span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-800">{u.name}</span><span className="block truncate text-[11px] text-gray-500">{u.email}</span></span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Live reach */}
                <div className={`mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm ${!ready ? 'bg-gray-50 text-gray-500' : reach?.count ? 'bg-indigo-50 text-indigo-900' : 'bg-amber-50 text-amber-800'}`}>
                    {reachLoading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                    {!ready ? 'Choose who should receive it.' : reachLoading && !reach ? 'Counting recipients…' : (
                        <>
                            <span>Reaches <b className="tabular-nums">{reach?.count ?? 0}</b> active {reach?.count === 1 ? 'person' : 'people'}</span>
                            {reach?.sample?.length > 0 && (
                                <span className="truncate text-xs text-indigo-700/80">· {reach.sample.map((s) => s.name).join(', ')}{reach.count > reach.sample.length ? ` and ${reach.count - reach.sample.length} more` : ''}</span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── 2. Message ──────────────────────────────────────────── */}
            <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">2 · Message</p>
                    <div className="flex flex-wrap gap-1.5">
                        {TEMPLATES.map((t) => (
                            <button key={t.label} type="button" onClick={() => { setSubject(t.subject); setMessage(t.message) }}
                                className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-200">{t.label}</button>
                        ))}
                    </div>
                </div>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255} placeholder="Subject line"
                    className="mb-2 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                <RichTextEditor value={message} onChange={setMessage} placeholder="Write your message… Each recipient is greeted by name automatically." />
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} className="rounded accent-indigo-600" />
                    <Bell size={14} className="text-gray-400" /> Also post it as an in-app notification
                </label>
            </div>

            {/* ── 3. Send ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={() => setPreviewing(true)} disabled={!subject.trim() && !textOf(message)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <Eye size={14} /> Preview
                </button>
                <button type="button" onClick={() => send(true)} disabled={busy !== '' || !subject.trim() || !textOf(message)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Send test to me
                </button>
                <button type="button" onClick={() => setConfirming(true)} disabled={!canSend || busy !== ''}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                    <Send size={14} /> Send to {reach?.count ?? 0} {reach?.count === 1 ? 'person' : 'people'}
                </button>
            </div>

            {/* ── History ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-100">
                <p className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500"><History size={13} /> Recent broadcasts</p>
                {history === null ? (
                    <p className="px-4 py-3 text-xs text-gray-400">Loading…</p>
                ) : history.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-400">Nothing sent yet.</p>
                ) : (
                    <ul className="divide-y divide-gray-50">
                        {history.map((h) => (
                            <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                                <Mail size={13} className="shrink-0 text-gray-400" />
                                <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{h.subject}</span>
                                <span className="text-xs text-gray-500">{h.audience} · <b className="tabular-nums">{h.recipients}</b> {h.recipients === 1 ? 'person' : 'people'}{h.in_app ? ' · in-app' : ''}</span>
                                <span className="text-xs text-gray-400">{h.sender ? `${h.sender} · ` : ''}{ago(h.sent_at)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* ── Preview modal ───────────────────────────────────────── */}
            {previewing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setPreviewing(false)}>
                    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                            <p className="text-sm font-semibold text-gray-900">Preview</p>
                            <button onClick={() => setPreviewing(false)} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                        </div>
                        <div className="bg-slate-100 p-5">
                            <div className="overflow-hidden rounded-2xl bg-white shadow">
                                <div className="bg-linear-to-br from-slate-900 via-blue-900 to-blue-600 px-6 py-6">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Research office</p>
                                    <p className="mt-2 text-xl font-extrabold text-white">{subject || 'Subject line'}</p>
                                </div>
                                <div className="px-6 py-5 text-sm leading-relaxed text-gray-700">
                                    <p className="mb-3 font-semibold text-gray-900">Dear {reach?.sample?.[0]?.name ?? 'recipient'},</p>
                                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: message || '<p class="text-gray-400">Your message…</p>' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm modal ───────────────────────────────────────── */}
            {confirming && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
                    <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                        <div className="flex items-start gap-3 px-6 pt-6">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${(reach?.count ?? 0) > 50 ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                {(reach?.count ?? 0) > 50 ? <AlertTriangle size={18} /> : <Send size={18} />}
                            </span>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Send to {reach?.count} {reach?.count === 1 ? 'person' : 'people'}?</h3>
                                <p className="mt-1 text-sm text-gray-600"><b>{subject}</b></p>
                                <p className="mt-1 text-xs text-gray-500">{reach?.audience}{inApp ? ' · also posted in-app' : ''}. This cannot be undone.</p>
                            </div>
                        </div>
                        <div className="mt-5 flex gap-3 border-t border-gray-100 px-6 py-4">
                            <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                            <button onClick={() => send(false)} disabled={busy !== ''}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                                {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
