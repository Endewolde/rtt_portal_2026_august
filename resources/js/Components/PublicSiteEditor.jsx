import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Globe, Layout, Menu, Eye, ListOrdered, Sparkles, Megaphone, Share2, Download, Palette,
    ExternalLink, Save, Undo2, Loader2, ImagePlus, Upload, X, Check, AlertTriangle, RotateCcw,
} from 'lucide-react'
import api from '../lib/api'
import { useToast } from './Toast'
import { FEATURE_DEFAULTS, FEATURE_ICONS } from '../lib/publicFeatures'
import { NAV_DEFAULTS, SLIDE_DEFAULTS, STEP_DEFAULTS, COLOR_DEFAULTS } from '../lib/publicSite'

const SECTIONS = [
    { key: 'branding', label: 'Branding & colours', icon: Palette },
    { key: 'hero', label: 'Hero slider', icon: Layout },
    { key: 'menu', label: 'Menu', icon: Menu },
    { key: 'sections', label: 'Homepage sections', icon: Eye },
    { key: 'steps', label: 'How it works', icon: ListOrdered },
    { key: 'features', label: 'Capabilities', icon: Sparkles },
    { key: 'cta', label: 'Call to action', icon: Megaphone },
    { key: 'social', label: 'Social links', icon: Share2 },
    { key: 'downloads', label: 'Downloads', icon: Download },
]

const COLORS = [
    { key: 'public_topbar_bg', label: 'Top bar background' },
    { key: 'public_topbar_text', label: 'Top bar text' },
    { key: 'public_hero_bg', label: 'Hero background' },
    { key: 'public_cards_bg', label: 'Open calls section' },
    { key: 'public_features_bg', label: 'Capabilities section' },
    { key: 'public_footer_bg', label: 'Footer background' },
]

const VISIBILITY = [
    { key: 'public_show_stats', label: 'Statistics strip', desc: 'Live counts of proposals, funded projects and colleges.' },
    { key: 'public_show_open_calls', label: 'Open calls', desc: 'Calls currently accepting proposals.' },
    { key: 'public_show_how_it_works', label: 'How it works', desc: 'The six steps from submission to funding.' },
    { key: 'public_show_features', label: 'Platform capabilities', desc: 'The grid of capability cards.' },
    { key: 'public_show_cta', label: 'Call-to-action banner', desc: 'The closing banner with two buttons.' },
]

const SOCIAL = [
    { key: 'public_social_telegram', label: 'Telegram', placeholder: 'https://t.me/yourchannel' },
    { key: 'public_social_facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
    { key: 'public_social_twitter', label: 'X (Twitter)', placeholder: 'https://x.com/yourhandle' },
    { key: 'public_social_linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/…' },
    { key: 'public_social_instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
    { key: 'public_social_youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
]

const SWATCHES = ['#4f46e5', '#2563eb', '#0891b2', '#10b981', '#65a30d', '#f59e0b', '#ea580c', '#ef4444', '#db2777', '#8b5cf6', '#0f172a']
const EMOJIS = ['🔬', '💰', '⚖️', '🏛️', '📊', '🌐', '🎓', '🚀', '💡', '🤝', '📚', '🧪', '🌱', '🏆']

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100'

function flatten(groups) {
    const flat = {}
    Object.values(groups ?? {}).forEach((group) => {
        Object.entries(group ?? {}).forEach(([k, item]) => { flat[k] = typeof item === 'object' && item !== null ? (item.value ?? '') : (item ?? '') })
    })
    return flat
}

function Text({ label, hint, value, onChange, placeholder, multiline, error, maxLength = 500 }) {
    return (
        <label className="block">
            <span className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-gray-800">{label}</span>
                {hint && <span className="truncate text-[11px] text-gray-400">{hint}</span>}
            </span>
            {multiline
                ? <textarea rows={3} value={value ?? ''} maxLength={maxLength * 4} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} resize-y ${error ? 'border-red-300' : ''}`} />
                : <input value={value ?? ''} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} ${error ? 'border-red-300' : ''}`} />}
            {error && <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600"><AlertTriangle size={11} /> {error}</span>}
        </label>
    )
}

function Switch({ on, onChange, label }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
        </button>
    )
}

function ColorInput({ value, fallback, onChange, swatches = false }) {
    const shown = value || fallback || '#000000'
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <input type="color" value={shown} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5" />
                <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={fallback || 'Default'} className={`${inputCls} w-32 font-mono`} />
                {value && <button type="button" onClick={() => onChange('')} title="Back to default" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><RotateCcw size={14} /></button>}
            </div>
            {swatches && (
                <div className="flex flex-wrap gap-1.5">
                    {SWATCHES.map((c) => (
                        <button key={c} type="button" onClick={() => onChange(c)} title={c}
                            className={`h-6 w-6 rounded-full ring-2 ring-offset-1 transition ${value === c ? 'ring-gray-900' : 'ring-transparent hover:ring-gray-300'}`} style={{ backgroundColor: c }} />
                    ))}
                </div>
            )}
        </div>
    )
}

function Card({ title, subtitle, children, actions }) {
    return (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                    {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
                </div>
                {actions}
            </header>
            <div className="space-y-4 p-5">{children}</div>
        </section>
    )
}

/** A slide's background photo: uploads straight away (images are not part of the draft). */
function SlideImage({ n, url, onUploaded }) {
    const { success, error } = useToast()
    const ref = useRef(null)
    const [busy, setBusy] = useState(false)
    const key = `slider_slide_${n}_image`

    const upload = async (file) => {
        if (!file) return
        setBusy(true)
        try {
            const form = new FormData()
            form.append('file', file)
            form.append('key', key)
            const r = await api.post('/settings/upload-asset', form, { headers: { 'Content-Type': 'multipart/form-data' } })
            onUploaded(key, r.data?.data?.url ?? '')
            success('Image uploaded.')
        } catch {
            error('Upload failed — JPEG, PNG or WebP up to 5 MB.')
        }
        setBusy(false)
    }
    const remove = async () => {
        try { await api.put(`/settings/app/${key}`, { value: '' }); onUploaded(key, ''); success('Image removed.') } catch { error('Could not remove the image.') }
    }

    return (
        <div>
            <p className="mb-1 text-sm font-medium text-gray-800">Background photo <span className="text-[11px] font-normal text-gray-400">· 1920 × 700 px, saved at once</span></p>
            {url ? (
                <div className="group relative h-32 overflow-hidden rounded-xl border border-gray-200">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
                        <button type="button" onClick={() => ref.current?.click()} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-800"><Upload size={12} /> Replace</button>
                        <button type="button" onClick={remove} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"><X size={12} /> Remove</button>
                    </div>
                </div>
            ) : (
                <button type="button" onClick={() => ref.current?.click()} disabled={busy}
                    className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600 disabled:opacity-50">
                    {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                    <span className="text-xs font-medium">{busy ? 'Uploading…' : 'Upload a photo — or leave empty for the animated gradient'}</span>
                </button>
            )}
            <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </div>
    )
}

/**
 * The public website editor: every part of the homepage in one place, edited as a draft
 * and saved together. Used by Settings → Public Site and by the Public Site page.
 */
export default function PublicSiteEditor({ children }) {
    const { success, error } = useToast()
    const [saved, setSaved] = useState(null)
    const [draft, setDraft] = useState({})
    const [section, setSection] = useState('branding')
    const [slide, setSlide] = useState(1)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})

    useEffect(() => {
        api.get('/settings/app').then((r) => {
            const flat = flatten(r.data?.data)
            setSaved(flat)
            setDraft(flat)
        }).catch(() => setSaved({}))
    }, [])

    const v = (k) => draft[k] ?? ''
    const set = (k, value) => { setDraft((d) => ({ ...d, [k]: value })); setErrors((e) => { const { [k]: _, ...rest } = e; return rest }) }
    const visible = (k) => v(k) !== 'false'

    const changed = useMemo(() => {
        if (!saved) return []
        return Object.keys(draft).filter((k) => /^(public_|slider_slide_)/.test(k) && (draft[k] ?? '') !== (saved[k] ?? ''))
    }, [draft, saved])

    // Warn before leaving with unsaved changes.
    useEffect(() => {
        const warn = (e) => { if (changed.length) { e.preventDefault(); e.returnValue = '' } }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [changed.length])

    const save = async () => {
        setSaving(true)
        try {
            const settings = Object.fromEntries(changed.map((k) => [k, draft[k] ?? '']))
            const r = await api.put('/settings/public-site', { settings })
            setSaved((s) => ({ ...s, ...settings }))
            setErrors({})
            success(r.data?.message ?? 'Saved.')
        } catch (e) {
            const errs = e.response?.data?.errors ?? {}
            setErrors(errs)
            error(e.response?.data?.message ?? 'Could not save.')
        }
        setSaving(false)
    }

    const onUploaded = (k, url) => { setDraft((d) => ({ ...d, [k]: url })); setSaved((s) => ({ ...s, [k]: url })) }

    if (saved === null) {
        return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />)}</div>
    }

    const slideCount = Math.min(6, Math.max(1, parseInt(v('slider_slide_count') || '4', 10)))
    const sk = (f) => `slider_slide_${slide}_${f}`
    const sd = SLIDE_DEFAULTS[slide - 1]
    const accent = v(sk('color')) || sd.color || '#4f46e5'
    const sectionChanged = (prefixes) => changed.some((k) => prefixes.some((p) => k.startsWith(p)))
    const dirtyBy = {
        branding: ['public_header', 'public_footer', 'public_topbar', 'public_hero_bg', 'public_cards_bg', 'public_features_bg'],
        hero: ['slider_slide_'],
        menu: ['public_nav_item_'],
        sections: ['public_show_'],
        steps: ['public_step_'],
        features: ['public_feature'],
        cta: ['public_cta_'],
        social: ['public_social_'],
        downloads: [],
    }

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50 to-white px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><Globe size={18} /></span>
                    <div>
                        <p className="text-sm font-semibold text-gray-900">Public website</p>
                        <p className="text-xs text-gray-600">Edit any part, then save once — changes go live straight away.</p>
                    </div>
                </div>
                <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">
                    <Eye size={14} /> View site <ExternalLink size={12} />
                </a>
            </div>

            <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
                {/* Section navigation */}
                <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
                    {SECTIONS.map((s) => {
                        const on = section === s.key
                        const dirty = sectionChanged(dirtyBy[s.key])
                        return (
                            <button key={s.key} type="button" onClick={() => setSection(s.key)}
                                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${on ? 'bg-gray-900 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <s.icon size={15} className={on ? 'text-white' : 'text-gray-400'} />
                                <span className="flex-1 whitespace-nowrap">{s.label}</span>
                                {dirty && <span className={`h-2 w-2 rounded-full ${on ? 'bg-amber-300' : 'bg-amber-500'}`} title="Unsaved changes" />}
                            </button>
                        )
                    })}
                </nav>

                <div className="min-w-0 space-y-5">
                    {section === 'branding' && (
                        <>
                            <Card title="Header & footer text" subtitle="The words around your logo and at the bottom of every public page.">
                                <Text label="Top bar text" value={v('public_header_tagline')} onChange={(x) => set('public_header_tagline', x)} placeholder="University — Research & Technology Transfer Platform" />
                                <Text label="Line under the university name" value={v('public_header_subtitle')} onChange={(x) => set('public_header_subtitle', x)} placeholder="Research & Technology Transfer" />
                                <Text label="Footer tagline" value={v('public_footer_tagline')} onChange={(x) => set('public_footer_tagline', x)} placeholder="Research & Technology Transfer Platform" />
                            </Card>
                            <Card title="Colours" subtitle="Buttons and links use Appearance → Primary colour.">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {COLORS.map((c) => (
                                        <div key={c.key}>
                                            <p className="mb-1.5 text-sm font-medium text-gray-800">{c.label}</p>
                                            <ColorInput value={v(c.key)} fallback={COLOR_DEFAULTS[c.key]} onChange={(x) => set(c.key, x)} />
                                            {errors[c.key] && <p className="mt-1 text-[11px] text-red-600">{errors[c.key]}</p>}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </>
                    )}

                    {section === 'hero' && (
                        <Card title="Hero slider" subtitle="The large rotating banner at the top of the homepage."
                            actions={(
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Slides</span>
                                    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                                        {[1, 2, 3, 4, 5, 6].map((n) => (
                                            <button key={n} type="button" onClick={() => { set('slider_slide_count', String(n)); if (slide > n) setSlide(n) }}
                                                className={`h-7 w-7 rounded-md text-xs font-bold transition ${slideCount === n ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{n}</button>
                                        ))}
                                    </div>
                                </div>
                            )}>
                            <div className="flex flex-wrap gap-1.5">
                                {Array.from({ length: slideCount }, (_, i) => i + 1).map((n) => (
                                    <button key={n} type="button" onClick={() => setSlide(n)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${slide === n ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v(`slider_slide_${n}_color`) || SLIDE_DEFAULTS[n - 1].color || '#4f46e5' }} />
                                        Slide {n}
                                    </button>
                                ))}
                            </div>

                            {/* Live look of the slide */}
                            <div className="relative overflow-hidden rounded-xl px-6 py-7 text-white" style={{ background: v(sk('image')) ? `linear-gradient(rgba(15,23,42,.55),rgba(15,23,42,.75)), url(${v(sk('image'))}) center/cover` : `linear-gradient(135deg, ${v('public_hero_bg') || '#0f172a'}, ${accent}55)` }}>
                                <span className="text-3xl">{v(sk('icon')) || sd.icon}</span>
                                <p className="mt-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">{v(sk('eyebrow')) || (slide === 1 ? 'Your organisation · Research Platform' : sd.eyebrow)}</p>
                                <p className="mt-2 text-2xl font-extrabold leading-tight">{v(sk('heading')) || sd.heading}<br /><span style={{ color: accent }}>{v(sk('highlight')) || sd.highlight}</span></p>
                                <p className="mt-2 max-w-lg text-xs text-white/80">{v(sk('subtitle')) || sd.subtitle}</p>
                                <div className="mt-3 flex gap-2 text-[11px] font-semibold">
                                    <span className="rounded-lg px-3 py-1.5" style={{ backgroundColor: accent }}>{v(sk('cta1_text')) || 'View Open Calls'}</span>
                                    <span className="rounded-lg bg-white/15 px-3 py-1.5">{v(sk('cta2_text')) || 'Track Proposal'}</span>
                                </div>
                            </div>

                            <SlideImage n={slide} url={v(sk('image'))} onUploaded={onUploaded} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Text label="Small badge" value={v(sk('eyebrow'))} onChange={(x) => set(sk('eyebrow'), x)} placeholder={slide === 1 ? 'Your organisation name' : sd.eyebrow} />
                                <Text label="Headline" value={v(sk('heading'))} onChange={(x) => set(sk('heading'), x)} placeholder={sd.heading} />
                            </div>
                            <Text label="Highlighted line" hint="shown in the accent colour" value={v(sk('highlight'))} onChange={(x) => set(sk('highlight'), x)} placeholder={sd.highlight} />
                            <Text label="Supporting text" multiline value={v(sk('subtitle'))} onChange={(x) => set(sk('subtitle'), x)} placeholder={sd.subtitle} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 rounded-xl bg-gray-50 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Main button</p>
                                    <Text label="Text" value={v(sk('cta1_text'))} onChange={(x) => set(sk('cta1_text'), x)} placeholder="View Open Calls" />
                                    <Text label="Link" value={v(sk('cta1_href'))} onChange={(x) => set(sk('cta1_href'), x)} placeholder="/proposal-calls/public" error={errors[sk('cta1_href')]} />
                                </div>
                                <div className="space-y-2 rounded-xl bg-gray-50 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Second button</p>
                                    <Text label="Text" value={v(sk('cta2_text'))} onChange={(x) => set(sk('cta2_text'), x)} placeholder="Track Proposal" />
                                    <Text label="Link" value={v(sk('cta2_href'))} onChange={(x) => set(sk('cta2_href'), x)} placeholder="/tracker" error={errors[sk('cta2_href')]} />
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="mb-1.5 text-sm font-medium text-gray-800">Accent colour</p>
                                    <ColorInput value={v(sk('color'))} fallback={sd.color || '#4f46e5'} onChange={(x) => set(sk('color'), x)} swatches />
                                </div>
                                <div>
                                    <p className="mb-1.5 text-sm font-medium text-gray-800">Icon</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {EMOJIS.map((e) => (
                                            <button key={e} type="button" onClick={() => set(sk('icon'), e)}
                                                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${(v(sk('icon')) || sd.icon) === e ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-gray-50 hover:bg-gray-100'}`}>{e}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {section === 'menu' && (
                        <Card title="Menu" subtitle="The links in the public header. Leave a box empty to keep the default.">
                            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                                {NAV_DEFAULTS.map((d, i) => {
                                    const n = i + 1
                                    const on = visible(`public_nav_item_${n}_show`)
                                    return (
                                        <div key={n} className={`grid items-center gap-2 px-3 py-2.5 sm:grid-cols-[auto_1fr_1fr] ${on ? '' : 'opacity-60'}`}>
                                            <div className="flex items-center gap-2.5">
                                                <Switch on={on} onChange={(x) => set(`public_nav_item_${n}_show`, x ? 'true' : 'false')} label={`Show ${d.label}`} />
                                                <span className="w-5 text-xs tabular-nums text-gray-400">{n}</span>
                                            </div>
                                            <input value={v(`public_nav_item_${n}_label`)} onChange={(e) => set(`public_nav_item_${n}_label`, e.target.value)} placeholder={d.label} className={inputCls} aria-label={`Label for item ${n}`} />
                                            <div>
                                                <input value={v(`public_nav_item_${n}_href`)} onChange={(e) => set(`public_nav_item_${n}_href`, e.target.value)} placeholder={d.href} className={`${inputCls} font-mono text-xs ${errors[`public_nav_item_${n}_href`] ? 'border-red-300' : ''}`} aria-label={`Link for item ${n}`} />
                                                {errors[`public_nav_item_${n}_href`] && <p className="mt-1 text-[11px] text-red-600">{errors[`public_nav_item_${n}_href`]}</p>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </Card>
                    )}

                    {section === 'sections' && (
                        <Card title="Homepage sections" subtitle="Show or hide whole sections of the homepage.">
                            <div className="divide-y divide-gray-100">
                                {VISIBILITY.map((s) => (
                                    <div key={s.key} className="flex items-center justify-between gap-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{s.label}</p>
                                            <p className="text-xs text-gray-500">{s.desc}</p>
                                        </div>
                                        <Switch on={visible(s.key)} onChange={(x) => set(s.key, x ? 'true' : 'false')} label={s.label} />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {section === 'steps' && (
                        <Card title="How it works" subtitle="The six steps shown on the homepage. Empty boxes keep the default wording.">
                            <div className="grid gap-4 md:grid-cols-2">
                                {STEP_DEFAULTS.map((d, i) => (
                                    <div key={i} className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                                        <p className="flex items-center gap-2 text-xs font-semibold text-gray-500"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] text-white">{i + 1}</span> Step {i + 1}</p>
                                        <Text label="Title" value={v(`public_step_${i + 1}_title`)} onChange={(x) => set(`public_step_${i + 1}_title`, x)} placeholder={d.title} />
                                        <Text label="Description" multiline value={v(`public_step_${i + 1}_desc`)} onChange={(x) => set(`public_step_${i + 1}_desc`, x)} placeholder={d.desc} />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {section === 'features' && (
                        <>
                            <Card title="Capabilities heading">
                                <Text label="Title" value={v('public_features_title')} onChange={(x) => set('public_features_title', x)} placeholder="Everything You Need to Manage RTT" />
                                <Text label="Subtitle" multiline value={v('public_features_subtitle')} onChange={(x) => set('public_features_subtitle', x)} placeholder="A complete platform for the full research lifecycle." />
                            </Card>
                            <div className="grid gap-4 md:grid-cols-2">
                                {FEATURE_DEFAULTS.map((d, i) => {
                                    const n = i + 1
                                    const on = visible(`public_feature_${n}_show`)
                                    const iconName = v(`public_feature_${n}_icon`) || d.icon
                                    const Icon = FEATURE_ICONS[iconName] ?? FEATURE_ICONS[d.icon]
                                    return (
                                        <div key={n} className={`space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${on ? '' : 'opacity-60'}`}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icon size={16} /></span>
                                                    Card {n}
                                                </span>
                                                <Switch on={on} onChange={(x) => set(`public_feature_${n}_show`, x ? 'true' : 'false')} label={`Show card ${n}`} />
                                            </div>
                                            <Text label="Title" value={v(`public_feature_${n}_title`)} onChange={(x) => set(`public_feature_${n}_title`, x)} placeholder={d.title} />
                                            <Text label="Description" multiline value={v(`public_feature_${n}_desc`)} onChange={(x) => set(`public_feature_${n}_desc`, x)} placeholder={d.desc} />
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(FEATURE_ICONS).map(([name, I]) => (
                                                    <button key={name} type="button" title={name} aria-pressed={iconName === name} onClick={() => set(`public_feature_${n}_icon`, name)}
                                                        className={`flex h-7 w-7 items-center justify-center rounded-md transition ${iconName === name ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}><I size={13} /></button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    {section === 'cta' && (
                        <Card title="Call-to-action banner" subtitle="The closing banner near the bottom of the homepage.">
                            <Text label="Title" value={v('public_cta_title')} onChange={(x) => set('public_cta_title', x)} placeholder="Ready to Start Your Research Journey?" />
                            <Text label="Subtitle" multiline value={v('public_cta_subtitle')} onChange={(x) => set('public_cta_subtitle', x)} placeholder="Join researchers from your organisation and transform your ideas into impactful funded work." />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Text label="Main button" value={v('public_cta_primary')} onChange={(x) => set('public_cta_primary', x)} placeholder="View Open Calls" />
                                <Text label="Second button" value={v('public_cta_secondary')} onChange={(x) => set('public_cta_secondary', x)} placeholder="Track Proposal" />
                            </div>
                        </Card>
                    )}

                    {section === 'social' && (
                        <Card title="Social links" subtitle="Shown as icons in the footer. Leave empty to hide one.">
                            <div className="grid gap-4 sm:grid-cols-2">
                                {SOCIAL.map((s) => (
                                    <Text key={s.key} label={s.label} value={v(s.key)} onChange={(x) => set(s.key, x)} placeholder={s.placeholder} error={errors[s.key]} />
                                ))}
                            </div>
                        </Card>
                    )}

                    {section === 'downloads' && (
                        <Card title="Downloads" subtitle="The Downloads link in the public header opens the resources page.">
                            <p className="text-sm text-gray-600">Templates, guidelines and forms that visitors can download are managed under <b>Resources</b> — add a file there and it appears on the public Downloads page at once.</p>
                            <a href="/admin/resources" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Download size={14} /> Manage resources</a>
                        </Card>
                    )}

                    {section === 'branding' && children}
                </div>
            </div>

            {/* Save bar */}
            {changed.length > 0 && (
                <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
                    <div className="flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-2xl">
                        <span className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-amber-400" /> {changed.length} unsaved change{changed.length === 1 ? '' : 's'}</span>
                        <button type="button" onClick={() => { setDraft(saved); setErrors({}) }} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"><Undo2 size={13} /> Discard</button>
                        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-60">
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save changes
                        </button>
                    </div>
                </div>
            )}
            {changed.length === 0 && saved && Object.keys(saved).length > 0 && (
                <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400"><Check size={12} /> All changes saved</p>
            )}
        </div>
    )
}
