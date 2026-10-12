import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Banknote, Building2, Search, RefreshCw, X, Plus, Eye,
    MoreHorizontal, ChevronLeft, ChevronRight, Download,
    Filter, ArrowUpDown, Inbox, Loader2, CheckCircle2,
    XCircle, Clock, AlertCircle, TrendingUp, Users, FileText,
    Target, Calendar, DollarSign, Globe, Landmark, Star,
    Send, Pencil, Trash2, Award, BarChart3, PiggyBank,
    Flag, Receipt, CheckCheck, ExternalLink, Link2, ClipboardList,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { cn, formatDate, truncate } from '../../lib/utils';

// ─── Config ────────────────────────────────────────────────────────────────────

const APP_STATUSES = {
    draft:                    { label: 'Draft',               dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600'      },
    under_internal_review:    { label: 'Internal Review',     dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700'   },
    approved_for_submission:  { label: 'Approved',            dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700'       },
    submitted:                { label: 'Submitted',           dot: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-700'         },
    under_review:             { label: 'Under Review',        dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700'     },
    awarded:                  { label: 'Awarded',             dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
    rejected:                 { label: 'Rejected',            dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600'         },
    withdrawn:                { label: 'Withdrawn',           dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500'      },
};

const AWARD_STATUSES = {
    active:     { label: 'Active',     dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
    completed:  { label: 'Completed',  dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700'       },
    suspended:  { label: 'Suspended',  dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700'     },
    terminated: { label: 'Terminated', dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600'         },
};

const OPP_STATUSES = {
    draft:     { label: 'Draft',     badge: 'bg-gray-100 text-gray-600'     },
    open:      { label: 'Open',      badge: 'bg-emerald-50 text-emerald-700'},
    closed:    { label: 'Closed',    badge: 'bg-gray-100 text-gray-500'     },
    cancelled: { label: 'Cancelled', badge: 'bg-red-50 text-red-600'        },
};

const CATEGORIES = {
    research:             { label: 'Research',       color: '#3b82f6', bg: '#eff6ff' },
    community_engagement: { label: 'Community',      color: '#10b981', bg: '#f0fdf4' },
    technology_transfer:  { label: 'Tech Transfer',  color: '#8b5cf6', bg: '#f5f3ff' },
    innovation:           { label: 'Innovation',     color: '#f59e0b', bg: '#fffbeb' },
    other:                { label: 'Other',          color: '#64748b', bg: '#f8fafc' },
};

const OPP_TYPES = ['grant', 'contract', 'fellowship', 'scholarship', 'other'];

const REVIEW_STAGES = [
    { key: 'department',      label: 'Department',      description: 'Head of Department review' },
    { key: 'college',         label: 'College / Faculty', description: 'Dean or College Research Coordinator' },
    { key: 'research_office', label: 'Research Office',  description: 'University Research Office' },
    { key: 'management',      label: 'Management',       description: 'VP Research / University Management' },
];

const REVIEW_STATUSES = {
    pending:           { label: 'Pending',           dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500'      },
    approved:          { label: 'Approved',          dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
    rejected:          { label: 'Rejected',          dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600'         },
    revision_required: { label: 'Revision Required', dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700'     },
};
const AGENCY_TYPES = ['government', 'ngo', 'international', 'industry', 'foundation', 'other'];
const BUDGET_CATEGORIES = ['personnel', 'equipment', 'travel', 'overhead', 'subcontract', 'other'];

// ─── Shared helpers ────────────────────────────────────────────────────────────

function StatusDot({ status, statuses }) {
    const cfg = statuses[status] ?? { label: status, dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' };
    return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.badge)}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
            {cfg.label}
        </span>
    );
}

function CatBadge({ category }) {
    const c = CATEGORIES[category] ?? CATEGORIES.other;
    return (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: c.color, backgroundColor: c.bg }}>
            {c.label}
        </span>
    );
}

function Avatar({ name, size = 8 }) {
    const initials = (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const colors = ['from-indigo-500 to-violet-600', 'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600', 'from-pink-500 to-rose-600', 'from-blue-500 to-cyan-600'];
    const grad = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
    return (
        <div className={cn(`w-${size} h-${size} rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs shrink-0`, grad)}>
            {initials}
        </div>
    );
}

function Money({ amount, currency = 'USD' }) {
    if (amount == null) return <span className="text-gray-400">—</span>;
    return <span>{currency} {Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>;
}

function RowSkeleton({ cols = 6 }) {
    return (
        <div className="divide-y divide-gray-50">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-gray-100 rounded w-2/5" />
                        <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                    </div>
                    {[...Array(cols - 2)].map((_, j) => (
                        <div key={j} className="h-4 w-16 bg-gray-100 rounded" />
                    ))}
                </div>
            ))}
        </div>
    );
}

function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', subtitle = 'Add the first record to get started' }) {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                <Icon size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-400">{title}</p>
            <p className="text-xs text-gray-300 mt-1">{subtitle}</p>
        </div>
    );
}

function ActionMenu({ items, btnRef }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, right: 0 });
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (!menuRef.current?.contains(e.target) && !btnRef?.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const toggle = () => {
        if (open) { setOpen(false); return; }
        const rect = btnRef.current.getBoundingClientRect();
        const menuH = items.length * 36 + 16;
        const top = rect.bottom + menuH > window.innerHeight ? rect.top - menuH - 4 : rect.bottom + 4;
        setPos({ top, right: window.innerWidth - rect.right });
        setOpen(true);
    };

    return (
        <>
            <button ref={btnRef} onClick={toggle}
                className={cn('p-1.5 rounded-lg transition-colors lg:opacity-0 lg:group-hover:opacity-100',
                    open ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100')}>
                <MoreHorizontal size={13} />
            </button>
            {open && createPortal(
                <div ref={menuRef}
                    style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
                    className="bg-white border border-gray-100 rounded-xl shadow-xl w-52 py-1.5 overflow-hidden">
                    {items.map((item, i) => item.divider
                        ? <div key={i} className="my-1 border-t border-gray-100" />
                        : (
                            <button key={i} onClick={() => { item.onClick(); setOpen(false); }}
                                className={cn('w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium transition-colors',
                                    item.danger
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700')}>
                                {item.icon && <item.icon size={12} />} {item.label}
                            </button>
                        )
                    )}
                </div>,
                document.body
            )}
        </>
    );
}

// ─── Workflow helpers ──────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
    { key: 'draft', label: 'Draft' },
    { key: 'under_internal_review', label: 'Internal Review' },
    { key: 'approved_for_submission', label: 'Approved' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'awarded', label: 'Awarded' },
];

function getWorkflowActions(item, onStatus, onAward, onReview) {
    const s = item.status;
    const actions = [];

    if (s === 'draft') {
        actions.push({ label: 'Submit for Internal Review', icon: Send, onClick: () => onStatus(item, 'under_internal_review') });
    } else if (s === 'under_internal_review') {
        actions.push({ label: 'Open Review Panel', icon: ClipboardList, onClick: () => onReview(item) });
    } else if (s === 'approved_for_submission') {
        actions.push({ label: 'Mark as Submitted to Agency', icon: Send, onClick: () => onStatus(item, 'submitted') });
    } else if (s === 'submitted') {
        actions.push({ label: 'Agency Now Reviewing', icon: Clock, onClick: () => onStatus(item, 'under_review') });
    } else if (s === 'under_review') {
        actions.push({ label: 'Record Award', icon: Award, onClick: () => onAward(item) });
        actions.push({ label: 'Mark as Rejected by Agency', icon: XCircle, onClick: () => onStatus(item, 'rejected') });
    }

    if (!['rejected', 'withdrawn', 'awarded'].includes(s)) {
        actions.push({ divider: true });
        actions.push({ label: 'Withdraw Application', icon: XCircle, danger: true, onClick: () => onStatus(item, 'withdrawn') });
    }

    return actions;
}

// ─── Opportunity Modal ─────────────────────────────────────────────────────────

function OpportunityModal({ opp, agencies, onSave, onClose }) {
    const [form, setForm] = useState({
        agency_id: opp?.agency_id ?? '',
        title: opp?.title ?? '',
        ref_number: opp?.ref_number ?? '',
        category: opp?.category ?? 'research',
        type: opp?.type ?? 'grant',
        description: opp?.description ?? '',
        eligibility: opp?.eligibility ?? '',
        amount_min: opp?.amount_min ?? '',
        amount_max: opp?.amount_max ?? '',
        currency: opp?.currency ?? 'USD',
        opening_date: opp?.opening_date ?? '',
        deadline: opp?.deadline ?? '',
        expected_notification_date: opp?.expected_notification_date ?? '',
        status: opp?.status ?? 'open',
        is_featured: opp?.is_featured ?? false,
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const { error: toastError } = useToast();

    const save = async () => {
        setSaving(true); setErrors({});
        try { await onSave(form); }
        catch (e) {
            if (e.response?.status === 422) setErrors(e.response.data.errors ?? {});
            else toastError(e.response?.data?.message ?? 'Failed to save.');
        }
        setSaving(false);
    };

    const f = key => ({ value: form[key] ?? '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });
    const cls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                    <h2 className="text-base font-bold text-gray-900">{opp ? 'Edit Opportunity' : 'New Funding Opportunity'}</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Funding Agency *</label>
                        <select {...f('agency_id')} className={cls}>
                            <option value="">Select agency…</option>
                            {agencies.map(a => <option key={a.id} value={a.id}>{a.name}{a.acronym ? ` (${a.acronym})` : ''}</option>)}
                        </select>
                        {errors.agency_id && <p className="text-xs text-red-500 mt-1">{errors.agency_id[0]}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Title *</label>
                        <input {...f('title')} placeholder="Opportunity title…" className={cls} />
                        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title[0]}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Type *</label>
                            <select {...f('type')} className={cls}>
                                {OPP_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category *</label>
                            <select {...f('category')} className={cls}>
                                {Object.entries(CATEGORIES).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Min Amount</label>
                            <input type="number" {...f('amount_min')} placeholder="0" className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Max Amount</label>
                            <input type="number" {...f('amount_max')} placeholder="0" className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Currency</label>
                            <input {...f('currency')} placeholder="USD" className={cls} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Opening Date</label>
                            <input type="date" {...f('opening_date')} className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Deadline</label>
                            <input type="date" {...f('deadline')} className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notification Date</label>
                            <input type="date" {...f('expected_notification_date')} className={cls} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
                        <textarea {...f('description')} rows={3} placeholder="Opportunity description, objectives…" className={cn(cls, 'resize-none')} />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Eligibility</label>
                        <textarea {...f('eligibility')} rows={2} placeholder="Who can apply, required qualifications…" className={cn(cls, 'resize-none')} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status *</label>
                            <select {...f('status')} className={cls}>
                                {Object.entries(OPP_STATUSES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reference Number</label>
                            <input {...f('ref_number')} placeholder="Agency reference #…" className={cls} />
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!form.is_featured}
                            onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))}
                            className="rounded border-gray-300 text-indigo-600" />
                        <span className="text-sm text-gray-700 font-medium flex items-center gap-1"><Star size={12} className="text-amber-500" /> Feature on public explore page</span>
                    </label>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 bg-white rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-semibold transition-colors">Cancel</button>
                    <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                        {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : opp ? 'Update Opportunity' : 'Create Opportunity'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Award Modal ───────────────────────────────────────────────────────────────

function AwardModal({ application, onSave, onClose }) {
    const [form, setForm] = useState({
        title: application?.title ?? '',
        amount_awarded: '',
        currency: application?.currency ?? 'USD',
        start_date: application?.start_date ? String(application.start_date).slice(0, 10) : '',
        end_date: application?.end_date ? String(application.end_date).slice(0, 10) : '',
        status: 'active',
        conditions: '',
        signed_at: '',
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const { error: toastError } = useToast();

    const save = async () => {
        setSaving(true); setErrors({});
        try { await onSave({ ...form, application_id: application.id }); }
        catch (e) {
            if (e.response?.status === 422) setErrors(e.response.data.errors ?? {});
            else toastError(e.response?.data?.message ?? 'Failed to save.');
        }
        setSaving(false);
    };

    const f = key => ({ value: form[key] ?? '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });
    const cls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Record Award</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{truncate(application?.title, 55)}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Award Title *</label>
                        <input {...f('title')} className={cls} />
                        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title[0]}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Amount Awarded *</label>
                            <input type="number" {...f('amount_awarded')} placeholder="0" className={cls} />
                            {errors.amount_awarded && <p className="text-xs text-red-500 mt-1">{errors.amount_awarded[0]}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Currency</label>
                            <input {...f('currency')} placeholder="USD" className={cls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date *</label>
                            <input type="date" {...f('start_date')} className={cls} />
                            {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date[0]}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">End Date *</label>
                            <input type="date" {...f('end_date')} className={cls} />
                            {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date[0]}</p>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Agreement Signed On</label>
                        <input type="date" {...f('signed_at')} className={cls} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Conditions / Reporting Requirements</label>
                        <textarea {...f('conditions')} rows={3} placeholder="Special conditions, reporting deadlines, compliance requirements…" className={cn(cls, 'resize-none')} />
                    </div>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 bg-white rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-semibold transition-colors">Cancel</button>
                    <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                        {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Award size={13} /> Record Award</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Milestone inline form ─────────────────────────────────────────────────────

function MilestoneForm({ onSave, onCancel }) {
    const [form, setForm] = useState({ title: '', due_date: '', description: '' });
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!form.title || !form.due_date) return;
        setSaving(true);
        try { await onSave(form); } catch {}
        setSaving(false);
    };

    return (
        <div className="mb-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Milestone title *"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <div className="flex gap-2">
                <button onClick={onCancel} className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={save} disabled={saving || !form.title || !form.due_date}
                    className="flex-1 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 font-semibold transition-colors">
                    {saving ? 'Adding…' : 'Add Milestone'}
                </button>
            </div>
        </div>
    );
}

// ─── Expenditure inline form ───────────────────────────────────────────────────

function ExpenditureForm({ onSave, onCancel }) {
    const [form, setForm] = useState({ description: '', amount: '', expense_date: '', category: 'other' });
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!form.description || !form.amount || !form.expense_date) return;
        setSaving(true);
        try { await onSave(form); } catch {}
        setSaving(false);
    };

    return (
        <div className="mb-3 p-3 bg-orange-50/60 border border-orange-100 rounded-xl space-y-2">
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Description *"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <div className="grid grid-cols-2 gap-2">
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="Amount *"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <div className="flex gap-2">
                <button onClick={onCancel} className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={save} disabled={saving || !form.description || !form.amount || !form.expense_date}
                    className="flex-1 py-1.5 text-xs text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-60 font-semibold transition-colors">
                    {saving ? 'Recording…' : 'Record Expenditure'}
                </button>
            </div>
        </div>
    );
}

// ─── Award Drawer ──────────────────────────────────────────────────────────────

function AwardDrawer({ award: initialAward, onClose, onUpdate }) {
    const [award, setAward] = useState(initialAward);
    const [milestones, setMilestones] = useState([]);
    const [expenditures, setExpenditures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addMilestone, setAddMilestone] = useState(false);
    const [addExpenditure, setAddExpenditure] = useState(false);
    const [statusSaving, setStatusSaving] = useState(false);
    const { success, error } = useToast();

    const loadDetails = useCallback(async () => {
        setLoading(true);
        try {
            const [ml, ex] = await Promise.all([
                api.get(`/external-funds/awards/${award.id}/milestones`),
                api.get(`/external-funds/awards/${award.id}/expenditures`),
            ]);
            setMilestones(ml.data.data ?? ml.data);
            setExpenditures(ex.data.data ?? ex.data);
        } catch { error('Failed to load award details.'); }
        setLoading(false);
    }, [award.id]);

    useEffect(() => { loadDetails(); }, [loadDetails]);

    const handleStatusChange = async (status) => {
        setStatusSaving(true);
        try {
            const r = await api.put(`/external-funds/awards/${award.id}`, { status });
            setAward(r.data.data ?? r.data);
            success('Status updated.');
            onUpdate?.();
        } catch { error('Failed to update status.'); }
        setStatusSaving(false);
    };

    const handleAddMilestone = async (form) => {
        await api.post(`/external-funds/awards/${award.id}/milestones`, form);
        success('Milestone added.');
        setAddMilestone(false);
        loadDetails();
    };

    const handleMilestoneToggle = async (m) => {
        const newStatus = m.status === 'completed' ? 'in_progress' : 'completed';
        await api.put(`/external-funds/milestones/${m.id}`, { status: newStatus });
        loadDetails();
    };

    const handleDeleteMilestone = async (id) => {
        await api.delete(`/external-funds/milestones/${id}`);
        success('Milestone removed.');
        loadDetails();
    };

    const handleAddExpenditure = async (form) => {
        await api.post(`/external-funds/awards/${award.id}/expenditures`, form);
        success('Expenditure recorded.');
        setAddExpenditure(false);
        loadDetails();
    };

    const totalSpent = expenditures.reduce((s, e) => s + parseFloat(e.amount ?? 0), 0);
    const amountAwarded = parseFloat(award.amount_awarded ?? 0);
    const utilPct = amountAwarded > 0 ? Math.min(Math.round((totalSpent / amountAwarded) * 100), 100) : 0;
    const currency = award.currency ?? 'USD';

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-[500px] max-w-full bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <Award size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{award.title}</p>
                        <p className="text-[11px] font-mono text-gray-400 mt-0.5">{award.award_number}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <StatusDot status={award.status} statuses={AWARD_STATUSES} />
                        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Financial summary */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                            <p className="text-base font-black text-emerald-700 tabular-nums truncate">{Number(amountAwarded).toLocaleString()}</p>
                            <p className="text-[11px] text-emerald-600 mt-0.5">Awarded ({currency})</p>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-3 text-center">
                            <p className="text-base font-black text-orange-700 tabular-nums truncate">{Number(totalSpent).toLocaleString()}</p>
                            <p className="text-[11px] text-orange-600 mt-0.5">Spent</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-3 text-center">
                            <p className="text-base font-black text-blue-700 tabular-nums truncate">{Number(amountAwarded - totalSpent).toLocaleString()}</p>
                            <p className="text-[11px] text-blue-600 mt-0.5">Remaining</p>
                        </div>
                    </div>

                    {/* Utilization bar */}
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                            <span>Budget Utilization</span>
                            <span className={cn('font-semibold', utilPct > 90 ? 'text-red-600' : utilPct > 70 ? 'text-amber-600' : 'text-emerald-600')}>{utilPct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all duration-700', utilPct > 90 ? 'bg-red-500' : utilPct > 70 ? 'bg-amber-500' : 'bg-emerald-500')}
                                style={{ width: `${utilPct}%` }} />
                        </div>
                    </div>

                    {/* Agency + dates */}
                    <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 rounded-xl p-4">
                        <div>
                            <p className="text-gray-400 font-medium mb-0.5">Agency</p>
                            <p className="text-gray-800 font-semibold">{award.agency?.name ?? '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 font-medium mb-0.5">Grant Period</p>
                            <p className="text-gray-800 font-semibold">{formatDate(award.start_date)} – {formatDate(award.end_date)}</p>
                        </div>
                        {award.conditions && (
                            <div className="col-span-2">
                                <p className="text-gray-400 font-medium mb-0.5">Conditions</p>
                                <p className="text-gray-700 leading-relaxed">{award.conditions}</p>
                            </div>
                        )}
                    </div>

                    {/* Award status controls */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Award Status</p>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(AWARD_STATUSES).map(([v, cfg]) => (
                                <button key={v} onClick={() => handleStatusChange(v)} disabled={statusSaving || award.status === v}
                                    className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                                        award.status === v
                                            ? 'bg-gray-800 text-white border-gray-800 cursor-default'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50'
                                    )}>
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Milestones */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <Flag size={13} className="text-indigo-500" /> Milestones
                                {milestones.length > 0 && (
                                    <span className="text-[11px] font-semibold text-gray-400 ml-1">
                                        {milestones.filter(m => m.status === 'completed').length}/{milestones.length}
                                    </span>
                                )}
                            </p>
                            <button onClick={() => setAddMilestone(v => !v)}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
                                <Plus size={11} /> Add
                            </button>
                        </div>

                        {addMilestone && <MilestoneForm onSave={handleAddMilestone} onCancel={() => setAddMilestone(false)} />}

                        {loading ? (
                            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}</div>
                        ) : milestones.length === 0 && !addMilestone ? (
                            <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">No milestones yet. Add one to track deliverables.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {milestones.map(m => (
                                    <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                                        <button onClick={() => handleMilestoneToggle(m)}
                                            className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                                                m.status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
                                                    m.status === 'overdue' ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-indigo-400')}>
                                            {m.status === 'completed' && <CheckCheck size={9} className="text-white" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn('text-xs font-semibold truncate', m.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700')}>{m.title}</p>
                                        </div>
                                        <p className={cn('text-[11px] shrink-0',
                                            m.status === 'overdue' ? 'text-red-500 font-bold' :
                                                m.status === 'completed' ? 'text-gray-400' : 'text-gray-500')}>
                                            {formatDate(m.due_date)}
                                        </p>
                                        <button onClick={() => handleDeleteMilestone(m.id)}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all">
                                            <X size={11} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Expenditures */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <Receipt size={13} className="text-orange-500" /> Expenditures
                                {expenditures.length > 0 && (
                                    <span className="text-[11px] font-semibold text-gray-400 ml-1">{expenditures.length} records</span>
                                )}
                            </p>
                            <button onClick={() => setAddExpenditure(v => !v)}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
                                <Plus size={11} /> Record
                            </button>
                        </div>

                        {addExpenditure && <ExpenditureForm onSave={handleAddExpenditure} onCancel={() => setAddExpenditure(false)} />}

                        {loading ? (
                            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}</div>
                        ) : expenditures.length === 0 && !addExpenditure ? (
                            <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl">No expenditures recorded yet.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {expenditures.map(e => (
                                    <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-700 truncate">{e.description}</p>
                                            <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{e.category} · {formatDate(e.expense_date)}{e.recordedBy ? ` · ${e.recordedBy.name}` : ''}</p>
                                        </div>
                                        <p className="text-xs font-bold text-orange-700 tabular-nums shrink-0">
                                            {currency} {Number(e.amount).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}

// ─── Application Review Drawer ─────────────────────────────────────────────────

function ApplicationReviewDrawer({ application, onClose, onUpdate }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [forms, setForms] = useState({});   // { [stage]: { status, comments, open, saving } }
    const { success, error } = useToast();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get(`/external-funds/applications/${application.id}/reviews`);
            setReviews(r.data.data ?? r.data);
        } catch { error('Failed to load reviews.'); }
        setLoading(false);
    }, [application.id]);

    useEffect(() => { load(); }, [load]);

    const getReview = (stage) => reviews.find(r => r.stage === stage);

    const toggleForm = (stage) => {
        const existing = getReview(stage);
        setForms(p => ({
            ...p,
            [stage]: p[stage]?.open
                ? { open: false }
                : { open: true, status: existing?.status ?? '', comments: existing?.comments ?? '', saving: false },
        }));
    };

    const handleSubmit = async (stage) => {
        const form = forms[stage];
        if (!form?.status) return;
        setForms(p => ({ ...p, [stage]: { ...p[stage], saving: true } }));
        try {
            await api.post(`/external-funds/applications/${application.id}/reviews`, {
                stage,
                status: form.status,
                comments: form.comments ?? '',
            });
            success('Review submitted.');
            setForms(p => ({ ...p, [stage]: { open: false } }));
            load();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to submit review.');
            setForms(p => ({ ...p, [stage]: { ...p[stage], saving: false } }));
        }
    };

    const handleAdvance = async (status) => {
        try {
            await api.patch(`/external-funds/applications/${application.id}/status`, { status });
            success(
                status === 'approved_for_submission'
                    ? 'Application approved for submission to the agency.'
                    : 'Application returned to PI for revision.'
            );
            onUpdate?.();
            onClose();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to update status.');
        }
    };

    const approvedCount   = REVIEW_STAGES.filter(s => getReview(s.key)?.status === 'approved').length;
    const allApproved     = approvedCount === REVIEW_STAGES.length;
    const hasRejection    = REVIEW_STAGES.some(s => getReview(s.key)?.status === 'rejected');
    const hasRevision     = REVIEW_STAGES.some(s => getReview(s.key)?.status === 'revision_required');
    const isInReview      = application.status === 'under_internal_review';

    const stageColor = (review) => {
        if (!review) return 'border-gray-100 bg-white';
        return {
            approved:          'border-emerald-100 bg-emerald-50/40',
            rejected:          'border-red-100 bg-red-50/40',
            revision_required: 'border-amber-100 bg-amber-50/40',
        }[review.status] ?? 'border-gray-100 bg-white';
    };

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-[540px] max-w-full bg-white shadow-2xl z-50 flex flex-col">

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                        <ClipboardList size={17} className="text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">{application.title}</p>
                        <p className="text-[11px] font-mono text-gray-400 mt-0.5">{application.ref_number}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <StatusDot status={application.status} statuses={APP_STATUSES} />
                        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Application summary card */}
                    <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <p className="text-gray-400 font-medium mb-0.5">Principal Investigator</p>
                            <p className="text-gray-800 font-semibold">{application.pi_name || application.principalInvestigator?.name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 font-medium mb-0.5">Funding Agency</p>
                            <p className="text-gray-800 font-semibold truncate">{application.agency?.name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 font-medium mb-0.5">Total Budget (USD)</p>
                            <p className="text-gray-800 font-semibold">{application.currency} {Number(application.amount_requested ?? 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 font-medium mb-0.5">Project Period</p>
                            <p className="text-gray-800 font-semibold">{formatDate(application.start_date)} – {formatDate(application.end_date)}</p>
                        </div>
                    </div>

                    {/* Progress */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-bold text-gray-700">Internal Review Progress</p>
                            <span className={cn('text-xs font-bold',
                                allApproved ? 'text-emerald-600' :
                                    hasRejection ? 'text-red-500' : 'text-gray-500')}>
                                {approvedCount} / {REVIEW_STAGES.length} approved
                            </span>
                        </div>
                        <div className="flex gap-1">
                            {REVIEW_STAGES.map((stage, i) => {
                                const review = getReview(stage.key);
                                return (
                                    <div key={stage.key} className={cn('flex-1 h-2 rounded-full transition-all duration-500',
                                        review?.status === 'approved' ? 'bg-emerald-500' :
                                            review?.status === 'rejected' ? 'bg-red-400' :
                                                review?.status === 'revision_required' ? 'bg-amber-400' :
                                                    i === 0 ? 'bg-gray-200' : 'bg-gray-100'
                                    )} />
                                );
                            })}
                        </div>
                        <div className="flex gap-1 mt-1">
                            {REVIEW_STAGES.map(stage => (
                                <p key={stage.key} className="flex-1 text-[10px] text-gray-400 text-center leading-tight">{stage.label}</p>
                            ))}
                        </div>
                    </div>

                    {/* Review stage cards */}
                    <div className="space-y-3">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Review Stages</p>

                        {loading ? (
                            REVIEW_STAGES.map((_, i) => (
                                <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
                            ))
                        ) : (
                            REVIEW_STAGES.map((stage) => {
                                const review = getReview(stage.key);
                                const form = forms[stage.key] ?? {};

                                return (
                                    <div key={stage.key} className={cn('border rounded-xl overflow-hidden transition-colors', stageColor(review))}>

                                        {/* Stage header */}
                                        <div className="px-4 py-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-gray-800">{stage.label}</p>
                                                <p className="text-[11px] text-gray-400 truncate">{stage.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {review
                                                    ? <StatusDot status={review.status} statuses={REVIEW_STATUSES} />
                                                    : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 flex items-center gap-1">
                                                        <Clock size={9} /> Pending
                                                    </span>
                                                }
                                                {isInReview && (
                                                    <button onClick={() => toggleForm(stage.key)}
                                                        className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
                                                        {form.open ? 'Cancel' : review ? 'Update' : 'Review'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Existing review details */}
                                        {review && !form.open && (
                                            <div className="px-4 pb-3 border-t border-black/5">
                                                <p className="text-[11px] text-gray-500 mt-2">
                                                    <span className="font-semibold text-gray-600">{review.reviewer?.name ?? 'Unknown'}</span>
                                                    {review.reviewed_at && <> · {formatDate(review.reviewed_at)}</>}
                                                </p>
                                                {review.comments && (
                                                    <p className="mt-1.5 text-xs text-gray-600 italic leading-relaxed">"{review.comments}"</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Review form */}
                                        {form.open && (
                                            <div className="px-4 pb-4 border-t border-black/5 space-y-2 pt-3">
                                                <select value={form.status ?? ''}
                                                    onChange={e => setForms(p => ({ ...p, [stage.key]: { ...p[stage.key], status: e.target.value } }))}
                                                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                    <option value="">Select decision…</option>
                                                    <option value="approved">✓ Approved</option>
                                                    <option value="revision_required">↩ Revision Required</option>
                                                    <option value="rejected">✗ Rejected</option>
                                                </select>
                                                <textarea value={form.comments ?? ''}
                                                    onChange={e => setForms(p => ({ ...p, [stage.key]: { ...p[stage.key], comments: e.target.value } }))}
                                                    rows={2} placeholder="Comments (optional)…"
                                                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                                                <button onClick={() => handleSubmit(stage.key)}
                                                    disabled={!form.status || form.saving}
                                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                                                    {form.saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                                    Submit Review
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer actions */}
                {isInReview && !loading && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0 space-y-2">
                        {allApproved ? (
                            <button onClick={() => handleAdvance('approved_for_submission')}
                                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                                <CheckCircle2 size={14} /> Approve for Submission
                            </button>
                        ) : (
                            <div className="text-center py-1">
                                <p className="text-xs text-gray-400">
                                    {approvedCount === 0
                                        ? 'All 4 stages must be reviewed before advancing'
                                        : `${REVIEW_STAGES.length - approvedCount} more stage${REVIEW_STAGES.length - approvedCount !== 1 ? 's' : ''} needed`}
                                </p>
                            </div>
                        )}
                        {(hasRejection || hasRevision) && (
                            <button onClick={() => handleAdvance('draft')}
                                className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
                                <ArrowUpDown size={14} /> Return to PI for Revision
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>,
        document.body
    );
}

// ─── Tab: Dashboard ────────────────────────────────────────────────────────────

function DashboardTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { error } = useToast();

    useEffect(() => {
        api.get('/external-funds/dashboard')
            .then(r => setData(r.data.data ?? r.data))
            .catch(() => error('Failed to load dashboard.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse h-24" />
                ))}
            </div>
        );
    }

    const awards = data?.awards ?? {};
    const apps = data?.applications ?? {};

    const kpis = [
        { label: 'Total Secured', value: `${(awards.total_secured ?? 0).toLocaleString()}`, sub: 'USD', icon: DollarSign, color: 'bg-emerald-500', ring: 'ring-emerald-100' },
        { label: 'Active Grants', value: awards.active_count ?? 0, sub: 'grants', icon: Award, color: 'bg-blue-500', ring: 'ring-blue-100' },
        { label: 'Total Awards', value: awards.total_count ?? 0, sub: 'all time', icon: Landmark, color: 'bg-indigo-500', ring: 'ring-indigo-100' },
        { label: 'Pending Apps', value: apps.pending ?? 0, sub: 'awaiting', icon: Clock, color: 'bg-amber-500', ring: 'ring-amber-100' },
        { label: 'Success Rate', value: `${data?.success_rate ?? 0}%`, sub: 'awarded/decided', icon: Target, color: 'bg-violet-500', ring: 'ring-violet-100' },
        { label: 'Utilization', value: `${awards.utilization_pct ?? 0}%`, sub: 'of budget spent', icon: PiggyBank, color: 'bg-teal-500', ring: 'ring-teal-100' },
        { label: 'Total Spent', value: `${(awards.total_spent ?? 0).toLocaleString()}`, sub: 'USD', icon: TrendingUp, color: 'bg-orange-500', ring: 'ring-orange-100' },
        { label: 'Total Applications', value: apps.total ?? 0, sub: 'all time', icon: FileText, color: 'bg-pink-500', ring: 'ring-pink-100' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {kpis.map(({ label, value, sub, icon: Icon, color, ring }) => (
                    <div key={label} className={cn('bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm ring-1', ring)}>
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
                            <Icon size={17} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                        <Building2 size={14} className="text-indigo-500" />
                        <h3 className="text-sm font-bold text-gray-800">Top Funding Agencies</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {(data?.by_agency ?? []).length === 0
                            ? <p className="text-xs text-gray-400 text-center py-8">No data yet.</p>
                            : (data?.by_agency ?? []).map((a, i) => (
                                <div key={i} className="flex items-center gap-3 px-5 py-3">
                                    <span className="text-xs font-black text-gray-300 w-5 shrink-0">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                                        <p className="text-[11px] text-gray-400">{a.count} award{a.count !== 1 ? 's' : ''}</p>
                                    </div>
                                    <p className="text-sm font-bold text-emerald-700 tabular-nums shrink-0">
                                        USD {Number(a.total).toLocaleString()}
                                    </p>
                                </div>
                            ))
                        }
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                        <Calendar size={14} className="text-amber-500" />
                        <h3 className="text-sm font-bold text-gray-800">Upcoming Milestones</h3>
                        <span className="ml-auto text-[11px] text-gray-400">Next 30 days</span>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                        {(data?.upcoming_milestones ?? []).length === 0
                            ? <p className="text-xs text-gray-400 text-center py-8">No upcoming milestones.</p>
                            : (data?.upcoming_milestones ?? []).map((m) => (
                                <div key={m.id} className="flex items-start gap-3 px-5 py-3">
                                    <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                                        m.status === 'overdue' ? 'bg-red-500' : m.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-400')} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-gray-800 truncate">{m.title}</p>
                                        <p className="text-[11px] text-gray-400 truncate">{m.award?.award_number}</p>
                                    </div>
                                    <p className="text-[11px] text-gray-500 shrink-0">{formatDate(m.due_date)}</p>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {(data?.by_college ?? []).length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                        <BarChart3 size={14} className="text-violet-500" />
                        <h3 className="text-sm font-bold text-gray-800">Funding by College</h3>
                    </div>
                    <div className="p-5 space-y-3">
                        {(data?.by_college ?? []).map((c, i) => {
                            const max = data.by_college[0]?.total ?? 1;
                            const pct = Math.round((c.total / max) * 100);
                            return (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-gray-700 truncate max-w-xs">{c.name}</span>
                                        <span className="font-bold text-gray-600 tabular-nums shrink-0 ml-2">USD {Number(c.total).toLocaleString()}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-violet-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Tab: Applications ─────────────────────────────────────────────────────────

function SectionHeading({ children }) {
    return (
        <div className="flex items-center gap-2 pt-2">
            <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest whitespace-nowrap">{children}</p>
            <div className="flex-1 h-px bg-indigo-100" />
        </div>
    );
}

function buildCois(app) {
    const count = parseInt(app?.staff_count) || 0;
    const names  = (app?.co_investigator_names  ?? '').split(',').map(s => s.trim());
    const phones = (app?.co_investigator_phones ?? '').split(',').map(s => s.trim());
    const emails = (app?.co_investigator_emails ?? '').split(',').map(s => s.trim());
    return Array.from({ length: count }, (_, i) => ({
        name:  names[i]  ?? '',
        phone: phones[i] ?? '',
        email: emails[i] ?? '',
    }));
}

function ApplicationModal({ app, agencies, colleges, departments, onSave, onClose }) {
    const [form, setForm] = useState({
        title:               app?.title               ?? '',
        donor_ref_number:    app?.donor_ref_number    ?? '',
        agency_id:           app?.agency_id           ?? '',
        partner_institutions:app?.partner_institutions ?? '',
        theme:               app?.theme               ?? '',
        category:            app?.category            ?? 'research',
        location:            app?.location            ?? '',
        annual_budget:       app?.annual_budget        ?? '',
        amount_requested:    app?.amount_requested    ?? '',
        currency:            app?.currency            ?? 'USD',
        hu_contribution:     app?.hu_contribution     ?? '',
        lead_institution:    app?.lead_institution    ?? '',
        college_id:          app?.college_id          ?? '',
        department_id:       app?.department_id       ?? '',
        start_date:          app?.start_date ? String(app.start_date).slice(0, 10) : '',
        end_date:            app?.end_date   ? String(app.end_date).slice(0, 10)   : '',
        pi_name:             app?.pi_name             ?? '',
        pi_phone:            app?.pi_phone            ?? '',
        pi_email:            app?.pi_email            ?? '',
        staff_count:         app?.staff_count         ?? '',
        goals_objectives:    app?.goals_objectives    ?? '',
        target_beneficiaries:app?.target_beneficiaries ?? '',
        remarks:             app?.remarks             ?? '',
    });

    const [cois, setCois] = useState(() => buildCois(app));
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const { error: toastError } = useToast();

    const handleStaffCount = (val) => {
        const count = Math.max(0, parseInt(val) || 0);
        setForm(p => ({ ...p, staff_count: count }));
        setCois(prev => {
            const next = [...prev];
            while (next.length < count) next.push({ name: '', phone: '', email: '' });
            return next.slice(0, count);
        });
    };

    const setCoi = (i, field, val) =>
        setCois(prev => prev.map((c, j) => j === i ? { ...c, [field]: val } : c));

    const save = async () => {
        setSaving(true); setErrors({});
        try {
            await onSave({
                ...form,
                co_investigator_names:  cois.map(c => c.name).join(', '),
                co_investigator_phones: cois.map(c => c.phone).join(', '),
                co_investigator_emails: cois.map(c => c.email).join(', '),
            });
        } catch (e) {
            if (e.response?.status === 422) setErrors(e.response.data.errors ?? {});
            else toastError(e.response?.data?.message ?? 'Failed to save.');
        }
        setSaving(false);
    };

    const f   = key => ({ value: form[key] ?? '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });
    const cls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white';
    const err = key => errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key][0]}</p>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">{app ? 'Edit Registration' : 'Register Externally Funded Project'}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Fill in all required fields marked with *</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                    {/* ── Project Info ── */}
                    <SectionHeading>Project Information</SectionHeading>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Project Name / Title *</label>
                        <input {...f('title')} placeholder="Full project title…" className={cls} />
                        {err('title')}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Award Reference Number (Donor's)</label>
                            <input {...f('donor_ref_number')} placeholder="Donor's reference #…" className={cls} />
                            {err('donor_ref_number')}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Donor / Funding Organization *</label>
                            <select {...f('agency_id')} className={cls}>
                                <option value="">Select agency…</option>
                                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}{a.acronym ? ` (${a.acronym})` : ''}</option>)}
                            </select>
                            {err('agency_id')}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name(s) of Partner Institution(s)</label>
                        <input {...f('partner_institutions')} placeholder="e.g. MIT, Addis Ababa University" className={cls} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Theme</label>
                            <input {...f('theme')} placeholder="e.g. Climate Change, Public Health…" className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
                            <select {...f('category')} className={cls}>
                                {Object.entries(CATEGORIES).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Project Implementation Area / Location *</label>
                        <input {...f('location')} placeholder="Region, city, or specific area…" className={cls} />
                        {err('location')}
                    </div>

                    {/* ── Budget ── */}
                    <SectionHeading>Budget</SectionHeading>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Annual Budget (USD) *</label>
                            <input type="number" {...f('annual_budget')} placeholder="0" className={cls} />
                            {err('annual_budget')}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Total Budget (USD) *</label>
                            <input type="number" {...f('amount_requested')} placeholder="0" className={cls} />
                            <p className="text-[11px] text-gray-400 mt-0.5">Use current exchange rate if other currency</p>
                            {err('amount_requested')}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Currency</label>
                            <input {...f('currency')} placeholder="USD" className={cls} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Institutional Contribution (if applicable)</label>
                        <input type="number" {...f('hu_contribution')} placeholder="0" className={cls} />
                    </div>

                    {/* ── Institutional Details ── */}
                    <SectionHeading>Institutional Details</SectionHeading>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Lead Institution *</label>
                        <input {...f('lead_institution')} placeholder="Lead institution name…" className={cls} />
                        {err('lead_institution')}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">College Hosting the Project</label>
                            <select {...f('college_id')} className={cls}>
                                <option value="">Select college…</option>
                                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Department Hosting the Project</label>
                            <select {...f('department_id')} className={cls}>
                                <option value="">Select department…</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* ── Project Period ── */}
                    <SectionHeading>Project Period</SectionHeading>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Project Start Date *</label>
                            <input type="date" {...f('start_date')} className={cls} />
                            {err('start_date')}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Project End Date *</label>
                            <input type="date" {...f('end_date')} className={cls} />
                            {err('end_date')}
                        </div>
                    </div>

                    {/* ── PI ── */}
                    <SectionHeading>Project Coordinator / Principal Investigator</SectionHeading>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name of Project Coordinator / PI *</label>
                            <input {...f('pi_name')} placeholder="Full name…" className={cls} />
                            {err('pi_name')}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Telephone *</label>
                            <input {...f('pi_phone')} placeholder="+251…" className={cls} />
                            {err('pi_phone')}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email *</label>
                            <input type="email" {...f('pi_email')} placeholder="pi@example.com" className={cls} />
                            {err('pi_email')}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Number of Project Staff *</label>
                        <input type="number" value={form.staff_count} min="0"
                            onChange={e => handleStaffCount(e.target.value)}
                            placeholder="0" className={cls} />
                        <p className="text-[11px] text-gray-400 mt-1">
                            {cois.length > 0
                                ? `${cois.length} co-investigator form${cois.length !== 1 ? 's' : ''} will appear below`
                                : 'Enter a number to add co-investigator details below'}
                        </p>
                        {err('staff_count')}
                    </div>

                    {/* ── Co-investigators (dynamic) ── */}
                    <SectionHeading>Other Project Members / Co-Investigators</SectionHeading>

                    {cois.length === 0 ? (
                        <div className="text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-xs text-gray-400">Set the number of project staff above to add co-investigator details.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cois.map((coi, i) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Member {i + 1}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Name</label>
                                            <input value={coi.name}
                                                onChange={e => setCoi(i, 'name', e.target.value)}
                                                placeholder="Full name…"
                                                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Telephone</label>
                                            <input value={coi.phone}
                                                onChange={e => setCoi(i, 'phone', e.target.value)}
                                                placeholder="+251…"
                                                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Email</label>
                                            <input value={coi.email}
                                                onChange={e => setCoi(i, 'email', e.target.value)}
                                                placeholder="email@…"
                                                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Narrative ── */}
                    <SectionHeading>Project Description</SectionHeading>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Project Overall Goal and Specific Objectives *
                            <span className="text-gray-400 font-normal ml-1">(150 words)</span>
                        </label>
                        <textarea {...f('goals_objectives')} rows={5}
                            placeholder="Describe the overall goal and specific objectives of the project…"
                            className={cn(cls, 'resize-none')} />
                        {err('goals_objectives')}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Target Beneficiaries *
                            <span className="text-gray-400 font-normal ml-1">(100 words)</span>
                        </label>
                        <textarea {...f('target_beneficiaries')} rows={4}
                            placeholder="Who will directly and indirectly benefit from this project…"
                            className={cn(cls, 'resize-none')} />
                        {err('target_beneficiaries')}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Additional Information / Remarks
                            <span className="text-gray-400 font-normal ml-1">(100 words)</span>
                        </label>
                        <textarea {...f('remarks')} rows={3}
                            placeholder="Any additional information or remarks…"
                            className={cn(cls, 'resize-none')} />
                    </div>

                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 bg-white rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-semibold transition-colors">Cancel</button>
                    <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                        {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Send size={13} /> {app ? 'Update Registration' : 'Register Project'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ApplicationsTab() {
    const { success, error } = useToast();
    const [items, setItems] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusF, setStatusF] = useState('');
    const [page, setPage] = useState(1);
    const [agencies, setAgencies] = useState([]);
    const [colleges, setColleges] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [modal, setModal] = useState(null);
    const [awardTarget, setAwardTarget] = useState(null);
    const [reviewTarget, setReviewTarget] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const params = { page };
        if (search) params.search = search;
        if (statusF) params.status = statusF;
        try {
            const r = await api.get('/external-funds/applications', { params });
            const pg = r.data.data ?? r.data;
            setItems(Array.isArray(pg) ? pg : (pg.data ?? []));
            if (pg?.total != null) setMeta(pg);
        } catch { error('Failed to load.'); }
        setLoading(false);
    }, [page, search, statusF]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        api.get('/external-funds/agencies', { params: { per_page: 100, active_only: true } })
            .then(r => { const d = r.data.data ?? r.data; setAgencies(Array.isArray(d) ? d : (d.data ?? [])); })
            .catch(() => {});
        api.get('/colleges', { params: { per_page: 200 } })
            .then(r => { const d = r.data.data ?? r.data; setColleges(Array.isArray(d) ? d : (d.data ?? [])); })
            .catch(() => {});
        api.get('/departments', { params: { per_page: 500 } })
            .then(r => { const d = r.data.data ?? r.data; setDepartments(Array.isArray(d) ? d : (d.data ?? [])); })
            .catch(() => {});
    }, []);

    const handleSave = async (form) => {
        if (modal?.id) {
            await api.put(`/external-funds/applications/${modal.id}`, form);
            success('Application updated.');
        } else {
            await api.post('/external-funds/applications', form);
            success('Application created.');
        }
        setModal(null);
        load();
    };

    const handleStatusUpdate = async (item, status) => {
        try {
            await api.patch(`/external-funds/applications/${item.id}/status`, { status });
            success('Status updated.');
            load();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to update status.');
        }
    };

    const handleRecordAward = async (form) => {
        await api.post('/external-funds/awards', form);
        success('Award recorded. The application is now marked as Awarded.');
        setAwardTarget(null);
        load();
    };

    const handleDelete = async (id) => {
        await api.delete(`/external-funds/applications/${id}`);
        success('Application deleted.');
        load();
    };

    const totalPages = meta ? Math.ceil(meta.total / (meta.per_page ?? 25)) : 1;

    // Workflow pipeline indicator
    const activeStepIdx = (status) => WORKFLOW_STEPS.findIndex(s => s.key === status);

    return (
        <div className="space-y-4">
            {/* RTT platform link banner */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Link2 size={17} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-indigo-900">Ready to Apply?</p>
                    <p className="text-xs text-indigo-600 mt-0.5">Sign in to your account to submit a grant application through the RTT platform and track it through the internal review process.</p>
                </div>
                <a href="/explore" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shrink-0 whitespace-nowrap">
                    <ExternalLink size={12} /> Open Platform
                </a>
            </div>

            {/* Workflow guide banner */}
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-3 overflow-x-auto">
                <div className="flex items-center gap-0 min-w-max">
                    {WORKFLOW_STEPS.map((step, i) => (
                        <div key={step.key} className="flex items-center">
                            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold',
                                statusF === step.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 cursor-pointer'
                            )} onClick={() => { setStatusF(statusF === step.key ? '' : step.key); setPage(1); }}>
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                                    step.key === 'awarded' ? 'bg-emerald-500' :
                                        step.key === 'under_review' ? 'bg-amber-500' :
                                            step.key === 'submitted' || step.key === 'approved_for_submission' ? 'bg-blue-500' : 'bg-gray-400'
                                )} />
                                {step.label}
                            </div>
                            {i < WORKFLOW_STEPS.length - 1 && (
                                <ChevronRight size={12} className="text-gray-200 mx-0.5 shrink-0" />
                            )}
                        </div>
                    ))}
                    {statusF && (
                        <button onClick={() => setStatusF('')} className="ml-3 text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <X size={10} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-2.5 items-center">
                <div className="relative flex-1 min-w-52">
                    <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search title or ref…"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
                </div>
                <div className="flex gap-2 ml-auto">
                    <button onClick={load} className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setModal('create')}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
                        <Plus size={14} /> New Application
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="hidden lg:grid grid-cols-[3fr_1.5fr_1fr_1.3fr_1.2fr_1.2fr_auto] gap-3 px-5 py-3
                                bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <span>Application</span><span>Agency</span><span>Category</span><span>Status</span><span>Amount</span><span>Submitted</span><span />
                </div>
                {loading ? <RowSkeleton /> : items.length === 0
                    ? <EmptyState icon={FileText} title="No applications yet" subtitle="Create the first grant application" />
                    : (
                        <div className="divide-y divide-gray-50">
                            {items.map(item => {
                                const inReview = item.status === 'under_internal_review';
                                return (
                                    <div key={item.id} className={cn('group transition-colors',
                                        inReview ? 'hover:bg-violet-50/30' : 'hover:bg-indigo-50/20')}>
                                        {/* Desktop row */}
                                        <div className="hidden lg:grid grid-cols-[3fr_1.5fr_1fr_1.4fr_1.2fr_1.2fr_auto] gap-3 items-center px-5 py-4">
                                            <div className="min-w-0">
                                                <p onClick={() => inReview && setReviewTarget(item)}
                                                    className={cn('text-sm font-semibold truncate',
                                                        inReview ? 'text-violet-700 hover:underline cursor-pointer' : 'text-gray-900')}>
                                                    {truncate(item.title, 55)}
                                                </p>
                                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">{item.ref_number}</p>
                                            </div>
                                            <p className="text-xs text-gray-600 truncate">{item.agency?.name ?? '—'}</p>
                                            <CatBadge category={item.category} />
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <StatusDot status={item.status} statuses={APP_STATUSES} />
                                                {inReview && (
                                                    <button onClick={() => setReviewTarget(item)}
                                                        className="text-[10px] font-bold text-violet-600 hover:text-violet-800 px-1.5 py-0.5 bg-violet-50 hover:bg-violet-100 rounded transition-colors leading-none">
                                                        Review →
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 tabular-nums">
                                                {item.amount_requested ? `${item.currency} ${Number(item.amount_requested).toLocaleString()}` : '—'}
                                            </p>
                                            <p className="text-xs text-gray-400">{formatDate(item.submitted_at) || '—'}</p>
                                            <ActionMenu
                                                btnRef={{ current: null }}
                                                items={[
                                                    { label: 'Edit', icon: Pencil, onClick: () => setModal(item) },
                                                    ...getWorkflowActions(item, handleStatusUpdate, setAwardTarget, setReviewTarget),
                                                    { divider: true },
                                                    { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(item.id) },
                                                ]}
                                            />
                                        </div>
                                        {/* Mobile card */}
                                        <div className="lg:hidden px-4 py-4" onClick={() => inReview && setReviewTarget(item)}>
                                            <div className="flex items-start gap-3">
                                                <Avatar name={item.agency?.name} size={9} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 line-clamp-2">{item.title}</p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">{item.agency?.name} · <span className="font-mono">{item.ref_number}</span></p>
                                                </div>
                                                <ActionMenu
                                                    btnRef={{ current: null }}
                                                    items={[
                                                        { label: 'Edit', icon: Pencil, onClick: () => setModal(item) },
                                                        ...getWorkflowActions(item, handleStatusUpdate, setAwardTarget, setReviewTarget),
                                                        { divider: true },
                                                        { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(item.id) },
                                                    ]}
                                                />
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                <StatusDot status={item.status} statuses={APP_STATUSES} />
                                                <CatBadge category={item.category} />
                                                {item.amount_requested && (
                                                    <span className="text-[11px] text-gray-500">{item.currency} {Number(item.amount_requested).toLocaleString()}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                }
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">Page {page} of {totalPages} — {meta?.total ?? 0} applications</p>
                    <div className="flex items-center gap-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors text-gray-600 font-medium">
                            <ChevronLeft size={12} /> Prev
                        </button>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors text-gray-600 font-medium">
                            Next <ChevronRight size={12} />
                        </button>
                    </div>
                </div>
            )}

            {modal && (
                <ApplicationModal
                    app={modal === 'create' ? null : modal}
                    agencies={agencies}
                    colleges={colleges}
                    departments={departments}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}
            {reviewTarget && (
                <ApplicationReviewDrawer
                    application={reviewTarget}
                    onClose={() => setReviewTarget(null)}
                    onUpdate={() => { setReviewTarget(null); load(); }}
                />
            )}
            {awardTarget && (
                <AwardModal
                    application={awardTarget}
                    onSave={handleRecordAward}
                    onClose={() => setAwardTarget(null)}
                />
            )}
            <ConfirmDialog
                open={!!confirm}
                title="Delete Application"
                description="This will permanently delete the application and all its data."
                confirmLabel="Delete"
                onConfirm={() => { handleDelete(confirm); setConfirm(null); }}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

// ─── Tab: Awards ───────────────────────────────────────────────────────────────

function AwardsTab() {
    const { success, error } = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusF, setStatusF] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState(null);
    const [drawerAward, setDrawerAward] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const params = { page };
        if (search) params.search = search;
        if (statusF) params.status = statusF;
        try {
            const r = await api.get('/external-funds/awards', { params });
            const pg = r.data.data ?? r.data;
            setItems(Array.isArray(pg) ? pg : (pg.data ?? []));
            if (pg?.total != null) setMeta(pg);
        } catch { error('Failed to load.'); }
        setLoading(false);
    }, [page, search, statusF]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id) => {
        await api.delete(`/external-funds/awards/${id}`);
        success('Award deleted.');
        load();
    };

    const totalPages = meta ? Math.ceil(meta.total / (meta.per_page ?? 25)) : 1;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2.5 items-center">
                <div className="relative flex-1 min-w-52">
                    <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search award or number…"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
                </div>
                <div className="relative">
                    <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
                        className="pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 appearance-none">
                        <option value="">All Statuses</option>
                        {Object.entries(AWARD_STATUSES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                </div>
                <button onClick={load} className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 ml-auto transition-colors">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1.3fr_1.2fr_1.2fr_1.2fr_auto] gap-3 px-5 py-3
                                bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <span>Award</span><span>Agency</span><span>Status</span><span>Amount</span><span>Start</span><span>End</span><span />
                </div>
                {loading ? <RowSkeleton /> : items.length === 0
                    ? <EmptyState icon={Award} title="No awards yet" subtitle="Awards appear here when applications are approved by a funding agency" />
                    : (
                        <div className="divide-y divide-gray-50">
                            {items.map(item => (
                                <div key={item.id} className="group hover:bg-indigo-50/20 transition-colors">
                                    <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1.3fr_1.2fr_1.2fr_1.2fr_auto] gap-3 items-center px-5 py-4">
                                        <div className="min-w-0 cursor-pointer" onClick={() => setDrawerAward(item)}>
                                            <p className="text-sm font-semibold text-gray-900 truncate hover:text-indigo-700 transition-colors">{truncate(item.title, 50)}</p>
                                            <p className="text-[11px] font-mono text-gray-400">{item.award_number}</p>
                                        </div>
                                        <p className="text-xs text-gray-600 truncate">{item.agency?.name ?? '—'}</p>
                                        <StatusDot status={item.status} statuses={AWARD_STATUSES} />
                                        <p className="text-xs font-semibold text-emerald-700 tabular-nums">
                                            {item.currency} {Number(item.amount_awarded).toLocaleString()}
                                        </p>
                                        <p className="text-xs text-gray-400">{formatDate(item.start_date)}</p>
                                        <p className="text-xs text-gray-400">{formatDate(item.end_date)}</p>
                                        <ActionMenu
                                            btnRef={{ current: null }}
                                            items={[
                                                { label: 'Manage Award', icon: Eye, onClick: () => setDrawerAward(item) },
                                                { divider: true },
                                                { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(item.id) },
                                            ]}
                                        />
                                    </div>
                                    <div className="lg:hidden px-4 py-4" onClick={() => setDrawerAward(item)}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                                <Award size={16} className="text-emerald-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.title}</p>
                                                <p className="text-[11px] text-gray-400">{item.agency?.name} · <span className="font-mono">{item.award_number}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <StatusDot status={item.status} statuses={AWARD_STATUSES} />
                                            <span className="text-xs font-bold text-emerald-700">{item.currency} {Number(item.amount_awarded).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                }
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
                    <div className="flex gap-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-gray-600 font-medium">
                            <ChevronLeft size={12} /> Prev
                        </button>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 text-gray-600 font-medium">
                            Next <ChevronRight size={12} />
                        </button>
                    </div>
                </div>
            )}

            {drawerAward && (
                <AwardDrawer
                    award={drawerAward}
                    onClose={() => setDrawerAward(null)}
                    onUpdate={load}
                />
            )}
            <ConfirmDialog
                open={!!confirm}
                title="Delete Award"
                description="This will permanently delete the award and all its related data."
                confirmLabel="Delete"
                onConfirm={() => { handleDelete(confirm); setConfirm(null); }}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

// ─── Tab: Opportunities ────────────────────────────────────────────────────────

function OpportunitiesTab() {
    const { success, error } = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusF, setStatusF] = useState('');
    const [agencies, setAgencies] = useState([]);
    const [modal, setModal] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const params = {};
        if (search) params.search = search;
        if (statusF) params.status = statusF;
        try {
            const r = await api.get('/external-funds/opportunities', { params });
            const d = r.data.data ?? r.data;
            setItems(Array.isArray(d) ? d : (d.data ?? []));
        } catch { error('Failed to load.'); }
        setLoading(false);
    }, [search, statusF]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        api.get('/external-funds/agencies', { params: { per_page: 100 } })
            .then(r => { const d = r.data.data ?? r.data; setAgencies(Array.isArray(d) ? d : (d.data ?? [])); })
            .catch(() => {});
    }, []);

    const handleSave = async (form) => {
        if (modal?.id) {
            await api.put(`/external-funds/opportunities/${modal.id}`, form);
            success('Opportunity updated.');
        } else {
            await api.post('/external-funds/opportunities', form);
            success('Opportunity created.');
        }
        setModal(null);
        load();
    };

    const handleDelete = async (id) => {
        await api.delete(`/external-funds/opportunities/${id}`);
        success('Opportunity deleted.');
        load();
    };

    const daysLeft = (deadline) => {
        if (!deadline) return null;
        const diff = Math.floor((new Date(deadline) - Date.now()) / 86_400_000);
        if (diff < 0) return { label: 'Closed', cls: 'text-gray-400' };
        if (diff === 0) return { label: 'Today!', cls: 'text-red-600 font-bold' };
        if (diff <= 7) return { label: `${diff}d left`, cls: 'text-orange-600 font-semibold' };
        return { label: `${diff}d left`, cls: 'text-gray-500' };
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2.5 items-center">
                <div className="relative flex-1 min-w-52">
                    <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search opportunities…"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
                </div>
                <div className="relative">
                    <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <select value={statusF} onChange={e => setStatusF(e.target.value)}
                        className="pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 appearance-none">
                        <option value="">All Statuses</option>
                        {Object.entries(OPP_STATUSES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                </div>
                <button onClick={() => setModal('create')}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 ml-auto transition-colors">
                    <Plus size={14} /> Add Opportunity
                </button>
            </div>

            {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-44 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100">
                    <EmptyState icon={Globe} title="No opportunities yet" subtitle="Add funding calls from agencies so researchers can apply" />
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => {
                        const deadline = daysLeft(item.deadline);
                        const cat = CATEGORIES[item.category] ?? CATEGORIES.other;
                        const opp = OPP_STATUSES[item.status] ?? OPP_STATUSES.draft;
                        return (
                            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group">
                                <div className="h-1" style={{ backgroundColor: cat.color }} />
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: cat.color, backgroundColor: cat.bg }}>{cat.label}</span>
                                            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', opp.badge)}>{opp.label}</span>
                                            {item.type && (
                                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{item.type}</span>
                                            )}
                                        </div>
                                        <ActionMenu
                                            btnRef={{ current: null }}
                                            items={[
                                                { label: 'Edit', icon: Pencil, onClick: () => setModal(item) },
                                                { divider: true },
                                                { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(item.id) },
                                            ]}
                                        />
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 mb-1">{item.title}</h3>
                                    <p className="text-xs text-gray-500 truncate mb-3">{item.agency?.name ?? '—'}</p>
                                    <div className="flex items-center justify-between text-xs">
                                        {item.amount_max
                                            ? <span className="font-semibold text-emerald-700">{item.currency} {Number(item.amount_max).toLocaleString()} max</span>
                                            : item.amount_min
                                                ? <span className="font-semibold text-emerald-700">{item.currency} {Number(item.amount_min).toLocaleString()}+</span>
                                                : <span className="text-gray-400">No amount set</span>
                                        }
                                        {deadline && <span className={deadline.cls}>{deadline.label}</span>}
                                    </div>
                                    {item.deadline && (
                                        <p className="text-[11px] text-gray-400 mt-1.5">Deadline: {formatDate(item.deadline)}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal && (
                <OpportunityModal
                    opp={modal === 'create' ? null : modal}
                    agencies={agencies}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}
            <ConfirmDialog
                open={!!confirm}
                title="Delete Opportunity"
                description="Are you sure you want to delete this funding opportunity?"
                confirmLabel="Delete"
                onConfirm={() => { handleDelete(confirm); setConfirm(null); }}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

// ─── Tab: Agencies ─────────────────────────────────────────────────────────────

function AgencyModal({ agency, onSave, onClose }) {
    const [form, setForm] = useState({
        name: agency?.name ?? '',
        acronym: agency?.acronym ?? '',
        type: agency?.type ?? 'government',
        country: agency?.country ?? '',
        website: agency?.website ?? '',
        contact_person: agency?.contact_person ?? '',
        contact_email: agency?.contact_email ?? '',
        contact_phone: agency?.contact_phone ?? '',
        description: agency?.description ?? '',
        is_active: agency?.is_active ?? true,
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const { error: toastError } = useToast();

    const save = async () => {
        setSaving(true); setErrors({});
        try { await onSave(form); }
        catch (e) {
            if (e.response?.status === 422) setErrors(e.response.data.errors ?? {});
            else toastError(e.response?.data?.message ?? 'Failed to save.');
        }
        setSaving(false);
    };

    const f = key => ({ value: form[key] ?? '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) });
    const cls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                    <h2 className="text-base font-bold text-gray-900">{agency ? 'Edit Agency' : 'New Funding Agency'}</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name *</label>
                            <input {...f('name')} className={cls} />
                            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name[0]}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Acronym</label>
                            <input {...f('acronym')} className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Type *</label>
                            <select {...f('type')} className={cls}>
                                {AGENCY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Country</label>
                            <input {...f('country')} placeholder="Country…" className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Website</label>
                            <input {...f('website')} placeholder="https://…" className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contact Person</label>
                            <input {...f('contact_person')} className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contact Email</label>
                            <input type="email" {...f('contact_email')} className={cls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contact Phone</label>
                            <input {...f('contact_phone')} className={cls} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
                            <textarea {...f('description')} rows={3} className={cn(cls, 'resize-none')} />
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-2">
                            <input type="checkbox" id="is_active" checked={!!form.is_active}
                                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                                className="rounded border-gray-300 text-indigo-600" />
                            <label htmlFor="is_active" className="text-sm text-gray-700 font-medium">Active</label>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 bg-white rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-semibold">Cancel</button>
                    <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
                        {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : agency ? 'Update Agency' : 'Create Agency'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function AgenciesTab() {
    const { success, error } = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/external-funds/agencies', { params: { search, per_page: 50 } });
            const d = r.data.data ?? r.data;
            setItems(Array.isArray(d) ? d : (d.data ?? []));
        } catch { error('Failed to load.'); }
        setLoading(false);
    }, [search]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (form) => {
        if (modal?.id) {
            await api.put(`/external-funds/agencies/${modal.id}`, form);
            success('Agency updated.');
        } else {
            await api.post('/external-funds/agencies', form);
            success('Agency created.');
        }
        setModal(null);
        load();
    };

    const handleDelete = async (id) => {
        await api.delete(`/external-funds/agencies/${id}`);
        success('Agency deleted.');
        load();
    };

    const TYPE_COLORS = {
        government: 'bg-blue-50 text-blue-700',
        ngo: 'bg-emerald-50 text-emerald-700',
        international: 'bg-violet-50 text-violet-700',
        industry: 'bg-amber-50 text-amber-700',
        foundation: 'bg-pink-50 text-pink-700',
        other: 'bg-gray-100 text-gray-600',
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2.5 items-center">
                <div className="relative flex-1">
                    <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agencies…"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
                </div>
                <button onClick={() => setModal('create')}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
                    <Plus size={14} /> Add Agency
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="hidden lg:grid grid-cols-[2.5fr_1fr_1fr_1.5fr_1fr_auto] gap-3 px-5 py-3
                                bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <span>Agency</span><span>Type</span><span>Country</span><span>Contact</span><span>Status</span><span />
                </div>
                {loading ? <RowSkeleton cols={5} /> : items.length === 0
                    ? <EmptyState icon={Landmark} title="No agencies yet" subtitle="Add your first funding agency" />
                    : (
                        <div className="divide-y divide-gray-50">
                            {items.map(item => (
                                <div key={item.id} className="group hover:bg-indigo-50/20 transition-colors">
                                    <div className="hidden lg:grid grid-cols-[2.5fr_1fr_1fr_1.5fr_1fr_auto] gap-3 items-center px-5 py-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar name={item.name} size={8} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                                {item.acronym && <p className="text-[11px] text-gray-400">{item.acronym}</p>}
                                            </div>
                                        </div>
                                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit capitalize', TYPE_COLORS[item.type] ?? TYPE_COLORS.other)}>
                                            {item.type}
                                        </span>
                                        <p className="text-xs text-gray-500">{item.country || '—'}</p>
                                        <div className="min-w-0">
                                            <p className="text-xs text-gray-700 truncate">{item.contact_person || '—'}</p>
                                            <p className="text-[11px] text-gray-400 truncate">{item.contact_email || ''}</p>
                                        </div>
                                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit',
                                            item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                                            {item.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <ActionMenu
                                            btnRef={{ current: null }}
                                            items={[
                                                { label: 'Edit', icon: Pencil, onClick: () => setModal(item) },
                                                { divider: true },
                                                { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(item.id) },
                                            ]}
                                        />
                                    </div>
                                    <div className="lg:hidden px-4 py-4 flex items-center gap-3">
                                        <Avatar name={item.name} size={9} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                            <p className="text-xs text-gray-400">{item.type} · {item.country || '—'}</p>
                                        </div>
                                        <ActionMenu
                                            btnRef={{ current: null }}
                                            items={[
                                                { label: 'Edit', icon: Pencil, onClick: () => setModal(item) },
                                                { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(item.id) },
                                            ]}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                }
            </div>

            {modal && (
                <AgencyModal
                    agency={modal === 'create' ? null : modal}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}
            <ConfirmDialog
                open={!!confirm}
                title="Delete Agency"
                description="Deleting this agency will also remove all associated data."
                confirmLabel="Delete"
                onConfirm={() => { handleDelete(confirm); setConfirm(null); }}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'dashboard',     label: 'Dashboard',    icon: BarChart3  },
    { id: 'applications',  label: 'Applications', icon: FileText   },
    { id: 'awards',        label: 'Awards',       icon: Award      },
    { id: 'opportunities', label: 'Opportunities',icon: Globe      },
    { id: 'agencies',      label: 'Agencies',     icon: Building2  },
];

export default function ExternalFunds() {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <AppLayout breadcrumb="External Funds">
            <div className="max-w-7xl mx-auto space-y-6 pb-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <Banknote size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">External Funds</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Manage grants, funding agencies, applications, and award lifecycle</p>
                    </div>
                </div>

                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit overflow-x-auto">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
                                activeTab === tab.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                            )}>
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'dashboard'     && <DashboardTab />}
                {activeTab === 'applications'  && <ApplicationsTab />}
                {activeTab === 'awards'        && <AwardsTab />}
                {activeTab === 'opportunities' && <OpportunitiesTab />}
                {activeTab === 'agencies'      && <AgenciesTab />}
            </div>
        </AppLayout>
    );
}
