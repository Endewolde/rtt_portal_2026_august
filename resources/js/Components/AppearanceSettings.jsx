import { useState, useEffect, useMemo, useRef } from 'react'
import { Image, Palette, Type, SlidersHorizontal, Save, Loader2, Sparkles, ChevronDown, Eye, Wand2, Check, Sun, Moon, Monitor } from 'lucide-react'
import { FOOTER_TOKENS, resolveFooterText, hasFixedCurrentYear } from '../lib/footerText'
import { applyTheme, getThemePreference } from '../lib/theme'

/** Every setting this panel edits, by section — each section saves only what changed in it. */
const SECTION_KEYS = {
    brand: ['logo_width', 'logo_height'],
    colors: ['primary_color', 'secondary_color', 'sidebar_color', 'auth_panel_from_color', 'auth_panel_to_color'],
    text: ['system_tagline', 'login_institution_text', 'footer_text'],
}

const SIDEBAR_SWATCHES = ['#0f172a', '#1e1b4b', '#1a4075', '#0c4a6e', '#134e4a', '#14532d', '#1f2937', '#7f1d1d', '#ffffff', '#f8fafc']

const DEFAULTS = {
    primary_color: '#2563eb', secondary_color: '#7c3aed', sidebar_color: '#0f172a',
    auth_panel_from_color: '#047857', auth_panel_to_color: '#0e7490', logo_width: '32', logo_height: '32',
}

const isDark = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
    if (!m) return true
    const n = parseInt(m[1], 16)
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 150
}

function Section({ icon: Icon, tone, title, description, dirty, saving, onSave, children }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
                <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
                    </div>
                </div>
                {onSave && (
                    <button onClick={onSave} disabled={!dirty || saving}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : dirty ? <Save size={13} /> : <Check size={13} />}
                        {dirty ? 'Save changes' : 'Saved'}
                    </button>
                )}
            </header>
            <div className="space-y-5 p-5">{children}</div>
        </section>
    )
}

function Field({ label, hint, children }) {
    return (
        <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">{label}</label>
            {children}
            {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
        </div>
    )
}

const inputClass = 'w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function ColorInput({ label, value, onChange }) {
    return (
        <Field label={label}>
            <div className="flex items-center gap-2 rounded-xl border border-gray-300 p-1.5 pr-3 focus-within:ring-2 focus-within:ring-blue-500">
                <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-black/10" style={{ backgroundColor: value }}>
                    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={label} />
                </label>
                <input value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-gray-800 focus:outline-none" />
            </div>
        </Field>
    )
}

function SizeInput({ label, value, onChange }) {
    return (
        <Field label={label}>
            <div className="flex items-center gap-3">
                <input type="range" min="16" max="96" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 accent-blue-600" />
                <div className="flex w-20 items-center rounded-xl border border-gray-300 px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
                    <input type="number" min="16" max="96" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm focus:outline-none" />
                    <span className="text-xs text-gray-400">px</span>
                </div>
            </div>
        </Field>
    )
}

const THEMES = [
    { value: 'light', label: 'Light', icon: Sun, hint: 'Bright pages for everyone', page: '#f9fafb', card: '#ffffff', line: '#e5e7eb' },
    { value: 'dark', label: 'Dark', icon: Moon, hint: 'Dark pages for everyone', page: '#030712', card: '#0f172b', line: '#1e2939' },
    { value: 'system', label: 'System', icon: Monitor, hint: "Follows each person's device", page: 'linear-gradient(90deg,#f9fafb 50%,#030712 50%)', card: 'linear-gradient(90deg,#ffffff 50%,#0f172b 50%)', line: '#9ca3af' },
]

/** Light, dark or the device's choice — saved as soon as it is picked, applied on the next page load. */
function ThemePicker({ value, onPick, saving }) {
    return (
        <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map(({ value: v, label, icon: Icon, hint, page, card, line }) => {
                const active = (value || 'light') === v
                return (
                    <button key={v} type="button" onClick={() => !active && onPick(v)} disabled={saving}
                        className={`rounded-2xl border-2 p-3 text-left transition ${active ? 'border-blue-600 ring-4 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="h-20 overflow-hidden rounded-xl border border-gray-200 p-2" style={{ background: page }}>
                            <div className="h-full rounded-lg p-2" style={{ background: card, border: `1px solid ${line}` }}>
                                <div className="h-1.5 w-1/2 rounded-full" style={{ background: line }} />
                                <div className="mt-1.5 h-1.5 w-3/4 rounded-full" style={{ background: line }} />
                                <div className="mt-2 h-3 w-10 rounded bg-blue-600" />
                            </div>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                            <Icon size={15} className={active ? 'text-blue-600' : 'text-gray-500'} />
                            <span className="text-sm font-semibold text-gray-900">{label}</span>
                            {active && <Check size={14} className="ml-auto text-blue-600" />}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
                    </button>
                )
            })}
        </div>
    )
}

/** A small mock of the app with the current choices, so changes are visible before saving. */
function LivePreview({ v }) {
    const sidebarText = isDark(v.sidebar_color) ? '#fff' : '#0f172a'
    const footer = resolveFooterText(v.footer_text, v)
    const logo = v.system_logo
    const size = Math.min(40, Math.max(18, parseInt(v.logo_width, 10) || 32))

    return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                <Eye size={15} className="text-gray-400" />
                <span className="text-sm font-bold text-gray-900">Live preview</span>
                <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">Unsaved changes included</span>
            </div>
            <div className="p-4">
                {/* App shell */}
                <div className="flex h-56 overflow-hidden rounded-xl border border-gray-200">
                    <div className="flex w-[38%] flex-col gap-2 p-3" style={{ backgroundColor: v.sidebar_color, color: sidebarText }}>
                        <div className="flex items-center gap-2">
                            {logo
                                ? <img src={logo} alt="" style={{ width: size, height: size }} className="shrink-0 rounded object-contain" />
                                : <span className="shrink-0 rounded bg-white/20" style={{ width: size, height: size }} />}
                            <div className="min-w-0">
                                <div className="truncate text-[11px] font-bold">{v.system_name || 'RTT'}</div>
                                <div className="truncate text-[9px] opacity-60">{v.system_tagline || 'Research & Tech Transfer'}</div>
                            </div>
                        </div>
                        {[70, 55, 62, 48].map((w, i) => (
                            <div key={i} className="flex items-center gap-1.5 rounded-md px-1.5 py-1" style={i === 0 ? { backgroundColor: v.primary_color, color: '#fff' } : {}}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                                <span className="h-1.5 rounded-full bg-current opacity-40" style={{ width: `${w}%` }} />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-1 flex-col bg-gray-50">
                        <div className="h-7 border-b border-gray-200 bg-white" />
                        <div className="flex-1 space-y-2 p-3">
                            <div className="h-2 w-1/2 rounded-full bg-gray-300" />
                            <div className="h-1.5 w-3/4 rounded-full bg-gray-200" />
                            <div className="flex gap-1.5 pt-1">
                                <span className="rounded-md px-2 py-1 text-[9px] font-semibold text-white" style={{ backgroundColor: v.primary_color }}>Primary</span>
                                <span className="rounded-md px-2 py-1 text-[9px] font-semibold text-white" style={{ backgroundColor: v.secondary_color }}>Secondary</span>
                            </div>
                        </div>
                        <div className="truncate border-t border-gray-200 bg-white px-2 py-1.5 text-center text-[9px] text-gray-400" title={footer}>{footer || '—'}</div>
                    </div>
                </div>

                {/* Login panel */}
                <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Login page panel</p>
                <div className="flex h-20 flex-col justify-end rounded-xl p-3 text-white"
                    style={{ background: `linear-gradient(135deg, ${v.auth_panel_from_color}, ${v.auth_panel_to_color})` }}>
                    <div className="truncate text-[10px] opacity-80">{v.login_institution_text || `${v.organization_name || 'University'} — Research & Technology Transfer Office`}</div>
                </div>
            </div>
        </div>
    )
}

/**
 * The Appearance settings: brand assets, colours and wording, each saved per section,
 * with a live preview. The theme applies at once; homepage banner and custom CSS keep their usual fields.
 */
export default function AppearanceSettings({ values, onChange, onSaveMany, renderLogoUpload, renderField }) {
    const footerRef = useRef(null)
    const [baseline, setBaseline] = useState(null)
    const [saving, setSaving] = useState(null)
    const [advancedOpen, setAdvancedOpen] = useState(false)

    const allKeys = useMemo(() => Object.values(SECTION_KEYS).flat(), [])
    useEffect(() => {
        if (!baseline && Object.keys(values).length > 0) {
            setBaseline(Object.fromEntries(allKeys.map((k) => [k, values[k] ?? ''])))
        }
    }, [values, baseline, allKeys])

    // Values as shown, with sensible fallbacks for unset colours and sizes.
    const v = useMemo(() => {
        const out = { ...values }
        Object.entries(DEFAULTS).forEach(([k, d]) => { if (!out[k]) out[k] = d })
        return out
    }, [values])

    const changed = (section) => baseline !== null && SECTION_KEYS[section].filter((k) => (values[k] ?? '') !== (baseline[k] ?? ''))
    const save = async (section) => {
        const keys = changed(section)
        if (!keys?.length) return
        setSaving(section)
        const saved = await onSaveMany(Object.fromEntries(keys.map((k) => [k, values[k] ?? ''])))
        if (saved) setBaseline((b) => ({ ...b, ...Object.fromEntries(keys.map((k) => [k, values[k] ?? ''])) }))
        setSaving(null)
    }

    const insertToken = (token) => {
        const el = footerRef.current
        const text = values.footer_text ?? ''
        const at = el?.selectionStart ?? text.length
        const next = text.slice(0, at) + token + text.slice(el?.selectionEnd ?? at)
        onChange('footer_text', next)
        requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length) })
    }
    const currentYear = new Date().getFullYear()

    return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-5">
                <Section icon={Sun} tone="bg-amber-100 text-amber-600" title="Theme"
                    description="The theme everyone starts with. People can still pick their own from their account menu.">
                    <ThemePicker value={values.theme} saving={saving === 'theme'} onPick={async (t) => {
                        const before = values.theme
                        onChange('theme', t)
                        setSaving('theme')
                        if (await onSaveMany({ theme: t })) {
                            // Your own screen keeps your personal theme, if you chose one.
                            document.documentElement.dataset.orgTheme = t
                            applyTheme(getThemePreference(), t)
                        } else {
                            onChange('theme', before)
                        }
                        setSaving(null)
                    }} />
                </Section>

                <Section icon={Image} tone="bg-sky-100 text-sky-600" title="Brand assets"
                    description="Your logo and browser icon, and how large the logo appears in the sidebar and login panel."
                    dirty={changed('brand')?.length > 0} saving={saving === 'brand'} onSave={() => save('brand')}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {renderLogoUpload('system_logo')}
                        {renderLogoUpload('favicon')}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <SizeInput label="Logo width" value={v.logo_width} onChange={(x) => onChange('logo_width', x)} />
                        <SizeInput label="Logo height" value={v.logo_height} onChange={(x) => onChange('logo_height', x)} />
                    </div>
                    <p className="text-xs text-gray-400">Logo and favicon save as soon as you upload them.</p>
                </Section>

                <Section icon={Palette} tone="bg-pink-100 text-pink-600" title="Colours"
                    description="Brand colours for buttons and highlights, the sidebar, and the login page panel."
                    dirty={changed('colors')?.length > 0} saving={saving === 'colors'} onSave={() => save('colors')}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <ColorInput label="Primary colour" value={v.primary_color} onChange={(x) => onChange('primary_color', x)} />
                        <ColorInput label="Secondary colour" value={v.secondary_color} onChange={(x) => onChange('secondary_color', x)} />
                    </div>
                    <div>
                        <ColorInput label="Sidebar colour" value={v.sidebar_color} onChange={(x) => onChange('sidebar_color', x)} />
                        <div className="mt-2 flex flex-wrap gap-2">
                            {SIDEBAR_SWATCHES.map((c) => (
                                <button key={c} type="button" title={c} onClick={() => onChange('sidebar_color', c)}
                                    className={`h-7 w-7 rounded-lg ring-1 ring-black/10 transition hover:scale-110 ${v.sidebar_color?.toLowerCase() === c ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
                                    style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <ColorInput label="Login panel — start" value={v.auth_panel_from_color} onChange={(x) => onChange('auth_panel_from_color', x)} />
                            <ColorInput label="Login panel — end" value={v.auth_panel_to_color} onChange={(x) => onChange('auth_panel_to_color', x)} />
                        </div>
                        <div className="mt-2 h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${v.auth_panel_from_color}, ${v.auth_panel_to_color})` }} />
                    </div>
                </Section>

                <Section icon={Type} tone="bg-violet-100 text-violet-600" title="Wording"
                    description="Short texts shown in the sidebar, on the login page and in the footer of every page."
                    dirty={changed('text')?.length > 0} saving={saving === 'text'} onSave={() => save('text')}>
                    <Field label="Sidebar tagline" hint="Shown under the system name in the sidebar.">
                        <input value={values.system_tagline ?? ''} onChange={(e) => onChange('system_tagline', e.target.value)} placeholder="Research & Tech Transfer" className={inputClass} />
                    </Field>
                    <Field label="Login panel text" hint="Shown at the bottom of the login and register panel.">
                        <input value={values.login_institution_text ?? ''} onChange={(e) => onChange('login_institution_text', e.target.value)}
                            placeholder={`${values.organization_name || 'University'} — Research & Technology Transfer Office`} className={inputClass} />
                    </Field>
                    <Field label="Footer text">
                        <input ref={footerRef} value={values.footer_text ?? ''} onChange={(e) => onChange('footer_text', e.target.value)}
                            placeholder="© {year} {system}. All rights reserved." className={inputClass} />
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-gray-500">Insert:</span>
                            {FOOTER_TOKENS.map(({ token, label }) => (
                                <button key={token} type="button" onClick={() => insertToken(token)} title={label}
                                    className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] font-semibold text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                                    {token}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Shows as</p>
                            <p className="mt-0.5 text-sm text-gray-800">{resolveFooterText(values.footer_text, values) || '—'}</p>
                        </div>
                        {hasFixedCurrentYear(values.footer_text) && (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                                <span>The year <b>{currentYear}</b> is typed in, so it won't change next year.</span>
                                <button type="button"
                                    onClick={() => onChange('footer_text', (values.footer_text ?? '').replace(new RegExp(`\\b${currentYear}\\b`, 'g'), '{year}'))}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-700">
                                    <Wand2 size={12} /> Make the year automatic
                                </button>
                            </div>
                        )}
                    </Field>
                </Section>

                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <button type="button" onClick={() => setAdvancedOpen((o) => !o)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600"><SlidersHorizontal size={17} /></span>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-gray-900">Advanced</h3>
                            <p className="mt-0.5 text-xs text-gray-500">Homepage banner and custom CSS.</p>
                        </div>
                        <ChevronDown size={16} className={`text-gray-400 transition ${advancedOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {advancedOpen && <div className="border-t border-gray-100 px-5 py-2">{['homepage_banner', 'custom_css'].map((k) => renderField(k))}</div>}
                </section>
            </div>

            <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
                <LivePreview v={v} />
                <p className="flex items-start gap-2 px-1 text-xs text-gray-400">
                    <Sparkles size={13} className="mt-0.5 shrink-0" />
                    Saved changes show across the system on the next page load.
                </p>
            </div>
        </div>
    )
}
