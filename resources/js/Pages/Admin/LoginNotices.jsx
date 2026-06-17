import { useState, useEffect } from 'react'
import {
    Plus, Pencil, Trash2, X, Info, TriangleAlert, CheckCircle2,
    Wrench, Megaphone, ToggleLeft, ToggleRight, ExternalLink,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import ConfirmDialog from '../../Components/ConfirmDialog'
import { useToast } from '../../Components/Toast'
import { get, post, put, del } from '../../lib/api'

// ── Type metadata ──────────────────────────────────────────────────────────────

const TYPES = [
    { value: 'information', label: 'Information', icon: Info,          bg: 'bg-indigo-50',  text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700',  bar: 'bg-indigo-500'  },
    { value: 'warning',     label: 'Warning',     icon: TriangleAlert, bg: 'bg-amber-50',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700',    bar: 'bg-amber-500'   },
    { value: 'success',     label: 'Success',     icon: CheckCircle2,  bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700',bar: 'bg-emerald-500' },
    { value: 'maintenance', label: 'Maintenance', icon: Wrench,        bg: 'bg-slate-50',   text: 'text-slate-600',   badge: 'bg-slate-100 text-slate-700',    bar: 'bg-slate-500'   },
]

const typeOf = v => TYPES.find(t => t.value === v) ?? TYPES[0]

const BLANK = {
    title: '', body: '', type: 'information', priority: 0,
    icon: '', link_label: '', link_url: '',
    is_dismissible: true, is_active: true,
    starts_at: '', ends_at: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dt) {
    if (!dt) return '–'
    return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Field({ label, required, error, children }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    )
}

function Input({ error, className = '', ...props }) {
    return (
        <input
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
            } ${className}`}
            {...props}
        />
    )
}

// ── Notice preview card ────────────────────────────────────────────────────────

function PreviewCard({ form }) {
    const cfg = {
        information: { bar: 'bg-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200', title: 'text-indigo-900', body: 'text-indigo-700', btn: 'bg-indigo-600 text-white', iconCl: 'text-indigo-500' },
        warning:     { bar: 'bg-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-200',  title: 'text-amber-900',  body: 'text-amber-700',  btn: 'bg-amber-500 text-white',  iconCl: 'text-amber-500'  },
        success:     { bar: 'bg-emerald-500',bg: 'bg-emerald-50',border: 'border-emerald-200',title: 'text-emerald-900',body: 'text-emerald-700',btn: 'bg-emerald-600 text-white', iconCl: 'text-emerald-500'},
        maintenance: { bar: 'bg-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200',  title: 'text-slate-900',  body: 'text-slate-600',  btn: 'bg-slate-700 text-white',  iconCl: 'text-slate-500'  },
    }[form.type] ?? {}
    const TypeIcon = typeOf(form.type).icon

    return (
        <div className={`relative overflow-hidden rounded-2xl border ${cfg.bg} ${cfg.border} shadow-sm`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar} rounded-l-2xl`} />
            <div className="pl-5 pr-4 py-4 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                    {form.icon
                        ? <span className="text-xl leading-none">{form.icon}</span>
                        : <TypeIcon size={18} className={cfg.iconCl} />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${cfg.title}`}>{form.title || 'Notice title'}</p>
                    <p className={`text-xs mt-1 leading-relaxed ${cfg.body}`}>{form.body || 'Notice message body will appear here.'}</p>
                    {form.link_label && (
                        <span className={`inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${cfg.btn}`}>
                            {form.link_label} <ExternalLink size={11} />
                        </span>
                    )}
                </div>
                {form.is_dismissible && (
                    <span className="shrink-0 p-1 rounded-lg text-gray-400">
                        <X size={14} />
                    </span>
                )}
            </div>
        </div>
    )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function NoticeModal({ notice, onClose, onSaved }) {
    const { success, error: toastError } = useToast()
    const [form, setForm] = useState(notice
        ? { ...notice, starts_at: notice.starts_at?.slice(0, 10) ?? '', ends_at: notice.ends_at?.slice(0, 10) ?? '' }
        : { ...BLANK }
    )
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const save = async () => {
        setSaving(true)
        setErrors({})
        try {
            const payload = {
                ...form,
                starts_at: form.starts_at || null,
                ends_at:   form.ends_at   || null,
                icon:      form.icon      || null,
                link_label:form.link_label|| null,
                link_url:  form.link_url  || null,
            }
            let saved
            if (notice) {
                const res = await put(`/login-notices/${notice.id}`, payload)
                saved = res.data
                success('Notice updated.')
            } else {
                const res = await post('/login-notices', payload)
                saved = res.data
                success('Notice created.')
            }
            onSaved(saved)
        } catch (e) {
            const ve = e.response?.data?.errors ?? {}
            if (Object.keys(ve).length) {
                setErrors(ve)
            } else {
                toastError(e.response?.data?.message ?? 'Could not save notice.')
            }
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <h2 className="text-base font-semibold text-gray-900">
                        {notice ? 'Edit Notice' : 'New Login Notice'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                    {/* Live preview */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                        <PreviewCard form={form} />
                    </div>

                    <hr className="border-gray-100" />

                    {/* Title + Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <Field label="Title" required error={errors.title?.[0]}>
                                <Input value={form.title} onChange={e => set('title', e.target.value)} error={errors.title} placeholder="e.g. System maintenance tonight" />
                            </Field>
                        </div>
                        <Field label="Type" required>
                            <select
                                value={form.type}
                                onChange={e => set('type', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
                            >
                                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </Field>
                    </div>

                    {/* Body */}
                    <Field label="Message" required error={errors.body?.[0]}>
                        <textarea
                            value={form.body}
                            onChange={e => set('body', e.target.value)}
                            rows={3}
                            placeholder="Write the announcement message here…"
                            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${
                                errors.body ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                            }`}
                        />
                        {errors.body && <p className="mt-1 text-xs text-red-500">{errors.body[0]}</p>}
                    </Field>

                    {/* Icon + Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Icon (emoji)" error={errors.icon?.[0]}>
                            <Input value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🔔  or leave blank" error={errors.icon} />
                        </Field>
                        <Field label="Priority" error={errors.priority?.[0]}>
                            <Input type="number" min={0} max={100} value={form.priority} onChange={e => set('priority', parseInt(e.target.value) || 0)} error={errors.priority} />
                        </Field>
                    </div>

                    {/* Link */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Button label" error={errors.link_label?.[0]}>
                            <Input value={form.link_label} onChange={e => set('link_label', e.target.value)} placeholder="e.g. Learn More" error={errors.link_label} />
                        </Field>
                        <Field label="Button URL" error={errors.link_url?.[0]}>
                            <Input value={form.link_url} onChange={e => set('link_url', e.target.value)} placeholder="https://…" error={errors.link_url} />
                        </Field>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Show from" error={errors.starts_at?.[0]}>
                            <Input type="date" value={form.starts_at} onChange={e => set('starts_at', e.target.value)} error={errors.starts_at} />
                        </Field>
                        <Field label="Hide after" error={errors.ends_at?.[0]}>
                            <Input type="date" value={form.ends_at} onChange={e => set('ends_at', e.target.value)} error={errors.ends_at} />
                        </Field>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { key: 'is_active',      label: 'Active',      desc: 'Visible on the login page' },
                            { key: 'is_dismissible', label: 'Dismissible', desc: 'Users can close this notice' },
                        ].map(({ key, label, desc }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => set(key, !form[key])}
                                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                                    form[key] ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50'
                                }`}
                            >
                                {form[key]
                                    ? <ToggleRight size={22} className="text-indigo-600 shrink-0" />
                                    : <ToggleLeft size={22} className="text-gray-400 shrink-0" />
                                }
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                                    <p className="text-xs text-gray-400">{desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                    >
                        {saving ? 'Saving…' : notice ? 'Save Changes' : 'Create Notice'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LoginNotices() {
    const { success, error: toastError } = useToast()
    const [notices, setNotices]     = useState([])
    const [loading, setLoading]     = useState(true)
    const [modal, setModal]         = useState(null)   // null | 'create' | notice object
    const [delTarget, setDelTarget] = useState(null)
    const [deleting, setDeleting]   = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const res = await get('/login-notices')
            setNotices(res.data ?? [])
        } catch {
            toastError('Could not load notices.')
        }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const destroy = async () => {
        if (!delTarget) return
        setDeleting(true)
        try {
            await del(`/login-notices/${delTarget.id}`)
            success('Notice deleted.')
            setDelTarget(null)
            load()
        } catch {
            toastError('Could not delete notice.')
        }
        setDeleting(false)
    }

    const counts = {
        total:    notices.length,
        active:   notices.filter(n => n.is_active).length,
        inactive: notices.filter(n => !n.is_active).length,
    }

    return (
        <AppLayout title="Login Notices">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Login Notices</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Announcements shown above the sign-in form
                    </p>
                </div>
                <button
                    onClick={() => setModal('create')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
                >
                    <Plus size={15} /> New Notice
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total',    value: counts.total,    color: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-700' },
                    { label: 'Active',   value: counts.active,   color: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                    { label: 'Inactive', value: counts.inactive, color: 'bg-gray-50 border-gray-100', text: 'text-gray-700' },
                ].map(s => (
                    <div key={s.label} className={`rounded-2xl border ${s.color} p-4 text-center`}>
                        <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Notices list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-300 text-sm">Loading…</div>
                ) : notices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                            <Megaphone size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400">No notices yet</p>
                        <button
                            onClick={() => setModal('create')}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                            Create your first notice
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {notices.map(notice => {
                            const t = typeOf(notice.type)
                            const TypeIcon = t.icon
                            return (
                                <div key={notice.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                                    {/* Type icon */}
                                    <div className={`w-9 h-9 rounded-xl ${t.bg} flex items-center justify-center shrink-0`}>
                                        {notice.icon
                                            ? <span className="text-base">{notice.icon}</span>
                                            : <TypeIcon size={16} className={t.text} />
                                        }
                                    </div>

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{notice.title}</p>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${t.badge}`}>
                                                {t.label}
                                            </span>
                                            {!notice.is_active && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-gray-100 text-gray-500">
                                                    Inactive
                                                </span>
                                            )}
                                            {!notice.is_dismissible && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-rose-50 text-rose-600">
                                                    Persistent
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{notice.body}</p>
                                        <p className="text-[11px] text-gray-300 mt-0.5">
                                            {notice.starts_at || notice.ends_at
                                                ? `${fmt(notice.starts_at)} → ${fmt(notice.ends_at)}`
                                                : 'No date range set'
                                            }
                                            {' · '}Priority {notice.priority}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={() => setModal(notice)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => setDelTarget(notice)}
                                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Create / Edit modal */}
            {modal && (
                <NoticeModal
                    notice={modal === 'create' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={saved => {
                        setNotices(prev => {
                            const exists = prev.some(n => n.id === saved.id)
                            const next = exists
                                ? prev.map(n => n.id === saved.id ? saved : n)
                                : [saved, ...prev]
                            return next.sort((a, b) => b.priority - a.priority || new Date(b.created_at) - new Date(a.created_at))
                        })
                        setModal(null)
                    }}
                />
            )}

            {/* Delete confirm */}
            {delTarget && (
                <ConfirmDialog
                    open
                    title="Delete notice?"
                    message={`"${delTarget.title}" will be permanently removed and hidden from the login page.`}
                    confirmLabel="Delete"
                    variant="danger"
                    loading={deleting}
                    onConfirm={destroy}
                    onCancel={() => setDelTarget(null)}
                />
            )}
        </AppLayout>
    )
}
