import { useState, useRef, useCallback } from 'react'
import {
    User, Mail, Phone, CreditCard, Shield, Lock,
    Camera, Save, Eye, EyeOff, CheckCircle2, AlertCircle,
    Building2, Layers, MessageSquare, ExternalLink, ShieldCheck,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../Components/Toast'
import api from '../../lib/api'

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
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-400">
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
            if (updated) {
                onUpdated(updated)
                localStorage.setItem('rtt_user', JSON.stringify({
                    ...JSON.parse(localStorage.getItem('rtt_user') ?? '{}'),
                    ...updated,
                }))
            }
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
        { label: 'Status',     value: user?.status ?? '—',
          badge: user?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700' },
        { label: 'Role',       value: (() => { const r = (user?.roles ?? [])[0]; return ((typeof r === 'string' ? r : r?.name) ?? 'guest').replace(/_/g, ' ') })(),
          badge: 'bg-indigo-100 text-indigo-700' },
        { label: 'College',    value: user?.college?.name ?? 'Not assigned' },
        { label: 'Department', value: user?.department?.name ?? 'Not assigned' },
        { label: 'Member since', value: user?.created_at
            ? new Date(user.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
            : '—' },
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {rows.map(row => (
                <div key={row.label} className="flex items-center justify-between py-2
                                                border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500 font-medium">{row.label}</span>
                    {row.badge ? (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${row.badge}`}>
                            {row.value}
                        </span>
                    ) : (
                        <span className="text-xs font-semibold text-gray-800">{row.value}</span>
                    )}
                </div>
            ))}
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

// ─── Telegram section ─────────────────────────────────────────────────────────

function TelegramSection({ user, onUpdated }) {
    const { success, error } = useToast()
    const [token, setToken] = useState(null)
    const [loading, setLoading] = useState(false)

    const generate = async () => {
        setLoading(true)
        try {
            const res = await api.post('/auth/telegram/generate-token')
            setToken(res.data?.data?.token ?? null)
        } catch { error('Failed to generate token.') }
        setLoading(false)
    }

    const connected = !!user?.telegram_chat_id

    return (
        <div className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-xl ${
                connected ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
            }`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg ${
                    connected ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                    {connected ? '✅' : '💬'}
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-800">
                        {connected ? 'Telegram Connected' : 'Telegram Not Connected'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {connected
                            ? 'You will receive RTT notifications via Telegram.'
                            : 'Connect your Telegram account to receive notifications.'}
                    </p>
                </div>
            </div>

            {!connected && (
                <div className="space-y-3">
                    <button onClick={generate} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white
                                   rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                        {loading
                            ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                            : <><MessageSquare size={14} /> Generate Link Token</>
                        }
                    </button>

                    {token && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-semibold text-blue-800">Your link token:</p>
                            <code className="block text-sm font-mono bg-blue-100 rounded-lg px-3 py-2 text-blue-900 break-all">
                                {token}
                            </code>
                            <p className="text-xs text-blue-700">
                                Send this token to the RTT Telegram bot to link your account. Token expires in 10 minutes.
                            </p>
                        </div>
                    )}
                </div>
            )}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfileEdit() {
    const { user, refreshUser } = useAuth()
    const [localUser, setLocalUser] = useState(null)

    const currentUser = localUser ?? user

    const handleUpdated = useCallback((data) => {
        setLocalUser(prev => ({ ...(prev ?? user ?? {}), ...data }))
        // Also refresh auth hook state
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

                {/* Telegram */}
                <Card title="Telegram Integration" icon={MessageSquare}
                      iconColor="bg-cyan-100 text-cyan-600">
                    <TelegramSection user={currentUser} onUpdated={handleUpdated} />
                </Card>

            </div>
        </AppLayout>
    )
}
