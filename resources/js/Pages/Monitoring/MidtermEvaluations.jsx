import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Activity, CheckCircle2, Clock, X, ChevronRight,
    FileText, Upload, Star, AlertTriangle, Plus, MapPin,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useAuth } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../Components/Toast'
import { formatDate, formatCurrency } from '../../lib/utils'
import api from '../../lib/api'

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    scheduled:        { label: 'Scheduled',        color: 'bg-blue-100 text-blue-700',    icon: Clock },
    report_submitted: { label: 'Report Submitted',  color: 'bg-amber-100 text-amber-700',  icon: FileText },
    scored:           { label: 'Scored',            color: 'bg-purple-100 text-purple-700', icon: Star },
    completed:        { label: 'Completed',         color: 'bg-slate-100 text-slate-600',  icon: CheckCircle2 },
}

const REC_CONFIG = {
    continue: { label: 'Continue ✅', color: 'bg-green-100 text-green-700' },
    hold:     { label: 'Hold ⛔',     color: 'bg-red-100 text-red-700' },
}

function StatusBadge({ status }) {
    const cfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled
    const Icon = cfg.icon
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
            <Icon size={10} />{cfg.label}
        </span>
    )
}

// ─── Schedule modal ─────────────────────────────────────────────────────────────

function ScheduleModal({ fundedProposals, onClose, onSuccess }) {
    const { error } = useToast()
    const [mode,   setMode]   = useState('individual')
    const [form,   setForm]   = useState({ proposal_id: '', evaluation_date: '', venue: '' })
    const [saving, setSaving] = useState(false)
    const timeRef = useRef(null)
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
    const today = new Date().toISOString().split('T')[0]

    const submit = async () => {
        const time = timeRef.current?.value ?? ''
        if (!form.evaluation_date) return error('Select an evaluation date.')
        if (!time)                  return error('Select an evaluation time.')
        if (!form.venue)            return error('Enter a venue.')
        if (mode === 'individual' && !form.proposal_id) return error('Select a proposal.')
        setSaving(true)
        try {
            if (mode === 'individual') {
                await api.post('/midterm-evaluations', { ...form, evaluation_time: time })
                onSuccess('Evaluation scheduled. PI has been notified.')
            } else {
                const res = await api.post('/midterm-evaluations/bulk-schedule', {
                    evaluation_date: form.evaluation_date,
                    evaluation_time: time,
                    venue:           form.venue,
                })
                const { scheduled, skipped } = res.data?.data ?? {}
                onSuccess(`${scheduled} evaluation(s) scheduled for your college.${skipped > 0 ? ` (${skipped} already active)` : ''}`)
            }
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to schedule evaluation.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-t-2xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Schedule Midterm Evaluation</h2>
                        <p className="text-blue-100 text-xs mt-0.5">Set date, time and venue — PI will be notified</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={16} /></button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Mode toggle */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { key: 'individual', label: 'Individual Proposal' },
                            { key: 'college',    label: 'Whole College' },
                        ].map(m => (
                            <button key={m.key} type="button" onClick={() => setMode(m.key)}
                                className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                                    mode === m.key
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}>
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Individual: proposal selector */}
                    {mode === 'individual' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Proposal (Round 1 settled) *</label>
                            {fundedProposals.length === 0 ? (
                                <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">
                                    No proposals in your college have completed Round 1 settlement yet.
                                </div>
                            ) : (
                                <select value={form.proposal_id} onChange={e => set('proposal_id', e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select proposal…</option>
                                    {fundedProposals.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.tracker_number} — {p.title}{p.pi ? ` (PI: ${p.pi.name})` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* College bulk: info box */}
                    {mode === 'college' && (
                        <div className="border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
                            {fundedProposals.length === 0
                                ? 'No proposals in your college have completed Round 1 settlement yet.'
                                : `This will schedule midterm evaluations for all ${fundedProposals.length} eligible proposal(s) in your college using the same date, time, and venue.`
                            }
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                            <input type="date" value={form.evaluation_date} min={today}
                                onChange={e => set('evaluation_date', e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                            <input ref={timeRef} type="time"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Venue *</label>
                        <input type="text" value={form.venue} onChange={e => set('venue', e.target.value)}
                            placeholder="e.g. Conference Hall A, Main Campus"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit}
                        disabled={saving || (mode === 'college' && fundedProposals.length === 0)}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Scheduling…' : mode === 'college' ? 'Schedule All' : 'Schedule'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Submit report modal ────────────────────────────────────────────────────────

function FilePickerRow({ label, hint, file, onFile, onClear }) {
    const ref = useRef(null)
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
            <div
                onClick={() => ref.current?.click()}
                className={`border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition-colors text-center ${
                    file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-amber-400'
                }`}
            >
                {file ? (
                    <div className="flex items-center justify-center gap-2">
                        <FileText size={14} className="text-green-600 shrink-0" />
                        <span className="text-sm text-green-700 font-medium truncate">{file.name}</span>
                        <button type="button" onClick={e => { e.stopPropagation(); onClear() }}
                            className="text-red-400 hover:text-red-600 shrink-0">
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Upload size={14} />
                        <span className="text-sm">Click to attach PDF (optional)</span>
                    </div>
                )}
            </div>
            <input ref={ref} type="file" accept=".pdf" className="hidden"
                onChange={e => onFile(e.target.files[0] ?? null)} />
        </div>
    )
}

function SubmitReportModal({ evaluation, onClose, onSuccess }) {
    const { error, success } = useToast()
    const [form, setForm] = useState({
        progress_summary:                 '',
        financial_utilization_percentage: '',
        publications_count:               '0',
        challenges:                       '',
        milestones_achieved:              '',
        milestones_missed:                '',
    })
    const [progressFile,  setProgressFile]  = useState(null)
    const [financialFile, setFinancialFile] = useState(null)
    const [saving,        setSaving]        = useState(false)
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

    const uploadFile = async (id, file, type) => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', type)
        await api.post(`/midterm-evaluations/${id}/upload-report`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
    }

    const submit = async () => {
        if (!form.progress_summary) return error('Progress summary is required.')
        setSaving(true)
        try {
            const res = await api.post(`/midterm-evaluations/${evaluation.id}/submit-report`, form)
            const id  = res.data?.data?.id ?? evaluation.id

            if (progressFile)  await uploadFile(id, progressFile,  'progress')
            if (financialFile) await uploadFile(id, financialFile, 'financial')

            onSuccess()
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to submit report.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-8">

                {/* Header */}
                <div className="bg-linear-to-r from-amber-500 to-orange-500 rounded-t-2xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Submit Midterm Report</h2>
                        <p className="text-amber-100 text-xs mt-0.5">
                            {evaluation.proposal?.tracker_number} · {evaluation.proposal?.title}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-5">

                    {/* Progress summary */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Progress Summary <span className="text-red-500">*</span>
                        </label>
                        <textarea rows={4} value={form.progress_summary}
                            onChange={e => set('progress_summary', e.target.value)}
                            placeholder="Describe the overall research progress achieved since the last report…"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Financial Utilisation (%)
                            </label>
                            <input type="number" min="0" max="100" step="0.01"
                                value={form.financial_utilization_percentage}
                                onChange={e => set('financial_utilization_percentage', e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                placeholder="e.g. 65.5" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Publications Count
                            </label>
                            <input type="number" min="0" value={form.publications_count}
                                onChange={e => set('publications_count', e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                    </div>

                    {/* Milestones */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Milestones Achieved</label>
                            <textarea rows={3} value={form.milestones_achieved}
                                onChange={e => set('milestones_achieved', e.target.value)}
                                placeholder="List completed milestones…"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Milestones Missed</label>
                            <textarea rows={3} value={form.milestones_missed}
                                onChange={e => set('milestones_missed', e.target.value)}
                                placeholder="List any missed milestones…"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                    </div>

                    {/* Challenges */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Challenges Faced</label>
                        <textarea rows={2} value={form.challenges}
                            onChange={e => set('challenges', e.target.value)}
                            placeholder="Describe any challenges or blockers encountered…"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>

                    {/* File uploads */}
                    <div className="border-t border-gray-100 pt-4 space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Attachments (optional PDFs)
                        </p>
                        <FilePickerRow
                            label="Progress Report (PDF)"
                            hint="Detailed written progress report"
                            file={progressFile}
                            onFile={setProgressFile}
                            onClear={() => setProgressFile(null)}
                        />
                        <FilePickerRow
                            label="Financial Report (PDF)"
                            hint="Budget utilization and expenditure details"
                            file={financialFile}
                            onFile={setFinancialFile}
                            onClear={() => setFinancialFile(null)}
                        />
                    </div>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                        {saving ? 'Submitting…' : 'Submit Report'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Score modal ────────────────────────────────────────────────────────────────

function ScoreModal({ evaluation, onClose, onSuccess }) {
    const { error } = useToast()
    // Pre-fill when re-scoring an already-scored evaluation
    const [score,          setScore]          = useState(evaluation.progress_score?.toString() ?? '')
    const [recommendation, setRecommendation] = useState(evaluation.recommendation ?? '')
    const [comments,       setComments]       = useState(evaluation.college_officer_comments ?? '')
    const [saving,         setSaving]         = useState(false)
    const isRescore = evaluation.status === 'scored'

    const submit = async () => {
        if (!score)          return error('Enter a progress score.')
        if (!recommendation) return error('Select a recommendation.')
        setSaving(true)
        try {
            await api.post(`/midterm-evaluations/${evaluation.id}/score`, {
                progress_score:  parseFloat(score),
                recommendation,
                comments,
            })
            onSuccess()
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to score evaluation.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="bg-linear-to-r from-purple-600 to-indigo-600 rounded-t-2xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            {isRescore ? 'Update Score' : 'Score Midterm Evaluation'}
                        </h2>
                        <p className="text-purple-100 text-xs mt-0.5">
                            {evaluation.proposal?.tracker_number}
                            {isRescore && ' · updating previous score'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Progress Score (0 – 100) *</label>
                        <input type="number" min="0" max="100" step="0.1" value={score}
                            onChange={e => setScore(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="0 – 100" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Recommendation *</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: 'continue', label: '✅ Continue', desc: 'PI passes — next round unlocked', color: 'green' },
                                { value: 'hold',     label: '⛔ Hold',     desc: 'PI fails — next round blocked',  color: 'red'   },
                            ].map(opt => (
                                <button key={opt.value} type="button"
                                    onClick={() => setRecommendation(opt.value)}
                                    className={`border-2 rounded-xl p-3 text-left transition-all ${
                                        recommendation === opt.value
                                            ? opt.color === 'green'
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-red-500 bg-red-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                        <textarea rows={3} value={comments} onChange={e => setComments(e.target.value)}
                            placeholder="Add evaluation notes or feedback for the PI…"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit} disabled={saving || !recommendation}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                            recommendation === 'hold' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                        }`}>
                        {saving ? 'Saving…' : isRescore ? 'Update Score' : 'Submit Score'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Evaluation card ─────────────────────────────────────────────────────────

function ReportViewer({ evalId, type, label }) {
    const { error } = useToast()
    const [pdfUrl,     setPdfUrl]     = useState(null)
    const [pdfOpen,    setPdfOpen]    = useState(false)
    const [pdfLoading, setPdfLoading] = useState(false)

    useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

    const toggle = useCallback(async () => {
        if (pdfOpen) { setPdfOpen(false); return }
        if (pdfUrl)  { setPdfOpen(true);  return }
        setPdfLoading(true)
        try {
            const res = await api.get(`/midterm-evaluations/${evalId}/download-report/${type}`, { responseType: 'blob' })
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
            setPdfUrl(url)
            setPdfOpen(true)
        } catch {
            error('Failed to load report.')
        }
        setPdfLoading(false)
    }, [pdfOpen, pdfUrl, evalId, type])

    const download = () => {
        const link = document.createElement('a')
        const fetchAndDownload = async () => {
            if (!pdfUrl) {
                const res = await api.get(`/midterm-evaluations/${evalId}/download-report/${type}`, { responseType: 'blob' })
                const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
                link.href = url; link.download = `midterm-${type}-report.pdf`
                document.body.appendChild(link); link.click(); link.remove()
                URL.revokeObjectURL(url)
            } else {
                link.href = pdfUrl; link.download = `midterm-${type}-report.pdf`
                document.body.appendChild(link); link.click(); link.remove()
            }
        }
        fetchAndDownload().catch(() => error('Download failed.'))
    }

    return (
        <div>
            <div className="flex items-center gap-3 py-1.5">
                <FileText size={14} className="text-blue-500 shrink-0" />
                <span className="text-xs font-medium text-gray-700">{label}</span>
                <button onClick={toggle} disabled={pdfLoading}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                    {pdfLoading ? 'Loading…' : pdfOpen ? 'Hide' : 'View'}
                </button>
                <span className="text-gray-300 text-xs">|</span>
                <button onClick={download} className="text-xs text-blue-600 hover:underline">Download</button>
            </div>
            {pdfOpen && pdfUrl && (
                <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                    <iframe src={pdfUrl} title={label} className="w-full h-96" />
                </div>
            )}
        </div>
    )
}

function EvaluationCard({ evaluation, isPI, isOfficer, onRefresh }) {
    const [expanded,    setExpanded]    = useState(false)
    const [showReport,  setShowReport]  = useState(false)
    const [showScore,   setShowScore]   = useState(false)

    const proposal = evaluation.proposal
    const canSubmitReport = isPI && evaluation.status === 'scheduled'
    const canScore        = isOfficer && evaluation.status === 'report_submitted'
    const canRescore      = isOfficer && evaluation.status === 'scored'
    const hasReports      = evaluation.progress_report_path || evaluation.financial_report_path

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden hover:shadow-sm transition-shadow ${
            evaluation.recommendation === 'continue' ? 'border-green-200' :
            evaluation.recommendation === 'hold'     ? 'border-red-200'   : 'border-gray-200'
        }`}>
            {/* Card header */}
            <div className="px-5 py-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(v => !v)}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0">
                        <Activity size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs font-bold text-blue-600">{proposal?.tracker_number}</span>
                            <StatusBadge status={evaluation.status} />
                            {evaluation.recommendation && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${REC_CONFIG[evaluation.recommendation]?.color}`}>
                                    {REC_CONFIG[evaluation.recommendation]?.label}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{proposal?.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {proposal?.college?.name} · PI: {proposal?.pi?.name}
                            {evaluation.evaluation_date && (
                                <> · <strong>{formatDate(evaluation.evaluation_date)}</strong>
                                {evaluation.evaluation_time && <> at <strong>{evaluation.evaluation_time.slice(0,5)}</strong></>}
                                </>
                            )}
                            {evaluation.venue && <> · {evaluation.venue}</>}
                            {evaluation.progress_score != null && (
                                <> · Score: <strong>{evaluation.progress_score}/100</strong></>
                            )}
                        </p>
                    </div>
                </div>
                {expanded
                    ? <span className="text-gray-400 text-xs">▲</span>
                    : <span className="text-gray-400 text-xs">▼</span>}
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">
                    {/* Progress timeline */}
                    <div className="flex items-center gap-2">
                        {[
                            { label: 'Scheduled',        done: true },
                            { label: 'Report Submitted', done: ['report_submitted','scored','completed'].includes(evaluation.status) },
                            { label: 'Scored',           done: ['scored','completed'].includes(evaluation.status) },
                        ].map((s, i) => (
                            <div key={s.label} className="flex items-center gap-2 flex-1">
                                <div className="flex flex-col items-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        s.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                                    }`}>
                                        {s.done ? '✓' : i + 1}
                                    </div>
                                    <p className="text-xs text-center text-gray-500 mt-1 leading-tight">{s.label}</p>
                                </div>
                                {i < 2 && <div className={`flex-1 h-0.5 mb-5 ${s.done ? 'bg-green-400' : 'bg-gray-200'}`} />}
                            </div>
                        ))}
                    </div>

                    {/* Progress summary */}
                    {evaluation.progress_summary && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Progress Summary</p>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{evaluation.progress_summary}</p>
                        </div>
                    )}

                    {/* Metrics row */}
                    {(evaluation.financial_utilization_percentage != null || evaluation.publications_count > 0) && (
                        <div className="grid grid-cols-2 gap-3">
                            {evaluation.financial_utilization_percentage != null && (
                                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500">Financial Utilisation</p>
                                    <p className="text-xl font-bold text-blue-700">{evaluation.financial_utilization_percentage}%</p>
                                </div>
                            )}
                            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">Publications</p>
                                <p className="text-xl font-bold text-gray-900">{evaluation.publications_count}</p>
                            </div>
                        </div>
                    )}

                    {/* Milestones */}
                    {evaluation.milestones_achieved && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs font-semibold text-green-700 mb-0.5">Milestones Achieved</p>
                            <p className="text-xs text-green-600 whitespace-pre-line">{evaluation.milestones_achieved}</p>
                        </div>
                    )}
                    {evaluation.milestones_missed && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs font-semibold text-red-700 mb-0.5">Milestones Missed</p>
                            <p className="text-xs text-red-600 whitespace-pre-line">{evaluation.milestones_missed}</p>
                        </div>
                    )}
                    {evaluation.challenges && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs font-semibold text-amber-700 mb-0.5">Challenges</p>
                            <p className="text-xs text-amber-600 whitespace-pre-line">{evaluation.challenges}</p>
                        </div>
                    )}

                    {/* Attached reports */}
                    {hasReports && (
                        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Attached Reports</p>
                            {evaluation.progress_report_path && (
                                <ReportViewer
                                    evalId={evaluation.id}
                                    type="progress"
                                    label="Progress Report"
                                />
                            )}
                            {evaluation.financial_report_path && (
                                <ReportViewer
                                    evalId={evaluation.id}
                                    type="financial"
                                    label="Financial Report"
                                />
                            )}
                        </div>
                    )}

                    {/* Officer comments */}
                    {evaluation.college_officer_comments && (
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-xs font-semibold text-purple-700 mb-0.5">
                                Officer Comments · {evaluation.scored_by?.name}
                            </p>
                            <p className="text-xs text-purple-600">{evaluation.college_officer_comments}</p>
                        </div>
                    )}

                    {/* Budget unlock status */}
                    {evaluation.recommendation === 'continue' && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                            <p className="text-sm font-semibold text-green-700">
                                Next funding round unlocked for this proposal
                            </p>
                        </div>
                    )}
                    {evaluation.recommendation === 'hold' && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertTriangle size={16} className="text-red-600 shrink-0" />
                            <p className="text-sm font-semibold text-red-700">
                                Next funding round is blocked until hold is resolved
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                        {canSubmitReport && (
                            <button onClick={() => setShowReport(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600">
                                <FileText size={12} /> Submit Report
                            </button>
                        )}
                        {canScore && (
                            <button onClick={() => setShowScore(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700">
                                <Star size={12} /> Score Evaluation
                            </button>
                        )}
                        {canRescore && (
                            <button onClick={() => setShowScore(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 text-purple-700 bg-purple-50 text-xs font-semibold rounded-lg hover:bg-purple-100">
                                <Star size={12} /> Update Score
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showReport && (
                <SubmitReportModal
                    evaluation={evaluation}
                    onClose={() => setShowReport(false)}
                    onSuccess={() => { setShowReport(false); onRefresh() }}
                />
            )}
            {showScore && (
                <ScoreModal
                    evaluation={evaluation}
                    onClose={() => setShowScore(false)}
                    onSuccess={() => { setShowScore(false); onRefresh() }}
                />
            )}
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MidtermEvaluations() {
    const { hasAnyRole } = useAuth()
    const { success, error } = useToast()

    const isOfficer = hasAnyRole(['super_admin', 'central_office', 'college_admin', 'college_officer',
                                   'research_officer', 'community_officer', 'technology_officer'])
    const isPI      = hasAnyRole(['pi', 'staff'])

    const [evaluations,     setEvaluations]     = useState([])
    const [fundedProposals, setFundedProposals] = useState([])
    const [stats,           setStats]           = useState(null)
    const [loading,         setLoading]         = useState(true)
    const [activeTab,       setActiveTab]       = useState('all')
    const [showSchedule,    setShowSchedule]    = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [evRes, stRes] = await Promise.all([
                api.get('/midterm-evaluations'),
                api.get('/midterm-evaluations/stats'),
            ])
            setEvaluations(evRes.data?.data ?? [])
            setStats(stRes.data?.data ?? null)
        } catch {
            error('Failed to load midterm evaluations.')
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        load()
        if (isOfficer) {
            // Only proposals from this officer's college that have completed Round 1 settlement
            api.get('/midterm-evaluations/eligible-proposals')
                .then(r => setFundedProposals(r.data?.data ?? []))
                .catch(() => {})
        }
    }, [load, isOfficer])

    const TABS = [
        { key: 'all',              label: 'All',              count: evaluations.length },
        { key: 'scheduled',        label: 'Scheduled',        count: evaluations.filter(e => e.status === 'scheduled').length },
        { key: 'report_submitted', label: 'Report Submitted', count: evaluations.filter(e => e.status === 'report_submitted').length },
        { key: 'scored',           label: 'Scored',           count: evaluations.filter(e => e.status === 'scored').length },
    ]

    const filtered = activeTab === 'all'
        ? evaluations
        : evaluations.filter(e => e.status === activeTab)

    return (
        <AppLayout breadcrumb="Midterm Evaluations">
            <div className="max-w-5xl mx-auto space-y-6 p-6">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Activity size={24} className="text-blue-600" />
                            Midterm Evaluations
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Progress reviews that gate the next funding round
                        </p>
                    </div>
                    {isOfficer && (
                        <button onClick={() => setShowSchedule(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 shadow-sm shrink-0">
                            <Plus size={15} /> Schedule Evaluation
                        </button>
                    )}
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total',            value: stats.total,            color: 'text-blue-600',   icon: '📋' },
                            { label: 'Awaiting Report',  value: stats.scheduled,        color: 'text-amber-600',  icon: '⏳' },
                            { label: 'Awaiting Score',   value: stats.report_submitted, color: 'text-purple-600', icon: '📊' },
                            { label: 'Passed (Continue)',value: stats.continue,         color: 'text-green-600',  icon: '✅' },
                        ].map(s => (
                            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                                <div className="text-2xl mb-1">{s.icon}</div>
                                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* How it gates budget */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3">How Midterm Evaluation Gates Funding</p>
                    <div className="flex items-center gap-2 overflow-x-auto">
                        {[
                            { icon: '💰', label: 'Round 1',          desc: 'Max 50% of award' },
                            { icon: '📋', label: 'Settle Round 1',   desc: 'Finance verifies' },
                            { icon: '📊', label: 'Midterm Eval',     desc: 'PI submits report' },
                            { icon: '⭐', label: 'Officer Scores',   desc: '"Continue" or "Hold"' },
                            { icon: '🔓', label: 'Round 2 Unlocked', desc: 'Remaining 50% available' },
                        ].map((s, i) => (
                            <div key={s.label} className="flex items-center gap-2 shrink-0">
                                <div className="text-center">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-lg mx-auto mb-1">
                                        {s.icon}
                                    </div>
                                    <p className="text-xs font-semibold text-blue-700">{s.label}</p>
                                    <p className="text-xs text-gray-400">{s.desc}</p>
                                </div>
                                {i < 4 && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-1 border-b border-gray-200">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}>
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                    activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                }`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <Activity size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-600 font-medium">No midterm evaluations</p>
                        <p className="text-sm text-gray-400 mt-1">
                            {isOfficer
                                ? 'Schedule an evaluation for a funded proposal using the button above.'
                                : 'Your evaluations will appear here once scheduled by the college officer.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(ev => (
                            <EvaluationCard
                                key={ev.id}
                                evaluation={ev}
                                isPI={isPI}
                                isOfficer={isOfficer}
                                onRefresh={load}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showSchedule && (
                <ScheduleModal
                    fundedProposals={fundedProposals}
                    onClose={() => setShowSchedule(false)}
                    onSuccess={(msg) => {
                        setShowSchedule(false)
                        success(msg)
                        load()
                    }}
                />
            )}
        </AppLayout>
    )
}
