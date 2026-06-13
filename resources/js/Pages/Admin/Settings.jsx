import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '../../lib/utils'
import {
    Settings, Shield, Users, Mail, HardDrive, Server,
    Palette, BookOpen, Activity, Database, Puzzle,
    Globe, Layout, FileText, Star, Bell,
    ChevronRight, Save, RefreshCw, AlertTriangle,
    Eye, EyeOff, Upload, Info, CheckCircle2,
    ToggleLeft, ToggleRight, Zap, X, Send, Plus,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import { useConfirm } from '../../hooks/useConfirm'
import { useAuth } from '../../hooks/useAuth'
import api from '../../lib/api'

// ─── Section metadata ─────────────────────────────────────────────────────────

// Sections the admin role is allowed to view (super_admin always sees all)
const ADMIN_SECTIONS = new Set(['appearance', 'public_site', 'thresholds'])

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
    { key: 'integration', label: 'Integrations',          icon: Puzzle,    bg: 'bg-indigo-100',  text: 'text-indigo-600'  },
    { key: 'public_site', label: 'Public Site',           icon: Globe,     bg: 'bg-emerald-100', text: 'text-emerald-600' },
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
    system_tagline: 'Sidebar Tagline',
    login_institution_text: 'Login Panel Institution Text',
    auth_panel_from_color:  'Login Panel — Gradient Start Color',
    auth_panel_to_color:    'Login Panel — Gradient End Color',
    logo_width: 'Logo Width (px)',
    logo_height: 'Logo Height (px)',
    footer_text: 'Footer Text', custom_css: 'Custom CSS',
    homepage_banner: 'Homepage Banner', theme: 'Theme',
    blind_threshold: 'Blind Review Threshold (%)', defence_threshold: 'Open Defence Threshold (%)',
    combined_threshold: 'Combined Threshold (pts)', similarity_threshold: 'Similarity Threshold (0–1)',
    audit_log_retention_days: 'Audit Log Retention (days)', activity_logging: 'Activity Logging',
    error_logging: 'Error Logging', login_history_enabled: 'Login History',
    backup_schedule: 'Backup Schedule', backup_time: 'Backup Time', backup_retention_days: 'Backup Retention (days)',
    auto_backup_enabled: 'Auto Backup',
    backup_notify_email: 'Notify via Email', backup_notify_telegram: 'Notify via Telegram',
    backup_email_recipient: 'Backup Email Recipient', backup_telegram_chat_id: 'Telegram Chat ID',
    sso_enabled: 'SSO Enabled',
    google_client_id: 'Google Client ID', google_client_secret: 'Google Client Secret',
    microsoft_client_id: 'Microsoft Client ID', microsoft_client_secret: 'Microsoft Client Secret',
    microsoft_tenant_id: 'Azure Tenant ID',
    ldap_enabled: 'LDAP Enabled', ldap_host: 'LDAP Host',
    oauth_enabled: 'OAuth Enabled',
    webhook_url: 'Webhook URL',
    // Public site
    public_header_tagline:     'Header Tagline',
    public_footer_tagline:     'Footer Tagline',
    public_hero_badge:         'Badge Text',
    public_hero_heading:       'Main Heading',
    public_hero_highlight:     'Highlighted Words',
    public_hero_subtitle:      'Hero Subtitle',
    public_hero_cta_primary:   'Primary CTA Button',
    public_hero_cta_secondary: 'Secondary CTA Button',
    public_show_stats:         'Show Statistics Strip',
    public_show_open_calls:    'Show Open Calls',
    public_show_how_it_works:  'Show How It Works',
    public_show_features:      'Show Platform Features',
    public_show_cta:           'Show CTA Banner',
    public_step_1_title:       'Step 1 Title', public_step_1_desc: 'Step 1 Description',
    public_step_2_title:       'Step 2 Title', public_step_2_desc: 'Step 2 Description',
    public_step_3_title:       'Step 3 Title', public_step_3_desc: 'Step 3 Description',
    public_step_4_title:       'Step 4 Title', public_step_4_desc: 'Step 4 Description',
    public_features_title:     'Features Section Title',
    public_features_subtitle:  'Features Section Subtitle',
    public_cta_title:          'CTA Headline',
    public_cta_subtitle:       'CTA Subtitle',
    public_cta_primary:        'CTA Primary Button',
    public_cta_secondary:      'CTA Secondary Button',
    public_topbar_bg:          'Top Bar Background Colour',
    public_topbar_text:        'Top Bar Text Colour',
    public_hero_bg:            'Hero Background Colour',
    public_cards_bg:           'Open Calls Section Background',
    public_features_bg:        'Features Section Background',
    public_footer_bg:          'Footer Background Colour',
    // Nav items
    public_nav_item_1_label: 'Menu Item 1 Label', public_nav_item_1_href: 'Menu Item 1 URL', public_nav_item_1_show: 'Show Menu Item 1',
    public_nav_item_2_label: 'Menu Item 2 Label', public_nav_item_2_href: 'Menu Item 2 URL', public_nav_item_2_show: 'Show Menu Item 2',
    public_nav_item_3_label: 'Menu Item 3 Label', public_nav_item_3_href: 'Menu Item 3 URL', public_nav_item_3_show: 'Show Menu Item 3',
    public_nav_item_4_label: 'Menu Item 4 Label', public_nav_item_4_href: 'Menu Item 4 URL', public_nav_item_4_show: 'Show Menu Item 4',
    public_nav_item_5_label: 'Menu Item 5 Label', public_nav_item_5_href: 'Menu Item 5 URL', public_nav_item_5_show: 'Show Menu Item 5',
    public_nav_item_6_label: 'Menu Item 6 Label', public_nav_item_6_href: 'Menu Item 6 URL', public_nav_item_6_show: 'Show Menu Item 6',
    public_nav_item_7_label: 'Menu Item 7 Label', public_nav_item_7_href: 'Menu Item 7 URL', public_nav_item_7_show: 'Show Menu Item 7',
    // Downloads
    ...Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
            [`public_download_${i+1}_title`, `Item ${i+1} Title`],
            [`public_download_${i+1}_url`,   `Item ${i+1} URL`],
            [`public_download_${i+1}_desc`,  `Item ${i+1} Description`],
        ]).flat()
    ),
    // Social
    public_social_telegram:  'Telegram URL',
    public_social_facebook:  'Facebook URL',
    public_social_twitter:   'Twitter / X URL',
    public_social_linkedin:  'LinkedIn URL',
    public_social_instagram: 'Instagram URL',
    public_social_youtube:   'YouTube URL',
    developer_credits:  'Developer Credits',
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
                    type={type === 'number' ? 'number' : type === 'time' ? 'time' : 'text'}
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

// ─── Public Site panel ───────────────────────────────────────────────────────

const PUBLIC_HERO_KEYS = [
    { key: 'public_hero_badge',         type: 'string',   hint: 'Small chip above the headline.' },
    { key: 'public_hero_heading',        type: 'string',   hint: 'First line of the headline (plain text).' },
    { key: 'public_hero_highlight',      type: 'string',   hint: 'Second line shown in gradient colour.' },
    { key: 'public_hero_subtitle',       type: 'textarea', hint: 'Supporting paragraph below the headline.' },
    { key: 'public_hero_cta_primary',    type: 'string',   hint: 'Label for the primary action button.' },
    { key: 'public_hero_cta_secondary',  type: 'string',   hint: 'Label for the secondary action button.' },
]

const PUBLIC_VISIBILITY_KEYS = [
    { key: 'public_show_stats',        label: 'Statistics Strip'        },
    { key: 'public_show_open_calls',   label: 'Open Calls Section'      },
    { key: 'public_show_how_it_works', label: 'How It Works Section'    },
    { key: 'public_show_features',     label: 'Platform Features'       },
    { key: 'public_show_cta',          label: 'CTA Banner'              },
]

const PUBLIC_STEPS = [1, 2, 3, 4]

const DEFAULT_NAV_LABELS = ['Home', 'Open Calls', 'Explore', 'Repository', 'Track Proposal']
const DEFAULT_NAV_HREFS  = ['/', '/proposal-calls/public', '/explore', '/repository', '/tracker']

const SOCIAL_KEYS = [
    { key: 'public_social_telegram',  placeholder: 'https://t.me/yourgroup'          },
    { key: 'public_social_facebook',  placeholder: 'https://facebook.com/yourpage'    },
    { key: 'public_social_twitter',   placeholder: 'https://x.com/yourhandle'         },
    { key: 'public_social_linkedin',  placeholder: 'https://linkedin.com/company/...' },
    { key: 'public_social_instagram', placeholder: 'https://instagram.com/yourhandle' },
    { key: 'public_social_youtube',   placeholder: 'https://youtube.com/@yourchannel' },
]

// ── Email Settings Panel ──────────────────────────────────────────────────────

const DRIVER_OPTIONS = [
    { val: 'smtp',    label: 'SMTP',        desc: 'Standard email server'        },
    { val: 'log',     label: 'Log (Dev)',   desc: 'Writes to storage/logs'       },
    { val: 'mailgun', label: 'Mailgun',     desc: 'Mailgun API'                  },
    { val: 'ses',     label: 'Amazon SES',  desc: 'AWS Simple Email Service'     },
]
const ENCRYPTION_OPTIONS = [
    { val: 'tls', label: 'TLS (port 587)' },
    { val: 'ssl', label: 'SSL (port 465)' },
    { val: '',    label: 'None'           },
]
const ROLES_LIST = ['super_admin','admin','central_officer','research_officer','community_officer','technology_officer','college_officer','support_officer','staff','guest']

function Field({ label: lbl, hint, children }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{lbl}</label>
            {children}
            {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
        </div>
    )
}
function Input({ className = '', ...props }) {
    return (
        <input
            className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50
                        focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                        outline-none transition-colors ${className}`}
            {...props}
        />
    )
}
function SectionCard({ icon: Icon, color, title, subtitle, children, action }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-100 ${color}`}>
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-white/80 flex items-center justify-center shrink-0 shadow-sm">
                        <Icon size={15} className="text-gray-700" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">{title}</p>
                        {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
                    </div>
                </div>
                {action}
            </div>
            <div className="p-5 space-y-4">{children}</div>
        </div>
    )
}

function EmailSettingsPanel({ values, onChange, onSave, colleges }) {
    const { success, error } = useToast()
    const [smtpSaving,   setSmtpSaving]   = useState(false)
    const [fromSaving,   setFromSaving]   = useState(false)
    const [testing,      setTesting]      = useState(false)
    const [testResult,   setTestResult]   = useState(null)   // { ok, message, detail }
    const [showPass,     setShowPass]     = useState(false)
    const [broadcast,    setBroadcast]    = useState({ to: 'all', role: '', college_id: '', email: '', subject: '', message: '' })
    const [sending,      setSending]      = useState(false)
    const [sendResult,   setSendResult]   = useState(null)   // { sent, failed, total, message }
    const [emailError,   setEmailError]   = useState('')     // inline error for specific email field
    const [testEmail,    setTestEmail]    = useState('')

    const driver = values.mail_driver || 'smtp'
    const isSmtp = driver === 'smtp'
    const configured = isSmtp ? !!(values.mail_host && values.mail_from_address) : driver === 'log'

    const saveBulk = async (keys, setSaving) => {
        setSaving(true)
        try {
            const settings = {}
            keys.forEach(k => { settings[k] = values[k] ?? '' })
            await api.put('/settings/app/bulk', { settings })
            success('Settings saved.')
        } catch {
            error('Failed to save settings.')
        }
        setSaving(false)
    }

    const runTest = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            const params = testEmail.trim() ? { to: testEmail.trim() } : {}
            const r = await api.post('/settings/test-email', params)
            setTestResult({ ok: true, message: r.message, detail: r.data })
        } catch (e) {
            setTestResult({ ok: false, message: e.response?.data?.message || 'Connection failed.' })
        }
        setTesting(false)
    }

    const sendBroadcast = async () => {
        if (!broadcast.subject.trim() || !broadcast.message.trim()) {
            error('Subject and message are required.')
            return
        }
        setEmailError('')
        setSendResult(null)
        setSending(true)
        try {
            const r = await api.post('/settings/send-email', broadcast)
            setSendResult({ ok: true, message: r.message, sent: r.data?.sent ?? 0, failed: r.data?.failed ?? 0 })
            if ((r.data?.failed ?? 0) === 0) {
                setBroadcast(b => ({ ...b, subject: '', message: '' }))
            }
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Failed to send emails.'
            const fieldErr = e.response?.data?.errors?.email?.[0]
            if (fieldErr) {
                setEmailError(fieldErr)
            } else {
                setSendResult({ ok: false, message: msg })
            }
        }
        setSending(false)
    }

    return (
        <div className="space-y-4">

            {/* ── Status banner ────────────────────────────────────────── */}
            <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border ${
                driver === 'log'
                    ? 'bg-amber-50 border-amber-200'
                    : configured
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
            }`}>
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    driver === 'log' ? 'bg-amber-400' : configured ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'
                }`} />
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${
                        driver === 'log' ? 'text-amber-800' : configured ? 'text-emerald-800' : 'text-red-800'
                    }`}>
                        {driver === 'log' ? 'Log Mode — emails written to storage/logs/laravel.log'
                            : configured ? `SMTP configured — ${values.mail_host || '?'}`
                            : 'SMTP not configured — fill in host and from address to enable email'}
                    </p>
                    {configured && driver !== 'log' && (
                        <p className="text-xs text-emerald-600 mt-0.5">From: {values.mail_from_name || '—'} &lt;{values.mail_from_address || '—'}&gt;</p>
                    )}
                </div>
            </div>

            {/* ── SMTP Server ────────────────────────────────────────────── */}
            <SectionCard icon={Server} color="bg-gray-50" title="Mail Driver & Server" subtitle="Transport method and SMTP connection details">
                <Field label="Mail Driver">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {DRIVER_OPTIONS.map(d => (
                            <button key={d.val}
                                onClick={() => { onChange('mail_driver', d.val); onSave('mail_driver', d.val) }}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all text-xs font-semibold ${
                                    driver === d.val
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}
                            >
                                <span className="font-bold">{d.label}</span>
                                <span className={`font-normal text-[10px] ${driver === d.val ? 'text-blue-100' : 'text-gray-400'}`}>{d.desc}</span>
                            </button>
                        ))}
                    </div>
                </Field>

                {isSmtp && (
                    <>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="SMTP Host" hint="e.g. smtp.gmail.com or smtp.office365.com">
                                <Input value={values.mail_host ?? ''} onChange={e => onChange('mail_host', e.target.value)} placeholder="smtp.gmail.com" />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Port">
                                    <Input type="number" value={values.mail_port ?? '587'} onChange={e => onChange('mail_port', e.target.value)} placeholder="587" />
                                </Field>
                                <Field label="Encryption">
                                    <select value={values.mail_encryption ?? 'tls'} onChange={e => onChange('mail_encryption', e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none">
                                        {ENCRYPTION_OPTIONS.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
                                    </select>
                                </Field>
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Username / Email">
                                <Input type="email" value={values.mail_username ?? ''} onChange={e => onChange('mail_username', e.target.value)} placeholder="you@domain.com" autoComplete="off" />
                            </Field>
                            <Field label="Password">
                                <div className="relative">
                                    <Input type={showPass ? 'text' : 'password'} value={values.mail_password ?? ''} onChange={e => onChange('mail_password', e.target.value)} placeholder="SMTP password" autoComplete="new-password" className="pr-10" />
                                    <button type="button" onClick={() => setShowPass(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </Field>
                        </div>
                    </>
                )}

                <div className="flex justify-end pt-2">
                    <button onClick={() => saveBulk(['mail_driver','mail_host','mail_port','mail_username','mail_password','mail_encryption'], setSmtpSaving)}
                        disabled={smtpSaving}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                        {smtpSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        {smtpSaving ? 'Saving…' : 'Save Server Settings'}
                    </button>
                </div>
            </SectionCard>

            {/* ── From Identity ───────────────────────────────────────────── */}
            <SectionCard icon={Mail} color="bg-blue-50/50" title="From Identity" subtitle="Name and address shown to email recipients">
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="From Name" hint="Display name recipients see">
                        <Input value={values.mail_from_name ?? ''} onChange={e => onChange('mail_from_name', e.target.value)} placeholder="RTT Platform" />
                    </Field>
                    <Field label="From Address" hint="Must match your SMTP credentials">
                        <Input type="email" value={values.mail_from_address ?? ''} onChange={e => onChange('mail_from_address', e.target.value)} placeholder="noreply@university.edu" />
                    </Field>
                </div>
                <div className="flex justify-end pt-2">
                    <button onClick={() => saveBulk(['mail_from_name','mail_from_address'], setFromSaving)}
                        disabled={fromSaving}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                        {fromSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        {fromSaving ? 'Saving…' : 'Save From Identity'}
                    </button>
                </div>
            </SectionCard>

            {/* ── Test Connection ─────────────────────────────────────────── */}
            <SectionCard icon={Zap} color="bg-green-50/50" title="Test Connection" subtitle="Send a test email to verify your SMTP setup">
                <div className="flex gap-3 items-end">
                    <Field label="Send Test To" hint="Leave blank to send to your account">
                        <Input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com (optional)" className="flex-1" />
                    </Field>
                    <button onClick={runTest} disabled={testing}
                        className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors mb-[1px]">
                        {testing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                        {testing ? 'Sending…' : 'Send Test'}
                    </button>
                </div>

                {testResult && (
                    <div className={`flex items-start gap-3 rounded-xl p-4 border ${
                        testResult.ok
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-red-50 border-red-200'
                    }`}>
                        <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${testResult.ok ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {testResult.ok
                                ? <CheckCircle2 size={14} className="text-emerald-600" />
                                : <AlertTriangle size={14} className="text-red-500" />
                            }
                        </div>
                        <div className="min-w-0">
                            <p className={`text-sm font-semibold ${testResult.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                                {testResult.ok ? 'Email delivered successfully!' : 'Delivery failed'}
                            </p>
                            <p className={`text-xs mt-0.5 ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                                {testResult.message}
                            </p>
                            {testResult.ok && testResult.detail && (
                                <p className="text-[11px] text-emerald-500 mt-1 font-mono">
                                    Host: {testResult.detail.host} · Driver: {testResult.detail.driver}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </SectionCard>

            {/* ── Broadcast Email ─────────────────────────────────────────── */}
            <SectionCard icon={Send} color="bg-indigo-50/50" title="Send Broadcast Email" subtitle="Reach users by group, role, college, or individually">
                <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Send To</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { val: 'all',        label: 'All Users',     icon: '👥' },
                            { val: 'by_role',    label: 'By Role',       icon: '🛡️' },
                            { val: 'by_college', label: 'By College',    icon: '🏛️' },
                            { val: 'specific',   label: 'Specific User', icon: '👤' },
                        ].map(({ val, label: lbl, icon }) => (
                            <button key={val}
                                onClick={() => setBroadcast(b => ({ ...b, to: val }))}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                                    broadcast.to === val
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                                }`}
                            >
                                <span>{icon}</span> <span>{lbl}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {broadcast.to === 'by_role' && (
                    <Field label="Role">
                        <select value={broadcast.role} onChange={e => setBroadcast(b => ({ ...b, role: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none">
                            <option value="">— Select role —</option>
                            {ROLES_LIST.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                        </select>
                    </Field>
                )}
                {broadcast.to === 'by_college' && (
                    <Field label="College">
                        <select value={broadcast.college_id} onChange={e => setBroadcast(b => ({ ...b, college_id: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none">
                            <option value="">— Select college —</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </Field>
                )}
                {broadcast.to === 'specific' && (
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Recipient Email</label>
                        <Input
                            type="email"
                            value={broadcast.email}
                            onChange={e => { setBroadcast(b => ({ ...b, email: e.target.value })); setEmailError('') }}
                            placeholder="user@university.edu"
                            className={emailError ? '!border-red-400' : ''}
                        />
                        {emailError && (
                            <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                                <AlertTriangle size={11} /> {emailError}
                            </p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">The email must belong to a registered user.</p>
                    </div>
                )}

                <Field label="Subject">
                    <Input value={broadcast.subject} onChange={e => setBroadcast(b => ({ ...b, subject: e.target.value }))} placeholder="Subject line…" />
                </Field>

                <Field label="Message">
                    <textarea rows={5} value={broadcast.message} onChange={e => setBroadcast(b => ({ ...b, message: e.target.value }))}
                        placeholder="Write your message here…"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-colors"
                    />
                </Field>

                {sendResult && (
                    <div className={`flex items-start gap-3 rounded-xl p-4 border ${
                        sendResult.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                    }`}>
                        <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${sendResult.ok ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {sendResult.ok
                                ? <CheckCircle2 size={14} className="text-emerald-600" />
                                : <AlertTriangle size={14} className="text-red-500" />
                            }
                        </div>
                        <div>
                            <p className={`text-sm font-semibold ${sendResult.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                                {sendResult.ok ? 'Emails sent!' : 'Send failed'}
                            </p>
                            <p className={`text-xs mt-0.5 ${sendResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                                {sendResult.message}
                            </p>
                            {sendResult.ok && sendResult.failed > 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                    {sendResult.failed} address(es) failed — check mail server logs for details.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <button onClick={sendBroadcast} disabled={sending}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 shadow-sm shadow-indigo-200 transition-all">
                        {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                        {sending ? 'Sending…' : 'Send Email'}
                    </button>
                </div>
            </SectionCard>

            {/* ── Notification Channels ───────────────────────────────────── */}
            <SectionCard icon={Bell} color="bg-purple-50/50" title="Notification Channels" subtitle="Active delivery channels for system events">
                <div className="grid sm:grid-cols-3 gap-3">
                    {[
                        {
                            label: 'Email',
                            status: configured ? 'active' : 'inactive',
                            detail: configured ? values.mail_from_address : 'Not configured',
                            color: configured ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500',
                            dot: configured ? 'bg-emerald-500' : 'bg-gray-300',
                        },
                        {
                            label: 'Telegram',
                            status: values.telegram_bot_token ? 'active' : 'inactive',
                            detail: values.telegram_bot_token ? 'Bot token configured' : 'Set Telegram Bot Token in Integrations',
                            color: values.telegram_bot_token ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-gray-50 border-gray-200 text-gray-500',
                            dot: values.telegram_bot_token ? 'bg-sky-500' : 'bg-gray-300',
                        },
                        {
                            label: 'In-App',
                            status: 'active',
                            detail: 'Always available — bell icon in header',
                            color: 'bg-violet-50 border-violet-200 text-violet-700',
                            dot: 'bg-violet-500',
                        },
                    ].map(ch => (
                        <div key={ch.label} className={`rounded-xl border p-4 ${ch.color}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${ch.dot}`} />
                                <span className="text-sm font-bold">{ch.label}</span>
                            </div>
                            <p className="text-xs leading-relaxed opacity-80">{ch.detail}</p>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 pt-1">
                    Users control their own channel preferences from their profile notification settings.
                </p>
            </SectionCard>

        </div>
    )
}

// ── Extracted field components (must live outside PublicSitePanel so React
//    doesn't unmount/remount the input on every parent re-render) ──────────────

function PubTextField({ fieldKey, type, hint, value, saving, onChange, onSave }) {
    const lbl = KEY_LABELS[fieldKey] ?? fieldKey
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <p className="text-sm font-medium text-gray-900">{lbl}</p>
            {hint && <p className="text-xs text-gray-400 mt-0.5 mb-2">{hint}</p>}
            <div className="flex gap-2 mt-1.5">
                {type === 'textarea' ? (
                    <textarea
                        value={value ?? ''}
                        onChange={e => onChange(fieldKey, e.target.value)}
                        rows={2}
                        placeholder={`Enter ${lbl.toLowerCase()}…`}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none
                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                ) : (
                    <input
                        type="text"
                        value={value ?? ''}
                        onChange={e => onChange(fieldKey, e.target.value)}
                        placeholder={`Enter ${lbl.toLowerCase()}…`}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                )}
                <button
                    onClick={() => onSave(fieldKey)}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl
                               text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shrink-0">
                    {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    )
}

function PubColorField({ fieldKey, hint, value, saving, onChange, onSave }) {
    const lbl = KEY_LABELS[fieldKey] ?? fieldKey
    return (
        <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
                <p className="text-sm font-medium text-gray-900">{lbl}</p>
                {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value || '#0f172a'}
                    onChange={e => onChange(fieldKey, e.target.value)}
                    onBlur={e => onSave(fieldKey, e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer border border-gray-300"
                />
                <span className="text-xs font-mono text-gray-400 w-16">{value || '#0f172a'}</span>
                <button
                    onClick={() => onSave(fieldKey)}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl
                               text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                    {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    )
}

function DeveloperCreditsEditor({ currentValue, onSave, disabled = false }) {
    const EMPTY = { name: '', website: '', tagline: '' }
    const parse = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } }

    const [devs,   setDevs]   = useState(() => parse(currentValue))
    const [saving, setSaving] = useState(false)
    const { success } = useToast()

    useEffect(() => { setDevs(parse(currentValue)) }, [currentValue])

    const persist = async (next) => {
        setSaving(true)
        await onSave(JSON.stringify(next))
        success('Developer credits saved.')
        setSaving(false)
    }

    const update = (i, field, val) => {
        const next = devs.map((d, idx) => idx === i ? { ...d, [field]: val } : d)
        setDevs(next)
    }

    const add    = () => setDevs(d => [...d, { ...EMPTY }])
    const remove = (i) => { const next = devs.filter((_, idx) => idx !== i); setDevs(next); persist(next) }

    return (
        <div className={`bg-white border border-gray-200 rounded-2xl px-5 py-2 ${disabled ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Globe size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">Developer Credits</h3>
                    <p className="text-xs text-gray-400 ml-1">— shown as a popup in the public footer</p>
                    {disabled && (
                        <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide">
                            Read-only
                        </span>
                    )}
                </div>
                {!disabled && (
                    <button onClick={add}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200
                                   text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                        <Plus size={12} /> Add Developer
                    </button>
                )}
            </div>

            {devs.length === 0 && (
                <p className="text-xs text-gray-400 py-4 text-center">
                    {disabled ? 'No developer credits configured.' : 'No developers added yet. Click "Add Developer" to start.'}
                </p>
            )}

            {devs.map((dev, i) => (
                <div key={i} className="py-4 border-b border-gray-100 last:border-0 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Developer {i + 1}</p>
                        {!disabled && (
                            <button onClick={() => remove(i)}
                                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={dev.name}
                        readOnly={disabled}
                        onChange={disabled ? undefined : e => update(i, 'name', e.target.value)}
                        placeholder="Name or company…"
                        className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm ${disabled ? 'bg-gray-50 cursor-default' : 'focus:outline-none focus:ring-2 focus:ring-emerald-500'}`}
                    />
                    <input
                        type="url"
                        value={dev.website}
                        readOnly={disabled}
                        onChange={disabled ? undefined : e => update(i, 'website', e.target.value)}
                        placeholder="https://example.com (optional)"
                        className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm ${disabled ? 'bg-gray-50 cursor-default' : 'focus:outline-none focus:ring-2 focus:ring-emerald-500'}`}
                    />
                    <textarea
                        value={dev.tagline}
                        readOnly={disabled}
                        onChange={disabled ? undefined : e => update(i, 'tagline', e.target.value)}
                        placeholder="Short description (optional)…"
                        rows={2}
                        className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none ${disabled ? 'bg-gray-50 cursor-default' : 'focus:outline-none focus:ring-2 focus:ring-emerald-500'}`}
                    />
                </div>
            ))}

            {devs.length > 0 && !disabled && (
                <div className="py-3">
                    <button onClick={() => persist(devs)} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl
                                   text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                        {saving ? 'Saving…' : 'Save All'}
                    </button>
                </div>
            )}
        </div>
    )
}

function PublicSitePanel({ values, onChange, onSave, isAdmin = false }) {
    const [saving, setSaving] = useState({})
    const { success, error }  = useToast()

    const save = async (key, val) => {
        const v = val ?? values[key] ?? ''
        setSaving(p => ({ ...p, [key]: true }))
        try {
            await onSave(key, v)
            success(`"${KEY_LABELS[key] ?? key}" saved.`)
        } catch {
            error('Failed to save.')
        }
        setSaving(p => ({ ...p, [key]: false }))
    }

    const toggle = (key) => {
        const next = values[key] === 'false' ? 'true' : 'true'
        // visibility keys default to visible (true) unless explicitly set to 'false'
        const current = values[key]
        const nextVal = current === 'false' ? 'true' : 'false'
        onChange(key, nextVal)
        save(key, nextVal)
    }

    const tf = (fieldKey, type = 'string', hint) => (
        <PubTextField
            key={fieldKey}
            fieldKey={fieldKey}
            type={type}
            hint={hint}
            value={values[fieldKey]}
            saving={!!saving[fieldKey]}
            onChange={onChange}
            onSave={save}
        />
    )

    const cf = (fieldKey, hint) => (
        <PubColorField
            key={fieldKey}
            fieldKey={fieldKey}
            hint={hint}
            value={values[fieldKey]}
            saving={!!saving[fieldKey]}
            onChange={onChange}
            onSave={save}
        />
    )

    return (
        <div className="space-y-4">
            {/* Preview link */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3
                            flex items-center justify-between">
                <p className="text-sm text-emerald-800 font-medium">
                    Changes appear on the public homepage instantly after saving.
                </p>
                <a href="/" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white
                               rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors">
                    <Eye size={13} /> Preview
                </a>
            </div>

            {/* ── Header & nav ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <Layout size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">Header Bar</h3>
                    <p className="text-xs text-gray-400 ml-1">— top utility bar text</p>
                </div>
                {tf('public_header_tagline', 'string', 'Text shown in the thin bar above the main navigation (e.g. "WSU — Research & Technology Transfer Platform").')}
                {tf('public_footer_tagline', 'string', 'Secondary text shown at the bottom-right of the footer (e.g. "Research & Technology Transfer Platform").')}
            </div>

            {/* ── Hero content ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <Layout size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">Hero Section — Text</h3>
                </div>
                {tf('public_hero_badge',        'string',   'Small chip above the headline.')}
                {tf('public_hero_heading',       'string',   'First line of the headline (plain text).')}
                {tf('public_hero_highlight',     'string',   'Second line shown in gradient colour (e.g. "From Idea to Impact").')}
                {tf('public_hero_subtitle',      'textarea', 'Supporting paragraph below the headline.')}
                {tf('public_hero_cta_primary',   'string',   'Primary action button label.')}
                {tf('public_hero_cta_secondary', 'string',   'Secondary action button label.')}
            </div>

            {/* ── Navigation ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <Layout size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">Navigation Menu</h3>
                    <p className="text-xs text-gray-400 ml-1">— customise labels, links, and visibility</p>
                </div>
                {[1, 2, 3, 4, 5, 6, 7].map(n => {
                    const on = values[`public_nav_item_${n}_show`] !== 'false'
                    return (
                        <div key={n} className="py-3 border-b border-gray-100 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    Item {n} <span className="font-normal text-gray-400 normal-case">
                                        (default: {DEFAULT_NAV_LABELS[n - 1]})
                                    </span>
                                </p>
                                <button
                                    onClick={() => {
                                        const nextVal = on ? 'false' : 'true'
                                        onChange(`public_nav_item_${n}_show`, nextVal)
                                        save(`public_nav_item_${n}_show`, nextVal)
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                                        on ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                    {on ? <><ToggleRight size={13} /> Visible</> : <><ToggleLeft size={13} /> Hidden</>}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <PubTextField
                                    fieldKey={`public_nav_item_${n}_label`}
                                    type="string"
                                    value={values[`public_nav_item_${n}_label`]}
                                    saving={!!saving[`public_nav_item_${n}_label`]}
                                    onChange={onChange}
                                    onSave={save}
                                />
                                <PubTextField
                                    fieldKey={`public_nav_item_${n}_href`}
                                    type="string"
                                    hint={DEFAULT_NAV_HREFS[n - 1]}
                                    value={values[`public_nav_item_${n}_href`]}
                                    saving={!!saving[`public_nav_item_${n}_href`]}
                                    onChange={onChange}
                                    onSave={save}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Colours ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <Palette size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">Colours</h3>
                    <p className="text-xs text-gray-400 ml-1">— nav accent uses Appearance → Primary Color</p>
                </div>
                {cf('public_topbar_bg',   'Top utility bar background colour.')}
                {cf('public_topbar_text', 'Top utility bar text and link colour.')}
                {cf('public_hero_bg',     'Hero section dark background colour.')}
                {cf('public_cards_bg',    'Open Calls section background colour.')}
                {cf('public_features_bg', 'Platform Features section background colour.')}
                {cf('public_footer_bg',   'Footer background colour.')}
            </div>

            {/* ── Social Links ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <Globe size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">Social Links</h3>
                    <p className="text-xs text-gray-400 ml-1">— shown as icons in the footer</p>
                </div>
                {SOCIAL_KEYS.map(({ key, placeholder }) => (
                    <div key={key} className="py-3 border-b border-gray-100 last:border-0">
                        <p className="text-sm font-medium text-gray-900 mb-1.5">{KEY_LABELS[key] ?? key}</p>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={values[key] ?? ''}
                                onChange={e => onChange(key, e.target.value)}
                                placeholder={placeholder}
                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={() => save(key)}
                                disabled={!!saving[key]}
                                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl
                                           text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shrink-0">
                                {saving[key] ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                                {saving[key] ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Developer Credits ── */}
            <DeveloperCreditsEditor
                currentValue={values.developer_credits}
                onSave={(val) => save('developer_credits', val)}
                disabled={isAdmin}
            />

            {/* ── Downloads ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <FileText size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">Downloads Menu</h3>
                    <p className="text-xs text-gray-400 ml-1">— appears as a dropdown in the public nav bar when at least one item is set</p>
                </div>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => {
                    const showKey = `public_download_${n}_show`
                    const on = values[showKey] !== 'false'
                    return (
                        <div key={n} className="py-3 border-b border-gray-100 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Item {n}</p>
                                <button
                                    onClick={() => {
                                        const nextVal = on ? 'false' : 'true'
                                        onChange(showKey, nextVal)
                                        save(showKey, nextVal)
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                                        on ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                                    }`}
                                >
                                    {on ? <><ToggleRight size={13} /> Visible</> : <><ToggleLeft size={13} /> Hidden</>}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <PubTextField
                                    fieldKey={`public_download_${n}_title`}
                                    type="string"
                                    hint="Display name (e.g. Proposal Template)"
                                    value={values[`public_download_${n}_title`]}
                                    saving={!!saving[`public_download_${n}_title`]}
                                    onChange={onChange}
                                    onSave={save}
                                />
                                <PubTextField
                                    fieldKey={`public_download_${n}_url`}
                                    type="string"
                                    hint="Full URL to the file or page"
                                    value={values[`public_download_${n}_url`]}
                                    saving={!!saving[`public_download_${n}_url`]}
                                    onChange={onChange}
                                    onSave={save}
                                />
                            </div>
                            <div className="mt-2">
                                <PubTextField
                                    fieldKey={`public_download_${n}_desc`}
                                    type="string"
                                    hint="Short description (optional)"
                                    value={values[`public_download_${n}_desc`]}
                                    saving={!!saving[`public_download_${n}_desc`]}
                                    onChange={onChange}
                                    onSave={save}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Section visibility ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <Eye size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">Section Visibility</h3>
                </div>
                {PUBLIC_VISIBILITY_KEYS.map(({ key, label: lbl }) => {
                    const on = values[key] !== 'false'
                    return (
                        <div key={key}
                            className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                            <p className="text-sm font-medium text-gray-900">{lbl}</p>
                            <button
                                onClick={() => toggle(key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                                            font-semibold transition-all ${
                                    on ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                       : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}>
                                {on ? <><ToggleRight size={15} /> Visible</>
                                    : <><ToggleLeft size={15} /> Hidden</>}
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* ── How It Works steps ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <FileText size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">How It Works Steps</h3>
                </div>
                {PUBLIC_STEPS.map(i => (
                    <div key={i}>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-3 pb-0.5">
                            Step {i}
                        </p>
                        {tf(`public_step_${i}_title`)}
                        {tf(`public_step_${i}_desc`, 'textarea')}
                    </div>
                ))}
            </div>

            {/* ── CTA & features text ── */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                <div className="flex items-center gap-2 py-3 border-b border-gray-100">
                    <Star size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800">CTA Banner &amp; Features Section</h3>
                </div>
                {tf('public_features_title')}
                {tf('public_features_subtitle', 'textarea')}
                {tf('public_cta_title')}
                {tf('public_cta_subtitle', 'textarea')}
                {tf('public_cta_primary')}
                {tf('public_cta_secondary')}
            </div>
        </div>
    )
}

// ─── Integration panel ────────────────────────────────────────────────────────

function ProviderCard({ name, logo, enabledKey, credFields, values, onChange, onSave }) {
    const [saving, setSaving] = useState({})
    const { success, error }  = useToast()
    const isEnabled = values[enabledKey] === 'true'

    const toggleEnabled = async () => {
        const next = isEnabled ? 'false' : 'true'
        onChange(enabledKey, next)
        try {
            await onSave(enabledKey, next)
            success(`${name} SSO ${next === 'true' ? 'enabled' : 'disabled'}.`)
        } catch {
            error('Failed to save.')
        }
    }

    const saveField = async (key) => {
        setSaving(p => ({ ...p, [key]: true }))
        try {
            await onSave(key, values[key] ?? '')
            success(`"${KEY_LABELS[key] ?? key}" saved.`)
        } catch {
            error('Failed to save.')
        }
        setSaving(p => ({ ...p, [key]: false }))
    }

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${
            isEnabled ? 'border-blue-300 shadow-sm shadow-blue-100' : 'border-gray-200'
        }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${
                isEnabled ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'
            }`}>
                <div className="flex items-center gap-3">
                    {logo}
                    <div>
                        <p className="text-sm font-bold text-gray-900">{name}</p>
                        <p className={`text-xs ${isEnabled ? 'text-blue-600' : 'text-gray-400'}`}>
                            {isEnabled ? 'SSO Enabled — login button visible' : 'Disabled — login button hidden'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={toggleEnabled}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isEnabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                >
                    {isEnabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                    {isEnabled ? 'Enabled' : 'Disabled'}
                </button>
            </div>

            {/* Credential fields */}
            <div className="px-5 py-2">
                {credFields.map(({ key, type = 'string' }) => {
                    const lbl = KEY_LABELS[key] ?? key
                    const [show, setShow] = useState(false)
                    return (
                        <div key={key} className="py-3 border-b border-gray-100 last:border-0">
                            <p className="text-sm font-medium text-gray-900 mb-1.5">{lbl}</p>
                            <div className="flex gap-2">
                                {type === 'password' ? (
                                    <div className="relative flex-1">
                                        <input
                                            type={show ? 'text' : 'password'}
                                            value={values[key] ?? ''}
                                            onChange={e => onChange(key, e.target.value)}
                                            placeholder={`Enter ${lbl.toLowerCase()}…`}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm
                                                       focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
                                        />
                                        <button onClick={() => setShow(s => !s)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            {show ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={values[key] ?? ''}
                                        onChange={e => onChange(key, e.target.value)}
                                        placeholder={`Enter ${lbl.toLowerCase()}…`}
                                        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm
                                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                                <button
                                    onClick={() => saveField(key)}
                                    disabled={!!saving[key]}
                                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl
                                               text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shrink-0">
                                    {saving[key] ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                                    {saving[key] ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const GOOGLE_LOGO = (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
)

const MICROSOFT_LOGO = (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0">
        <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
        <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
        <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
        <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
    </svg>
)

function IntegrationPanel({ values, onChange, onSave }) {
    return (
        <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                    <strong>Note:</strong> Enable a provider only after entering valid credentials. The login button appears immediately once enabled.
                </p>
            </div>

            <ProviderCard
                name="Google"
                logo={GOOGLE_LOGO}
                enabledKey="google_sso_enabled"
                credFields={[
                    { key: 'google_client_id',     type: 'string'   },
                    { key: 'google_client_secret', type: 'password' },
                ]}
                values={values}
                onChange={onChange}
                onSave={onSave}
            />

            <ProviderCard
                name="Microsoft"
                logo={MICROSOFT_LOGO}
                enabledKey="microsoft_sso_enabled"
                credFields={[
                    { key: 'microsoft_client_id',     type: 'string'   },
                    { key: 'microsoft_client_secret', type: 'password' },
                    { key: 'microsoft_tenant_id',     type: 'string'   },
                ]}
                values={values}
                onChange={onChange}
                onSave={onSave}
            />
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { success, error, warning } = useToast()
    const { confirm, Dialog }         = useConfirm()
    const { hasRole }                 = useAuth()

    const isAdmin       = hasRole('admin') && !hasRole('super_admin')
    const visibleSections = SECTIONS.filter(s => !isAdmin || ADMIN_SECTIONS.has(s.key))

    const [activeSection, setActiveSection] = useState(
        () => isAdmin ? 'appearance' : 'general'
    )
    const [allSettings,   setAllSettings]   = useState({})
    const [values,        setValues]        = useState({})
    const [loading,       setLoading]       = useState(true)
    const [systemInfo,    setSystemInfo]    = useState(null)
    const [colleges,      setColleges]      = useState([])

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

    useEffect(() => {
        if (activeSection === 'email' && colleges.length === 0) {
            api.get('/colleges').then(r => setColleges(r.data?.data?.data ?? r.data?.data ?? [])).catch(() => {})
        }
    }, [activeSection]) // eslint-disable-line react-hooks/exhaustive-deps

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

    const [backingUp, setBackingUp] = useState(false)

    const handleRunBackup = async () => {
        const ok = await confirm({
            title: 'Run Manual Backup?',
            description: 'This will dump the database, compress it, and deliver it via the configured channels (email and/or Telegram). This may take a minute.',
            confirmLabel: 'Run Backup',
        })
        if (!ok) return
        setBackingUp(true)
        try {
            const res = await api.post('/settings/run-backup')
            success(res.data?.message ?? 'Backup completed.')
        } catch (e) {
            error(e.response?.data?.message ?? 'Backup failed. Check server logs.')
        }
        setBackingUp(false)
    }

    // If admin lands on a section they can't access, fall back to their first allowed section
    const effectiveSection = (isAdmin && !ADMIN_SECTIONS.has(activeSection))
        ? 'appearance'
        : activeSection

    const section     = SECTIONS.find(s => s.key === effectiveSection)
    const groupData   = allSettings[effectiveSection] ?? {}
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
                            {visibleSections.map(s => {
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
                                    {activeSection === 'public_site'
                                        ? 'Hero, visibility, steps & CTA'
                                        : activeSection === 'email'
                                        ? 'SMTP, broadcast mail & notification channels'
                                        : `${Object.keys(groupData).filter(k => groupData[k]?.type !== 'file' && !HIDDEN_KEYS.has(k)).length} settings`
                                    }
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="bg-white border border-gray-200 rounded-2xl p-12 flex justify-center">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : activeSection === 'public_site' ? (
                            <PublicSitePanel
                                values={values}
                                onChange={handleChange}
                                onSave={handleSave}
                                isAdmin={isAdmin}
                            />
                        ) : activeSection === 'email' ? (
                            <EmailSettingsPanel
                                values={values}
                                onChange={handleChange}
                                onSave={handleSave}
                                colleges={colleges}
                            />
                        ) : activeSection === 'integration' ? (
                            <IntegrationPanel
                                values={values}
                                onChange={handleChange}
                                onSave={handleSave}
                            />
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

                                {/* ── Sidebar tagline ───────────────────────────── */}
                                {activeSection === 'appearance' && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-gray-800 mb-1">Sidebar Tagline</h3>
                                        <p className="text-xs text-gray-400 mb-4">
                                            Small text shown below the logo name in the sidebar.
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={values.system_tagline ?? ''}
                                                onChange={e => handleChange('system_tagline', e.target.value)}
                                                placeholder="Research & Tech Transfer"
                                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                                                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button
                                                onClick={() => handleSave('system_tagline', values.system_tagline ?? '')}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white
                                                           rounded-xl text-xs font-semibold hover:bg-blue-700 shrink-0">
                                                <Save size={13} /> Save
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ── Login institution text ────────────────── */}
                                {activeSection === 'appearance' && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-gray-800 mb-1">Login Panel Institution Text</h3>
                                        <p className="text-xs text-gray-400 mb-4">
                                            Footer text displayed at the bottom of the login/register panel.
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={values.login_institution_text ?? ''}
                                                onChange={e => handleChange('login_institution_text', e.target.value)}
                                                placeholder="Haramaya University — Research & Technology Transfer Office"
                                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                                                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button
                                                onClick={() => handleSave('login_institution_text', values.login_institution_text ?? '')}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white
                                                           rounded-xl text-xs font-semibold hover:bg-blue-700 shrink-0">
                                                <Save size={13} /> Save
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ── Auth panel colors ────────────────────── */}
                                {activeSection === 'appearance' && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-gray-800 mb-1">Login / Register Panel Colors</h3>
                                        <p className="text-xs text-gray-400 mb-4">
                                            Gradient colors for the left branding panel on the login and register pages.
                                        </p>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <label className="text-xs text-gray-500 mb-1.5 block">Start Color</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="color"
                                                        value={values.auth_panel_from_color || '#047857'}
                                                        onChange={e => handleChange('auth_panel_from_color', e.target.value)}
                                                        onBlur={e => handleSave('auth_panel_from_color', e.target.value)}
                                                        className="w-10 h-9 rounded cursor-pointer border border-gray-300"
                                                    />
                                                    <input type="text"
                                                        value={values.auth_panel_from_color || '#047857'}
                                                        onChange={e => handleChange('auth_panel_from_color', e.target.value)}
                                                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs text-gray-500 mb-1.5 block">End Color</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="color"
                                                        value={values.auth_panel_to_color || '#0e7490'}
                                                        onChange={e => handleChange('auth_panel_to_color', e.target.value)}
                                                        onBlur={e => handleSave('auth_panel_to_color', e.target.value)}
                                                        className="w-10 h-9 rounded cursor-pointer border border-gray-300"
                                                    />
                                                    <input type="text"
                                                        value={values.auth_panel_to_color || '#0e7490'}
                                                        onChange={e => handleChange('auth_panel_to_color', e.target.value)}
                                                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="pt-5">
                                                <button
                                                    onClick={async () => {
                                                        await handleSave('auth_panel_from_color', values.auth_panel_from_color || '#047857')
                                                        await handleSave('auth_panel_to_color',   values.auth_panel_to_color   || '#0e7490')
                                                    }}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white
                                                               rounded-xl text-xs font-semibold hover:bg-blue-700 shrink-0">
                                                    <Save size={13} /> Save
                                                </button>
                                            </div>
                                        </div>
                                        {/* Preview swatch */}
                                        <div className="mt-3 h-8 rounded-xl"
                                            style={{ background: `linear-gradient(135deg, ${values.auth_panel_from_color || '#047857'}, ${values.auth_panel_to_color || '#0e7490'})` }}
                                        />
                                    </div>
                                )}

                                {/* ── Logo size ─────────────────────────────── */}
                                {activeSection === 'appearance' && (
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-gray-800 mb-1">Logo Size</h3>
                                        <p className="text-xs text-gray-400 mb-4">
                                            Width and height of the logo in the sidebar and login panel (pixels).
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <label className="text-xs text-gray-500 mb-1 block">Width (px)</label>
                                                <input
                                                    type="number"
                                                    min="16" max="96"
                                                    value={values.logo_width ?? '32'}
                                                    onChange={e => handleChange('logo_width', e.target.value)}
                                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                                                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs text-gray-500 mb-1 block">Height (px)</label>
                                                <input
                                                    type="number"
                                                    min="16" max="96"
                                                    value={values.logo_height ?? '32'}
                                                    onChange={e => handleChange('logo_height', e.target.value)}
                                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                                                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="pt-5">
                                                <button
                                                    onClick={async () => {
                                                        await handleSave('logo_width',  values.logo_width  ?? '32')
                                                        await handleSave('logo_height', values.logo_height ?? '32')
                                                    }}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white
                                                               rounded-xl text-xs font-semibold hover:bg-blue-700 shrink-0">
                                                    <Save size={13} /> Save
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Logo/favicon ──────────────────────────── */}
                                {activeSection === 'appearance' && (
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
                                    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                                        <h3 className="text-sm font-bold text-gray-800">Backup Actions</h3>
                                        <div className="grid sm:grid-cols-2 gap-3">
                                            <div className={`rounded-xl border p-4 ${values.backup_notify_email === 'true' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`h-2 w-2 rounded-full shrink-0 ${values.backup_notify_email === 'true' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                                    <span className="text-sm font-bold">Email Delivery</span>
                                                </div>
                                                <p className="text-xs opacity-80">
                                                    {values.backup_notify_email === 'true'
                                                        ? (values.backup_email_recipient || 'Recipient not set')
                                                        : 'Disabled — toggle "Notify via Email" above'}
                                                </p>
                                            </div>
                                            <div className={`rounded-xl border p-4 ${values.backup_notify_telegram === 'true' ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`h-2 w-2 rounded-full shrink-0 ${values.backup_notify_telegram === 'true' ? 'bg-sky-500' : 'bg-gray-300'}`} />
                                                    <span className="text-sm font-bold">Telegram Delivery</span>
                                                </div>
                                                <p className="text-xs opacity-80">
                                                    {values.backup_notify_telegram === 'true'
                                                        ? (values.backup_telegram_chat_id ? `Chat ID: ${values.backup_telegram_chat_id}` : 'Chat ID not set')
                                                        : 'Disabled — toggle "Notify via Telegram" above'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleRunBackup}
                                                disabled={backingUp}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-all">
                                                {backingUp
                                                    ? <><RefreshCw size={13} className="animate-spin" /> Running…</>
                                                    : <><Database size={14} /> Run Manual Backup</>
                                                }
                                            </button>
                                            <p className="text-xs text-gray-400">
                                                Automated backups run daily at {values.backup_time || '02:00'} when auto backup is enabled.
                                            </p>
                                        </div>
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
