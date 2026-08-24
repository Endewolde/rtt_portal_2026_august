import { useState, useEffect, useRef } from 'react';
import {
    ShieldCheck, Plus, Trash2, RefreshCw, Save,
    Pencil, Check, X, Users, Lock, Unlock, Search,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { cn } from '../../lib/utils';

// Roles the backend protects from delete/rename
const SYSTEM_ROLES = [
    'admin', 'central_officer', 'research_officer', 'community_officer',
    'technology_officer', 'college_officer', 'finance_officer', 'support_officer', 'staff',
];

const ROLE_DESCRIPTIONS = {
    admin:              'High-level access to users, roles, settings, and all proposals.',
    central_officer:    'Cross-college oversight for proposals, reviews, and budget.',
    college_officer:    'Assigns reviewers and manages workflow for their assigned college.',
    finance_officer:    'Approves and disburses budget requests scoped to their college.',
    research_officer:   'Manages research proposals across all colleges.',
    community_officer:  'Manages community engagement proposals.',
    technology_officer: 'Manages technology transfer proposals.',
    support_officer:    'Handles disbursements, settlements, and finance support tasks.',
    staff:              'Creates and submits proposals, participates in reviews.',
    guest:              'Read-only access to public content.',
};

const ROLE_GRADIENTS = {
    admin:              'from-rose-500 to-pink-600',
    central_officer:    'from-violet-500 to-purple-600',
    college_officer:    'from-teal-500 to-emerald-600',
    finance_officer:    'from-amber-500 to-yellow-500',
    research_officer:   'from-indigo-500 to-blue-600',
    community_officer:  'from-pink-500 to-fuchsia-600',
    technology_officer: 'from-cyan-500 to-sky-600',
    support_officer:    'from-orange-400 to-amber-500',
    staff:              'from-emerald-500 to-teal-600',
    guest:              'from-gray-400 to-gray-500',
    default:            'from-slate-500 to-gray-600',
};

// Resources and the actions that exist for each
const RESOURCE_ORDER = [
    'proposals', 'proposal_calls', 'proposal_ai_scores', 'reviews', 'review_assignments',
    'reviewer_match', 'defence_sessions',
    'budget_requests', 'budget_allocations', 'budget_milestones', 'disbursements', 'settlements',
    'midterm_evaluations', 'completion_workshops', 'research_outputs', 'research_impacts',
    'repository', 'reports', 'complaints', 'users', 'roles', 'colleges',
    'departments', 'lookup_options', 'settings', 'awards', 'external_funds',
    'audit_logs', 'system_monitor', 'features',
];

export default function Roles() {
    const { success, error } = useToast();

    const [roles, setRoles]         = useState([]);
    const [permissions, setPerms]   = useState([]);
    const [selectedRole, setSelected] = useState(null);
    const [selectedPerms, setSelPerms] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    const [search, setSearch]       = useState('');

    // Create
    const [newName, setNewName]     = useState('');
    const [creating, setCreating]   = useState(false);

    // Rename
    const [editId, setEditId]       = useState(null);
    const [editName, setEditName]   = useState('');
    const renameRef                 = useRef(null);

    // Delete
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        if (editId && renameRef.current) {
            renameRef.current.focus();
            renameRef.current.select();
        }
    }, [editId]);

    const load = async () => {
        setLoading(true);
        try {
            const [rRes, pRes] = await Promise.all([api.get('/roles'), api.get('/permissions')]);
            const loaded = (rRes.data?.data ?? []).filter(r => r.name !== 'super_admin');
            setRoles(Array.isArray(loaded) ? loaded : []);
            setPerms(Array.isArray(pRes.data?.data) ? pRes.data.data : []);
        } catch (e) {
            error('Failed to load: ' + (e.response?.data?.message ?? e.message));
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const selectRole = async (role) => {
        if (editId) return;
        setSelected(role);
        try {
            const res = await api.get(`/roles/${role.id}/permissions`);
            setSelPerms(res.data?.data ?? []);
        } catch { error('Failed to load permissions.'); }
    };

    const savePerms = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            await api.put(`/roles/${selectedRole.id}/permissions`, { permissions: selectedPerms });
            success('Permissions saved.');
            load();
        } catch (e) { error(e.response?.data?.message || 'Failed to save.'); }
        setSaving(false);
    };

    const createRole = async () => {
        const name = newName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!name) return;
        setCreating(true);
        try {
            const res = await api.post('/roles', { name });
            success(`Role "${name}" created.`);
            setNewName('');
            await load();
            // Auto-select the new role
            if (res.data?.data) selectRole(res.data.data);
        } catch (e) { error(e.response?.data?.message || 'Failed to create role.'); }
        setCreating(false);
    };

    const startRename = (e, role) => {
        e.stopPropagation();
        setEditId(role.id);
        setEditName(role.name);
    };

    const cancelRename = () => { setEditId(null); setEditName(''); };

    const confirmRename = async (role) => {
        const name = editName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!name || name === role.name) { cancelRename(); return; }
        try {
            await api.put(`/roles/${role.id}`, { name });
            success(`Renamed to "${name}".`);
            if (selectedRole?.id === role.id) setSelected(r => ({ ...r, name }));
            load();
        } catch (e) { error(e.response?.data?.message || 'Rename failed.'); }
        setEditId(null);
    };

    const deleteRole = async () => {
        try {
            await api.delete(`/roles/${deleteTarget.id}`);
            success('Role deleted.');
            if (selectedRole?.id === deleteTarget.id) setSelected(null);
            load();
        } catch (e) { error(e.response?.data?.message || 'Cannot delete role.'); }
        setDeleteTarget(null);
    };

    const refreshPerms = async () => {
        try {
            await api.post('/permissions/refresh');
            success('Permissions refreshed from seeder.');
            load();
        } catch (e) { error(e.response?.data?.message || 'Refresh failed.'); }
    };

    const togglePerm  = (name) => setSelPerms(p => p.includes(name) ? p.filter(x => x !== name) : [...p, name]);
    const toggleGroup = (perms, on) => {
        const names = perms.map(p => p.name);
        setSelPerms(prev => on ? [...new Set([...prev, ...names])] : prev.filter(p => !names.includes(p)));
    };

    // Group permissions by resource in the defined order
    const grouped = permissions.reduce((acc, p) => {
        const res = p.name.split('.')[0];
        if (!acc[res]) acc[res] = [];
        acc[res].push(p);
        return acc;
    }, {});

    const resourceOrder = [...RESOURCE_ORDER.filter(r => grouped[r]), ...Object.keys(grouped).filter(r => !RESOURCE_ORDER.includes(r)).sort()];

    const isSystem = (name) => SYSTEM_ROLES.includes(name);

    const filteredRoles = roles.filter(r =>
        !search || r.name.includes(search.toLowerCase()) || r.name.replace(/_/g, ' ').includes(search.toLowerCase())
    );

    const totalPermsSelected = selectedPerms.length;
    const totalPermsAvailable = permissions.length;

    return (
        <AppLayout breadcrumb="Roles & Permissions">
            <div className="max-w-7xl mx-auto space-y-5">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                                <ShieldCheck size={18} className="text-white" />
                            </div>
                            Roles &amp; Permissions
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {roles.length} roles · {permissions.length} permissions
                        </p>
                    </div>
                    <button onClick={refreshPerms}
                        className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
                        <RefreshCw size={14} /> Refresh Permissions
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">

                    {/* ── Left: role list ──────────────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">

                        {/* Search */}
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                                <Search size={13} className="text-gray-400 shrink-0" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search roles…"
                                    className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
                                />
                                {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
                            </div>
                        </div>

                        {/* List */}
                        {loading ? (
                            <div className="p-6 space-y-3">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 animate-pulse">
                                        <div className="h-9 w-9 rounded-xl bg-gray-100 shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3 w-28 bg-gray-100 rounded" />
                                            <div className="h-2.5 w-40 bg-gray-100 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50 overflow-y-auto max-h-130">
                                {filteredRoles.map(role => {
                                    const isSelected = selectedRole?.id === role.id;
                                    const gradient   = ROLE_GRADIENTS[role.name] ?? ROLE_GRADIENTS.default;
                                    const system     = isSystem(role.name);

                                    return (
                                        <div
                                            key={role.id}
                                            onClick={() => selectRole(role)}
                                            className={cn(
                                                'group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                                                isSelected ? 'bg-indigo-50 border-l-[3px] border-l-indigo-600' : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'
                                            )}
                                        >
                                            {/* Gradient avatar */}
                                            <div className={cn(
                                                `h-9 w-9 rounded-xl bg-linear-to-br ${gradient} shrink-0`,
                                                'flex items-center justify-center text-white text-xs font-bold shadow-sm'
                                            )}>
                                                {role.name.slice(0, 2).toUpperCase()}
                                            </div>

                                            {/* Name / inline edit */}
                                            <div className="flex-1 min-w-0">
                                                {editId === role.id ? (
                                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            ref={renameRef}
                                                            value={editName}
                                                            onChange={e => setEditName(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') confirmRename(role);
                                                                if (e.key === 'Escape') cancelRename();
                                                            }}
                                                            className="flex-1 border border-indigo-400 rounded-lg px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-0"
                                                        />
                                                        <button onClick={() => confirmRename(role)} className="p-0.5 text-green-600 hover:text-green-700 shrink-0">
                                                            <Check size={13} />
                                                        </button>
                                                        <button onClick={cancelRename} className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0">
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className={cn('text-sm font-semibold capitalize truncate', isSelected ? 'text-indigo-800' : 'text-gray-800')}>
                                                        {role.name.replace(/_/g, ' ')}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-gray-400">
                                                        {role.permissions_count ?? 0} perms
                                                    </span>
                                                    <span className="text-gray-200">·</span>
                                                    <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                                        <Users size={9} /> {role.users_count ?? 0}
                                                    </span>
                                                    {system
                                                        ? <span className="flex items-center gap-0.5 text-[10px] text-gray-300"><Lock size={9} /> system</span>
                                                        : <span className="flex items-center gap-0.5 text-[10px] text-indigo-300"><Unlock size={9} /> custom</span>
                                                    }
                                                </div>
                                            </div>

                                            {/* Actions — only for non-system, non-editing */}
                                            {!system && editId !== role.id && (
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button
                                                        onClick={e => startRename(e, role)}
                                                        title="Rename"
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setDeleteTarget(role); }}
                                                        title="Delete"
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {filteredRoles.length === 0 && (
                                    <p className="px-4 py-8 text-sm text-center text-gray-400">
                                        {search ? 'No roles match your search.' : 'No roles found.'}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Create new role */}
                        <div className="px-4 py-4 border-t border-gray-100 bg-gray-50/50 mt-auto">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                                Create Custom Role
                            </p>
                            <div className="flex gap-2">
                                <input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && createRole()}
                                    placeholder="e.g. data_analyst"
                                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                                <button
                                    onClick={createRole}
                                    disabled={creating || !newName.trim()}
                                    className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200"
                                >
                                    {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1.5">
                                Spaces become underscores. Then assign permissions on the right.
                            </p>
                        </div>
                    </div>

                    {/* ── Right: permissions editor ────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            {selectedRole ? (
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        `h-8 w-8 rounded-xl bg-linear-to-br ${ROLE_GRADIENTS[selectedRole.name] ?? ROLE_GRADIENTS.default}`,
                                        'flex items-center justify-center text-white text-xs font-bold shrink-0'
                                    )}>
                                        {selectedRole.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-bold text-gray-900 capitalize truncate">
                                            {selectedRole.name.replace(/_/g, ' ')}
                                        </h2>
                                        <p className="text-[10px] text-gray-400">
                                            {totalPermsSelected} / {totalPermsAvailable} permissions enabled
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">← Select a role to manage its permissions</p>
                            )}
                            {selectedRole && (
                                <button
                                    onClick={savePerms}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm shadow-indigo-200 shrink-0"
                                >
                                    <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                                </button>
                            )}
                        </div>

                        {/* Permission progress bar */}
                        {selectedRole && (
                            <div className="px-5 py-2 border-b border-gray-50 bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                            style={{ width: `${totalPermsAvailable ? (totalPermsSelected / totalPermsAvailable) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                                        {Math.round(totalPermsAvailable ? (totalPermsSelected / totalPermsAvailable) * 100 : 0)}%
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Permissions grid */}
                        {!selectedRole ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
                                <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                                    <ShieldCheck size={28} className="text-indigo-300" />
                                </div>
                                <p className="text-sm font-semibold text-gray-500">No role selected</p>
                                <p className="text-xs text-gray-400 mt-1">Click a role on the left to view and edit its permissions.</p>
                            </div>
                        ) : (
                            <div className="p-5 overflow-y-auto max-h-[calc(100vh-240px)]">
                                {resourceOrder.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-sm text-gray-400">No permissions found.</p>
                                        <button onClick={refreshPerms} className="mt-2 text-xs text-indigo-600 hover:underline">
                                            Refresh from seeder
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {resourceOrder.map(resource => {
                                            const perms      = grouped[resource] ?? [];
                                            const allOn      = perms.every(p => selectedPerms.includes(p.name));
                                            const someOn     = perms.some(p => selectedPerms.includes(p.name));
                                            const onCount    = perms.filter(p => selectedPerms.includes(p.name)).length;

                                            return (
                                                <div key={resource}
                                                    className={cn(
                                                        'rounded-xl border p-3.5 transition-colors',
                                                        someOn ? 'border-indigo-100 bg-indigo-50/40' : 'border-gray-100 bg-gray-50/30'
                                                    )}
                                                >
                                                    {/* Resource header */}
                                                    <div className="flex items-center gap-2 mb-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={allOn}
                                                            ref={el => el && (el.indeterminate = !allOn && someOn)}
                                                            onChange={e => toggleGroup(perms, e.target.checked)}
                                                            className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 shrink-0"
                                                        />
                                                        <span className="text-xs font-bold text-gray-700 capitalize flex-1">
                                                            {resource.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className={cn(
                                                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                                            onCount > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
                                                        )}>
                                                            {onCount}/{perms.length}
                                                        </span>
                                                    </div>

                                                    {/* Action checkboxes */}
                                                    <div className="flex flex-wrap gap-1.5 pl-5">
                                                        {perms.map(p => {
                                                            const action = p.name.split('.').slice(1).join('.');
                                                            const on     = selectedPerms.includes(p.name);
                                                            return (
                                                                <button
                                                                    key={p.name}
                                                                    onClick={() => togglePerm(p.name)}
                                                                    className={cn(
                                                                        'text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors capitalize',
                                                                        on
                                                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                                                            : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                                                                    )}
                                                                >
                                                                    {action}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {deleteTarget && (
                <ConfirmDialog
                    open
                    title="Delete Role"
                    description={`Permanently delete "${deleteTarget.name}"? Users assigned this role will lose it immediately.`}
                    confirmLabel="Delete"
                    onConfirm={deleteRole}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </AppLayout>
    );
}
