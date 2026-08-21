import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@inertiajs/react';
import { useAuth } from '../../hooks/useAuth';
import {
    FileText, Search, RefreshCw, X, Download, Eye,
    UserPlus, CheckCircle2, XCircle, Clock, MessageSquare,
    Star, AlertCircle, Tag, Users, BookOpen, Send, Loader2,
    ExternalLink, ChevronLeft, ChevronRight, MoreHorizontal,
    Filter, ArrowUpDown, Inbox,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { cn, formatDate, truncate } from '../../lib/utils';

// ─── Data ──────────────────────────────────────────────────────────────────────

const STATUSES = {
    draft:              { label: 'Draft',              dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600'      },
    submitted:          { label: 'Submitted',          dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700'       },
    under_review:       { label: 'Under Review',       dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700'   },
    revision_requested: { label: 'Revision Requested', dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700'     },
    accepted:           { label: 'Accepted',           dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
    rejected:           { label: 'Rejected',           dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600'         },
    withdrawn:          { label: 'Withdrawn',          dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500'      },
};

// Status options allowed in the update-status modal
const EDITABLE_STATUSES = ['submitted', 'under_review', 'revision_requested', 'accepted', 'rejected'];

const NOTES_CFG = {
    accepted: {
        label: 'Next Steps for the Presenter',
        placeholder: 'e.g. Please prepare a 15-minute presentation with slides.\nYou will be assigned a time slot and venue by [date].\nThe proceedings template can be downloaded from…',
        hint: 'These instructions are sent directly to the submitter in the acceptance email.',
        required: true,
        accentBorder: 'border-emerald-300 focus:ring-emerald-400',
        accentBg: 'bg-emerald-50',
        errorBorder: 'border-red-400 bg-red-50 ring-1 ring-red-300 focus:ring-red-400',
    },
    revision_requested: {
        label: 'Required Revisions',
        placeholder: 'Describe clearly what needs to be changed or improved before the abstract can be accepted…',
        hint: 'The submitter will receive a revision email with a link to resubmit.',
        required: true,
        accentBorder: 'border-amber-300 focus:ring-amber-400',
        accentBg: 'bg-amber-50',
        errorBorder: 'border-red-400 bg-red-50 ring-1 ring-red-300 focus:ring-red-400',
    },
    rejected: {
        label: 'Feedback for the Author',
        placeholder: 'Optional: provide constructive feedback explaining the decision…',
        hint: 'This will be included in the rejection email to the submitter.',
        required: false,
        accentBorder: 'border-red-200 focus:ring-red-400',
        accentBg: 'bg-red-50',
        errorBorder: '',
    },
};

// ─── Tiny helpers ──────────────────────────────────────────────────────────────

function StatusDot({ status, size = 'sm' }) {
    const cfg = STATUSES[status] ?? STATUSES.draft;
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full font-medium',
            size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
            cfg.badge,
        )}>
            <span className={cn('rounded-full shrink-0', cfg.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
            {cfg.label}
        </span>
    );
}

const TYPE_COLORS = {
    oral:     'bg-sky-50 text-sky-700',
    poster:   'bg-fuchsia-50 text-fuchsia-700',
    workshop: 'bg-teal-50 text-teal-700',
    panel:    'bg-orange-50 text-orange-700',
    other:    'bg-gray-100 text-gray-600',
};

function TypeBadge({ type }) {
    return (
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', TYPE_COLORS[type] ?? TYPE_COLORS.other)}>
            {type ?? '—'}
        </span>
    );
}

function isExternalReviewer(user) {
    return user?.roles?.some(r => (typeof r === 'string' ? r : r.name) === 'external_reviewer') ?? false;
}

function ExternalBadge() {
    return (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
            External
        </span>
    );
}

function Avatar({ name, size = 8 }) {
    const initials = (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const colors = ['from-blue-500 to-indigo-600','from-violet-500 to-purple-600','from-emerald-500 to-teal-600','from-orange-500 to-amber-600','from-pink-500 to-rose-600'];
    const gradient = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
    return (
        <div className={cn(
            `w-${size} h-${size} rounded-full bg-linear-to-br flex items-center justify-center text-white font-bold shrink-0`,
            gradient,
            size === 8 ? 'text-xs' : 'text-[10px]',
        )}>
            {initials}
        </div>
    );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function RowSkeleton() {
    return (
        <div className="divide-y divide-gray-50">
            {[...Array(7)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 lg:px-6 py-4 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                        <div className="h-3.5 bg-gray-100 rounded w-3/5" />
                        <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                        <div className="flex gap-2 pt-0.5">
                            <div className="h-5 w-20 bg-gray-100 rounded-full" />
                            <div className="h-5 w-14 bg-gray-100 rounded-full" />
                        </div>
                    </div>
                    <div className="h-7 w-7 bg-gray-100 rounded-lg shrink-0" />
                </div>
            ))}
        </div>
    );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ abstractId, onClose }) {
    const [abs, setAbs] = useState(null);
    const [loading, setLoading] = useState(true);
    const { error } = useToast();

    useEffect(() => {
        setLoading(true);
        api.get(`/admin/abstracts/${abstractId}`)
            .then(r => setAbs(r.data.data ?? r.data))
            .catch(() => error('Failed to load abstract.'))
            .finally(() => setLoading(false));
    }, [abstractId]);

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                    <div className="flex-1 pr-4">
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Abstract Detail</p>
                        <h2 className="text-base font-bold text-gray-900 leading-snug line-clamp-2">
                            {abs?.title ?? '—'}
                        </h2>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                        <X size={16} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 size={28} className="text-indigo-400 animate-spin" />
                    </div>
                ) : abs ? (
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                        {/* Meta grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Status',     value: <StatusDot status={abs.status} size="md" /> },
                                { label: 'Type',       value: <TypeBadge type={abs.presentation_type} /> },
                                { label: 'Submitter',  value: abs.submitter_name ?? '—' },
                                { label: 'Conference', value: abs.conference?.title ?? '—' },
                                { label: 'Words',      value: abs.word_count ? `${abs.word_count.toLocaleString()} words` : '—' },
                                { label: 'Submitted',  value: formatDate(abs.submitted_at) },
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                                    <div className="text-sm text-gray-800 font-medium">{value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Body */}
                        <section>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Abstract Body</p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl p-4 border border-gray-100">
                                {abs.body ?? abs.abstract_body ?? '—'}
                            </p>
                        </section>

                        {/* Keywords */}
                        {abs.keywords?.length > 0 && (
                            <section>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <Tag size={10} /> Keywords
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {abs.keywords.map((kw, i) => (
                                        <span key={i} className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Co-authors */}
                        {abs.co_authors?.length > 0 && (
                            <section>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <Users size={10} /> Co-Authors
                                </p>
                                <div className="space-y-1.5">
                                    {abs.co_authors.map((ca, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                            <Avatar name={ca.name ?? ca} size={6} />
                                            <span className="font-medium">{ca.name ?? ca}</span>
                                            {ca.affiliation && <span className="text-gray-400 text-xs">· {ca.affiliation}</span>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* File */}
                        {abs.file_path && (
                            <section>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Attached File</p>
                                <a href={abs.file_path} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">
                                    <ExternalLink size={13} /> Download Attachment
                                </a>
                            </section>
                        )}

                        {/* Reviews */}
                        {abs.reviews?.length > 0 && (
                            <section>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Star size={10} /> Reviews ({abs.reviews.length})
                                </p>
                                <div className="space-y-3">
                                    {abs.reviews.map((rev, i) => (
                                        <div key={rev.id ?? i} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-semibold text-gray-700">
                                                    {rev.reviewer?.name ?? `Reviewer ${i + 1}`}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    {rev.score != null && (
                                                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                                            {rev.score}/10
                                                        </span>
                                                    )}
                                                    {rev.recommendation && (
                                                        <span className={cn(
                                                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                                                            rev.recommendation === 'accept' ? 'bg-emerald-100 text-emerald-700' :
                                                            rev.recommendation === 'reject' ? 'bg-red-100 text-red-700' :
                                                            'bg-amber-100 text-amber-700',
                                                        )}>
                                                            {rev.recommendation.charAt(0).toUpperCase() + rev.recommendation.slice(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {rev.comments && (
                                                <p className="text-xs text-gray-600 leading-relaxed">{rev.comments}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Admin Notes */}
                        {abs.admin_notes && (
                            <section>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Admin Notes</p>
                                <p className="text-sm text-gray-700 leading-relaxed bg-amber-50 border border-amber-100 rounded-xl p-4 whitespace-pre-line">
                                    {abs.admin_notes}
                                </p>
                            </section>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-gray-400">Abstract not found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Update Status Modal ───────────────────────────────────────────────────────

function UpdateStatusModal({ abstract, onSave, onClose }) {
    const [status, setStatus]         = useState(abstract.status);
    const [adminNotes, setAdminNotes] = useState(abstract.admin_notes ?? '');
    const [saving, setSaving]         = useState(false);
    const [touched, setTouched]       = useState(false);
    const { error }                   = useToast();
    const textareaRef                 = useRef(null);

    const cfg = NOTES_CFG[status] ?? null;
    const hasError = touched && cfg?.required && !adminNotes.trim();

    // Auto-focus textarea when status changes to one that needs notes
    useEffect(() => {
        if (cfg?.required) {
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [status]);

    const handleStatusChange = (s) => {
        setStatus(s);
        setAdminNotes('');
        setTouched(false);
    };

    const save = async () => {
        if (cfg?.required && !adminNotes.trim()) {
            setTouched(true);
            textareaRef.current?.focus();
            error(`"${cfg.label}" is required before saving.`);
            return;
        }
        setSaving(true);
        try {
            await onSave(abstract.id, { status, admin_notes: adminNotes });
        } catch (e) {
            error(e.response?.data?.message || 'Failed to update status.');
        }
        setSaving(false);
    };

    const statusBtn = (s) => {
        const cfg = STATUSES[s];
        const active = status === s;
        return (
            <button key={s} onClick={() => handleStatusChange(s)}
                className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all',
                    active
                        ? cn(cfg.badge, 'border-current ring-1 ring-current/30 shadow-sm')
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                )}>
                <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                {cfg.label}
            </button>
        );
    };

    const saveBtnColor =
        status === 'accepted'           ? 'bg-emerald-600 hover:bg-emerald-700' :
        status === 'rejected'           ? 'bg-red-600 hover:bg-red-700' :
        status === 'revision_requested' ? 'bg-amber-500 hover:bg-amber-600' :
        'bg-indigo-600 hover:bg-indigo-700';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Update Abstract Status</h2>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-xs">{abstract.title}</p>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0 ml-3">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Submitter row */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <Avatar name={abstract.submitter_name} size={8} />
                        <div>
                            <p className="text-sm font-semibold text-gray-800">{abstract.submitter_name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{abstract.submitter_email ?? ''}</p>
                        </div>
                        <div className="ml-auto">
                            <StatusDot status={abstract.status} />
                        </div>
                    </div>

                    {/* Status picker */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">New Status</p>
                        <div className="grid grid-cols-3 gap-2">
                            {EDITABLE_STATUSES.map(statusBtn)}
                        </div>
                    </div>

                    {/* Notes field */}
                    {cfg ? (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold text-gray-700">
                                    {cfg.label}
                                    {cfg.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <span className="text-[11px] text-gray-400">{adminNotes.length}/2000</span>
                            </div>
                            <textarea
                                ref={textareaRef}
                                value={adminNotes}
                                onChange={e => { setAdminNotes(e.target.value); if (touched) setTouched(false); }}
                                rows={5}
                                maxLength={2000}
                                placeholder={cfg.placeholder}
                                className={cn(
                                    'w-full border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 transition-all resize-none',
                                    hasError
                                        ? cfg.errorBorder
                                        : cn('border-gray-200 focus:bg-white', cfg.accentBorder, cfg.accentBg),
                                )}
                            />
                            {hasError ? (
                                <p className="text-xs text-red-500 mt-1.5 font-medium flex items-center gap-1">
                                    <AlertCircle size={11} /> This field is required before saving.
                                </p>
                            ) : (
                                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{cfg.hint}</p>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">Internal Notes <span className="font-normal text-gray-400">(optional)</span></label>
                            <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                                rows={3} placeholder="Optional note for internal reference…"
                                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3.5 py-3 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-colors resize-none" />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-200 bg-white rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-semibold transition-colors">
                        Cancel
                    </button>
                    <button onClick={save} disabled={saving}
                        className={cn(
                            'flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2',
                            saveBtnColor,
                        )}>
                        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : `Set as ${STATUSES[status]?.label ?? status}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Assign Reviewer Modal ─────────────────────────────────────────────────────

function AssignReviewerModal({ abstract, onSave, onClose }) {
    const [search, setSearch]     = useState('');
    const [users, setUsers]       = useState([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState(null);
    const [saving, setSaving]     = useState(false);
    const { error }               = useToast();

    useEffect(() => {
        const t = setTimeout(async () => {
            if (!search.trim()) { setUsers([]); return; }
            setSearching(true);
            try {
                const res = await api.get('/users', { params: { search, per_page: 10, role: 'staff,external_reviewer' } });
                const d = res.data.data ?? res.data;
                setUsers(Array.isArray(d) ? d : (d.data ?? []));
            } catch { /* ignore */ }
            setSearching(false);
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const assign = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await onSave(abstract.id, selected.id);
        } catch (e) {
            error(e.response?.data?.message || 'Failed to assign reviewer.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Assign Reviewer</h2>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-xs">{abstract.title}</p>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0 ml-3">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div className="relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input value={search}
                            onChange={e => { setSearch(e.target.value); setSelected(null); }}
                            placeholder="Search by name or email…"
                            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 bg-gray-50 rounded-xl text-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-colors" />
                        {searching && <Loader2 size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                    </div>

                    {selected && (
                        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                            <Avatar name={selected.name} size={8} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{selected.name}</p>
                                    {isExternalReviewer(selected) && <ExternalBadge />}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{selected.email}</p>
                            </div>
                            <button onClick={() => { setSelected(null); setSearch(''); }}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                                <X size={13} />
                            </button>
                        </div>
                    )}

                    {!selected && users.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-gray-50">
                            {users.map(u => {
                                const isSubmitter = abstract.submitter_email
                                    && u.email
                                    && u.email.toLowerCase() === abstract.submitter_email.toLowerCase();
                                return (
                                    <button key={u.id}
                                        onClick={() => { if (!isSubmitter) { setSelected(u); setSearch(u.name); setUsers([]); } }}
                                        disabled={isSubmitter}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                                            isSubmitter ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-indigo-50',
                                        )}>
                                        <Avatar name={u.name} size={7} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                                                {isExternalReviewer(u) && <ExternalBadge />}
                                                {isSubmitter && (
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 shrink-0">
                                                        Submitted this abstract
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {!selected && search && !searching && users.length === 0 && (
                        <div className="flex flex-col items-center py-6 text-gray-400">
                            <Search size={24} className="mb-2 opacity-40" />
                            <p className="text-sm">No users found for "{search}"</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-200 bg-white rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-semibold transition-colors">
                        Cancel
                    </button>
                    <button onClick={assign} disabled={!selected || saving}
                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                        {saving ? <><Loader2 size={13} className="animate-spin" /> Assigning…</> : <><UserPlus size={13} /> Assign</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Send What's Next Modal ────────────────────────────────────────────────────

function SendNextStepsModal({ abstract, onClose }) {
    const { success, error } = useToast();
    const [subject, setSubject] = useState(
        `Next Steps — Your Accepted Abstract | ${abstract.conference?.title ?? ''}`,
    );
    const [body, setBody] = useState(
        abstract.admin_notes
            ? abstract.admin_notes + '\n\nIf you have questions, please contact us at the conference email.'
            : 'Dear presenter,\n\nThank you for your accepted abstract. Here is what happens next:\n\n1. \n2. \n3. \n\nPlease confirm receipt by replying to this email.\n\nWarm regards,\nThe Organising Committee',
    );
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (!body.trim()) { error('Message body cannot be empty.'); return; }
        setSending(true);
        try {
            await api.post(`/admin/abstracts/${abstract.id}/next-steps`, { subject, body });
            success(`Email sent to ${abstract.submitter_email}`);
            onClose();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to send email.');
        }
        setSending(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh]">
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Send "What's Next" Email</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            To: <span className="font-semibold text-gray-700">{abstract.submitter_name} &lt;{abstract.submitter_email}&gt;</span>
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0 ml-3">
                        <X size={16} />
                    </button>
                </div>

                <div className="mx-6 mt-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl shrink-0">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Accepted Abstract</p>
                    <p className="text-sm font-semibold text-emerald-900 line-clamp-1">{abstract.title}</p>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Subject Line</label>
                        <input value={subject} onChange={e => setSubject(e.target.value)}
                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-colors" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-gray-600">Message Body</label>
                            <span className="text-[11px] text-gray-400">{body.trim().split(/\s+/).filter(Boolean).length} words</span>
                        </div>
                        <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3.5 py-3 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white
                                       transition-colors resize-none font-mono leading-relaxed" />
                        <p className="text-[11px] text-gray-400 mt-1.5">Line breaks are preserved in the sent email.</p>
                    </div>
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-200 bg-white rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-semibold transition-colors">
                        Cancel
                    </button>
                    <button onClick={send} disabled={sending}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold
                                   hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                        {sending ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : <><Send size={13} /> Send Email</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Row Actions Menu ──────────────────────────────────────────────────────────

function RowActions({ abs, onDetail, onStatus, onAssign, onNextSteps }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos]   = useState({ top: 0, right: 0 });
    const btnRef          = useRef(null);
    const menuRef         = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const handleToggle = () => {
        if (open) { setOpen(false); return; }
        const rect = btnRef.current.getBoundingClientRect();
        const menuH = abs.status === 'accepted' ? 180 : 136;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow >= menuH
            ? rect.bottom + 4
            : rect.top - menuH - 4;
        setPos({ top, right: window.innerWidth - rect.right });
        setOpen(true);
    };

    const menu = open && createPortal(
        <div ref={menuRef}
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
            className="bg-white border border-gray-100 rounded-xl shadow-xl w-48 py-1.5 overflow-hidden">
            <button onClick={() => { onStatus(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors font-medium">
                <ArrowUpDown size={12} /> Update Status
            </button>
            <button onClick={() => { onAssign(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium">
                <UserPlus size={12} /> Assign Reviewer
            </button>
            <button onClick={() => { onDetail(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                <Eye size={12} /> View Detail
            </button>
            {abs.status === 'accepted' && (
                <>
                    <div className="my-1 border-t border-gray-100" />
                    <button onClick={() => { onNextSteps(); setOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-emerald-700 hover:bg-emerald-50 transition-colors font-medium">
                        <Send size={12} /> Send What's Next
                    </button>
                </>
            )}
        </div>,
        document.body,
    );

    return (
        <div className="relative flex items-center gap-1">
            <button onClick={onDetail}
                title="View Detail"
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors
                           hidden lg:inline-flex opacity-0 group-hover:opacity-100">
                <Eye size={13} />
            </button>
            <button ref={btnRef} onClick={handleToggle}
                title="More actions"
                className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    'lg:opacity-0 lg:group-hover:opacity-100',
                    open ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                )}>
                <MoreHorizontal size={13} />
            </button>
            {menu}
        </div>
    );
}

// ─── Manage Abstracts Tab ──────────────────────────────────────────────────────

function ManageAbstractsTab() {
    const { success, error } = useToast();
    const [abstracts, setAbstracts]               = useState([]);
    const [meta, setMeta]                         = useState(null);
    const [loading, setLoading]                   = useState(true);
    const [search, setSearch]                     = useState('');
    const [statusFilter, setStatusFilter]         = useState('');
    const [conferenceFilter, setConferenceFilter] = useState('');
    const [conferences, setConferences]           = useState([]);
    const [page, setPage]                         = useState(1);
    const [detailId, setDetailId]                 = useState(null);
    const [statusTarget, setStatusTarget]         = useState(null);
    const [assignTarget, setAssignTarget]         = useState(null);
    const [nextStepsTarget, setNextStepsTarget]   = useState(null);

    const counts = meta?.counts ?? {};

    const STAT_CARDS = [
        { label: 'Total',            value: counts.total ?? meta?.total ?? 0,    icon: FileText,     color: 'bg-indigo-500',  ring: 'ring-indigo-100' },
        { label: 'Submitted',        value: counts.submitted ?? 0,               icon: Send,          color: 'bg-blue-500',    ring: 'ring-blue-100'   },
        { label: 'Under Review',     value: counts.under_review ?? 0,            icon: Clock,         color: 'bg-violet-500',  ring: 'ring-violet-100' },
        { label: 'Revision Needed',  value: counts.revision_requested ?? 0,      icon: AlertCircle,   color: 'bg-amber-500',   ring: 'ring-amber-100'  },
        { label: 'Accepted',         value: counts.accepted ?? 0,                icon: CheckCircle2,  color: 'bg-emerald-500', ring: 'ring-emerald-100'},
        { label: 'Rejected',         value: counts.rejected ?? 0,                icon: XCircle,       color: 'bg-red-500',     ring: 'ring-red-100'    },
    ];

    const loadConferences = useCallback(async () => {
        try {
            const res = await api.get('/conferences', { params: { scope: 'all', limit: 200 } });
            const d = res.data.data ?? res.data;
            setConferences(Array.isArray(d) ? d : (d.data ?? []));
        } catch { /* non-fatal */ }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page };
            if (search)           params.search = search;
            if (statusFilter)     params.status = statusFilter;
            if (conferenceFilter) params.conference_id = conferenceFilter;
            const res = await api.get('/admin/abstracts', { params });
            const pg = res.data.data ?? res.data;
            setAbstracts(Array.isArray(pg) ? pg : (pg.data ?? []));
            if (pg?.total != null) setMeta(pg);
        } catch { error('Failed to load abstracts.'); }
        setLoading(false);
    }, [page, search, statusFilter, conferenceFilter]);

    useEffect(() => { loadConferences(); }, [loadConferences]);
    useEffect(() => { load(); }, [load]);

    const handleStatusUpdate = async (id, payload) => {
        await api.patch(`/admin/abstracts/${id}/status`, payload);
        success('Status updated successfully.');
        setStatusTarget(null);
        load();
    };

    const handleAssignReviewer = async (abstractId, userId) => {
        await api.post(`/admin/abstracts/${abstractId}/assign-reviewer`, { reviewer_id: userId });
        success('Reviewer assigned successfully.');
        setAssignTarget(null);
        load();
    };

    const handleExport = () => {
        const token = localStorage.getItem('rtt_token');
        window.open(`/api/v1/admin/abstracts/export?token=${token}`, '_blank');
    };

    const totalPages = meta ? Math.ceil(meta.total / (meta.per_page ?? 25)) : 1;

    return (
        <div className="space-y-6">

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {STAT_CARDS.map(({ label, value, icon: Icon, color, ring }) => (
                    <div key={label} className={cn(
                        'bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm ring-1',
                        ring,
                    )}>
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
                            <Icon size={17} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-2.5 items-center">
                {/* Search */}
                <div className="relative w-full sm:flex-1 sm:min-w-52">
                    <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search title or submitter…"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none
                                   focus:ring-2 focus:ring-indigo-400 bg-white transition-colors" />
                </div>

                {/* Status filter */}
                <div className="relative">
                    <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <select value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="pl-8 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm bg-white
                                   focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 appearance-none">
                        <option value="">All Statuses</option>
                        {Object.entries(STATUSES).map(([val, { label }]) => (
                            <option key={val} value={val}>{label}</option>
                        ))}
                    </select>
                </div>

                {/* Conference filter */}
                {conferences.length > 0 && (
                    <div className="relative">
                        <BookOpen size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select value={conferenceFilter}
                            onChange={e => { setConferenceFilter(e.target.value); setPage(1); }}
                            className="pl-8 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm bg-white
                                       focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 appearance-none max-w-48 truncate">
                            <option value="">All Conferences</option>
                            {conferences.map(c => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={handleExport}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium transition-colors">
                        <Download size={13} /> Export
                    </button>
                    <button onClick={load}
                        className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Desktop header — hidden on mobile */}
                <div className="hidden lg:grid grid-cols-[3fr_1.6fr_1fr_1.4fr_0.6fr_1.2fr_0.7fr_auto] gap-3 px-6 py-3
                                bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <span>Abstract</span>
                    <span>Submitter</span>
                    <span>Type</span>
                    <span>Status</span>
                    <span>Words</span>
                    <span>Submitted</span>
                    <span>Reviews</span>
                    <span />
                </div>

                {loading ? <RowSkeleton /> : abstracts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                            <Inbox size={24} className="text-gray-300" />
                        </div>
                        <p className="text-sm font-semibold text-gray-400">No abstracts found</p>
                        <p className="text-xs text-gray-300 mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {abstracts.map(abs => (
                            <div key={abs.id} className="group transition-colors hover:bg-indigo-50/30">

                                {/* ── Desktop row (lg+) ── */}
                                <div className="hidden lg:grid grid-cols-[3fr_1.6fr_1fr_1.4fr_0.6fr_1.2fr_0.7fr_auto] gap-3
                                                items-center px-6 py-4">
                                    <button onClick={() => setDetailId(abs.id)} className="text-left min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 hover:text-indigo-700 transition-colors truncate">
                                            {truncate(abs.title, 65)}
                                        </p>
                                    </button>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Avatar name={abs.submitter_name} size={7} />
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-gray-800 truncate">{abs.submitter_name ?? '—'}</p>
                                            {abs.submitter_affiliation && (
                                                <p className="text-[10px] text-gray-400 truncate">{abs.submitter_affiliation}</p>
                                            )}
                                        </div>
                                    </div>
                                    <TypeBadge type={abs.presentation_type} />
                                    <StatusDot status={abs.status} />
                                    <span className="text-xs text-gray-500 tabular-nums">
                                        {abs.word_count ? abs.word_count.toLocaleString() : '—'}
                                    </span>
                                    <span className="text-xs text-gray-400">{formatDate(abs.submitted_at)}</span>
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        <MessageSquare size={11} />{abs.reviews_count ?? 0}
                                    </span>
                                    <div className="flex items-center justify-end">
                                        <RowActions
                                            abs={abs}
                                            onDetail={() => setDetailId(abs.id)}
                                            onStatus={() => setStatusTarget(abs)}
                                            onAssign={() => setAssignTarget(abs)}
                                            onNextSteps={() => setNextStepsTarget(abs)}
                                        />
                                    </div>
                                </div>

                                {/* ── Mobile / tablet card (< lg) ── */}
                                <div className="lg:hidden px-4 py-4">
                                    {/* Top row: avatar + name + actions */}
                                    <div className="flex items-start gap-3">
                                        <Avatar name={abs.submitter_name} size={9} />
                                        <div className="flex-1 min-w-0">
                                            <button onClick={() => setDetailId(abs.id)} className="text-left w-full">
                                                <p className="text-sm font-bold text-gray-900 leading-snug hover:text-indigo-700 transition-colors line-clamp-2">
                                                    {abs.title}
                                                </p>
                                            </button>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                {abs.submitter_name ?? '—'}
                                                {abs.submitter_affiliation && (
                                                    <span className="text-gray-400"> · {abs.submitter_affiliation}</span>
                                                )}
                                            </p>
                                        </div>
                                        {/* Always-visible action menu on mobile */}
                                        <RowActions
                                            abs={abs}
                                            onDetail={() => setDetailId(abs.id)}
                                            onStatus={() => setStatusTarget(abs)}
                                            onAssign={() => setAssignTarget(abs)}
                                            onNextSteps={() => setNextStepsTarget(abs)}
                                        />
                                    </div>

                                    {/* Badge row */}
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        <StatusDot status={abs.status} />
                                        <TypeBadge type={abs.presentation_type} />
                                        {abs.word_count > 0 && (
                                            <span className="text-[11px] text-gray-400 font-medium">
                                                {abs.word_count.toLocaleString()} words
                                            </span>
                                        )}
                                        <span className="text-[11px] text-gray-400 ml-auto">
                                            {formatDate(abs.submitted_at)}
                                        </span>
                                        {(abs.reviews_count ?? 0) > 0 && (
                                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                                <MessageSquare size={10} />{abs.reviews_count}
                                            </span>
                                        )}
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                        Page {page} of {totalPages} — {(meta?.total ?? 0).toLocaleString()} abstracts
                    </p>
                    <div className="flex items-center gap-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg
                                       disabled:opacity-40 hover:bg-gray-50 transition-colors text-gray-600 font-medium">
                            <ChevronLeft size={12} /> Prev
                        </button>
                        {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                            const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                            return (
                                <button key={pg} onClick={() => setPage(pg)}
                                    className={cn(
                                        'w-8 h-8 text-xs rounded-lg border transition-colors font-medium',
                                        pg === page
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'border-gray-200 hover:bg-gray-50 text-gray-600',
                                    )}>
                                    {pg}
                                </button>
                            );
                        })}
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg
                                       disabled:opacity-40 hover:bg-gray-50 transition-colors text-gray-600 font-medium">
                            Next <ChevronRight size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals / Drawers */}
            {detailId && <DetailDrawer abstractId={detailId} onClose={() => setDetailId(null)} />}
            {statusTarget && (
                <UpdateStatusModal
                    abstract={statusTarget}
                    onSave={handleStatusUpdate}
                    onClose={() => setStatusTarget(null)}
                />
            )}
            {assignTarget && (
                <AssignReviewerModal
                    abstract={assignTarget}
                    onSave={handleAssignReviewer}
                    onClose={() => setAssignTarget(null)}
                />
            )}
            {nextStepsTarget && (
                <SendNextStepsModal
                    abstract={nextStepsTarget}
                    onClose={() => setNextStepsTarget(null)}
                />
            )}
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAbstracts() {
    const { hasAnyRole } = useAuth();
    const isAdmin = hasAnyRole(['super_admin', 'admin', 'central_officer']);

    return (
        <AppLayout breadcrumb="Abstracts">
            <div className="max-w-7xl mx-auto space-y-6 pb-10">

                {/* Page header */}
                <div className="flex items-end justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <FileText size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Abstracts</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Manage conference abstract submissions and peer reviews</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {isAdmin ? (
                    <ManageAbstractsTab />
                ) : (
                    <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-14 text-center">
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={26} className="text-amber-400" />
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1.5">Admins only</h3>
                        <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed mb-5">
                            This page is for managing abstract submissions. If you have abstracts assigned to you for review, find them on your Reviews page.
                        </p>
                        <Link
                            href="/reviews"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            Go to My Reviews <ChevronRight size={14} />
                        </Link>
                    </div>
                )}

            </div>
        </AppLayout>
    );
}
