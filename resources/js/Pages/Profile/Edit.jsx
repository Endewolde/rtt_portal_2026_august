import { useState, useRef, useCallback, useEffect } from 'react'
import {
    User, Mail, Phone, CreditCard, Shield, Lock,
    Camera, Save, Eye, EyeOff, CheckCircle2, AlertCircle,
    Building2, Layers, ExternalLink, ShieldCheck,
    BookOpen, X, GraduationCap, Monitor, Trash2, Bell, Download, FileLock2,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../Components/Toast'
import api from '../../lib/api'
import { timeAgo } from '../../lib/utils'
import { downloadFile } from '../../lib/download'

// ─── Avatar uploader ──────────────────────────────────────────────────────────

function AvatarUpload({ user, onUpdated }) {
    const [uploading, setUploading] = useState(false)
    const ref = useRef(null)
    const { success, error } = useToast()

    const initials = (user?.name ?? 'U')
        .split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

    const upload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setUploading(true)
        const fd = new FormData()
        fd.append('avatar', file)
        try {
            const res = await api.post('/auth/avatar', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            const url = res.data?.data?.url ?? ''
            onUpdated({ avatar: url })
            success('Profile photo updated.')
        } catch (err) {
            error(err.response?.data?.message ?? 'Failed to upload photo.')
        }
        setUploading(false)
        e.target.value = ''
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => ref.current?.click()}>
                <div className="h-24 w-24 rounded-full ring-4 ring-white shadow-lg overflow-hidden">
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.name}
                            className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full bg-linear-to-br from-indigo-500 to-purple-600
                                        flex items-center justify-center text-white text-2xl font-bold">
                            {initials}
                        </div>
                    )}
                </div>
                <div className={`absolute inset-0 rounded-full flex items-center justify-center
                                bg-black/40 transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {uploading
                        ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Camera size={20} className="text-white" />
                    }
                </div>
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">
                    {(() => { const r = (user?.roles ?? [])[0]; return (typeof r === 'string' ? r : r?.name)?.replace(/_/g, ' ') ?? 'User' })()}
                </p>
            </div>
            <button onClick={() => ref.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600
                           hover:text-indigo-800 disabled:opacity-50 transition-colors">
                <Camera size={12} /> Change photo
            </button>
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={upload} />
        </div>
    )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Card({ title, icon: Icon, iconColor, children }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconColor}`}>
                    <Icon size={15} />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </div>
    )
}

function Field({ label, children, hint }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
            {children}
            {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        </div>
    )
}

function Input({ ...props }) {
    return (
        <input {...props}
            className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                        focus:ring-indigo-500 transition-colors
                        ${props.disabled
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        } ${props.className ?? ''}`}
        />
    )
}

function Select({ children, ...props }) {
    return (
        <select {...props}
            className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                        focus:ring-indigo-500 transition-colors
                        ${props.disabled
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}>
            {children}
        </select>
    )
}

// ─── Personal Info section ────────────────────────────────────────────────────

function PersonalInfoForm({ user, onUpdated }) {
    const { success, error } = useToast()
    const [form, setForm] = useState({
        name:        user?.name        ?? '',
        phone:       user?.phone       ?? '',
        employee_id: user?.employee_id ?? '',
        gender:      user?.gender      ?? '',
    })
    const [saving, setSaving] = useState(false)

    const changed = JSON.stringify(form) !== JSON.stringify({
        name: user?.name ?? '', phone: user?.phone ?? '',
        employee_id: user?.employee_id ?? '', gender: user?.gender ?? '',
    })

    const save = async () => {
        setSaving(true)
        try {
            const res = await api.put('/auth/profile', form)
            const updated = res.data?.data?.user ?? res.data?.data
            if (updated) onUpdated(updated)
            success('Profile saved.')
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to save.')
        }
        setSaving(false)
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name *">
                    <Input
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Your full name"
                    />
                </Field>
                <Field label="Email Address" hint="Contact admin to change email">
                    <Input value={user?.email ?? ''} disabled />
                </Field>
                <Field label="Phone Number">
                    <Input
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+251 9xx xxx xxxx"
                    />
                </Field>
                <Field label="Employee ID">
                    <Input
                        value={form.employee_id}
                        onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}
                        placeholder="e.g. EMP-001"
                    />
                </Field>
                <Field label="Gender">
                    <Select
                        value={form.gender}
                        onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                        <option value="">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </Select>
                </Field>
            </div>

            {changed && (
                <div className="flex justify-end pt-2">
                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white
                                   rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60
                                   transition-colors">
                        {saving
                            ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                            : <><Save size={14} /> Save Changes</>
                        }
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Account Info section ─────────────────────────────────────────────────────

function AccountInfo({ user }) {
    const rows = [
        { label: 'Status', value: user?.status ?? '—',
          badge: user?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700' },
        { label: 'Role', value: (() => { const r = (user?.roles ?? [])[0]; return ((typeof r === 'string' ? r : r?.name) ?? 'guest').replace(/_/g, ' ') })(),
          badge: 'bg-indigo-100 text-indigo-700' },
        { label: 'College',    value: user?.college?.name ?? (user?.college_id ? 'Loading…' : 'Not assigned') },
        { label: 'Department', value: user?.department?.name ?? (user?.department_id ? 'Loading…' : 'Not assigned') },
        { label: 'Member since', value: user?.created_at
            ? new Date(user.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
            : '—' },
    ]

    const expertise = user?.expertise ?? []

    return (
        <div className="space-y-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                {rows.map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2.5
                                                    border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-500 font-medium">{row.label}</span>
                        {row.badge ? (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${row.badge}`}>
                                {row.value}
                            </span>
                        ) : (
                            <span className="text-xs font-semibold text-gray-800 text-right max-w-[60%]">{row.value}</span>
                        )}
                    </div>
                ))}
            </div>
            {expertise.length > 0 && (
                <div className="pt-3">
                    <p className="text-xs text-gray-500 font-medium mb-2">Research Expertise</p>
                    <div className="flex flex-wrap gap-1.5">
                        {expertise.map((tag, i) => (
                            <span key={i} className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Change Password section ──────────────────────────────────────────────────

function ChangePasswordForm() {
    const { success, error } = useToast()
    const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' })
    const [show, setShow] = useState({ current: false, new: false, confirm: false })
    const [saving, setSaving] = useState(false)

    const valid = form.current_password && form.password.length >= 8
        && form.password === form.password_confirmation

    const save = async () => {
        setSaving(true)
        try {
            await api.post('/auth/change-password', form)
            setForm({ current_password: '', password: '', password_confirmation: '' })
            success('Password changed successfully.')
        } catch (e) {
            const errs = e.response?.data?.errors ?? {}
            const msg  = errs.current_password?.[0] ?? e.response?.data?.message ?? 'Failed to change password.'
            error(msg)
        }
        setSaving(false)
    }

    const pwField = (key, label, showKey) => (
        <Field label={label}>
            <div className="relative">
                <Input
                    type={show[showKey] ? 'text' : 'password'}
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="••••••••"
                    className="pr-10"
                />
                <button type="button"
                    onClick={() => setShow(p => ({ ...p, [showKey]: !p[showKey] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {show[showKey] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
        </Field>
    )

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {pwField('current_password', 'Current Password', 'current')}
                {pwField('password', 'New Password', 'new')}
                {pwField('password_confirmation', 'Confirm New Password', 'confirm')}
            </div>

            {form.password && form.password !== form.password_confirmation && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                    <AlertCircle size={13} /> Passwords do not match
                </div>
            )}
            {form.password?.length > 0 && form.password?.length < 8 && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertCircle size={13} /> Password must be at least 8 characters
                </div>
            )}
            {form.password?.length >= 8 && form.password === form.password_confirmation && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle2 size={13} /> Passwords match
                </div>
            )}

            <div className="flex justify-end pt-1">
                <button onClick={save} disabled={saving || !valid}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white
                               rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50
                               transition-colors">
                    {saving
                        ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Changing…</>
                        : <><Lock size={14} /> Change Password</>
                    }
                </button>
            </div>
        </div>
    )
}

// ─── Security section ─────────────────────────────────────────────────────────

function SecuritySection({ user, onUpdated }) {
    const { success, error } = useToast()
    const [saving, setSaving] = useState(false)
    const enabled = !!user?.two_factor_enabled

    const toggle = async () => {
        setSaving(true)
        try {
            await api.put('/auth/2fa/toggle', { enabled: !enabled })
            onUpdated({ two_factor_enabled: !enabled })
            success(enabled ? 'Two-factor authentication disabled.' : 'Two-factor authentication enabled.')
        } catch (e) {
            error(e.response?.data?.message ?? 'Update failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    enabled ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                    <ShieldCheck size={18} className={enabled ? 'text-green-600' : 'text-gray-400'} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-800">Two-Factor Authentication</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {enabled
                            ? 'Enabled — you will receive a 6-digit code by email on each sign-in.'
                            : 'Disabled — only your password is required to sign in.'}
                    </p>
                </div>
            </div>
            <button
                onClick={toggle}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                            transition-colors duration-200 focus:outline-none
                            ${enabled ? 'bg-green-500' : 'bg-gray-200'}
                            ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                role="switch"
                aria-checked={enabled}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
                                transition duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
            </button>
        </div>
    )
}

// ─── Notification preferences ──────────────────────────────────────────────────

function ToggleRow({ label, hint, checked, onChange, disabled }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
            </div>
            <button
                onClick={onChange}
                disabled={disabled}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                            transition-colors duration-200 focus:outline-none
                            ${checked ? 'bg-green-500' : 'bg-gray-200'}
                            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                role="switch"
                aria-checked={checked}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
                                transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
                />
            </button>
        </div>
    )
}

const DIGEST_OPTIONS = [
    { value: 'realtime', label: 'Real-time', hint: 'Email me as soon as something happens' },
    { value: 'daily', label: 'Daily digest', hint: 'One summary email per day instead' },
    { value: 'weekly', label: 'Weekly digest', hint: 'One summary email per week instead' },
]

function NotificationPreferencesSection() {
    const { success, error } = useToast()
    const [prefs, setPrefs] = useState(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api.get('/notification-preferences')
            .then(r => setPrefs(r.data?.data))
            .catch(() => error('Failed to load notification preferences.'))
    }, [])

    const save = async (changes) => {
        setSaving(true)
        const previous = prefs
        setPrefs(p => ({ ...p, ...changes }))
        try {
            const res = await api.put('/notification-preferences', changes)
            setPrefs(res.data?.data)
            success('Notification preferences updated.')
        } catch (e) {
            setPrefs(previous)
            error(e.response?.data?.message ?? 'Update failed.')
        } finally {
            setSaving(false)
        }
    }

    if (!prefs) {
        return <div className="h-24 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    }

    return (
        <div className="space-y-5">
            <ToggleRow
                label="Email Notifications"
                hint="Receive notifications by email, in addition to in-app"
                checked={!!prefs.email_enabled}
                disabled={saving}
                onChange={() => save({ email_enabled: !prefs.email_enabled })}
            />
            <ToggleRow
                label="In-App Notifications"
                hint="Show notifications in the bell menu"
                checked={!!prefs.inapp_enabled}
                disabled={saving}
                onChange={() => save({ inapp_enabled: !prefs.inapp_enabled })}
            />

            <div className="pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-800 mb-1">Email Frequency</p>
                <p className="text-xs text-gray-500 mb-3">
                    Choose whether routine notification emails (assignments, decisions, budget updates) arrive
                    individually or bundled into a periodic summary. Time-sensitive emails (password resets,
                    login codes, invitations) always send immediately regardless of this setting.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {DIGEST_OPTIONS.map(opt => {
                        const active = prefs.digest_frequency === opt.value
                        return (
                            <button
                                key={opt.value}
                                onClick={() => !active && save({ digest_frequency: opt.value })}
                                disabled={saving}
                                className={`text-left px-3.5 py-3 rounded-xl border transition-colors disabled:opacity-50 ${
                                    active
                                        ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <p className={`text-xs font-semibold ${active ? 'text-indigo-700' : 'text-gray-700'}`}>{opt.label}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{opt.hint}</p>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ─── Active sessions ──────────────────────────────────────────────────────────

function PrivacySection() {
    const { success, error } = useToast()
    const [request, setRequest] = useState(undefined)
    const [asking, setAsking] = useState(false)
    const [reason, setReason] = useState('')
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        api.get('/me/deletion-request').then(r => setRequest(r.data?.data ?? null)).catch(() => setRequest(null))
    }, [])

    const download = async () => {
        setBusy(true)
        try {
            await downloadFile('/me/data-export', 'my-data.json')
        } catch {
            error('Could not prepare your data. Please try again.')
        }
        setBusy(false)
    }

    const send = async () => {
        setBusy(true)
        try {
            const r = await api.post('/me/deletion-request', { reason: reason.trim() || null })
            setRequest(r.data?.data)
            setAsking(false)
            success(r.data?.message || 'Request sent.')
        } catch (e) {
            error(e.response?.data?.message || 'Could not send the request.')
        }
        setBusy(false)
    }

    const cancel = async () => {
        setBusy(true)
        try {
            await api.delete('/me/deletion-request')
            setRequest(r => ({ ...r, status: 'cancelled' }))
            success('Deletion request cancelled.')
        } catch (e) {
            error(e.response?.data?.message || 'Could not cancel the request.')
        }
        setBusy(false)
    }

    const pending = request?.status === 'pending'

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-900">Download your data</p>
                    <p className="text-xs text-gray-500">Your profile, proposals, team memberships, reviews and notifications, as a file.</p>
                </div>
                <button onClick={download} disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <Download size={14} /> Download
                </button>
            </div>

            <div className="border-t border-gray-100 pt-5">
                <p className="text-sm font-medium text-gray-900">Delete your personal data</p>
                <p className="mt-0.5 text-xs text-gray-500">
                    An administrator reviews the request. Your name, contact details and sign-in are removed; proposals and reviews you took part in
                    stay as university records without identifying you. It can't be done while you still have active proposals, reviews or unsettled funds.
                </p>

                {pending ? (
                    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-amber-800">Request sent {timeAgo(request.created_at)} — waiting for an administrator.</p>
                        <button onClick={cancel} disabled={busy} className="text-sm font-semibold text-amber-900 underline underline-offset-2 disabled:opacity-50">Cancel request</button>
                    </div>
                ) : request?.status === 'rejected' && !asking ? (
                    <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">Your last request was declined: {request.admin_note}</p>
                ) : null}

                {!pending && (asking ? (
                    <div className="mt-3 space-y-3">
                        <textarea rows={3} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)}
                            placeholder="Optional: tell us why"
                            className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                        <div className="flex gap-2">
                            <button onClick={() => setAsking(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                            <button onClick={send} disabled={busy} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Send deletion request</button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setAsking(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                        <Trash2 size={14} /> Request deletion
                    </button>
                ))}
            </div>
        </div>
    )
}

function ActiveSessionsSection() {
    const { success, error } = useToast()
    const { logout } = useAuth()
    const [sessions, setSessions] = useState(null)
    const [revoking, setRevoking] = useState(null)

    const load = useCallback(() => {
        api.get('/auth/sessions')
            .then(r => setSessions(r.data?.data ?? []))
            .catch(() => error('Failed to load sessions.'))
    }, [])

    useEffect(() => { load() }, [load])

    const revoke = async (session) => {
        setRevoking(session.id)
        try {
            await api.delete(`/auth/sessions/${session.id}`)
            if (session.is_current) {
                // Revoking your own current token leaves the local app holding a
                // dead token — treat it exactly like signing out.
                await logout()
                return
            }
            success('Session revoked.')
            setSessions(prev => prev.filter(s => s.id !== session.id))
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to revoke session.')
        } finally {
            setRevoking(null)
        }
    }

    if (sessions === null) {
        return (
            <div className="space-y-2 animate-pulse">
                {[1, 2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <p className="text-xs text-gray-400 -mt-1 mb-1">
                Every device currently signed in to your account. Revoke any you don't recognize.
            </p>
            {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            s.is_current ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                            <Monitor size={15} className={s.is_current ? 'text-green-600' : 'text-gray-400'} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-800 truncate">{s.name || 'Session'}</p>
                                {s.is_current && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                                        This device
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400">
                                {s.last_used_at ? `Active ${timeAgo(s.last_used_at)}` : 'Never used'} · Signed in {timeAgo(s.created_at)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => revoke(s)}
                        disabled={revoking === s.id}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0"
                    >
                        <Trash2 size={12} /> {revoking === s.id ? 'Revoking…' : s.is_current ? 'Sign out' : 'Revoke'}
                    </button>
                </div>
            ))}
        </div>
    )
}

// ─── Academic info section ────────────────────────────────────────────────────

function AcademicInfoForm({ user, onUpdated }) {
    const { success, error } = useToast()
    const { hasPermission } = useAuth()
    const canEditCollegeDept = hasPermission('users.update')
    const [collegeId, setCollegeId]       = useState(user?.college_id ?? '')
    const [departmentId, setDepartmentId] = useState(user?.department_id ?? '')
    const [expertiseTags, setExpertiseTags] = useState(user?.expertise ?? [])
    const [expertiseInput, setExpertiseInput] = useState('')
    const [colleges, setColleges]     = useState([])
    const [departments, setDepartments] = useState([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api.get('/colleges/public').then(r => setColleges(r.data?.data ?? [])).catch(() => {})
    }, [])

    useEffect(() => {
        setDepartmentId('')
        setDepartments([])
        if (collegeId) {
            api.get(`/colleges/${collegeId}/departments/public`)
                .then(r => setDepartments(r.data?.data ?? []))
                .catch(() => {})
        }
    }, [collegeId])

    // Seed departments for the current college on mount (so the selector is populated)
    useEffect(() => {
        if (user?.college_id) {
            setCollegeId(user.college_id)
            api.get(`/colleges/${user.college_id}/departments/public`)
                .then(r => { setDepartments(r.data?.data ?? []); setDepartmentId(user?.department_id ?? '') })
                .catch(() => {})
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.college_id])

    const addTag = (val) => {
        const trimmed = val.trim()
        if (!trimmed || expertiseTags.includes(trimmed)) { setExpertiseInput(''); return }
        setExpertiseTags(prev => [...prev, trimmed])
        setExpertiseInput('')
    }

    const removeTag = (idx) => setExpertiseTags(prev => prev.filter((_, i) => i !== idx))

    const changed = collegeId !== (user?.college_id ?? '')
        || departmentId !== (user?.department_id ?? '')
        || JSON.stringify(expertiseTags) !== JSON.stringify(user?.expertise ?? [])

    const save = async () => {
        setSaving(true)
        try {
            const res = await api.put('/auth/profile', {
                college_id:    collegeId    || null,
                department_id: departmentId || null,
                expertise:     expertiseTags,
            })
            const updated = res.data?.data?.user ?? res.data?.data
            if (updated) onUpdated(updated)
            success('Academic profile saved.')
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to save.')
        }
        setSaving(false)
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="College / Faculty" hint={!canEditCollegeDept ? 'Contact admin to change your college' : undefined}>
                    <Select value={collegeId} onChange={e => setCollegeId(e.target.value)} disabled={!canEditCollegeDept}>
                        <option value="">Select college…</option>
                        {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                </Field>
                <Field label="Department" hint={!canEditCollegeDept ? 'Contact admin to change your department' : undefined}>
                    <Select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                            disabled={!canEditCollegeDept || !collegeId || departments.length === 0}>
                        <option value="">{!collegeId ? 'Select a college first' : departments.length === 0 ? 'No departments' : 'Select department…'}</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                </Field>
            </div>

            <Field label="Research Expertise Areas">
                {expertiseTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2.5">
                        {expertiseTags.map((tag, i) => (
                            <span key={i} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-200">
                                {tag}
                                <button onClick={() => removeTag(i)} className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors">
                                    <X size={11} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <Input
                        value={expertiseInput}
                        onChange={e => setExpertiseInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(expertiseInput) } }}
                        onBlur={() => addTag(expertiseInput)}
                        placeholder="e.g. Machine Learning, Hydrology — press Enter to add"
                        className="flex-1"
                    />
                    <button onClick={() => addTag(expertiseInput)}
                        className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                        Add
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add each area.</p>
            </Field>

            {changed && (
                <div className="flex justify-end pt-1">
                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white
                                   rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60
                                   transition-colors">
                        {saving
                            ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                            : <><Save size={14} /> Save Changes</>
                        }
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfileEdit() {
    const { user, refreshUser } = useAuth()
    const [localUser, setLocalUser] = useState(null)

    const currentUser = localUser ?? user

    // Always load fresh data from the server on mount
    useEffect(() => { refreshUser?.() }, [])

    const handleUpdated = useCallback((data) => {
        setLocalUser(prev => ({ ...(prev ?? user ?? {}), ...data }))
        refreshUser?.()
    }, [user, refreshUser])

    return (
        <AppLayout breadcrumb="My Profile">
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your personal information and account settings</p>
                </div>

                {/* Top row: avatar + account info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                    {/* Avatar card */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col items-center
                                    justify-center gap-4">
                        <AvatarUpload user={currentUser} onUpdated={handleUpdated} />

                        <div className="w-full pt-4 border-t border-gray-100 space-y-2">
                            {[
                                { icon: Mail,      text: currentUser?.email ?? '—' },
                                { icon: CreditCard, text: currentUser?.employee_id ?? 'No employee ID' },
                                { icon: Phone,      text: currentUser?.phone ?? 'No phone' },
                            ].map(({ icon: Icon, text }) => (
                                <div key={text} className="flex items-center gap-2 text-xs text-gray-500">
                                    <Icon size={13} className="text-gray-400 shrink-0" />
                                    <span className="truncate">{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Account info */}
                    <div className="md:col-span-2">
                        <Card title="Account Information" icon={Shield}
                              iconColor="bg-indigo-100 text-indigo-600">
                            <AccountInfo user={currentUser} />
                        </Card>
                    </div>
                </div>

                {/* Personal info form */}
                <Card title="Personal Information" icon={User}
                      iconColor="bg-blue-100 text-blue-600">
                    <PersonalInfoForm user={currentUser} onUpdated={handleUpdated} />
                </Card>

                {/* Academic profile */}
                <Card title="Academic Profile" icon={GraduationCap}
                      iconColor="bg-purple-100 text-purple-600">
                    <AcademicInfoForm user={currentUser} onUpdated={handleUpdated} />
                </Card>

                {/* Password */}
                <Card title="Change Password" icon={Lock}
                      iconColor="bg-amber-100 text-amber-600">
                    <ChangePasswordForm />
                </Card>

                {/* Security */}
                <Card title="Security" icon={ShieldCheck}
                      iconColor="bg-green-100 text-green-600">
                    <SecuritySection user={currentUser} onUpdated={handleUpdated} />
                </Card>

                {/* Notification preferences */}
                <Card title="Notification Preferences" icon={Bell}
                      iconColor="bg-indigo-100 text-indigo-600">
                    <NotificationPreferencesSection />
                </Card>

                {/* Active sessions */}
                <Card title="Active Sessions" icon={Monitor}
                      iconColor="bg-slate-100 text-slate-600">
                    <ActiveSessionsSection />
                </Card>

                <Card title="Your Data & Privacy" icon={FileLock2}
                      iconColor="bg-rose-100 text-rose-600">
                    <PrivacySection />
                </Card>

            </div>
        </AppLayout>
    )
}
