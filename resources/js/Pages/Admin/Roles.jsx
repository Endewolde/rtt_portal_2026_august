import { useState, useEffect, useMemo } from 'react';
import {
    ShieldCheck, Plus, Trash2, RefreshCw, Save, Copy, Users, Lock, Search, X,
    ChevronDown, ChevronRight, Globe, Building2, Tag, User as UserIcon, Undo2, Info,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { cn } from '../../lib/utils';

const SCOPE_ICONS = { all: Globe, college: Building2, college_if_set: Building2, category: Tag, own: UserIcon };

const SCOPE_STYLES = {
    all:            'bg-violet-50 text-violet-700 ring-violet-200',
    college:        'bg-teal-50 text-teal-700 ring-teal-200',
    college_if_set: 'bg-teal-50 text-teal-700 ring-teal-200',
    category:       'bg-amber-50 text-amber-700 ring-amber-200',
    own:            'bg-gray-50 text-gray-600 ring-gray-200',
};

const emptyForm = { label: '', name: '', description: '', scope: 'own', scope_category: '', clone_from: '' };

const toSystemName = (label) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'r_$1');

function ScopeBadge({ role, catalog, compact = false }) {
    const Icon = SCOPE_ICONS[role.scope] ?? UserIcon;
    const scope = catalog?.scopes.find(s => s.value === role.scope);
    const category = catalog?.categories.find(c => c.value === role.scope_category);
    const text = role.scope === 'category' && category ? category.label : (scope?.label ?? role.scope);

    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full ring-1 ring-inset font-medium max-w-full',
            compact ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs', SCOPE_STYLES[role.scope] ?? SCOPE_STYLES.own)}>
            <Icon size={compact ? 9 : 11} className="shrink-0" />
            <span className="truncate">{text}</span>
        </span>
    );
}

function ScopeFields({ form, setForm, catalog, disabled = false }) {
    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Data scope</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {catalog.scopes.map(scope => {
                        const Icon = SCOPE_ICONS[scope.value] ?? UserIcon;
                        const on = form.scope === scope.value;
                        return (
                            <button key={scope.value} type="button" disabled={disabled}
                                onClick={() => setForm(f => ({ ...f, scope: scope.value }))}
                                className={cn('text-left rounded-xl border p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                    on ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300 bg-white')}>
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                                    <Icon size={12} className={on ? 'text-indigo-600' : 'text-gray-400'} /> {scope.label}
                                </span>
                                <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">{scope.description}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            {form.scope === 'category' && (
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
                    <select value={form.scope_category ?? ''} disabled={disabled}
                        onChange={e => setForm(f => ({ ...f, scope_category: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Choose a category…</option>
                        {catalog.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                </div>
            )}
        </div>
    );
}

function CreateRoleModal({ open, initial, roles, catalog, onClose, onCreated }) {
    const { error } = useToast();
    const [form, setForm] = useState(emptyForm);
    const [nameTouched, setNameTouched] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setForm({ ...emptyForm, ...initial });
            setNameTouched(false);
        }
    }, [open, initial]);

    if (!open) return null;

    const name = nameTouched ? form.name : toSystemName(form.label);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post('/roles', {
                label: form.label.trim(),
                name,
                description: form.description || null,
                scope: form.scope,
                scope_category: form.scope === 'category' ? form.scope_category : null,
                clone_from: form.clone_from || null,
            });
            onCreated(res.data?.data);
        } catch (err) {
            const errors = err.response?.data?.errors ?? {};
            error(Object.values(errors)[0]?.[0] ?? err.response?.data?.message ?? 'Could not create the role.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/40 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <form onSubmit={submit} onClick={e => e.stopPropagation()}
                className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">{form.clone_from ? 'Copy role' : 'New role'}</h2>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role name</label>
                        <input autoFocus required maxLength={100} value={form.label}
                            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                            placeholder="e.g. Data Analyst"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                            System name:
                            <input value={name} onChange={e => { setNameTouched(true); setForm(f => ({ ...f, name: e.target.value })); }}
                                className="font-mono text-gray-600 bg-gray-50 rounded px-1.5 py-0.5 border border-transparent focus:border-indigo-300 focus:outline-none min-w-0 flex-1" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description <span className="font-normal text-gray-400">(optional)</span></label>
                        <textarea rows={2} maxLength={500} value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="What people with this role do"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start with the permissions of</label>
                        <select value={form.clone_from} onChange={e => {
                            const source = roles.find(r => String(r.id) === e.target.value);
                            setForm(f => ({ ...f, clone_from: e.target.value, ...(source ? { scope: source.scope, scope_category: source.scope_category ?? '' } : {}) }));
                        }}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">No permissions (start empty)</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.label} ({r.permissions_count})</option>)}
                        </select>
                    </div>
                    <ScopeFields form={form} setForm={setForm} catalog={catalog} />
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="submit" disabled={saving || !form.label.trim() || !name || (form.scope === 'category' && !form.scope_category)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} Create role
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function Roles() {
    const { success, error } = useToast();

    const [roles, setRoles]           = useState([]);
    const [catalog, setCatalog]       = useState(null);
    const [loading, setLoading]       = useState(true);
    const [roleSearch, setRoleSearch] = useState('');

    const [selectedId, setSelectedId] = useState(null);
    const [savedPerms, setSavedPerms] = useState([]);
    const [perms, setPerms]           = useState([]);
    const [details, setDetails]       = useState(emptyForm);
    const [permSearch, setPermSearch] = useState('');
    const [onlyGranted, setOnlyGranted] = useState(false);
    const [collapsed, setCollapsed]   = useState({});
    const [saving, setSaving]         = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [createOpen, setCreateOpen]     = useState(false);
    const [createInitial, setCreateInitial] = useState(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const selectedRole = roles.find(r => r.id === selectedId) ?? null;
    const isSuper = selectedRole?.name === 'super_admin';

    const load = async () => {
        try {
            const [rRes, cRes] = await Promise.all([api.get('/roles'), api.get('/permissions/catalog')]);
            setRoles(rRes.data?.data ?? []);
            setCatalog(cRes.data?.data ?? null);
            return rRes.data?.data ?? [];
        } catch (e) {
            error('Failed to load roles: ' + (e.response?.data?.message ?? e.message));
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const selectRole = (role) => {
        if (!role) return;
        const names = (role.permissions ?? []).map(p => p.name);
        setSelectedId(role.id);
        setSavedPerms(names);
        setPerms(names);
        setDetails({
            label: role.label ?? '', description: role.description ?? '',
            scope: role.scope ?? 'own', scope_category: role.scope_category ?? '',
        });
    };

    const permsDirty = useMemo(() => {
        if (perms.length !== savedPerms.length) return true;
        const saved = new Set(savedPerms);
        return perms.some(p => !saved.has(p));
    }, [perms, savedPerms]);

    const detailsDirty = !!selectedRole && (
        details.label !== (selectedRole.label ?? '') ||
        (details.description ?? '') !== (selectedRole.description ?? '') ||
        details.scope !== selectedRole.scope ||
        (details.scope === 'category' && (details.scope_category ?? '') !== (selectedRole.scope_category ?? ''))
    );

    const dirty = permsDirty || detailsDirty;

    const trySelect = (role) => {
        if (dirty && role.id !== selectedId && !window.confirm('Discard unsaved changes to this role?')) return;
        selectRole(role);
    };

    const save = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            if (detailsDirty) {
                await api.put(`/roles/${selectedRole.id}`, {
                    label: details.label.trim(),
                    description: details.description || null,
                    scope: details.scope,
                    scope_category: details.scope === 'category' ? details.scope_category : null,
                });
            }
            if (permsDirty && !isSuper) {
                await api.put(`/roles/${selectedRole.id}/permissions`, { permissions: perms });
            }
            success('Role saved.');
            const fresh = await load();
            selectRole(fresh.find(r => r.id === selectedRole.id));
        } catch (e) {
            const errors = e.response?.data?.errors ?? {};
            error(Object.values(errors)[0]?.[0] ?? e.response?.data?.message ?? 'Could not save the role.');
        }
        setSaving(false);
    };

    const deleteRole = async () => {
        try {
            await api.delete(`/roles/${deleteTarget.id}`);
            success('Role deleted.');
            if (selectedId === deleteTarget.id) setSelectedId(null);
            load();
        } catch (e) { error(e.response?.data?.message || 'Could not delete the role.'); }
        setDeleteTarget(null);
    };

    const refreshPerms = async () => {
        setRefreshing(true);
        try {
            const res = await api.post('/permissions/refresh');
            success(res.data?.message ?? 'Permissions are up to date.');
            const fresh = await load();
            if (selectedRole && !dirty) selectRole(fresh.find(r => r.id === selectedRole.id));
        } catch (e) { error(e.response?.data?.message || 'Refresh failed.'); }
        setRefreshing(false);
    };

    const openCreate = (cloneFrom = null) => {
        setCreateInitial(cloneFrom ? {
            ...emptyForm,
            label: `${cloneFrom.label} (copy)`,
            clone_from: String(cloneFrom.id),
            scope: cloneFrom.scope, scope_category: cloneFrom.scope_category ?? '',
            description: cloneFrom.description ?? '',
        } : emptyForm);
        setCreateOpen(true);
    };

    const onCreated = async (role) => {
        setCreateOpen(false);
        success(`Role "${role?.label ?? role?.name}" created. Choose its permissions below.`);
        const fresh = await load();
        selectRole(fresh.find(r => r.id === role?.id));
    };

    const togglePerm = (name) => setPerms(p => p.includes(name) ? p.filter(x => x !== name) : [...p, name]);
    const setGroup = (names, on) => setPerms(prev => on ? [...new Set([...prev, ...names])] : prev.filter(p => !names.includes(p)));

    const permSet = useMemo(() => new Set(isSuper ? (catalog?.groups ?? []).flatMap(g => g.permissions.map(p => p.name)) : perms), [perms, isSuper, catalog]);
    const totalPerms = useMemo(() => (catalog?.groups ?? []).reduce((n, g) => n + g.permissions.length, 0), [catalog]);

    const visibleGroups = useMemo(() => {
        const q = permSearch.trim().toLowerCase();
        return (catalog?.groups ?? []).map(g => ({
            ...g,
            visible: g.permissions.filter(p =>
                (!q || p.label.toLowerCase().includes(q) || p.name.includes(q) || p.description.toLowerCase().includes(q)) &&
                (!onlyGranted || permSet.has(p.name))
            ),
        })).filter(g => g.visible.length > 0);
    }, [catalog, permSearch, onlyGranted, permSet]);

    const filteredRoles = roles.filter(r => {
        const q = roleSearch.trim().toLowerCase();
        return !q || (r.label ?? '').toLowerCase().includes(q) || r.name.includes(q);
    });
    const builtIn = filteredRoles.filter(r => r.is_system);
    const custom  = filteredRoles.filter(r => !r.is_system);

    const RoleRow = ({ role }) => {
        const on = role.id === selectedId;
        return (
            <button type="button" onClick={() => trySelect(role)}
                className={cn('w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-l-[3px]',
                    on ? 'bg-indigo-50 border-l-indigo-600' : 'border-l-transparent hover:bg-gray-50')}>
                <div className={cn('h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-bold',
                    role.is_system ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-700')}>
                    {(role.label ?? role.name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold truncate', on ? 'text-indigo-900' : 'text-gray-800')}>{role.label}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <ScopeBadge role={role} catalog={catalog} compact />
                        <span className="text-[10px] text-gray-400">{role.name === 'super_admin' ? 'all' : role.permissions_count} perms</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Users size={9} /> {role.users_count}</span>
                    </div>
                </div>
            </button>
        );
    };

    return (
        <AppLayout breadcrumb="Roles & Permissions">
            <div className="max-w-7xl mx-auto space-y-5">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <span className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                                <ShieldCheck size={18} className="text-white" />
                            </span>
                            Roles &amp; Permissions
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {roles.length} roles · {totalPerms} permissions. A role decides what people can do; its scope decides which records it applies to.
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={refreshPerms} disabled={refreshing} title="Add any new permissions. Never changes what roles already have."
                            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 bg-white rounded-xl text-sm text-gray-600 hover:bg-gray-50 shadow-sm disabled:opacity-60">
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Check for new permissions
                        </button>
                        <button onClick={() => openCreate()} disabled={!catalog}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 disabled:opacity-50">
                            <Plus size={14} /> New role
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">

                    {/* Role list */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:sticky lg:top-4">
                        <div className="p-3 border-b border-gray-100">
                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                                <Search size={13} className="text-gray-400 shrink-0" />
                                <input value={roleSearch} onChange={e => setRoleSearch(e.target.value)} placeholder="Search roles…"
                                    className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400 min-w-0" />
                            </div>
                        </div>
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="flex gap-3 animate-pulse">
                                        <div className="h-8 w-8 rounded-lg bg-gray-100" />
                                        <div className="flex-1 space-y-1.5"><div className="h-3 w-28 bg-gray-100 rounded" /><div className="h-2.5 w-40 bg-gray-100 rounded" /></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="max-h-[40vh] lg:max-h-[calc(100vh-220px)] overflow-y-auto">
                                {custom.length > 0 && (
                                    <>
                                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Custom roles</p>
                                        {custom.map(r => <RoleRow key={r.id} role={r} />)}
                                    </>
                                )}
                                {builtIn.length > 0 && (
                                    <>
                                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Built-in roles</p>
                                        {builtIn.map(r => <RoleRow key={r.id} role={r} />)}
                                    </>
                                )}
                                {filteredRoles.length === 0 && <p className="px-4 py-8 text-sm text-center text-gray-400">No roles match.</p>}
                            </div>
                        )}
                    </div>

                    {/* Editor */}
                    {!selectedRole || !catalog ? (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center px-6">
                            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                                <ShieldCheck size={26} className="text-indigo-300" />
                            </div>
                            <p className="text-sm font-semibold text-gray-600">Select a role</p>
                            <p className="text-xs text-gray-400 mt-1 max-w-sm">Pick a role to see and change its permissions and scope, or create a new one.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 min-w-0">
                            {/* Details */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg font-bold text-gray-900">{selectedRole.label}</h2>
                                            {selectedRole.is_system
                                                ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"><Lock size={9} /> Built-in</span>
                                                : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">Custom</span>}
                                        </div>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedRole.name} · {selectedRole.users_count} user{selectedRole.users_count === 1 ? '' : 's'}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => openCreate(selectedRole)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
                                            <Copy size={12} /> Copy
                                        </button>
                                        {!selectedRole.is_system && (
                                            <button onClick={() => setDeleteTarget(selectedRole)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">
                                                <Trash2 size={12} /> Delete
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Display name</label>
                                            <input value={details.label} maxLength={100} onChange={e => setDetails(d => ({ ...d, label: e.target.value }))}
                                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
                                            <textarea rows={3} maxLength={500} value={details.description ?? ''} onChange={e => setDetails(d => ({ ...d, description: e.target.value }))}
                                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                    </div>
                                    <ScopeFields form={details} setForm={setDetails} catalog={catalog} disabled={isSuper} />
                                </div>
                                {(details.scope === 'college' || details.scope === 'college_if_set') && (
                                    <p className="mt-3 flex items-start gap-1.5 text-[11px] text-gray-500">
                                        <Info size={12} className="mt-px shrink-0 text-gray-400" />
                                        The college comes from each user&apos;s profile — set it on the Users page when assigning this role.
                                    </p>
                                )}
                            </div>

                            {/* Permissions */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-gray-900">Permissions</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {isSuper ? 'Super Admin always holds every permission.' : `${permSet.size} of ${totalPerms} granted`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 flex-1 sm:w-56">
                                            <Search size={12} className="text-gray-400 shrink-0" />
                                            <input value={permSearch} onChange={e => setPermSearch(e.target.value)} placeholder="Find a permission…"
                                                className="flex-1 text-sm outline-none bg-transparent min-w-0" />
                                        </div>
                                        <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                                            <input type="checkbox" checked={onlyGranted} onChange={e => setOnlyGranted(e.target.checked)} className="rounded border-gray-300 text-indigo-600" />
                                            Granted only
                                        </label>
                                    </div>
                                </div>

                                <div className="divide-y divide-gray-100">
                                    {visibleGroups.map(group => {
                                        const names = group.permissions.map(p => p.name);
                                        const onCount = names.filter(n => permSet.has(n)).length;
                                        const allOn = onCount === names.length;
                                        const isCollapsed = collapsed[group.name] && !permSearch;
                                        return (
                                            <section key={group.name}>
                                                <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50/70 sticky top-0 z-1">
                                                    <button type="button" onClick={() => setCollapsed(c => ({ ...c, [group.name]: !c[group.name] }))}
                                                        className="flex items-center gap-1.5 flex-1 text-left min-w-0">
                                                        {isCollapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide truncate">{group.name}</span>
                                                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                                            onCount ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400')}>{onCount}/{names.length}</span>
                                                    </button>
                                                    {!isSuper && (
                                                        <button type="button" onClick={() => setGroup(names, !allOn)}
                                                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
                                                            {allOn ? 'Clear all' : 'Select all'}
                                                        </button>
                                                    )}
                                                </div>
                                                {!isCollapsed && (
                                                    <div className="grid grid-cols-1 xl:grid-cols-2">
                                                        {group.visible.map(p => {
                                                            const on = permSet.has(p.name);
                                                            const changed = !isSuper && on !== savedPerms.includes(p.name);
                                                            return (
                                                                <label key={p.name}
                                                                    className={cn('flex items-start gap-3 px-5 py-2.5 transition-colors',
                                                                        isSuper ? 'cursor-default' : 'cursor-pointer hover:bg-indigo-50/40',
                                                                        changed && 'bg-amber-50/60')}>
                                                                    <input type="checkbox" checked={on} disabled={isSuper} onChange={() => togglePerm(p.name)}
                                                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                                                                    <span className="min-w-0">
                                                                        <span className="block text-sm font-medium text-gray-800">{p.label}</span>
                                                                        {p.description && <span className="block text-xs text-gray-500 leading-snug">{p.description}</span>}
                                                                        <span className="block text-[10px] font-mono text-gray-400 mt-0.5 break-all">{p.name}</span>
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </section>
                                        );
                                    })}
                                    {visibleGroups.length === 0 && (
                                        <p className="px-5 py-10 text-sm text-center text-gray-400">No permissions match.</p>
                                    )}
                                </div>
                            </div>

                            {/* Save bar */}
                            {dirty && (
                                <div className="sticky bottom-4 z-10">
                                    <div className="bg-gray-900 text-white rounded-2xl shadow-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                                        <p className="text-sm flex-1">
                                            Unsaved changes
                                            {permsDirty && <span className="text-gray-400"> · {perms.filter(p => !savedPerms.includes(p)).length} added, {savedPerms.filter(p => !perms.includes(p)).length} removed</span>}
                                            {selectedRole.users_count > 0 && <span className="text-gray-400"> · affects {selectedRole.users_count} user{selectedRole.users_count === 1 ? '' : 's'}</span>}
                                        </p>
                                        <div className="flex gap-2">
                                            <button onClick={() => selectRole(selectedRole)}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-white/10">
                                                <Undo2 size={13} /> Discard
                                            </button>
                                            <button onClick={save} disabled={saving || !details.label.trim() || (details.scope === 'category' && !details.scope_category)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 rounded-xl text-sm font-semibold hover:bg-indigo-400 disabled:opacity-50">
                                                <Save size={13} /> {saving ? 'Saving…' : 'Save changes'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {catalog && (
                <CreateRoleModal open={createOpen} initial={createInitial} roles={roles} catalog={catalog}
                    onClose={() => setCreateOpen(false)} onCreated={onCreated} />
            )}

            {deleteTarget && (
                <ConfirmDialog
                    open
                    title="Delete role"
                    description={`Permanently delete "${deleteTarget.label}"? ${deleteTarget.users_count} user(s) holding it will lose it immediately.`}
                    confirmLabel="Delete"
                    onConfirm={deleteRole}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </AppLayout>
    );
}
