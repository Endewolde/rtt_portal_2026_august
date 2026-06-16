import { useState, useEffect, useMemo } from 'react';
import {
    Clock, AlertCircle, CheckCircle2, ChevronRight, FileText,
    Users, DollarSign, Upload, Eye, Send, Megaphone, ArrowLeft,
    Building2, BookOpen, Info, Save, Calendar, Hash,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import TrackerNumberDisplay from '../../Components/TrackerNumberDisplay';
import Step3CoInvestigators from './Steps/Step3CoInvestigators';
import Step5Documents, { DOC_TYPES } from './Steps/Step5Documents';
import { post, get } from '../../lib/api';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
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

const FOCUS_AREA_OPTIONS = {
    research: [
        'Agriculture & Food Systems',
        'Health & Biomedical Sciences',
        'Education & Social Sciences',
        'Engineering & Technology',
        'Environmental & Climate Sciences',
        'Economics & Business',
        'Natural Sciences',
        'Humanities & Arts',
        'Other',
    ],
    community_engagement: [
        'Health & Well-being',
        'Agriculture & Food Security',
        'Education & Literacy',
        'Environmental Conservation',
        'Women Empowerment',
        'Youth Development',
        'Poverty Reduction',
        'Infrastructure & Sanitation',
        'Other',
    ],
    technology_transfer: [
        'Product Innovation',
        'Process Innovation',
        'Service Innovation',
        'Knowledge & Technology Transfer',
        'Intellectual Property Commercialisation',
        'Industry-University Collaboration',
        'Digital Transformation',
        'Other',
    ],
};

const RESEARCH_TYPE_OPTIONS = [
    'Basic Research',
    'Applied Research',
    'Experimental Development',
    'Clinical Research',
    'Action Research',
    'Review / Meta-analysis',
];

const DURATION_OPTIONS = [3, 6, 9, 12, 18, 24, 30, 36, 48, 60];

// ─── Step 1 — Basic Info ──────────────────────────────────────────────────────

function Step1({ data, onChange, errors, category }) {
    const abstractLen  = (data.abstract ?? '').length;
    const abstractOk   = abstractLen >= 100;
    const focusOptions = FOCUS_AREA_OPTIONS[category] ?? FOCUS_AREA_OPTIONS.research;
    const isResearch   = category === 'research';

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
                                {RESEARCH_TYPE_OPTIONS.map(opt => (
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

function Step4({ items, onChange, rowErrors }) {
    const add    = () => onChange([...items, { category: '', description: '', amount: '', justification: '' }]);
    const update = (i, field, val) => onChange(items.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
    const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
    const total  = items.reduce((s, it) => s + Number(it.amount || 0), 0);

    return (
        <div className="space-y-5">
            {items.length === 0 ? (
                <div className="border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl px-4 py-8 text-center">
                    <DollarSign size={28} className="mx-auto text-amber-400 mb-2" />
                    <p className="text-sm font-semibold text-amber-700">No budget items yet</p>
                    <p className="text-xs text-amber-600 mt-1">Add at least one budget item to continue.</p>
                </div>
            ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                {['Category', 'Description', 'Amount (ETB)', 'Justification', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item, i) => {
                                const rowErr = rowErrors?.[i];
                                return (
                                    <tr key={i} className={rowErr ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                        <td className="px-3 py-2.5">
                                            <select
                                                value={item.category}
                                                onChange={e => update(i, 'category', e.target.value)}
                                                className={`w-32 text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white ${rowErr?.category ? 'border-red-400' : 'border-gray-200'}`}
                                            >
                                                <option value="">Select…</option>
                                                {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <input
                                                value={item.description}
                                                onChange={e => update(i, 'description', e.target.value)}
                                                placeholder="Item description"
                                                className={`w-44 text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${rowErr?.description ? 'border-red-400' : 'border-gray-200'}`}
                                            />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <input
                                                type="number" min="0"
                                                value={item.amount}
                                                onChange={e => update(i, 'amount', e.target.value)}
                                                placeholder="0"
                                                className={`w-28 text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${rowErr?.amount ? 'border-red-400' : 'border-gray-200'}`}
                                            />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <input
                                                value={item.justification}
                                                onChange={e => update(i, 'justification', e.target.value)}
                                                placeholder="Optional"
                                                className="w-40 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <button onClick={() => remove(i)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                            <tr>
                                <td colSpan={2} className="px-3 py-2.5 text-xs text-gray-500">
                                    {items.length} item{items.length !== 1 ? 's' : ''}
                                </td>
                                <td className="px-3 py-2.5">
                                    <span className="text-sm font-bold text-gray-900">
                                        ETB {Number(total).toLocaleString()}
                                    </span>
                                </td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <button
                onClick={add}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors"
            >
                <DollarSign size={15} /> Add Budget Item
            </button>
        </div>
    );
}

// ─── Step 6 — Preview ─────────────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
const getInitials = name => (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
const getAvatarColor = name => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

function PreviewSection({ index, title, icon: Icon, children }) {
    return (
        <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {index}
                </div>
                <Icon size={16} className="text-gray-400 shrink-0" />
                <h3 className="text-sm font-semibold text-gray-900 tracking-wide uppercase">{title}</h3>
            </div>
            <div className="p-6">{children}</div>
        </section>
    );
}

function SummaryRow({ label, value, complete }) {
    return (
        <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className={`font-semibold flex items-center gap-1.5 ${complete === false ? 'text-red-500' : 'text-gray-900'}`}>
                {complete === false && <AlertCircle size={13} />}
                {complete === true && <CheckCircle2 size={13} className="text-green-500" />}
                {value}
            </span>
        </div>
    );
}

function Step6Preview({ stepData, budgetItems, user, category, selectedCall }) {
    const d           = stepData[0] ?? {};
    const team        = stepData[2]?.co_investigators ?? [];
    const totalCo     = team.reduce((s, c) => s + (parseFloat(c.contribution_percentage) || 0), 0);
    const piContrib   = Math.max(0, 100 - totalCo);
    const budgetTotal = budgetItems.reduce((s, i) => s + Number(i.amount || 0), 0);
    const documents   = stepData[4]?.documents ?? {};
    const docsDone    = DOC_TYPES.filter(dt => documents[dt.key]?.status === 'done').length;
    const docsRequired = DOC_TYPES.filter(dt => dt.required).length;

    const keywords    = (d.keywords ?? '').split(',').map(k => k.trim()).filter(Boolean);
    const durationLabel = d.duration_months
        ? (d.duration_months < 12
            ? `${d.duration_months} months`
            : `${d.duration_months / 12} year${d.duration_months > 12 ? 's' : ''} (${d.duration_months} months)`)
        : null;
    const categoryLabel = (category ?? '').replace(/_/g, ' ');

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700">
                <Eye size={15} className="shrink-0" />
                This is exactly what reviewers will see. Check every section carefully — you can still go back and edit before submitting.
            </div>

            {/* Letterhead / document header */}
            <div className="bg-white border border-gray-200 rounded-2xl px-7 py-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500" />
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    {category && (
                        <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs px-2.5 py-1 rounded-full font-medium capitalize">
                            {categoryLabel}
                        </span>
                    )}
                    {selectedCall?.academic_year && (
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full font-medium">
                            <Calendar size={11} /> {selectedCall.academic_year}
                        </span>
                    )}
                    {selectedCall?.title && (
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full font-medium">
                            <Hash size={11} /> {selectedCall.title}
                        </span>
                    )}
                </div>

                <h2 className="text-2xl font-bold text-gray-900 leading-snug mb-3">
                    {d.title || <span className="text-red-400 italic font-normal">No title provided</span>}
                </h2>

                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {d.abstract || <span className="text-gray-400 italic">No abstract provided</span>}
                </p>

                <div className="flex flex-wrap gap-2">
                    {d.focus_area && (
                        <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
                            Focus: {d.focus_area}
                        </span>
                    )}
                    {category === 'research' && d.research_type && (
                        <span className="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 text-violet-700 text-xs px-2.5 py-1 rounded-full font-medium">
                            Type: {d.research_type}
                        </span>
                    )}
                    {durationLabel && (
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-medium">
                            Duration: {durationLabel}
                        </span>
                    )}
                </div>

                {keywords.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                        {keywords.map(k => (
                            <span key={k} className="bg-blue-50 text-blue-600 text-xs px-2.5 py-1 rounded-full border border-blue-100 font-medium">{k}</span>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
                {/* Main sections */}
                <div className="space-y-6">
                    <PreviewSection index={1} title="Research Team" icon={Users}>
                        <div className="space-y-2">
                            {/* PI row */}
                            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                        {getInitials(user?.name)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                                        <p className="text-xs text-gray-500">{user?.email}</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">PI</span>
                                    <p className="text-xs text-gray-500 mt-0.5">{piContrib.toFixed(1)}% contribution</p>
                                </div>
                            </div>
                            {team.length === 0 && (
                                <p className="text-sm text-red-500 italic px-1">No co-investigators added — required before submission.</p>
                            )}
                            {team.map(coI => (
                                <div key={coI.user_id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl ${getAvatarColor(coI.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                            {getInitials(coI.name)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{coI.name}</p>
                                            <p className="text-xs text-gray-500">{coI.email}</p>
                                            {coI.college_name && <p className="text-xs text-gray-400">{coI.college_name}</p>}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Co-PI</span>
                                        <p className="text-xs text-gray-500 mt-0.5">{coI.contribution_percentage}% contribution</p>
                                    </div>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500">
                                <span>{team.length + 1} total member{team.length !== 0 ? 's' : ''}</span>
                                <span>Total contribution: <strong className="text-gray-700">100%</strong></span>
                            </div>
                        </div>
                    </PreviewSection>

                    <PreviewSection index={2} title={`Budget Plan — ETB ${budgetTotal.toLocaleString()}`} icon={DollarSign}>
                        {budgetItems.length === 0 ? (
                            <p className="text-sm text-red-400 italic">No budget items added.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            {['Category', 'Description', 'Amount (ETB)', 'Justification'].map(h => (
                                                <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {budgetItems.map((item, i) => (
                                            <tr key={i}>
                                                <td className="py-2.5 pr-4 font-medium text-gray-700 capitalize">{item.category || '—'}</td>
                                                <td className="py-2.5 pr-4 text-gray-600">{item.description || '—'}</td>
                                                <td className="py-2.5 pr-4 font-semibold text-gray-900">{Number(item.amount || 0).toLocaleString()}</td>
                                                <td className="py-2.5 text-gray-400 text-xs">{item.justification || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-gray-200">
                                            <td colSpan={2} className="py-2.5 pr-4 text-xs font-semibold text-gray-500 uppercase">Total</td>
                                            <td className="py-2.5 pr-4 font-bold text-gray-900">{budgetTotal.toLocaleString()}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </PreviewSection>

                    <PreviewSection index={3} title="Documents" icon={Upload}>
                        <div className="space-y-2">
                            {DOC_TYPES.map(dt => {
                                const doc = documents[dt.key];
                                return (
                                    <div key={dt.key}
                                        className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                                            doc?.status === 'done' ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
                                        }`}>
                                        {doc?.status === 'done'
                                            ? <FileText size={15} className="text-green-600 shrink-0" />
                                            : <AlertCircle size={15} className="text-gray-300 shrink-0" />
                                        }
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800">
                                                {dt.label}
                                                {dt.required && <span className="text-red-500 ml-0.5">*</span>}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {doc?.filename ?? (dt.required
                                                    ? <span className="text-red-400 italic">Not uploaded</span>
                                                    : <span className="text-gray-400 italic">Not provided (optional)</span>
                                                )}
                                            </p>
                                        </div>
                                        {doc?.size && <span className="text-xs text-gray-400 shrink-0">{doc.size}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </PreviewSection>
                </div>

                {/* Sticky summary sidebar */}
                <aside className="lg:sticky lg:top-6 self-start">
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Submission Summary</p>
                        <div className="divide-y divide-gray-50">
                            <SummaryRow label="Team size" value={`${team.length + 1}`} />
                            <SummaryRow label="Co-investigators" value={team.length} complete={team.length >= 1} />
                            <SummaryRow label="Budget total" value={`ETB ${budgetTotal.toLocaleString()}`} complete={budgetItems.length > 0} />
                            <SummaryRow label="Documents" value={`${docsDone}/${DOC_TYPES.length}`} complete={docsDone >= docsRequired} />
                        </div>
                    </div>
                </aside>
            </div>
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
            .catch(() => toast.warning('Could not load proposal data.'));
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
            case 0: return <Step1 data={stepData[0]} onChange={handleStep1Change} errors={step1Errors} category={category} />;
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
            case 5: return <Step6Preview stepData={stepData} budgetItems={budgetItems} user={user} category={category} selectedCall={selectedCall} />;
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
            <AppLayout breadcrumb="Proposals / New Application">
                <div className="max-w-3xl mx-auto">
                    {/* Hero header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                            <Megaphone size={28} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">New Research Proposal</h1>
                        <p className="text-gray-500 mt-2 text-sm">Select the funding call you want to apply to, then complete the application wizard.</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                            <BookOpen size={16} className="text-gray-400" />
                            <h2 className="text-sm font-semibold text-gray-700">Active Funding Calls</h2>
                            {!callsLoading && <span className="ml-auto text-xs text-gray-400">{calls.length} available</span>}
                        </div>

                        <div className="p-6">
                            {callsLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : calls.length === 0 ? (
                                <div className="text-center py-10 bg-amber-50 border border-amber-200 rounded-xl">
                                    <Megaphone size={28} className="mx-auto text-amber-400 mb-2" />
                                    <p className="text-amber-700 font-semibold text-sm">No active calls available</p>
                                    <p className="text-amber-600 text-xs mt-1">Check back later or contact your administrator.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {calls.map(call => {
                                        const style     = CATEGORY_STYLE[call.category] ?? CATEGORY_STYLE.research;
                                        const isSelected = selectedCall?.id === call.id;
                                        const daysLeft  = call.end_date
                                            ? Math.max(0, Math.ceil((new Date(call.end_date) - new Date()) / 86400000))
                                            : null;

                                        return (
                                            <button
                                                key={call.id}
                                                onClick={() => setSelectedCall(call)}
                                                className={`w-full text-left border-2 rounded-2xl p-5 transition-all ${
                                                    isSelected
                                                        ? 'border-blue-600 bg-blue-50 shadow-md shadow-blue-100'
                                                        : 'border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${style.bg} ${style.text} ${style.border}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                                {call.category?.replace(/_/g, ' ')}
                                                            </span>
                                                            <span className="text-xs text-gray-400 font-medium">{call.academic_year}</span>
                                                        </div>
                                                        <h3 className="text-sm font-bold text-gray-900 leading-snug">{call.title}</h3>
                                                        {call.description && (
                                                            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{call.description}</p>
                                                        )}
                                                        {daysLeft !== null && (
                                                            <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${daysLeft <= 7 ? 'text-red-500' : 'text-gray-500'}`}>
                                                                <Clock size={11} />
                                                                {daysLeft === 0 ? 'Closes today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
                                                                {' · '}
                                                                <span className="font-normal">
                                                                    {new Date(call.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                                    }`}>
                                                        {isSelected && <CheckCircle2 size={14} className="text-white" />}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* CTA */}
                            <div className="mt-6 pt-5 border-t border-gray-100">
                                {selectedCall && (
                                    <div className="flex items-center gap-2 mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                                        <CheckCircle2 size={15} className="shrink-0" />
                                        <span>Selected: <strong>{selectedCall.title}</strong></span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleStartApplication}
                                    disabled={!selectedCall || starting}
                                    className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {starting ? (
                                        <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Starting…</>
                                    ) : (
                                        <>{selectedCall ? 'Start Application' : 'Select a Call to Continue'} <ChevronRight size={16} /></>
                                    )}
                                </button>
                            </div>
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
