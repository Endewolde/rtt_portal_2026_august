import { useState, useEffect, useMemo } from 'react';
import {
    Clock, AlertCircle, CheckCircle2, ChevronRight, FileText,
    Users, DollarSign, Upload, Eye, Send, Megaphone, ArrowLeft,
    Building2, Info, Save, Pencil,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import TrackerNumberDisplay from '../../Components/TrackerNumberDisplay';
import Step3CoInvestigators from './Steps/Step3CoInvestigators';
import Step5Documents, { DOC_TYPES } from './Steps/Step5Documents';
import { post, get } from '../../lib/api';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useFeature } from '../../hooks/useFeature';
import { useToast } from '../../Components/Toast';
import RoleRestrictedModal from '../../Components/RoleRestrictedModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
    { label: 'Basic Info',    icon: FileText,   description: 'Title, abstract & keywords' },
    { label: 'PI Info',       icon: Users,      description: 'Principal Investigator details' },
    { label: 'Research Team', icon: Users,      description: 'Co-Investigators' },
    { label: 'Budget Plan',   icon: DollarSign, description: 'Budget line items' },
    { label: 'Documents',     icon: Upload,     description: 'Upload required files' },
    { label: 'Preview',       icon: Eye,        description: 'Review before submitting' },
    { label: 'Submit',        icon: Send,       description: 'Final submission' },
];

const SELF_NAVIGATING = new Set([2, 4]); // steps with their own Back/Next

const CATEGORY_STYLE = {
    research:             { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
    community_engagement: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500'  },
    technology_transfer:  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
    innovation:           { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
};

const BUDGET_CATEGORIES = ['Personnel', 'Equipment', 'Supplies', 'Travel', 'Indirect Costs', 'Other'];

// ─── Sidebar stepper ──────────────────────────────────────────────────────────

function StepSidebar({ currentStep, completedSteps, onGoTo }) {
    return (
        <aside className="hidden lg:block w-56 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sticky top-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Progress</p>
                <div className="space-y-0.5">
                    {STEPS.map((s, i) => {
                        const done    = completedSteps.has(i);
                        const active  = i === currentStep;
                        const Icon    = s.icon;
                        return (
                            <button
                                key={i}
                                onClick={() => done && i !== currentStep && onGoTo(i)}
                                disabled={!done || i === currentStep}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all ${
                                    active  ? 'bg-blue-600 shadow-sm shadow-blue-200'
                                    : done  ? 'hover:bg-gray-50 cursor-pointer'
                                    : 'opacity-40 cursor-not-allowed'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                    active ? 'bg-white/20' : done ? 'bg-green-100' : 'bg-gray-100'
                                }`}>
                                    {done && !active
                                        ? <CheckCircle2 size={13} className="text-green-600" />
                                        : <Icon size={12} className={active ? 'text-white' : 'text-gray-500'} />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-semibold truncate leading-tight ${active ? 'text-white' : 'text-gray-700'}`}>
                                        {s.label}
                                    </p>
                                    <p className={`text-[10px] truncate leading-tight mt-0.5 ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                                        {s.description}
                                    </p>
                                </div>
                                {done && !active && (
                                    <ChevronRight size={12} className="text-gray-300 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Progress bar */}
                <div className="mt-4 px-2">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round((completedSteps.size / STEPS.length) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${(completedSteps.size / STEPS.length) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        </aside>
    );
}

// ─── Category-specific field configs ─────────────────────────────────────────

const FOCUS_AREA_FALLBACK = {
    research:             ['Agriculture & Food Systems', 'Health & Biomedical Sciences', 'Engineering & Technology', 'Other'],
    community_engagement: ['Health & Well-being', 'Education & Literacy', 'Environmental Conservation', 'Other'],
    technology_transfer:  ['Product Innovation', 'Process Innovation', 'Knowledge & Technology Transfer', 'Other'],
};

const RESEARCH_TYPE_FALLBACK = ['Basic Research', 'Applied Research', 'Experimental Development', 'Clinical Research', 'Action Research', 'Review / Meta-analysis'];

const DURATION_OPTIONS = [3, 6, 9, 12, 18, 24, 30, 36, 48, 60];

// ─── Step 1 — Basic Info ──────────────────────────────────────────────────────

function Step1({ data, onChange, errors, category, lookupOptions }) {
    const abstractLen  = (data.abstract ?? '').length;
    const abstractOk   = abstractLen >= 100;
    const isResearch   = category === 'research';
    const { hasSubFeature } = useFeature();

    const groupKey     = category === 'community_engagement' ? 'community_focus_area'
                       : category === 'technology_transfer'  ? 'technology_focus_area'
                       : 'research_focus_area';
    const focusOptions        = lookupOptions?.[groupKey] ?? FOCUS_AREA_FALLBACK[category] ?? FOCUS_AREA_FALLBACK.research;
    const researchTypeOptions = lookupOptions?.research_type ?? RESEARCH_TYPE_FALLBACK;

    const inputCls = (key) =>
        `w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
            errors?.[key] ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500'
        }`;

    const Label = ({ text, required }) => (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {text}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
    );

    const FieldError = ({ k }) =>
        errors?.[k] ? (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle size={11} />{errors[k]}
            </p>
        ) : null;

    return (
        <div className="space-y-5">

            {/* Title */}
            <div>
                <Label text="Proposal Title" required />
                <input
                    value={data.title ?? ''}
                    onChange={e => onChange({ ...data, title: e.target.value })}
                    placeholder="Enter a clear, descriptive title for your proposal"
                    className={inputCls('title')}
                />
                <FieldError k="title" />
            </div>

            {/* Abstract */}
            <div>
                <Label text="Abstract" required />
                <textarea
                    value={data.abstract ?? ''}
                    onChange={e => onChange({ ...data, abstract: e.target.value })}
                    rows={5}
                    placeholder="Provide a comprehensive summary of your proposal (minimum 100 characters)…"
                    className={`${inputCls('abstract')} resize-none`}
                />
                <div className={`flex items-center justify-between mt-1.5 text-xs ${abstractOk ? 'text-green-600' : 'text-gray-400'}`}>
                    <span>{abstractLen} / 100 characters minimum</span>
                    {abstractOk && <span className="flex items-center gap-1"><CheckCircle2 size={11} /> Meets requirement</span>}
                </div>
                <FieldError k="abstract" />
            </div>

            {/* Keywords */}
            <div>
                <Label text="Keywords" />
                <input
                    value={data.keywords ?? ''}
                    onChange={e => onChange({ ...data, keywords: e.target.value })}
                    placeholder="e.g. machine learning, climate change, Ethiopian agriculture"
                    className={inputCls('keywords')}
                />
                <p className="text-xs text-gray-400 mt-1">Separate keywords with commas.</p>
            </div>

            {/* ── Category-specific fields ───────────────────── */}
            <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    {category === 'research'             && 'Research-Specific Details'}
                    {category === 'community_engagement' && 'Community Engagement Details'}
                    {category === 'technology_transfer'  && 'Technology Transfer Details'}
                    {!category                           && 'Proposal Details'}
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                    {/* Focus Area */}
                    <div className={isResearch ? 'sm:col-span-2' : ''}>
                        <Label text="Focus Area" required />
                        <select
                            value={data.focus_area ?? ''}
                            onChange={e => onChange({ ...data, focus_area: e.target.value })}
                            className={inputCls('focus_area')}
                        >
                            <option value="">Select a focus area…</option>
                            {focusOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <FieldError k="focus_area" />
                    </div>

                    {/* Research Type — research only */}
                    {isResearch && (
                        <div>
                            <Label text="Research Type" required />
                            <select
                                value={data.research_type ?? ''}
                                onChange={e => onChange({ ...data, research_type: e.target.value })}
                                className={inputCls('research_type')}
                            >
                                <option value="">Select research type…</option>
                                {researchTypeOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            <FieldError k="research_type" />
                        </div>
                    )}

                    {/* Duration */}
                    <div>
                        <Label text="Duration" required />
                        <div className="flex items-center gap-2">
                            <select
                                value={data.duration_months ?? ''}
                                onChange={e => onChange({ ...data, duration_months: e.target.value })}
                                className={inputCls('duration_months')}
                            >
                                <option value="">Select duration…</option>
                                {DURATION_OPTIONS.map(m => (
                                    <option key={m} value={m}>
                                        {m < 12 ? `${m} months` : `${m / 12} year${m > 12 ? 's' : ''}`}
                                        {m % 12 !== 0 && m > 12 ? ` (${m} months)` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <FieldError k="duration_months" />
                    </div>
                </div>
            </div>

            {/* Ethical Clearance — only shown when feature is enabled */}
            {hasSubFeature('workflow.ethical_clearance') && (
                <div className="mt-6 border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-800">Ethical Clearance</p>
                    <div className="flex items-center gap-3">
                        <input
                            id="ec-required"
                            type="checkbox"
                            checked={data.ethical_clearance_required ?? false}
                            onChange={e => onChange({ ...data, ethical_clearance_required: e.target.checked, ethical_clearance_number: e.target.checked ? (data.ethical_clearance_number ?? '') : '' })}
                            className="h-4 w-4 rounded border-gray-300 text-amber-600"
                        />
                        <label htmlFor="ec-required" className="text-sm text-gray-700">
                            This proposal requires ethical clearance approval
                        </label>
                    </div>
                    {data.ethical_clearance_required && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Clearance Reference Number</label>
                            <input
                                type="text"
                                placeholder="e.g. EC-2026-00123"
                                value={data.ethical_clearance_number ?? ''}
                                onChange={e => onChange({ ...data, ethical_clearance_number: e.target.value })}
                                className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Step 2 — PI Info ─────────────────────────────────────────────────────────

function Step2({ user }) {
    const fields = [
        { label: 'Full Name',    value: user?.name,        icon: Users },
        { label: 'Email',        value: user?.email,       icon: FileText },
        { label: 'Employee ID',  value: user?.employee_id, icon: Building2 },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                    Your profile is automatically used as the Principal Investigator. To update this information, edit your profile settings.
                </p>
            </div>

            <div className="grid gap-4">
                {fields.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
                        <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                            <Icon size={16} className="text-gray-500" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-medium">{label}</p>
                            <p className="text-sm font-semibold text-gray-900 mt-0.5">{value ?? '—'}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Step 4 — Budget ──────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
    Personnel:       'bg-blue-50 text-blue-700 border-blue-200',
    Equipment:       'bg-purple-50 text-purple-700 border-purple-200',
    Supplies:        'bg-green-50 text-green-700 border-green-200',
    Travel:          'bg-amber-50 text-amber-700 border-amber-200',
    'Indirect Costs':'bg-rose-50 text-rose-700 border-rose-200',
    Other:           'bg-gray-100 text-gray-600 border-gray-200',
};

function Step4({ items, onChange, rowErrors }) {
    const add    = () => onChange([...items, { category: '', description: '', amount: '', justification: '' }]);
    const update = (i, field, val) => onChange(items.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
    const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
    const total  = items.reduce((s, it) => s + Number(it.amount || 0), 0);

    return (
        <div className="space-y-3">
            {items.length === 0 ? (
                <div className="border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl px-4 py-10 text-center">
                    <DollarSign size={28} className="mx-auto text-amber-400 mb-2" />
                    <p className="text-sm font-semibold text-amber-700">No budget items yet</p>
                    <p className="text-xs text-amber-600 mt-1">Add at least one budget item to continue.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map((item, i) => {
                        const rowErr  = rowErrors?.[i];
                        const catColor = CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600 border-gray-200';
                        return (
                            <div key={i} className={`rounded-xl border p-4 transition-colors ${rowErr ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                {/* Row 1: category + amount + delete */}
                                <div className="flex items-center gap-3">
                                    <select
                                        value={item.category}
                                        onChange={e => update(i, 'category', e.target.value)}
                                        className={`text-xs font-medium border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white flex-1 min-w-0 ${rowErr?.category ? 'border-red-400' : 'border-gray-200'}`}
                                    >
                                        <option value="">Category…</option>
                                        {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>

                                    {item.category && (
                                        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border hidden sm:inline ${catColor}`}>
                                            {item.category}
                                        </span>
                                    )}

                                    {/* Amount with ETB prefix */}
                                    <div className={`flex items-center shrink-0 rounded-lg border overflow-hidden ${rowErr?.amount ? 'border-red-400' : 'border-gray-200'}`}>
                                        <span className="px-2.5 py-1.5 bg-gray-50 border-r border-gray-200 text-xs font-semibold text-gray-500">ETB</span>
                                        <input
                                            type="number" min="0"
                                            value={item.amount}
                                            onChange={e => update(i, 'amount', e.target.value)}
                                            placeholder="0"
                                            className="w-28 text-sm font-semibold text-gray-900 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                                        />
                                    </div>

                                    <button onClick={() => remove(i)}
                                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors text-base leading-none">
                                        ✕
                                    </button>
                                </div>

                                {/* Row 2: description + justification */}
                                <div className="mt-2.5 grid sm:grid-cols-2 gap-2">
                                    <input
                                        value={item.description}
                                        onChange={e => update(i, 'description', e.target.value)}
                                        placeholder="Item description *"
                                        className={`text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${rowErr?.description ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                                    />
                                    <input
                                        value={item.justification}
                                        onChange={e => update(i, 'justification', e.target.value)}
                                        placeholder="Justification (optional)"
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center justify-between pt-1">
                <button
                    onClick={add}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-colors"
                >
                    <DollarSign size={15} /> Add Budget Item
                </button>
                {items.length > 0 && (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                        <span className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''} · Total</span>
                        <span className="text-sm font-bold text-gray-900">ETB {Number(total).toLocaleString()}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Step 6 — Preview ─────────────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
const getInitials   = name => (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
const getAvatarColor = name => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

const CATEGORY_ACCENT = {
    research:             'border-blue-500',
    community_engagement: 'border-green-500',
    technology_transfer:  'border-purple-500',
};

const BAR_COLOR = {
    Personnel:       'bg-blue-500',
    Equipment:       'bg-purple-500',
    Supplies:        'bg-green-500',
    Travel:          'bg-amber-500',
    'Indirect Costs':'bg-rose-500',
    Other:           'bg-gray-400',
};

function StepSection({ number, title, status, onEdit, children }) {
    const numBg =
        status === 'ok'    ? 'bg-green-600'  :
        status === 'error' ? 'bg-red-500'    :
                             'bg-blue-600';

    const statusIcon =
        status === 'ok'    ? <CheckCircle2 size={13} className="text-green-500 shrink-0" /> :
        status === 'error' ? <AlertCircle  size={13} className="text-red-400  shrink-0" /> :
        null;

    return (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
                <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${numBg}`}>
                        {number}
                    </div>
                    {statusIcon}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Step {number}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5 leading-none">{title}</p>
                    </div>
                </div>
                {onEdit && (
                    <button onClick={onEdit} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                        <Pencil size={11} /> Edit
                    </button>
                )}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function Step6Preview({ stepData, budgetItems, user, category, selectedCall, onGoToStep }) {
    const d            = stepData[0] ?? {};
    const team         = stepData[2]?.co_investigators ?? [];
    const totalCo      = team.reduce((s, c) => s + (parseFloat(c.contribution_percentage) || 0), 0);
    const piContrib    = Math.max(0, 100 - totalCo);
    const budgetTotal  = budgetItems.reduce((s, i) => s + Number(i.amount || 0), 0);
    const documents    = stepData[4]?.documents ?? {};
    const docsDone     = DOC_TYPES.filter(dt => documents[dt.key]?.status === 'done').length;
    const docsRequired = DOC_TYPES.filter(dt => dt.required).length;
    const missingDocs  = DOC_TYPES.filter(dt => dt.required && documents[dt.key]?.status !== 'done');

    const keywords      = (d.keywords ?? '').split(',').map(k => k.trim()).filter(Boolean);
    const durationLabel = d.duration_months
        ? (d.duration_months < 12
            ? `${d.duration_months} months`
            : `${d.duration_months / 12} year${d.duration_months > 12 ? 's' : ''} (${d.duration_months} months)`)
        : null;
    const categoryLabel = (category ?? '').replace(/_/g, ' ');
    const accentBorder  = CATEGORY_ACCENT[category] ?? 'border-blue-500';

    const budgetByCategory = budgetItems.reduce((acc, item) => {
        const cat = item.category || 'Other';
        acc[cat] = (acc[cat] || 0) + Number(item.amount || 0);
        return acc;
    }, {});

    // Readiness issues
    const issues = [];
    if (!d.title?.trim())                        issues.push({ msg: 'Proposal title is missing',                                                     step: 0 });
    if ((d.abstract?.trim().length ?? 0) < 100)  issues.push({ msg: 'Abstract must be at least 100 characters',                                     step: 0 });
    if (!d.focus_area?.trim())                   issues.push({ msg: 'Focus area is not selected',                                                   step: 0 });
    if (!d.duration_months)                      issues.push({ msg: 'Duration is not selected',                                                     step: 0 });
    if (team.length === 0)                       issues.push({ msg: 'At least one co-investigator is required',                                     step: 2 });
    if (budgetItems.length === 0)                issues.push({ msg: 'No budget items added',                                                         step: 3 });
    if (missingDocs.length > 0)                  issues.push({ msg: `${missingDocs.length} required document${missingDocs.length > 1 ? 's' : ''} not uploaded`, step: 4 });
    const isReady = issues.length === 0;

    const step1Status = issues.some(i => i.step === 0) ? 'error' : 'ok';
    const step3Status = issues.some(i => i.step === 2) ? 'error' : 'ok';
    const step4Status = issues.some(i => i.step === 3) ? 'error' : 'ok';
    const step5Status = missingDocs.length > 0          ? 'error' : 'ok';

    return (
        <div className="space-y-4">

            {/* ── Readiness banner ──────────────────────────────────────────── */}
            {isReady ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3.5">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle2 size={16} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-green-800">All sections complete — ready to submit</p>
                        <p className="text-xs text-green-600 mt-0.5">Review each step below, then proceed to Step 7 to submit.</p>
                    </div>
                </div>
            ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 pt-3.5 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertCircle size={15} className="text-amber-600 shrink-0" />
                        <p className="text-sm font-semibold text-amber-800">
                            {issues.length} item{issues.length > 1 ? 's' : ''} need{issues.length === 1 ? 's' : ''} attention before submitting
                        </p>
                    </div>
                    <div className="space-y-2">
                        {issues.map((issue, i) => (
                            <div key={i} className="flex items-center justify-between gap-4">
                                <span className="text-xs text-amber-700 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                    {issue.msg}
                                </span>
                                <button
                                    onClick={() => onGoToStep?.(issue.step)}
                                    className="shrink-0 text-xs font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2 transition-colors"
                                >
                                    Fix →
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Step 1: Basic Info ────────────────────────────────────────── */}
            <StepSection number={1} title="Basic Info" status={step1Status} onEdit={() => onGoToStep?.(0)}>
                {/* Title with category accent */}
                <div className={`border-l-4 ${accentBorder} pl-4 mb-4`}>
                    <h3 className="text-base font-bold text-gray-900 leading-snug">
                        {d.title?.trim() || <span className="text-red-400 italic font-normal text-sm">No title provided</span>}
                    </h3>
                    {(selectedCall?.title || selectedCall?.academic_year) && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Megaphone size={10} />
                            {[selectedCall?.title, selectedCall?.academic_year].filter(Boolean).join(' · ')}
                        </p>
                    )}
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {category && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-gray-900 text-white font-medium capitalize">{categoryLabel}</span>
                    )}
                    {d.focus_area ? (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">{d.focus_area}</span>
                    ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-500 border border-red-100 font-medium">No focus area</span>
                    )}
                    {category === 'research' && d.research_type && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-medium">{d.research_type}</span>
                    )}
                    {durationLabel ? (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-medium flex items-center gap-1">
                            <Clock size={10} /> {durationLabel}
                        </span>
                    ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-500 border border-red-100 font-medium flex items-center gap-1">
                            <Clock size={10} /> No duration set
                        </span>
                    )}
                </div>

                {/* Abstract */}
                <div className="mb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Abstract</p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                        {d.abstract?.trim() || <span className="text-red-400 italic">No abstract provided.</span>}
                    </p>
                    {d.abstract && d.abstract.trim().length < 100 && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle size={11} /> Only {d.abstract.trim().length} of 100 minimum characters
                        </p>
                    )}
                </div>

                {/* Keywords */}
                {keywords.length > 0 && (
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                            {keywords.map(k => (
                                <span key={k} className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{k}</span>
                            ))}
                        </div>
                    </div>
                )}
            </StepSection>

            {/* ── Step 2: Principal Investigator ───────────────────────────── */}
            <StepSection number={2} title="Principal Investigator" status="ok">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {getInitials(user?.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{user?.name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                        {user?.employee_id && <p className="text-xs text-gray-400 mt-0.5">ID: {user.employee_id}</p>}
                    </div>
                    <span className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                        Principal Investigator
                    </span>
                </div>
            </StepSection>

            {/* ── Step 3: Research Team ─────────────────────────────────────── */}
            <StepSection number={3} title="Research Team" status={step3Status} onEdit={() => onGoToStep?.(2)}>
                <div className="space-y-2">
                    {/* PI row */}
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {getInitials(user?.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                        <div className="shrink-0 text-right">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">PI</span>
                            <p className="text-xs text-gray-400 mt-0.5">{piContrib.toFixed(0)}%</p>
                        </div>
                    </div>

                    {team.length === 0 ? (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-red-200 bg-red-50">
                            <AlertCircle size={13} className="text-red-400 shrink-0" />
                            <p className="text-xs text-red-600">No co-investigators added — required before submission.</p>
                        </div>
                    ) : team.map(coI => (
                        <div key={coI.user_id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                            <div className={`w-9 h-9 rounded-full ${getAvatarColor(coI.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                {getInitials(coI.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{coI.name}</p>
                                <p className="text-xs text-gray-500 truncate">{coI.email}</p>
                                {coI.college_name && <p className="text-xs text-gray-400 truncate">{coI.college_name}</p>}
                            </div>
                            <div className="shrink-0 text-right">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Co-PI</span>
                                <p className="text-xs text-gray-400 mt-0.5">{coI.contribution_percentage}%</p>
                            </div>
                        </div>
                    ))}

                    {team.length > 0 && (
                        <div className="pt-1">
                            <div className="flex h-2 rounded-full overflow-hidden gap-px bg-gray-100">
                                <div className="bg-blue-500 transition-all" style={{ width: `${piContrib}%` }} title={`PI: ${piContrib.toFixed(0)}%`} />
                                {team.map((coI, i) => (
                                    <div
                                        key={coI.user_id}
                                        className={`transition-all ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                                        style={{ width: `${coI.contribution_percentage}%` }}
                                        title={`${coI.name}: ${coI.contribution_percentage}%`}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5">{team.length + 1} members · contributions total 100%</p>
                        </div>
                    )}
                </div>
            </StepSection>

            {/* ── Step 4: Budget Plan ───────────────────────────────────────── */}
            <StepSection
                number={4}
                title={budgetTotal > 0 ? `Budget Plan — ETB ${budgetTotal.toLocaleString()}` : 'Budget Plan'}
                status={step4Status}
                onEdit={() => onGoToStep?.(3)}
            >
                {budgetItems.length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-red-200 bg-red-50">
                        <AlertCircle size={13} className="text-red-400 shrink-0" />
                        <p className="text-xs text-red-600">No budget items added — required before submission.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Category breakdown */}
                        <div className="space-y-2.5">
                            {Object.entries(budgetByCategory)
                                .sort(([, a], [, b]) => b - a)
                                .map(([cat, amount]) => {
                                    const pct = budgetTotal > 0 ? (amount / budgetTotal) * 100 : 0;
                                    const bar = BAR_COLOR[cat] ?? 'bg-gray-400';
                                    return (
                                        <div key={cat}>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-gray-600 font-medium">{cat}</span>
                                                <span className="text-gray-500">
                                                    ETB {amount.toLocaleString()}
                                                    <span className="text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {/* Items table */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">ETB</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {budgetItems.map((item, i) => (
                                        <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-4 py-2.5 font-medium text-gray-700">{item.category || '—'}</td>
                                            <td className="px-4 py-2.5 text-gray-600">
                                                <div>{item.description || '—'}</div>
                                                {item.justification && (
                                                    <div className="text-xs text-gray-400 mt-0.5">{item.justification}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 font-semibold text-gray-900 text-right">
                                                {Number(item.amount || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 border-t border-gray-200">
                                        <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                            Total · {budgetItems.length} item{budgetItems.length !== 1 ? 's' : ''}
                                        </td>
                                        <td className="px-4 py-2.5 font-bold text-gray-900 text-right">
                                            {budgetTotal.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </StepSection>

            {/* ── Step 5: Documents ─────────────────────────────────────────── */}
            <StepSection number={5} title="Documents" status={step5Status} onEdit={() => onGoToStep?.(4)}>
                <div className="space-y-2">
                    {missingDocs.length > 0 && (
                        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
                            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-semibold text-red-700">Required documents missing</p>
                                <p className="text-xs text-red-600 mt-0.5">
                                    {missingDocs.map(dt => dt.label).join(', ')} must be uploaded before submitting.
                                </p>
                            </div>
                        </div>
                    )}
                    {DOC_TYPES.map(dt => {
                        const doc      = documents[dt.key];
                        const uploaded = doc?.status === 'done';
                        return (
                            <div
                                key={dt.key}
                                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                                    uploaded    ? 'border-green-200 bg-green-50'
                                    : dt.required ? 'border-red-200 bg-red-50'
                                    :               'border-gray-100 bg-gray-50'
                                }`}
                            >
                                {uploaded
                                    ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                                    : dt.required
                                    ? <AlertCircle  size={15} className="text-red-400 shrink-0" />
                                    : <FileText     size={15} className="text-gray-300 shrink-0" />
                                }
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${uploaded ? 'text-gray-800' : dt.required ? 'text-red-700' : 'text-gray-500'}`}>
                                        {dt.label}
                                        {dt.required && !uploaded && <span className="text-red-500 ml-0.5">*</span>}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                        {doc?.filename ?? (dt.required ? 'Not uploaded' : 'Optional — not provided')}
                                    </p>
                                </div>
                                {doc?.size && <span className="text-xs text-gray-400 shrink-0">{doc.size}</span>}
                            </div>
                        );
                    })}
                    <p className="text-xs text-gray-400 pt-1">
                        {docsDone} of {DOC_TYPES.length} uploaded · {docsRequired} required
                    </p>
                </div>
            </StepSection>
        </div>
    );
}

// ─── Step 7 — Submit ──────────────────────────────────────────────────────────

function Step7Submit({ proposalId, stepData, budgetItems, onSuccess, onGoToStep, onSaveDraft, user }) {
    const toast = useToast();
    const [confirmed,  setConfirmed]  = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [tracker,    setTracker]    = useState('');
    const [accessDenied, setAccessDenied] = useState(false);

    const checks = [
        { label: 'Title provided',          ok: !!(stepData[0]?.title?.trim()) },
        { label: 'Abstract (min 100 chars)', ok: (stepData[0]?.abstract?.trim().length ?? 0) >= 100 },
        { label: 'Co-investigator added',    ok: (stepData[2]?.co_investigators?.length ?? 0) >= 1 },
        { label: 'Budget items added',       ok: budgetItems.length > 0 },
    ];
    const allOk = checks.every(c => c.ok);

    const roleNames = (user?.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
    const currentRole = roleNames[0] ? roleNames[0].replace(/_/g, ' ') : null;

    const submit = async () => {
        setSubmitting(true);
        try {
            // Errors here get a dedicated modal (403) or inline toasts — skip the generic global toast.
            const res = await post(`/proposals/${proposalId}/submit`, {}, { skipErrorToast: true });
            setTracker(res.data?.tracker_number ?? '');
            onSuccess();
        } catch (e) {
            if (e.response?.status === 403) {
                setAccessDenied(true);
            } else {
                const msg = e.response?.data?.message ?? 'Submission failed. Please try again.';
                if (msg.toLowerCase().includes('budget'))   toast.error('Go back to Step 4 and add budget items.',           { title: 'Budget Missing', action: { label: 'Go to Budget',      onClick: () => onGoToStep(3) } });
                else if (msg.toLowerCase().includes('document')) toast.error('Go back to Step 5 and upload required files.',  { title: 'Documents Missing', action: { label: 'Go to Documents', onClick: () => onGoToStep(4) } });
                else if (msg.toLowerCase().includes('abstract')) toast.error('Go back to Step 1 and complete the abstract.', { title: 'Abstract Missing', action: { label: 'Go to Basic Info', onClick: () => onGoToStep(0) } });
                else toast.error(msg, { title: 'Submission Failed' });
            }
        }
        setSubmitting(false);
    };

    if (tracker) return (
        <div className="text-center py-10 space-y-5">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Proposal Submitted!</h2>
                <p className="text-gray-500 mt-1 text-sm">Your proposal has been received and is under review.</p>
            </div>
            <div className="flex justify-center">
                <TrackerNumberDisplay trackerNumber={tracker} />
            </div>
            <p className="text-xs text-gray-400">Save your tracker number to follow the status of your application.</p>
        </div>
    );

    return (
        <div className="space-y-5">
            <RoleRestrictedModal
                open={accessDenied}
                onClose={() => setAccessDenied(false)}
                currentRole={currentRole}
                requiredRole="Staff"
            />

            {/* Checklist */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">Submission Checklist</p>
                <div className="space-y-2">
                    {checks.map(({ label, ok }) => (
                        <div key={label} className={`flex items-center gap-3 text-sm ${ok ? 'text-gray-700' : 'text-red-600'}`}>
                            {ok
                                ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                : <AlertCircle  size={16} className="text-red-400 shrink-0"   />
                            }
                            {label}
                        </div>
                    ))}
                </div>
            </div>

            {!allOk && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                    Please go back and complete all required fields before submitting.
                </div>
            )}

            <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                confirmed ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
                <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    className="mt-0.5 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-700">
                    I confirm that all information provided in this proposal is accurate, complete, and has been approved
                    by all co-investigators. I understand that false information may result in rejection or withdrawal of funding.
                </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={onSaveDraft}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <Save size={15} /> Save as Draft
                </button>
                <button
                    onClick={submit}
                    disabled={!confirmed || !allOk || submitting}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Submitting Proposal…
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <Send size={15} /> Submit Proposal
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProposalCreate() {
    const { user } = useAuth();
    const toast    = useToast();

    const [phase, setPhase]           = useState('select_call');
    const [selectedCall, setSelectedCall] = useState(null);
    const [starting, setStarting]     = useState(false);
    const [calls, setCalls]           = useState([]);
    const [callsLoading, setCallsLoading] = useState(true);

    const [step, setStep]             = useState(0);
    const [proposalId, setProposalId] = useState(null);
    const [stepData, setStepData]     = useState(Array.from({ length: 7 }, () => ({})));
    const [budgetItems, setBudgetItems] = useState([{ category: '', description: '', amount: '', justification: '' }]);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [saving, setSaving]         = useState(false);
    const [submitted, setSubmitted]   = useState(false);
    const [returnReason, setReturnReason] = useState(null);

    const [step1Errors, setStep1Errors]       = useState({});
    const [budgetRowErrors, setBudgetRowErrors] = useState({});
    const [lookupOptions, setLookupOptions]   = useState(null);

    // Load lookup options for dropdowns
    useEffect(() => {
        get('/lookup-options/active').then(r => setLookupOptions(r.data ?? null)).catch(() => {});
    }, []);

    // Load active calls
    useEffect(() => {
        setCallsLoading(true);
        get('/proposal-calls')
            .then(r => {
                const raw    = r.data ?? [];
                const items  = Array.isArray(raw) ? raw : (raw?.data ?? []);
                const now    = new Date();
                const active = items.filter(c => c.status === 'active' && (!c.end_date || new Date(c.end_date) > now));
                setCalls(active);
            })
            .catch(() => toast.warning('Could not load proposal calls.'))
            .finally(() => setCallsLoading(false));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Resume from ?resume= param — restore every step's data, not just Step 1.
    useEffect(() => {
        const resumeId = new URLSearchParams(window.location.search).get('resume');
        if (!resumeId) return;
        setProposalId(resumeId);
        api.get(`/proposals/${resumeId}`)
            .then(res => {

                const p = res.data?.data ?? res.data;
                if (!p) return;

                const coInvestigators = (p.members ?? [])
                    .filter(m => m.role === 'co_investigator' && m.status === 'active')
                    .map(m => ({
                        user_id:                 m.user_id,
                        name:                    m.user?.name ?? '',
                        email:                   m.user?.email ?? '',
                        college_name:            m.user?.college?.name ?? '',
                        department_name:         m.user?.department?.name ?? '',
                        contribution_percentage: Number(m.contribution_percentage) || 0,
                        invitation_status:       m.invitation_status ?? 'accepted',
                    }));

                const restoredBudgetItems = (p.budgets ?? []).map(b => ({
                    category:      b.category ?? '',
                    description:   b.item_description ?? '',
                    amount:        b.amount ?? '',
                    justification: b.justification ?? '',
                }));

                const documentsByType = {};
                (p.documents ?? []).forEach(doc => {
                    documentsByType[doc.document_type] = {
                        filename:   doc.original_filename,
                        size:       doc.file_size ? (doc.file_size / 1024 / 1024).toFixed(2) + ' MB' : '',
                        status:     'done',
                        documentId: doc.id,
                    };
                });

                setStepData(prev => prev.map((d, i) => {
                    if (i === 0) {
                        return {
                            title:           p.title           ?? '',
                            abstract:        p.abstract        ?? '',
                            keywords:        p.keywords        ?? '',
                            focus_area:      p.focus_area      ?? '',
                            duration_months: p.duration_months ?? '',
                            research_type:   p.research_type   ?? '',
                            ...(p.draft_data?.step_1 ?? {}),
                        };
                    }
                    if (i === 2) return { co_investigators: coInvestigators };
                    if (i === 4) return { documents: documentsByType };
                    return d;
                }));

                if (restoredBudgetItems.length > 0) setBudgetItems(restoredBudgetItems);

                // wizard_completed_steps is DB step numbers (1-5) → frontend indices (0-4)
                const dbCompleted   = p.wizard_completed_steps ?? [];
                const feCompleted   = new Set(dbCompleted.map(s => s - 1));
                setCompletedSteps(feCompleted);

                if (p.proposal_call) setSelectedCall(p.proposal_call);
                if (p.rejection_reason) setReturnReason(p.rejection_reason);

                const nextStep = [0, 1, 2, 3, 4].find(i => !feCompleted.has(i));
                setStep(nextStep ?? 5);
                setPhase('wizard');
            })
            .catch(err => {
                setProposalId(null);
                window.history.replaceState({}, '', window.location.pathname);
                if (err?.response?.status === 404) {
                    toast.warning('This proposal no longer exists. Please start a new application.');
                } else {
                    toast.warning('Could not load proposal data.');
                }
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Pre-select call from ?call_id= param
    useEffect(() => {
        const cid = new URLSearchParams(window.location.search).get('call_id');
        if (cid && calls.length > 0) {
            const found = calls.find(c => c.id === cid);
            if (found) setSelectedCall(found);
        }
    }, [calls]);

    const handleStartApplication = async () => {
        if (!selectedCall || starting) return;
        setStarting(true);
        try {
            const res = await post('/proposals/draft', {
                proposal_call_id: selectedCall.id,
                category: selectedCall.category ?? 'research',
            });
            const id = res.data?.id ?? res.id;
            if (!id) throw new Error('Draft creation failed.');
            setProposalId(id);
            setPhase('wizard');
            setStep(0);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Failed to start application.', { title: 'Error' });
        }
        setStarting(false);
    };

    const updateStep    = (i, data) => setStepData(s => s.map((d, idx) => idx === i ? data : d));
    const markCompleted = (i)       => setCompletedSteps(prev => new Set([...prev, i]));

    const handleStepComplete = (data, direction) => {
        if (direction === 'back') { setStep(s => Math.max(0, s - 1)); return; }
        if (data) updateStep(step, data);
        markCompleted(step);
        setStep(s => Math.min(6, s + 1));
    };

    const category = selectedCall?.category ?? null;

    const validateStep0 = () => {
        const d = stepData[0];
        const errors = {};
        if (!d?.title?.trim()) errors.title = 'Title is required.';
        if (!d?.abstract?.trim()) errors.abstract = 'Abstract is required.';
        else if (d.abstract.trim().length < 100) errors.abstract = `Abstract must be at least 100 characters (${d.abstract.trim().length} entered).`;
        if (!d?.focus_area?.trim()) errors.focus_area = 'Focus area is required.';
        if (!d?.duration_months) errors.duration_months = 'Duration is required.';
        if (category === 'research' && !d?.research_type?.trim()) errors.research_type = 'Research type is required.';
        return errors;
    };

    const validateStep3 = () => {
        if (budgetItems.length === 0) return null;
        const rowErrors = {};
        budgetItems.forEach((item, i) => {
            const r = {};
            if (!item.category?.trim()) r.category = true;
            if (!item.description?.trim()) r.description = true;
            if (!item.amount || Number(item.amount) <= 0) r.amount = true;
            if (Object.keys(r).length) rowErrors[i] = r;
        });
        return Object.keys(rowErrors).length ? rowErrors : null;
    };

    const next = async () => {
        if (saving) return;

        if (step === 0) {
            const errors = validateStep0();
            if (Object.keys(errors).length) {
                setStep1Errors(errors);
                toast.warning('Please complete the required fields.', { title: 'Required Fields' });
                return;
            }
            setStep1Errors({});
        }

        if (step === 3) {
            if (budgetItems.length === 0) {
                toast.warning('Add at least one budget item before continuing.', { title: 'Budget Required' });
                return;
            }
            const rowErrors = validateStep3();
            if (rowErrors) {
                setBudgetRowErrors(rowErrors);
                toast.warning('Some budget items are incomplete.', { title: 'Incomplete Budget Items' });
                return;
            }
            setBudgetRowErrors({});
        }

        setSaving(true);
        try {
            if (step === 0) {
                await post(`/proposals/${proposalId}/steps/1`, stepData[0])
                    .catch(() => toast.error('Failed to save progress.', { title: 'Save Failed' }));
            } else if (step === 1 && proposalId) {
                await post(`/proposals/${proposalId}/steps/2`, { pi_confirmed: true }).catch(() => {});
            } else if (step === 3 && proposalId) {
                await post(`/proposals/${proposalId}/steps/4`, { items: budgetItems })
                    .catch(() => toast.error('Failed to save budget.', { title: 'Save Failed' }));
            }
            markCompleted(step);
            if (step < 6) setStep(s => s + 1);
        } finally {
            setSaving(false);
        }
    };

    const handleStep1Change = (data) => {
        updateStep(0, data);
        if (Object.keys(step1Errors).length) {
            const remaining = { ...step1Errors };
            if (data.title?.trim()) delete remaining.title;
            if ((data.abstract?.trim().length ?? 0) >= 100) delete remaining.abstract;
            if (data.focus_area?.trim()) delete remaining.focus_area;
            if (data.duration_months) delete remaining.duration_months;
            if (data.research_type?.trim()) delete remaining.research_type;
            setStep1Errors(remaining);
        }
    };

    const handleBudgetChange = (items) => {
        setBudgetItems(items);
        if (Object.keys(budgetRowErrors).length) setBudgetRowErrors({});
    };

    const renderStep = () => {
        switch (step) {
            case 0: return <Step1 data={stepData[0]} onChange={handleStep1Change} errors={step1Errors} category={category} lookupOptions={lookupOptions} />;
            case 1: return <Step2 user={user} />;
            case 2: return (
                <Step3CoInvestigators
                    proposalId={proposalId}
                    piUser={user}
                    onComplete={handleStepComplete}
                    initialData={stepData[2]?.co_investigators ?? []}
                />
            );
            case 3: return <Step4 items={budgetItems} onChange={handleBudgetChange} rowErrors={budgetRowErrors} />;
            case 4: return <Step5Documents proposalId={proposalId} onComplete={handleStepComplete} initialUploads={stepData[4]?.documents} />;
            case 5: return <Step6Preview stepData={stepData} budgetItems={budgetItems} user={user} category={category} selectedCall={selectedCall} onGoToStep={setStep} />;
            case 6: return (
                <Step7Submit
                    proposalId={proposalId}
                    stepData={stepData}
                    budgetItems={budgetItems}
                    onSuccess={() => setSubmitted(true)}
                    onGoToStep={setStep}
                    onSaveDraft={() => { window.location.href = '/my-proposals'; }}
                    user={user}
                />
            );
            default: return null;
        }
    };

    // ── Phase: call selection ─────────────────────────────────────────────────

    if (phase === 'select_call') {
        return (
            <AppLayout breadcrumb="Proposals / Active Calls">
                <div className="max-w-4xl mx-auto pb-28">

                    {/* Page header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-1">
                            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-200 shrink-0">
                                <Megaphone size={22} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Active Proposal Calls</h1>
                                <p className="text-sm text-gray-500 mt-0.5">Choose a funding call to start your application.</p>
                            </div>
                        </div>
                    </div>

                    {callsLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : calls.length === 0 ? (
                        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
                            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Megaphone size={26} className="text-amber-400" />
                            </div>
                            <p className="text-gray-700 font-semibold">No active calls right now</p>
                            <p className="text-sm text-gray-400 mt-1">Check back later or contact your administrator.</p>
                        </div>
                    ) : (
                        <div className={`grid gap-4 ${calls.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                            {calls.map(call => {
                                const style      = CATEGORY_STYLE[call.category] ?? CATEGORY_STYLE.research;
                                const isSelected = selectedCall?.id === call.id;
                                const now        = new Date();
                                const endDate    = call.end_date ? new Date(call.end_date) : null;
                                const startDate  = call.start_date ? new Date(call.start_date) : null;
                                const daysLeft   = endDate ? Math.max(0, Math.ceil((endDate - now) / 86400000)) : null;
                                const totalDays  = (startDate && endDate) ? Math.max(1, Math.ceil((endDate - startDate) / 86400000)) : null;
                                const elapsed    = (startDate && endDate) ? Math.min(100, Math.max(0, Math.ceil(((now - startDate) / (endDate - startDate)) * 100))) : null;
                                const urgent     = daysLeft !== null && daysLeft <= 7;

                                return (
                                    <button
                                        key={call.id}
                                        onClick={() => setSelectedCall(isSelected ? null : call)}
                                        className={`w-full text-left rounded-2xl border-2 p-5 transition-all group ${
                                            isSelected
                                                ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-100'
                                                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                                        }`}
                                    >
                                        {/* Top row: category + year + radio */}
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                    {call.category?.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-xs text-gray-400 font-medium">{call.academic_year}</span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                                isSelected ? 'bg-blue-600 border-blue-600 scale-110' : 'border-gray-300 group-hover:border-blue-400'
                                            }`}>
                                                {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                            </div>
                                        </div>

                                        {/* Title + description */}
                                        <h3 className="text-base font-bold text-gray-900 leading-snug mb-1">{call.title}</h3>
                                        {call.description && (
                                            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">{call.description}</p>
                                        )}

                                        {/* Deadline row */}
                                        {endDate && (
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between text-xs mb-1.5">
                                                    <span className={`flex items-center gap-1 font-semibold ${urgent ? 'text-red-500' : 'text-gray-500'}`}>
                                                        <Clock size={11} />
                                                        {daysLeft === 0 ? 'Closes today!' : urgent ? `${daysLeft} days left` : `${daysLeft} days remaining`}
                                                    </span>
                                                    <span className="text-gray-400">
                                                        {endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                {elapsed !== null && (
                                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${urgent ? 'bg-red-400' : 'bg-blue-400'}`}
                                                            style={{ width: `${elapsed}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Sticky bottom CTA */}
                <div className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${selectedCall ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="bg-white/95 backdrop-blur border-t border-gray-200 shadow-xl px-4 py-4">
                        <div className="max-w-4xl mx-auto flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500">Selected call</p>
                                <p className="text-sm font-semibold text-gray-900 truncate">{selectedCall?.title}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleStartApplication}
                                disabled={starting}
                                className="shrink-0 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-60"
                            >
                                {starting
                                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Starting…</>
                                    : <>Start Application <ChevronRight size={15} /></>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // ── Phase: wizard ─────────────────────────────────────────────────────────

    const selfNavigating = SELF_NAVIGATING.has(step);

    return (
        <AppLayout breadcrumb="Proposals / New Application">
            <div className="max-w-5xl mx-auto">

                {/* Return reason banner */}
                {returnReason && (
                    <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl p-4">
                        <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800">Returned for correction</p>
                            <p className="text-sm text-amber-700 mt-0.5">{returnReason}</p>
                        </div>
                    </div>
                )}

                {/* Selected call banner */}
                {selectedCall && (
                    <div className="mb-5 flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${(CATEGORY_STYLE[selectedCall.category] ?? CATEGORY_STYLE.research).bg}`}>
                            <Megaphone size={14} className={(CATEGORY_STYLE[selectedCall.category] ?? CATEGORY_STYLE.research).text} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400">Applying to</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{selectedCall.title}</p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{selectedCall.academic_year}</span>
                    </div>
                )}

                {/* Two-column layout */}
                <div className="flex gap-6 items-start">
                    {/* Sidebar */}
                    <StepSidebar
                        currentStep={step}
                        completedSteps={completedSteps}
                        onGoTo={setStep}
                    />

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                        {/* Mobile step indicator */}
                        <div className="lg:hidden mb-4 flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                            <span className="text-xs text-gray-400">Step {step + 1} of {STEPS.length}</span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-blue-600">{STEPS[step].label}</span>
                        </div>

                        {/* Step card */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Step header */}
                            <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                                        {(() => { const Icon = STEPS[step].icon; return <Icon size={20} className="text-white" />; })()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-blue-200 font-medium">Step {step + 1} of {STEPS.length}</span>
                                        </div>
                                        <h2 className="text-lg font-bold text-white leading-tight">{STEPS[step].label}</h2>
                                        <p className="text-blue-100 text-sm">{STEPS[step].description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Step content */}
                            <div className="p-6">{renderStep()}</div>
                        </div>

                        {/* Navigation */}
                        {!submitted && step < 6 && !selfNavigating && (
                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setStep(Math.max(0, step - 1))}
                                        disabled={step === 0}
                                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                    >
                                        <ArrowLeft size={15} /> Back
                                    </button>
                                    <a
                                        href="/my-proposals"
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
                                        title="Your progress is saved automatically"
                                    >
                                        <Save size={14} /> Save as Draft
                                    </a>
                                </div>
                                <button
                                    type="button"
                                    onClick={next}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-blue-700 text-white rounded-xl hover:bg-blue-800 disabled:opacity-60 shadow-sm transition-colors"
                                >
                                    {saving
                                        ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                                        : step === 5 ? <><Send size={14} /> Proceed to Submit</>
                                        : <>Save & Continue <ChevronRight size={15} /></>
                                    }
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
