import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Globe, Eye, Layout, Settings, FileText, Star, Sparkles,
    Save, RefreshCw, ToggleLeft, ToggleRight, ExternalLink, Layers,
    ImagePlus, X, Upload,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import api from '../../lib/api'
import { FEATURE_DEFAULTS, FEATURE_ICONS } from '../../lib/publicFeatures'

const TABS = [
    { key: 'hero',     label: 'Hero Slider',  icon: Layout   },
    { key: 'sections', label: 'Sections',     icon: Settings },
    { key: 'steps',    label: 'How It Works', icon: FileText },
    { key: 'features', label: 'Capabilities', icon: Sparkles },
    { key: 'cta',      label: 'CTA & More',   icon: Star     },
]

const SLIDE_DEFAULTS = [
    {
        eyebrow:    '',
        heading:    'Accelerate Your',
        highlight:  'Research Journey',
        subtitle:   'Submit proposals, collaborate with peers, and manage grants — all in one platform built for academic excellence.',
        cta1_text:  'Explore Open Calls',
        cta1_href:  '/proposal-calls/public',
        cta2_text:  'Track Proposal',
        cta2_href:  '/tracker',
        color:      '',
        icon:       '🔬',
    },
    {
        eyebrow:    'Research Funding',
        heading:    'Unlock Research',
        highlight:  'Funding Opportunities',
        subtitle:   'Competitive grants, milestone-based disbursements, and award letters to fuel your research ambitions.',
        cta1_text:  'View Open Calls',
        cta1_href:  '/proposal-calls/public',
        cta2_text:  'Submit a Proposal',
        cta2_href:  '/proposal-calls/public',
        color:      '#10b981',
        icon:       '💰',
    },
    {
        eyebrow:    'Peer Evaluation',
        heading:    'Rigorous & Fair',
        highlight:  'Peer Review Process',
        subtitle:   'Expert blind review, open defence scoring, and central committee evaluation — transparent and objective.',
        cta1_text:  'Start Your Application',
        cta1_href:  '/proposal-calls/public',
        cta2_text:  'Track Your Proposal',
        cta2_href:  '/tracker',
        color:      '#f59e0b',
        icon:       '⚖️',
    },
    {
        eyebrow:    'Research Lifecycle',
        heading:    'End-to-End',
        highlight:  'Research Support',
        subtitle:   'From ethics clearance to midterm evaluation and project closure — comprehensive institutional support.',
        cta1_text:  'Get Started Today',
        cta1_href:  '/proposal-calls/public',
        cta2_text:  'Explore Platform',
        cta2_href:  '/tracker',
        color:      '#8b5cf6',
        icon:       '🏛️',
    },
]

const SLIDER_FIELDS = ['eyebrow', 'heading', 'highlight', 'subtitle', 'cta1_text', 'cta1_href', 'cta2_text', 'cta2_href', 'color', 'icon']

const DEFAULTS = {
    // Legacy single-hero keys (kept for backwards compat)
    public_hero_badge:         '',
    public_hero_heading:       'Turn Research Ideas Into',
    public_hero_highlight:     'Funded Reality',
    public_hero_subtitle:      'Submit proposals, track progress, and manage grants — all in one platform built for university excellence.',
    public_hero_cta_primary:   'Explore Open Calls',
    public_hero_cta_secondary: 'Track Your Proposal',
    // Slider slides
    ...Object.fromEntries(
        SLIDE_DEFAULTS.flatMap((slide, i) =>
            SLIDER_FIELDS.map(f => [`slider_slide_${i + 1}_${f}`, slide[f]])
        )
    ),
    public_show_stats:         'true',
    public_show_open_calls:    'true',
    public_show_how_it_works:  'true',
    public_show_features:      'true',
    public_show_cta:           'true',
    public_step_1_title:       'Submit Proposal',
    public_step_1_desc:        'Complete the guided wizard with your research details, team, budget, and documents before the call closes.',
    public_step_2_title:       'Validation',
    public_step_2_desc:        'The research office checks completeness and eligibility, and an anonymity check protects blind review.',
    public_step_3_title:       'Blind Review',
    public_step_3_desc:        'Independent experts score your proposal without knowing who wrote it.',
    public_step_4_title:       'Open Defence',
    public_step_4_desc:        'Shortlisted teams present to a panel that scores the presentation on the day.',
    public_step_5_title:       'Central Evaluation',
    public_step_5_desc:        'The central committee weighs the combined scores and makes the funding decision.',
    public_step_6_title:       'Funding & Monitoring',
    public_step_6_desc:        'Funded teams sign a contract, receive their budget, and report progress regularly until completion.',
    ...Object.fromEntries(
        FEATURE_DEFAULTS.flatMap((f, i) => [
            [`public_feature_${i + 1}_title`, f.title],
            [`public_feature_${i + 1}_desc`,  f.desc],
            [`public_feature_${i + 1}_icon`,  f.icon],
            [`public_feature_${i + 1}_show`,  'true'],
        ])
    ),
    public_header_subtitle:    'Research & Technology Transfer',
    public_features_title:     'Everything You Need to Manage Research',
    public_features_subtitle:  'A complete platform for the full research lifecycle, built for academic institutions.',
    public_cta_title:          'Ready to Start Your Research Journey?',
    public_cta_subtitle:       '',
    public_cta_primary:        'View Open Calls',
    public_cta_secondary:      'Track Your Proposal',
}

// ─── Slide image upload ───────────────────────────────────────────────────────

function SlideImageUpload({ slideIndex, settings, onUploaded }) {
    const { success, error } = useToast()
    const inputRef   = useRef(null)
    const [uploading, setUploading] = useState(false)
    const settingKey = `slider_slide_${slideIndex}_image`
    const currentUrl = settings[settingKey] || null

    const handleFile = async (file) => {
        if (!file) return
        setUploading(true)
        try {
            const form = new FormData()
            form.append('file', file)
            form.append('key', settingKey)
            const res = await api.post('/settings/upload-asset', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            onUploaded(settingKey, res.data?.data?.url)
            success('Image uploaded.')
        } catch {
            error('Upload failed. Max 5 MB, JPEG/PNG/WebP only.')
        } finally {
            setUploading(false)
        }
    }

    const handleRemove = async () => {
        try {
            await api.put(`/settings/app/${settingKey}`, { value: '' })
            onUploaded(settingKey, '')
            success('Image removed.')
        } catch {
            error('Failed to remove image.')
        }
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800">Background Image</label>
            <p className="text-xs text-slate-400">
                Full-screen photo background. Recommended: <strong>1920 × 700 px</strong> landscape. Leave empty to use the animated gradient. Max 5 MB · JPEG, PNG, WebP.
            </p>

            {currentUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 h-36 group">
                    <img src={currentUrl} alt="Slide background" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity
                                    flex items-center justify-center gap-3">
                        <button
                            onClick={() => inputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-gray-800
                                       hover:bg-gray-100 transition-colors disabled:opacity-50">
                            <Upload size={12} /> Replace
                        </button>
                        <button
                            onClick={handleRemove}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 rounded-lg text-xs font-semibold text-white
                                       hover:bg-red-700 transition-colors">
                            <X size={12} /> Remove
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed
                               border-gray-200 rounded-xl text-slate-400 hover:border-blue-400 hover:text-blue-500
                               hover:bg-blue-50/50 transition-all disabled:opacity-50">
                    {uploading
                        ? <RefreshCw size={20} className="animate-spin" />
                        : <ImagePlus size={20} />}
                    <span className="text-xs font-medium">
                        {uploading ? 'Uploading…' : 'Click to upload (1920 × 700 px recommended)'}
                    </span>
                    <span className="text-[10px] text-slate-300">JPEG, PNG, WebP · max 5 MB</span>
                </button>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0])}
            />
        </div>
    )
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({ label, hint, fieldKey, multiline, placeholder, settings, saving, onChange, onSave }) {
    return (
        <div className="space-y-1.5">
            <div>
                <label className="text-sm font-medium text-slate-800">{label}</label>
                {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
            </div>
            <div className="flex gap-2">
                {multiline ? (
                    <textarea
                        value={settings[fieldKey] ?? ''}
                        onChange={e => onChange(fieldKey, e.target.value)}
                        rows={3}
                        placeholder={placeholder || `Enter ${label.toLowerCase()}…`}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                ) : (
                    <input
                        type="text"
                        value={settings[fieldKey] ?? ''}
                        onChange={e => onChange(fieldKey, e.target.value)}
                        placeholder={placeholder || `Enter ${label.toLowerCase()}…`}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                )}
                <button
                    onClick={() => onSave(fieldKey, settings[fieldKey])}
                    disabled={saving[fieldKey]}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl
                               text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shrink-0 transition-colors">
                    {saving[fieldKey]
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <Save size={12} />}
                    {saving[fieldKey] ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    )
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ label, desc, fieldKey, settings, onToggle }) {
    const on = settings[fieldKey] === 'true'
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0">
            <div>
                <p className="text-sm font-medium text-slate-900">{label}</p>
                {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
            </div>
            <button
                onClick={() => onToggle(fieldKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    on ? 'bg-green-100 text-green-700 hover:bg-green-200'
                       : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {on ? <><ToggleRight size={15} /> Visible</> : <><ToggleLeft size={15} /> Hidden</>}
            </button>
        </div>
    )
}

// ─── Icon picker (saves on click) ─────────────────────────────────────────────

function IconPicker({ fieldKey, settings, onChange, onSave }) {
    const current = settings[fieldKey]
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800">Icon</label>
            <div className="flex flex-wrap gap-1.5">
                {Object.entries(FEATURE_ICONS).map(([name, Icon]) => (
                    <button
                        key={name}
                        type="button"
                        title={name}
                        aria-label={name}
                        aria-pressed={current === name}
                        onClick={() => { onChange(fieldKey, name); onSave(fieldKey, name) }}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                            current === name
                                ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-100'
                                : 'border-gray-200 text-slate-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}>
                        <Icon size={16} />
                    </button>
                ))}
            </div>
        </div>
    )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div>
                <div className="font-semibold text-slate-900 flex items-center gap-2">{title}</div>
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {children}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicSite() {
    const [settings, setSettings] = useState({ ...DEFAULTS })
    const [loading,  setLoading]  = useState(true)
    const [saving,   setSaving]   = useState({})
    const [tab,      setTab]      = useState('hero')
    const { success, error }      = useToast()

    useEffect(() => {
        api.get('/settings/app')
            .then((r) => {
                const flat = {}
                Object.values(r.data?.data ?? {}).forEach(group => {
                    Object.entries(group).forEach(([key, item]) => {
                        flat[key] = typeof item === 'object' && item !== null ? item.value : item
                    })
                })
                setSettings(prev => ({ ...prev, ...flat }))
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const handleChange = useCallback((key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }, [])

    const handleSave = useCallback(async (key, value) => {
        setSaving(prev => ({ ...prev, [key]: true }))
        try {
            await api.put(`/settings/app/${key}`, { value: String(value ?? '') })
            success('Saved')
        } catch {
            error('Failed to save')
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }))
        }
    }, [success, error])

    const handleToggle = useCallback((key) => {
        const next = settings[key] === 'true' ? 'false' : 'true'
        setSettings(prev => ({ ...prev, [key]: next }))
        handleSave(key, next)
    }, [settings, handleSave])

    const fieldProps = { settings, saving, onChange: handleChange, onSave: handleSave }

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </AppLayout>
        )
    }

    return (
        <AppLayout>
            <div className="max-w-3xl mx-auto px-4 py-8">

                {/* Page header */}
                <div className="flex items-start flex-wrap justify-between mb-8 gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Globe size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Public Site</h1>
                            <p className="text-sm text-slate-500">Manage your public homepage content</p>
                        </div>
                    </div>
                    <a href="/" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl
                                   text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <Eye size={14} /> Preview <ExternalLink size={12} className="text-gray-400" />
                    </a>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-lg
                                        text-sm font-medium transition-all ${
                                tab === t.key
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}>
                            <t.icon size={14} />
                            <span className="hidden sm:inline">{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Hero Slider tab ── */}
                {tab === 'hero' && (
                    <div className="space-y-4">
                        {/* Info banner */}
                        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                            <Layers size={16} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 leading-relaxed">
                                The hero slider auto-rotates through 4 slides. Each slide has its own heading, subtitle, buttons, and accent color.
                                Leave <strong>Eyebrow</strong> empty to use the default (organization name).
                                Leave <strong>Color</strong> empty on Slide 1 to use the platform primary color.
                            </p>
                        </div>

                        {SLIDE_DEFAULTS.map((_, si) => {
                            const n = si + 1
                            const key = f => `slider_slide_${n}_${f}`
                            const slideColor = settings[key('color')] || SLIDE_DEFAULTS[si].color || '#6366f1'
                            return (
                                <Card
                                    key={n}
                                    title={
                                        <span className="flex items-center gap-2">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-white text-xs font-bold"
                                                style={{ background: slideColor }}>
                                                {n}
                                            </span>
                                            Slide {n} — {settings[key('highlight')] || SLIDE_DEFAULTS[si].highlight}
                                        </span>
                                    }
                                    subtitle={`Icon: ${settings[key('icon')] || SLIDE_DEFAULTS[si].icon}`}
                                >
                                    <SlideImageUpload
                                        slideIndex={n}
                                        settings={settings}
                                        onUploaded={(k, url) => setSettings(prev => ({ ...prev, [k]: url }))}
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <Field label="Icon (emoji)"
                                            hint="Single emoji displayed on the stat card."
                                            fieldKey={key('icon')}
                                            placeholder={SLIDE_DEFAULTS[si].icon}
                                            {...fieldProps} />
                                        <Field label="Accent Color"
                                            hint="Hex color for orbs, gradient, and stat card."
                                            fieldKey={key('color')}
                                            placeholder={SLIDE_DEFAULTS[si].color || 'Leave empty for primary color'}
                                            {...fieldProps} />
                                    </div>
                                    <Field label="Eyebrow"
                                        hint="Small badge text above the headline."
                                        fieldKey={key('eyebrow')}
                                        placeholder={`e.g. ${settings.organization_name || 'University'} · Research Platform`}
                                        {...fieldProps} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <Field label="Heading (plain text)"
                                            hint="First line of the headline."
                                            fieldKey={key('heading')}
                                            placeholder={SLIDE_DEFAULTS[si].heading}
                                            {...fieldProps} />
                                        <Field label="Highlight (gradient text)"
                                            hint="Second line shown in the accent color gradient."
                                            fieldKey={key('highlight')}
                                            placeholder={SLIDE_DEFAULTS[si].highlight}
                                            {...fieldProps} />
                                    </div>
                                    <Field label="Subtitle"
                                        hint="Supporting paragraph below the headline."
                                        fieldKey={key('subtitle')}
                                        multiline
                                        placeholder={SLIDE_DEFAULTS[si].subtitle}
                                        {...fieldProps} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <Field label="Primary Button Label"
                                            fieldKey={key('cta1_text')}
                                            placeholder={SLIDE_DEFAULTS[si].cta1_text}
                                            {...fieldProps} />
                                        <Field label="Primary Button Link"
                                            fieldKey={key('cta1_href')}
                                            placeholder={SLIDE_DEFAULTS[si].cta1_href}
                                            {...fieldProps} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <Field label="Secondary Button Label"
                                            fieldKey={key('cta2_text')}
                                            placeholder={SLIDE_DEFAULTS[si].cta2_text}
                                            {...fieldProps} />
                                        <Field label="Secondary Button Link"
                                            fieldKey={key('cta2_href')}
                                            placeholder={SLIDE_DEFAULTS[si].cta2_href}
                                            {...fieldProps} />
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                )}

                {/* ── Sections tab ── */}
                {tab === 'sections' && (
                    <Card title="Section Visibility" subtitle="Show or hide each section on the public homepage.">
                        <Toggle label="Statistics Strip"
                            desc="Animated counters showing proposals, funded projects, colleges, and publications."
                            fieldKey="public_show_stats"
                            settings={settings} onToggle={handleToggle} />
                        <Toggle label="Open Calls"
                            desc="Grid of active proposal calls open for applications."
                            fieldKey="public_show_open_calls"
                            settings={settings} onToggle={handleToggle} />
                        <Toggle label="How It Works"
                            desc="Four-step process overview from submission to funding."
                            fieldKey="public_show_how_it_works"
                            settings={settings} onToggle={handleToggle} />
                        <Toggle label="Platform Features"
                            desc="Dark feature grid showcasing the platform's capabilities."
                            fieldKey="public_show_features"
                            settings={settings} onToggle={handleToggle} />
                        <Toggle label="CTA Banner"
                            desc="Call-to-action section at the bottom of the page."
                            fieldKey="public_show_cta"
                            settings={settings} onToggle={handleToggle} />
                    </Card>
                )}

                {/* ── How It Works tab ── */}
                {tab === 'steps' && (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <Card key={i} title={`Step ${i}`}>
                                <Field label="Title"
                                    fieldKey={`public_step_${i}_title`}
                                    placeholder={`Step ${i} title…`}
                                    {...fieldProps} />
                                <Field label="Description"
                                    fieldKey={`public_step_${i}_desc`}
                                    multiline
                                    placeholder="Describe this step…"
                                    {...fieldProps} />
                            </Card>
                        ))}
                    </div>
                )}

                {/* ── Capabilities tab ── */}
                {tab === 'features' && (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 px-1">
                            The cards in the dark "Platform Capabilities" section. Hide a card to remove it; leave a field empty to use the default text.
                            The section heading and subtitle are under CTA &amp; More.
                        </p>
                        {FEATURE_DEFAULTS.map((d, idx) => {
                            const i = idx + 1
                            return (
                                <Card key={i} title={`Card ${i}`} subtitle={`Default: ${d.title}`}>
                                    <Toggle label="Show on homepage" fieldKey={`public_feature_${i}_show`}
                                        settings={settings} onToggle={handleToggle} />
                                    <Field label="Title"
                                        fieldKey={`public_feature_${i}_title`}
                                        placeholder={d.title}
                                        {...fieldProps} />
                                    <Field label="Description"
                                        fieldKey={`public_feature_${i}_desc`}
                                        multiline
                                        placeholder={d.desc}
                                        {...fieldProps} />
                                    <IconPicker fieldKey={`public_feature_${i}_icon`} {...fieldProps} />
                                </Card>
                            )
                        })}
                    </div>
                )}

                {/* ── CTA & More tab ── */}
                {tab === 'cta' && (
                    <div className="space-y-4">
                        <Card title="Features Section" subtitle="Text shown above the platform capabilities grid.">
                            <Field label="Section Heading"
                                fieldKey="public_features_title"
                                placeholder="e.g. Everything You Need to Manage Research"
                                {...fieldProps} />
                            <Field label="Section Subtitle"
                                fieldKey="public_features_subtitle"
                                multiline
                                placeholder="Brief description…"
                                {...fieldProps} />
                        </Card>

                        <Card title="CTA Banner" subtitle="The call-to-action section at the bottom of the homepage.">
                            <Field label="Headline"
                                fieldKey="public_cta_title"
                                placeholder="e.g. Ready to Start Your Research Journey?"
                                {...fieldProps} />
                            <Field label="Subtitle"
                                fieldKey="public_cta_subtitle"
                                multiline
                                placeholder="Supporting description…"
                                {...fieldProps} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <Field label="Primary Button"
                                    fieldKey="public_cta_primary"
                                    placeholder="e.g. View Open Calls"
                                    {...fieldProps} />
                                <Field label="Secondary Button"
                                    fieldKey="public_cta_secondary"
                                    placeholder="e.g. Track Your Proposal"
                                    {...fieldProps} />
                            </div>
                        </Card>

                        <Card title="Header" subtitle="The line under the university name, next to the logo.">
                            <Field label="Subtitle under the university name"
                                fieldKey="public_header_subtitle"
                                placeholder="Research & Technology Transfer"
                                {...fieldProps} />
                        </Card>

                        <Card title="Footer & Branding">
                            <p className="text-sm text-slate-500">
                                Footer text, logo, colors, and branding are managed in{' '}
                                <a href="/admin/settings" className="text-blue-600 hover:underline font-medium">
                                    Settings → Appearance
                                </a>.
                            </p>
                        </Card>
                    </div>
                )}

            </div>
        </AppLayout>
    )
}
