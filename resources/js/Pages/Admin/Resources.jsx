import { useState, useEffect, useRef } from 'react';
import {
    FolderOpen, Plus, Pencil, Trash2, Upload, X, RefreshCw,
    FileText, FileSpreadsheet, FileImage, Link2, Download,
    ToggleLeft, ToggleRight, GripVertical, CheckCircle2,
    AlertCircle, Eye, EyeOff, Search,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ConfirmDialog from '../../Components/ConfirmDialog';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { cn } from '../../lib/utils';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'guideline',   label: 'Guideline',   color: 'bg-blue-100 text-blue-700 border-blue-200'    },
    { value: 'template',    label: 'Template',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
    { value: 'form',        label: 'Form',        color: 'bg-teal-100 text-teal-700 border-teal-200'    },
    { value: 'report',      label: 'Report',      color: 'bg-amber-100 text-amber-700 border-amber-200'  },
    { value: 'policy',      label: 'Policy',      color: 'bg-red-100 text-red-700 border-red-200'       },
    { value: 'other',       label: 'Other',       color: 'bg-gray-100 text-gray-600 border-gray-200'    },
];

function catMeta(value) {
    return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

function fileIcon(mimeType) {
    if (!mimeType) return FileText;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
    if (mimeType.includes('image')) return FileImage;
    return FileText;
}

function fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Resource form modal ──────────────────────────────────────────────────────

function ResourceModal({ resource, onSave, onClose }) {
    const { success, error } = useToast();
    const fileRef = useRef(null);

    const [form, setForm] = useState({
        title:        resource?.title        ?? '',
        description:  resource?.description  ?? '',
        category:     resource?.category     ?? 'guideline',
        external_url: resource?.external_url ?? '',
        sort_order:   resource?.sort_order   ?? 0,
    });
    const [file,    setFile]    = useState(null);
    const [saving,  setSaving]  = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleFile = (f) => {
        if (f) setFile(f);
    };

    const submit = async () => {
        if (!form.title.trim()) { error('Title is required.'); return; }
        if (!file && !resource?.file_path && !resource?.external_url && !form.external_url) {
            error('Upload a file or provide an external URL.'); return;
        }
        setSaving(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
            if (file) fd.append('file', file);

            if (resource) {
                await api.put(`/admin/resources/${resource.id}`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                success('Resource updated.');
            } else {
                await api.post('/admin/resources', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                success('Resource created.');
            }
            onSave();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to save resource.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden mb-10">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <FolderOpen size={16} className="text-indigo-600" />
                        </div>
                        <h2 className="text-base font-bold text-gray-900">
                            {resource ? 'Edit Resource' : 'Add Resource'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Title <span className="text-red-400">*</span>
                        </label>
                        <input
                            value={form.title}
                            onChange={e => set('title', e.target.value)}
                            placeholder="e.g. Proposal Submission Guidelines 2024/25"
                            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            rows={2}
                            placeholder="Brief description of this resource…"
                            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition resize-none"
                        />
                    </div>

                    {/* Category + order */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Category <span className="text-red-400">*</span>
                            </label>
                            <select
                                value={form.category}
                                onChange={e => set('category', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sort Order</label>
                            <input
                                type="number"
                                min={0}
                                value={form.sort_order}
                                onChange={e => set('sort_order', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition"
                            />
                        </div>
                    </div>

                    {/* File upload */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            File Upload {resource?.file_name ? <span className="font-normal text-gray-400">(replace current)</span> : ''}
                        </label>
                        {resource?.file_name && !file && (
                            <div className="flex items-center gap-2 mb-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                <span className="text-xs text-emerald-700 truncate">{resource.file_name}</span>
                                <span className="text-xs text-emerald-500 ml-auto shrink-0">{fmtSize(resource.file_size)}</span>
                            </div>
                        )}
                        <div
                            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => fileRef.current?.click()}
                            className={cn(
                                'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition',
                                dragOver ? 'border-indigo-400 bg-indigo-50'
                                    : file ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                            )}
                        >
                            <input ref={fileRef} type="file" className="hidden"
                                onChange={e => handleFile(e.target.files[0])} />
                            {file ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileText size={18} className="text-emerald-500" />
                                    <span className="text-sm font-semibold text-emerald-700 truncate max-w-xs">{file.name}</span>
                                    <span className="text-xs text-gray-400 shrink-0">{fmtSize(file.size)}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-1.5">
                                    <Upload size={20} className="text-gray-300" />
                                    <p className="text-sm text-gray-500">Drop file here or click to browse</p>
                                    <p className="text-xs text-gray-400">PDF, DOCX, XLSX, images — max 20 MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* OR external URL */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            External URL <span className="text-gray-400 font-normal">(alternative to file upload)</span>
                        </label>
                        <div className="flex items-center border border-gray-200 rounded-xl px-3.5 py-2.5 gap-2
                                        focus-within:ring-2 focus-within:ring-indigo-500 bg-gray-50 focus-within:bg-white transition">
                            <Link2 size={14} className="text-gray-400 shrink-0" />
                            <input
                                type="url"
                                value={form.external_url}
                                onChange={e => set('external_url', e.target.value)}
                                placeholder="https://example.com/resource.pdf"
                                className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
                            />
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
                        {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : resource ? 'Save Changes' : 'Add Resource'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminResources() {
    const { success, error } = useToast();
    const [resources,  setResources]  = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [search,     setSearch]     = useState('');
    const [catFilter,  setCatFilter]  = useState('all');
    const [modal,      setModal]      = useState(null); // null | { resource? }
    const [deleteRow,  setDeleteRow]  = useState(null);
    const [toggling,   setToggling]   = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/resources');
            setResources(res.data?.data ?? []);
        } catch { error('Failed to load resources.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const afterSave = () => { setModal(null); load(); };

    const handleDelete = async () => {
        try {
            await api.delete(`/admin/resources/${deleteRow.id}`);
            success('Resource deleted.');
            setDeleteRow(null);
            load();
        } catch (e) { error(e.response?.data?.message || 'Delete failed.'); }
    };

    const toggleActive = async (res) => {
        setToggling(res.id);
        try {
            await api.put(`/admin/resources/${res.id}`, { is_active: !res.is_active });
            setResources(prev => prev.map(r => r.id === res.id ? { ...r, is_active: !r.is_active } : r));
        } catch { error('Failed to update.'); }
        setToggling(null);
    };

    const filtered = resources.filter(r => {
        const q = search.toLowerCase();
        const matchSearch = !search || r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q);
        const matchCat    = catFilter === 'all' || r.category === catFilter;
        return matchSearch && matchCat;
    });

    const stats = {
        total:    resources.length,
        active:   resources.filter(r => r.is_active).length,
        bycat:    Object.fromEntries(CATEGORIES.map(c => [c.value, resources.filter(r => r.category === c.value).length])),
    };

    return (
        <AppLayout breadcrumb="Resources">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-start flex-wrap justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <FolderOpen size={24} className="text-indigo-600" /> Resources
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage downloadable files and links shown on the public Downloads page
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 transition-colors">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setModal({ resource: null })}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm
                                       font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors"
                        >
                            <Plus size={15} /> Add Resource
                        </button>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center">
                            <FolderOpen size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 leading-none">{stats.total}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Total</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
                            <Eye size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 leading-none">{stats.active}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Published</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center">
                            <EyeOff size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 leading-none">{stats.total - stats.active}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Hidden</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
                            <Download size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900 leading-none">{CATEGORIES.filter(c => stats.bycat[c.value]).length}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Categories</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 gap-2
                                    focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm flex-1 min-w-48">
                        <Search size={15} className="text-gray-400 shrink-0" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search resources…"
                            className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => setCatFilter('all')}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border transition',
                                catFilter === 'all'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                            )}
                        >
                            All
                        </button>
                        {CATEGORIES.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setCatFilter(c.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition',
                                    catFilter === c.value ? c.color : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                )}
                            >
                                {c.label} {stats.bycat[c.value] ? `(${stats.bycat[c.value]})` : ''}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="divide-y divide-gray-50">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-4">
                                    <div className="h-10 w-10 rounded-xl bg-gray-100 animate-pulse shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3.5 w-52 bg-gray-100 rounded animate-pulse" />
                                        <div className="h-3 w-72 bg-gray-100 rounded animate-pulse" />
                                    </div>
                                    <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <FolderOpen size={40} className="text-gray-200 mb-3" />
                            <p className="text-sm font-medium text-gray-500">
                                {resources.length === 0 ? 'No resources yet.' : 'No resources match your filters.'}
                            </p>
                            {resources.length === 0 && (
                                <button
                                    onClick={() => setModal({ resource: null })}
                                    className="mt-3 flex items-center gap-1.5 text-sm text-indigo-600 font-semibold hover:underline"
                                >
                                    <Plus size={14} /> Add your first resource
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Table header */}
                            <div className="grid grid-cols-[auto_2.5fr_1fr_1fr_1fr_auto] items-center gap-4
                                            px-5 py-3 bg-gray-50 border-b border-gray-100
                                            text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                <span className="w-5" />
                                <span>Resource</span>
                                <span>Category</span>
                                <span>File / Link</span>
                                <span>Status</span>
                                <span />
                            </div>

                            <div className="divide-y divide-gray-50">
                                {filtered.map(res => {
                                    const cat     = catMeta(res.category);
                                    const Icon    = fileIcon(res.file_type);
                                    const isLink  = !res.file_path;
                                    return (
                                        <div key={res.id}
                                            className="grid grid-cols-[auto_2.5fr_1fr_1fr_1fr_auto] items-center
                                                       gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group">

                                            {/* Drag handle placeholder */}
                                            <GripVertical size={14} className="text-gray-200 shrink-0" />

                                            {/* Resource info */}
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={cn(
                                                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                                    isLink ? 'bg-slate-100' : 'bg-indigo-50'
                                                )}>
                                                    {isLink
                                                        ? <Link2 size={16} className="text-slate-500" />
                                                        : <Icon size={16} className="text-indigo-500" />
                                                    }
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{res.title}</p>
                                                    {res.description && (
                                                        <p className="text-xs text-gray-400 truncate mt-0.5">{res.description}</p>
                                                    )}
                                                    <p className="text-[10px] text-gray-300 mt-0.5">
                                                        Order: {res.sort_order}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Category */}
                                            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border w-fit', cat.color)}>
                                                {cat.label}
                                            </span>

                                            {/* File / Link */}
                                            <div className="min-w-0">
                                                {res.file_name ? (
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-700 truncate">{res.file_name}</p>
                                                        <p className="text-[10px] text-gray-400">{fmtSize(res.file_size)}</p>
                                                    </div>
                                                ) : res.external_url ? (
                                                    <a href={res.external_url} target="_blank" rel="noopener noreferrer"
                                                        className="text-xs text-indigo-600 hover:underline truncate block">
                                                        External link ↗
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </div>

                                            {/* Status toggle */}
                                            <button
                                                onClick={() => toggleActive(res)}
                                                disabled={toggling === res.id}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                                                    res.is_active
                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                )}
                                            >
                                                {toggling === res.id
                                                    ? <RefreshCw size={11} className="animate-spin" />
                                                    : res.is_active
                                                    ? <><ToggleRight size={13} /> Published</>
                                                    : <><ToggleLeft size={13} /> Hidden</>
                                                }
                                            </button>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {res.download_url && (
                                                    <a href={res.download_url} target="_blank" rel="noopener noreferrer"
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Preview / Download">
                                                        <Download size={13} />
                                                    </a>
                                                )}
                                                <button onClick={() => setModal({ resource: res })}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit">
                                                    <Pencil size={13} />
                                                </button>
                                                <button onClick={() => setDeleteRow(res)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
                                {filtered.length} resource{filtered.length !== 1 ? 's' : ''}
                                {(search || catFilter !== 'all') && ` shown (${resources.length} total)`}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {modal !== null && (
                <ResourceModal
                    resource={modal.resource}
                    onSave={afterSave}
                    onClose={() => setModal(null)}
                />
            )}

            {deleteRow && (
                <ConfirmDialog open
                    title="Delete Resource"
                    description={`Permanently delete "${deleteRow.title}"? The file will also be removed.`}
                    confirmLabel="Delete" confirmVariant="danger"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteRow(null)}
                />
            )}
        </AppLayout>
    );
}
