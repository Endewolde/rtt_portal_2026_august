import { useState, useEffect } from 'react';
import { ChevronRight, Plus, Pencil, Trash2, Star, ClipboardList } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { useToast } from '../../Components/Toast';
import api from '../../lib/api';
import { programmes } from '../../lib/programmes';

/** The organisation's programmes as select options (Settings → Programmes). */
const proposal_categoriesOptions = () => programmes({ includeInactive: true }).map((p) => ({ value: p.key, label: p.name }));

const EMPTY_TYPE     = { name: '', label: '', proposal_category: 'research', description: '' };
const EMPTY_CATEGORY = { name: '', description: '', weight: 10 };
const EMPTY_QUESTION = { question_text: '', max_score: 5, weight: 1, is_required: true };

function Modal({ title, onClose, children, onSave, saveLabel = 'Save' }) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                </div>
                <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">{children}</div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button onClick={onSave}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                        {saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FormField({ label, required, children }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
        </div>
    );
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function EvaluationCriteria() {
    const { success, error } = useToast();

    const [types, setTypes]               = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [categories, setCategories]     = useState([]);
    const [selectedCat, setSelectedCat]   = useState(null);
    const [questions, setQuestions]       = useState([]);
    const [loading, setLoading]           = useState(true);

    const [modal, setModal]           = useState(null); // 'type' | 'category' | 'question'
    const [editingItem, setEditingItem] = useState(null);
    const [typeForm, setTypeForm]       = useState(EMPTY_TYPE);
    const [catForm, setCatForm]         = useState(EMPTY_CATEGORY);
    const [qForm, setQForm]             = useState(EMPTY_QUESTION);

    const loadTypes = async () => {
        setLoading(true);
        try {
            const res = await api.get('/evaluation-types', { params: { all_statuses: 1 } });
            setTypes(res.data?.data ?? []);
        } catch { error('Failed to load evaluation types.'); }
        setLoading(false);
    };

    const loadCategories = async (typeId) => {
        try {
            const res = await api.get(`/evaluation-types/${typeId}/categories`);
            setCategories(res.data?.data ?? []);
            setSelectedCat(null);
            setQuestions([]);
        } catch { error('Failed to load categories.'); }
    };

    const loadQuestions = async (catId) => {
        try {
            const res = await api.get(`/evaluation-categories/${catId}/questions`);
            setQuestions(res.data?.data ?? []);
        } catch { error('Failed to load questions.'); }
    };

    useEffect(() => { loadTypes(); }, []);

    const selectType = (t) => { setSelectedType(t); loadCategories(t.id); };
    const selectCat  = (c) => { setSelectedCat(c); loadQuestions(c.id); };

    // ── Open modals ────────────────────────────────────────────────────────────

    const openNewType = () => { setEditingItem(null); setTypeForm(EMPTY_TYPE); setModal('type'); };
    const openEditType = (t, e) => { e.stopPropagation(); setEditingItem(t); setTypeForm({ label: t.label, description: t.description ?? '', is_active: t.is_active }); setModal('type'); };
    const openNewCat  = () => { setEditingItem(null); setCatForm(EMPTY_CATEGORY); setModal('category'); };
    const openEditCat = (c, e) => { e.stopPropagation(); setEditingItem(c); setCatForm({ name: c.name, description: c.description ?? '', weight: c.weight }); setModal('category'); };
    const openNewQ    = () => { setEditingItem(null); setQForm(EMPTY_QUESTION); setModal('question'); };
    const openEditQ   = (q) => { setEditingItem(q); setQForm({ question_text: q.question_text, max_score: q.max_score, weight: q.weight, is_required: q.is_required }); setModal('question'); };

    const closeModal = () => { setModal(null); setEditingItem(null); };

    // ── Save ──────────────────────────────────────────────────────────────────

    const saveType = async () => {
        try {
            if (editingItem) {
                await api.put(`/evaluation-types/${editingItem.id}`, typeForm);
                success('Evaluation type updated.');
            } else {
                await api.post('/evaluation-types', typeForm);
                success('Evaluation type created.');
            }
            closeModal();
            loadTypes();
        } catch (e) { error(e.response?.data?.message ?? 'Failed to save.'); }
    };

    const saveCat = async () => {
        if (!selectedType) return;
        try {
            if (editingItem) {
                await api.put(`/evaluation-categories/${editingItem.id}`, catForm);
                success('Category updated.');
            } else {
                await api.post(`/evaluation-types/${selectedType.id}/categories`, catForm);
                success('Category created.');
            }
            closeModal();
            loadCategories(selectedType.id);
        } catch (e) { error(e.response?.data?.message ?? 'Failed to save.'); }
    };

    const saveQ = async () => {
        if (!selectedCat) return;
        try {
            if (editingItem) {
                await api.put(`/evaluation-questions/${editingItem.id}`, qForm);
                success('Question updated.');
            } else {
                await api.post(`/evaluation-categories/${selectedCat.id}/questions`, qForm);
                success('Question created.');
            }
            closeModal();
            loadQuestions(selectedCat.id);
        } catch (e) { error(e.response?.data?.message ?? 'Failed to save.'); }
    };

    // ── Delete ────────────────────────────────────────────────────────────────

    const deleteCat = async (cat, e) => {
        e.stopPropagation();
        try {
            await api.delete(`/evaluation-categories/${cat.id}`);
            success('Category deleted.');
            if (selectedCat?.id === cat.id) { setSelectedCat(null); setQuestions([]); }
            loadCategories(selectedType.id);
        } catch (e) { error(e.response?.data?.message ?? 'Cannot delete.'); }
    };

    const deleteQ = async (q) => {
        try {
            await api.delete(`/evaluation-questions/${q.id}`);
            success('Question deleted.');
            loadQuestions(selectedCat.id);
        } catch { error('Failed to delete question.'); }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumb="Evaluation Criteria">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <ClipboardList size={24} className="text-blue-600" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Evaluation Criteria</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Manage evaluation types, categories, and scoring questions</p>
                    </div>
                </div>
                <button onClick={openNewType}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    <Plus size={15} /> New Evaluation Type
                </button>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <span className={!selectedType ? 'font-medium text-gray-700' : 'text-gray-400'}>Types</span>
                {selectedType && (
                    <>
                        <ChevronRight size={14} />
                        <span className={!selectedCat ? 'font-medium text-gray-700' : 'text-gray-400'}>{selectedType.label}</span>
                    </>
                )}
                {selectedCat && (
                    <>
                        <ChevronRight size={14} />
                        <span className="font-medium text-gray-700">{selectedCat.name}</span>
                    </>
                )}
            </div>

            {/* 3-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Column 1 — Types */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-700">Evaluation Types</p>
                        <p className="text-xs text-gray-400 mt-0.5">Select a type to manage categories</p>
                    </div>
                    <div className="divide-y divide-gray-100 flex-1">
                        {loading && <div className="p-6 text-center text-sm text-gray-400">Loading…</div>}
                        {!loading && types.length === 0 && (
                            <div className="p-6 text-center text-sm text-gray-400">No types yet. Create one above.</div>
                        )}
                        {types.map((t) => (
                            <div key={t.id} onClick={() => selectType(t)}
                                className={`px-4 py-3 cursor-pointer flex items-center gap-2 hover:bg-blue-50 transition-colors ${
                                    selectedType?.id === t.id ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-3' : ''
                                }`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{t.label}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                            {proposal_categoriesOptions().find((c) => c.value === t.proposal_category)?.label ?? t.proposal_category}
                                        </span>
                                        <span className="text-xs text-gray-400">{t.categories_count ?? 0} cats</span>
                                        {!t.is_active && <span className="text-xs text-gray-400 italic">inactive</span>}
                                    </div>
                                </div>
                                <button onClick={(e) => openEditType(t, e)} className="p-1 text-gray-400 hover:text-blue-600 rounded shrink-0">
                                    <Pencil size={13} />
                                </button>
                                <ChevronRight size={14} className={`text-gray-300 shrink-0 transition-transform ${selectedType?.id === t.id ? 'rotate-90 text-blue-400' : ''}`} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Column 2 — Categories */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">Categories</p>
                            <p className="text-xs text-gray-400 mt-0.5">{selectedType ? selectedType.label : 'Select a type first'}</p>
                        </div>
                        {selectedType && (
                            <button onClick={openNewCat}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                                <Plus size={13} /> Add
                            </button>
                        )}
                    </div>
                    <div className="divide-y divide-gray-100 flex-1">
                        {!selectedType ? (
                            <div className="p-6 text-center text-sm text-gray-400">← Select an evaluation type</div>
                        ) : categories.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-sm text-gray-400">No categories yet.</p>
                                <button onClick={openNewCat} className="mt-2 text-xs text-blue-600 hover:underline">Add first category</button>
                            </div>
                        ) : categories.map((cat) => (
                            <div key={cat.id} onClick={() => selectCat(cat)}
                                className={`px-4 py-3 cursor-pointer flex items-center gap-2 hover:bg-blue-50 transition-colors ${
                                    selectedCat?.id === cat.id ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-3' : ''
                                }`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{cat.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-gray-400">Weight: {cat.weight}%</span>
                                        <span className="text-xs text-gray-400">{cat.questions_count ?? 0} questions</span>
                                    </div>
                                </div>
                                <button onClick={(e) => openEditCat(cat, e)} className="p-1 text-gray-400 hover:text-blue-600 rounded shrink-0"><Pencil size={13} /></button>
                                <button onClick={(e) => deleteCat(cat, e)} className="p-1 text-gray-400 hover:text-red-600 rounded shrink-0"><Trash2 size={13} /></button>
                                <ChevronRight size={14} className={`text-gray-300 shrink-0 transition-transform ${selectedCat?.id === cat.id ? 'rotate-90 text-blue-400' : ''}`} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Column 3 — Questions */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">Questions</p>
                            <p className="text-xs text-gray-400 mt-0.5">{selectedCat ? selectedCat.name : 'Select a category first'}</p>
                        </div>
                        {selectedCat && (
                            <button onClick={openNewQ}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                                <Plus size={13} /> Add
                            </button>
                        )}
                    </div>
                    <div className="divide-y divide-gray-100 flex-1 overflow-y-auto">
                        {!selectedCat ? (
                            <div className="p-6 text-center text-sm text-gray-400">← Select a category</div>
                        ) : questions.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-sm text-gray-400">No questions yet.</p>
                                <button onClick={openNewQ} className="mt-2 text-xs text-blue-600 hover:underline">Add first question</button>
                            </div>
                        ) : questions.map((q, i) => (
                            <div key={q.id} className="px-4 py-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-400">Q{i + 1}</span>
                                            {q.is_required && <span className="text-xs text-red-500">Required</span>}
                                        </div>
                                        <p className="text-sm text-gray-800 leading-relaxed">{q.question_text}</p>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                                <Star size={11} fill="currentColor" /> Max: {q.max_score}
                                            </span>
                                            <span className="text-xs text-gray-400">Weight: {q.weight}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => openEditQ(q)} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Pencil size={13} /></button>
                                        <button onClick={() => deleteQ(q)} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Modals ──────────────────────────────────────────────────────── */}

            {modal === 'type' && (
                <Modal title={editingItem ? 'Edit Evaluation Type' : 'New Evaluation Type'} onClose={closeModal} onSave={saveType}>
                    {!editingItem && (
                        <>
                            <FormField label="Internal Name" required>
                                <input value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. blind_review_innovation" className={inp} />
                            </FormField>
                            <FormField label="Proposal Category" required>
                                <select value={typeForm.proposal_category} onChange={(e) => setTypeForm((f) => ({ ...f, proposal_category: e.target.value }))} className={inp}>
                                    {proposal_categoriesOptions().map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </FormField>
                        </>
                    )}
                    <FormField label="Display Label" required>
                        <input value={typeForm.label} onChange={(e) => setTypeForm((f) => ({ ...f, label: e.target.value }))}
                            placeholder="e.g. Blind Review — Innovation" className={inp} />
                    </FormField>
                    <FormField label="Description">
                        <textarea value={typeForm.description ?? ''} onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))}
                            rows={3} className={inp} />
                    </FormField>
                    {editingItem && (
                        <FormField label="Status">
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={typeForm.is_active ?? true} onChange={(e) => setTypeForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                                Active
                            </label>
                        </FormField>
                    )}
                </Modal>
            )}

            {modal === 'category' && (
                <Modal title={editingItem ? 'Edit Category' : 'New Category'} onClose={closeModal} onSave={saveCat}>
                    <FormField label="Category Name" required>
                        <input value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} className={inp} />
                    </FormField>
                    <FormField label="Weight (%)">
                        <input type="number" min="0" max="100" value={catForm.weight}
                            onChange={(e) => setCatForm((f) => ({ ...f, weight: e.target.value }))} className={inp} />
                        <p className="text-xs text-gray-400 mt-1">Percentage weight of this category in the total score</p>
                    </FormField>
                    <FormField label="Description">
                        <textarea value={catForm.description ?? ''} onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                            rows={2} className={inp} />
                    </FormField>
                </Modal>
            )}

            {modal === 'question' && (
                <Modal title={editingItem ? 'Edit Question' : 'New Question'} onClose={closeModal} onSave={saveQ}>
                    <FormField label="Question Text" required>
                        <textarea value={qForm.question_text} onChange={(e) => setQForm((f) => ({ ...f, question_text: e.target.value }))}
                            rows={3} placeholder="e.g. How original is the innovation idea?" className={inp} />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Max Score" required>
                            <input type="number" min="1" max="10" value={qForm.max_score}
                                onChange={(e) => setQForm((f) => ({ ...f, max_score: parseInt(e.target.value) || 1 }))} className={inp} />
                        </FormField>
                        <FormField label="Weight">
                            <input type="number" min="0" step="0.5" value={qForm.weight}
                                onChange={(e) => setQForm((f) => ({ ...f, weight: parseFloat(e.target.value) || 1 }))} className={inp} />
                        </FormField>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={qForm.is_required}
                            onChange={(e) => setQForm((f) => ({ ...f, is_required: e.target.checked }))} className="w-4 h-4 rounded text-blue-600" />
                        Required question
                    </label>
                </Modal>
            )}
        </AppLayout>
    );
}
