import { useState, useEffect, useCallback } from 'react';
import {
    Calendar, Plus, Pencil, Trash2, RefreshCw, Search, X,
    Users, BookOpen, CheckCircle2, Archive, FileText, Eye,
    MapPin, Video, Globe, Star, ChevronDown, Building2,
    Download, UserPlus, Clock, Mic, Save, Upload, Sparkles,
    CalendarDays, BarChart3, ChevronRight,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { cn } from '../../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
    draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400'   },
    published: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700',  dot: 'bg-emerald-500'},
    archived:  { label: 'Archived',  cls: 'bg-amber-50 text-amber-700',      dot: 'bg-amber-500'  },
};

const TYPE_CFG = {
    physical: { label: 'In-Person', Icon: Building2, color: 'text-blue-500'  },
    virtual:  { label: 'Virtual',   Icon: Video,     color: 'text-green-500' },
    hybrid:   { label: 'Hybrid',    Icon: Globe,     color: 'text-violet-500'},
};

const LOC_TYPES = [
    { value: 'physical', label: 'In-Person' },
    { value: 'virtual',  label: 'Virtual'   },
    { value: 'hybrid',   label: 'Hybrid'    },
];

const SESSION_TYPES = ['keynote', 'talk', 'workshop', 'panel', 'break', 'other'];

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatCard({ icon: Icon, label, value, color, sub }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={18} className="text-white" />
                </div>
                {sub != null && (
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{sub}</span>
                )}
            </div>
            <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
        </div>
    );
}

// ─── Shared field wrapper (must be at module scope — never define inside a component) ──

function Field({ label, children, err }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
            {children}
            {err && <p className="text-xs text-red-500 mt-1">{err[0]}</p>}
        </div>
    );
}

// ─── Conference Form Modal ────────────────────────────────────────────────────

function ConferenceModal({ conf, onSave, onClose }) {
    const [form, setForm] = useState(conf ? {
        title: conf.title, description: conf.description ?? '',
        start_date: conf.start_date?.slice(0, 16) ?? '',
        end_date: conf.end_date?.slice(0, 16) ?? '',
        timezone: conf.timezone ?? 'UTC',
        location_type: conf.location_type ?? 'physical',
        location_address: conf.location_address ?? '',
        virtual_link: conf.virtual_link ?? '',
        status: conf.status ?? 'draft',
        max_capacity: conf.max_capacity ?? '',
        registration_link: conf.registration_link ?? '',
        is_featured: conf.is_featured ?? false,
        tags: (conf.tags ?? []).join(', '),
        abstract_submission_open: conf.abstract_submission_open ?? false,
        abstract_deadline: conf.abstract_deadline?.slice(0, 16) ?? '',
    } : {
        title: '', description: '', start_date: '', end_date: '',
        timezone: 'UTC', location_type: 'physical',
        location_address: '', virtual_link: '', status: 'draft',
        max_capacity: '', registration_link: '', is_featured: false, tags: '',
        abstract_submission_open: false, abstract_deadline: '',
    });

    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const { error } = useToast();

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const save = async () => {
        setSaving(true);
        setErrors({});
        try {
            const payload = {
                ...form,
                tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
                max_capacity: form.max_capacity ? parseInt(form.max_capacity, 10) : null,
            };
            await onSave(payload);
        } catch (e) {
            if (e.validationErrors) setErrors(e.validationErrors);
            else error(e.response?.data?.message || 'Failed to save.');
        }
        setSaving(false);
    };

    const inputCls = (key) => cn(
        'w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors',
        errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">
                        {conf ? 'Edit Conference' : 'New Conference'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <Field label="Title *" err={errors.title}>
                        <input value={form.title} onChange={e => set('title', e.target.value)}
                               className={inputCls('title')} placeholder="Conference title" />
                    </Field>

                    <Field label="Description" err={errors.description}>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)}
                                  rows={4} className={inputCls('description')}
                                  placeholder="About this conference…" />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Start Date & Time *" err={errors.start_date}>
                            <input type="datetime-local" value={form.start_date}
                                   onChange={e => set('start_date', e.target.value)}
                                   className={inputCls('start_date')} />
                        </Field>
                        <Field label="End Date & Time" err={errors.end_date}>
                            <input type="datetime-local" value={form.end_date}
                                   onChange={e => set('end_date', e.target.value)}
                                   className={inputCls('end_date')} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Timezone" err={errors.timezone}>
                            <input value={form.timezone} onChange={e => set('timezone', e.target.value)}
                                   className={inputCls('timezone')} placeholder="e.g. Africa/Addis_Ababa" />
                        </Field>
                        <Field label="Location Type *" err={errors.location_type}>
                            <select value={form.location_type} onChange={e => set('location_type', e.target.value)}
                                    className={inputCls('location_type')}>
                                {LOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </Field>
                    </div>

                    {(form.location_type === 'physical' || form.location_type === 'hybrid') && (
                        <Field label="Location Address" err={errors.location_address}>
                            <input value={form.location_address} onChange={e => set('location_address', e.target.value)}
                                   className={inputCls('location_address')} placeholder="Street address or venue name" />
                        </Field>
                    )}

                    {(form.location_type === 'virtual' || form.location_type === 'hybrid') && (
                        <Field label="Virtual Meeting Link" err={errors.virtual_link}>
                            <input value={form.virtual_link} onChange={e => set('virtual_link', e.target.value)}
                                   className={inputCls('virtual_link')} placeholder="https://zoom.us/…" />
                        </Field>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Status" err={errors.status}>
                            <select value={form.status} onChange={e => set('status', e.target.value)}
                                    className={inputCls('status')}>
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                            </select>
                        </Field>
                        <Field label="Max Capacity" err={errors.max_capacity}>
                            <input type="number" min="1" value={form.max_capacity}
                                   onChange={e => set('max_capacity', e.target.value)}
                                   className={inputCls('max_capacity')} placeholder="Leave blank for unlimited" />
                        </Field>
                    </div>

                    <Field label="External Registration Link" err={errors.registration_link}>
                        <input value={form.registration_link} onChange={e => set('registration_link', e.target.value)}
                               className={inputCls('registration_link')} placeholder="https://… (leave blank to use built-in registration)" />
                    </Field>

                    <Field label="Tags (comma-separated)" err={errors.tags}>
                        <input value={form.tags} onChange={e => set('tags', e.target.value)}
                               className={inputCls('tags')} placeholder="research, innovation, AI" />
                    </Field>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={form.is_featured}
                               onChange={e => set('is_featured', e.target.checked)}
                               className="w-4 h-4 text-indigo-600 rounded" />
                        <span className="text-sm text-gray-700 font-medium">Feature this conference on the public site</span>
                    </label>

                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Abstract Submissions</p>
                        <label className="flex items-center gap-2.5 cursor-pointer mb-3">
                            <input type="checkbox" checked={form.abstract_submission_open ?? false}
                                   onChange={e => set('abstract_submission_open', e.target.checked)}
                                   className="w-4 h-4 text-violet-600 rounded" />
                            <span className="text-sm text-gray-700 font-medium">Open abstract submissions for this conference</span>
                        </label>
                        {form.abstract_submission_open && (
                            <Field label="Abstract Submission Deadline" err={errors.abstract_deadline}>
                                <input type="datetime-local" value={form.abstract_deadline ?? ''}
                                       onChange={e => set('abstract_deadline', e.target.value)}
                                       className={inputCls('abstract_deadline')} />
                            </Field>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                        Cancel
                    </button>
                    <button onClick={save} disabled={saving}
                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                        {saving ? 'Saving…' : conf ? 'Save Changes' : 'Create Conference'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Speaker Form ─────────────────────────────────────────────────────────────

function SpeakerForm({ conferenceId, speaker, onSave, onCancel }) {
    const [form, setForm] = useState(speaker ?? {
        name: '', title: '', bio: '', email: '', website: '', twitter: '', linkedin: '', sort_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const { error } = useToast();
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const save = async () => {
        setSaving(true);
        try { await onSave(form); }
        catch (e) { error(e.response?.data?.message || 'Failed.'); }
        setSaving(false);
    };

    return (
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
                {[
                    { k: 'name',     label: 'Name *', placeholder: 'Dr. Jane Smith' },
                    { k: 'title',    label: 'Title',  placeholder: 'Prof. of Computer Science' },
                    { k: 'email',    label: 'Email',  placeholder: 'jane@uni.edu' },
                    { k: 'website',  label: 'Website', placeholder: 'https://…' },
                    { k: 'twitter',  label: 'Twitter', placeholder: '@janedoe' },
                    { k: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/…' },
                ].map(({ k, label, placeholder }) => (
                    <div key={k}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                        <input value={form[k] ?? ''} onChange={e => set(k, e.target.value)}
                               placeholder={placeholder}
                               className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                ))}
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Bio</label>
                <textarea value={form.bio ?? ''} onChange={e => set('bio', e.target.value)}
                          rows={2} className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Short bio…" />
            </div>
            <div className="flex gap-2">
                <button onClick={save} disabled={saving || !form.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                    <Save size={12} /> {saving ? 'Saving…' : 'Save Speaker'}
                </button>
                <button onClick={onCancel}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── Session Form ─────────────────────────────────────────────────────────────

function SessionForm({ conferenceId, session, speakers, onSave, onCancel }) {
    const [form, setForm] = useState(session ? {
        ...session,
        starts_at: session.starts_at?.slice(0, 16) ?? '',
        ends_at:   session.ends_at?.slice(0, 16)   ?? '',
        speaker_ids: (session.speakers ?? []).map(s => s.id),
    } : {
        title: '', description: '', track: '', starts_at: '', ends_at: '',
        room: '', type: 'talk', sort_order: 0, speaker_ids: [],
    });
    const [saving, setSaving] = useState(false);
    const { error } = useToast();
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const toggleSpeaker = (id) => setForm(f => ({
        ...f,
        speaker_ids: f.speaker_ids.includes(id) ? f.speaker_ids.filter(x => x !== id) : [...f.speaker_ids, id],
    }));

    const save = async () => {
        setSaving(true);
        try { await onSave(form); }
        catch (e) { error(e.response?.data?.message || 'Failed.'); }
        setSaving(false);
    };

    return (
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
                    <input value={form.title} onChange={e => set('title', e.target.value)}
                           className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="Session title" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)}
                        className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize">
                        {SESSION_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Track</label>
                    <input value={form.track ?? ''} onChange={e => set('track', e.target.value)}
                           className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="e.g. Main Hall, Track A" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Starts At *</label>
                    <input type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)}
                           className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Ends At</label>
                    <input type="datetime-local" value={form.ends_at ?? ''} onChange={e => set('ends_at', e.target.value)}
                           className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Room / Location</label>
                    <input value={form.room ?? ''} onChange={e => set('room', e.target.value)}
                           className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="e.g. Room 101, Auditorium" />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                    <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={2}
                              className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>

            {speakers.length > 0 && (
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Assign Speakers</label>
                    <div className="flex flex-wrap gap-1.5">
                        {speakers.map(sp => (
                            <button key={sp.id} onClick={() => toggleSpeaker(sp.id)}
                                className={cn(
                                    'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                                    form.speaker_ids.includes(sp.id)
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                )}>
                                {sp.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <button onClick={save} disabled={saving || !form.title || !form.starts_at}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors">
                    <Save size={12} /> {saving ? 'Saving…' : 'Save Session'}
                </button>
                <button onClick={onCancel}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── Conference Detail Drawer ─────────────────────────────────────────────────

function ConferenceDrawer({ confId, onClose, onUpdated }) {
    const [conf,        setConf]        = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [tab,         setTab]         = useState('overview');
    const [addSpeaker,  setAddSpeaker]  = useState(false);
    const [editSpeaker, setEditSpeaker] = useState(null);
    const [addSession,  setAddSession]  = useState(false);
    const [editSession, setEditSession] = useState(null);
    const [delTarget,   setDelTarget]   = useState(null);
    const { success, error } = useToast();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/conferences/${confId}`);
            setConf(res.data.data);
        } catch { error('Failed to load conference.'); }
        setLoading(false);
    }, [confId]);

    useEffect(() => { load(); }, [load]);

    const saveSpeaker = async (form) => {
        if (editSpeaker) {
            await api.put(`/admin/conferences/${confId}/speakers/${editSpeaker.id}`, form);
            success('Speaker updated.');
            setEditSpeaker(null);
        } else {
            await api.post(`/admin/conferences/${confId}/speakers`, form);
            success('Speaker added.');
            setAddSpeaker(false);
        }
        load();
        onUpdated();
    };

    const deleteSpeaker = async (speakerId) => {
        await api.delete(`/admin/conferences/${confId}/speakers/${speakerId}`);
        success('Speaker removed.');
        load();
        onUpdated();
    };

    const saveSession = async (form) => {
        if (editSession) {
            await api.put(`/admin/conferences/${confId}/sessions/${editSession.id}`, form);
            success('Session updated.');
            setEditSession(null);
        } else {
            await api.post(`/admin/conferences/${confId}/sessions`, form);
            success('Session added.');
            setAddSession(false);
        }
        load();
        onUpdated();
    };

    const deleteSession = async (sessionId) => {
        await api.delete(`/admin/conferences/${confId}/sessions/${sessionId}`);
        success('Session removed.');
        load();
        onUpdated();
    };

    const exportRegs = () => {
        window.open(`/api/v1/admin/conferences/${confId}/registrations/export?token=${localStorage.getItem('rtt_token')}`, '_blank');
    };

    const TABS = [
        { id: 'overview',      label: 'Overview',      icon: Eye   },
        { id: 'speakers',      label: `Speakers (${conf?.speakers_count ?? 0})`, icon: Users },
        { id: 'sessions',      label: `Agenda (${conf?.sessions_count ?? 0})`,   icon: Clock },
        { id: 'registrations', label: `Attendees (${conf?.registrations_count ?? 0})`, icon: UserPlus },
    ];

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/40" onClick={onClose} />

            {/* Drawer */}
            <div className="w-full max-w-3xl bg-white shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900 truncate max-w-xs">
                        {conf?.title ?? 'Loading…'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-4 shrink-0">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors -mb-px',
                                tab === t.id
                                    ? 'border-indigo-600 text-indigo-700'
                                    : 'border-transparent text-gray-400 hover:text-gray-700'
                            )}>
                            <t.icon size={13} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6">

                        {/* Overview */}
                        {tab === 'overview' && conf && (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Status',     value: <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CFG[conf.status]?.cls}`}>{STATUS_CFG[conf.status]?.label}</span> },
                                        { label: 'Type',       value: conf.location_type },
                                        { label: 'Start Date', value: fmtDate(conf.start_date) },
                                        { label: 'End Date',   value: fmtDate(conf.end_date) },
                                        { label: 'Location',   value: conf.location_address || conf.virtual_link || '—' },
                                        { label: 'Capacity',   value: conf.max_capacity ? conf.max_capacity.toLocaleString() : 'Unlimited' },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="bg-gray-50 rounded-xl p-3">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                                            <p className="text-sm text-gray-800 font-medium">{value}</p>
                                        </div>
                                    ))}
                                </div>
                                {conf.description && (
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</p>
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{conf.description}</p>
                                    </div>
                                )}
                                {conf.tags?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tags</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {conf.tags.map(t => (
                                                <span key={t} className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {conf.is_featured && (
                                    <p className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-2 rounded-xl">
                                        <Star size={12} /> Featured on public site
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Speakers */}
                        {tab === 'speakers' && (
                            <div className="space-y-4">
                                <button onClick={() => setAddSpeaker(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">
                                    <Plus size={13} /> Add Speaker
                                </button>

                                {addSpeaker && (
                                    <SpeakerForm conferenceId={confId} onSave={saveSpeaker} onCancel={() => setAddSpeaker(false)} />
                                )}

                                {(conf?.speakers ?? []).map(sp => (
                                    <div key={sp.id}>
                                        {editSpeaker?.id === sp.id ? (
                                            <SpeakerForm conferenceId={confId} speaker={editSpeaker}
                                                onSave={saveSpeaker} onCancel={() => setEditSpeaker(null)} />
                                        ) : (
                                            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 group hover:bg-indigo-50/40 transition-colors">
                                                {sp.photo
                                                    ? <img src={sp.photo} alt={sp.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                                                    : <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                                          <span className="text-indigo-600 font-bold text-sm">{sp.name.charAt(0)}</span>
                                                      </div>
                                                }
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{sp.name}</p>
                                                    {sp.title && <p className="text-xs text-gray-500 truncate">{sp.title}</p>}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditSpeaker(sp)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button onClick={() => setDelTarget({ type: 'speaker', id: sp.id, name: sp.name })}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {(conf?.speakers ?? []).length === 0 && !addSpeaker && (
                                    <p className="text-sm text-gray-400 text-center py-8">No speakers yet. Add the first one!</p>
                                )}
                            </div>
                        )}

                        {/* Sessions */}
                        {tab === 'sessions' && (
                            <div className="space-y-3">
                                <button onClick={() => setAddSession(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
                                    <Plus size={13} /> Add Session
                                </button>

                                {addSession && (
                                    <SessionForm conferenceId={confId} speakers={conf?.speakers ?? []}
                                        onSave={saveSession} onCancel={() => setAddSession(false)} />
                                )}

                                {(conf?.sessions ?? []).map(sess => (
                                    <div key={sess.id}>
                                        {editSession?.id === sess.id ? (
                                            <SessionForm conferenceId={confId} session={editSession}
                                                speakers={conf?.speakers ?? []}
                                                onSave={saveSession} onCancel={() => setEditSession(null)} />
                                        ) : (
                                            <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3 group hover:bg-blue-50/40 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md capitalize">
                                                            {sess.type}
                                                        </span>
                                                        {sess.track && (
                                                            <span className="text-[10px] text-gray-400">{sess.track}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{sess.title}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {sess.starts_at ? new Date(sess.starts_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                                        {sess.room && ` · ${sess.room}`}
                                                    </p>
                                                    {sess.speakers?.length > 0 && (
                                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                                            {sess.speakers.map(s => s.name).join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditSession(sess)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button onClick={() => setDelTarget({ type: 'session', id: sess.id, name: sess.title })}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {(conf?.sessions ?? []).length === 0 && !addSession && (
                                    <p className="text-sm text-gray-400 text-center py-8">No sessions yet. Build the agenda!</p>
                                )}
                            </div>
                        )}

                        {/* Registrations */}
                        {tab === 'registrations' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-gray-700">
                                        {(conf?.registrations ?? []).length} registered attendee{(conf?.registrations ?? []).length !== 1 ? 's' : ''}
                                    </p>
                                    {(conf?.registrations ?? []).length > 0 && (
                                        <button onClick={exportRegs}
                                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                                            <Download size={12} /> Export CSV
                                        </button>
                                    )}
                                </div>

                                {(conf?.registrations ?? []).length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-8">No registrations yet.</p>
                                ) : (
                                    <div className="divide-y divide-gray-50 bg-white border border-gray-100 rounded-xl overflow-hidden">
                                        <div className="grid grid-cols-4 px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            <span>Name</span>
                                            <span>Email</span>
                                            <span>Organization</span>
                                            <span>Date</span>
                                        </div>
                                        {(conf.registrations ?? []).map(reg => (
                                            <div key={reg.id} className="grid grid-cols-4 px-4 py-3 text-xs text-gray-600 hover:bg-gray-50">
                                                <span className="font-medium text-gray-900 truncate">{reg.name}</span>
                                                <span className="truncate">{reg.email}</span>
                                                <span className="truncate text-gray-400">{reg.organization ?? '—'}</span>
                                                <span className="text-gray-400">
                                                    {reg.registered_at ? new Date(reg.registered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Delete confirmation */}
            {delTarget && (
                <ConfirmDialog
                    open
                    title={`Remove ${delTarget.type === 'speaker' ? 'Speaker' : 'Session'}`}
                    description={`Remove "${delTarget.name}"? This cannot be undone.`}
                    confirmLabel="Remove"
                    onConfirm={async () => {
                        if (delTarget.type === 'speaker') await deleteSpeaker(delTarget.id);
                        else await deleteSession(delTarget.id);
                        setDelTarget(null);
                    }}
                    onCancel={() => setDelTarget(null)}
                />
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminConferences() {
    const { success, error } = useToast();
    const [conferences, setConferences] = useState([]);
    const [meta,        setMeta]        = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [search,      setSearch]      = useState('');
    const [statusFilter,setStatusFilter]= useState('');
    const [page,        setPage]        = useState(1);
    const [createModal, setCreateModal] = useState(false);
    const [editTarget,  setEditTarget]  = useState(null);
    const [deleteTarget,setDeleteTarget]= useState(null);
    const [drawerConf,  setDrawerConf]  = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page };
            if (search)       params.search = search;
            if (statusFilter) params.status = statusFilter;
            const res = await api.get('/admin/conferences', { params });
            const pg  = res.data.data;
            setConferences(pg?.data ?? (Array.isArray(pg) ? pg : []));
            if (pg?.total != null) setMeta(pg);
        } catch { error('Failed to load conferences.'); }
        setLoading(false);
    }, [page, search, statusFilter]);

    useEffect(() => { load(); }, [load]);

    const createConference = async (form) => {
        await api.post('/admin/conferences', form);
        success('Conference created.');
        setCreateModal(false);
        load();
    };

    const updateConference = async (form) => {
        await api.put(`/admin/conferences/${editTarget.id}`, form);
        success('Conference updated.');
        setEditTarget(null);
        load();
    };

    const deleteConference = async () => {
        try {
            await api.delete(`/admin/conferences/${deleteTarget.id}`);
            success('Conference deleted.');
            load();
        } catch (e) { error(e.response?.data?.message || 'Failed.'); }
        setDeleteTarget(null);
    };

    const stats = {
        total:     conferences.length,
        published: conferences.filter(c => c.status === 'published').length,
        upcoming:  conferences.filter(c => c.start_date && new Date(c.start_date) > Date.now()).length,
    };

    return (
        <AppLayout breadcrumb="Conferences">
            <div className="max-w-7xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-10 w-10 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600
                                             flex items-center justify-center shadow-lg shadow-indigo-200">
                                <CalendarDays size={20} className="text-white" />
                            </div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Conferences</h1>
                        </div>
                        <p className="text-sm text-gray-500 ml-13">Manage events, speakers, agendas, registrations &amp; abstract submissions</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={load}
                            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                            title="Refresh">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={() => setCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold
                                       rounded-xl hover:bg-indigo-700 active:scale-95 transition-all
                                       shadow-lg shadow-indigo-500/25">
                            <Plus size={15} /> New Conference
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard icon={CalendarDays} label="Total Conferences" value={meta?.total ?? 0}        color="bg-indigo-500" />
                    <StatCard icon={CheckCircle2} label="Published"         value={stats.published}          color="bg-emerald-500" />
                    <StatCard icon={Sparkles}     label="Upcoming"          value={stats.upcoming}           color="bg-blue-500" />
                    <StatCard icon={UserPlus}     label="Total Registrations" value={conferences.reduce((s, c) => s + (c.registrations_count ?? 0), 0)} color="bg-violet-500" />
                </div>

                {/* Filters */}
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                               placeholder="Search conferences…"
                               className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    </div>
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="py-2.5 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700">
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="divide-y divide-gray-50">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                                    <div className="h-10 w-10 rounded-xl bg-gray-100 shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3.5 bg-gray-100 rounded w-2/5" />
                                        <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : conferences.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Calendar size={40} className="text-gray-200 mb-3" />
                            <p className="text-sm text-gray-400">No conferences found.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-4 px-6 py-3
                                            bg-gray-50/80 border-b border-gray-100
                                            text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                <span>Conference</span>
                                <span>Date</span>
                                <span>Stats</span>
                                <span>Status</span>
                                <span />
                            </div>
                            <div className="divide-y divide-gray-50">
                                {conferences.map(conf => (
                                    <div key={conf.id}
                                         className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-4 items-center
                                                    px-6 py-4 hover:bg-gray-50/60 transition-colors group">
                                        {/* Title */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 overflow-hidden">
                                                {conf.banner_image
                                                    ? <img src={conf.banner_image} alt="" className="w-full h-full object-cover" />
                                                    : <Calendar size={18} className="text-indigo-400" />
                                                }
                                            </div>
                                            <div className="min-w-0 overflow-hidden">
                                                <button onClick={() => setDrawerConf(conf.id)}
                                                    className="w-full text-sm font-semibold text-gray-900 hover:text-indigo-700
                                                               transition-colors truncate block text-left max-w-full">
                                                    {conf.title}
                                                </button>
                                                <p className="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1">
                                                    {conf.location_type === 'virtual' ? <Video size={10} /> : conf.location_type === 'hybrid' ? <Globe size={10} /> : <MapPin size={10} />}
                                                    {conf.location_address ?? (conf.virtual_link ? 'Online' : '—')}
                                                    {conf.is_featured && <Star size={10} className="text-amber-400 ml-1" />}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Date */}
                                        <div className="text-xs text-gray-600">
                                            <p className="font-medium">{fmtDate(conf.start_date)}</p>
                                            {conf.end_date && <p className="text-gray-400">to {fmtDate(conf.end_date)}</p>}
                                        </div>

                                        {/* Stats + capacity */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                                <span className="flex items-center gap-1"><Users size={10} />{conf.speakers_count}</span>
                                                <span className="flex items-center gap-1"><Clock size={10} />{conf.sessions_count}</span>
                                                <span className="flex items-center gap-1"><UserPlus size={10} />{conf.registrations_count}</span>
                                            </div>
                                            {conf.max_capacity > 0 && (
                                                <div>
                                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all ${
                                                            conf.registrations_count / conf.max_capacity >= 1 ? 'bg-red-500' :
                                                            conf.registrations_count / conf.max_capacity >= 0.8 ? 'bg-orange-400' : 'bg-emerald-500'
                                                        }`}
                                                             style={{ width: `${Math.min(100, (conf.registrations_count / conf.max_capacity) * 100)}%` }} />
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        {conf.registrations_count}/{conf.max_capacity} capacity
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div className="flex flex-col gap-1">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${STATUS_CFG[conf.status]?.cls}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CFG[conf.status]?.dot}`} />
                                                {STATUS_CFG[conf.status]?.label}
                                            </span>
                                            {conf.abstract_submission_open && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 w-fit">
                                                    <FileText size={8} /> Abstracts Open
                                                </span>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setDrawerConf(conf.id)}
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View">
                                                <Eye size={13} />
                                            </button>
                                            <button onClick={() => setEditTarget(conf)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                <Pencil size={13} />
                                            </button>
                                            <button onClick={() => setDeleteTarget(conf)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            {createModal && (
                <ConferenceModal onSave={createConference} onClose={() => setCreateModal(false)} />
            )}
            {editTarget && (
                <ConferenceModal conf={editTarget} onSave={updateConference} onClose={() => setEditTarget(null)} />
            )}
            {deleteTarget && (
                <ConfirmDialog
                    open
                    title="Delete Conference"
                    description={`Permanently delete "${deleteTarget.title}"? All speakers, sessions, and registrations will be removed.`}
                    confirmLabel="Delete"
                    onConfirm={deleteConference}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
            {drawerConf && (
                <ConferenceDrawer
                    confId={drawerConf}
                    onClose={() => setDrawerConf(null)}
                    onUpdated={load}
                />
            )}
        </AppLayout>
    );
}
