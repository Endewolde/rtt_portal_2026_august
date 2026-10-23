import { useState, useEffect, useCallback } from 'react'
import {
    BookOpen, Award, Cpu, Users, Globe, Microscope,
    Plus, X, ChevronRight, FileText, ExternalLink,
    FlaskConical, Layers, Search, Pencil, Trash2,
    Calendar, Building2, BarChart3, TrendingUp,
    CheckCircle2, AlertCircle, Sparkles, Clock, XCircle, ShieldCheck, ThumbsUp,
    Wand2, Link2, AlertTriangle as AlertTriangleIcon,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../Components/Toast'
import { useConfirm } from '../../hooks/useConfirm'
import { formatDate, cn } from '../../lib/utils'
import api from '../../lib/api'

// ─── Config ───────────────────────────────────────────────────────────────────

const OUTPUT_TYPES = [
    { value: 'journal_article',     label: 'Journal Article',     icon: BookOpen,     bg: 'bg-blue-500',    light: 'bg-blue-50 text-blue-700 border-blue-200',   accent: 'border-l-blue-500' },
    { value: 'conference_paper',    label: 'Conference Paper',    icon: FileText,     bg: 'bg-violet-500',  light: 'bg-violet-50 text-violet-700 border-violet-200', accent: 'border-l-violet-500' },
    { value: 'book',                label: 'Book',                icon: Layers,       bg: 'bg-teal-500',    light: 'bg-teal-50 text-teal-700 border-teal-200',   accent: 'border-l-teal-500' },
    { value: 'patent',              label: 'Patent',              icon: Award,        bg: 'bg-amber-500',   light: 'bg-amber-50 text-amber-700 border-amber-200', accent: 'border-l-amber-500' },
    { value: 'software',            label: 'Software',            icon: Cpu,          bg: 'bg-cyan-500',    light: 'bg-cyan-50 text-cyan-700 border-cyan-200',   accent: 'border-l-cyan-500' },
    { value: 'prototype',           label: 'Prototype',           icon: FlaskConical, bg: 'bg-orange-500',  light: 'bg-orange-50 text-orange-700 border-orange-200', accent: 'border-l-orange-500' },
    { value: 'community_impact',    label: 'Community Impact',    icon: Users,        bg: 'bg-green-500',   light: 'bg-green-50 text-green-700 border-green-200', accent: 'border-l-green-500' },
    { value: 'technology_transfer', label: 'Tech Transfer',       icon: Globe,        bg: 'bg-indigo-500',  light: 'bg-indigo-50 text-indigo-700 border-indigo-200', accent: 'border-l-indigo-500' },
]

const cfg = (type) => OUTPUT_TYPES.find(t => t.value === type) ?? { label: type, icon: FileText, bg: 'bg-gray-400', light: 'bg-gray-50 text-gray-600 border-gray-200', accent: 'border-l-gray-400' }

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type, size = 'sm' }) {
    const c    = cfg(type)
    const Icon = c.icon
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full border font-medium', c.light,
            size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs')}>
            <Icon size={size === 'xs' ? 9 : 11} />{c.label}
        </span>
    )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ stats }) {
    if (!stats) return (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-7">
            {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 h-20 animate-pulse" />
            ))}
        </div>
    )

    const items = [
        { label: 'Total',         value: stats.total,                icon: BarChart3,   color: 'text-slate-700',   bg: 'bg-slate-50' },
        { label: 'Articles',      value: stats.journal_articles,     icon: BookOpen,    color: 'text-blue-600',    bg: 'bg-blue-50' },
        { label: 'Conferences',   value: stats.conference_papers,    icon: FileText,    color: 'text-violet-600',  bg: 'bg-violet-50' },
        { label: 'Patents',       value: stats.patents,              icon: Award,       color: 'text-amber-600',   bg: 'bg-amber-50' },
        { label: 'Community',     value: stats.community_impacts,    icon: Users,       color: 'text-green-600',   bg: 'bg-green-50' },
        { label: 'Tech Transfer', value: stats.technology_transfers, icon: TrendingUp,  color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    ]

    return (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-7">
            {items.map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 group hover:shadow-md transition-shadow">
                    <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center mb-2', bg)}>
                        <Icon size={14} className={color} />
                    </div>
                    <p className={cn('text-2xl font-bold leading-none', color)}>{value ?? 0}</p>
                    <p className="text-[11px] text-gray-400 mt-1 font-medium">{label}</p>
                </div>
            ))}
        </div>
    )
}

// ─── Inline detail rows ───────────────────────────────────────────────────────

function DetailRow({ label, value, link }) {
    if (!value && value !== 0) return null
    return (
        <div className="flex items-start gap-2 text-xs">
            <span className="text-gray-400 shrink-0 w-24 pt-0.5 font-medium">{label}</span>
            {link
                ? <a href={link} target="_blank" rel="noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-0.5 font-medium break-all">
                    {value}<ExternalLink size={9} className="shrink-0" />
                  </a>
                : <span className="text-gray-800 font-semibold wrap-break-word">{value}</span>
            }
        </div>
    )
}

function OutputMetaDetail({ output }) {
    const { output_type: t, publication: pub, patent: pat,
            conference_presentation: conf, technology: tech, community_impact: ci } = output

    const rows = []
    if (t === 'journal_article' || t === 'book') {
        if (pub?.journal_name) rows.push({ label: 'Journal',   value: pub.journal_name })
        if (pub?.doi)          rows.push({ label: 'DOI',       value: pub.doi, link: `https://doi.org/${pub.doi}` })
        if (pub?.year)         rows.push({ label: 'Year',      value: pub.year })
        if (pub?.volume || pub?.issue)
            rows.push({ label: 'Vol / Issue', value: [pub.volume, pub.issue].filter(Boolean).join(' / ') })
        if (pub?.is_scopus_indexed) rows.push({ label: 'Scopus', value: '✓ Indexed' })
        if (pub?.is_wos_indexed)    rows.push({ label: 'WoS',   value: '✓ Indexed' })
    }
    if (t === 'conference_paper') {
        if (conf?.conference_name)   rows.push({ label: 'Conference', value: conf.conference_name })
        if (conf?.location)          rows.push({ label: 'Location',   value: conf.location })
        if (conf?.presentation_date) rows.push({ label: 'Date',       value: formatDate(conf.presentation_date) })
        if (conf?.doi)               rows.push({ label: 'DOI',        value: conf.doi, link: `https://doi.org/${conf.doi}` })
    }
    if (t === 'patent') {
        if (pat?.patent_number) rows.push({ label: 'Patent No.',   value: pat.patent_number })
        if (pat?.jurisdiction)  rows.push({ label: 'Jurisdiction', value: pat.jurisdiction })
        if (pat?.status)        rows.push({ label: 'Status',       value: pat.status })
        if (pat?.filing_date)   rows.push({ label: 'Filed',        value: formatDate(pat.filing_date) })
        if (pat?.grant_date)    rows.push({ label: 'Granted',      value: formatDate(pat.grant_date) })
    }
    if (t === 'software' || t === 'prototype' || t === 'technology_transfer') {
        if (tech?.version)        rows.push({ label: 'Version',    value: tech.version })
        if (tech?.license)        rows.push({ label: 'License',    value: tech.license })
        if (tech?.repository_url) rows.push({ label: 'Repository', value: 'Open', link: tech.repository_url })
        if (tech?.demo_url)       rows.push({ label: 'Demo',       value: 'Open', link: tech.demo_url })
    }
    if (t === 'community_impact') {
        if (ci?.beneficiary_count) rows.push({ label: 'Beneficiaries', value: ci.beneficiary_count.toLocaleString() })
        if (ci?.location)          rows.push({ label: 'Location',      value: ci.location })
        if (ci?.impact_category)   rows.push({ label: 'Category',      value: ci.impact_category })
    }

    if (!rows.length) return null
    return (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {rows.map(r => <DetailRow key={r.label} {...r} />)}
        </div>
    )
}

// ─── Approval status badge ────────────────────────────────────────────────────

const APPROVAL_STATUS = {
    pending:  { label: 'Pending Review', color: 'bg-yellow-50 text-yellow-700 border-yellow-200',  icon: Clock },
    verified: { label: 'Verified',       color: 'bg-blue-50 text-blue-700 border-blue-200',        icon: ShieldCheck },
    approved: { label: 'Approved',       color: 'bg-green-50 text-green-700 border-green-200',     icon: CheckCircle2 },
    rejected: { label: 'Rejected',       color: 'bg-red-50 text-red-700 border-red-200',           icon: XCircle },
}

function ApprovalBadge({ status }) {
    const cfg  = APPROVAL_STATUS[status] ?? APPROVAL_STATUS.pending
    const Icon = cfg.icon
    return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', cfg.color)}>
            <Icon size={9} />{cfg.label}
        </span>
    )
}

// ─── Verify / Approve inline panel ───────────────────────────────────────────

function ReviewPanel({ output, action, onDone, onCancel }) {
    const { error } = useToast()
    const [notes,  setNotes]  = useState('')
    const [choice, setChoice] = useState(action === 'verify' ? 'verify' : null)
    const [saving, setSaving] = useState(false)

    const submit = async () => {
        setSaving(true)
        try {
            let res
            if (action === 'verify') {
                res = await api.post(`/research-outputs/${output.id}/verify`, { action: choice, review_notes: notes })
            } else {
                res = await api.post(`/research-outputs/${output.id}/approve`, { review_notes: notes })
            }
            onDone(res.data?.data)
        } catch (e) {
            error(e.response?.data?.message ?? 'Action failed.')
        }
        setSaving(false)
    }

    return (
        <div className="mx-4 mb-4 border border-indigo-100 rounded-xl bg-indigo-50/30 p-4 space-y-3">
            {action === 'verify' && (
                <div className="flex gap-2">
                    {[
                        { v: 'verify', label: 'Verify', color: 'blue' },
                        { v: 'reject', label: 'Reject', color: 'red' },
                    ].map(opt => (
                        <button key={opt.v} type="button" onClick={() => setChoice(opt.v)}
                            className={cn(
                                'flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all',
                                choice === opt.v
                                    ? opt.color === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            )}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Review notes (optional)…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none bg-white" />
            <div className="flex gap-2">
                <button onClick={submit} disabled={saving || (action === 'verify' && !choice)}
                    className={cn(
                        'flex items-center gap-1 px-3 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50',
                        action === 'approve' || choice === 'verify' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                    )}>
                    {saving ? '…' : action === 'approve' ? 'Approve' : (choice === 'reject' ? 'Reject' : 'Verify')}
                </button>
                <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
        </div>
    )
}

// ─── Output card ──────────────────────────────────────────────────────────────

function OutputCard({ output: initialOutput, canEdit, canDelete, canVerify, canApprove, onEdit, onDelete }) {
    const [expanded,     setExpanded]     = useState(false)
    const [reviewAction, setReviewAction] = useState(null)
    const [output,       setOutput]       = useState(initialOutput)
    const { confirm } = useConfirm()
    const c    = cfg(output.output_type)
    const Icon = c.icon

    const handleDelete = async (e) => {
        e.stopPropagation()
        const ok = await confirm({ title: 'Delete output?', message: `Remove "${output.title}"?`, danger: true })
        if (ok) onDelete(output.id)
    }

    const handleEdit = (e) => { e.stopPropagation(); onEdit(output) }

    const showVerify  = canVerify  && output.status === 'pending'
    const showApprove = canApprove && output.status === 'verified'

    return (
        <article className={cn(
            'bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200',
            'overflow-hidden flex flex-col border-l-4', c.accent
        )}>
            {/* Header — clickable to expand */}
            <div className="p-4 flex items-start gap-3 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm', c.bg)}>
                    <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <TypeBadge type={output.output_type} size="xs" />
                        <ApprovalBadge status={output.status ?? 'pending'} />
                        {output.proposal?.tracker_number && (
                            <span className="font-mono text-[10px] text-gray-400">{output.proposal.tracker_number}</span>
                        )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{output.title}</p>
                    {output.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{output.description}</p>
                    )}
                </div>
                <ChevronRight size={14} className={cn('text-gray-300 shrink-0 transition-transform mt-1', expanded && 'rotate-90')} />
            </div>

            {/* Footer meta */}
            <div className="px-4 pb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    {output.proposal?.college?.name && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
                            <Building2 size={10} className="shrink-0" />{output.proposal.college.name}
                        </span>
                    )}
                    {output.created_at && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                            <Calendar size={10} />{formatDate(output.created_at)}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {showVerify && reviewAction !== 'verify' && (
                        <button onClick={e => { e.stopPropagation(); setReviewAction('verify') }}
                            className="flex items-center gap-1 h-7 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold transition-colors"
                            title="Verify">
                            <ShieldCheck size={11} /> Verify
                        </button>
                    )}
                    {showApprove && reviewAction !== 'approve' && (
                        <button onClick={e => { e.stopPropagation(); setReviewAction('approve') }}
                            className="flex items-center gap-1 h-7 px-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-semibold transition-colors"
                            title="Approve">
                            <ThumbsUp size={11} /> Approve
                        </button>
                    )}
                    {canEdit && output.status === 'pending' && (
                        <button onClick={handleEdit}
                            className="h-7 w-7 rounded-lg bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 flex items-center justify-center transition-colors"
                            title="Edit">
                            <Pencil size={12} />
                        </button>
                    )}
                    {canDelete && (
                        <button onClick={handleDelete}
                            className="h-7 w-7 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                            title="Delete">
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Inline review panel */}
            {reviewAction && (
                <ReviewPanel
                    output={output}
                    action={reviewAction}
                    onDone={(updated) => { setOutput(updated); setReviewAction(null) }}
                    onCancel={() => setReviewAction(null)}
                />
            )}

            {/* Expanded detail */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-gray-50">
                    <OutputMetaDetail output={output} />
                    <div className="mt-3 space-y-1">
                        {output.recorded_by?.name && (
                            <p className="text-[10px] text-gray-400">Recorded by {output.recorded_by.name}</p>
                        )}
                        {output.verified_by?.name && (
                            <p className="text-[10px] text-blue-400 flex items-center gap-1">
                                <ShieldCheck size={9} /> Verified by {output.verified_by.name}
                                {output.verified_at && ` · ${formatDate(output.verified_at)}`}
                            </p>
                        )}
                        {output.approved_by?.name && (
                            <p className="text-[10px] text-green-500 flex items-center gap-1">
                                <CheckCircle2 size={9} /> Approved by {output.approved_by.name}
                                {output.approved_at && ` · ${formatDate(output.approved_at)}`}
                            </p>
                        )}
                        {output.review_notes && (
                            <p className="text-[10px] text-gray-500 italic mt-1">Note: {output.review_notes}</p>
                        )}
                    </div>
                </div>
            )}
        </article>
    )
}

// ─── Output form modal (Create & Edit) ───────────────────────────────────────

const EMPTY_FORM = {
    proposal_id: '', output_type: '', title: '', description: '',
    doi: '', journal_name: '', volume: '', issue: '', pages: '',
    year: '', publisher: '', is_scopus_indexed: false, is_wos_indexed: false,
    patent_number: '', jurisdiction: '', filing_date: '', grant_date: '', patent_status: '', technical_specs: '',
    conference_name: '', location: '', presentation_date: '', proceedings_isbn: '',
    version: '', repository_url: '', license: '', demo_url: '',
    beneficiary_count: '', impact_category: '',
}

function outputToForm(output) {
    const pub  = output.publication ?? {}
    const pat  = output.patent ?? {}
    const conf = output.conference_presentation ?? {}
    const tech = output.technology ?? {}
    const ci   = output.community_impact ?? {}
    return {
        proposal_id:       output.proposal_id ?? '',
        output_type:       output.output_type ?? '',
        title:             output.title ?? '',
        description:       output.description ?? '',
        doi:               pub.doi ?? conf.doi ?? '',
        journal_name:      pub.journal_name ?? '',
        volume:            pub.volume ?? '',
        issue:             pub.issue ?? '',
        pages:             pub.pages ?? '',
        year:              pub.year ? String(pub.year) : '',
        publisher:         pub.publisher ?? '',
        is_scopus_indexed: !!pub.is_scopus_indexed,
        is_wos_indexed:    !!pub.is_wos_indexed,
        patent_number:     pat.patent_number ?? '',
        jurisdiction:      pat.jurisdiction ?? '',
        filing_date:       pat.filing_date ? pat.filing_date.split('T')[0] : '',
        grant_date:        pat.grant_date  ? pat.grant_date.split('T')[0]  : '',
        patent_status:     pat.status ?? '',
        technical_specs:   pat.technical_specs ?? tech.technical_specs ?? '',
        conference_name:   conf.conference_name ?? '',
        location:          conf.location ?? ci.location ?? '',
        presentation_date: conf.presentation_date ? conf.presentation_date.split('T')[0] : '',
        proceedings_isbn:  conf.proceedings_isbn ?? '',
        version:           tech.version ?? '',
        repository_url:    tech.repository_url ?? '',
        license:           tech.license ?? '',
        demo_url:          tech.demo_url ?? '',
        beneficiary_count: ci.beneficiary_count ? String(ci.beneficiary_count) : '',
        impact_category:   ci.impact_category ?? '',
    }
}

function OutputFormModal({ editing, proposals, onClose, onSuccess }) {
    const { error }        = useToast()
    const isEdit           = !!editing
    const [saving, setSaving] = useState(false)
    const [form, setForm]  = useState(isEdit ? outputToForm(editing) : EMPTY_FORM)
    const set = (k, v)     => setForm(p => ({ ...p, [k]: v }))
    const t = form.output_type

    // ── DOI lookup (new outputs only) ──
    const [doiInput, setDoiInput]   = useState('')
    const [looking, setLooking]     = useState(false)
    const [lookup, setLookup]       = useState(null)

    const lookUpDoi = async () => {
        if (!doiInput.trim()) return
        setLooking(true)
        try {
            const res = await api.get('/research-outputs/doi-lookup', { params: { doi: doiInput.trim() }, skipErrorToast: true })
            const d = res.data?.data
            const canLink = d.suggestion && proposals.some(p => p.id === d.suggestion.proposal_id)
            setForm(prev => ({
                ...prev,
                ...Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v])),
                proposal_id: canLink ? d.suggestion.proposal_id : prev.proposal_id,
            }))
            setLookup({ ...d, linked: canLink })
        } catch (e) {
            setLookup(null)
            error(e.response?.data?.message ?? 'Could not look up this DOI.')
        }
        setLooking(false)
    }

    const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
    const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5'

    const submit = async () => {
        if (!isEdit && !form.proposal_id) return error('Select a proposal.')
        if (!form.output_type)            return error('Select an output type.')
        if (!form.title.trim())           return error('Enter a title.')
        setSaving(true)
        try {
            const payload = { ...form }
            if (payload.year)              payload.year              = parseInt(payload.year)
            if (payload.beneficiary_count) payload.beneficiary_count = parseInt(payload.beneficiary_count)
            if (isEdit) {
                await api.put(`/research-outputs/${editing.id}`, payload)
                onSuccess('Output updated.')
            } else {
                await api.post('/research-outputs', payload)
                onSuccess('Research output recorded.')
            }
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to save output.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className={cn('rounded-t-3xl px-6 py-5 flex items-center justify-between shrink-0',
                    isEdit ? 'bg-linear-to-r from-slate-700 to-slate-900' : 'bg-linear-to-r from-violet-600 to-indigo-600')}>
                    <div>
                        <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Research Output' : 'Record Research Output'}</h2>
                        <p className="text-white/60 text-xs mt-0.5">
                            {isEdit ? `Editing: ${editing.title.slice(0, 50)}${editing.title.length > 50 ? '…' : ''}` : 'Add a new output to a funded proposal'}
                        </p>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* DOI lookup */}
                    {!isEdit && (
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 mb-2">
                                <Wand2 size={13} /> Published with a DOI? Fill everything in from it
                            </label>
                            <div className="flex gap-2">
                                <input value={doiInput} onChange={e => setDoiInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookUpDoi() } }}
                                    placeholder="10.xxxx/xxxxx or https://doi.org/…" className={inputCls} />
                                <button type="button" onClick={lookUpDoi} disabled={looking || !doiInput.trim()}
                                    className="shrink-0 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                                    {looking ? 'Looking up…' : 'Look up'}
                                </button>
                            </div>
                            {lookup && (
                                <div className="mt-3 space-y-2 text-xs">
                                    <p className="text-gray-600">
                                        Filled in from Crossref{lookup.authors?.length ? <> · {lookup.authors.slice(0, 4).join(', ')}{lookup.authors.length > 4 ? ` +${lookup.authors.length - 4}` : ''}</> : null}. Check the details below.
                                    </p>
                                    {lookup.existing && (
                                        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-amber-800">
                                            <AlertTriangleIcon size={13} className="mt-px shrink-0" />
                                            Already recorded as “{lookup.existing.title}”{lookup.existing.tracker_number ? ` on ${lookup.existing.tracker_number}` : ''}. Saving it again will be refused.
                                        </p>
                                    )}
                                    {lookup.linked ? (
                                        <p className="flex items-start gap-1.5 text-emerald-700">
                                            <Link2 size={13} className="mt-px shrink-0" />
                                            Linked to {proposals.find(p => p.id === lookup.suggestion.proposal_id)?.tracker_number}. {lookup.suggestion.reason}
                                        </p>
                                    ) : (
                                        <p className="text-gray-500">Choose the project this output belongs to below.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Proposal — hidden when editing */}
                    {!isEdit && (
                        <div>
                            <label className={labelCls}>Proposal *</label>
                            <select value={form.proposal_id} onChange={e => set('proposal_id', e.target.value)} className={inputCls}>
                                <option value="">Select proposal…</option>
                                {proposals.map(p => (
                                    <option key={p.id} value={p.id}>[{p.tracker_number}] {p.title}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Output type — hidden when editing */}
                    {!isEdit && (
                        <div>
                            <label className={labelCls}>Output Type *</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {OUTPUT_TYPES.map(ot => {
                                    const Icon = ot.icon
                                    const sel  = form.output_type === ot.value
                                    return (
                                        <button key={ot.value} type="button" onClick={() => set('output_type', ot.value)}
                                            className={cn(
                                                'flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-semibold transition-all',
                                                sel ? `border-2 border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100`
                                                    : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/50'
                                            )}>
                                            <span className={cn('h-7 w-7 rounded-lg flex items-center justify-center text-white', sel ? ot.bg : 'bg-gray-200')}>
                                                <Icon size={14} />
                                            </span>
                                            {ot.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Common fields */}
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>Title *</label>
                            <input value={form.title} onChange={e => set('title', e.target.value)}
                                placeholder="Full title of the output" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Description</label>
                            <textarea value={form.description} onChange={e => set('description', e.target.value)}
                                rows={2} className={`${inputCls} resize-none`} placeholder="Optional summary…" />
                        </div>
                    </div>

                    {/* ── Type-specific fields ── */}
                    {(t === 'journal_article' || t === 'book') && (
                        <section className="space-y-3 pt-3 border-t border-gray-100">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Publication Details</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className={labelCls}>Journal / Publisher</label>
                                    <input value={form.journal_name} onChange={e => set('journal_name', e.target.value)} className={inputCls} placeholder="Journal or publisher name" />
                                </div>
                                <div>
                                    <label className={labelCls}>Year</label>
                                    <input type="number" value={form.year} onChange={e => set('year', e.target.value)} className={inputCls} placeholder="2024" />
                                </div>
                                <div>
                                    <label className={labelCls}>DOI</label>
                                    <input value={form.doi} onChange={e => set('doi', e.target.value)} className={inputCls} placeholder="10.xxxx/xxxxx" />
                                </div>
                                <div>
                                    <label className={labelCls}>Volume</label>
                                    <input value={form.volume} onChange={e => set('volume', e.target.value)} className={inputCls} placeholder="e.g. 12" />
                                </div>
                                <div>
                                    <label className={labelCls}>Issue / Pages</label>
                                    <div className="flex gap-2">
                                        <input value={form.issue} onChange={e => set('issue', e.target.value)} className={inputCls} placeholder="Iss" />
                                        <input value={form.pages} onChange={e => set('pages', e.target.value)} className={inputCls} placeholder="pp" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 pt-1">
                                {[['is_scopus_indexed', 'Scopus indexed'], ['is_wos_indexed', 'Web of Science indexed']].map(([k, lbl]) => (
                                    <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-gray-700">{lbl}</span>
                                    </label>
                                ))}
                            </div>
                        </section>
                    )}

                    {t === 'conference_paper' && (
                        <section className="space-y-3 pt-3 border-t border-gray-100">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Conference Details</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className={labelCls}>Conference Name</label>
                                    <input value={form.conference_name} onChange={e => set('conference_name', e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Location</label>
                                    <input value={form.location} onChange={e => set('location', e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Presentation Date</label>
                                    <input type="date" value={form.presentation_date} onChange={e => set('presentation_date', e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>DOI</label>
                                    <input value={form.doi} onChange={e => set('doi', e.target.value)} className={inputCls} placeholder="10.xxxx/xxxxx" />
                                </div>
                                <div>
                                    <label className={labelCls}>Proceedings ISBN</label>
                                    <input value={form.proceedings_isbn} onChange={e => set('proceedings_isbn', e.target.value)} className={inputCls} />
                                </div>
                            </div>
                        </section>
                    )}

                    {t === 'patent' && (
                        <section className="space-y-3 pt-3 border-t border-gray-100">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Patent Details</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Patent Number</label>
                                    <input value={form.patent_number} onChange={e => set('patent_number', e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Jurisdiction</label>
                                    <input value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)} className={inputCls} placeholder="Ethiopia, PCT…" />
                                </div>
                                <div>
                                    <label className={labelCls}>Status</label>
                                    <select value={form.patent_status} onChange={e => set('patent_status', e.target.value)} className={inputCls}>
                                        <option value="">Select…</option>
                                        {['filed', 'pending', 'granted', 'rejected'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Filing Date</label>
                                    <input type="date" value={form.filing_date} onChange={e => set('filing_date', e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Grant Date</label>
                                    <input type="date" value={form.grant_date} onChange={e => set('grant_date', e.target.value)} className={inputCls} />
                                </div>
                            </div>
                        </section>
                    )}

                    {(t === 'software' || t === 'prototype' || t === 'technology_transfer') && (
                        <section className="space-y-3 pt-3 border-t border-gray-100">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Technology Details</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Version</label>
                                    <input value={form.version} onChange={e => set('version', e.target.value)} className={inputCls} placeholder="e.g. 1.0.0" />
                                </div>
                                <div>
                                    <label className={labelCls}>License</label>
                                    <input value={form.license} onChange={e => set('license', e.target.value)} className={inputCls} placeholder="MIT, Apache 2.0…" />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelCls}>Repository URL</label>
                                    <input type="url" value={form.repository_url} onChange={e => set('repository_url', e.target.value)} className={inputCls} placeholder="https://github.com/…" />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelCls}>Demo URL</label>
                                    <input type="url" value={form.demo_url} onChange={e => set('demo_url', e.target.value)} className={inputCls} placeholder="https://…" />
                                </div>
                            </div>
                        </section>
                    )}

                    {t === 'community_impact' && (
                        <section className="space-y-3 pt-3 border-t border-gray-100">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Community Impact Details</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Beneficiary Count</label>
                                    <input type="number" value={form.beneficiary_count} onChange={e => set('beneficiary_count', e.target.value)} className={inputCls} placeholder="0" />
                                </div>
                                <div>
                                    <label className={labelCls}>Location</label>
                                    <input value={form.location} onChange={e => set('location', e.target.value)} className={inputCls} />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelCls}>Impact Category</label>
                                    <input value={form.impact_category} onChange={e => set('impact_category', e.target.value)} className={inputCls} placeholder="Health, Agriculture, Education…" />
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50/50 rounded-b-3xl">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={saving}
                        className={cn('px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50',
                            isEdit ? 'bg-slate-800 hover:bg-slate-900' : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200')}>
                        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Output'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResearchOutputs() {
    const { hasPermission, hasAnyPermission } = useAuth()
    const { success, error } = useToast()

    const [outputs,    setOutputs]    = useState([])
    const [stats,      setStats]      = useState(null)
    const [proposals,  setProposals]  = useState([])
    const [loading,    setLoading]    = useState(true)
    const [modal,      setModal]      = useState(null)   // null | 'create' | output-object
    const [typeFilter, setTypeFilter] = useState('')
    const [search,     setSearch]     = useState('')

    const canAdd    = hasAnyPermission(['research_outputs.create', 'research_outputs.record_any'])
    const canEdit   = canAdd
    const canDelete = hasPermission('research_outputs.delete')
    const canVerify = hasPermission('research_outputs.verify')
    const canApprove = hasPermission('research_outputs.approve')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [outRes, statsRes] = await Promise.all([
                api.get('/research-outputs'),
                api.get('/research-outputs/stats'),
            ])
            setOutputs(outRes.data?.data ?? [])
            setStats(statsRes.data?.data ?? null)
        } catch {
            error('Failed to load research outputs.')
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        load()
        api.get('/research-outputs/eligible-proposals')
            .then(r => setProposals(r.data?.data ?? []))
            .catch(() => {})
    }, [load])

    const handleDelete = async (id) => {
        try { await api.delete(`/research-outputs/${id}`); success('Output deleted.'); load() }
        catch { error('Failed to delete output.') }
    }

    const filtered = outputs.filter(o => {
        if (typeFilter && o.output_type !== typeFilter) return false
        if (search) {
            const q = search.toLowerCase()
            if (!o.title.toLowerCase().includes(q) &&
                !(o.proposal?.tracker_number ?? '').toLowerCase().includes(q) &&
                !(o.proposal?.college?.name ?? '').toLowerCase().includes(q)) return false
        }
        return true
    })

    return (
        <AppLayout breadcrumb="Research Outputs">
            {/* Page header */}
            <div className="flex items-start justify-between mb-7 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200">
                            <Sparkles size={15} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Research Outputs</h1>
                    </div>
                    <p className="text-sm text-gray-500">Track, record, and manage outputs from funded and completed proposals</p>
                </div>
                {canAdd && (
                    <button onClick={() => setModal('create')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-2xl transition-all shadow-sm shadow-indigo-200 shrink-0">
                        <Plus size={16} /> Record Output
                    </button>
                )}
            </div>

            <StatsStrip stats={stats} />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
                <div className="relative w-full sm:w-72">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search title, tracker, college…"
                        className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => setTypeFilter('')}
                        className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                            !typeFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>
                        All
                    </button>
                    {OUTPUT_TYPES.map(ot => {
                        const Icon = ot.icon
                        const sel  = typeFilter === ot.value
                        return (
                            <button key={ot.value} onClick={() => setTypeFilter(sel ? '' : ot.value)}
                                className={cn('flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                    sel ? `${ot.bg} text-white border-transparent` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                )}>
                                <Icon size={11} />{ot.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Result count */}
            {!loading && filtered.length > 0 && (
                <p className="text-xs text-gray-400 mb-4">
                    Showing <strong className="text-gray-600">{filtered.length}</strong> of {outputs.length} outputs
                    {(search || typeFilter) && <button onClick={() => { setSearch(''); setTypeFilter('') }} className="ml-2 text-indigo-500 hover:text-indigo-700 font-medium">Clear filters</button>}
                </p>
            )}

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-3 border-l-4 border-l-gray-100">
                            <div className="flex gap-3">
                                <div className="h-9 w-9 bg-gray-100 rounded-xl shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-20 bg-gray-100 rounded-full" />
                                    <div className="h-4 w-full bg-gray-100 rounded-lg" />
                                    <div className="h-3 w-4/5 bg-gray-50 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-28 text-center">
                    <div className="h-20 w-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex items-center justify-center mb-5">
                        <Microscope size={32} className="text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700 mb-2">
                        {search || typeFilter ? 'No matching outputs' : 'No outputs recorded yet'}
                    </h3>
                    <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
                        {search || typeFilter
                            ? 'Try adjusting your search or filter.'
                            : 'Use "Record Output" to add outputs for funded or completed proposals.'
                        }
                    </p>
                    {(search || typeFilter) && (
                        <button onClick={() => { setSearch(''); setTypeFilter('') }}
                            className="mt-5 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
                            <X size={13} /> Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(o => (
                        <OutputCard key={o.id} output={o}
                            canEdit={canEdit} canDelete={canDelete}
                            canVerify={canVerify} canApprove={canApprove}
                            onEdit={setModal} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {modal && (
                <OutputFormModal
                    editing={modal === 'create' ? null : modal}
                    proposals={proposals}
                    onClose={() => setModal(null)}
                    onSuccess={(msg) => { success(msg); setModal(null); load() }}
                />
            )}
        </AppLayout>
    )
}
