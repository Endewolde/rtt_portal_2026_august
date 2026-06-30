import { useState, useEffect } from 'react';
import { ListChecks, Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, ChevronUp, ChevronDown } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post, put, del } from '../../lib/api';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';

const GROUPS = [
    { key: 'research_focus_area',   label: 'Research Focus Area',       color: 'blue'   },
    { key: 'community_focus_area',  label: 'Community Engagement Focus Area', color: 'green'  },
    { key: 'technology_focus_area', label: 'Technology Transfer Focus Area',  color: 'purple' },
    { key: 'research_type',         label: 'Research Type',              color: 'amber'  },
];

const COLOR_MAP = {
    blue:   { header: 'bg-blue-600',   badge: 'bg-blue-50 text-blue-700 border-blue-200',   btn: 'bg-blue-600 hover:bg-blue-700'   },
    green:  { header: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    purple: { header: 'bg-violet-600', badge: 'bg-violet-50 text-violet-700 border-violet-200', btn: 'bg-violet-600 hover:bg-violet-700' },
    amber:  { header: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200',  btn: 'bg-amber-500 hover:bg-amber-600'  },
};

// ─── Single option row ─────────────────────────────────────────────────────────

function OptionRow({ option, isFirst, isLast, onEdit, onDelete, onToggle, onMove }) {
    const [editing, setEditing]   = useState(false);
    const [label, setLabel]       = useState(option.label);
    const [saving, setSaving]     = useState(false);
    const toast = useToast();

    const saveEdit = async () => {
        if (!label.trim()) return;
        setSaving(true);
        try {
            await put(`/lookup-options/${option.id}`, { label: label.trim() });
            onEdit({ ...option, label: label.trim() });
            setEditing(false);
        } catch {
            toast.error('Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const cancelEdit = () => { setLabel(option.label); setEditing(false); };

    return (
        <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 last:border-0 group ${option.is_active ? '' : 'opacity-50'}`}>
            {/* Reorder */}
            <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => onMove(option, 'up')} disabled={isFirst}
                    className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition">
                    <ChevronUp size={12} />
                </button>
                <button onClick={() => onMove(option, 'down')} disabled={isLast}
                    className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition">
                    <ChevronDown size={12} />
                </button>
            </div>

            {/* Label */}
            {editing ? (
                <input
                    autoFocus
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="flex-1 rounded-lg border border-blue-300 px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
            ) : (
                <span className="flex-1 text-sm text-gray-800">{option.label}</span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                {editing ? (
                    <>
                        <button onClick={saveEdit} disabled={saving}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50">
                            <Check size={13} />
                        </button>
                        <button onClick={cancelEdit}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                            <X size={13} />
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => onToggle(option)}
                            title={option.is_active ? 'Deactivate' : 'Activate'}
                            className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition">
                            {option.is_active ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} />}
                        </button>
                        <button onClick={() => setEditing(true)}
                            className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition">
                            <Pencil size={13} />
                        </button>
                        <button onClick={() => onDelete(option)}
                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition">
                            <Trash2 size={13} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Group card ────────────────────────────────────────────────────────────────

function GroupCard({ group, options, onRefresh }) {
    const [adding, setAdding]   = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [saving, setSaving]   = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const toast = useToast();
    const colors = COLOR_MAP[group.color];

    const sorted = [...options].sort((a, b) => a.sort_order - b.sort_order);

    const handleAdd = async () => {
        if (!newLabel.trim()) return;
        setSaving(true);
        try {
            await post('/lookup-options', { group: group.key, label: newLabel.trim() });
            toast.success('Option added.');
            setNewLabel('');
            setAdding(false);
            onRefresh();
        } catch {
            toast.error('Failed to add option.');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (updated) => {
        onRefresh();
    };

    const handleToggle = async (option) => {
        try {
            await put(`/lookup-options/${option.id}`, { is_active: !option.is_active });
            onRefresh();
        } catch {
            toast.error('Failed to update.');
        }
    };

    const handleDelete = async () => {
        try {
            await del(`/lookup-options/${deleteTarget.id}`);
            toast.success('Option deleted.');
            setDeleteTarget(null);
            onRefresh();
        } catch {
            toast.error('Failed to delete.');
            setDeleteTarget(null);
        }
    };

    const handleMove = async (option, direction) => {
        const idx = sorted.findIndex(o => o.id === option.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;

        const newOrder = sorted.map(o => o.id);
        [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

        try {
            await post('/lookup-options/reorder', { ids: newOrder });
            onRefresh();
        } catch {
            toast.error('Failed to reorder.');
        }
    };

    const activeCount = options.filter(o => o.is_active).length;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`${colors.header} px-5 py-4 flex items-center justify-between`}>
                <div>
                    <h3 className="text-sm font-bold text-white">{group.label}</h3>
                    <p className="text-[11px] text-white/70 mt-0.5">
                        {activeCount} active · {options.length} total
                    </p>
                </div>
                <button
                    onClick={() => { setAdding(true); setNewLabel(''); }}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                    <Plus size={13} /> Add
                </button>
            </div>

            {/* Options list */}
            <div className="flex-1 divide-y divide-gray-50">
                {sorted.length === 0 && !adding && (
                    <div className="py-8 text-center text-sm text-gray-400">No options yet.</div>
                )}
                {sorted.map((opt, i) => (
                    <OptionRow
                        key={opt.id}
                        option={opt}
                        isFirst={i === 0}
                        isLast={i === sorted.length - 1}
                        onEdit={handleEdit}
                        onDelete={setDeleteTarget}
                        onToggle={handleToggle}
                        onMove={handleMove}
                    />
                ))}
            </div>

            {/* Add row */}
            {adding && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <input
                        autoFocus
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                        placeholder="New option label…"
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button onClick={handleAdd} disabled={saving || !newLabel.trim()}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-40">
                        <Check size={14} />
                    </button>
                    <button onClick={() => setAdding(false)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                        <X size={14} />
                    </button>
                </div>
            )}

            {deleteTarget && (
                <ConfirmDialog
                    open
                    title="Delete Option"
                    description={`Remove "${deleteTarget.label}" from this dropdown? Existing proposals that used this value are not affected.`}
                    confirmLabel="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DropdownOptions() {
    const [grouped, setGrouped] = useState({});
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const load = () => {
        setLoading(true);
        get('/lookup-options')
            .then(r => setGrouped(r.data ?? {}))
            .catch(() => toast.error('Failed to load options.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    return (
        <AppLayout breadcrumb="Dropdown Options">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <ListChecks size={24} className="text-blue-600" />
                            Dropdown Options
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage the options shown in Focus Area and Research Type dropdowns on the proposal form.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {GROUPS.map(group => (
                            <GroupCard
                                key={group.key}
                                group={group}
                                options={grouped[group.key] ?? []}
                                onRefresh={load}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
