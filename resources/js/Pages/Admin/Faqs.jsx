import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, GripVertical, ToggleLeft, ToggleRight, HelpCircle } from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import ConfirmDialog from '../../Components/ConfirmDialog'
import { useToast } from '../../Components/Toast'
import { get, post, put, del } from '../../lib/api'

const BLANK = { question: '', answer: '', sort_order: 0, is_active: true }

// ─── Modal ────────────────────────────────────────────────────────────────────

function FaqModal({ faq, onClose, onSaved }) {
    const { success, error } = useToast()
    const [form, setForm]   = useState(faq ?? BLANK)
    const [saving, setSaving] = useState(false)

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.question.trim() || !form.answer.trim()) {
            error('Question and answer are required.')
            return
        }
        setSaving(true)
        try {
            const res = faq?.id
                ? await put(`/faqs/${faq.id}`, form)
                : await post('/faqs', form)
            success(faq?.id ? 'FAQ updated.' : 'FAQ created.')
            onSaved(res?.data ?? res)
        } catch (e) {
            error(e?.response?.data?.message ?? 'Save failed.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <HelpCircle size={18} className="text-indigo-600" />
                        </div>
                        <h2 className="font-semibold text-gray-900 text-sm">
                            {faq?.id ? 'Edit FAQ' : 'New FAQ'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Question <span className="text-red-500">*</span></label>
                        <input
                            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                            value={form.question}
                            onChange={e => set('question', e.target.value)}
                            placeholder="What is a Tracker Number?"
                            maxLength={500}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Answer <span className="text-red-500">*</span></label>
                        <textarea
                            rows={5}
                            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition resize-none"
                            value={form.answer}
                            onChange={e => set('answer', e.target.value)}
                            placeholder="A Tracker Number is automatically assigned…"
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sort Order</label>
                            <input
                                type="number"
                                min={0}
                                className="w-24 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                                value={form.sort_order}
                                onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">Active</label>
                            <button
                                type="button"
                                onClick={() => set('is_active', !form.is_active)}
                                className="flex items-center gap-2 text-sm font-medium transition-colors"
                                style={{ color: form.is_active ? '#16a34a' : '#9ca3af' }}
                            >
                                {form.is_active
                                    ? <ToggleRight size={26} className="text-green-500" />
                                    : <ToggleLeft  size={26} className="text-gray-300" />
                                }
                                {form.is_active ? 'Visible on site' : 'Hidden from site'}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 mt-2">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2">
                            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {faq?.id ? 'Save Changes' : 'Create FAQ'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function FaqRow({ faq, onEdit, onDelete, onToggle }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-start gap-4 group hover:shadow-sm transition-shadow">
            <div className="text-gray-300 group-hover:text-gray-400 transition-colors mt-0.5 cursor-grab shrink-0">
                <GripVertical size={18} />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{faq.question}</p>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{faq.answer}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => onToggle(faq)}
                    title={faq.is_active ? 'Visible — click to hide' : 'Hidden — click to show'}
                    className="transition-colors"
                >
                    {faq.is_active
                        ? <ToggleRight size={22} className="text-green-500 hover:text-green-600" />
                        : <ToggleLeft  size={22} className="text-gray-300 hover:text-gray-400" />
                    }
                </button>
                <button onClick={() => onEdit(faq)}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors">
                    <Pencil size={15} />
                </button>
                <button onClick={() => onDelete(faq)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Faqs() {
    const { success, error } = useToast()
    const [faqs, setFaqs]       = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal]     = useState(null) // null | 'new' | faq object
    const [toDelete, setToDelete] = useState(null)

    const load = () => {
        setLoading(true)
        get('/faqs')
            .then(r => setFaqs(r?.data ?? []))
            .catch(() => error('Failed to load FAQs.'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSaved = (saved) => {
        setModal(null)
        load()
    }

    const handleToggle = async (faq) => {
        try {
            await put(`/faqs/${faq.id}`, { ...faq, is_active: !faq.is_active })
            setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, is_active: !f.is_active } : f))
        } catch {
            error('Failed to update.')
        }
    }

    const handleDelete = async () => {
        if (!toDelete) return
        try {
            await del(`/faqs/${toDelete.id}`)
            success('FAQ deleted.')
            setFaqs(prev => prev.filter(f => f.id !== toDelete.id))
        } catch {
            error('Failed to delete.')
        } finally {
            setToDelete(null)
        }
    }

    return (
        <AppLayout>
            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
                            <HelpCircle size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">FAQ Management</h1>
                            <p className="text-xs text-gray-500 mt-0.5">
                                FAQs appear on the public home page when the FAQ section is enabled.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setModal('new')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Add FAQ
                    </button>
                </div>

                {/* Tip */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700 mb-5 flex items-start gap-2">
                    <HelpCircle size={14} className="mt-0.5 shrink-0 text-blue-500" />
                    <span>
                        Use <strong>Sort Order</strong> (lower = higher on page) to control the display sequence.
                        Toggle the switch on each row to show or hide individual FAQs without deleting them.
                        The FAQ section visibility is controlled in <strong>Administration → Settings → Public Site</strong>.
                    </span>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : faqs.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <HelpCircle size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No FAQs yet</p>
                        <p className="text-xs mt-1">Click "Add FAQ" to create your first entry.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {faqs.map(faq => (
                            <FaqRow
                                key={faq.id}
                                faq={faq}
                                onEdit={setModal}
                                onDelete={setToDelete}
                                onToggle={handleToggle}
                            />
                        ))}
                        <p className="text-center text-xs text-gray-400 mt-2">
                            {faqs.length} FAQ{faqs.length !== 1 ? 's' : ''} · {faqs.filter(f => f.is_active).length} visible
                        </p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && (
                <FaqModal
                    faq={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={handleSaved}
                />
            )}

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!toDelete}
                title="Delete FAQ"
                message={`Delete "${toDelete?.question}"? This cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setToDelete(null)}
            />
        </AppLayout>
    )
}
