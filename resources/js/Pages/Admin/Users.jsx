import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users as UsersIcon, Search, Plus, Pencil, Trash2, ShieldCheck,
    UserCheck, UserX, Building2, Calendar, ChevronLeft, ChevronRight,
    X, Eye, Filter, RefreshCw, Mail, Phone, CreditCard,
    CheckCircle2, XCircle, AlertTriangle, User,
    Upload, Download, FileDown, FileUp, AlertCircle, CheckCircle,
    FileText, ChevronDown,
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

// ─── Import modal ─────────────────────────────────────────────────────────────

const EXPECTED_COLS = ['name', 'email', 'password', 'role', 'college_code', 'employee_id', 'phone', 'gender'];

const IMPORT_ROLE_LABELS = {
    super_admin: 'super_admin', admin: 'admin',
    staff: 'staff', reviewer: 'reviewer', pi: 'pi',
    college_officer: 'college_officer', research_officer: 'research_officer',
    community_officer: 'community_officer', technology_officer: 'technology_officer',
    central_officer: 'central_officer',
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

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden mb-10">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Upload size={16} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Import Users</h2>
                            <p className="text-xs text-gray-400">Upload a CSV file to bulk-create users</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

                    {/* Template download */}
                    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-indigo-800">Need a template?</p>
                            <p className="text-xs text-indigo-500 mt-0.5">
                                Download the CSV template with example rows and all required columns.
                            </p>
                        </div>
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shrink-0"
                        >
                            <FileDown size={13} /> Template
                        </button>
                    </div>

                    {/* Expected columns */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Expected CSV columns:</p>
                        <div className="flex flex-wrap gap-1.5">
                            {EXPECTED_COLS.map(c => (
                                <span key={c} className={`text-xs px-2 py-0.5 rounded-md font-mono font-medium ${
                                    c === 'name' || c === 'email' || c === 'role'
                                        ? 'bg-red-50 text-red-600 border border-red-200'
                                        : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {c}{(c === 'name' || c === 'email' || c === 'role') && ' *'}
                                </span>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5">
                            * required · <code className="font-mono">college_code</code> = college's short code (e.g. CBE) ·
                            password blank = random generated · duplicate emails are skipped
                        </p>
                    </div>

                    {/* Drop zone */}
                    {!result && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => fileRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                                dragOver
                                    ? 'border-indigo-400 bg-indigo-50'
                                    : file
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                            }`}
                        >
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={(e) => handleFile(e.target.files[0])}
                            />
                            {file ? (
                                <div className="flex flex-col items-center gap-2">
                                    <FileText size={28} className="text-emerald-500" />
                                    <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                                    <p className="text-xs text-gray-400">
                                        {(file.size / 1024).toFixed(1)} KB · Click to change
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload size={28} className="text-gray-300" />
                                    <p className="text-sm font-medium text-gray-500">
                                        Drag &amp; drop a CSV file here, or click to browse
                                    </p>
                                    <p className="text-xs text-gray-400">CSV only · max 2 MB</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Column mismatch warning */}
                    {preview && missingCols.length > 0 && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-semibold text-amber-700">Missing columns detected:</p>
                                <p className="text-xs text-amber-600 mt-0.5">
                                    {missingCols.map(c => <code key={c} className="font-mono mr-1">{c}</code>)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Preview table */}
                    {preview && !result && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">
                                Preview <span className="text-gray-300">(first {preview.rows.length} data rows)</span>
                            </p>
                            <div className="overflow-x-auto rounded-xl border border-gray-100">
                                <table className="min-w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            {preview.headers.map((h, i) => (
                                                <th key={i} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {preview.rows.map((row, ri) => (
                                            <tr key={ri} className="hover:bg-gray-50">
                                                {row.map((cell, ci) => (
                                                    <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-45 truncate">
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

                    {/* Result */}
                    {result && (
                        <div className="space-y-4">
                            {/* Summary cards */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Total',   val: result.summary.total,   color: 'bg-gray-50 text-gray-700 border-gray-200' },
                                    { label: 'Created', val: result.summary.created, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                    { label: 'Skipped', val: result.summary.skipped, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                                    { label: 'Errors',  val: result.summary.errors,  color: 'bg-red-50 text-red-700 border-red-200' },
                                ].map(({ label, val, color }) => (
                                    <div key={label} className={`border rounded-xl px-3 py-3 text-center ${color}`}>
                                        <p className="text-2xl font-bold leading-none">{val}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide mt-1">{label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Error list */}
                            {result.errors?.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                                        <AlertCircle size={12} /> Row errors:
                                    </p>
                                    <div className="border border-red-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                        <table className="min-w-full text-xs">
                                            <thead>
                                                <tr className="bg-red-50 border-b border-red-100">
                                                    <th className="px-3 py-2 text-left font-semibold text-red-500">Row</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-red-500">Email</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-red-500">Error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-50">
                                                {result.errors.map((e, i) => (
                                                    <tr key={i} className="bg-white">
                                                        <td className="px-3 py-2 font-mono text-gray-500">{e.row}</td>
                                                        <td className="px-3 py-2 text-gray-700">{e.email}</td>
                                                        <td className="px-3 py-2 text-red-600">{e.error}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                                className="text-xs text-indigo-600 hover:underline"
                            >
                                ← Import another file
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">
                        {preview && !result
                            ? `${preview.rows.length} preview rows shown`
                            : result
                            ? `${result.summary.created} users created`
                            : 'Select a CSV file to begin'}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                            {result ? 'Close' : 'Cancel'}
                        </button>
                        {!result && (
                            <button
                                onClick={doImport}
                                disabled={!file || importing || missingCols.some(c => ['name','email','role'].includes(c))}
                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold
                                           rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
    const [importModal,   setImportModal]   = useState(false);
    const [exporting,     setExporting]     = useState(false);

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

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            if (search)       params.set('search', search);
            if (roleFilter)   params.set('role', roleFilter);
            if (statusFilter) params.set('status', statusFilter);
            await downloadBlob(
                api.get(`/users/export?${params.toString()}`, { responseType: 'blob' }),
                `users_export_${new Date().toISOString().slice(0, 10)}.csv`
            );
        } catch { error('Export failed. Please try again.'); }
        setExporting(false);
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
                            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
                            title="Refresh">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>

                        {/* Export */}
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            title={hasFilters ? 'Export filtered users' : 'Export all users'}
                            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
                        >
                            {exporting
                                ? <RefreshCw size={14} className="animate-spin" />
                                : <Download size={14} />
                            }
                            Export
                            {hasFilters && <span className="text-[10px] bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded-full">filtered</span>}
                        </button>

                        {/* Import */}
                        {isSuperAdmin && (
                            <button
                                onClick={() => setImportModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
                            >
                                <Upload size={14} /> Import
                            </button>
                        )}

                        {/* Add user */}
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

            {importModal && (
                <ImportModal
                    onClose={() => setImportModal(false)}
                    onDone={() => { load(); }}
                />
            )}
        </AppLayout>
    );
}
