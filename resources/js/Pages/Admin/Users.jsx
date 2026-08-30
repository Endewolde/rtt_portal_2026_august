import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Users as UsersIcon, Search, Plus, Pencil, Trash2, ShieldCheck,
    UserCheck, UserX, Building2, Calendar, ChevronLeft, ChevronRight,
    X, Eye, Filter, RefreshCw, Mail, Phone, CreditCard,
    CheckCircle2, XCircle, AlertTriangle, User, Clock,
    Upload, Download, FileDown, FileUp, AlertCircle, CheckCircle,
    FileText, ChevronDown, ChevronUp, ChevronsUpDown, LogIn, TrendingUp, UserPlus, Activity,
    MoreVertical, ShieldAlert, Lock,
} from 'lucide-react';
import { Link } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import ConfirmDialog from '../../Components/ConfirmDialog';
import api, { get, put } from '../../lib/api';
import { formatDate, cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
    admin:              'Admin',
    central_office:     'Central Office',
    college_admin:      'College Admin',
    department_head:    'Dept. Head',
    pi:                 'Principal Investigator',
    reviewer:           'Reviewer',
    finance_officer:    'Finance Officer',
    finance:            'Finance Officer',
    guest:              'Guest',
    staff:              'Staff',
    college_officer:    'College Officer',
    research_officer:   'Research Officer',
    community_officer:  'Community Officer',
    technology_officer: 'Technology Officer',
    central_officer:    'Central Officer',
    support_officer:    'Support Officer',
};

const ROLE_COLORS = {
    admin:              'bg-rose-50 text-rose-700 border border-rose-200',
    central_office:     'bg-orange-50 text-orange-700 border border-orange-200',
    college_admin:      'bg-blue-50 text-blue-700 border border-blue-200',
    department_head:    'bg-slate-50 text-slate-700 border border-slate-200',
    reviewer:           'bg-purple-50 text-purple-700 border border-purple-200',
    pi:                 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    finance_officer:    'bg-amber-50 text-amber-700 border border-amber-200',
    finance:            'bg-amber-50 text-amber-700 border border-amber-200',
    staff:              'bg-cyan-50 text-cyan-700 border border-cyan-200',
    college_officer:    'bg-teal-50 text-teal-700 border border-teal-200',
    research_officer:   'bg-indigo-50 text-indigo-700 border border-indigo-200',
    community_officer:  'bg-pink-50 text-pink-700 border border-pink-200',
    technology_officer: 'bg-violet-50 text-violet-700 border border-violet-200',
    central_officer:    'bg-orange-50 text-orange-700 border border-orange-200',
    support_officer:    'bg-sky-50 text-sky-700 border border-sky-200',
    guest:              'bg-gray-100 text-gray-600 border border-gray-200',
};

const STATUS_CONFIG = {
    active:    { label: 'Active',    icon: CheckCircle2,  cls: 'bg-green-50 text-green-700 border border-green-200' },
    inactive:  { label: 'Inactive',  icon: XCircle,       cls: 'bg-gray-100 text-gray-500 border border-gray-200'  },
    suspended: { label: 'Suspended', icon: AlertTriangle, cls: 'bg-red-50 text-red-600 border border-red-200'      },
};

const ROLE_GROUPS = [
    { label: 'Administration', roles: ['admin', 'central_officer', 'super_admin'] },
    { label: 'Research',       roles: ['staff', 'research_officer', 'community_officer', 'technology_officer', 'college_officer'] },
    { label: 'Operations',     roles: ['finance_officer', 'support_officer'] },
];

const AVATAR_GRADIENTS = [
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-violet-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-sky-600',
];

// ─── Relative time ────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(seconds / 3600);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(seconds / 86400);
    if (days < 7) {
        const remHours = Math.floor((seconds % 86400) / 3600);
        if (remHours > 0) return `${days} day${days !== 1 ? 's' : ''} ${remHours} hour${remHours !== 1 ? 's' : ''} ago`;
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    const years = Math.floor(days / 365);
    const remDays = days - years * 365;
    if (remDays > 0) return `${years} year${years !== 1 ? 's' : ''} ${remDays} day${remDays !== 1 ? 's' : ''} ago`;
    return `${years} year${years !== 1 ? 's' : ''} ago`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = 'md' }) {
    const name     = user?.name ?? '';
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const gradient = AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
    const dim      = size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs';

    if (user?.avatar) {
        return (
            <img src={user.avatar} alt={name}
                className={cn('rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm', dim)} />
        );
    }
    return (
        <div className={cn(
            'rounded-full flex items-center justify-center font-bold text-white shrink-0',
            `bg-linear-to-br ${gradient}`,
            dim
        )}>
            {initials}
        </div>
    );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
    if (!role) return <span className="text-xs text-gray-400">—</span>;
    const name = typeof role === 'string' ? role : role.name;
    return (
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', ROLE_COLORS[name] ?? ROLE_COLORS.guest)}>
            {ROLE_LABELS[name] ?? name}
        </span>
    );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const cfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
    const Icon = cfg.icon;
    return (
        <span className={cn('flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full w-fit', cfg.cls)}>
            <Icon size={11} />
            {cfg.label}
        </span>
    );
}

// ─── Registration method badge ────────────────────────────────────────────────

const REG_METHOD_CONFIG = {
    self_registered:  { label: 'Self Registered', cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
    admin_created:    { label: 'Admin Created',   cls: 'bg-blue-50 text-blue-700 border border-blue-200'   },
    imported:         { label: 'Imported',         cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
    oauth_google:     { label: 'Google',           cls: 'bg-red-50 text-red-700 border border-red-200'     },
    oauth_microsoft:  { label: 'Microsoft',        cls: 'bg-sky-50 text-sky-700 border border-sky-200'     },
}

function RegistrationBadge({ method }) {
    if (!method) return <span className="text-xs text-gray-300">—</span>
    const cfg = REG_METHOD_CONFIG[method] ?? { label: method.replace(/_/g, ' '), cls: 'bg-gray-50 text-gray-500 border border-gray-200' }
    return (
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', cfg.cls)}>
            {cfg.label}
        </span>
    )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ meta, page, onChange }) {
    if (!meta || meta.last_page <= 1) return null;
    const start = Math.max(1, Math.min(page - 2, meta.last_page - 4));
    const end   = Math.min(meta.last_page, start + 4);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const btn   = (content, disabled, onClick, active = false) => (
        <button key={content} onClick={onClick} disabled={disabled}
            className={cn(
                'h-8 min-w-8 px-2 rounded-lg text-xs font-semibold transition-colors',
                active   ? 'bg-indigo-600 text-white shadow-sm'
                         : 'text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed'
            )}>
            {content}
        </button>
    );
    return (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 px-1">
            <span className="text-xs text-gray-400">
                {meta.from ?? 0}–{meta.to ?? 0} of <strong className="text-gray-700">{meta.total}</strong> users
            </span>
            <div className="flex items-center gap-1">
                {btn(<ChevronLeft size={13} />, page === 1, () => onChange(page - 1))}
                {start > 1 && <>{btn(1, false, () => onChange(1))}{start > 2 && <span className="text-gray-300 text-xs px-1">…</span>}</>}
                {pages.map(p => btn(p, false, () => onChange(p), p === page))}
                {end < meta.last_page && <>{end < meta.last_page - 1 && <span className="text-gray-300 text-xs px-1">…</span>}{btn(meta.last_page, false, () => onChange(meta.last_page))}</>}
                {btn(<ChevronRight size={13} />, page === meta.last_page, () => onChange(page + 1))}
            </div>
        </div>
    );
}

// ─── Input / Select helpers ───────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors hover:border-gray-300';

function Field({ label, required, children, hint }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {children}
            {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        </div>
    );
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

function UserFormModal({ title, initial, colleges, allRoles, onSave, onClose }) {
    const [form, setForm] = useState({
        name: '', title: '', email: '', password: '', role: 'pi',
        college_id: '', department_id: '', employee_id: '', phone: '', gender: '',
        expertise: [],
        ...initial,
        expertise: Array.isArray(initial?.expertise) ? initial.expertise : [],
    });
    const [departments, setDepartments]       = useState([]);
    const [expertiseInput, setExpertiseInput] = useState('');
    const [saving, setSaving]                 = useState(false);
    const { error } = useToast();
    const isEdit    = !!initial?.id;

    useEffect(() => {
        if (form.college_id) {
            api.get(`/colleges/${form.college_id}/departments`)
                .then(r => setDepartments(r.data?.data ?? []))
                .catch(() => setDepartments([]));
        } else {
            setDepartments([]);
            setForm(f => ({ ...f, department_id: '' }));
        }
    }, [form.college_id]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const addExpertise = (raw) => {
        const tag = raw.trim().replace(/,+$/, '').trim();
        if (!tag) return;
        const current = form.expertise ?? [];
        if (!current.includes(tag)) set('expertise', [...current, tag]);
        setExpertiseInput('');
    };

    const removeExpertise = (tag) =>
        set('expertise', (form.expertise ?? []).filter(e => e !== tag));

    const onExpertiseKey = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addExpertise(expertiseInput);
        } else if (e.key === 'Backspace' && !expertiseInput && form.expertise?.length) {
            set('expertise', form.expertise.slice(0, -1));
        }
    };

    const submit = async () => {
        if (!form.name.trim() || !form.email.trim()) { error('Name and email are required.'); return; }
        if (!isEdit && !form.password.trim())         { error('Password is required for new users.'); return; }
        setSaving(true);
        try {
            const payload = { ...form };
            if (!payload.password) delete payload.password;
            await onSave(payload);
        } catch (e) {
            error(e.response?.data?.message || 'Save failed.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <User size={16} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">{title}</h2>
                            {isEdit && <p className="text-xs text-gray-400">{initial.name}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
                    {/* Personal info */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Personal Information</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Full Name" required>
                                <input value={form.name} onChange={e => set('name', e.target.value)}
                                    placeholder="Full name" className={inputCls} />
                            </Field>
                            <Field label="Academic Title" hint="e.g. Prof., Dr., Mr., Mrs.">
                                <input value={form.title ?? ''} onChange={e => set('title', e.target.value)}
                                    placeholder="Prof. / Dr. / Mr. …" className={inputCls} />
                            </Field>
                            <Field label="Email" required>
                                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                                    placeholder="email@example.com" className={inputCls} />
                            </Field>
                            <Field label="Phone">
                                <input type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)}
                                    placeholder="+251 9xx xxx xxxx" className={inputCls} />
                            </Field>
                            <Field label="Employee ID">
                                <input value={form.employee_id ?? ''} onChange={e => set('employee_id', e.target.value)}
                                    placeholder="e.g. EMP-001" className={inputCls} />
                            </Field>
                            <Field label="Gender">
                                <select value={form.gender ?? ''} onChange={e => set('gender', e.target.value)} className={inputCls}>
                                    <option value="">Not specified</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </Field>
                            <Field label="Password" required={!isEdit} hint={isEdit ? 'Leave blank to keep current' : ''}>
                                <input type="password" value={form.password ?? ''} onChange={e => set('password', e.target.value)}
                                    placeholder={isEdit ? '••••••••' : 'Set password'}
                                    className={inputCls} />
                            </Field>
                        </div>
                    </div>

                    {/* Account & org */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Account & Organisation</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Role" required={!isEdit}>
                                <select value={form.role ?? ''} onChange={e => set('role', e.target.value)} className={inputCls}>
                                    <option value="">Select a role…</option>
                                    {ROLE_GROUPS.map(group => {
                                        const groupRoles = group.roles.filter(r => allRoles.includes(r));
                                        if (!groupRoles.length) return null;
                                        return (
                                            <optgroup key={group.label} label={group.label}>
                                                {groupRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r.replace(/_/g, ' ')}</option>)}
                                            </optgroup>
                                        );
                                    })}
                                    {(() => {
                                        const allGroupedRoles = ROLE_GROUPS.flatMap(g => g.roles);
                                        const custom = allRoles.filter(r => !allGroupedRoles.includes(r));
                                        if (!custom.length) return null;
                                        return (
                                            <optgroup label="Custom">
                                                {custom.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                            </optgroup>
                                        );
                                    })()}
                                </select>
                            </Field>
                            <Field label="College">
                                <select value={form.college_id ?? ''} onChange={e => set('college_id', e.target.value)} className={inputCls}>
                                    <option value="">Not assigned</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Department">
                                <select value={form.department_id ?? ''} onChange={e => set('department_id', e.target.value)}
                                    disabled={!departments.length} className={cn(inputCls, !departments.length && 'opacity-50')}>
                                    <option value="">Not assigned</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </Field>
                        </div>
                    </div>

                    {/* Research expertise */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Research Expertise</p>
                        <Field label="Expertise Areas" hint="Press Enter or comma to add each area. Used for reviewer matching.">
                            <div className={cn(
                                'flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-xl bg-white min-h-10.5',
                                'focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent'
                            )}>
                                {(form.expertise ?? []).map((tag, i) => (
                                    <span key={i}
                                        className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium px-2 py-1 rounded-lg">
                                        {tag}
                                        <button type="button" onClick={() => removeExpertise(tag)}
                                            className="text-indigo-400 hover:text-indigo-700 transition-colors">
                                            <X size={11} />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    value={expertiseInput}
                                    onChange={e => setExpertiseInput(e.target.value)}
                                    onKeyDown={onExpertiseKey}
                                    onBlur={() => addExpertise(expertiseInput)}
                                    placeholder={(form.expertise?.length ?? 0) === 0 ? 'e.g. Machine Learning, Biomedical Engineering…' : ''}
                                    className="flex-1 min-w-32 text-sm outline-none bg-transparent placeholder-gray-400 px-1 py-0.5"
                                />
                            </div>
                        </Field>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold
                                   rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : isEdit ? 'Save Changes' : 'Create User'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Create Super Admin modal ─────────────────────────────────────────────────

function CreateSuperAdminModal({ onSave, onClose }) {
    const [form, setForm] = useState({ name: '', email: '', password: '', current_password: '' });
    const [saving, setSaving] = useState(false);
    const { error } = useToast();
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const submit = async () => {
        if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
            error('Name, email and password are required.');
            return;
        }
        if (!form.current_password.trim()) {
            error('Re-enter your own password to confirm this action.');
            return;
        }
        setSaving(true);
        try {
            await onSave(form);
        } catch (e) {
            error(e.response?.data?.message || 'Could not create super admin account.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 bg-amber-50/50">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-amber-100 rounded-xl flex items-center justify-center">
                            <ShieldAlert size={16} className="text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Create Super Admin</h2>
                            <p className="text-xs text-gray-400">Grants full, unrestricted system access</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        This creates a new account with the same level of access you have. Only do this for someone you trust completely.
                    </p>

                    <Field label="Full Name" required>
                        <input value={form.name} onChange={e => set('name', e.target.value)}
                            placeholder="Full name" className={inputCls} />
                    </Field>
                    <Field label="Email" required>
                        <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                            placeholder="email@example.com" className={inputCls} />
                    </Field>
                    <Field label="Password" required>
                        <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                            placeholder="Set a strong password" className={inputCls} />
                    </Field>

                    <div className="pt-2 border-t border-gray-100">
                        <Field label="Your Password" required hint="Confirm it's you — re-enter your own account password.">
                            <div className="relative">
                                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                <input type="password" value={form.current_password} onChange={e => set('current_password', e.target.value)}
                                    placeholder="Your current password" className={cn(inputCls, 'pl-8')} />
                            </div>
                        </Field>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white text-sm font-semibold
                                   rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors">
                        {saving ? <><RefreshCw size={13} className="animate-spin" /> Creating…</> : 'Create Super Admin'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Assign Roles modal ───────────────────────────────────────────────────────

function AssignRolesModal({ user, allRoles, onSave, onClose }) {
    const currentRoles = (user.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
    const [selected, setSelected] = useState(currentRoles);
    const [saving, setSaving]     = useState(false);
    const { error } = useToast();

    const toggle = (role) =>
        setSelected(s => s.includes(role) ? s.filter(x => x !== role) : [...s, role]);

    const submit = async () => {
        if (!selected.length) { error('Select at least one role.'); return; }
        setSaving(true);
        try { await onSave(selected); } catch (e) { error(e.response?.data?.message || 'Failed.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <ShieldCheck size={16} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Assign Roles</h2>
                            <p className="text-xs text-gray-400">{user.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>

                <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-5">
                    {(() => {
                        const allGroupedRoles = ROLE_GROUPS.flatMap(g => g.roles);
                        const customRoles = allRoles.filter(r => !allGroupedRoles.includes(r));

                        const RoleRow = ({ role }) => {
                            const isOn = selected.includes(role);
                            return (
                                <label key={role}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors',
                                        isOn ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent'
                                    )}>
                                    <input type="checkbox" checked={isOn} onChange={() => toggle(role)}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className={cn('text-sm font-medium', isOn ? 'text-indigo-700' : 'text-gray-700')}>
                                            {ROLE_LABELS[role] ?? role.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    {isOn && (
                                        <span className={cn('text-xs px-2 py-0.5 rounded-full', ROLE_COLORS[role] ?? ROLE_COLORS.guest)}>
                                            Active
                                        </span>
                                    )}
                                </label>
                            );
                        };

                        return (
                            <>
                                {ROLE_GROUPS.map(group => {
                                    const groupRoles = group.roles.filter(r => allRoles.includes(r));
                                    if (!groupRoles.length) return null;
                                    return (
                                        <div key={group.label}>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{group.label}</p>
                                            <div className="space-y-1">
                                                {groupRoles.map(role => <RoleRow key={role} role={role} />)}
                                            </div>
                                        </div>
                                    );
                                })}
                                {customRoles.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Custom</p>
                                        <div className="space-y-1">
                                            {customRoles.map(role => <RoleRow key={role} role={role} />)}
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{selected.length} role{selected.length !== 1 ? 's' : ''} selected</span>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                            Cancel
                        </button>
                        <button onClick={submit} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : 'Save Roles'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Bulk Assign Role modal ───────────────────────────────────────────────────

function BulkAssignRoleModal({ count, allRoles, onSave, onClose }) {
    const [role, setRole]   = useState('');
    const [saving, setSaving] = useState(false);
    const { error } = useToast();

    const submit = async () => {
        if (!role) { error('Please select a role.'); return; }
        setSaving(true);
        try { await onSave(role); } catch (e) { error(e.response?.data?.message || 'Failed.'); setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <ShieldCheck size={16} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Assign Role</h2>
                            <p className="text-xs text-gray-400">{count} user{count !== 1 ? 's' : ''} selected</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>

                <div className="px-5 py-5 space-y-4">
                    <p className="text-sm text-gray-500">
                        Choose a role to assign to all selected users. This will <strong className="text-gray-800">replace</strong> each user's current role.
                    </p>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            <option value="">Select a role…</option>
                            {ROLE_GROUPS.map(group => {
                                const groupRoles = group.roles.filter(r => allRoles.includes(r));
                                if (!groupRoles.length) return null;
                                return (
                                    <optgroup key={group.label} label={group.label}>
                                        {groupRoles.map(r => (
                                            <option key={r} value={r}>{ROLE_LABELS[r] ?? r.replace(/_/g, ' ')}</option>
                                        ))}
                                    </optgroup>
                                );
                            })}
                            {(() => {
                                const allGroupedRoles = ROLE_GROUPS.flatMap(g => g.roles);
                                const custom = allRoles.filter(r => !allGroupedRoles.includes(r));
                                if (!custom.length) return null;
                                return (
                                    <optgroup label="Custom">
                                        {custom.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                    </optgroup>
                                );
                            })()}
                        </select>
                    </div>
                    {role && (
                        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                            <ShieldCheck size={13} className="text-indigo-500 shrink-0" />
                            <span className="text-xs text-indigo-700">
                                All {count} user{count !== 1 ? 's' : ''} will be set to <strong>{ROLE_LABELS[role] ?? role}</strong>
                            </span>
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={saving || !role}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {saving ? <><RefreshCw size={13} className="animate-spin" /> Assigning…</> : 'Assign Role'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Row action menu (three-dots dropdown) ────────────────────────────────────

function RowMenu({ user, canEditUser, isSuperAdmin, canImpersonate, canManageUsers, currentUser, onEdit, onAssign, onImpersonate, onStatusChange, onDelete }) {
    const [open, setOpen] = useState(false);
    const [pos,  setPos]  = useState({ top: 0, right: 0 });
    const btnRef          = useRef(null);
    const menuRef         = useRef(null);

    useEffect(() => {
        if (!open) return;
        function handle(e) {
            if (menuRef.current && !menuRef.current.contains(e.target) &&
                btnRef.current  && !btnRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [open]);

    const allRoleNames       = (user.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
    const isActive           = (user.status ?? 'active') === 'active';
    const canImpersonateThis = canImpersonate && user.id !== currentUser?.id && !allRoleNames.includes('super_admin') && !allRoleNames.includes('admin');
    const canManageThis      = canManageUsers && user.id !== currentUser?.id && (isSuperAdmin || !allRoleNames.includes('super_admin')) && (isSuperAdmin || !allRoleNames.includes('admin'));

    const close = () => setOpen(false);

    const items = [
        { label: 'View Profile',   icon: Eye,         show: true,               href: `/admin/users/${user.id}`,                                                       color: 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50' },
        { label: 'Edit',           icon: Pencil,      show: canEditUser,         onClick: () => { onEdit(user); close(); },                                              color: 'text-gray-600 hover:text-blue-600 hover:bg-blue-50' },
        { label: 'Assign Roles',   icon: ShieldCheck, show: isSuperAdmin,        onClick: () => { onAssign(user); close(); },                                            color: 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50' },
        { label: 'Login as User',  icon: LogIn,       show: canImpersonateThis,  onClick: () => { onImpersonate(user); close(); },                                       color: 'text-gray-600 hover:text-emerald-600 hover:bg-emerald-50' },
        { label: isActive ? 'Deactivate' : 'Activate', icon: isActive ? UserX : UserCheck, show: canManageThis,
          onClick: () => { onStatusChange({ user, newStatus: isActive ? 'inactive' : 'active' }); close(); },
          color: isActive ? 'text-gray-600 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-600 hover:text-green-600 hover:bg-green-50' },
        { label: 'Delete',         icon: Trash2,      show: canManageThis,       onClick: () => { onDelete(user); close(); },                                            color: 'text-red-500 hover:text-red-700 hover:bg-red-50', divider: true },
    ].filter(i => i.show);

    if (!items.length) return null;

    function handleToggle() {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        }
        setOpen(v => !v);
    }

    return (
        <div className="flex justify-end">
            <button
                ref={btnRef}
                onClick={handleToggle}
                className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Actions"
            >
                <MoreVertical size={15} />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
                    className="w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1"
                >
                    {items.map((item, i) => (
                        <div key={i}>
                            {item.divider && <div className="my-1 border-t border-gray-100" />}
                            {item.href ? (
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors w-full ${item.color}`}
                                    onClick={close}
                                >
                                    <item.icon size={13} />
                                    {item.label}
                                </Link>
                            ) : (
                                <button
                                    onClick={item.onClick}
                                    className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors w-full text-left ${item.color}`}
                                >
                                    <item.icon size={13} />
                                    {item.label}
                                </button>
                            )}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}

// ─── Download helper (blob from axios) ───────────────────────────────────────

async function downloadBlob(axiosPromise, filename) {
    const response = await axiosPromise;
    const url      = URL.createObjectURL(new Blob([response.data]));
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function SortHeader({ col, label, sortCol, sortDir, onSort, className = '' }) {
    const active = sortCol === col;
    return (
        <button
            type="button"
            onClick={() => onSort(col)}
            className={`flex items-center gap-1 hover:text-gray-600 transition-colors group ${active ? 'text-indigo-600' : 'text-gray-400'} ${className}`}
        >
            <span className="uppercase tracking-wider font-semibold text-[11px]">{label}</span>
            {active
                ? sortDir === 'asc'
                    ? <ChevronUp size={11} className="shrink-0 text-indigo-500" />
                    : <ChevronDown size={11} className="shrink-0 text-indigo-500" />
                : <ChevronsUpDown size={11} className="shrink-0 text-gray-300 group-hover:text-gray-400 transition-colors" />
            }
        </button>
    );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

const EXPECTED_COLS = ['name', 'email', 'password', 'role', 'college_code', 'department_code', 'employee_id', 'phone', 'gender'];

const IMPORT_ROLE_LABELS = {
    admin: 'admin',
    staff: 'staff',
    finance_officer: 'finance_officer',
    college_officer: 'college_officer', research_officer: 'research_officer',
    community_officer: 'community_officer', technology_officer: 'technology_officer',
    central_officer: 'central_officer', support_officer: 'support_officer',
};

function parseLocalCsv(text) {
    const lines = text.trim().split('\n').filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };
    const parseLine = (line) =>
        line.split(',').map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    const bom    = '﻿';
    const first  = lines[0].startsWith(bom) ? lines[0].slice(1) : lines[0];
    const headers = parseLine(first);
    const rows    = lines.slice(1).map(parseLine);
    return { headers, rows };
}

function ImportModal({ onClose, onDone }) {
    const { success, error: toastError } = useToast();
    const fileRef   = useRef(null);
    const [file, setFile]             = useState(null);
    const [preview, setPreview]       = useState(null); // { headers, rows }
    const [importing, setImporting]   = useState(false);
    const [result, setResult]         = useState(null);
    const [dragOver, setDragOver]     = useState(false);

    const handleFile = (f) => {
        if (!f) return;
        setFile(f);
        setResult(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const { headers, rows } = parseLocalCsv(e.target.result);
            setPreview({ headers, rows: rows.slice(0, 5) });
        };
        reader.readAsText(f);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped?.name.endsWith('.csv') || dropped?.type === 'text/csv') {
            handleFile(dropped);
        } else {
            toastError('Please drop a .csv file.');
        }
    };

    const downloadTemplate = async () => {
        try {
            await downloadBlob(
                api.get('/users/import-template', { responseType: 'blob' }),
                'users_import_template.csv'
            );
        } catch { toastError('Could not download template.'); }
    };

    const doImport = async () => {
        if (!file) return;
        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/users/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(res.data?.data);
            success(res.data?.message || 'Import complete.');
            onDone();
        } catch (e) {
            toastError(e.response?.data?.message || 'Import failed.');
        }
        setImporting(false);
    };

    const missingCols = preview
        ? EXPECTED_COLS.filter(c => !preview.headers.includes(c))
        : [];

    const COLUMN_GUIDE = [
        { col: 'name',            required: true,  hint: 'Full name'                              },
        { col: 'email',           required: true,  hint: 'Institutional email address'            },
        { col: 'role',            required: true,  hint: 'e.g. staff, pi, reviewer'               },
        { col: 'password',        required: false, hint: 'Blank = auto-generated'                 },
        { col: 'college_code',    required: false, hint: 'College short code, e.g. CBE'           },
        { col: 'department_code', required: false, hint: 'Department short code, e.g. CS'         },
        { col: 'employee_id',     required: false, hint: 'Staff / employee ID'                    },
        { col: 'phone',           required: false, hint: '+251… format'                           },
        { col: 'gender',          required: false, hint: 'male, female, or other'                 },
    ];

    const requiredCols = ['name', 'email', 'role'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>

                {/* ── Gradient header ───────────────────────────────────────── */}
                <div className="relative px-7 pt-7 pb-6 shrink-0" style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 60%, #818cf8 100%)' }}>
                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-xl transition-colors"
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    >
                        <X size={15} />
                    </button>

                    {/* Icon + title */}
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <FileUp size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-tight">Import Users</h2>
                            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                Upload a CSV file to bulk-create users
                            </p>
                        </div>
                    </div>

                    {/* Template download strip */}
                    {!result && (
                        <div className="mt-5 flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
                            <div className="flex items-center gap-3">
                                <FileDown size={16} className="text-indigo-200 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-white leading-tight">CSV Template</p>
                                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>All 9 columns · example rows included</p>
                                </div>
                            </div>
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                                style={{ background: 'rgba(255,255,255,0.9)', color: '#4338ca' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fff'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.9)'}
                            >
                                <Download size={12} /> Download
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Scrollable body ───────────────────────────────────────── */}
                <div className="overflow-y-auto flex-1 px-7 py-6 space-y-5">

                    {!result ? (
                        <>
                            {/* Column chips */}
                            <div>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">CSV columns</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {COLUMN_GUIDE.map(({ col, required }) => (
                                        <span
                                            key={col}
                                            title={COLUMN_GUIDE.find(c => c.col === col)?.hint}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium ${
                                                required
                                                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                                                    : 'bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            {col}
                                            {required && <span className="text-indigo-400 font-sans font-bold leading-none">*</span>}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">
                                    <span className="text-indigo-500 font-semibold">*</span> required &nbsp;·&nbsp; duplicate emails skipped &nbsp;·&nbsp; unknown codes silently ignored
                                </p>
                            </div>

                            {/* Drop zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onClick={() => fileRef.current?.click()}
                                className="relative cursor-pointer rounded-2xl transition-all duration-200"
                                style={{
                                    border: `2px dashed ${dragOver ? '#6366f1' : file ? '#10b981' : '#e2e8f0'}`,
                                    background: dragOver ? 'rgba(99,102,241,0.04)' : file ? 'rgba(16,185,129,0.04)' : '#fafafa',
                                    padding: '32px 24px',
                                    textAlign: 'center',
                                }}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={(e) => handleFile(e.target.files[0])}
                                />
                                {file ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                                            <CheckCircle2 size={28} className="text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB &nbsp;·&nbsp; <span className="text-indigo-500">click to replace</span></p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: dragOver ? 'rgba(99,102,241,0.1)' : '#f1f5f9' }}>
                                            <Upload size={26} className={dragOver ? 'text-indigo-500' : 'text-gray-400'} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">
                                                Drop your CSV here, or{' '}
                                                <span className="font-semibold text-indigo-600">browse files</span>
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">CSV only &nbsp;·&nbsp; max 2 MB</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Missing columns warning */}
                            {preview && missingCols.length > 0 && (
                                <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-amber-800">Missing required columns</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {missingCols.map(c => (
                                                <code key={c} className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono">{c}</code>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preview table */}
                            {preview && (
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Preview</p>
                                        <span className="text-[11px] text-gray-400">{preview.rows.length} row{preview.rows.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #f1f5f9' }}>
                                        <table className="min-w-full text-xs">
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                                    {preview.headers.map((h, i) => (
                                                        <th key={i} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.rows.map((row, ri) => (
                                                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                        {row.map((cell, ci) => (
                                                            <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {cell || <span className="text-gray-300">—</span>}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* ── Result screen ───────────────────────────────────── */
                        <div className="space-y-5">
                            {/* Success banner */}
                            <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: result.summary.errors === 0 ? 'rgba(16,185,129,0.07)' : 'rgba(251,191,36,0.08)', border: `1px solid ${result.summary.errors === 0 ? '#a7f3d0' : '#fde68a'}` }}>
                                {result.summary.errors === 0
                                    ? <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                                    : <AlertTriangle size={22} className="text-amber-500 shrink-0" />
                                }
                                <div>
                                    <p className={`text-sm font-semibold ${result.summary.errors === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                                        {result.summary.errors === 0 ? 'Import completed successfully' : 'Import finished with some errors'}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${result.summary.errors === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {result.summary.created} user{result.summary.created !== 1 ? 's' : ''} created · {result.summary.skipped} skipped
                                    </p>
                                </div>
                            </div>

                            {/* Stat cards */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Total',   val: result.summary.total,   top: '#6366f1', bg: '#eef2ff', text: '#3730a3' },
                                    { label: 'Created', val: result.summary.created, top: '#10b981', bg: '#ecfdf5', text: '#065f46' },
                                    { label: 'Skipped', val: result.summary.skipped, top: '#f59e0b', bg: '#fffbeb', text: '#78350f' },
                                    { label: 'Errors',  val: result.summary.errors,  top: '#ef4444', bg: '#fef2f2', text: '#7f1d1d' },
                                ].map(({ label, val, top, bg, text }) => (
                                    <div key={label} className="rounded-2xl overflow-hidden" style={{ background: bg, border: `1px solid ${top}22` }}>
                                        <div style={{ height: '3px', background: top }} />
                                        <div className="px-3 py-3 text-center">
                                            <p className="text-3xl font-bold leading-none" style={{ color: top }}>{val}</p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider mt-1.5" style={{ color: text, opacity: 0.65 }}>{label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Error rows */}
                            {result.errors?.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-semibold text-red-500 uppercase tracking-widest mb-2">Row errors</p>
                                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #fee2e2', maxHeight: '180px', overflowY: 'auto' }}>
                                        <table className="min-w-full text-xs">
                                            <thead>
                                                <tr style={{ background: '#fef2f2', borderBottom: '1px solid #fee2e2' }}>
                                                    <th className="px-3 py-2 text-left font-semibold text-red-400 w-12">Row</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-red-400">Email</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-red-400">Issue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.errors.map((e, i) => (
                                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                                                        <td className="px-3 py-2 font-mono text-gray-400">{e.row}</td>
                                                        <td className="px-3 py-2 text-gray-600">{e.email}</td>
                                                        <td className="px-3 py-2 text-red-500">{e.error}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <div className="px-7 py-4 shrink-0 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                    {result ? (
                        <button
                            onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            ← Import another file
                        </button>
                    ) : (
                        <p className="text-xs text-gray-400">
                            {preview
                                ? `${preview.rows.length} row${preview.rows.length !== 1 ? 's' : ''} ready`
                                : 'Select a CSV file to continue'}
                        </p>
                    )}
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 rounded-xl transition-colors hover:bg-gray-100"
                            style={{ border: '1px solid #e2e8f0' }}
                        >
                            {result ? 'Done' : 'Cancel'}
                        </button>
                        {!result && (
                            <button
                                onClick={doImport}
                                disabled={!file || importing || missingCols.some(c => requiredCols.includes(c))}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)' }}
                            >
                                {importing
                                    ? <><RefreshCw size={13} className="animate-spin" /> Importing…</>
                                    : <><Upload size={13} /> Import Users</>
                                }
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsers() {
    const { user: currentUser, hasRole, hasPermission, impersonate } = useAuth();
    const { success, error } = useToast();
    const isSuperAdmin      = hasRole('super_admin');
    const isAdminRole       = hasRole('admin');
    const isCollegeOfficer  = hasRole('college_officer');
    const canManageUsers    = isSuperAdmin || isAdminRole;
    const canCreateUser     = hasPermission('users.create');
    const canEditUser       = hasPermission('users.update');
    const canImportUsers    = hasPermission('users.import');
    const canImpersonate    = hasPermission('users.impersonate');
    const [impersonateTarget, setImpersonateTarget] = useState(null);
    const [impersonating, setImpersonating] = useState(false);

    const doImpersonate = async () => {
        if (!impersonateTarget) return;
        setImpersonating(true);
        try {
            await impersonate(impersonateTarget.id);
        } catch {
            error('Could not log in as this user.');
            setImpersonating(false);
        }
    };

    const [users, setUsers]                 = useState([]);
    const [meta,  setMeta]                  = useState(null);
    const [page,  setPage]                  = useState(1);
    const [colleges, setColleges]           = useState([]);
    const [allRoles, setAllRoles]           = useState(Object.keys(ROLE_LABELS));
    const [loading, setLoading]             = useState(true);
    const [search, setSearch]                     = useState('');
    const [roleFilter, setRoleFilter]             = useState('');
    const [statusFilter, setStatusFilter]         = useState('');
    // College officers are already scoped to their own college server-side —
    // pre-select it so the department-filter cascade below works for them too,
    // and there's no "All Colleges" picker implying they could see anyone else's.
    const [collegeFilter, setCollegeFilter]       = useState(() => (hasRole('college_officer') ? currentUser?.college_id ?? '' : ''));
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [genderFilter, setGenderFilter]         = useState('');
    const [regMethodFilter, setRegMethodFilter]   = useState('');
    const [filterDepts, setFilterDepts]           = useState([]);
    const [stats, setStats]                       = useState(null);
    const [sortCol, setSortCol]                   = useState('name');
    const [sortDir, setSortDir]                   = useState('asc');

    const [createModal,   setCreateModal]   = useState(false);
    const [createSuperAdminModal, setCreateSuperAdminModal] = useState(false);
    const [editModal,     setEditModal]     = useState(null);
    const [assignModal,   setAssignModal]   = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [statusConfirm, setStatusConfirm] = useState(null);
    const [importModal,   setImportModal]   = useState(false);
    const [exporting,     setExporting]     = useState(false);

    const searchTimer = useRef(null);
    const [searchInput, setSearchInput] = useState('');

    const handleSort = (col) => {
        if (col === sortCol) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
        setPage(1);
    };

    const load = useCallback(() => {
        setLoading(true);
        get('/users', {
            search,
            role:                roleFilter || undefined,
            status:              statusFilter  || undefined,
            college_id:          collegeFilter || undefined,
            department_id:       departmentFilter || undefined,
            gender:              genderFilter  || undefined,
            registration_method: regMethodFilter || undefined,
            sort_by:             sortCol,
            sort_dir:            sortDir,
            page,
        })
            .then(r => {
                const paginator = r.data;
                setUsers(paginator?.data ?? []);
                if (paginator?.total != null) {
                    setMeta({
                        current_page: paginator.current_page,
                        last_page:    paginator.last_page,
                        total:        paginator.total,
                        per_page:     paginator.per_page,
                        from:         paginator.from ?? 0,
                        to:           paginator.to   ?? 0,
                    });
                }
            })
            .catch(() => error('Failed to load users.'))
            .finally(() => setLoading(false));
    }, [search, roleFilter, statusFilter, collegeFilter, departmentFilter, genderFilter, regMethodFilter, sortCol, sortDir, page]);

    useEffect(() => { load(); }, [load]);

    // Load departments whenever the college filter changes
    useEffect(() => {
        setDepartmentFilter('');
        if (collegeFilter) {
            api.get(`/colleges/${collegeFilter}/departments`)
                .then(r => setFilterDepts(r.data?.data ?? []))
                .catch(() => setFilterDepts([]));
        } else {
            setFilterDepts([]);
        }
    }, [collegeFilter]);

    useEffect(() => {
        api.get('/colleges').then(r => setColleges(r.data?.data ?? [])).catch(() => {});
        api.get('/roles').then(r => {
            const names = (r.data?.data ?? []).map(ro => ro.name).filter(n => n !== 'super_admin');
            if (names.length) setAllRoles(names);
        }).catch(() => {});
        api.get('/users/stats').then(r => setStats(r.data?.data ?? null)).catch(() => {});
    }, []);

    const visibleUsers = users.filter(u => {
        const roles = (u.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
        return !roles.includes('super_admin');
    });

    const handleSearchInput = (val) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
    };

    const handleCreate      = async (form) => { await api.post('/users', form); success('User created.'); setCreateModal(false); load(); };
    const handleCreateSuperAdmin = async (form) => { await api.post('/users/create-super-admin', form); success('Super admin account created.'); setCreateSuperAdminModal(false); load(); };
    const handleEdit        = async (form) => { await api.put(`/users/${editModal.id}`, form); success('User updated.'); setEditModal(null); load(); };
    const handleAssignRoles = async (roles) => { await api.put(`/users/${assignModal.id}/roles`, { roles }); success('Roles updated.'); setAssignModal(null); load(); };

    const handleDelete = async () => {
        try { await api.delete(`/users/${deleteConfirm.id}`); success('User deleted.'); setDeleteConfirm(null); load(); }
        catch (e) { error(e.response?.data?.message || 'Delete failed.'); }
    };

    const handleStatus = async () => {
        try { await put(`/users/${statusConfirm.user.id}/status`, { status: statusConfirm.newStatus }); success('Status updated.'); setStatusConfirm(null); load(); }
        catch (e) { error(e.response?.data?.message || 'Update failed.'); }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            if (search)           params.set('search', search);
            if (roleFilter) params.set('role', roleFilter);
            if (statusFilter)     params.set('status', statusFilter);
            if (collegeFilter)    params.set('college_id', collegeFilter);
            if (departmentFilter) params.set('department_id', departmentFilter);
            if (genderFilter)     params.set('gender', genderFilter);
            if (regMethodFilter)  params.set('registration_method', regMethodFilter);
            await downloadBlob(
                api.get(`/users/export?${params.toString()}`, { responseType: 'blob' }),
                `users_export_${new Date().toISOString().slice(0, 10)}.csv`
            );
        } catch { error('Export failed. Please try again.'); }
        setExporting(false);
    };

    const hasFilters = !!(search || roleFilter || statusFilter || collegeFilter || departmentFilter || genderFilter || regMethodFilter);

    // ── Bulk selection ────────────────────────────────────────────────────────
    const [selectedIds,    setSelectedIds]    = useState(new Set());
    const [bulkLoading,    setBulkLoading]    = useState(false);
    const [bulkConfirm,    setBulkConfirm]    = useState(null);
    const [bulkRoleModal,  setBulkRoleModal]  = useState(false);

    const canAssignRoles = hasPermission('roles.assign');

    const pageIds         = visibleUsers.map(u => u.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    const somePageSelected= pageIds.some(id => selectedIds.has(id));

    const toggleAll = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allPageSelected) {
                pageIds.forEach(id => next.delete(id));
            } else {
                pageIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const toggleOne = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });
    };

    const confirmBulk = (action) => {
        const labels = { activate: 'Activate', deactivate: 'Deactivate', delete: 'Delete' };
        setBulkConfirm({ action, label: labels[action] });
    };

    const executeBulk = async () => {
        const { action } = bulkConfirm;
        setBulkLoading(true);
        try {
            const res = await api.post('/users/bulk', { action, ids: [...selectedIds] });
            success(res.data?.message ?? 'Done.');
            setSelectedIds(new Set());
            load();
        } catch (e) {
            error(e.response?.data?.message || 'Bulk action failed.');
        } finally {
            setBulkLoading(false);
            setBulkConfirm(null);
        }
    };

    const executeBulkAssignRole = async (role) => {
        const res = await api.post('/users/bulk', { action: 'assign_role', ids: [...selectedIds], role });
        success(res.data?.message ?? 'Done.');
        setBulkRoleModal(false);
        setSelectedIds(new Set());
        load();
    };

    return (
        <AppLayout breadcrumb="Users">
            <div className="max-w-7xl mx-auto space-y-5 pb-8">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Users</h1>
                        <p className="text-xs text-gray-400 mt-0.5">Manage system users, roles and access</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={load} disabled={loading}
                            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
                            title="Refresh">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={handleExport} disabled={exporting}
                            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                            <span className="hidden sm:inline">Export</span>
                            {hasFilters && <span className="text-[10px] bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded-full">filtered</span>}
                        </button>
                        {canImportUsers && (
                            <button onClick={() => setImportModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors">
                                <Upload size={14} /> <span className="hidden sm:inline">Import</span>
                            </button>
                        )}
                        {canCreateUser && (
                            <button onClick={() => setCreateModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap">
                                <Plus size={15} /> Add User
                            </button>
                        )}
                        {isSuperAdmin && (
                            <button onClick={() => setCreateSuperAdminModal(true)} title="Create Super Admin"
                                className="p-2 rounded-xl border border-amber-200 text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                                <ShieldAlert size={15} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Stats cards ─────────────────────────────────────────── */}
                <div className={`grid grid-cols-2 ${isCollegeOfficer ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
                    {(isCollegeOfficer ? [
                        {
                            label: 'Total Users',
                            value: stats?.total ?? '—',
                            icon: UsersIcon,
                            color: '#6366f1',
                            bg: '#eef2ff',
                            border: '#e0e7ff',
                            sub: meta ? `${meta.total.toLocaleString()} in current view` : null,
                        },
                        {
                            label: 'Total Departments',
                            value: filterDepts.length,
                            icon: Building2,
                            color: '#0ea5e9',
                            bg: '#f0f9ff',
                            border: '#bae6fd',
                            sub: null,
                        },
                        {
                            label: 'Active Departments',
                            value: filterDepts.filter(d => d.status === 'active').length,
                            icon: CheckCircle2,
                            color: '#10b981',
                            bg: '#ecfdf5',
                            border: '#a7f3d0',
                            sub: null,
                        },
                    ] : [
                        {
                            label: 'Total Users',
                            value: stats?.total ?? '—',
                            icon: UsersIcon,
                            color: '#6366f1',
                            bg: '#eef2ff',
                            border: '#e0e7ff',
                            sub: meta ? `${meta.total.toLocaleString()} in current view` : null,
                        },
                        {
                            label: 'Active',
                            value: stats?.active ?? '—',
                            icon: Activity,
                            color: '#10b981',
                            bg: '#ecfdf5',
                            border: '#a7f3d0',
                            sub: stats ? `${Math.round((stats.active / (stats.total || 1)) * 100)}% of total` : null,
                        },
                        {
                            label: 'Inactive / Suspended',
                            value: stats?.inactive ?? '—',
                            icon: UserX,
                            color: '#f59e0b',
                            bg: '#fffbeb',
                            border: '#fde68a',
                            sub: stats ? `${Math.round((stats.inactive / (stats.total || 1)) * 100)}% of total` : null,
                        },
                        {
                            label: 'New This Month',
                            value: stats?.new_this_month ?? '—',
                            icon: UserPlus,
                            color: '#8b5cf6',
                            bg: '#f5f3ff',
                            border: '#ddd6fe',
                            sub: 'joined since 1st',
                        },
                    ]).map(({ label, value, icon: Icon, color, bg, border, sub }) => (
                        <div key={label} className="bg-white rounded-2xl border p-5 flex items-start gap-4 shadow-sm"
                            style={{ borderColor: border }}>
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: bg }}>
                                <Icon size={18} style={{ color }} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-2xl font-bold text-gray-900 leading-none">
                                    {typeof value === 'number' ? value.toLocaleString() : value}
                                </p>
                                <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
                                {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Filters ─────────────────────────────────────────────── */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
                    {/* Row 1: search + college + department */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">
                            <Filter size={12} /> Filters
                        </div>
                        <div className="relative flex-1 min-w-48">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                value={searchInput}
                                onChange={e => handleSearchInput(e.target.value)}
                                placeholder="Search name or email…"
                                className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                            />
                        </div>
                        {!isCollegeOfficer && (
                            <select value={collegeFilter} onChange={e => { setCollegeFilter(e.target.value); setPage(1); }}
                                className="py-2 pl-3 pr-7 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-gray-700">
                                <option value="">All Colleges</option>
                                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        )}
                        {filterDepts.length > 0 && (
                            <select value={departmentFilter} onChange={e => { setDepartmentFilter(e.target.value); setPage(1); }}
                                className="py-2 pl-3 pr-7 text-sm border border-indigo-200 rounded-xl bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-gray-700">
                                <option value="">All Departments</option>
                                {filterDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        )}
                    </div>

                    {/* Row 2: role + status + gender + registration method */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                            className="py-2 pl-3 pr-7 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-gray-700">
                            <option value="">All Roles</option>
                            <option value="guest">Guest (No Role)</option>
                            {allRoles.filter(r => r !== 'super_admin').map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                        </select>

                        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                            className="py-2 pl-3 pr-7 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-gray-700">
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                        </select>

                        <select value={genderFilter} onChange={e => { setGenderFilter(e.target.value); setPage(1); }}
                            className="py-2 pl-3 pr-7 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-gray-700">
                            <option value="">Any Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>

                        <select value={regMethodFilter} onChange={e => { setRegMethodFilter(e.target.value); setPage(1); }}
                            className="py-2 pl-3 pr-7 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-gray-700">
                            <option value="">Any Registration</option>
                            <option value="self_registered">Self Registered</option>
                            <option value="admin_created">Admin Created</option>
                            <option value="imported">Imported</option>
                            <option value="oauth_google">Google OAuth</option>
                            <option value="oauth_microsoft">Microsoft OAuth</option>
                        </select>

                        {hasFilters && (
                            <button onClick={() => {
                                setSearch(''); setSearchInput(''); setRoleFilter(''); setStatusFilter('');
                                setCollegeFilter(''); setDepartmentFilter(''); setGenderFilter('');
                                setRegMethodFilter(''); setPage(1);
                            }}
                                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors ml-auto">
                                <X size={12} /> Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Bulk action bar ─────────────────────────────────────── */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
                        <span className="text-sm font-semibold text-indigo-700">{selectedIds.size} selected</span>
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                            {canAssignRoles && (
                                <button onClick={() => setBulkRoleModal(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition">
                                    <ShieldCheck size={12} /> Assign Role
                                </button>
                            )}
                            {canManageUsers && (
                                <>
                                    <button onClick={() => confirmBulk('activate')}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition">
                                        Activate
                                    </button>
                                    <button onClick={() => confirmBulk('deactivate')}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition">
                                        Deactivate
                                    </button>
                                    <button onClick={() => confirmBulk('delete')}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition">
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                        <button onClick={() => setSelectedIds(new Set())}
                            className="ml-auto text-indigo-400 hover:text-indigo-700 transition"
                            aria-label="Clear selection">
                            <X size={15} />
                        </button>
                    </div>
                )}

                {/* ── Table ───────────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="divide-y divide-gray-50">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-4">
                                    <div className="h-9 w-9 rounded-full bg-gray-100 animate-pulse shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3.5 w-40 bg-gray-100 rounded animate-pulse" />
                                        <div className="h-3 w-52 bg-gray-100 rounded animate-pulse" />
                                    </div>
                                    <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
                                    <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : visibleUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <UsersIcon size={36} className="text-gray-200 mb-3" />
                            <p className="text-sm font-medium text-gray-500">No users found</p>
                            {hasFilters && (
                                <button onClick={() => { setSearch(''); setSearchInput(''); setRoleFilter(''); setStatusFilter(''); setCollegeFilter(''); setPage(1); }}
                                    className="mt-2 text-xs text-indigo-600 hover:underline">Clear filters</button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden sm:block overflow-x-auto">
                                {/* Table header */}
                                <div className="grid grid-cols-[40px_2.5fr_1.5fr_1.5fr_1fr_1fr_1fr_1.5fr_44px] items-center
                                                gap-4 px-5 py-3 bg-gray-50/80 border-b border-gray-100
                                                text-[11px] font-semibold text-gray-400 uppercase tracking-wider
                                                min-w-262.5">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                                        checked={allPageSelected}
                                        ref={el => { if (el) { el.indeterminate = somePageSelected && !allPageSelected; } }}
                                        onChange={toggleAll}
                                        aria-label="Select all on page"
                                    />
                                    <SortHeader col="name"                label="User"        sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Role</span>
                                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">College</span>
                                    <SortHeader col="status"              label="Status"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                    <SortHeader col="created_at"          label="Joined"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                    <SortHeader col="registration_method" label="Source"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                    <SortHeader col="last_login_at"       label="Last Access" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                    <span />
                                </div>

                                {/* Rows */}
                                <div className="divide-y divide-gray-50">
                                    {visibleUsers.map(u => {
                                        const allRoleNames = (u.roles ?? []).map(r => typeof r === 'string' ? r : r.name);

                                        return (
                                            <div key={u.id}
                                                className={`group grid grid-cols-[40px_2.5fr_1.5fr_1.5fr_1fr_1fr_1fr_1.5fr_44px] items-center
                                                           gap-4 px-5 py-3.5 transition-colors min-w-262.5 ${
                                                    selectedIds.has(u.id) ? 'bg-indigo-50' : 'hover:bg-gray-50/60'
                                                }`}>
                                                {/* Checkbox */}
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                                                    checked={selectedIds.has(u.id)}
                                                    onChange={() => toggleOne(u.id)}
                                                    onClick={e => e.stopPropagation()}
                                                    aria-label={`Select ${u.name}`}
                                                />
                                                {/* User */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar user={u} />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
                                                            {u.name}
                                                        </p>
                                                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                                    </div>
                                                </div>

                                                {/* Roles — show up to 2, then +N */}
                                                <div className="flex flex-wrap gap-1">
                                                    {allRoleNames.slice(0, 2).map(r => (
                                                        <RoleBadge key={r} role={r} />
                                                    ))}
                                                    {allRoleNames.length > 2 && (
                                                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                                            +{allRoleNames.length - 2}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* College */}
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {u.college ? (
                                                        <>
                                                            <Building2 size={12} className="text-gray-300 shrink-0" />
                                                            <span className="text-xs text-gray-600 truncate">{u.college.name}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">—</span>
                                                    )}
                                                </div>

                                                {/* Status */}
                                                <StatusBadge status={u.status ?? 'active'} />

                                                {/* Joined */}
                                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                                    <Calendar size={11} className="text-gray-300" />
                                                    {u.created_at ? formatDate(u.created_at) : '—'}
                                                </div>

                                                {/* Source */}
                                                <RegistrationBadge method={u.registration_method} />

                                                {/* Last Access */}
                                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                                    <Clock size={11} className="text-gray-300 shrink-0" />
                                                    <span className="truncate">{timeAgo(u.last_login_at)}</span>
                                                </div>

                                                {/* Actions */}
                                                <RowMenu
                                                    user={u}
                                                    canEditUser={canEditUser}
                                                    isSuperAdmin={isSuperAdmin}
                                                    canImpersonate={canImpersonate}
                                                    canManageUsers={canManageUsers}
                                                    currentUser={currentUser}
                                                    onEdit={setEditModal}
                                                    onAssign={setAssignModal}
                                                    onImpersonate={setImpersonateTarget}
                                                    onStatusChange={setStatusConfirm}
                                                    onDelete={setDeleteConfirm}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Mobile: stacked cards */}
                            <div className="sm:hidden divide-y divide-gray-50">
                                {visibleUsers.map(u => {
                                    const allRoleNames = (u.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
                                    return (
                                        <div key={u.id} className={`p-4 ${selectedIds.has(u.id) ? 'bg-indigo-50' : ''}`}>
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 mt-1 rounded border-gray-300 text-indigo-600 cursor-pointer shrink-0"
                                                    checked={selectedIds.has(u.id)}
                                                    onChange={() => toggleOne(u.id)}
                                                    aria-label={`Select ${u.name}`}
                                                />
                                                <Avatar user={u} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{u.name}</p>
                                                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                                        </div>
                                                        <RowMenu
                                                            user={u}
                                                            canEditUser={canEditUser}
                                                            isSuperAdmin={isSuperAdmin}
                                                            canImpersonate={canImpersonate}
                                                            canManageUsers={canManageUsers}
                                                            currentUser={currentUser}
                                                            onEdit={setEditModal}
                                                            onAssign={setAssignModal}
                                                            onImpersonate={setImpersonateTarget}
                                                            onStatusChange={setStatusConfirm}
                                                            onDelete={setDeleteConfirm}
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {allRoleNames.slice(0, 2).map(r => <RoleBadge key={r} role={r} />)}
                                                        {allRoleNames.length > 2 && (
                                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                                                +{allRoleNames.length - 2}
                                                            </span>
                                                        )}
                                                        <StatusBadge status={u.status ?? 'active'} />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-y-1 gap-x-3 mt-2.5 text-xs text-gray-400">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            {u.college ? (
                                                                <><Building2 size={11} className="text-gray-300 shrink-0" /><span className="truncate">{u.college.name}</span></>
                                                            ) : <span className="text-gray-300">No college</span>}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Calendar size={11} className="text-gray-300 shrink-0" />
                                                            {u.created_at ? formatDate(u.created_at) : '—'}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Clock size={11} className="text-gray-300 shrink-0" />
                                                            <span className="truncate">{timeAgo(u.last_login_at)}</span>
                                                        </div>
                                                        <div><RegistrationBadge method={u.registration_method} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            <div className="px-5 pb-4 pt-2">
                                <Pagination meta={meta} page={page} onChange={setPage} />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            {createModal && (
                <UserFormModal title="Create New User" initial={null}
                    colleges={colleges} allRoles={allRoles}
                    onSave={handleCreate} onClose={() => setCreateModal(false)} />
            )}

            {editModal && (
                <UserFormModal title="Edit User"
                    initial={{
                        name:          editModal.name,
                        title:         editModal.title         ?? '',
                        email:         editModal.email,
                        role:          (() => { const r = (editModal.roles ?? [])[0]; return r ? (typeof r === 'string' ? r : r.name) : 'guest'; })(),
                        college_id:    editModal.college_id    ?? editModal.college?.id    ?? '',
                        department_id: editModal.department_id ?? editModal.department?.id ?? '',
                        employee_id:   editModal.employee_id   ?? '',
                        phone:         editModal.phone         ?? '',
                        gender:        editModal.gender        ?? '',
                        expertise:     Array.isArray(editModal.expertise) ? editModal.expertise : [],
                        id:            editModal.id,
                    }}
                    colleges={colleges} allRoles={allRoles}
                    onSave={handleEdit} onClose={() => setEditModal(null)} />
            )}

            {createSuperAdminModal && (
                <CreateSuperAdminModal
                    onSave={handleCreateSuperAdmin} onClose={() => setCreateSuperAdminModal(false)} />
            )}

            {assignModal && (
                <AssignRolesModal user={assignModal} allRoles={allRoles}
                    onSave={handleAssignRoles} onClose={() => setAssignModal(null)} />
            )}

            {deleteConfirm && (
                <ConfirmDialog open
                    title="Delete User"
                    description={`Permanently delete "${deleteConfirm.name}"? This cannot be undone.`}
                    confirmLabel="Delete" confirmVariant="danger"
                    onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} />
            )}

            {statusConfirm && (
                <ConfirmDialog open
                    title={statusConfirm.newStatus === 'active' ? 'Activate User' : 'Deactivate User'}
                    description={`${statusConfirm.newStatus === 'active' ? 'Activate' : 'Deactivate'} "${statusConfirm.user.name}"?`}
                    confirmLabel={statusConfirm.newStatus === 'active' ? 'Activate' : 'Deactivate'}
                    confirmVariant={statusConfirm.newStatus === 'active' ? 'default' : 'danger'}
                    onConfirm={handleStatus} onCancel={() => setStatusConfirm(null)} />
            )}

            {impersonateTarget && (
                <ConfirmDialog open
                    title="Login as this user?"
                    description={`You will be signed in as "${impersonateTarget.name}" (${impersonateTarget.email}). Use "Return to Admin" in the banner to come back to your own account.`}
                    confirmLabel={impersonating ? 'Logging in…' : 'Login as User'}
                    onConfirm={doImpersonate} onCancel={() => setImpersonateTarget(null)} />
            )}

            {importModal && (
                <ImportModal
                    onClose={() => setImportModal(false)}
                    onDone={() => { load(); }}
                />
            )}

            {bulkRoleModal && (
                <BulkAssignRoleModal
                    count={selectedIds.size}
                    allRoles={allRoles}
                    onSave={executeBulkAssignRole}
                    onClose={() => setBulkRoleModal(false)}
                />
            )}

            {bulkConfirm && (
                <ConfirmDialog open
                    title={`${bulkConfirm.label} ${selectedIds.size} User${selectedIds.size > 1 ? 's' : ''}?`}
                    description={
                        bulkConfirm.action === 'delete'
                            ? `Permanently delete ${selectedIds.size} user(s)? Users with linked records will be skipped. This cannot be undone.`
                            : `${bulkConfirm.label} ${selectedIds.size} selected user(s)?`
                    }
                    confirmLabel={bulkLoading ? 'Processing…' : bulkConfirm.label}
                    confirmVariant={bulkConfirm.action === 'delete' ? 'danger' : 'default'}
                    onConfirm={executeBulk}
                    onCancel={() => setBulkConfirm(null)}
                />
            )}
        </AppLayout>
    );
}
