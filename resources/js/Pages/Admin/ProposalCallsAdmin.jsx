import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Megaphone, Plus, X, Search, Pencil, CheckCircle, XCircle,
    Eye, RefreshCw, Trash2, Upload, FileText, Download, Filter,
    Settings, AlertCircle, GraduationCap, Calendar, Clock,
    AlignLeft, Users, Tag, ShieldCheck, BookOpen, ChevronRight, Wallet, Copy, Loader2, ClipboardList, Route,
} from 'lucide-react';
import { Link, usePage } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import ConfirmDialog from '../../Components/ConfirmDialog';
import ApplicationFormBuilder from '../../Components/ApplicationFormBuilder';
import ReviewRouteModal from '../../Components/ReviewRouteModal';
import ViewToggle from '../../Components/ViewToggle';
import { useViewPreference } from '../../hooks/useViewPreference';
import api, { get, post, del } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';
import { downloadFile } from '../../lib/download';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { currency } from '../../lib/terms';
import { programmes } from '../../lib/programmes';

// Convert any date/datetime string to the YYYY-MM-DDTHH:mm format
// required by datetime-local inputs.
// We intentionally avoid new Date() here — the server returns the time
// as stored (the user's intended local time) with a Z suffix appended
// by Laravel's JSON serialisation. Passing that through new Date() would
// convert UTC→local and drift the displayed time by the user's UTC offset
// on every save cycle. Instead, just take the first 16 characters of the
// normalised string (YYYY-MM-DDTHH:mm), discarding subseconds and timezone.
function toDateTimeLocal(value) {
    if (!value) return '';
    return String(value).replace(' ', 'T').slice(0, 16);
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** The organisation's programmes as select options (Settings → Programmes). */
const categoriesOptions = () => programmes({ includeInactive: false }).map((p) => ({ value: p.key, label: p.name }));

const CATEGORY_COLORS = {
    research:             'bg-blue-100 text-blue-700',
    community_engagement: 'bg-green-100 text-green-700',
    technology_transfer:  'bg-purple-100 text-purple-700',
    innovation:           'bg-orange-100 text-orange-700',
    other:                'bg-gray-100 text-gray-600',
};

const STATUS_COLORS = {
    draft:   'bg-gray-100 text-gray-600',
    active:  'bg-green-100 text-green-700',
    closed:  'bg-red-100 text-red-600',
    expired: 'bg-amber-100 text-amber-700',
};

const STATUS_TABS = [
    { key: 'all',     label: 'All' },
    { key: 'draft',   label: 'Draft' },
    { key: 'active',  label: 'Active' },
    { key: 'closed',  label: 'Closed' },
    { key: 'expired', label: 'Expired' },
];

const EMPTY_FORM = {
    title: '', category: 'research', academic_year: '',
    description: '', eligibility: '', start_date: '', end_date: '',
    max_proposals_per_pi: '',
    funding_budget: '',
    guidelines_file: null, guidelines_filename: null,
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, icon: Icon, required, error, hint, children }) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {Icon && <Icon size={11} className="text-gray-400" />}
                {label} {required && <span className="text-red-400 font-bold">*</span>}
            </label>
            {children}
            {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
            {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
        </div>
    );
}

function input(err) {
    return `w-full rounded-xl border ${err ? 'border-red-400 bg-red-50/30' : 'border-gray-200'} px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors`;
}

function SectionDivider({ label }) {
    return (
        <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">{label}</span>
            <div className="flex-1 h-px bg-gray-100" />
        </div>
    );
}

// ── ProposalCallModal ─────────────────────────────────────────────────────────

function ProposalCallModal({ initial, defaultAcademicYear, onClose, onSaved }) {
    const toast  = useToast();
    const isEdit = !!initial?.id;

    const [form, setForm] = useState(() =>
        initial ?? { ...EMPTY_FORM, academic_year: defaultAcademicYear ?? '' }
    );
    const [errors, setSaveErrors] = useState({});
    const [saving, setSaving]     = useState(false);
    const [guidelinesFile, setGuidelinesFile] = useState(null);
    const guidelinesInputRef = useRef(null);

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    const statusColor = {
        active:  { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
        draft:   { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
        closed:  { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
        expired: { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
    }[initial?.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };

    // academic year: always from system settings; for edit show stored value if it differs
    const systemYear   = defaultAcademicYear;
    const storedYear   = initial?.academic_year;
    const yearMismatch = isEdit && storedYear && systemYear && storedYear !== systemYear;
    const displayYear  = isEdit ? (storedYear || systemYear) : systemYear;

    // action: false = save only | true = save+activate (new) | 'reactivate' = save+reopen (expired/closed)
    const handleSubmit = async (action = false) => {
        const newErrors = {};
        if (!form.title?.trim())    newErrors.title         = ['Title is required'];
        if (!form.category)         newErrors.category      = ['Category is required'];
        if (!form.academic_year)    newErrors.academic_year = ['Academic year is required'];
        if (!form.start_date)       newErrors.start_date    = ['Opening date and time is required'];
        if (!form.end_date)         newErrors.end_date      = ['Deadline is required'];

        if ((action === true || action === 'reactivate') && form.end_date) {
            if (new Date(form.end_date) <= new Date()) {
                newErrors.end_date = ['Deadline must be in the future to activate this call.'];
                toast.warning('Please set a future deadline before activating.', { title: 'Future Date Required' });
            }
        }

        if (Object.keys(newErrors).length) { setSaveErrors(newErrors); return; }

        setSaving(true);
        setSaveErrors({});
        try {
            const payload = {
                title:                form.title,
                category:             form.category,
                academic_year:        form.academic_year,
                description:          form.description,
                eligibility:          form.eligibility,
                start_date:           form.start_date,
                end_date:             form.end_date,
                max_proposals_per_pi: form.max_proposals_per_pi || null,
                funding_budget:       form.funding_budget === '' ? null : Number(form.funding_budget),
            };

            let savedCall;
            if (isEdit) {
                const res = await api.put(`/proposal-calls/${initial.id}`, payload);
                savedCall = res.data?.data ?? res.data;
                if (action === 'reactivate') {
                    await api.post(`/proposal-calls/${initial.id}/reopen`);
                    toast.success('Proposal call updated and reactivated — now accepting applications.', { title: 'Reactivated ✓' });
                } else {
                    toast.success('Proposal call updated.');
                }
            } else {
                const res = await api.post('/proposal-calls', payload);
                savedCall = res.data?.data ?? res.data;
                if (action === true && savedCall?.id) {
                    await api.post(`/proposal-calls/${savedCall.id}/activate`);
                    toast.success('Call is now live and accepting applications.');
                } else {
                    toast.success('Proposal call saved as draft.');
                }
            }

            const callId = savedCall?.id ?? initial?.id;
            if (guidelinesFile && callId) {
                const fd = new FormData();
                fd.append('file', guidelinesFile);
                await api.post(`/proposal-calls/${callId}/guidelines`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                setGuidelinesFile(null);
            }

            onSaved();
            onClose();
        } catch (err) {
            const fieldErrors = err.response?.data?.errors ?? {};
            if (Object.keys(fieldErrors).length) setSaveErrors(fieldErrors);
            toast.error(err.response?.data?.message ?? 'Failed to save proposal call.', { title: 'Save Failed' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-start justify-center p-4 pt-8">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

                {/* ── Header ── */}
                <div className={`px-6 py-5 border-b border-gray-100 ${isEdit ? 'bg-gray-50/60' : 'bg-blue-50/40'}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isEdit ? 'bg-blue-100' : 'bg-blue-600'}`}>
                                <Megaphone size={18} className={isEdit ? 'text-blue-600' : 'text-white'} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-gray-900">
                                        {isEdit ? 'Edit Proposal Call' : 'New Proposal Call'}
                                    </h2>
                                    {isEdit && initial?.status && (
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${statusColor.bg} ${statusColor.text}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${statusColor.dot}`} />
                                            {initial.status}
                                        </span>
                                    )}
                                </div>
                                {isEdit && initial?.title && (
                                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">{initial.title}</p>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">

                    {/* Reactivation banner */}
                    {isEdit && ['expired', 'closed'].includes(initial?.status) && (
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
                            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-amber-800">This call is {initial.status}</p>
                                <p className="text-sm text-amber-700 mt-0.5">
                                    Update the deadline to a future date, then click <strong>Save &amp; Reactivate</strong> to reopen it.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Basic info ── */}
                    <SectionDivider label="Basic Information" />

                    <Field label="Title" icon={Megaphone} required error={errors.title?.[0]}>
                        <input value={form.title} onChange={(e) => set('title', e.target.value)}
                            placeholder="e.g. Research Grants Round 2026"
                            className={input(errors.title)} />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Category" icon={Tag} required error={errors.category?.[0]}>
                            <select value={form.category} onChange={(e) => set('category', e.target.value)}
                                className={input(errors.category)}>
                                {categoriesOptions().map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </Field>

                        {/* ── Academic Year — always from system settings ── */}
                        <Field
                            label="Academic Year"
                            icon={GraduationCap}
                            required
                            error={errors.academic_year?.[0]}
                        >
                            {displayYear ? (
                                <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border ${
                                    yearMismatch ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
                                }`}>
                                    <GraduationCap size={14} className={yearMismatch ? 'text-amber-500' : 'text-blue-500'} />
                                    <span className={`text-sm font-semibold flex-1 ${yearMismatch ? 'text-amber-800' : 'text-gray-800'}`}>
                                        {displayYear}
                                    </span>
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400 shrink-0">
                                        <Settings size={10} /> System
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border border-amber-300 bg-amber-50">
                                    <AlertCircle size={14} className="text-amber-500 shrink-0" />
                                    <span className="text-sm text-amber-700">Not configured</span>
                                </div>
                            )}
                            {yearMismatch && (
                                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                    <AlertCircle size={10} />
                                    Stored as <strong>{storedYear}</strong>. Current system year is <strong>{systemYear}</strong>.
                                </p>
                            )}
                            {!displayYear && (
                                <p className="text-xs text-amber-600 mt-1.5">
                                    Set the academic year in{' '}
                                    <a href="/admin/settings" className="underline font-semibold hover:text-amber-800">Settings</a> first.
                                </p>
                            )}
                        </Field>
                    </div>

                    {/* ── Schedule ── */}
                    <SectionDivider label="Schedule" />

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Opening Date & Time" icon={Calendar} required error={errors.start_date?.[0]}>
                            <input type="datetime-local" value={form.start_date}
                                onChange={(e) => set('start_date', e.target.value)}
                                className={input(errors.start_date)} />
                        </Field>
                        <Field label="Application Deadline" icon={Clock} required error={errors.end_date?.[0]}>
                            <input type="datetime-local" value={form.end_date}
                                onChange={(e) => set('end_date', e.target.value)}
                                className={input(errors.end_date)} />
                        </Field>
                    </div>

                    <Field label="Max Proposals per PI" icon={Users} error={errors.max_proposals_per_pi?.[0]}
                        hint="How many proposals one PI may submit to this call specifically. Leave blank for no limit — separate from the systemwide active-proposal cap in Settings → Review Thresholds.">
                        <input type="number" min="1" value={form.max_proposals_per_pi}
                            onChange={(e) => set('max_proposals_per_pi', e.target.value)}
                            placeholder="e.g. 2"
                            className={input(errors.max_proposals_per_pi)} />
                    </Field>

                    <Field label={`Total Funding Budget (${currency()})`} icon={Wallet} error={errors.funding_budget?.[0]}
                        hint="The money available to fund proposals from this call. Central Evaluation ranks passing proposals against it and warns before it is overspent. Leave blank if not fixed.">
                        <input type="number" min="0" step="1000" value={form.funding_budget}
                            onChange={(e) => set('funding_budget', e.target.value)}
                            placeholder="e.g. 5000000"
                            className={input(errors.funding_budget)} />
                    </Field>

                    {/* ── Details ── */}
                    <SectionDivider label="Details" />

                    <Field label="Description" icon={AlignLeft} error={errors.description?.[0]}>
                        <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                            rows={4} placeholder="Describe the purpose and scope of this call…"
                            className={`${input(errors.description)} resize-none`} />
                    </Field>

                    <Field label="Eligibility Criteria" icon={ShieldCheck} error={errors.eligibility?.[0]}>
                        <textarea value={form.eligibility} onChange={(e) => set('eligibility', e.target.value)}
                            rows={3} placeholder="Who is eligible to apply…"
                            className={`${input(errors.eligibility)} resize-none`} />
                    </Field>

                    {/* ── Guidelines upload ── */}
                    <SectionDivider label="Documents" />

                    <Field label="Guidelines / Brochure" icon={BookOpen} hint="PDF only, max 10 MB — optional">
                        {form.guidelines_filename && !guidelinesFile && (
                            <div className="flex items-center gap-2 mb-2.5 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                                <FileText size={14} className="text-blue-500 shrink-0" />
                                <span className="text-sm text-blue-700 flex-1 truncate">{form.guidelines_filename}</span>
                                <button type="button" onClick={() => set('guidelines_filename', null)}
                                    className="text-gray-400 hover:text-red-500 transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <div
                            className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-blue-400 hover:bg-blue-50/40 transition-colors cursor-pointer"
                            onClick={() => guidelinesInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files[0];
                                if (file && file.type === 'application/pdf') setGuidelinesFile(file);
                                else toast.warning('Please upload a PDF file.');
                            }}
                        >
                            {guidelinesFile ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileText size={16} className="text-blue-500" />
                                    <span className="text-sm text-blue-700 font-medium">{guidelinesFile.name}</span>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setGuidelinesFile(null); }}
                                        className="text-gray-400 hover:text-red-500 transition-colors ml-1">
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <Upload size={22} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-sm font-medium text-gray-500">Click or drag PDF here</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Guidelines, brochure, or call document</p>
                                </div>
                            )}
                        </div>
                        <input ref={guidelinesInputRef} type="file" accept=".pdf" className="hidden"
                            onChange={(e) => { const f = e.target.files[0]; if (f) setGuidelinesFile(f); }} />
                    </Field>
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-col-reverse gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/80 rounded-b-2xl sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 font-medium transition-colors">
                        Cancel
                    </button>
                    <div className="flex flex-wrap gap-2.5">
                        <button type="button" onClick={() => handleSubmit(false)} disabled={saving}
                            className="px-5 py-2.5 rounded-xl border border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-50 disabled:opacity-50 transition-colors">
                            {saving ? <><RefreshCw size={13} className="animate-spin inline mr-1.5" />Saving…</> : isEdit ? 'Save Changes' : 'Save as Draft'}
                        </button>

                        {!isEdit && (
                            <button type="button" onClick={() => handleSubmit(true)} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm shadow-blue-200 transition-colors">
                                <CheckCircle size={14} />
                                {saving ? 'Saving…' : 'Save & Activate'}
                            </button>
                        )}

                        {isEdit && ['expired', 'closed'].includes(initial?.status) && (
                            <button type="button" onClick={() => handleSubmit('reactivate')} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 shadow-sm shadow-green-200 transition-colors">
                                <RefreshCw size={14} />
                                {saving ? 'Saving…' : 'Save & Reactivate'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

/** Year arithmetic for "2026-2027"-style academic years and the dates/titles that go with them. */
const nextAcademicYear = (ay) => {
    const start = parseInt(String(ay).slice(0, 4), 10);
    return Number.isFinite(start) ? `${start + 1}-${start + 2}` : ay;
};
const shiftDate = (value, years) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() + years);
    const pad = (n) => String(n).padStart(2, '0');
    // Local wall-clock time, as a datetime-local input expects.
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Copy a call into a new draft for another academic year; everything else carries over. */
function CopyCallModal({ call, onClose, onCopied }) {
    const toast = useToast();
    const [form, setForm] = useState(() => {
        const year = nextAcademicYear(call.academic_year);
        const shift = (parseInt(year, 10) || 0) - (parseInt(call.academic_year, 10) || 0);
        const title = call.title?.includes(call.academic_year)
            ? call.title.replace(call.academic_year, year)
            : (call.title ?? '').replace(/\b(20\d{2})\b/g, (y) => String(Number(y) + shift));
        return { academic_year: year, title, start_date: shiftDate(call.start_date, shift), end_date: shiftDate(call.end_date, shift) };
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const submit = async () => {
        setSaving(true);
        setErrors({});
        try {
            const res = await post(`/proposal-calls/${call.id}/copy`, form);
            toast.success(res.message ?? 'Call copied as a draft.');
            onCopied(res.data);
        } catch (err) {
            setErrors(err.response?.data?.errors ?? {});
            toast.error(err.response?.data?.message ?? 'Could not copy the call.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><Copy size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">Copy call</h2>
                            <p className="truncate text-xs text-gray-500">From “{call.title}” · {call.academic_year}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="space-y-4 px-6 py-5">
                    <Field label="New title" required error={errors.title?.[0]}>
                        <input value={form.title} onChange={set('title')} className={input(errors.title)} />
                    </Field>
                    <Field label="Academic year" required error={errors.academic_year?.[0]} hint="Format: 2027-2028">
                        <input value={form.academic_year} onChange={set('academic_year')} className={input(errors.academic_year)} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Opens" error={errors.start_date?.[0]}>
                            <input type="datetime-local" value={form.start_date} onChange={set('start_date')} className={input(errors.start_date)} />
                        </Field>
                        <Field label="Closes" error={errors.end_date?.[0]}>
                            <input type="datetime-local" value={form.end_date} onChange={set('end_date')} className={input(errors.end_date)} />
                        </Field>
                    </div>
                    <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                        The description, eligibility, category, budget, per-PI limit and guidelines PDF are copied. The new call starts as a <b>draft</b>, so nothing is published until you activate it.
                    </p>
                </div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving || !form.title || !form.academic_year}
                        className="inline-flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} Create draft copy
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProposalCallsAdmin() {
    const { hasPermission, accessScope } = useAuth();
    const toast                  = useToast();
    const { confirm, Dialog }    = useConfirm();

    // Roles that should see ALL calls (admin endpoint), not just public active ones
    const canSeeAll = accessScope.type !== 'own' && hasPermission('proposal_calls.view_any');
    // Roles that can create, edit, activate, close, delete calls
    const canCreate = hasPermission('proposal_calls.create');
    const canManage = canCreate;

    const [view, setView] = useViewPreference('proposal_calls_admin', 'table');
    const [calls, setCalls]               = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [activeTab, setActiveTab]       = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [showModal, setShowModal]       = useState(false);
    const [editCall, setEditCall]         = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const [copying, setCopying]           = useState(null);
    const [formFor, setFormFor]           = useState(null);
    const [routeFor, setRouteFor]         = useState(null);
    const [acting, setActing]             = useState(false);
    const appSettings = usePage().props.app_settings ?? {}
    const defaultAcademicYear = appSettings.current_academic_year ?? ''

    const load = useCallback(() => {
        setLoading(true);
        const endpoint = canSeeAll ? '/proposal-calls/all' : '/proposal-calls';
        get(endpoint)
            .then((r) => {
                const raw   = r.data ?? [];
                const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
                setCalls(items);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [canSeeAll]);

    useEffect(() => { load(); }, [load]);

    // Filtered calls — status tab + category + search
    const filteredCalls = calls.filter((c) =>
        (activeTab === 'all' || c.status === activeTab) &&
        (!categoryFilter || c.category === categoryFilter) &&
        (!search || c.title?.toLowerCase().includes(search.toLowerCase()))
    );

    // ── Table actions ─────────────────────────────────────────────────────────

    const doAction = async () => {
        if (!confirmAction) return;
        setActing(true);
        try {
            const { type, call } = confirmAction;
            if (type === 'activate') {
                await post(`/proposal-calls/${call.id}/activate`);
                toast.success('Call is now live and accepting applications.');
            }
            if (type === 'close') {
                await post(`/proposal-calls/${call.id}/close`);
                toast.success('Proposal call has been closed.');
            }
            setConfirmAction(null);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message ?? 'Action failed.');
        } finally {
            setActing(false);
        }
    };

    const handleReopen = async (callId) => {
        const ok = await confirm({
            title:        'Reopen Proposal Call',
            description:  'This call will become active and visible to applicants again.',
            confirmLabel: 'Yes, reopen',
        });
        if (!ok) return;
        try {
            await post(`/proposal-calls/${callId}/reopen`);
            toast.success('Proposal call is now active again.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message ?? 'Failed to reopen this call.');
        }
    };

    const handleDelete = async (callId) => {
        const ok = await confirm({
            title:        'Delete this proposal call?',
            description:  'This action cannot be undone. Calls with submitted proposals cannot be deleted.',
            confirmLabel: 'Delete',
            variant:      'danger',
        });
        if (!ok) return;
        try {
            await del(`/proposal-calls/${callId}`);
            toast.success('Proposal call deleted.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message ?? 'Failed to delete call.');
        }
    };

    const openEdit = (call) => {
        setEditCall({
            id:                   call.id,
            status:               call.status ?? 'draft',          // needed for conditional buttons/banner
            title:                call.title ?? '',
            category:             call.category ?? 'research',
            academic_year:        call.academic_year ?? '',
            description:          call.description ?? '',
            eligibility:          call.eligibility ?? '',
            start_date:           toDateTimeLocal(call.start_date),
            end_date:             toDateTimeLocal(call.end_date),
            max_proposals_per_pi: call.max_proposals_per_pi ?? '',
            funding_budget: call.funding_budget ?? '',
            guidelines_file:      call.guidelines_file ?? null,
            guidelines_filename:  call.guidelines_filename ?? null,
        });
    };

    const openNewModal = () => {
        setEditCall(null);
        setShowModal(true);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumb="Proposal Calls">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                    <Megaphone size={22} className="text-blue-600 shrink-0" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Proposal Calls</h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {calls.length} call{calls.length !== 1 ? 's' : ''} total
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Category filter */}
                    <div className="relative">
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                            className="pl-8 pr-8 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white max-w-36">
                            <option value="">All Categories</option>
                            {categoriesOptions().map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search — hidden on mobile to save space */}
                    <div className="relative hidden sm:block">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search calls…"
                            className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
                    </div>

                    <ViewToggle view={view} onChange={setView} />

                    {canCreate && (
                        <button onClick={openNewModal}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 shadow-sm whitespace-nowrap">
                            <Plus size={16} /> New Proposal Call
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile search */}
            <div className="relative sm:hidden mb-4">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search calls…"
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Status tabs */}
            <div className="flex gap-0.5 border-b border-gray-200 mb-5 overflow-x-auto scrollbar-none">
                {STATUS_TABS.map((tab) => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.key
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}>
                        {tab.label}
                        <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs rounded-full px-1.5 py-0.5">
                            {tab.key === 'all' ? calls.length : calls.filter((c) => c.status === tab.key).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : filteredCalls.length === 0 ? (
                <div className="text-center py-14 bg-white rounded-xl border border-gray-200">
                    <Megaphone size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">
                        {activeTab === 'all' ? 'No proposal calls yet' : `No ${activeTab} calls`}
                    </p>
                    {activeTab === 'all' && canCreate && (
                        <button onClick={openNewModal} className="mt-3 text-sm text-blue-600 hover:underline">
                            Create your first proposal call
                        </button>
                    )}
                </div>
            ) : view === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredCalls.map((c) => (
                        <div key={c.id}
                            onClick={() => canManage && openEdit(c)}
                            className={`bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all ${canManage ? 'cursor-pointer' : ''}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {c.status}
                                </span>
                                <span className="text-xs text-gray-400">{c.academic_year}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">{c.title}</p>
                            <p className="text-xs text-gray-500 mb-3 capitalize">{getCategoryLabel(c.category)}</p>
                            <div className="text-xs text-gray-400 space-y-0.5 mb-3">
                                <div>Opens: {c.start_date_formatted ?? formatDate(c.start_date)}</div>
                                <div>Closes: {c.end_date_formatted ?? formatDate(c.end_date)}</div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                {canManage && (
                                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Edit">
                                        <Pencil size={13} />
                                    </button>
                                )}
                                {canManage && (
                                    <button onClick={(e) => { e.stopPropagation(); setRouteFor(c); }} className={`p-1.5 rounded hover:text-violet-600 ${c.review_route ? 'text-violet-500' : 'text-gray-400'}`} title="Review route">
                                        <Route size={13} />
                                    </button>
                                )}
                                {canManage && (
                                    <button onClick={(e) => { e.stopPropagation(); setFormFor(c); }} className={`p-1.5 rounded hover:text-indigo-600 ${c.application_form ? 'text-indigo-500' : 'text-gray-400'}`} title="Application form">
                                        <ClipboardList size={13} />
                                    </button>
                                )}
                                {canManage && (
                                    <button onClick={(e) => { e.stopPropagation(); setCopying(c); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Copy to a new call">
                                        <Copy size={13} />
                                    </button>
                                )}
                                {canManage && c.status === 'draft' && (
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: 'activate', call: c }); }} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Activate">
                                        <CheckCircle size={13} />
                                    </button>
                                )}
                                {canManage && c.status !== 'active' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                        <Trash2 size={13} />
                                    </button>
                                )}
                                {canManage && c.status === 'active' && (
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: 'close', call: c }); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Close">
                                        <XCircle size={13} />
                                    </button>
                                )}
                                <Link
                                    href={`/proposal-calls/${c.id}/submissions`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                                >
                                    {c.proposals_count ?? 0} submitted <ChevronRight size={12} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {['#', 'Title', 'Category', 'Year', 'Status', 'Opens', 'Deadline', 'Submissions', ''].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCalls.map((c, i) => (
                                    <tr key={c.id}
                                        onClick={() => canManage && openEdit(c)}
                                        className={canManage ? 'hover:bg-gray-50 cursor-pointer' : ''}>
                                        <td className="px-4 py-3 text-xs font-medium text-gray-400 tabular-nums w-10">{i + 1}</td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <p className="font-medium text-gray-900 line-clamp-1">{c.title}</p>
                                            <p className="text-xs text-gray-400 font-mono mt-0.5">{c.slug}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[c.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                                {getCategoryLabel(c.category)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{c.academic_year}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {c.start_date_formatted ?? formatDate(c.start_date)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {c.end_date_formatted ?? formatDate(c.end_date)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={`/proposal-calls/${c.id}/submissions`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                                                {c.proposals_count ?? 0} submitted
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                                                <Link href={`/proposal-calls/${c.id}/submissions`}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded"
                                                    title="View submissions">
                                                    <Eye size={15} />
                                                </Link>

                                                {canManage && (
                                                    <>
                                                        <button onClick={() => openEdit(c)}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors rounded"
                                                            title="Edit">
                                                            <Pencil size={15} />
                                                        </button>

                                                        <button onClick={() => setRouteFor(c)}
                                                            className={`p-1.5 hover:text-violet-600 transition-colors rounded ${c.review_route ? 'text-violet-500' : 'text-gray-400'}`}
                                                            title="Review route">
                                                            <Route size={15} />
                                                        </button>

                                                        <button onClick={() => setFormFor(c)}
                                                            className={`p-1.5 hover:text-indigo-600 transition-colors rounded ${c.application_form ? 'text-indigo-500' : 'text-gray-400'}`}
                                                            title="Application form">
                                                            <ClipboardList size={15} />
                                                        </button>

                                                        <button onClick={() => setCopying(c)}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors rounded"
                                                            title="Copy to a new call">
                                                            <Copy size={15} />
                                                        </button>

                                                        {c.status === 'draft' && (
                                                            <button onClick={() => setConfirmAction({ type: 'activate', call: c })}
                                                                className="p-1.5 text-gray-400 hover:text-green-600 transition-colors rounded"
                                                                title="Activate">
                                                                <CheckCircle size={15} />
                                                            </button>
                                                        )}

                                                        {c.status !== 'active' && (
                                                            <button onClick={() => handleDelete(c.id)}
                                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                title="Delete">
                                                                <Trash2 size={15} />
                                                            </button>
                                                        )}

                                                        {c.status === 'active' && (
                                                            <button onClick={() => setConfirmAction({ type: 'close', call: c })}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                                                                title="Close">
                                                                <XCircle size={15} />
                                                            </button>
                                                        )}

                                                        {c.status === 'closed' && (
                                                            <button onClick={() => handleReopen(c.id)}
                                                                className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                                                                title="Reopen call">
                                                                <RefreshCw size={15} />
                                                            </button>
                                                        )}

                                                        {c.guidelines_filename && (
                                                            <button
                                                                type="button"
                                                                title="Download guidelines"
                                                                onClick={() => downloadFile(
                                                                    `/proposal-calls/${c.id}/guidelines/download`,
                                                                    c.guidelines_filename
                                                                ).catch(() => toast.error('Download failed.'))}
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded bg-transparent border-none cursor-pointer">
                                                                <Download size={15} />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                {Object.entries(STATUS_COLORS).map(([s, cls]) => (
                    <span key={s} className="flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${cls.split(' ')[0]}`} />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                ))}
            </div>

            {/* Create / Edit modal */}
            {(showModal || editCall) && (
                <ProposalCallModal
                    initial={editCall ?? undefined}
                    defaultAcademicYear={defaultAcademicYear}
                    onClose={() => { setShowModal(false); setEditCall(null); }}
                    onSaved={load}
                />
            )}

            {routeFor && (
                <ReviewRouteModal call={routeFor} onClose={() => setRouteFor(null)}
                    onSaved={() => { setRouteFor(null); load(); }} />
            )}

            {formFor && (
                <ApplicationFormBuilder call={formFor} onClose={() => setFormFor(null)}
                    onSaved={() => { setFormFor(null); load(); }} />
            )}

            {copying && (
                <CopyCallModal call={copying} onClose={() => setCopying(null)}
                    onCopied={(newCall) => { setCopying(null); load(); if (newCall?.id) openEdit(newCall); }} />
            )}

            {/* Activate / close confirmation */}
            {confirmAction && (
                <ConfirmDialog
                    open
                    title={confirmAction.type === 'activate' ? 'Activate Proposal Call' : 'Close Proposal Call'}
                    description={
                        confirmAction.type === 'activate'
                            ? `Activate "${confirmAction.call.title}"? It will immediately accept submissions.`
                            : `Close "${confirmAction.call.title}"? No new submissions will be accepted.`
                    }
                    confirmLabel={confirmAction.type === 'activate' ? 'Activate' : 'Close'}
                    confirmVariant={confirmAction.type === 'close' ? 'danger' : 'default'}
                    onConfirm={doAction}
                    onCancel={() => setConfirmAction(null)}
                />
            )}

            {/* useConfirm dialog for reopen + delete */}
            <Dialog />
        </AppLayout>
    );
}
