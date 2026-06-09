import { useState, useEffect } from 'react';
import { Building, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post, put } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

export default function AdminColleges() {
    const { hasRole } = useAuth();
    const [colleges, setColleges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});
    const [departments, setDepartments] = useState({});
    const [showAdd, setShowAdd] = useState(false);
    const [editCollege, setEditCollege] = useState(null);
    const [form, setForm] = useState({ name: '', code: '', dean_name: '', dean_email: '' });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const load = () => {
        setLoading(true);
        get('/colleges')
            .then((r) => setColleges(r.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const toggleExpand = async (collegeId) => {
        setExpanded((prev) => ({ ...prev, [collegeId]: !prev[collegeId] }));
        if (!departments[collegeId]) {
            get(`/colleges/${collegeId}/departments`)
                .then((r) => setDepartments((prev) => ({ ...prev, [collegeId]: r.data ?? [] })))
                .catch(() => {});
        }
    };

    const openAdd = () => { setForm({ name: '', code: '', dean_name: '', dean_email: '' }); setErrors({}); setShowAdd(true); };
    const openEdit = (c) => { setForm({ name: c.name, code: c.code, dean_name: c.dean_name ?? '', dean_email: c.dean_email ?? '' }); setErrors({}); setEditCollege(c); };

    const handleSave = async () => {
        setSaving(true);
        setErrors({});
        try {
            if (editCollege) {
                await put(`/colleges/${editCollege.id}`, form);
                setEditCollege(null);
            } else {
                await post('/colleges', form);
                setShowAdd(false);
            }
            load();
        } catch (err) {
            if (err.validationErrors) setErrors(err.validationErrors);
        } finally {
            setSaving(false);
        }
    };

    const CollegeForm = ({ title, onClose }) => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
                {[
                    { key: 'name', label: 'College Name', required: true },
                    { key: 'code', label: 'Code', required: true },
                    { key: 'dean_name', label: 'Dean Name' },
                    { key: 'dean_email', label: 'Dean Email', type: 'email' },
                ].map(({ key, label, required, type = 'text' }) => (
                    <div key={key} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            type={type}
                            value={form[key]}
                            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key][0]}</p>}
                    </div>
                ))}
                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <AppLayout breadcrumb="Colleges">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Building size={24} className="text-indigo-600" />
                    <h1 className="text-xl font-bold text-gray-900">Colleges &amp; Departments</h1>
                </div>
                {hasRole('super_admin') && (
                    <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">
                        <Plus size={16} /> Add College
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading…</div>
                ) : colleges.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No colleges found.</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['College', 'Code', 'Dean', 'Departments', 'Status', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {colleges.map((college) => (
                                <>
                                    <tr key={college.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleExpand(college.id)}
                                                className="flex items-center gap-2 text-sm font-medium text-gray-900"
                                            >
                                                {expanded[college.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                {college.name}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-gray-500">{college.code}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{college.dean_name ?? '—'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{college.departments_count ?? 0}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${college.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {college.status ?? 'active'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {hasRole('super_admin') && (
                                                <button onClick={() => openEdit(college)} className="text-xs text-blue-600 hover:underline">Edit</button>
                                            )}
                                        </td>
                                    </tr>
                                    {expanded[college.id] && (
                                        <tr key={`${college.id}-depts`}>
                                            <td colSpan={6} className="px-8 py-2 bg-blue-50">
                                                {(departments[college.id] ?? []).length === 0 ? (
                                                    <p className="text-xs text-gray-400 py-1">No departments.</p>
                                                ) : (
                                                    <ul className="space-y-1">
                                                        {(departments[college.id] ?? []).map((d) => (
                                                            <li key={d.id} className="text-xs text-gray-600 flex gap-3">
                                                                <span className="font-medium">{d.name}</span>
                                                                <span className="text-gray-400 font-mono">{d.code}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
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

            {showAdd && <CollegeForm title="Add College" onClose={() => setShowAdd(false)} />}
            {editCollege && <CollegeForm title="Edit College" onClose={() => setEditCollege(null)} />}
        </AppLayout>
    );
}
