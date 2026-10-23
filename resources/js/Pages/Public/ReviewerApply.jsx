import { useState } from 'react'
import { Link } from '@inertiajs/react'
import { UserPlus, FileText, X, CheckCircle2, ShieldCheck, Clock, Award, Upload } from 'lucide-react'
import PublicLayout from '../../Layouts/PublicLayout'
import api from '../../lib/api'

const QUALIFICATIONS = ['PhD', "Master's", "Bachelor's", 'Other']

const EMPTY = {
    name: '', title: '', email: '', phone: '', organization: '', position: '',
    qualification: '', bio: '', orcid: '', website: '',
}

function Field({ label, required, error, hint, children }) {
    return (
        <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
    )
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

export default function ReviewerApply() {
    const [form, setForm] = useState(EMPTY)
    const [expertise, setExpertise] = useState([])
    const [tag, setTag] = useState('')
    const [cv, setCv] = useState(null)
    const [consent, setConsent] = useState(false)
    const [errors, setErrors] = useState({})
    const [message, setMessage] = useState('')
    const [saving, setSaving] = useState(false)
    const [done, setDone] = useState(false)

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const addTag = () => {
        const value = tag.trim().replace(/,$/, '')
        if (value && !expertise.some(e => e.toLowerCase() === value.toLowerCase()) && expertise.length < 15) {
            setExpertise(list => [...list, value])
        }
        setTag('')
    }

    const submit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setErrors({})
        setMessage('')
        const data = new FormData()
        Object.entries(form).forEach(([k, v]) => { if (v) data.append(k, v) })
        expertise.forEach(x => data.append('expertise[]', x))
        if (cv) data.append('cv', cv)
        data.append('consent', consent ? '1' : '0')
        try {
            await api.post('/reviewer-applications', data, { headers: { 'Content-Type': 'multipart/form-data' }, skipErrorToast: true })
            setDone(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (err) {
            const errs = err.response?.data?.errors ?? {}
            setErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k.replace(/\.\d+$/, ''), v[0]])))
            setMessage(err.response?.status === 429
                ? 'Too many applications from this connection. Please try again later.'
                : Object.keys(errs).length ? 'Please correct the highlighted fields.' : (err.response?.data?.message ?? 'Your application could not be sent. Please try again.'))
        }
        setSaving(false)
    }

    if (done) {
        return (
            <PublicLayout>
                <div className="mx-auto max-w-xl px-4 py-16 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100"><CheckCircle2 size={28} className="text-emerald-600" /></div>
                    <h1 className="text-2xl font-bold text-gray-900">Thank you for applying</h1>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">
                        Your application and CV have been received. The research office will review them and email you at <strong>{form.email}</strong>.
                        If you are approved, the email will include a link to set your password.
                    </p>
                    <Link href="/" className="mt-8 inline-block rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Back to the home page</Link>
                </div>
            </PublicLayout>
        )
    }

    return (
        <PublicLayout>
            <div className="mx-auto max-w-5xl px-4 py-10">
                <div className="mb-8 max-w-2xl">
                    <h1 className="text-3xl font-bold text-gray-900">Become a Proposal Reviewer</h1>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">
                        We invite experts from other universities, research institutes, ministries and industry to review research,
                        community engagement and technology transfer proposals. Independent reviewers make funding decisions fairer.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
                    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" noValidate>
                        {message && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}

                        <section className="space-y-4">
                            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">About you</h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]">
                                <Field label="Title" error={errors.title}>
                                    <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Dr., Prof." className={inputCls} />
                                </Field>
                                <Field label="Full name" required error={errors.name}>
                                    <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} autoComplete="name" />
                                </Field>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label="Email" required error={errors.email} hint="We'll contact you here.">
                                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} autoComplete="email" />
                                </Field>
                                <Field label="Phone" error={errors.phone}>
                                    <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} autoComplete="tel" />
                                </Field>
                                <Field label="Organization" required error={errors.organization} hint="University, institute, ministry or company.">
                                    <input value={form.organization} onChange={e => set('organization', e.target.value)} className={inputCls} />
                                </Field>
                                <Field label="Position" error={errors.position}>
                                    <input value={form.position} onChange={e => set('position', e.target.value)} placeholder="e.g. Associate Professor" className={inputCls} />
                                </Field>
                                <Field label="Highest qualification" required error={errors.qualification}>
                                    <select value={form.qualification} onChange={e => set('qualification', e.target.value)} className={inputCls}>
                                        <option value="">Select…</option>
                                        {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
                                    </select>
                                </Field>
                                <Field label="ORCID iD" error={errors.orcid} hint="Optional, e.g. 0000-0002-1825-0097">
                                    <input value={form.orcid} onChange={e => set('orcid', e.target.value)} className={inputCls} />
                                </Field>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Your expertise</h2>
                            <Field label="Areas of expertise" required error={errors.expertise}
                                hint="Be specific — these are matched to proposals. Press Enter or comma after each.">
                                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                                    {expertise.map(x => (
                                        <span key={x} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                                            {x}
                                            <button type="button" onClick={() => setExpertise(l => l.filter(y => y !== x))} aria-label={`Remove ${x}`} className="text-indigo-400 hover:text-indigo-700"><X size={12} /></button>
                                        </span>
                                    ))}
                                    <input value={tag} onChange={e => setTag(e.target.value)} onBlur={addTag}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                                        placeholder={expertise.length ? '' : 'e.g. Soil fertility, Water resources'} className="min-w-40 flex-1 bg-transparent px-1 py-1 text-sm outline-none" />
                                </div>
                            </Field>
                            <Field label="Short biography" error={errors.bio} hint="Your research background and reviewing experience.">
                                <textarea rows={4} maxLength={2000} value={form.bio} onChange={e => set('bio', e.target.value)} className={inputCls} />
                            </Field>
                            <Field label="CV" required error={errors.cv} hint="PDF, up to 5 MB.">
                                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm ${cv ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-300 hover:border-indigo-300'}`}>
                                    {cv ? <FileText size={18} className="text-emerald-600" /> : <Upload size={18} className="text-gray-400" />}
                                    <span className="min-w-0 flex-1 truncate text-gray-700">{cv ? cv.name : 'Choose your CV (PDF)'}</span>
                                    <input type="file" accept="application/pdf" className="sr-only" onChange={e => setCv(e.target.files?.[0] ?? null)} />
                                </label>
                            </Field>
                        </section>

                        {/* Spam trap — hidden from people. */}
                        <input type="text" name="website" value={form.website} onChange={e => set('website', e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                        <label className="flex items-start gap-2.5 text-sm text-gray-700">
                            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                            <span>
                                I agree that the research office may keep this information and my CV to consider me as a reviewer,
                                and I will keep any proposal I review confidential and declare conflicts of interest.
                                {errors.consent && <span className="mt-1 block text-xs text-red-600">{errors.consent}</span>}
                            </span>
                        </label>

                        <div className="flex justify-end">
                            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                                <UserPlus size={16} /> {saving ? 'Sending…' : 'Submit application'}
                            </button>
                        </div>
                    </form>

                    <aside className="space-y-4">
                        {[
                            { icon: ShieldCheck, title: 'Independent and confidential', text: 'Blind reviews hide who wrote the proposal. You declare any conflict of interest before scoring.' },
                            { icon: Clock, title: 'A few reviews a year', text: 'You are only invited for proposals in your field, and you can see your workload at any time.' },
                            { icon: Award, title: 'Recognised', text: 'Reviewers receive a verifiable certificate of review service each academic year.' },
                        ].map(({ icon: Icon, title, text }) => (
                            <div key={title} className="rounded-2xl border border-gray-100 bg-white p-5">
                                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50"><Icon size={17} className="text-indigo-600" /></div>
                                <p className="text-sm font-semibold text-gray-900">{title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-gray-600">{text}</p>
                            </div>
                        ))}
                    </aside>
                </div>
            </div>
        </PublicLayout>
    )
}
