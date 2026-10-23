import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Trash2, RefreshCw, Search, X, Users, CheckCircle, AlertCircle } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';

function StatCard({ label, value, icon: Icon, color, sub }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={22} className="text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
                {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}

function DeptModal({ dept, colleges, lockedCollegeId, onSave, onClose }) {
    const [form, setForm] = useState(
        dept
            ? { college_id: dept.college_id, name: dept.name, code: dept.code, status: dept.status }
            : { college_id: lockedCollegeId ?? '', name: '', code: '', status: 'active' }
    );
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const save = async () => {
        if (!form.college_id || !form.name || !form.code) {
            error('College, name and code are required.');
            return;
        }
        setSaving(true);
        try {
            if (dept) {
                await api.put(`/departments/${dept.id}`, form);
                success('Department updated.');
            } else {
                await api.post('/departments', form);
                success('Department created.');
            }
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to save department.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900">
                        {dept ? 'Edit Department' : 'New Department'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            College <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.college_id}
                            onChange={e => set('college_id', e.target.value)}
                            disabled={!!lockedCollegeId}
                            className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <option value="">— Select college —</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="e.g. Computer Science"
                            className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={form.code}
                            onChange={e => set('code', e.target.value.toUpperCase())}
                            placeholder="e.g. CS"
                            className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition"
                        />
                    </div>
                    {dept && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                            <div className="flex gap-3">
                                {['active', 'inactive'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => set('status', s)}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                                            form.status === s
                                                ? s === 'active'
                                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                                    : 'bg-gray-100 border-gray-400 text-gray-700'
                                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                    >
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 px-6 pb-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium transition">
                        Cancel
                    </button>
                    <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition">
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Departments() {
    const { error, success } = useToast();
    const { user: currentUser, hasPermission, accessScope } = useAuth();
    const isCollegeOfficer = accessScope.type === 'college';
    const [departments, setDepartments] = useState([]);
    const [colleges, setColleges]       = useState([]);
    const [loading, setLoading]         = useState(true);
    // College officers are already scoped to their own college server-side —
    // pre-select it so there's no "All Colleges" picker implying they could
    // manage anyone else's departments.
    const [filterCollege, setFilterCollege] = useState(() => (isCollegeOfficer ? currentUser?.college_id ?? '' : ''));
    const [search, setSearch]           = useState('');
    const [modal, setModal]             = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [dRes, cRes] = await Promise.all([
                api.get('/departments', { params: filterCollege ? { college_id: filterCollege } : {} }),
                api.get('/colleges'),
            ]);
            setDepartments(dRes.data?.data ?? []);
            setColleges(cRes.data?.data ?? []);
        } catch {
            error('Failed to load departments.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filterCollege]);

    const afterSave = () => { setModal(null); load(); };

    const handleDelete = async () => {
        try {
            await api.delete(`/departments/${deleteConfirm.id}`);
            success('Department deleted.');
            setDeleteConfirm(null);
            load();
        } catch (err) {
            error(err.response?.data?.message || 'Failed to delete department.');
            setDeleteConfirm(null);
        }
    };

    const filtered = departments.filter((d) =>
        !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase())
    );

    const grouped = filtered.reduce((acc, d) => {
        const key = d.college?.name ?? 'Unknown';
        if (!acc[key]) { acc[key] = { college: d.college, items: [] }; }
        acc[key].items.push(d);
        return acc;
    }, {});

    const activeCount   = departments.filter(d => d.status === 'active').length;
    const inactiveCount = departments.filter(d => d.status !== 'active').length;

    return (
        <AppLayout breadcrumb="Departments">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center flex-wrap justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <Building2 size={24} className="text-blue-600" /> Departments
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {isCollegeOfficer
                                ? `${departments.length} department${departments.length !== 1 ? 's' : ''}`
                                : `${departments.length} departments across ${Object.keys(grouped).length} colleges`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                            <RefreshCw size={14} /> Refresh
                        </button>
                        {!isCollegeOfficer && (
                            <button
                                onClick={() => setModal({ dept: null })}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200"
                            >
                                <Plus size={14} /> Add Department
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats — college officers just get their own total; the active/inactive
                    breakdown and cross-college framing aren't relevant to a single college. */}
                {isCollegeOfficer ? (
                    <StatCard label="Total Departments" value={departments.length} icon={Building2} color="bg-blue-500" />
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <StatCard label="Total Departments" value={departments.length} icon={Building2}     color="bg-blue-500" />
                        <StatCard label="Active"            value={activeCount}        icon={CheckCircle}   color="bg-emerald-500" />
                        <StatCard label="Inactive"          value={inactiveCount}      icon={AlertCircle}   color="bg-amber-400" />
                    </div>
                )}

                {/* Filters */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-blue-500 shadow-sm flex-1">
                        <Search size={15} className="text-gray-400 shrink-0" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search departments by name or code…"
                            className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {!isCollegeOfficer && (
                        <select
                            value={filterCollege}
                            onChange={e => setFilterCollege(e.target.value)}
                            className="border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-gray-700"
                        >
                            <option value="">All Colleges</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : Object.keys(grouped).length === 0 ? (
                    <div className="bg-white border border-gray-100 rounded-2xl p-14 text-center shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                            <Building2 size={28} className="text-blue-300" />
                        </div>
                        <p className="text-gray-600 font-medium">No departments found</p>
                        <p className="text-sm text-gray-400 mt-1">
                            {search || filterCollege ? 'Try adjusting your filters.' : 'Add departments to get started.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {Object.entries(grouped).map(([collegeName, { college, items: depts }]) => (
                            <div key={collegeName} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                {/* College header — omitted for college officers, who only ever
                                    have one group here; the college name/code is redundant. */}
                                {!isCollegeOfficer && (
                                    <div className="px-5 py-3.5 bg-linear-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                                <Building2 size={15} className="text-white" />
                                            </div>
                                            <div>
                                                <h2 className="text-sm font-semibold text-gray-800">{collegeName}</h2>
                                                <p className="text-[10px] text-gray-400">{depts.length} department{depts.length !== 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-mono text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">
                                            {college?.code ?? '—'}
                                        </span>
                                    </div>
                                )}

                                {/* Departments table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-gray-400 uppercase border-b border-gray-50">
                                                <th className="px-5 py-2.5 text-left font-medium w-10">#</th>
                                                <th className="px-5 py-2.5 text-left font-medium">Name</th>
                                                <th className="px-5 py-2.5 text-left font-medium">Code</th>
                                                <th className="px-5 py-2.5 text-left font-medium">Status</th>
                                                <th className="px-5 py-2.5" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {depts.map((d, i) => (
                                                <tr key={d.id} className="hover:bg-blue-50/30 transition-colors group">
                                                    <td className="px-5 py-3 text-xs font-medium text-gray-400 tabular-nums w-10">{i + 1}</td>
                                                    <td className="px-5 py-3">
                                                        <span className="font-semibold text-gray-900">{d.name}</span>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{d.code}</span>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
                                                            d.status === 'active'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-gray-100 text-gray-500'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                            {d.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                                                            <button
                                                                onClick={() => setModal({ dept: d })}
                                                                className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                            {hasPermission('colleges.delete') && (
                                                                <button
                                                                    onClick={() => setDeleteConfirm(d)}
                                                                    className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modal !== null && (
                <DeptModal
                    dept={modal.dept}
                    colleges={colleges}
                    lockedCollegeId={isCollegeOfficer ? currentUser?.college_id : null}
                    onSave={afterSave}
                    onClose={() => setModal(null)}
                />
            )}
            {deleteConfirm && (
                <ConfirmDialog
                    open
                    title="Delete Department"
                    description={`Permanently delete "${deleteConfirm.name}"? This cannot be undone.`}
                    confirmLabel="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </AppLayout>
    );
}
