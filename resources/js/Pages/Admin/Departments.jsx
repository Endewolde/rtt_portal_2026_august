import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, RefreshCw } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';

function DeptModal({ dept, colleges, onSave, onClose }) {
    const [form, setForm] = useState(
        dept
            ? { college_id: dept.college_id, name: dept.name, code: dept.code, status: dept.status }
            : { college_id: '', name: '', code: '', status: 'active' }
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
        } catch (e) { error(e.response?.data?.message || 'Failed to save department.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">
                    {dept ? 'Edit Department' : 'New Department'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">College <span className="text-red-500">*</span></label>
                        <select value={form.college_id} onChange={e => set('college_id', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— Select college —</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                        <input value={form.name} onChange={e => set('name', e.target.value)}
                            placeholder="e.g. Computer Science"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-red-500">*</span></label>
                        <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                            placeholder="e.g. CS"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                    </div>
                    {dept && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select value={form.status} onChange={e => set('status', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Departments() {
    const { error } = useToast();
    const [departments, setDepartments] = useState([]);
    const [colleges, setColleges]       = useState([]);
    const [loading, setLoading]         = useState(true);
    const [filterCollege, setFilterCollege] = useState('');
    const [modal, setModal]             = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [dRes, cRes] = await Promise.all([
                api.get('/departments', { params: filterCollege ? { college_id: filterCollege } : {} }),
                api.get('/colleges'),
            ]);
            setDepartments(dRes.data?.data ?? []);
            setColleges(cRes.data?.data ?? []);
        } catch { error('Failed to load departments.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filterCollege]);

    const afterSave = () => { setModal(null); load(); };

    // Group by college
    const grouped = departments.reduce((acc, d) => {
        const key = d.college?.name ?? 'Unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(d);
        return acc;
    }, {});

    return (
        <AppLayout breadcrumb="Departments">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Building2 size={22} className="text-blue-600" /> Departments
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">{departments.length} departments across {Object.keys(grouped).length} colleges</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button onClick={() => setModal({ dept: null })}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                            <Plus size={14} /> Add Department
                        </button>
                    </div>
                </div>

                {/* Filter */}
                <div className="mb-4">
                    <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">All Colleges</option>
                        {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : Object.keys(grouped).length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No departments found.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(grouped).map(([collegeName, depts]) => (
                            <div key={collegeName} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <Building2 size={14} className="text-blue-500" /> {collegeName}
                                        <span className="text-xs text-gray-400 font-normal">({depts.length})</span>
                                    </h2>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 uppercase border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium">Name</th>
                                            <th className="px-4 py-2 text-left font-medium">Code</th>
                                            <th className="px-4 py-2 text-left font-medium">Status</th>
                                            <th className="px-4 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {depts.map(d => (
                                            <tr key={d.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-2.5 font-medium text-gray-900">{d.name}</td>
                                                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{d.code}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                        d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {d.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <button onClick={() => setModal({ dept: d })}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                                                        <Pencil size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modal && (
                <DeptModal
                    dept={modal.dept}
                    colleges={colleges}
                    onSave={afterSave}
                    onClose={() => setModal(null)}
                />
            )}
        </AppLayout>
    );
}
