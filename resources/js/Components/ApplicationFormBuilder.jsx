import { useState } from 'react';
import {
    ClipboardList, X, Plus, Trash2, ChevronUp, ChevronDown, Loader2, FileText, ListChecks, AlertTriangle,
} from 'lucide-react';
import { put } from '../lib/api';
import { useToast } from './Toast';

export const QUESTION_TYPES = [
    { value: 'short_text', label: 'Short answer' },
    { value: 'long_text', label: 'Paragraph' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'yes_no', label: 'Yes / No' },
    { value: 'select', label: 'One choice' },
    { value: 'multi_select', label: 'Several choices' },
];

export const DOCUMENT_ACCEPT = [
    { value: 'pdf', label: 'PDF only', accept: '.pdf' },
    { value: 'office', label: 'PDF, Word or Excel', accept: '.pdf,.doc,.docx,.xls,.xlsx' },
    { value: 'image', label: 'PDF or image', accept: '.pdf,.png,.jpg,.jpeg' },
    { value: 'any', label: 'Any file', accept: '*' },
];

const newId = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;
const blankQuestion = () => ({ id: newId('q'), section: '', label: '', type: 'short_text', required: true, help: '', options: [], max_words: null });
const blankDocument = () => ({ key: newId('d'), label: '', description: '', required: true, accept: 'pdf' });

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm';

function move(list, index, delta) {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return list;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

function RowControls({ index, count, onMove, onRemove, label }) {
    return (
        <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronUp size={14} /></button>
            <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${label} down`} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronDown size={14} /></button>
            <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
    );
}

function QuestionEditor({ question, index, count, onChange, onMove, onRemove }) {
    const set = (key, value) => onChange({ ...question, [key]: value });
    const isChoice = question.type === 'select' || question.type === 'multi_select';

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Question {index + 1}</span>
                <RowControls index={index} count={count} onMove={onMove} onRemove={onRemove} label={`question ${index + 1}`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                    <input value={question.label} onChange={(e) => set('label', e.target.value)} maxLength={500} placeholder="Question, e.g. Which community will benefit?" className={input} />
                </div>
                <select value={question.type} onChange={(e) => set('type', e.target.value)} className={input}>
                    {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input value={question.help ?? ''} onChange={(e) => set('help', e.target.value)} maxLength={500} placeholder="Help text (optional)" className={`${input} sm:col-span-2`} />
                <input value={question.section ?? ''} onChange={(e) => set('section', e.target.value)} maxLength={120} placeholder="Group heading (optional)" className={input} />
            </div>

            {isChoice && (
                <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold text-gray-600">Choices, one per line</label>
                    <textarea rows={3} value={(question.options ?? []).join('\n')} onChange={(e) => set('options', e.target.value.split('\n'))}
                        placeholder={'Option A\nOption B'} className={`${input} resize-y`} />
                </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={!!question.required} onChange={(e) => set('required', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    Required
                </label>
                {question.type === 'long_text' && (
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        Word limit
                        <input type="number" min={1} max={5000} value={question.max_words ?? ''} onChange={(e) => set('max_words', e.target.value ? Number(e.target.value) : null)}
                            placeholder="None" className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm" />
                    </label>
                )}
            </div>
        </div>
    );
}

function DocumentEditor({ document, index, count, onChange, onMove, onRemove }) {
    const set = (key, value) => onChange({ ...document, [key]: value });

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Document {index + 1}</span>
                <RowControls index={index} count={count} onMove={onMove} onRemove={onRemove} label={`document ${index + 1}`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                <input value={document.label} onChange={(e) => set('label', e.target.value)} maxLength={200} placeholder="e.g. Letter of support" className={`${input} sm:col-span-2`} />
                <select value={document.accept} onChange={(e) => set('accept', e.target.value)} className={input}>
                    {DOCUMENT_ACCEPT.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <input value={document.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={300} placeholder="What it should contain (optional)" className={`${input} sm:col-span-3`} />
            </div>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!document.required} onChange={(e) => set('required', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                Required
            </label>
        </div>
    );
}

/**
 * Edit a call's own application form: extra questions applicants answer on the
 * Basic Info step and extra documents they upload on the Documents step.
 */
export default function ApplicationFormBuilder({ call, onClose, onSaved }) {
    const { success, error } = useToast();
    const [questions, setQuestions] = useState(call.application_form?.questions ?? []);
    const [documents, setDocuments] = useState(call.application_form?.documents ?? []);
    const [tab, setTab] = useState('questions');
    const [saving, setSaving] = useState(false);

    const started = call.proposals_count ?? 0;

    const save = async () => {
        const unnamed = questions.some((q) => !q.label.trim()) || documents.some((d) => !d.label.trim());
        if (unnamed) {
            error('Every question and document needs a label.');
            return;
        }
        setSaving(true);
        try {
            const r = await put(`/proposal-calls/${call.id}/application-form`, {
                questions: questions.map((q) => ({ ...q, options: (q.options ?? []).map((o) => o.trim()).filter(Boolean) })),
                documents,
            });
            success(r.message || 'Application form saved.');
            onSaved?.(r.data);
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? 'The form could not be saved.'));
        }
        setSaving(false);
    };

    const tabs = [
        { key: 'questions', label: 'Questions', icon: ListChecks, count: questions.length },
        { key: 'documents', label: 'Documents', icon: FileText, count: documents.length },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><ClipboardList size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">Application form</h2>
                            <p className="truncate text-xs text-gray-500">{call.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/60 px-6 py-5">
                    <p className="text-sm text-gray-600">
                        Applicants always give a title, abstract, team, budget and the standard documents. Add anything else this call needs.
                        Questions appear on the <span className="font-medium">Basic Info</span> step and documents on the <span className="font-medium">Documents</span> step; required ones must be done before submitting.
                    </p>

                    {started > 0 && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                            <span>{started} proposal{started === 1 ? ' has' : 's have'} already been submitted to this call. New required items apply to drafts and returned proposals when they are resubmitted.</span>
                        </div>
                    )}

                    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                        {tabs.map((t) => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <t.icon size={14} /> {t.label}
                                <span className="rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600">{t.count}</span>
                            </button>
                        ))}
                    </div>

                    {tab === 'questions' ? (
                        <div className="space-y-3">
                            {questions.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">No extra questions. Applicants only answer the standard ones.</p>}
                            {questions.map((q, i) => (
                                <QuestionEditor key={q.id} question={q} index={i} count={questions.length}
                                    onChange={(next) => setQuestions((list) => list.map((x, j) => (j === i ? next : x)))}
                                    onMove={(delta) => setQuestions((list) => move(list, i, delta))}
                                    onRemove={() => setQuestions((list) => list.filter((_, j) => j !== i))} />
                            ))}
                            <button onClick={() => setQuestions((list) => [...list, blankQuestion()])}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-indigo-200 px-4 py-3 text-sm font-semibold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50">
                                <Plus size={15} /> Add question
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {documents.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">No extra documents. Applicants upload only the standard ones.</p>}
                            {documents.map((d, i) => (
                                <DocumentEditor key={d.key} document={d} index={i} count={documents.length}
                                    onChange={(next) => setDocuments((list) => list.map((x, j) => (j === i ? next : x)))}
                                    onMove={(delta) => setDocuments((list) => move(list, i, delta))}
                                    onRemove={() => setDocuments((list) => list.filter((_, j) => j !== i))} />
                            ))}
                            <button onClick={() => setDocuments((list) => [...list, blankDocument()])}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-indigo-200 px-4 py-3 text-sm font-semibold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50">
                                <Plus size={15} /> Add document
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        {saving && <Loader2 size={14} className="animate-spin" />} Save form
                    </button>
                </div>
            </div>
        </div>
    );
}
