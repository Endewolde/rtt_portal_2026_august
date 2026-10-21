import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Award, CheckCircle2, Clock, X, ChevronRight,
    FileText, Upload, Star, AlertTriangle, Plus,
    Calendar, MapPin, Link, XCircle, PauseCircle,
    MessageCircle, Send, Reply, Loader2, Paperclip,
    ListChecks, Square, CheckSquare,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useAuth } from '../../hooks/useAuth'
import { useFeature } from '../../hooks/useFeature'
import { useToast } from '../../Components/Toast'
import { formatDate } from '../../lib/utils'
import api from '../../lib/api'

const CLOSURE_CHECKLIST_LABELS = {
    final_report_submitted: 'Final project report submitted',
    financial_settlement_verified: 'Financial settlement verified',
    research_outputs_recorded: 'Research outputs recorded',
    equipment_returned: 'Equipment / assets returned',
    ip_disclosures_filed: 'IP disclosures filed',
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    scheduled:  { label: 'Scheduled',  color: 'bg-blue-100 text-blue-700',   icon: Clock },
    completed:  { label: 'Completed',  color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-700',     icon: XCircle },
    postponed:  { label: 'Postponed',  color: 'bg-amber-100 text-amber-700', icon: PauseCircle },
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

function ScheduleModal({ eligibleProposals, onClose, onSuccess }) {
    const { error } = useToast()
    const [mode, setMode] = useState('individual')
    const [form, setForm] = useState({ proposal_id: '', date: '', venue: '', online_link: '' })
    const [saving, setSaving] = useState(false)
    const timeRef = useRef(null)
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
    const today = new Date().toISOString().split('T')[0]

    const submit = async () => {
        const time = timeRef.current?.value ?? ''
        if (!form.date)  return error('Select a workshop date.')
        if (!time)        return error('Select a workshop time.')
        if (!form.venue) return error('Enter a venue.')
        if (mode === 'individual' && !form.proposal_id) return error('Select a proposal.')
        setSaving(true)
        try {
            if (mode === 'individual') {
                await api.post('/completion-workshops', { ...form, time })
                onSuccess('Workshop scheduled. PI has been notified.')
            } else {
                const res = await api.post('/completion-workshops/bulk-schedule', {
                    date: form.date, time, venue: form.venue, online_link: form.online_link,
                })
                const { scheduled, skipped } = res.data?.data ?? {}
                onSuccess(`${scheduled} workshop(s) scheduled for your college.${skipped > 0 ? ` (${skipped} already active)` : ''}`)
            }
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to schedule workshop.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                <div className="bg-linear-to-r from-yellow-500 to-amber-500 rounded-t-2xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Schedule Completion Workshop</h2>
                        <p className="text-yellow-100 text-xs mt-0.5">Final presentation before archival</p>
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
                                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}>
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {mode === 'individual' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Proposal (midterm passed) *</label>
                            {eligibleProposals.length === 0 ? (
                                <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">
                                    No proposals have passed midterm evaluation yet.
                                </div>
                            ) : (
                                <select value={form.proposal_id} onChange={e => set('proposal_id', e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <option value="">Select proposal…</option>
                                    {eligibleProposals.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.tracker_number} — {p.title}{p.pi ? ` (PI: ${p.pi.name})` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {mode === 'college' && (
                        <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">
                            {eligibleProposals.length === 0
                                ? 'No proposals in your college have passed midterm evaluation yet.'
                                : `This will schedule completion workshops for all ${eligibleProposals.length} eligible proposal(s) in your college using the same date, time, and venue.`
                            }
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                            <input type="date" value={form.date} min={today}
                                onChange={e => set('date', e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                            <input ref={timeRef} type="time"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Venue *</label>
                        <input type="text" value={form.venue} onChange={e => set('venue', e.target.value)}
                            placeholder="e.g. Conference Hall A, Main Campus"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Online Link (optional)</label>
                        <input type="url" value={form.online_link} onChange={e => set('online_link', e.target.value)}
                            placeholder="https://meet.example.com/…"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit}
                        disabled={saving || (mode === 'college' && eligibleProposals.length === 0)}
                        className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">
                        {saving ? 'Scheduling…' : mode === 'college' ? 'Schedule All' : 'Schedule Workshop'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Finalize modal ─────────────────────────────────────────────────────────────

function FinalizeModal({ workshop, onClose, onSuccess }) {
    const { error } = useToast()
    const { hasSubFeature } = useFeature()
    const proposalId = workshop.proposal_id ?? workshop.proposal?.id
    const checklistEnabled = hasSubFeature('workflow.closure_checklist')

    const [score,   setScore]   = useState('')
    const [remarks, setRemarks] = useState('')
    const [saving,  setSaving]  = useState(false)
    const [checklist, setChecklist] = useState(null)
    const [togglingKey, setTogglingKey] = useState(null)

    useEffect(() => {
        if (!checklistEnabled || !proposalId) return
        api.get(`/proposals/${proposalId}/closure-checklist`)
            .then(r => setChecklist(r.data?.data ?? null))
            .catch(() => {})
    }, [checklistEnabled, proposalId])

    const toggleItem = async (key, checked) => {
        setTogglingKey(key)
        try {
            const res = await api.post(`/proposals/${proposalId}/closure-checklist`, { key, checked })
            setChecklist(res.data?.data ?? null)
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to update checklist.')
        }
        setTogglingKey(null)
    }

    const checklistBlocking = checklistEnabled && !checklist?.is_complete

    const submit = async () => {
        const s = parseFloat(score)
        if (isNaN(s) || s < 0 || s > 100) return error('Enter a valid score between 0 and 100.')
        if (checklistBlocking) return error('Complete the closure checklist before finalizing.')
        setSaving(true)
        try {
            await api.post(`/completion-workshops/${workshop.id}/finalize`, { final_score: s, evaluator_remarks: remarks })
            onSuccess()
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to finalize workshop.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                <div className="bg-linear-to-r from-green-600 to-emerald-600 rounded-t-2xl px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Finalize Workshop</h2>
                        <p className="text-green-100 text-xs mt-0.5">{workshop.proposal?.tracker_number}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                        This will mark the proposal as <strong>Completed</strong> and queue it for archival in 30 days.
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Final Score (0 – 100) *</label>
                        <input type="number" min="0" max="100" step="0.1" value={score}
                            onChange={e => setScore(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="0 – 100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Evaluator Remarks (optional)</label>
                        <textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                            placeholder="Overall feedback on the presentation…"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                    </div>
                    {checklistEnabled && (
                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                                <ListChecks size={15} /> Closure Checklist
                            </label>
                            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                                {Object.entries(CLOSURE_CHECKLIST_LABELS).map(([key, label]) => {
                                    const checked = !!checklist?.items?.[key]
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => toggleItem(key, !checked)}
                                            disabled={togglingKey === key}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-gray-50 disabled:opacity-60"
                                        >
                                            {checked
                                                ? <CheckSquare size={16} className="text-green-600 shrink-0" />
                                                : <Square size={16} className="text-gray-300 shrink-0" />}
                                            <span className={checked ? 'text-gray-700' : 'text-gray-500'}>{label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                            {checklistBlocking && (
                                <p className="text-xs text-amber-600 mt-1.5">All items must be checked before this workshop can be finalized.</p>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit} disabled={saving || checklistBlocking}
                        className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                        {saving ? 'Finalizing…' : 'Finalize & Complete'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Status update modal ────────────────────────────────────────────────────────

function StatusModal({ workshop, onClose, onSuccess }) {
    const { error } = useToast()
    const [status,  setStatus]  = useState('')
    const [saving,  setSaving]  = useState(false)

    const options = [
        { value: 'postponed', label: 'Postpone', color: 'amber', icon: PauseCircle },
        { value: 'cancelled', label: 'Cancel',   color: 'red',   icon: XCircle },
    ]

    const submit = async () => {
        if (!status) return error('Select a status.')
        setSaving(true)
        try {
            await api.patch(`/completion-workshops/${workshop.id}/status`, { status })
            onSuccess()
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to update status.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                <div className="bg-linear-to-r from-gray-600 to-gray-700 rounded-t-2xl px-6 py-5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Update Workshop Status</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-3">
                    {options.map(opt => {
                        const Icon = opt.icon
                        const selected = status === opt.value
                        return (
                            <button key={opt.value} type="button" onClick={() => setStatus(opt.value)}
                                className={`w-full flex items-center gap-3 border-2 rounded-xl p-3 text-left transition-all ${
                                    selected
                                        ? opt.color === 'red'
                                            ? 'border-red-500 bg-red-50'
                                            : 'border-amber-500 bg-amber-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}>
                                <Icon size={16} className={selected
                                    ? opt.color === 'red' ? 'text-red-600' : 'text-amber-600'
                                    : 'text-gray-400'} />
                                <span className="text-sm font-medium text-gray-800">{opt.label} Workshop</span>
                            </button>
                        )
                    })}
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit} disabled={saving || !status}
                        className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Update Status'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Q&A thread ───────────────────────────────────────────────────────────────

function QAThread({ workshopId, currentUserId, isPI, isOfficer }) {
    const { success, error } = useToast()
    const [questions,    setQuestions]    = useState([])
    const [loading,      setLoading]      = useState(true)
    const [newQ,         setNewQ]         = useState('')
    const [posting,      setPosting]      = useState(false)
    const [answeringId,  setAnsweringId]  = useState(null)
    const [answerText,   setAnswerText]   = useState('')
    const [savingAnswer, setSavingAnswer] = useState(false)

    useEffect(() => {
        api.get(`/completion-workshops/${workshopId}/questions`)
            .then(r => setQuestions(r.data?.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [workshopId])

    const postQuestion = async () => {
        if (!newQ.trim()) return
        setPosting(true)
        try {
            const res = await api.post(`/completion-workshops/${workshopId}/questions`, { question: newQ })
            setQuestions(prev => [...prev, res.data?.data])
            setNewQ('')
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to post question.')
        }
        setPosting(false)
    }

    const submitAnswer = async (questionId) => {
        if (!answerText.trim()) return
        setSavingAnswer(true)
        try {
            const res = await api.patch(`/completion-workshops/${workshopId}/questions/${questionId}/answer`, { answer: answerText })
            setQuestions(prev => prev.map(q => q.id === questionId ? res.data?.data : q))
            setAnsweringId(null)
            setAnswerText('')
            success('Answer posted.')
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to post answer.')
        }
        setSavingAnswer(false)
    }

    const deleteQuestion = async (questionId) => {
        try {
            await api.delete(`/completion-workshops/${workshopId}/questions/${questionId}`)
            setQuestions(prev => prev.filter(q => q.id !== questionId))
        } catch (e) {
            error('Failed to delete question.')
        }
    }

    return (
        <div className="border border-blue-100 rounded-xl bg-blue-50/30">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-100">
                <MessageCircle size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Questions & Discussion</span>
                {questions.length > 0 && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                        {questions.length}
                    </span>
                )}
            </div>

            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-blue-400" />
                    </div>
                ) : questions.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">
                        No questions yet. Be the first to ask!
                    </p>
                ) : (
                    <div className="space-y-3">
                        {questions.map(q => (
                            <div key={q.id} className="bg-white border border-gray-100 rounded-xl p-3 space-y-2">
                                {/* Question */}
                                <div className="flex items-start gap-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0 mt-0.5">
                                        {q.user?.name?.[0] ?? '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="text-xs font-semibold text-gray-800">{q.user?.name}</span>
                                            <span className="text-[10px] text-gray-400">
                                                {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-700 leading-relaxed">{q.question}</p>
                                    </div>
                                    {(q.user_id === currentUserId) && !q.answer && (
                                        <button onClick={() => deleteQuestion(q.id)}
                                            className="text-gray-300 hover:text-red-400 shrink-0">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>

                                {/* Existing answer */}
                                {q.answer && (
                                    <div className="ml-8 pl-3 border-l-2 border-green-200">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Reply size={10} className="text-green-600" />
                                            <span className="text-[10px] font-semibold text-green-700">{q.answered_by?.name}</span>
                                            <span className="text-[10px] text-gray-400">answered</span>
                                        </div>
                                        <p className="text-xs text-gray-700 leading-relaxed">{q.answer}</p>
                                    </div>
                                )}

                                {/* Answer input */}
                                {(isPI || isOfficer) && !q.answer && answeringId !== q.id && (
                                    <button onClick={() => { setAnsweringId(q.id); setAnswerText('') }}
                                        className="ml-8 flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 font-medium">
                                        <Reply size={10} /> Answer
                                    </button>
                                )}
                                {answeringId === q.id && (
                                    <div className="ml-8 space-y-2">
                                        <textarea
                                            rows={2}
                                            value={answerText}
                                            onChange={e => setAnswerText(e.target.value)}
                                            placeholder="Type your answer…"
                                            className="w-full text-xs border border-green-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-400 resize-none"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => submitAnswer(q.id)} disabled={savingAnswer || !answerText.trim()}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
                                                {savingAnswer ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                                Post Answer
                                            </button>
                                            <button onClick={() => setAnsweringId(null)}
                                                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Post new question */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newQ}
                        onChange={e => setNewQ(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postQuestion()}
                        placeholder="Ask a question or leave a comment…"
                        className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button onClick={postQuestion} disabled={posting || !newQ.trim()}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                        {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── File upload strip (for PI/team when workshop is scheduled) ───────────────

function UploadStrip({ workshopId, workshop, onUploaded }) {
    const { success, error } = useToast()
    const fileRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const [uploadType, setUploadType] = useState('presentation')

    const handleFile = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', uploadType)
        try {
            await api.post(`/completion-workshops/${workshopId}/upload`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            success(`${uploadType === 'report' ? 'Report' : 'Presentation'} uploaded.`)
            onUploaded()
        } catch (e) {
            error(e.response?.data?.message ?? 'Upload failed.')
        }
        setUploading(false)
        e.target.value = ''
    }

    const fileCount = (
        (workshop.presentation_files?.length ?? 0) +
        (workshop.photos?.length ?? 0) +
        (workshop.videos?.length ?? 0) +
        (workshop.final_report_path ? 1 : 0)
    )

    return (
        <div className="border border-indigo-100 rounded-xl bg-indigo-50/40 p-4">
            <div className="flex items-center gap-2 mb-3">
                <Paperclip size={14} className="text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700">Upload Your Presentation / Report</span>
                {fileCount > 0 && (
                    <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                        {fileCount} file{fileCount !== 1 ? 's' : ''} uploaded
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <select value={uploadType} onChange={e => setUploadType(e.target.value)}
                    className="text-xs border border-indigo-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white">
                    <option value="presentation">Presentation (PPT/PDF)</option>
                    <option value="report">Final Report</option>
                    <option value="photo">Photo</option>
                </select>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png" />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {uploading ? 'Uploading…' : 'Choose File'}
                </button>
                <span className="text-[10px] text-gray-400">PDF, PPT, PPTX, DOC, DOCX, JPG, PNG · max 50MB</span>
            </div>
        </div>
    )
}

// ─── Workshop card ────────────────────────────────────────────────────────────

function WorkshopCard({ workshop, isOfficer, currentUserId, onRefresh }) {
    const [expanded,      setExpanded]      = useState(false)
    const [showFinalize,  setShowFinalize]  = useState(false)
    const [showStatus,    setShowStatus]    = useState(false)
    const [workshopData,  setWorkshopData]  = useState(workshop)

    const proposal  = workshopData.proposal
    const isPI      = proposal?.pi_user_id === currentUserId
    const canUpload = (isPI || isOfficer) && workshopData.status === 'scheduled'
    const canFinalize     = isOfficer && workshopData.status === 'scheduled'
    const canChangeStatus = isOfficer && workshopData.status === 'scheduled'

    const reloadWorkshop = async () => {
        try {
            const res = await api.get(`/completion-workshops/${workshopData.id}`)
            setWorkshopData(res.data?.data ?? workshopData)
        } catch {
            onRefresh()
        }
    }

    const fileCount = (
        (workshopData.presentation_files?.length ?? 0) +
        (workshopData.photos?.length ?? 0) +
        (workshopData.videos?.length ?? 0) +
        (workshopData.final_report_path ? 1 : 0)
    )

    return (
        <div className={`bg-white border rounded-2xl overflow-hidden hover:shadow-sm transition-shadow ${
            workshopData.status === 'completed' ? 'border-green-200' :
            workshopData.status === 'cancelled' ? 'border-red-200'   :
            workshopData.status === 'postponed' ? 'border-amber-200' : 'border-gray-200'
        }`}>
            {/* Card header */}
            <div className="px-5 py-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(v => !v)}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-yellow-50 border border-yellow-100 rounded-xl flex items-center justify-center shrink-0">
                        <Award size={18} className="text-yellow-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs font-bold text-yellow-700">{proposal?.tracker_number}</span>
                            <StatusBadge status={workshopData.status} />
                            {workshopData.final_score != null && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">
                                    Score: {workshopData.final_score}/100
                                </span>
                            )}
                            {fileCount > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    <Paperclip size={9} className="inline mr-0.5" />{fileCount}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{proposal?.title}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span>{proposal?.college?.name}</span>
                            <span>PI: {proposal?.pi?.name}</span>
                            {workshopData.scheduled_date && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={10} />
                                    {formatDate(workshopData.scheduled_date)}
                                    {workshopData.scheduled_time && ` · ${workshopData.scheduled_time.slice(0, 5)}`}
                                </span>
                            )}
                            {workshopData.venue && (
                                <span className="flex items-center gap-1">
                                    <MapPin size={10} />
                                    {workshopData.venue}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {expanded ? <span className="text-gray-400 text-xs">▲</span> : <span className="text-gray-400 text-xs">▼</span>}
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">

                    {/* Online link */}
                    {workshopData.online_link && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                            <Link size={14} />
                            <a href={workshopData.online_link} target="_blank" rel="noopener noreferrer"
                                className="hover:underline truncate">{workshopData.online_link}</a>
                        </div>
                    )}

                    {/* Proposal info grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {proposal?.duration_months && (
                            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">Duration</p>
                                <p className="text-lg font-bold text-gray-900">{proposal.duration_months}mo</p>
                            </div>
                        )}
                        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                            <p className="text-xs text-gray-500">Category</p>
                            <p className="text-xs font-bold text-gray-900 capitalize mt-1">
                                {proposal?.category?.replace(/_/g, ' ')}
                            </p>
                        </div>
                        {fileCount > 0 && (
                            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500">Files</p>
                                <p className="text-lg font-bold text-blue-700">{fileCount}</p>
                            </div>
                        )}
                    </div>

                    {/* Evidence summary */}
                    {(workshopData.presentation_files?.length > 0 || workshopData.photos?.length > 0 ||
                        workshopData.videos?.length > 0 || workshopData.final_report_path) && (
                        <div className="border border-gray-200 rounded-xl p-3 bg-white space-y-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Evidence Uploaded</p>
                            {workshopData.final_report_path && (
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <FileText size={12} className="text-blue-500" /> Final Report
                                </div>
                            )}
                            {workshopData.presentation_files?.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <FileText size={12} className="text-purple-500" />
                                    {workshopData.presentation_files.length} Presentation File(s)
                                </div>
                            )}
                            {workshopData.photos?.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <FileText size={12} className="text-green-500" /> {workshopData.photos.length} Photo(s)
                                </div>
                            )}
                            {workshopData.videos?.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <FileText size={12} className="text-red-500" /> {workshopData.videos.length} Video(s)
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upload strip for PI and officers */}
                    {canUpload && (
                        <UploadStrip
                            workshopId={workshopData.id}
                            workshop={workshopData}
                            onUploaded={reloadWorkshop}
                        />
                    )}

                    {/* Q&A thread */}
                    <QAThread
                        workshopId={workshopData.id}
                        currentUserId={currentUserId}
                        isPI={isPI}
                        isOfficer={isOfficer}
                    />

                    {/* Evaluator remarks */}
                    {workshopData.evaluator_remarks && (
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-xs font-semibold text-purple-700 mb-0.5">Evaluator Remarks</p>
                            <p className="text-xs text-purple-600 whitespace-pre-line">{workshopData.evaluator_remarks}</p>
                        </div>
                    )}

                    {/* Completed state */}
                    {workshopData.status === 'completed' && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                            <p className="text-sm font-semibold text-green-700">
                                Workshop completed · Final score: {workshopData.final_score}/100 · Archival queued in 30 days
                            </p>
                        </div>
                    )}

                    {/* Scheduled by */}
                    <p className="text-xs text-gray-400">
                        Scheduled by {workshopData.scheduled_by_user?.name ?? workshopData.scheduledBy?.name ?? '—'}
                        {workshopData.created_at && ` on ${formatDate(workshopData.created_at)}`}
                    </p>

                    {/* Officer actions */}
                    {(canFinalize || canChangeStatus) && (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                            {canFinalize && (
                                <button onClick={() => setShowFinalize(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                                    <Star size={12} /> Finalize Workshop
                                </button>
                            )}
                            {canChangeStatus && (
                                <button onClick={() => setShowStatus(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 bg-white text-xs font-semibold rounded-lg hover:bg-gray-50">
                                    <AlertTriangle size={12} /> Postpone / Cancel
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {showFinalize && (
                <FinalizeModal
                    workshop={workshopData}
                    onClose={() => setShowFinalize(false)}
                    onSuccess={() => { setShowFinalize(false); onRefresh() }}
                />
            )}
            {showStatus && (
                <StatusModal
                    workshop={workshopData}
                    onClose={() => setShowStatus(false)}
                    onSuccess={() => { setShowStatus(false); onRefresh() }}
                />
            )}
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompletionWorkshops() {
    const { hasPermission, user } = useAuth()
    const { success, error } = useToast()

    const isOfficer = hasPermission('monitoring.ongoing')

    const [workshops,         setWorkshops]         = useState([])
    const [eligibleProposals, setEligibleProposals] = useState([])
    const [stats,             setStats]             = useState(null)
    const [loading,           setLoading]           = useState(true)
    const [activeTab,         setActiveTab]         = useState('all')
    const [showSchedule,      setShowSchedule]      = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [wRes, sRes] = await Promise.all([
                api.get('/completion-workshops'),
                api.get('/completion-workshops/stats'),
            ])
            setWorkshops(wRes.data?.data ?? [])
            setStats(sRes.data?.data ?? null)
        } catch {
            error('Failed to load completion workshops.')
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        load()
        if (isOfficer) {
            api.get('/completion-workshops/eligible-proposals')
                .then(r => setEligibleProposals(r.data?.data ?? []))
                .catch(() => {})
        }
    }, [load, isOfficer])

    const TABS = [
        { key: 'all',       label: 'All',       count: workshops.length },
        { key: 'scheduled', label: 'Scheduled', count: workshops.filter(w => w.status === 'scheduled').length },
        { key: 'completed', label: 'Completed', count: workshops.filter(w => w.status === 'completed').length },
        { key: 'postponed', label: 'Postponed', count: workshops.filter(w => w.status === 'postponed').length },
    ]

    const filtered = activeTab === 'all'
        ? workshops
        : workshops.filter(w => w.status === activeTab)

    return (
        <AppLayout breadcrumb="Completion Workshops">
            <div className="max-w-5xl mx-auto space-y-6 p-6">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Award size={24} className="text-yellow-600" />
                            Completion Workshops
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Final presentation event before proposal archival
                        </p>
                    </div>
                    {isOfficer && (
                        <button onClick={() => setShowSchedule(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-xl text-sm font-semibold hover:bg-yellow-700 shadow-sm shrink-0">
                            <Plus size={15} /> Schedule Workshop
                        </button>
                    )}
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total',     value: stats.total,     color: 'text-yellow-600', icon: '🏆' },
                            { label: 'Scheduled', value: stats.scheduled, color: 'text-blue-600',   icon: '📅' },
                            { label: 'Completed', value: stats.completed, color: 'text-green-600',  icon: '✅' },
                            { label: 'Postponed', value: stats.postponed, color: 'text-amber-600',  icon: '⏸️' },
                        ].map(s => (
                            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                                <div className="text-2xl mb-1">{s.icon}</div>
                                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Lifecycle banner */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Completion Workshop Lifecycle</p>
                    <div className="flex items-center gap-2 overflow-x-auto">
                        {[
                            { icon: '📊', label: 'Midterm Passed',    desc: '"Continue" recommendation' },
                            { icon: '📅', label: 'Workshop Scheduled', desc: 'Date, venue & PI notified' },
                            { icon: '📤', label: 'PI Uploads Slides',  desc: 'PPT / report uploaded' },
                            { icon: '💬', label: 'Q&A Discussion',     desc: 'Participants ask questions' },
                            { icon: '⭐', label: 'Final Score',         desc: 'Officer scores 0–100' },
                            { icon: '🗂️', label: 'Archival (30 days)', desc: 'Auto-archived after 30 days' },
                        ].map((s, i) => (
                            <div key={s.label} className="flex items-center gap-2 shrink-0">
                                <div className="text-center">
                                    <div className="w-10 h-10 rounded-full bg-yellow-50 border-2 border-yellow-200 flex items-center justify-center text-lg mx-auto mb-1">
                                        {s.icon}
                                    </div>
                                    <p className="text-xs font-semibold text-yellow-700">{s.label}</p>
                                    <p className="text-xs text-gray-400">{s.desc}</p>
                                </div>
                                {i < 5 && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Eligible proposals reminder for officers */}
                {isOfficer && eligibleProposals.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                        <div className="flex items-start sm:items-center gap-2 text-sm text-yellow-800">
                            <AlertTriangle size={16} className="text-yellow-600 shrink-0 mt-0.5 sm:mt-0" />
                            <span>
                                <strong>{eligibleProposals.length}</strong> proposal(s) have passed midterm and are awaiting a completion workshop.
                            </span>
                        </div>
                        <button onClick={() => setShowSchedule(true)}
                            className="text-xs font-semibold text-yellow-700 hover:underline shrink-0 self-start sm:self-auto sm:ml-4">
                            Schedule now →
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex flex-wrap gap-1 border-b border-gray-200">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'border-yellow-600 text-yellow-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}>
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                    activeTab === tab.key ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                }`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <Award size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-600 font-medium">No completion workshops</p>
                        <p className="text-sm text-gray-400 mt-1">
                            {isOfficer
                                ? 'Schedule a workshop for proposals that have passed midterm evaluation.'
                                : 'Your completion workshop will appear here once scheduled.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(w => (
                            <WorkshopCard
                                key={w.id}
                                workshop={w}
                                isOfficer={isOfficer}
                                currentUserId={user?.id}
                                onRefresh={load}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showSchedule && (
                <ScheduleModal
                    eligibleProposals={eligibleProposals}
                    onClose={() => setShowSchedule(false)}
                    onSuccess={(msg) => {
                        setShowSchedule(false)
                        success(msg)
                        load()
                        api.get('/completion-workshops/eligible-proposals')
                            .then(r => setEligibleProposals(r.data?.data ?? []))
                            .catch(() => {})
                    }}
                />
            )}
        </AppLayout>
    )
}
