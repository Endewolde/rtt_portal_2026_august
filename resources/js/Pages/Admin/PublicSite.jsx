import { useState, useEffect, useCallback } from 'react'
import {
    Globe, Eye, Layout, Settings, FileText, Star,
    Save, RefreshCw, ToggleLeft, ToggleRight, ExternalLink,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import api from '../../lib/api'

const TABS = [
    { key: 'hero',     label: 'Hero',         icon: Layout   },
    { key: 'sections', label: 'Sections',     icon: Settings },
    { key: 'steps',    label: 'How It Works', icon: FileText },
    { key: 'cta',      label: 'CTA & More',   icon: Star     },
]

const DEFAULTS = {
    public_hero_badge:         '',
    public_hero_heading:       'Turn Research Ideas Into',
    public_hero_highlight:     'Funded Reality',
    public_hero_subtitle:      'Submit proposals, track progress, and manage grants — all in one platform built for university excellence.',
    public_hero_cta_primary:   'Explore Open Calls',
    public_hero_cta_secondary: 'Track Your Proposal',
    public_show_stats:         'true',
    public_show_open_calls:    'true',
    public_show_how_it_works:  'true',
    public_show_features:      'true',
    public_show_cta:           'true',
    public_step_1_title:       'Submit Proposal',
    public_step_1_desc:        'Complete the 7-step wizard with your research details, team, and budget.',
    public_step_2_title:       'Validation',
    public_step_2_desc:        'Central Office reviews completeness and assigns it to the review pipeline.',
    public_step_3_title:       'Peer Review & Defence',
    public_step_3_desc:        'Expert reviewers score your proposal. Top proposals advance to open defence.',
    public_step_4_title:       'Funding & Support',
    public_step_4_desc:        'Accepted proposals receive funding and ongoing M&E support.',
    public_features_title:     'Everything You Need to Manage Research',
    public_features_subtitle:  'A complete platform for the full research lifecycle, built for academic institutions.',
    public_cta_title:          'Ready to Start Your Research Journey?',
    public_cta_subtitle:       '',
    public_cta_primary:        'View Open Calls',
    public_cta_secondary:      'Track Your Proposal',
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

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div>
                <h2 className="font-semibold text-slate-900">{title}</h2>
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
                <div className="flex items-start justify-between mb-8">
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

                {/* ── Hero tab ── */}
                {tab === 'hero' && (
                    <Card title="Hero Section" subtitle="Customize the main text and buttons shown at the top of the homepage.">
                        <Field label="Badge Text"
                            hint="Small chip shown above the headline."
                            fieldKey="public_hero_badge"
                            placeholder={`e.g. ${settings.organization_name || 'University'} · Research Platform`}
                            {...fieldProps} />
                        <Field label="Main Heading"
                            hint="First part of the headline (plain text)."
                            fieldKey="public_hero_heading"
                            placeholder="e.g. Turn Research Ideas Into"
                            {...fieldProps} />
                        <Field label="Highlighted Words"
                            hint="Second part of the headline shown in gradient color."
                            fieldKey="public_hero_highlight"
                            placeholder="e.g. Funded Reality"
                            {...fieldProps} />
                        <Field label="Subtitle"
                            hint="Supporting paragraph below the headline."
                            fieldKey="public_hero_subtitle"
                            multiline
                            placeholder="Enter a compelling description…"
                            {...fieldProps} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <Field label="Primary Button"
                                fieldKey="public_hero_cta_primary"
                                placeholder="e.g. Explore Open Calls"
                                {...fieldProps} />
                            <Field label="Secondary Button"
                                fieldKey="public_hero_cta_secondary"
                                placeholder="e.g. Track Your Proposal"
                                {...fieldProps} />
                        </div>
                    </Card>
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
                        {[1, 2, 3, 4].map(i => (
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
