import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users as UsersIcon, Search, Plus, Pencil, Trash2, ShieldCheck,
    UserCheck, UserX, Building2, Calendar, ChevronLeft, ChevronRight,
    X, Eye, Filter, RefreshCw, Mail, Phone, CreditCard,
    CheckCircle2, XCircle, AlertTriangle, User,
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
    super_admin:        'Super Admin',
    central_office:     'Central Office',
    college_admin:      'College Admin',
    department_head:    'Dept. Head',
    pi:                 'Principal Investigator',
    reviewer:           'Reviewer',
    finance:            'Finance Officer',
    guest:              'Guest',
    staff:              'Staff',
    college_officer:    'College Officer',
    research_officer:   'Research Officer',
    community_officer:  'Community Officer',
    technology_officer: 'Technology Officer',
};

const ROLE_COLORS = {
    super_admin:        'bg-red-50 text-red-700 border border-red-200',
    central_office:     'bg-orange-50 text-orange-700 border border-orange-200',
    college_admin:      'bg-blue-50 text-blue-700 border border-blue-200',
    department_head:    'bg-slate-50 text-slate-700 border border-slate-200',
    reviewer:           'bg-purple-50 text-purple-700 border border-purple-200',
    pi:                 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    finance:            'bg-amber-50 text-amber-700 border border-amber-200',
    staff:              'bg-cyan-50 text-cyan-700 border border-cyan-200',
    college_officer:    'bg-teal-50 text-teal-700 border border-teal-200',
    research_officer:   'bg-indigo-50 text-indigo-700 border border-indigo-200',
    community_officer:  'bg-pink-50 text-pink-700 border border-pink-200',
    technology_officer: 'bg-violet-50 text-violet-700 border border-violet-200',
    guest:              'bg-gray-100 text-gray-600 border border-gray-200',
};

const STATUS_CONFIG = {
    active:    { label: 'Active',    icon: CheckCircle2,  cls: 'bg-green-50 text-green-700 border border-green-200' },
    inactive:  { label: 'Inactive',  icon: XCircle,       cls: 'bg-gray-100 text-gray-500 border border-gray-200'  },
    suspended: { label: 'Suspended', icon: AlertTriangle, cls: 'bg-red-50 text-red-600 border border-red-200'      },
};

const ROLE_GROUPS = [
    { label: 'Administration', roles: ['super_admin', 'central_office', 'college_admin', 'department_head'] },
    { label: 'Research',       roles: ['pi', 'staff', 'research_officer', 'community_officer', 'technology_officer'] },
    { label: 'Operations',     roles: ['reviewer', 'finance', 'college_officer', 'guest'] },
];

const AVATAR_GRADIENTS = [
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-violet-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-sky-600',
];

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
        name: '', email: '', password: '', role: 'pi',
        college_id: '', department_id: '', employee_id: '', phone: '', gender: '',
        ...initial,
    });
    const [departments, setDepartments] = useState([]);
    const [saving, setSaving]           = useState(false);
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

    const set    = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
                                    {ROLE_GROUPS.map(group => (
                                        <optgroup key={group.label} label={group.label}>
                                            {group.roles
                                                .filter(r => allRoles.includes(r))
                                                .map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)
                                            }
                                        </optgroup>
                                    ))}
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
                    {ROLE_GROUPS.map(group => {
                        const groupRoles = group.roles.filter(r => allRoles.includes(r));
                        if (!groupRoles.length) return null;
                        return (
                            <div key={group.label}>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                    {group.label}
                                </p>
                                <div className="space-y-1">
                                    {groupRoles.map(role => {
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
                                                    <span className={cn(
                                                        'text-sm font-medium',
                                                        isOn ? 'text-indigo-700' : 'text-gray-700'
                                                    )}>
                                                        {ROLE_LABELS[role] ?? role}
                                                    </span>
                                                </div>
                                                {isOn && (
                                                    <span className={cn('text-xs px-2 py-0.5 rounded-full', ROLE_COLORS[role] ?? ROLE_COLORS.guest)}>
                                                        Active
                                                    </span>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsers() {
    const { hasRole }       = useAuth();
    const { success, error } = useToast();
    const isSuperAdmin      = hasRole('super_admin');

    const [users, setUsers]           = useState([]);
    const [meta,  setMeta]            = useState(null);
    const [page,  setPage]            = useState(1);
    const [colleges, setColleges]     = useState([]);
    const [allRoles, setAllRoles]     = useState(Object.keys(ROLE_LABELS));
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [createModal,   setCreateModal]   = useState(false);
    const [editModal,     setEditModal]     = useState(null);
    const [assignModal,   setAssignModal]   = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [statusConfirm, setStatusConfirm] = useState(null);

    const searchTimer = useRef(null);
    const [searchInput, setSearchInput] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        get('/users', { search, role: roleFilter, status: statusFilter, page })
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
    }, [search, roleFilter, statusFilter, page]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        api.get('/colleges').then(r => setColleges(r.data?.data ?? [])).catch(() => {});
        api.get('/roles').then(r => {
            const names = (r.data?.data ?? []).map(ro => ro.name);
            if (names.length) setAllRoles(names);
        }).catch(() => {});
    }, []);

    const handleSearchInput = (val) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
    };

    const handleCreate      = async (form) => { await api.post('/users', form); success('User created.'); setCreateModal(false); load(); };
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

    const hasFilters = search || roleFilter || statusFilter;

    return (
        <AppLayout breadcrumb="Users">
            <div className="max-w-7xl mx-auto space-y-5 pb-8">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <UsersIcon size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Users</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {meta ? `${meta.total.toLocaleString()} total users` : 'Manage system users, roles and access'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} disabled={loading}
                            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                        {isSuperAdmin && (
                            <button onClick={() => setCreateModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm
                                           font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors">
                                <Plus size={15} /> Add User
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Filters ─────────────────────────────────────────────── */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <Filter size={14} className="text-gray-400 shrink-0" />

                        <div className="relative flex-1 min-w-48">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={searchInput}
                                onChange={e => handleSearchInput(e.target.value)}
                                placeholder="Search name or email…"
                                className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                            className="py-2 px-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">All Roles</option>
                            {allRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                        </select>

                        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                            className="py-2 px-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                        </select>

                        {hasFilters && (
                            <button onClick={() => { setSearch(''); setSearchInput(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}
                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors">
                                <X size={12} /> Clear
                            </button>
                        )}
                    </div>
                </div>

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
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <UsersIcon size={36} className="text-gray-200 mb-3" />
                            <p className="text-sm font-medium text-gray-500">No users found</p>
                            {hasFilters && (
                                <button onClick={() => { setSearch(''); setSearchInput(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}
                                    className="mt-2 text-xs text-indigo-600 hover:underline">Clear filters</button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Table header */}
                            <div className="grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_1fr_auto] items-center
                                            gap-4 px-5 py-3 bg-gray-50/80 border-b border-gray-100
                                            text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                <span>User</span>
                                <span>Role</span>
                                <span>College</span>
                                <span>Status</span>
                                <span>Joined</span>
                                <span />
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-gray-50">
                                {users.map(u => {
                                    const primaryRole = (u.roles ?? [])[0];
                                    const roleName    = primaryRole
                                        ? (typeof primaryRole === 'string' ? primaryRole : primaryRole.name)
                                        : null;

                                    return (
                                        <div key={u.id}
                                            className="grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_1fr_auto] items-center
                                                       gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors group">
                                            {/* User */}
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Avatar user={u} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
                                                        {u.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                                    {u.employee_id && (
                                                        <p className="text-[10px] text-gray-300 font-mono mt-0.5">{u.employee_id}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Role */}
                                            <RoleBadge role={primaryRole} />

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

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link href={`/admin/users/${u.id}`}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="View profile">
                                                    <Eye size={13} />
                                                </Link>
                                                <button onClick={() => setEditModal(u)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit user">
                                                    <Pencil size={13} />
                                                </button>
                                                {isSuperAdmin && (
                                                    <>
                                                        <button onClick={() => setAssignModal(u)}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Assign roles">
                                                            <ShieldCheck size={13} />
                                                        </button>
                                                        {(u.status ?? 'active') === 'active' ? (
                                                            <button onClick={() => setStatusConfirm({ user: u, newStatus: 'inactive' })}
                                                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="Deactivate">
                                                                <UserX size={13} />
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => setStatusConfirm({ user: u, newStatus: 'active' })}
                                                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                title="Activate">
                                                                <UserCheck size={13} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => setDeleteConfirm(u)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete user">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </>
                                                )}
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
                        email:         editModal.email,
                        role:          (() => { const r = (editModal.roles ?? [])[0]; return r ? (typeof r === 'string' ? r : r.name) : 'guest'; })(),
                        college_id:    editModal.college_id    ?? editModal.college?.id    ?? '',
                        department_id: editModal.department_id ?? editModal.department?.id ?? '',
                        employee_id:   editModal.employee_id   ?? '',
                        phone:         editModal.phone         ?? '',
                        gender:        editModal.gender        ?? '',
                        id:            editModal.id,
                    }}
                    colleges={colleges} allRoles={allRoles}
                    onSave={handleEdit} onClose={() => setEditModal(null)} />
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
        </AppLayout>
    );
}
