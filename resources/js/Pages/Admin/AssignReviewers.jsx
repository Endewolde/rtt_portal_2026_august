import { useState, useEffect, useCallback } from 'react';
import { usePage, router } from '@inertiajs/react';
import {
    Search, UserCheck, Info, AlertTriangle, SlidersHorizontal,
    X, ChevronLeft, BookOpen, Building2, Users, Microscope,
    CheckCircle2, RefreshCw, ToggleLeft, ToggleRight, Sparkles,
    Bell, Calendar,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import { get, post } from '../../lib/api';
import { getCategoryLabel, cn } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

// ─── Workload indicator ────────────────────────────────────────────────────────

function WorkloadBadge({ count }) {
    if (count == null) return null;
    const [cls, label] =
        count === 0 ? ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Available'] :
        count <= 2  ? ['bg-green-50 text-green-700 border-green-200',       `${count} active`] :
        count <= 5  ? ['bg-amber-50 text-amber-700 border-amber-200',       `${count} active`] :
                      ['bg-red-50 text-red-700 border-red-200',             `${count} active`];
    return (
        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', cls)}>
            {label}
        </span>
    );
}

// ─── Reviewer avatar ──────────────────────────────────────────────────────────

const GRADIENTS = [
    'from-blue-500 to-indigo-600', 'from-purple-500 to-violet-600',
    'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',   'from-cyan-500 to-sky-600',
];

function ReviewerAvatar({ reviewer, size = 'md' }) {
    const name     = reviewer?.name ?? '';
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const gradient = GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];
    const dim      = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';
    return (
        <div className={cn(
            'rounded-full flex items-center justify-center font-bold text-white shrink-0',
            `bg-linear-to-br ${gradient}`, dim
        )}>
            {initials}
        </div>
    );
}

// ─── Step header ──────────────────────────────────────────────────────────────

function StepHeader({ number, label, done }) {
    return (
        <div className="flex items-center gap-2.5 mb-4">
            <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                done ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
            )}>
                {done ? <CheckCircle2 size={13} /> : number}
            </div>
            <p className="text-sm font-semibold text-gray-700">{label}</p>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssignReviewers() {
    const { url } = usePage();
    const id      = url.split('/')[2];
    const toast   = useToast();

    const [proposal, setProposal]           = useState(null);
    const [reviewers, setReviewers]         = useState([]);
    const [evalTypes, setEvalTypes]         = useState([]);
    const [colleges, setColleges]           = useState([]);
    const [departments, setDepartments]     = useState([]);
    const [suggestions, setSuggestions]     = useState([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [suggestDueDate, setSuggestDueDate]   = useState('');
    const [selected, setSelected]           = useState([]);
    const [evalType, setEvalType]           = useState('');
    const [dueDate, setDueDate]             = useState('');
    const [loading, setLoading]             = useState(true);
    const [reviewersLoading, setReviewersLoading] = useState(false);
    const [submitting, setSubmitting]       = useState(false);
    const [error, setError]                 = useState(null);
    const [showFilters, setShowFilters]     = useState(false);
    const [override, setOverride]           = useState(false);

    const [filters, setFilters] = useState({
        search: '', expertise: '', department_id: '', college_id: '',
    });

    useEffect(() => {
        Promise.all([
            get(`/proposals/${id}`),
            get('/colleges'),
            get('/departments'),
        ]).then(([p, c, d]) => {
            const proposal = p.data;
            setProposal(proposal);
            setColleges(c.data?.data ?? c.data ?? []);
            setDepartments(d.data?.data ?? d.data ?? []);
            return get('/evaluation-types', { category: proposal.category });
        }).then((t) => {
            const all = t.data ?? [];
            const filtered = all.filter(type => type.name?.startsWith('blind_review'));
            setEvalTypes(filtered);
            if (filtered.length === 1) setEvalType(filtered[0].id);
        }).catch(() => {
            setError('Failed to load page data. Please try again.');
        }).finally(() => setLoading(false));
    }, [id]);

    const fetchSuggestions = useCallback(async () => {
        if (!id) return;
        setSuggestionsLoading(true);
        try {
            const r = await get(`/proposals/${id}/reviewer-suggestions`);
            setSuggestions(r.data ?? []);
            setSuggestionsOpen(true);
        } catch {
            setSuggestions([]);
            setSuggestionsOpen(true);
        } finally {
            setSuggestionsLoading(false);
        }
    }, [id]);

    const hasActiveQuery = filters.search.trim().length >= 2 ||
        filters.expertise !== '' || filters.department_id !== '' || filters.college_id !== '';

    const fetchReviewers = useCallback(async (currentFilters) => {
        setReviewersLoading(true);
        try {
            const params = Object.fromEntries(
                Object.entries(currentFilters).filter(([, v]) => v !== '')
            );
            const r = await get(`/proposals/${id}/available-reviewers`, params);
            setReviewers(r.data ?? []);
        } catch {
            toast.error('Failed to load reviewers.');
        }
        setReviewersLoading(false);
    }, [id]);

    useEffect(() => {
        if (loading) return;
        if (!hasActiveQuery) { setReviewers([]); return; }
        const t = setTimeout(() => fetchReviewers(filters), 350);
        return () => clearTimeout(t);
    }, [filters, loading]);

    const setFilter      = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const clearFilters   = ()     => setFilters({ search: '', expertise: '', department_id: '', college_id: '' });
    const activeFilters  = Object.values(filters).filter(v => v !== '').length;

    const toggleReviewer = (rid) =>
        setSelected(s => s.includes(rid) ? s.filter(x => x !== rid) : [...s, rid]);

    const toggleOverride = () => {
        setOverride(o => { if (!o) clearFilters(); return !o; });
    };

    const assign = async () => {
        if (!selected.length || !evalType || !dueDate) {
            toast.warning('Select at least one reviewer, an evaluation type, and a due date.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await post(`/proposals/${id}/review/assign`, {
                reviewer_ids:       selected,
                evaluation_type_id: evalType,
                due_date:           dueDate,
            });
            toast.success('Reviewers assigned. Proposal moved to Blind Review.');
            router.visit('/admin/blind-review');
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Assignment failed. Please try again.';
            setError(msg);
            toast.error(msg);
        }
        setSubmitting(false);
    };

    // IDs selected specifically from the AI suggestions panel
    const selectedSuggestionIds = selected.filter(id => suggestions.some(s => s.id === id));
    const hasSuggestionSelected = suggestionsOpen && selectedSuggestionIds.length > 0;

    const selectedReviewers = reviewers.filter(r => selected.includes(r.id));
    const evalTypeLabel     = evalTypes.find(t => t.id === evalType)?.label
                           ?? evalTypes.find(t => t.id === evalType)?.name ?? '';

    // ─── Loading ─────────────────────────────────────────────────────────────

    if (loading) return (
        <AppLayout breadcrumb="Assign Reviewers">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
                    {[1, 2].map(i => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                            {[...Array(4)].map((_, j) => (
                                <div key={j} className={cn('h-4 bg-gray-100 rounded animate-pulse', j === 0 ? 'w-1/2' : j === 1 ? 'w-3/4' : 'w-full')} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );

    // ─── Page ─────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumb={`Proposals / ${proposal?.tracker_number ?? id} / Assign Reviewers`}>
            <div className="max-w-6xl mx-auto space-y-5 pb-10">

                {/* ── Page header ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.visit('/admin/proposals')}
                            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                            <UserCheck size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Assign Reviewers</h1>
                            <p className="text-xs text-gray-400 mt-0.5">Select blind reviewers for this proposal</p>
                        </div>
                    </div>

                    {selected.length > 0 && evalType && (
                        <button
                            onClick={assign}
                            disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 shadow-sm transition-colors"
                        >
                            {submitting
                                ? <><RefreshCw size={14} className="animate-spin" /> Assigning…</>
                                : <><UserCheck size={14} /> Assign {selected.length} Reviewer{selected.length !== 1 ? 's' : ''}</>
                            }
                        </button>
                    )}
                </div>

                {/* ── Two-column layout ────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

                    {/* ── LEFT: Proposal info + config ──────────────────────── */}
                    <div className="space-y-4">

                        {/* Proposal card */}
                        {proposal && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
                                    <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                        <BookOpen size={14} className="text-blue-600" />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-700">Proposal Details</p>
                                </div>
                                <div className="px-5 py-4 space-y-3">
                                    <div>
                                        <p className="font-mono text-[11px] text-indigo-500 font-semibold tracking-wider mb-1">
                                            {proposal.tracker_number}
                                        </p>
                                        <p className="text-sm font-bold text-gray-900 leading-snug">
                                            {proposal.title}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <StatusBadge status={proposal.status} />
                                        <span className="text-xs text-gray-400">
                                            {getCategoryLabel(proposal.category)}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 pt-1 border-t border-gray-50">
                                        {proposal.college?.name && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Building2 size={12} className="text-gray-300 shrink-0" />
                                                {proposal.college.name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* AI Reviewer Suggestions */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <button
                                onClick={fetchSuggestions}
                                disabled={suggestionsLoading}
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 bg-violet-50 rounded-lg flex items-center justify-center">
                                        <Sparkles size={13} className="text-violet-600" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-gray-700">Smart Reviewer Suggestions</p>
                                        <p className="text-[10px] text-gray-400">Match by expertise &amp; keywords</p>
                                    </div>
                                </div>
                                {suggestionsLoading
                                    ? <RefreshCw size={13} className="animate-spin text-gray-400" />
                                    : <span className="text-[11px] font-semibold text-violet-600">Suggest →</span>
                                }
                            </button>
                            {suggestionsOpen && suggestions.length > 0 && (
                                <div className="border-t border-gray-100 divide-y divide-gray-50">
                                    {suggestions.slice(0, 5).map(s => (
                                        <div key={s.id}
                                            onClick={() => toggleReviewer(s.id)}
                                            className={cn(
                                                'flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors',
                                                selected.includes(s.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                            )}>
                                            <ReviewerAvatar reviewer={s} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                                                {s.matched_terms?.length > 0 && (
                                                    <p className="text-[10px] text-violet-600 truncate">
                                                        {s.matched_terms.slice(0, 3).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                            <div className={cn(
                                                'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                                                selected.includes(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                                            )}>
                                                {selected.includes(s.id) && <CheckCircle2 size={10} className="text-white" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {suggestionsOpen && suggestions.length === 0 && (
                                <div className="border-t border-gray-100 px-5 py-4 text-center">
                                    <p className="text-xs text-gray-400">No expertise matches found. Use manual search below.</p>
                                </div>
                            )}

                            {/* ── Inline due-date + assign when a suggestion is selected ── */}
                            {hasSuggestionSelected && (
                                <div className="border-t border-violet-100 bg-violet-50/60 px-5 py-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={13} className="text-violet-600 shrink-0" />
                                        <p className="text-xs font-semibold text-violet-800">
                                            {selectedSuggestionIds.length} reviewer{selectedSuggestionIds.length > 1 ? 's' : ''} selected from suggestions
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                            <Calendar size={10} className="inline mr-1" />
                                            Review Due Date <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={suggestDueDate || dueDate}
                                            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                                            onChange={e => { setSuggestDueDate(e.target.value); setDueDate(e.target.value); }}
                                            className="w-full text-sm border border-violet-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                                        />
                                    </div>

                                    {!evalType && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            <AlertTriangle size={11} className="shrink-0" />
                                            Select an evaluation type in Step 1 before assigning.
                                        </div>
                                    )}

                                    <button
                                        onClick={assign}
                                        disabled={submitting || !evalType || !(suggestDueDate || dueDate)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-xs font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                    >
                                        {submitting
                                            ? <><RefreshCw size={12} className="animate-spin" /> Assigning…</>
                                            : <><Bell size={12} /> Assign & Notify {selectedSuggestionIds.length} Reviewer{selectedSuggestionIds.length > 1 ? 's' : ''}</>
                                        }
                                    </button>

                                    <p className="text-[10px] text-violet-500 text-center flex items-center justify-center gap-1">
                                        <Bell size={9} />
                                        Reviewer{selectedSuggestionIds.length > 1 ? 's' : ''} will receive an email with assignment details and due date.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Step 1 — Evaluation type */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
                            <StepHeader number="1" label="Choose Evaluation Type" done={!!evalType} />
                            {evalTypes.length === 0 ? (
                                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700">
                                        No evaluation types found for this category. Contact the administrator.
                                    </p>
                                </div>
                            ) : (
                                <select
                                    value={evalType}
                                    onChange={e => setEvalType(e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:border-gray-300 transition-colors"
                                >
                                    <option value="">Select evaluation type…</option>
                                    {evalTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.label ?? t.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Step 2 — Due date */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
                            <StepHeader number="2" label="Set Due Date" done={!!dueDate} />
                            <input
                                type="date"
                                value={dueDate}
                                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                                onChange={e => setDueDate(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:border-gray-300 transition-colors"
                            />
                        </div>

                        {/* Step 3 — Selection summary */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
                            <StepHeader number="3" label="Selection Summary" done={selected.length > 0 && !!evalType && !!dueDate} />

                            {selected.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center mb-3">
                                        <Users size={18} className="text-gray-300" />
                                    </div>
                                    <p className="text-sm text-gray-400">No reviewers selected yet</p>
                                    <p className="text-xs text-gray-300 mt-0.5">Choose from the list on the right</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {evalTypeLabel && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500 bg-indigo-50 px-3 py-2 rounded-lg">
                                            <Microscope size={12} className="text-indigo-400 shrink-0" />
                                            <span className="font-medium text-indigo-700">{evalTypeLabel}</span>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {selectedReviewers.map(r => (
                                            <div key={r.id}
                                                className="flex items-center gap-2.5 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                                                <ReviewerAvatar reviewer={r} size="sm" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">
                                                        {r.title ? `${r.title} ` : ''}{r.name}
                                                    </p>
                                                    <p className="text-[11px] text-gray-400 truncate">{r.email}</p>
                                                </div>
                                                <button onClick={() => toggleReviewer(r.id)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 text-center">
                                        {selected.length} reviewer{selected.length !== 1 ? 's' : ''} selected
                                        {selected.length > 1 && ' · interdisciplinary'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Assign button */}
                        <button
                            onClick={assign}
                            disabled={submitting || !selected.length || !evalType || !dueDate}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                        >
                            {submitting
                                ? <><RefreshCw size={14} className="animate-spin" /> Assigning…</>
                                : selected.length > 0 && !evalType
                                    ? 'Select an Evaluation Type to Continue'
                                    : selected.length > 0 && evalType && !dueDate
                                        ? 'Set a Due Date to Continue'
                                        : <><UserCheck size={15} /> Assign {selected.length > 0 ? selected.length : ''} Reviewer{selected.length !== 1 ? 's' : ''}</>
                            }
                        </button>
                    </div>

                    {/* ── RIGHT: Reviewer pool ───────────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                        {/* Panel header */}
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                    <Users size={14} className="text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-700">Available Reviewers</p>
                                    {!reviewersLoading && (
                                        <p className="text-xs text-gray-400">
                                            {reviewers.length} reviewer{reviewers.length !== 1 ? 's' : ''} found
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowFilters(f => !f)}
                                className={cn(
                                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                                    showFilters || activeFilters > 0
                                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                )}
                            >
                                <SlidersHorizontal size={13} />
                                Filters
                                {activeFilters > 0 && (
                                    <span className="bg-indigo-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                                        {activeFilters}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Search + filters */}
                        <div className="px-5 pt-4 pb-3 space-y-3 border-b border-gray-50">

                            {/* Search */}
                            <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-shadow bg-white">
                                <Search size={14} className="text-gray-400 shrink-0" />
                                <input
                                    value={filters.search}
                                    onChange={e => setFilter('search', e.target.value)}
                                    placeholder="Search by name, email, or expertise…"
                                    className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400 bg-transparent"
                                />
                                {filters.search && (
                                    <button onClick={() => setFilter('search', '')} className="text-gray-300 hover:text-gray-500 transition-colors">
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Advanced filters */}
                            {showFilters && (
                                <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expertise</label>
                                        <input
                                            value={filters.expertise}
                                            onChange={e => setFilter('expertise', e.target.value)}
                                            placeholder="e.g. Machine Learning"
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">College</label>
                                        <select
                                            value={filters.college_id}
                                            onChange={e => setFilter('college_id', e.target.value)}
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="">All colleges</option>
                                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Department</label>
                                        <select
                                            value={filters.department_id}
                                            onChange={e => setFilter('department_id', e.target.value)}
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value="">All departments</option>
                                            {departments
                                                .filter(d => !filters.college_id || d.college_id === filters.college_id)
                                                .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    {activeFilters > 0 && (
                                        <div className="col-span-2 flex justify-end">
                                            <button onClick={clearFilters}
                                                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors">
                                                <X size={11} /> Clear all filters
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Manual override toggle */}
                            <button
                                onClick={toggleOverride}
                                className={cn(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                                    override
                                        ? 'border-amber-200 bg-amber-50'
                                        : 'border-dashed border-gray-200 hover:bg-gray-50'
                                )}
                            >
                                {override
                                    ? <ToggleRight size={18} className="text-amber-500 shrink-0" />
                                    : <ToggleLeft size={18} className="text-gray-300 shrink-0" />
                                }
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-xs font-semibold', override ? 'text-amber-700' : 'text-gray-600')}>
                                        Manual override {override ? '— ON' : ''}
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        Show all eligible reviewers regardless of expertise or department match
                                    </p>
                                </div>
                            </button>

                            {/* PI exclusion notice */}
                            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                                <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-blue-600 leading-relaxed">
                                    The PI and Co-Investigators are automatically excluded from this list.
                                </p>
                            </div>
                        </div>

                        {/* Reviewer list */}
                        <div className="min-h-64">
                            {reviewersLoading ? (
                                <div className="divide-y divide-gray-50">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex items-center gap-3 px-5 py-4">
                                            <div className="h-9 w-9 rounded-full bg-gray-100 animate-pulse shrink-0" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-3.5 w-36 bg-gray-100 rounded animate-pulse" />
                                                <div className="h-3 w-52 bg-gray-100 rounded animate-pulse" />
                                                <div className="h-3 w-44 bg-gray-100 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : !hasActiveQuery ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                    <div className="h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-3">
                                        <Search size={22} className="text-indigo-300" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">Search to find reviewers</p>
                                    <p className="text-xs text-gray-400 mt-1">Type a name, email, or expertise keyword above</p>
                                </div>
                            ) : reviewers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                    <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                                        <Users size={22} className="text-gray-200" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">No reviewers found</p>
                                    {!override && activeFilters > 0 && (
                                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                            <AlertTriangle size={11} />
                                            Try broadening filters or enabling manual override
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {reviewers.map(r => {
                                        const isSelected = selected.includes(r.id);
                                        return (
                                            <button
                                                key={r.id}
                                                onClick={() => toggleReviewer(r.id)}
                                                className={cn(
                                                    'w-full flex items-start gap-3.5 px-5 py-4 text-left transition-colors',
                                                    isSelected
                                                        ? 'bg-indigo-50 hover:bg-indigo-50/80'
                                                        : 'hover:bg-gray-50/60'
                                                )}
                                            >
                                                {/* Checkbox */}
                                                <div className={cn(
                                                    'h-4.5 w-4.5 rounded border-2 flex items-center justify-center shrink-0 mt-2.5 transition-colors',
                                                    isSelected
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : 'border-gray-300 bg-white'
                                                )}>
                                                    {isSelected && <CheckCircle2 size={11} className="text-white" />}
                                                </div>

                                                <ReviewerAvatar reviewer={r} />

                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className={cn(
                                                            'text-sm font-semibold',
                                                            isSelected ? 'text-indigo-900' : 'text-gray-800'
                                                        )}>
                                                            {r.title ? `${r.title} ` : ''}{r.name}
                                                        </p>
                                                        <WorkloadBadge count={r.active_assignments} />
                                                    </div>

                                                    <p className="text-xs text-gray-400 truncate">{r.email}</p>

                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                                        {r.college?.name && (
                                                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                                                <Building2 size={10} className="text-gray-300 shrink-0" />
                                                                {r.college.name}
                                                            </span>
                                                        )}
                                                        {r.department?.name && (
                                                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                                                <Users size={10} className="text-gray-300 shrink-0" />
                                                                {r.department.name}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {r.expertise?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 pt-0.5">
                                                            {r.expertise.map((e, i) => (
                                                                <span key={i}
                                                                    className="text-[11px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
                                                                    {e}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
