import { useState, useEffect } from 'react';
import {
    FlaskConical, Plus, Search, RefreshCw, X, Pencil, Trash2,
    ToggleLeft, ToggleRight, GripVertical, ChevronDown, ChevronUp,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post, put } from '../../lib/api';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';

const PRESET_COLORS = [
    '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

const PRESET_ICONS = ['🔬', '🌱', '💡', '🚀', '🤝', '📊', '🏥', '⚡', '🌍', '🎓', '🔭', '💻'];

// ─── Sub-topic editor ──────────────────────────────────────────────────────────

function SubTopicEditor({ topics, onChange }) {
    const add    = ()      => onChange([...topics, '']);
    const remove = (i)     => onChange(topics.filter((_, idx) => idx !== i));
    const update = (i, v)  => onChange(topics.map((t, idx) => idx === i ? v : t));

    return (
        <div className="space-y-2">
            {topics.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 shrink-0">
                        <GripVertical size={13} className="text-gray-300" />
                    </div>
                    <span className="text-xs text-gray-400 font-mono w-5 shrink-0 text-right">{i + 1}.</span>
                    <input
                        value={t}
                        onChange={e => update(i, e.target.value)}
                        placeholder={`Sub-topic ${i + 1}…`}
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition"
                    />
                    <button
                        type="button"
                        onClick={() => remove(i)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                        <X size={13} />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={add}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700
                           font-semibold px-3 py-2 rounded-lg border border-dashed border-indigo-200
                           hover:bg-indigo-50 transition w-full justify-center mt-1"
            >
                <Plus size={13} /> Add sub-topic
            </button>
        </div>
    );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

function ThematicAreaModal({ title, form, setForm, errors, saving, onSave, onClose }) {
    const [showSubTopics, setShowSubTopics] = useState((form.sub_topics ?? []).length > 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Agriculture and Agro-Industry"
                            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                                errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                            }`}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name[0]}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            rows={2}
                            placeholder="Brief description of this thematic area…"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition resize-none"
                        />
                    </div>

                    {/* Sub-topics */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowSubTopics(v => !v)}
                            className="flex items-center gap-2 w-full text-sm font-medium text-gray-700 mb-2 group"
                        >
                            <span className="flex-1 text-left">
                                Sub-topics
                                {(form.sub_topics ?? []).length > 0 && (
                                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">
                                        {form.sub_topics.length}
                                    </span>
                                )}
                            </span>
                            {showSubTopics ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </button>
                        {showSubTopics && (
                            <SubTopicEditor
                                topics={form.sub_topics ?? []}
                                onChange={v => setForm({ ...form, sub_topics: v })}
                            />
                        )}
                    </div>

                    {/* Icon picker */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Icon</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {PRESET_ICONS.map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setForm({ ...form, icon: emoji })}
                                    className={`w-9 h-9 text-xl rounded-lg border-2 transition flex items-center justify-center ${
                                        form.icon === emoji
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                                    }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={form.icon}
                            onChange={e => setForm({ ...form, icon: e.target.value })}
                            placeholder="Or type any emoji…"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                        />
                    </div>

                    {/* Color picker */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setForm({ ...form, color })}
                                    className={`w-7 h-7 rounded-full border-2 transition ${
                                        form.color === color ? 'border-gray-800 scale-110' : 'border-transparent'
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={form.color}
                                onChange={e => setForm({ ...form, color: e.target.value })}
                                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                            />
                            <input
                                type="text"
                                value={form.color}
                                onChange={e => setForm({ ...form, color: e.target.value })}
                                placeholder="#6366f1"
                                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                            />
                        </div>
                    </div>

                    {/* Sort order + Status */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sort Order</label>
                            <input
                                type="number"
                                min={0}
                                value={form.sort_order}
                                onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                            <div className="flex gap-2">
                                {[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }].map(({ value, label }) => (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => setForm({ ...form, is_active: value })}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                                            form.is_active === value
                                                ? value
                                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                                    : 'bg-gray-100 border-gray-400 text-gray-700'
                                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
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

// ─── Row with expandable sub-topics ────────────────────────────────────────────

function AreaRow({ area, idx, isSuperAdmin, onEdit, onDelete, onToggle }) {
    const [expanded, setExpanded] = useState(false);
    const topics = area.sub_topics ?? [];

    return (
        <>
            <tr className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ backgroundColor: `${area.color}20`, border: `1.5px solid ${area.color}40` }}
                        >
                            {area.icon}
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-gray-900">{area.name}</p>
                            <div className="w-12 h-1 rounded-full mt-1" style={{ backgroundColor: area.color }} />
                        </div>
                    </div>
                </td>
                <td className="px-5 py-4 max-w-xs">
                    <p className="text-sm text-gray-500 line-clamp-1">
                        {area.description || <span className="text-gray-300 italic">No description</span>}
                    </p>
                </td>
                <td className="px-5 py-4">
                    {topics.length > 0 ? (
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600
                                       hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1
                                       rounded-full transition"
                        >
                            {topics.length} topic{topics.length !== 1 ? 's' : ''}
                            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                    ) : (
                        <span className="text-xs text-gray-300 italic">None</span>
                    )}
                </td>
                <td className="px-5 py-4">
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                        {area.sort_order}
                    </span>
                </td>
                <td className="px-5 py-4">
                    <button
                        onClick={() => isSuperAdmin && onToggle(area)}
                        disabled={!isSuperAdmin}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                            area.is_active
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        } ${!isSuperAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                        {area.is_active
                            ? <><ToggleRight size={13} /> Active</>
                            : <><ToggleLeft size={13} /> Inactive</>
                        }
                    </button>
                </td>
                <td className="px-5 py-4 text-right">
                    {isSuperAdmin && (
                        <div className="flex items-center justify-end gap-1">
                            <button
                                onClick={() => onEdit(area)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                onClick={() => onDelete(area)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </td>
            </tr>

            {/* Expanded sub-topics */}
            {expanded && topics.length > 0 && (
                <tr className="bg-indigo-50/60">
                    <td colSpan={6} className="px-8 py-4">
                        <ol className="list-decimal list-inside space-y-1">
                            {topics.filter(t => t?.trim()).map((t, i) => (
                                <li key={i} className="text-sm text-gray-700 leading-relaxed">
                                    {t}
                                </li>
                            ))}
                        </ol>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', description: '', sub_topics: [], icon: '🔬', color: '#6366f1', is_active: true, sort_order: 0 };

export default function AdminThematicAreas() {
    const { hasPermission } = useAuth();
    const { success, error } = useToast();

    const [areas, setAreas]               = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [showAdd, setShowAdd]           = useState(false);
    const [editArea, setEditArea]         = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [form, setForm]                 = useState(EMPTY_FORM);
    const [saving, setSaving]             = useState(false);
    const [errors, setErrors]             = useState({});

    const load = () => {
        setLoading(true);
        get('/thematic-areas')
            .then(r => setAreas(r.data ?? []))
            .catch(() => error('Failed to load thematic areas.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openAdd = () => { setForm(EMPTY_FORM); setErrors({}); setShowAdd(true); };

    const openEdit = (area) => {
        setForm({
            name:        area.name,
            description: area.description ?? '',
            sub_topics:  area.sub_topics ?? [],
            icon:        area.icon ?? '🔬',
            color:       area.color ?? '#6366f1',
            is_active:   area.is_active ?? true,
            sort_order:  area.sort_order ?? 0,
        });
        setErrors({});
        setEditArea(area);
    };

    const handleSave = async () => {
        setSaving(true);
        setErrors({});
        const payload = { ...form, sub_topics: (form.sub_topics ?? []).filter(t => t?.trim()) };
        try {
            if (editArea) {
                await put(`/thematic-areas/${editArea.id}`, payload);
                success('Thematic area updated.');
                setEditArea(null);
            } else {
                await post('/thematic-areas', payload);
                success('Thematic area created.');
                setShowAdd(false);
            }
            load();
        } catch (err) {
            if (err.validationErrors) {
                setErrors(err.validationErrors);
            } else {
                error(err.response?.data?.message || 'Failed to save thematic area.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/thematic-areas/${deleteConfirm.id}`);
            success('Thematic area deleted.');
            setDeleteConfirm(null);
            load();
        } catch (err) {
            error(err.response?.data?.message || 'Failed to delete.');
            setDeleteConfirm(null);
        }
    };

    const handleToggleActive = async (area) => {
        try {
            await put(`/thematic-areas/${area.id}`, { is_active: !area.is_active });
            success(`Thematic area ${area.is_active ? 'deactivated' : 'activated'}.`);
            load();
        } catch {
            error('Failed to update status.');
        }
    };

    const filtered    = areas.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()));
    const activeCount = areas.filter(a => a.is_active).length;
    const isSuperAdmin = hasPermission('thematic_areas.manage');

    return (
        <AppLayout breadcrumb="Thematic Areas">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <FlaskConical size={24} className="text-indigo-600" />
                            Thematic Areas
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage research thematic areas and their sub-topics displayed on the public site
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                            <RefreshCw size={14} /> Refresh
                        </button>
                        {isSuperAdmin && (
                            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm shadow-indigo-200">
                                <Plus size={16} /> Add Area
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                        { label: 'Total Areas',  value: areas.length,           color: 'bg-indigo-500' },
                        { label: 'Active',        value: activeCount,            color: 'bg-emerald-500' },
                        { label: 'Total Topics',  value: areas.reduce((s, a) => s + (a.sub_topics?.length ?? 0), 0), color: 'bg-blue-500' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                                <FlaskConical size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
                                <p className="text-xs text-gray-500 mt-1">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div className="flex items-center border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm">
                    <Search size={15} className="text-gray-400 shrink-0" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search thematic areas…"
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
                            <FlaskConical size={40} className="mx-auto text-gray-200 mb-3" />
                            <p className="text-gray-400 font-medium">
                                {search ? 'No thematic areas match your search.' : 'No thematic areas yet.'}
                            </p>
                            {!search && isSuperAdmin && (
                                <button onClick={openAdd} className="mt-4 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                                    <Plus size={14} /> Add the first one
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-linear-to-r from-indigo-600 to-indigo-700">
                                        {['Area', 'Description', 'Sub-topics', 'Sort', 'Status', ''].map(h => (
                                            <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-indigo-100 uppercase tracking-wide">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map((area, idx) => (
                                        <AreaRow
                                            key={area.id}
                                            area={area}
                                            idx={idx}
                                            isSuperAdmin={isSuperAdmin}
                                            onEdit={openEdit}
                                            onDelete={setDeleteConfirm}
                                            onToggle={handleToggleActive}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <p className="text-xs text-gray-400 text-center">
                    {filtered.length} thematic area{filtered.length !== 1 ? 's' : ''} shown
                    {search && ` matching "${search}"`}
                </p>
            </div>

            {showAdd && (
                <ThematicAreaModal
                    title="Add Thematic Area"
                    form={form}
                    setForm={setForm}
                    errors={errors}
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => setShowAdd(false)}
                />
            )}
            {editArea && (
                <ThematicAreaModal
                    title="Edit Thematic Area"
                    form={form}
                    setForm={setForm}
                    errors={errors}
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => setEditArea(null)}
                />
            )}
            {deleteConfirm && (
                <ConfirmDialog
                    open
                    title="Delete Thematic Area"
                    description={`Permanently delete "${deleteConfirm.name}"? This cannot be undone.`}
                    confirmLabel="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </AppLayout>
    );
}
