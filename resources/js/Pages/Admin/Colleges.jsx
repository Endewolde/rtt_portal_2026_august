import { useState, useEffect } from 'react';
import { Building, Building2, ChevronDown, ChevronRight, Plus, Search, RefreshCw, Users, X, Pencil, Trash2 } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post, put } from '../../lib/api';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';

function StatCard({ label, value, icon: Icon, color }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4 shadow-sm text-center sm:text-left">
            <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={18} className="text-white" />
            </div>
            <div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-[11px] sm:text-xs text-gray-500 mt-1">{label}</p>
            </div>
        </div>
    );
}

function CollegeModal({ title, form, setForm, errors, saving, onSave, onClose }) {
    const fields = [
        { key: 'name',       label: 'College Name',  required: true,  type: 'text' },
        { key: 'code',       label: 'Code',          required: true,  type: 'text' },
        { key: 'dean_name',  label: 'Dean Name',     required: false, type: 'text' },
        { key: 'dean_email', label: 'Dean Email',    required: false, type: 'email' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <X size={16} />
                    </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {fields.map(({ key, label, required, type }) => (
                        <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                {label} {required && <span className="text-red-500">*</span>}
                            </label>
                            <input
                                type={type}
                                value={form[key]}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                                    errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                                }`}
                            />
                            {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key][0]}</p>}
                        </div>
                    ))}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                        <div className="flex gap-3">
                            {['active', 'inactive'].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setForm({ ...form, status: s })}
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
                </div>
                <div className="flex gap-3 px-6 pb-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 font-medium transition">
                        Cancel
                    </button>
                    <button onClick={onSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition">
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminColleges() {
    const { hasRole, hasPermission } = useAuth();
    const { success, error } = useToast();
    const [colleges, setColleges]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [expanded, setExpanded]         = useState({});
    const [departments, setDepartments]   = useState({});
    const [deptLoading, setDeptLoading]   = useState({});
    const [search, setSearch]             = useState('');
    const [showAdd, setShowAdd]           = useState(false);
    const [editCollege, setEditCollege]   = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [form, setForm]                 = useState({ name: '', code: '', dean_name: '', dean_email: '', status: 'active' });
    const [saving, setSaving]             = useState(false);
    const [errors, setErrors]             = useState({});

    const load = () => {
        setLoading(true);
        get('/colleges')
            .then((r) => setColleges(r.data ?? []))
            .catch(() => error('Failed to load colleges.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const toggleExpand = async (collegeId) => {
        setExpanded((prev) => ({ ...prev, [collegeId]: !prev[collegeId] }));
        if (!departments[collegeId]) {
            setDeptLoading((prev) => ({ ...prev, [collegeId]: true }));
            get(`/colleges/${collegeId}/departments`)
                .then((r) => setDepartments((prev) => ({ ...prev, [collegeId]: r.data ?? [] })))
                .catch(() => {})
                .finally(() => setDeptLoading((prev) => ({ ...prev, [collegeId]: false })));
        }
    };

    const openAdd = () => {
        setForm({ name: '', code: '', dean_name: '', dean_email: '', status: 'active' });
        setErrors({});
        setShowAdd(true);
    };

    const openEdit = (c) => {
        setForm({ name: c.name, code: c.code, dean_name: c.dean_name ?? '', dean_email: c.dean_email ?? '', status: c.status ?? 'active' });
        setErrors({});
        setEditCollege(c);
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/colleges/${deleteConfirm.id}`);
            success('College deleted.');
            setDeleteConfirm(null);
            load();
        } catch (err) {
            error(err.response?.data?.message || 'Failed to delete college.');
            setDeleteConfirm(null);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setErrors({});
        try {
            if (editCollege) {
                await put(`/colleges/${editCollege.id}`, form);
                success('College updated successfully.');
                setEditCollege(null);
            } else {
                await post('/colleges', form);
                success('College created successfully.');
                setShowAdd(false);
            }
            load();
        } catch (err) {
            if (err.validationErrors) {
                setErrors(err.validationErrors);
            } else {
                error(err.response?.data?.message || 'Failed to save college.');
            }
        } finally {
            setSaving(false);
        }
    };

    const filtered = colleges.filter((c) =>
        !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
    );

    const activeCount = colleges.filter((c) => (c.status ?? 'active') === 'active').length;
    const totalDepts  = colleges.reduce((sum, c) => sum + (c.departments_count ?? 0), 0);

    return (
        <AppLayout breadcrumb="Colleges">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <Building size={22} className="text-indigo-600 shrink-0" />
                            Colleges &amp; Departments
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Manage colleges and their departments</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                            <RefreshCw size={14} /> <span className="hidden sm:inline">Refresh</span>
                        </button>
                        {hasPermission('colleges.create') && (
                            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm shadow-indigo-200">
                                <Plus size={16} /> Add College
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Total Colleges"   value={colleges.length} icon={Building}  color="bg-indigo-500" />
                    <StatCard label="Active Colleges"  value={activeCount}     icon={Building2} color="bg-emerald-500" />
                    <StatCard label="Total Departments" value={totalDepts}     icon={Users}     color="bg-blue-500" />
                </div>

                {/* Search */}
                <div className="flex items-center border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm">
                    <Search size={15} className="text-gray-400 shrink-0" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search colleges by name or code…"
                        className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <Building size={40} className="mx-auto text-gray-200 mb-3" />
                            <p className="text-gray-400 font-medium">{search ? 'No colleges match your search.' : 'No colleges found.'}</p>
                        </div>
                    ) : (
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-linear-to-r from-indigo-600 to-indigo-700">
                                    {['#', 'College', 'Code', 'Dean', 'Departments', 'Status', ''].map((h) => (
                                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map((college, idx) => (
                                    <>
                                        <tr
                                            key={college.id}
                                            className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                                        >
                                            <td className="px-5 py-4 text-xs font-medium text-indigo-200 tabular-nums w-10">{idx + 1}</td>
                                            <td className="px-5 py-4">
                                                <button
                                                    onClick={() => toggleExpand(college.id)}
                                                    className="flex items-center gap-2.5 text-sm font-semibold text-gray-900 hover:text-indigo-700 transition"
                                                >
                                                    <span className={`p-0.5 rounded transition-transform ${expanded[college.id] ? 'text-indigo-600 rotate-0' : 'text-gray-400'}`}>
                                                        {expanded[college.id]
                                                            ? <ChevronDown size={15} />
                                                            : <ChevronRight size={15} />
                                                        }
                                                    </span>
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                            {college.code?.slice(0, 2)}
                                                        </span>
                                                        {college.name}
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{college.code}</span>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-600">
                                                {college.dean_name
                                                    ? <div>
                                                        <p className="font-medium text-gray-800">{college.dean_name}</p>
                                                        {college.dean_email && <p className="text-xs text-gray-400">{college.dean_email}</p>}
                                                      </div>
                                                    : <span className="text-gray-300">—</span>
                                                }
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                                                    <Building2 size={13} className="text-blue-400" />
                                                    {college.departments_count ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    (college.status ?? 'active') === 'active'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${(college.status ?? 'active') === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                    {college.status ?? 'active'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                {hasPermission('colleges.update') && (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => openEdit(college)}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(college)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Departments row */}
                                        {expanded[college.id] && (
                                            <tr key={`${college.id}-depts`} className="bg-indigo-50/60">
                                                <td colSpan={6} className="px-8 py-4">
                                                    {deptLoading[college.id] ? (
                                                        <div className="flex items-center gap-2 text-xs text-indigo-400">
                                                            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                                            Loading departments…
                                                        </div>
                                                    ) : (departments[college.id] ?? []).length === 0 ? (
                                                        <p className="text-xs text-gray-400 italic">No departments added yet.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                                            {(departments[college.id] ?? []).map((d) => (
                                                                <div key={d.id} className="bg-white rounded-lg border border-indigo-100 px-3 py-2 flex items-center gap-2">
                                                                    <Building2 size={12} className="text-indigo-400 shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-semibold text-gray-800 truncate">{d.name}</p>
                                                                        <p className="text-[10px] text-gray-400 font-mono">{d.code}</p>
                                                                    </div>
                                                                    <span className={`ml-auto shrink-0 w-1.5 h-1.5 rounded-full ${d.status === 'active' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <p className="text-xs text-gray-400 text-center">
                    {filtered.length} college{filtered.length !== 1 ? 's' : ''} shown
                    {search && ` matching "${search}"`}
                </p>
            </div>

            {showAdd && (
                <CollegeModal
                    title="Add New College"
                    form={form}
                    setForm={setForm}
                    errors={errors}
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => setShowAdd(false)}
                />
            )}
            {editCollege && (
                <CollegeModal
                    title="Edit College"
                    form={form}
                    setForm={setForm}
                    errors={errors}
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => setEditCollege(null)}
                />
            )}
            {deleteConfirm && (
                <ConfirmDialog
                    open
                    title="Delete College"
                    description={`Permanently delete "${deleteConfirm.name}"? This cannot be undone. All departments must be removed first.`}
                    confirmLabel="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </AppLayout>
    );
}
