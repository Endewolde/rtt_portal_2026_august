import { useState, useEffect } from 'react'
import { Link } from '@inertiajs/react'
import { ArrowLeft, Building2, FolderOpen, BookOpen, ExternalLink, Tags, Activity, UserX } from 'lucide-react'
import PublicLayout from '../../Layouts/PublicLayout'
import { get } from '../../lib/api'
import { Initials } from './Researchers'

const OUTPUT_LABELS = {
    journal_article: 'Journal article', conference_paper: 'Conference paper', book: 'Book', patent: 'Patent',
    software: 'Software', prototype: 'Prototype', community_impact: 'Community impact', technology_transfer: 'Technology transfer',
}

function Stat({ label, value }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <p className="text-2xl font-bold tabular-nums text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
        </div>
    )
}

export default function ResearcherProfile({ slug }) {
    const [profile, setProfile] = useState(null)
    const [missing, setMissing] = useState(false)

    useEffect(() => {
        get(`/researchers/${slug}`, {}, { skipErrorToast: true })
            .then(r => setProfile(r.data))
            .catch(() => setMissing(true))
    }, [slug])

    return (
        <PublicLayout>
            <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <Link href="/researchers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-700">
                    <ArrowLeft size={14} /> All researchers
                </Link>

                {missing ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 py-20 text-center">
                        <UserX size={28} className="mx-auto text-gray-300" />
                        <p className="mt-3 text-sm text-gray-500">This profile does not exist or is not public.</p>
                    </div>
                ) : !profile ? (
                    <div className="space-y-4">
                        <div className="h-36 animate-pulse rounded-2xl bg-gray-100" />
                        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
                    </div>
                ) : (
                    <>
                        <header className="rounded-2xl border border-gray-100 bg-white p-6">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                                {profile.avatar
                                    ? <img src={profile.avatar} alt="" className="h-24 w-24 shrink-0 rounded-full object-cover" />
                                    : <Initials name={profile.name} className="h-24 w-24 shrink-0 text-2xl" />}
                                <div className="min-w-0 flex-1 space-y-2">
                                    <h1 className="text-2xl font-bold text-gray-900">{profile.title ? `${profile.title} ` : ''}{profile.name}</h1>
                                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-gray-600">
                                        <Building2 size={14} className="text-gray-400" />
                                        {[profile.department, profile.college].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                    {profile.orcid && (
                                        <a href={`https://orcid.org/${profile.orcid}`} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline">
                                            ORCID {profile.orcid} <ExternalLink size={12} />
                                        </a>
                                    )}
                                    {profile.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{profile.bio}</p>}
                                    {profile.expertise?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {profile.expertise.map(e => <span key={e} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{e}</span>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </header>

                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <Stat label="Funded projects" value={profile.stats.projects} />
                                <Stat label="Led as principal investigator" value={profile.stats.as_pi} />
                                <Stat label="Ongoing now" value={profile.stats.ongoing} />
                                <Stat label="Verified research outputs" value={profile.stats.outputs} />
                            </div>
                            {/* Proposals still under review are private, so a new researcher can show zeros here. */}
                            <p className="text-xs text-gray-400">
                                {profile.stats.projects === 0
                                    ? 'Projects appear here once they are funded. Proposals still in review are not shown publicly.'
                                    : 'Counts include funded projects only; outputs appear once the college has verified them.'}
                            </p>
                        </div>

                        {profile.themes.length > 0 && (
                            <section className="rounded-2xl border border-gray-100 bg-white p-5">
                                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><Tags size={15} className="text-indigo-500" /> Research themes</h2>
                                <div className="flex flex-wrap gap-2">
                                    {profile.themes.map(t => <span key={t} className="rounded-lg bg-gray-100 px-3 py-1 text-sm text-gray-700">{t}</span>)}
                                </div>
                            </section>
                        )}

                        <section className="rounded-2xl border border-gray-100 bg-white p-5">
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><FolderOpen size={15} className="text-indigo-500" /> Projects</h2>
                            {profile.projects.length === 0 ? <p className="text-sm text-gray-500">No funded projects yet. Projects are listed here from the moment they are funded.</p> : (
                                <ul className="divide-y divide-gray-100">
                                    {profile.projects.map(p => (
                                        <li key={p.tracker_number} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900">{p.title}</p>
                                                <p className="mt-0.5 text-xs text-gray-500">{p.role} · {p.category} · {p.academic_year}{p.theme ? ` · ${p.theme}` : ''}</p>
                                            </div>
                                            <span className={`inline-flex shrink-0 items-center gap-1 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.state === 'Ongoing' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                {p.state === 'Ongoing' && <Activity size={11} />} {p.state}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="rounded-2xl border border-gray-100 bg-white p-5">
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><BookOpen size={15} className="text-indigo-500" /> Research outputs</h2>
                            {profile.outputs.length === 0 ? <p className="text-sm text-gray-500">No outputs recorded yet.</p> : (
                                <ul className="divide-y divide-gray-100">
                                    {profile.outputs.map((o, i) => (
                                        <li key={i} className="py-3">
                                            <p className="font-medium text-gray-900">{o.title}</p>
                                            <p className="mt-0.5 text-xs text-gray-500">
                                                {OUTPUT_LABELS[o.type] ?? o.type}{o.venue ? ` · ${o.venue}` : ''}{o.year ? ` · ${o.year}` : ''}
                                            </p>
                                            {o.doi && (
                                                <a href={`https://doi.org/${o.doi}`} target="_blank" rel="noopener noreferrer"
                                                    className="mt-1 inline-flex items-center gap-1 break-all text-xs font-medium text-indigo-600 hover:underline">
                                                    doi:{o.doi} <ExternalLink size={11} className="shrink-0" />
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </div>
        </PublicLayout>
    )
}
