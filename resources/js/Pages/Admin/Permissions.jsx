import { useState, useEffect } from 'react';
import { Key, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { useToast } from '../../Components/Toast';
import api from '../../lib/api';

const ROLE_COLORS = {
    super_admin:     'bg-red-100 text-red-700',
    central_office:  'bg-blue-100 text-blue-700',
    college_admin:   'bg-green-100 text-green-700',
    reviewer:        'bg-purple-100 text-purple-700',
    pi:              'bg-orange-100 text-orange-700',
    finance:         'bg-yellow-100 text-yellow-700',
    department_head: 'bg-teal-100 text-teal-700',
    guest:           'bg-gray-100 text-gray-600',
};

export default function Permissions() {
    const { success, error } = useToast();
    const [permissions, setPermissions] = useState([]);
    const [roles, setRoles]             = useState([]);
    const [search, setSearch]           = useState('');
    const [expanded, setExpanded]       = useState({});
    const [loading, setLoading]         = useState(true);
    const [refreshing, setRefreshing]   = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [permRes, roleRes] = await Promise.all([
                api.get('/permissions'),
                api.get('/roles'),
            ]);
            const perms = permRes.data?.data ?? [];
            const roles = roleRes.data?.data ?? [];
            setPermissions(Array.isArray(perms) ? perms : []);
            setRoles(Array.isArray(roles) ? roles : []);
        } catch (e) {
            error('Failed to load permissions: ' + (e.response?.data?.message ?? e.message ?? 'Unknown error'));
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await api.post('/permissions/refresh');
            success(res.data?.message ?? 'Permissions are up to date.');
            await load();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to refresh permissions.');
        }
        setRefreshing(false);
    };

    const filtered = permissions.filter(
        p => !search || p.name.toLowerCase().includes(search.toLowerCase())
    );

    const grouped = filtered.reduce((acc, perm) => {
        const resource = perm.name.split('.')[0] ?? 'other';
        if (!acc[resource]) acc[resource] = [];
        acc[resource].push(perm);
        return acc;
    }, {});

    const rolesForPerm = (permName) =>
        roles.filter(r =>
            r.name === 'super_admin' ||
            (r.permissions ?? []).some(p => p.name === permName)
        );

    const toggle = (resource) =>
        setExpanded(prev => ({ ...prev, [resource]: !prev[resource] }));

    return (
        <AppLayout breadcrumb="Permissions">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Key size={22} className="text-blue-600" /> Permissions
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {permissions.length} permissions across {Object.keys(grouped).length} resources
                        </p>
                    </div>
                    <button onClick={handleRefresh} disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing…' : 'Refresh Permissions'}
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-5">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search permissions…"
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : Object.keys(grouped).length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <Key size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">No permissions found.</p>
                        <button onClick={handleRefresh} className="mt-3 text-sm text-blue-600 hover:underline">
                            Click Refresh Permissions to seed them
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {Object.entries(grouped).sort().map(([resource, perms]) => (
                            <div key={resource} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <button type="button" onClick={() => toggle(resource)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                            <Key size={14} className="text-blue-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-gray-900 capitalize">
                                                {resource.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-xs text-gray-400">{perms.length} permission{perms.length !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    {expanded[resource]
                                        ? <ChevronUp size={15} className="text-gray-400" />
                                        : <ChevronDown size={15} className="text-gray-400" />
                                    }
                                </button>

                                {expanded[resource] && (
                                    <div className="border-t border-gray-100">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-5 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-1/2">Permission</th>
                                                    <th className="px-5 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Roles with access</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {perms.map(perm => {
                                                    const grantedTo = rolesForPerm(perm.name);
                                                    return (
                                                        <tr key={perm.id} className="hover:bg-gray-50">
                                                            <td className="px-5 py-3">
                                                                <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                                                                    {perm.name}
                                                                </code>
                                                            </td>
                                                            <td className="px-5 py-3">
                                                                {grantedTo.length === 0 ? (
                                                                    <span className="text-xs text-gray-400 italic">No roles</span>
                                                                ) : (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {grantedTo.map(r => (
                                                                            <span key={r.id}
                                                                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r.name] ?? 'bg-gray-100 text-gray-700'}`}>
                                                                                {r.name.replace(/_/g, ' ')}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
