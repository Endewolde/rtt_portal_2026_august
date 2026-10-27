import { ClipboardList } from 'lucide-react';

const wordCount = (text) => (String(text ?? '').trim().match(/\S+/g) ?? []).length;

const isBlank = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** Question ids that still need an answer, or whose answer is over its word limit. */
export function callQuestionErrors(questions, answers) {
    const errors = {};
    (questions ?? []).forEach((q) => {
        const value = answers?.[q.id];
        if (q.required && isBlank(value)) errors[q.id] = 'Required';
        else if (q.max_words && wordCount(value) > q.max_words) errors[q.id] = `Keep it to ${q.max_words} words`;
    });
    return errors;
}

/** Questions grouped under their headings, keeping the call's order. */
function groupBySection(questions) {
    const groups = [];
    questions.forEach((q) => {
        const last = groups[groups.length - 1];
        if (last && last.section === (q.section ?? null)) last.items.push(q);
        else groups.push({ section: q.section ?? null, items: [q] });
    });
    return groups;
}

const field = (error) => `w-full rounded-xl border px-3 py-2.5 text-base focus:outline-none focus:ring-2 sm:text-sm ${error ? 'border-red-300 focus:ring-red-100' : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'}`;

function Answer({ question, value, onChange, error }) {
    const q = question;
    switch (q.type) {
        case 'long_text':
            return (
                <>
                    <textarea rows={4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${field(error)} resize-y`} />
                    {q.max_words && (
                        <p className={`mt-1 text-right text-xs ${wordCount(value) > q.max_words ? 'font-semibold text-red-600' : 'text-gray-400'}`}>
                            {wordCount(value)} / {q.max_words} words
                        </p>
                    )}
                </>
            );
        case 'number':
            return <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={field(error)} />;
        case 'date':
            return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={field(error)} />;
        case 'yes_no':
            return (
                <div className="flex gap-2">
                    {[[true, 'Yes'], [false, 'No']].map(([v, label]) => (
                        <button key={label} type="button" onClick={() => onChange(v)}
                            className={`rounded-xl border px-5 py-2 text-sm font-semibold transition ${value === v ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            );
        case 'select':
            return (
                <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={field(error)}>
                    <option value="">Choose…</option>
                    {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            );
        case 'multi_select': {
            const chosen = Array.isArray(value) ? value : [];
            const toggle = (o) => onChange(chosen.includes(o) ? chosen.filter((x) => x !== o) : [...chosen, o]);
            return (
                <div className="flex flex-wrap gap-2">
                    {(q.options ?? []).map((o) => (
                        <button key={o} type="button" onClick={() => toggle(o)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${chosen.includes(o) ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>
                            {o}
                        </button>
                    ))}
                </div>
            );
        }
        default:
            return <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} maxLength={1000} className={field(error)} />;
    }
}

/** The call's own questions, answered on the Basic Info step. */
export default function CallQuestions({ questions, answers, onChange, errors = {} }) {
    if (!questions?.length) return null;

    const set = (id, value) => onChange({ ...(answers ?? {}), [id]: value });

    return (
        <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
            <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-blue-600" />
                <p className="text-sm font-semibold text-gray-900">Questions for this call</p>
            </div>
            {groupBySection(questions).map((group, gi) => (
                <div key={gi} className="space-y-4">
                    {group.section && <p className="border-b border-blue-100 pb-1 text-xs font-bold uppercase tracking-wide text-blue-700">{group.section}</p>}
                    {group.items.map((q) => (
                        <div key={q.id}>
                            <label className="mb-1 block text-sm font-medium text-gray-800">
                                {q.label} {q.required && <span className="text-red-500">*</span>}
                            </label>
                            {q.help && <p className="mb-1.5 text-xs text-gray-500">{q.help}</p>}
                            <Answer question={q} value={answers?.[q.id]} onChange={(v) => set(q.id, v)} error={errors[q.id]} />
                            {errors[q.id] && <p className="mt-1 text-xs text-red-600">{errors[q.id]}</p>}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

const display = (item) => {
    const a = item.answer;
    if (isBlank(a)) return null;
    if (item.type === 'yes_no') return a ? 'Yes' : 'No';
    if (Array.isArray(a)) return a.join(', ');
    return String(a);
};

/** The applicant's answers to the call's questions, read back on the proposal. */
export function CallAnswers({ items }) {
    if (!items?.length) return null;

    return (
        <div className="space-y-5">
            {groupBySection(items).map((group, gi) => (
                <div key={gi}>
                    {group.section && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{group.section}</p>}
                    <dl className="space-y-3">
                        {group.items.map((item) => (
                            <div key={item.id}>
                                <dt className="text-sm font-medium text-gray-700">{item.label}</dt>
                                <dd className={`mt-0.5 whitespace-pre-line text-sm ${display(item) ? 'text-gray-900' : 'italic text-gray-400'}`}>{display(item) ?? 'Not answered'}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            ))}
        </div>
    );
}
