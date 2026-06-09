import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, RefreshCw, Save } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';

export default function Roles() {
    const { success, error } = useToast();
    const [roles, setRoles]               = useState([]);
    const [permissions, setPermissions]   = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [selectedPerms, setSelectedPerms] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [saving, setSaving]             = useState(false);
    const [newRoleName, setNewRoleName]   = useState('');
    const [creating, setCreating]         = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [rolesRes, permsRes] = await Promise.all([api.get('/roles'), api.get('/permissions')]);
            const roles = rolesRes.data?.data ?? [];
            const perms = permsRes.data?.data ?? [];
            setRoles(Array.isArray(roles) ? roles : []);
            setPermissions(Array.isArray(perms) ? perms : []);
        } catch (e) {
            error('Failed to load roles: ' + (e.response?.data?.message ?? e.message ?? 'Unknown error'));
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const selectRole = async (role) => {
        setSelectedRole(role);
        try {
            const res = await api.get(`/roles/${role.id}/permissions`);
            setSelectedPerms(res.data?.data ?? []);
        } catch { error('Failed to load permissions.'); }
    };

    const savePermissions = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            await api.put(`/roles/${selectedRole.id}/permissions`, { permissions: selectedPerms });
            success('Permissions updated.');
            load();
        } catch (e) { error(e.response?.data?.message || 'Failed to save.'); }
        setSaving(false);
    };

    const createRole = async () => {
        if (!newRoleName.trim()) return;
        setCreating(true);
        try {
            await api.post('/roles', { name: newRoleName.trim() });
            success('Role created.');
            setNewRoleName('');
            load();
        } catch (e) { error(e.response?.data?.message || 'Failed to create role.'); }
        setCreating(false);
    };

    const deleteRole = async (role) => {
        try {
            await api.delete(`/roles/${role.id}`);
            success('Role deleted.');
            if (selectedRole?.id === role.id) setSelectedRole(null);
            load();
        } catch (e) { error(e.response?.data?.message || 'Cannot delete role.'); }
    };

    const refreshPermissions = async () => {
        try {
            await api.post('/permissions/refresh');
            success('Permissions refreshed from seeder.');
            load();
        } catch (e) { error(e.response?.data?.message || 'Failed to refresh.'); }
    };

    const togglePerm = (name) => setSelectedPerms(p =>
        p.includes(name) ? p.filter(x => x !== name) : [...p, name]
    );

    const toggleGroup = (perms, checked) => {
        const names = perms.map(p => p.name);
        setSelectedPerms(prev =>
            checked
                ? [...new Set([...prev, ...names])]
                : prev.filter(p => !names.includes(p))
        );
    };

    // Group permissions by resource (e.g. "proposals.view" → "proposals")
    const grouped = permissions.reduce((acc, perm) => {
        const resource = perm.name.split('.')[0];
        if (!acc[resource]) acc[resource] = [];
        acc[resource].push(perm);
        return acc;
    }, {});

    const SYSTEM_ROLES = [
        'super_admin', 'central_office', 'college_admin', 'reviewer',
        'pi', 'finance', 'department_head', 'guest',
        'staff', 'college_officer', 'research_officer', 'community_officer', 'technology_officer',
    ];

    const ROLE_DESCRIPTIONS = {
        super_admin:        'Full system access. Can manage all users, roles, settings.',
        central_office:     'Manages all proposals across all colleges and categories.',
        college_admin:      'Manages proposals within their assigned college only.',
        department_head:    'Views proposals and reports for their department.',
        finance:            'Manages disbursements and settlements.',
        reviewer:           'Reviews assigned proposals and submits scores.',
        pi:                 'Principal Investigator — creates and submits proposals.',
        guest:              'Read-only access to public content.',
        staff:              'Can apply for proposals and review assigned proposals.',
        college_officer:    'Assigns reviewers and manages workflow for own college.',
        research_officer:   'Manages research proposals across all colleges.',
        community_officer:  'Manages community engagement proposals across all colleges.',
        technology_officer: 'Manages technology transfer proposals across all colleges.',
    };

    return (
        <AppLayout breadcrumb="Roles & Permissions">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ShieldCheck size={22} className="text-blue-600" /> Roles &amp; Permissions
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Manage roles and their permissions</p>
                    </div>
                    <button onClick={refreshPermissions}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        <RefreshCw size={14} /> Refresh Permissions
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: roles list */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-sm font-semibold text-gray-700">Roles</h2>
                        </div>

                        {loading ? (
                            <div className="p-4 text-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {roles.map(role => (
                                    <div key={role.id}
                                        onClick={() => selectRole(role)}
                                        className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors ${selectedRole?.id === role.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 capitalize">{role.name.replace(/_/g, ' ')}</p>
                                            <p className="text-xs text-gray-400">{role.permissions_count} perms · {role.users_count} users</p>
                                            {ROLE_DESCRIPTIONS[role.name] && (
                                                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{ROLE_DESCRIPTIONS[role.name]}</p>
                                            )}
                                        </div>
                                        {!SYSTEM_ROLES.includes(role.name) && (
                                            <button onClick={e => { e.stopPropagation(); deleteRole(role); }}
                                                className="p-1 text-gray-400 hover:text-red-600 rounded">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Create role */}
                        <div className="px-4 py-3 border-t border-gray-100">
                            <div className="flex gap-2">
                                <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                                    placeholder="New role name…"
                                    onKeyDown={e => e.key === 'Enter' && createRole()}
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button onClick={createRole} disabled={creating || !newRoleName.trim()}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: permissions */}
                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-700">
                                {selectedRole ? `Permissions for: ${selectedRole.name.replace(/_/g, ' ')}` : 'Select a role'}
                            </h2>
                            {selectedRole && (
                                <button onClick={savePermissions} disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                                    <Save size={13} /> {saving ? 'Saving…' : 'Save Permissions'}
                                </button>
                            )}
                        </div>

                        {!selectedRole ? (
                            <div className="p-12 text-center text-gray-400 text-sm">← Select a role to manage its permissions</div>
                        ) : (
                            <div className="p-4 overflow-y-auto max-h-150">
                                {Object.keys(grouped).length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">No permissions found. Click Refresh to load from seeder.</p>
                                ) : (
                                    <div className="space-y-5">
                                        {Object.entries(grouped).sort().map(([resource, perms]) => {
                                            const allChecked = perms.every(p => selectedPerms.includes(p.name));
                                            const someChecked = perms.some(p => selectedPerms.includes(p.name));
                                            return (
                                                <div key={resource}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <input type="checkbox"
                                                            checked={allChecked}
                                                            ref={el => el && (el.indeterminate = !allChecked && someChecked)}
                                                            onChange={e => toggleGroup(perms, e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 rounded" />
                                                        <label className="text-sm font-semibold text-gray-800 capitalize">{resource}</label>
                                                        <span className="text-xs text-gray-400">({perms.filter(p => selectedPerms.includes(p.name)).length}/{perms.length})</span>
                                                    </div>
                                                    <div className="ml-6 grid grid-cols-2 md:grid-cols-3 gap-1">
                                                        {perms.map(perm => (
                                                            <label key={perm.name} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                                                                <input type="checkbox"
                                                                    checked={selectedPerms.includes(perm.name)}
                                                                    onChange={() => togglePerm(perm.name)}
                                                                    className="w-3.5 h-3.5 text-blue-600 rounded" />
                                                                {perm.name.split('.').slice(1).join('.')}
                                                            </label>
                                                        ))}
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
        </AppLayout>
    );
}
