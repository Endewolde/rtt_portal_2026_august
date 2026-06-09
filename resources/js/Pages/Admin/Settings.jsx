import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '../../lib/utils'
import {
    Settings, Shield, Users, Mail, HardDrive, Server,
    Palette, BookOpen, Activity, Database, Puzzle,
    ChevronRight, Save, RefreshCw, AlertTriangle,
    Eye, EyeOff, Upload, Info, CheckCircle2,
    ToggleLeft, ToggleRight, Zap, X, Send,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import { useConfirm } from '../../hooks/useConfirm'
import api from '../../lib/api'

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTIONS = [
    { key: 'general',     label: 'General',              icon: Settings,  bg: 'bg-blue-100',   text: 'text-blue-600'   },
    { key: 'security',    label: 'Authentication',        icon: Shield,    bg: 'bg-red-100',    text: 'text-red-600'    },
    { key: 'users',       label: 'User Management',       icon: Users,     bg: 'bg-purple-100', text: 'text-purple-600' },
    { key: 'email',       label: 'Email & Notifications', icon: Mail,      bg: 'bg-green-100',  text: 'text-green-600'  },
    { key: 'files',       label: 'File Management',       icon: HardDrive, bg: 'bg-orange-100', text: 'text-orange-600' },
    { key: 'system',      label: 'System Config',         icon: Server,    bg: 'bg-slate-100',  text: 'text-slate-600'  },
    { key: 'appearance',  label: 'Appearance',            icon: Palette,   bg: 'bg-pink-100',   text: 'text-pink-600'   },
    { key: 'thresholds',  label: 'Review Thresholds',     icon: BookOpen,  bg: 'bg-teal-100',   text: 'text-teal-600'   },
    { key: 'audit',       label: 'Audit & Logging',       icon: Activity,  bg: 'bg-amber-100',  text: 'text-amber-600'  },
    { key: 'backup',      label: 'Backup & Recovery',     icon: Database,  bg: 'bg-cyan-100',   text: 'text-cyan-600'   },
    { key: 'integration', label: 'Integrations',          icon: Puzzle,    bg: 'bg-indigo-100', text: 'text-indigo-600' },
]

// Dropdown options for every `select` type setting
const SELECT_OPTIONS = {
    default_language:          [['en', 'English'], ['am', 'Amharic (አማርኛ)']],
    default_timezone:          [
        ['Africa/Addis_Ababa', 'Africa/Addis Ababa (EAT +3)'],
        ['UTC', 'UTC'],
        ['America/New_York', 'US Eastern'],
        ['Europe/London', 'Europe/London'],
    ],
    date_format:               [['DD/MM/YYYY', 'DD/MM/YYYY'], ['MM/DD/YYYY', 'MM/DD/YYYY'], ['YYYY-MM-DD', 'YYYY-MM-DD (ISO)']],
    time_format:               [['24h', '24-hour (14:30)'], ['12h', '12-hour (2:30 PM)']],
    mail_driver:               [['smtp', 'SMTP'], ['sendmail', 'Sendmail'], ['log', 'Log (dev/test)'], ['mailgun', 'Mailgun'], ['ses', 'Amazon SES']],
    mail_encryption:           [['tls', 'TLS (recommended)'], ['ssl', 'SSL'], ['', 'None']],
    file_storage:              [['local', 'Local Disk'], ['public', 'Public Disk'], ['s3', 'Amazon S3']],
    cache_driver:              [['redis', 'Redis'], ['memcached', 'Memcached'], ['file', 'File'], ['array', 'Array (test)']],
    queue_driver:              [['redis', 'Redis'], ['database', 'Database'], ['sync', 'Sync (test)'], ['sqs', 'Amazon SQS']],
    backup_schedule:           [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']],
    default_user_role:         [['guest', 'Guest'], ['pi', 'Principal Investigator'], ['reviewer', 'Reviewer'], ['staff', 'Staff']],
    account_activation_method: [['email', 'Email Verification'], ['admin', 'Admin Approval'], ['none', 'Instant (no verification)']],
    theme:                     [['light', 'Light'], ['dark', 'Dark']],
}

// Human-readable labels for known keys
const KEY_LABELS = {
    system_name: 'System Name', organization_name: 'Organization Name',
    system_logo: 'System Logo', favicon: 'Favicon',
    default_language: 'Default Language', default_timezone: 'Default Timezone',
    date_format: 'Date Format', time_format: 'Time Format',
    currency_format: 'Currency', current_academic_year: 'Current Academic Year',
    password_min_length: 'Min Password Length', password_require_uppercase: 'Require Uppercase',
    password_require_numbers: 'Require Numbers', password_require_symbols: 'Require Symbols',
    password_expiration_days: 'Password Expires (days)', mfa_enabled: 'MFA Enabled',
    session_timeout_minutes: 'Session Timeout (min)', max_login_attempts: 'Max Login Attempts',
    account_lockout_minutes: 'Lockout Duration (min)', force_password_on_first_login: 'Force Password Change on First Login',
    captcha_enabled: 'CAPTCHA Enabled', allowed_ips: 'Allowed IP Addresses',
    default_user_role: 'Default User Role', self_registration: 'Self-Registration',
    email_verification_required: 'Email Verification Required', default_import_password: 'Default Import Password',
    account_activation_method: 'Account Activation Method',
    mail_driver: 'Mail Driver', mail_host: 'SMTP Host', mail_port: 'SMTP Port',
    mail_username: 'Mail Username', mail_password: 'Mail Password',
    mail_encryption: 'Encryption', mail_from_address: 'From Address', mail_from_name: 'From Name',
    sms_gateway: 'SMS Gateway', telegram_bot_token: 'Telegram Bot Token',
    announcement_message: 'Announcement Message', announcement_active: 'Announcement Active',
    max_upload_size_mb: 'Max Upload Size (MB)', allowed_file_types: 'Allowed File Types',
    file_storage: 'Storage Driver', file_retention_days: 'File Retention (days)',
    maintenance_mode: 'Maintenance Mode', debug_mode: 'Debug Mode',
    cache_driver: 'Cache Driver', queue_driver: 'Queue Driver',
    redis_host: 'Redis Host', redis_port: 'Redis Port',
    primary_color: 'Primary Color', secondary_color: 'Secondary Color',
    sidebar_color: 'Sidebar Background Color',
    footer_text: 'Footer Text', custom_css: 'Custom CSS',
    homepage_banner: 'Homepage Banner', theme: 'Theme',
    blind_threshold: 'Blind Review Threshold (%)', defence_threshold: 'Open Defence Threshold (%)',
    combined_threshold: 'Combined Threshold (pts)', similarity_threshold: 'Similarity Threshold (0–1)',
    audit_log_retention_days: 'Audit Log Retention (days)', activity_logging: 'Activity Logging',
    error_logging: 'Error Logging', login_history_enabled: 'Login History',
    backup_schedule: 'Backup Schedule', backup_retention_days: 'Backup Retention (days)',
    auto_backup_enabled: 'Auto Backup',
    ldap_enabled: 'LDAP Enabled', ldap_host: 'LDAP Host',
    oauth_enabled: 'OAuth Enabled', google_client_id: 'Google Client ID',
    webhook_url: 'Webhook URL',
}

function label(key) {
    return KEY_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Keys that are internal / legacy and should not appear in the UI
const HIDDEN_KEYS = new Set(['site_name'])

// ─── Individual field ─────────────────────────────────────────────────────────

function SettingField({ settingKey, setting, value, onChange, onSave }) {
    const [show,   setShow]   = useState(false)
    const [saving, setSaving] = useState(false)

    const save = async (v) => {
        setSaving(true)
        await onSave(settingKey, v ?? value)
        setSaving(false)
    }

    const type = setting?.type ?? 'string'
    const lbl  = label(settingKey)

    // ── Boolean toggle ───────────────────────────────────────────────────────
    if (type === 'boolean') {
        const on = value === 'true' || value === true
        return (
            <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <p className="text-sm font-medium text-gray-900">{lbl}</p>
                <button
                    onClick={() => { const next = on ? 'false' : 'true'; onChange(settingKey, next); save(next) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        on ? 'bg-green-100 text-green-700 hover:bg-green-200'
                           : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                >
                    {on ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                    {on ? 'Enabled' : 'Disabled'}
                </button>
            </div>
        )
    }

    // ── Color picker ─────────────────────────────────────────────────────────
    if (type === 'color') {
        return (
            <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <p className="text-sm font-medium text-gray-900">{lbl}</p>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={value || '#000000'}
                        onChange={e => onChange(settingKey, e.target.value)}
                        onBlur={e => save(e.target.value)}
                        className="w-10 h-8 rounded cursor-pointer border border-gray-300"
                    />
                    <span className="text-xs font-mono text-gray-400 w-16">{value}</span>
                    <SaveBtn onClick={() => save()} saving={saving} />
                </div>
            </div>
        )
    }

    // ── Textarea / code block ─────────────────────────────────────────────────
    if (type === 'textarea' || type === 'code') {
        return (
            <div className="py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-900">{lbl}</p>
                    <SaveBtn onClick={() => save()} saving={saving} />
                </div>
                <textarea
                    value={value ?? ''}
                    onChange={e => onChange(settingKey, e.target.value)}
                    rows={type === 'code' ? 6 : 3}
                    className={`w-full border border-gray-300 rounded-xl px-3 py-2 text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none
                                ${type === 'code' ? 'font-mono text-xs bg-gray-50' : ''}`}
                    placeholder={type === 'code' ? '/* Custom CSS */' : `Enter ${lbl.toLowerCase()}…`}
                />
            </div>
        )
    }

    // ── Password field ────────────────────────────────────────────────────────
    if (type === 'password') {
        return (
            <div className="py-3 border-b border-gray-100 last:border-0">
                <p className="text-sm font-medium text-gray-900 mb-1.5">{lbl}</p>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type={show ? 'text' : 'password'}
                            value={value ?? ''}
                            onChange={e => onChange(settingKey, e.target.value)}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
                            placeholder="Enter value…"
                        />
                        <button onClick={() => setShow(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {show ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    <SaveBtn onClick={() => save()} saving={saving} />
                </div>
            </div>
        )
    }

    // ── Select dropdown ───────────────────────────────────────────────────────
    if (type === 'select') {
        const opts = SELECT_OPTIONS[settingKey] ?? []
        return (
            <div className="py-3 border-b border-gray-100 last:border-0">
                <p className="text-sm font-medium text-gray-900 mb-1.5">{lbl}</p>
                <div className="flex gap-2">
                    <select
                        value={value ?? ''}
                        onChange={e => onChange(settingKey, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        {opts.length === 0 && <option value={value ?? ''}>{value}</option>}
                        {opts.map(([val, lbl2]) => (
                            <option key={val} value={val}>{lbl2}</option>
                        ))}
                    </select>
                    <SaveBtn onClick={() => save()} saving={saving} />
                </div>
            </div>
        )
    }

    // ── File (handled in Appearance section panel separately) ────────────────
    if (type === 'file') return null

    // ── Default: text or number ───────────────────────────────────────────────
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <p className="text-sm font-medium text-gray-900 mb-1.5">{lbl}</p>
            <div className="flex gap-2">
                <input
                    type={type === 'number' ? 'number' : 'text'}
                    value={value ?? ''}
                    onChange={e => onChange(settingKey, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Enter ${lbl.toLowerCase()}…`}
                />
                <SaveBtn onClick={() => save()} saving={saving} />
            </div>
        </div>
    )
}

function SaveBtn({ onClick, saving }) {
    return (
        <button onClick={onClick} disabled={saving}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl
                       text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shrink-0">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? 'Saving…' : 'Save'}
        </button>
    )
}

// ─── System Info card ─────────────────────────────────────────────────────────

function SystemInfoPanel({ info, onClearCache, onToggleMaintenance }) {
    if (!info) return (
        <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    const items = [
        { label: 'PHP Version',     value: info.php_version },
        { label: 'Laravel Version', value: info.laravel_version },
        { label: 'Environment',     value: info.environment },
        { label: 'Database',        value: info.database },
        { label: 'Cache Driver',    value: info.cache_driver },
        { label: 'Queue Driver',    value: info.queue_driver },
        { label: 'Free Storage',    value: info.storage_gb != null ? `${info.storage_gb} GB` : '—' },
        { label: 'Timezone',        value: info.timezone },
        { label: 'Debug Mode',      value: info.debug_mode ? '⚠️ ON' : '✅ OFF' },
        { label: 'Maintenance',     value: info.maintenance ? '🔴 Active' : '🟢 Normal' },
    ]

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                {items.map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                        <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                        <strong>Maintenance mode</strong> makes the app return 503 for all users.
                        Once enabled, you cannot disable it from this page — run <code className="font-mono bg-amber-100 px-1 rounded">php artisan up</code> in the terminal to recover.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={onClearCache}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                                   rounded-xl text-sm font-semibold hover:bg-blue-700">
                        <RefreshCw size={14} /> Clear Cache
                    </button>
                    <button onClick={onToggleMaintenance}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
                            info.maintenance
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-red-600 text-white hover:bg-red-700'
                        }`}>
                        <Zap size={14} />
                        {info.maintenance ? 'Disable Maintenance' : 'Enable Maintenance'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Appearance logo uploader ────────────────────────────────────────────────

function LogoUpload({ settingKey, value, onUploaded }) {
    const ref              = useRef(null)
    const [preview,   setPreview]   = useState(value ?? '')
    const [uploading, setUploading] = useState(false)
    const lbl  = settingKey === 'system_logo' ? 'System Logo' : 'Favicon'
    const hint = settingKey === 'system_logo' ? 'PNG, SVG recommended' : '16×16 or 32×32 ICO/PNG'
    const { success, error } = useToast()

    // Sync from parent when value changes (e.g. initial load)
    useEffect(() => { if (value) setPreview(value) }, [value])

    const upload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setUploading(true)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('key', settingKey)
        try {
            const res = await api.post('/settings/upload-asset', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            const url = res.data?.data?.url ?? ''
            setPreview(url)       // update local preview immediately
            onUploaded(settingKey, url)
            success(`${lbl} uploaded successfully.`)
        } catch (err) {
            error(err.response?.data?.message ?? `Failed to upload ${lbl}.`)
        }
        setUploading(false)
        e.target.value = ''
    }

    return (
        <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">{lbl}</p>
            <div
                onClick={() => !uploading && ref.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-4 text-center
                            transition-colors ${uploading
                                ? 'border-blue-300 bg-blue-50 cursor-wait'
                                : 'border-gray-300 cursor-pointer hover:border-blue-400'}`}>
                {uploading ? (
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-blue-500">Uploading…</p>
                    </div>
                ) : preview ? (
                    <div className="relative group">
                        <img src={preview} alt={lbl} className="h-14 mx-auto object-contain" />
                        <p className="text-xs text-gray-400 mt-1.5">Click to replace</p>
                    </div>
                ) : (
                    <>
                        <Upload size={22} className="mx-auto text-gray-400 mb-1" />
                        <p className="text-xs text-gray-500">Click to upload</p>
                        <p className="text-xs text-gray-400">{hint}</p>
                    </>
                )}
            </div>
            <input ref={ref} type="file" accept="image/*,.ico,.svg" className="hidden" onChange={upload} />
        </div>
    )
}

// ─── Sidebar color section ────────────────────────────────────────────────────

const SIDEBAR_PRESETS = [
    { value: '#ffffff', label: 'White'         },
    { value: '#f8fafc', label: 'Slate 50'      },
    { value: '#f0f4ff', label: 'Lavender'      },
    { value: '#0f172a', label: 'Dark Navy'     },
    { value: '#1e1b4b', label: 'Deep Indigo'   },
    { value: '#312e81', label: 'Royal Indigo'  },
    { value: '#1f2937', label: 'Slate Dark'    },
    { value: '#1c1917', label: 'Charcoal'      },
    { value: '#0c4a6e', label: 'Ocean'         },
    { value: '#14532d', label: 'Forest'        },
    { value: '#134e4a', label: 'Teal Dark'     },
    { value: '#7c3aed', label: 'Violet'        },
]

function SidebarColorSection({ currentValue, onSave }) {
    const [color,   setColor]   = useState(currentValue || '#ffffff')
    const [saving,  setSaving]  = useState(false)
    const { success } = useToast()

    // Keep in sync when the parent value loads
    useEffect(() => { if (currentValue) setColor(currentValue) }, [currentValue])

    const save = async (val) => {
        setSaving(true)
        await onSave('sidebar_color', val ?? color)
        success('Sidebar color saved. Reload to preview.')
        setSaving(false)
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-gray-800">Sidebar Background Color</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Choose a preset or pick a custom color</p>
                </div>

                {/* Live preview strip */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200"
                    style={{ backgroundColor: color }}>
                    <span className="text-[11px] font-mono"
                        style={{ color: color === '#ffffff' || color === '#f8fafc' || color === '#f0f4ff' ? '#374151' : '#ffffff' }}>
                        {color}
                    </span>
                </div>
            </div>

            {/* Preset swatches */}
            <div className="flex flex-wrap gap-2">
                {SIDEBAR_PRESETS.map(p => (
                    <button
                        key={p.value}
                        title={p.label}
                        onClick={() => { setColor(p.value); save(p.value) }}
                        className={cn(
                            'h-8 w-8 rounded-lg border-2 transition-all hover:scale-110',
                            color === p.value ? 'border-indigo-500 scale-110 shadow-md' : 'border-gray-200 hover:border-gray-400'
                        )}
                        style={{ backgroundColor: p.value }}
                    />
                ))}
            </div>

            {/* Custom color picker row */}
            <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                <label className="text-xs font-medium text-gray-600">Custom color</label>
                <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    onBlur={e => save(e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer border border-gray-300"
                />
                <span className="text-xs font-mono text-gray-400 flex-1">{color}</span>
                <button
                    onClick={() => save()}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white
                               rounded-xl text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {saving
                        ? <><RefreshCw size={12} className="animate-spin" /> Saving…</>
                        : <><Save size={12} /> Apply</>
                    }
                </button>
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { success, error, warning } = useToast()
    const { confirm, Dialog }         = useConfirm()

    const [activeSection, setActiveSection] = useState('general')
    const [allSettings,   setAllSettings]   = useState({})
    const [values,        setValues]        = useState({})
    const [loading,       setLoading]       = useState(true)
    const [systemInfo,    setSystemInfo]    = useState(null)

    const loadSettings = useCallback(async () => {
        setLoading(true)
        try {
            const res     = await api.get('/settings/app')
            const grouped = res.data?.data ?? {}
            setAllSettings(grouped)
            const flat = {}
            Object.values(grouped).forEach(group =>
                Object.entries(group).forEach(([k, s]) => { flat[k] = s.value })
            )
            setValues(flat)
        } catch {
            error('Failed to load settings.')
        }
        setLoading(false)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const loadSystemInfo = useCallback(async () => {
        try {
            const res = await api.get('/settings/system-info')
            setSystemInfo(res.data?.data ?? null)
        } catch { /* non-critical */ }
    }, [])

    useEffect(() => { loadSettings(); loadSystemInfo() }, [loadSettings, loadSystemInfo])

    const handleChange = (key, val) => setValues(prev => ({ ...prev, [key]: val }))

    const handleSave = async (key, val) => {
        try {
            await api.put(`/settings/app/${key}`, { value: val ?? values[key] })
            success(`"${label(key)}" saved.`)
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to save.')
        }
    }

    const handleClearCache = async () => {
        const ok = await confirm({
            title: 'Clear all cache?',
            description: 'This clears config, view, route, and application caches. The system may be slightly slower for the first few requests.',
            confirmLabel: 'Clear Cache',
        })
        if (!ok) return
        try {
            await api.post('/settings/clear-cache')
            success('Cache cleared successfully.')
        } catch { error('Failed to clear cache.') }
    }

    const handleToggleMaintenance = async () => {
        const isMaintenance = systemInfo?.maintenance
        const ok = await confirm({
            title: isMaintenance ? 'Disable Maintenance Mode?' : 'Enable Maintenance Mode?',
            description: isMaintenance
                ? 'The system will become accessible to all users.'
                : 'All users except super_admin will be locked out until you disable it.',
            confirmLabel: isMaintenance ? 'Disable' : 'Enable',
            variant: isMaintenance ? 'default' : 'destructive',
        })
        if (!ok) return
        try {
            const res = await api.post('/settings/toggle-maintenance')
            success(res.data?.message)
            loadSystemInfo()
        } catch { error('Failed to toggle maintenance mode.') }
    }

    const handleTestEmail = async () => {
        try {
            const res = await api.post('/settings/test-email')
            success(res.data?.message ?? 'Test email sent.')
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to send test email. Check SMTP settings.')
        }
    }

    const section     = SECTIONS.find(s => s.key === activeSection)
    const groupData   = allSettings[activeSection] ?? {}
    const SectionIcon = section?.icon ?? Settings

    return (
        <AppLayout breadcrumb="System Settings">
            <div className="max-w-7xl mx-auto space-y-5">

                {/* Page header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Settings size={22} className="text-blue-600" />
                            System Settings
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Configure all aspects of the RTT Platform</p>
                    </div>
                    {systemInfo?.maintenance && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300
                                        rounded-xl text-red-700 text-sm font-semibold">
                            <AlertTriangle size={15} />
                            Maintenance Mode Active
                        </div>
                    )}
                </div>

                <div className="flex gap-5 items-start">

                    {/* ── Sidebar ───────────────────────────────────────────────── */}
                    <div className="w-52 shrink-0 sticky top-4">
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                            {SECTIONS.map(s => {
                                const Icon     = s.icon
                                const isActive = activeSection === s.key
                                return (
                                    <button key={s.key} onClick={() => setActiveSection(s.key)}
                                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                                                    border-b border-gray-100 last:border-0 text-left transition-colors ${
                                            isActive
                                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                                : 'text-gray-600 hover:bg-gray-50'
                                        }`}>
                                        <Icon size={15} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                                        <span className="truncate">{s.label}</span>
                                        {isActive && <ChevronRight size={13} className="ml-auto text-blue-400 shrink-0" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* ── Content ───────────────────────────────────────────────── */}
                    <div className="flex-1 min-w-0 space-y-4">

                        {/* Section header */}
                        <div className={`rounded-2xl p-4 border border-gray-200 bg-white flex items-center gap-3`}>
                            <div className={`h-10 w-10 ${section?.bg ?? 'bg-blue-100'} rounded-xl
                                             flex items-center justify-center shrink-0`}>
                                <SectionIcon size={18} className={section?.text ?? 'text-blue-600'} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900">{section?.label}</h2>
                                <p className="text-xs text-gray-400">
                                    {Object.keys(groupData).filter(k => groupData[k]?.type !== 'file' && !HIDDEN_KEYS.has(k)).length} settings
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="bg-white border border-gray-200 rounded-2xl p-12 flex justify-center">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* Settings fields */}
                                {Object.keys(groupData).filter(k => groupData[k]?.type !== 'file').length > 0 && (
                                    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                                        {Object.entries(groupData)
                                            .filter(([k, s]) => s.type !== 'file' && !HIDDEN_KEYS.has(k))
                                            .map(([key, setting]) => (
                                                <SettingField
                                                    key={key}
                                                    settingKey={key}
                                                    setting={setting}
                                                    value={values[key] ?? setting.value}
                                                    onChange={handleChange}
                                                    onSave={handleSave}
                                                />
                                            ))
                                        }
                                    </div>
                                )}

                                {Object.keys(groupData).length === 0 && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
                                        <Info size={32} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">No settings found for this section.</p>
                                        <p className="text-xs mt-1">Run the AppSettingsSeeder to populate.</p>
                                    </div>
                                )}

                                {/* ── Email section extras ─────────────────────── */}
                                {activeSection === 'email' && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                                        <h3 className="text-sm font-bold text-gray-800">Email Actions</h3>
                                        <div className="flex flex-wrap gap-3">
                                            <button onClick={handleTestEmail}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                                                           rounded-xl text-sm font-semibold hover:bg-blue-700">
                                                <Send size={14} /> Send Test Email
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400">
                                            Sends a test email to your account ({' '}
                                            <span className="font-medium text-gray-600">your current logged-in email</span>
                                            ) using the SMTP settings above.
                                        </p>
                                    </div>
                                )}

                                {/* ── System section extras ─────────────────────── */}
                                {activeSection === 'system' && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                                            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-blue-700">
                                                <strong>Note:</strong> Runtime values (debug mode, cache/queue drivers) are controlled by <code className="font-mono bg-blue-100 px-1 rounded">.env</code> and shown below. The toggles above record your intended config but do not change the running process.
                                            </p>
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-800 mb-4">Live System Information</h3>
                                        <SystemInfoPanel
                                            info={systemInfo}
                                            onClearCache={handleClearCache}
                                            onToggleMaintenance={handleToggleMaintenance}
                                        />
                                    </div>
                                )}

                                {/* ── Sidebar color ─────────────────────────────── */}
                                {activeSection === 'appearance' && (
                                    <SidebarColorSection
                                        currentValue={values.sidebar_color}
                                        onSave={handleSave}
                                    />
                                )}

                                {/* ── Logo/favicon — general group holds these files ── */}
                                {(activeSection === 'appearance' || activeSection === 'general') && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-gray-800 mb-4">Logo & Favicon</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <LogoUpload
                                                settingKey="system_logo"
                                                value={values.system_logo}
                                                onUploaded={handleChange}
                                            />
                                            <LogoUpload
                                                settingKey="favicon"
                                                value={values.favicon}
                                                onUploaded={handleChange}
                                            />
                                        </div>
                                        {(values.system_logo || values.favicon) && (
                                            <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50
                                                            border border-green-200 rounded-lg px-3 py-2">
                                                <CheckCircle2 size={13} />
                                                Assets saved. Changes reflect after the next page reload.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Backup section extras ─────────────────────── */}
                                {activeSection === 'backup' && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                                        <h3 className="text-sm font-bold text-gray-800">Backup Actions</h3>
                                        <button
                                            onClick={() => warning('Database backup requires server configuration. Contact your system administrator.')}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                                                       rounded-xl text-sm font-semibold hover:bg-blue-700">
                                            <Database size={14} /> Run Manual Backup
                                        </button>
                                        <p className="text-xs text-gray-400">
                                            Automated backups run according to the schedule configured above.
                                        </p>
                                    </div>
                                )}

                                {/* ── Integration section notice ────────────────── */}
                                {activeSection === 'integration' && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                                        <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-700">
                                            <strong>Note:</strong> Integration settings require additional server-side configuration.
                                            Contact your system administrator before enabling LDAP or OAuth.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <Dialog />
        </AppLayout>
    )
}
