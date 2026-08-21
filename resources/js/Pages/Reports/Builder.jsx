import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    Sliders, ArrowRight, ArrowLeft, RefreshCw, Clock, Layers,
    Wand2, Table2, Filter,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { post, get } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, getStatusLabel } from '../../lib/utils';
import {
    DownloadExcelButton, ReportBuilderTable,
    builderLabel, SubjectIcon,
} from '../../Components/Reports/ReportShared';

const STEPS = [
    { n: 1, label: 'Subject' },
    { n: 2, label: 'Filters' },
    { n: 3, label: 'Group by' },
    { n: 4, label: 'Metrics' },
    { n: 5, label: 'Generate' },
];

// Academic years the report builder can filter on — a wide, always-available
// range rather than only the years that already have data.
const ACADEMIC_YEARS = Array.from({ length: 100 }, (_, i) => `${2000 + i}-${2001 + i}`);

const CATEGORY_OPTIONS = [
    { value: 'research', label: 'Research' },
    { value: 'community_engagement', label: 'Community Engagement' },
    { value: 'technology_transfer', label: 'Technology Transfer' },
];

const LEVEL_OPTIONS = [
    { value: 'college', label: 'College (Level 1)' },
    { value: 'officer', label: 'Officer (Level 2)' },
];

const COMPLAINT_TYPE_OPTIONS = [
    { value: 'budget', label: 'Budget' },
    { value: 'rejection', label: 'Rejection' },
    { value: 'other', label: 'Other' },
];

const PROPOSAL_STATUSES = [
    'draft', 'submitted', 'validated', 'under_blind_review', 'blind_review_passed',
    'under_open_defence', 'accepted', 'funded', 'midterm_evaluation', 'completed',
    'archived', 'rejected',
];
const COMPLAINT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'];
const REVIEW_STATUSES = ['pending', 'accepted', 'in_progress', 'submitted', 'declined', 'overdue', 'reassigned', 'completed'];

const STATUS_OPTIONS_BY_SUBJECT = {
    proposals: PROPOSAL_STATUSES.map(s => ({ value: s, label: getStatusLabel(s) })),
    complaints: COMPLAINT_STATUSES.map(s => ({ value: s, label: builderLabel(s) })),
    review_workload: REVIEW_STATUSES.map(s => ({ value: s, label: builderLabel(s) })),
};

const SELECT_CLASS = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400';

function FilterControl({ subject, filterKey, value, onChange, colleges, lockedCollege }) {
    if (filterKey === 'college_id') {
        if (lockedCollege) {
            // College officers can only ever build reports scoped to their own
            // college (enforced server-side too) — shown locked rather than as an
            // editable dropdown so it's clear it isn't actually a choice.
            return (
                <div className={`${SELECT_CLASS} bg-gray-50 text-gray-500 flex items-center cursor-not-allowed`}>
                    {lockedCollege.name}
                </div>
            );
        }
        return (
            <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS}>
                <option value="">All Colleges</option>
                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
        );
    }
    if (filterKey === 'academic_year') {
        return (
            <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS}>
                <option value="">All Years</option>
                {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        );
    }
    if (filterKey === 'category') {
        return (
            <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS}>
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        );
    }
    if (filterKey === 'status') {
        const opts = STATUS_OPTIONS_BY_SUBJECT[subject] ?? [];
        return (
            <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS}>
                <option value="">All Statuses</option>
                {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        );
    }
    if (filterKey === 'level') {
        return (
            <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS}>
                <option value="">All Levels</option>
                {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        );
    }
    if (filterKey === 'complaint_type') {
        return (
            <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS}>
                <option value="">All Types</option>
                {COMPLAINT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        );
    }
    return (
        <input value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS} />
    );
}

export default function ReportBuilder() {
    const { user: currentUser, hasRole } = useAuth();
    const isCollegeOfficer = hasRole('college_officer');
    const [options,      setOptions]      = useState(null);
    const [optionsError, setOptionsError] = useState(null);
    const [subject,      setSubject]      = useState('');
    const [dimensions,   setDimensions]   = useState([]);
    const [metrics,      setMetrics]      = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [generating,   setGenerating]   = useState(false);
    const [result,       setResult]       = useState(null);

    const [colleges,       setColleges]       = useState([]);
    const [history,        setHistory]        = useState([]);
    const [historyLoading, setHistoryLoading]  = useState(true);

    useEffect(() => {
        get('/reports/builder-options')
            .then(r => setOptions(r.data ?? {}))
            .catch(e => {
                setOptions({});
                setOptionsError(
                    e.response?.status === 403
                        ? "You don't have permission to use the Report Builder."
                        : 'Could not load report subjects. Please refresh and try again.'
                );
            });
        get('/colleges').then(r => setColleges(r.data ?? [])).catch(() => {});
    }, []);

    const loadHistory = useCallback(() =>
        get('/reports')
            .then(r => {
                const all = r.data?.data ?? [];
                setHistory(all.filter(s => s.report_type === 'custom_builder'));
            })
            .catch(() => {})
            .finally(() => setHistoryLoading(false)),
    []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const lockedCollege = isCollegeOfficer ? colleges.find(c => c.id === currentUser?.college_id) : null;
    const subjectOptions = subject && options ? options[subject] : null;
    const step = !subject ? 1 : metrics.length > 0 ? 5 : dimensions.length > 0 ? 4 : 3;

    const chooseSubject = (s) => {
        setSubject(s);
        setDimensions([]);
        setFilterValues({});
        const m = options?.[s]?.metrics ?? [];
        setMetrics(m.includes('count') ? ['count'] : []);
        setResult(null);
    };

    const toggleIn = (list, setList, value) => {
        setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
    };

    const setFilterValue = (key, value) => setFilterValues(prev => ({ ...prev, [key]: value }));

    const generate = async () => {
        setGenerating(true);
        try {
            const activeFilters = Object.fromEntries(
                Object.entries(filterValues).filter(([, v]) => v)
            );
            const res = await post('/reports/generate', {
                type: 'custom_builder',
                filters: {
                    subject,
                    dimensions,
                    metrics,
                    ...activeFilters,
                },
            });
            const snap = res.data?.data ?? res.data ?? null;
            setResult(snap);
            loadHistory();
        } catch (e) {
            alert(e.response?.data?.message ?? 'Generation failed.');
        }
        setGenerating(false);
    };

    const reset = () => {
        setSubject('');
        setDimensions([]);
        setMetrics([]);
        setFilterValues({});
        setResult(null);
    };

    const ready = subject && metrics.length > 0;

    return (
        <AppLayout breadcrumb="Report Builder">
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/reports"
                            className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 shrink-0"
                        >
                            <ArrowLeft size={16} />
                        </Link>
                        <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                            <Sliders size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Report Builder</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Build your own report from a subject, filters, dimensions, and metrics</p>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-5 gap-6">

                    {/* ── Config wizard ── */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Stepper */}
                            <div className="flex items-center px-5 py-4 border-b border-gray-100 bg-gray-50/60">
                                {STEPS.map((s, i) => (
                                    <div key={s.n} className="flex items-center flex-1 last:flex-none">
                                        <div className="flex items-center gap-2">
                                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                                step >= s.n ? 'bg-slate-800 text-white' : 'bg-gray-200 text-gray-500'
                                            }`}>
                                                {s.n}
                                            </div>
                                            <span className={`text-xs font-semibold hidden sm:inline ${step >= s.n ? 'text-slate-800' : 'text-gray-400'}`}>
                                                {s.label}
                                            </span>
                                        </div>
                                        {i < STEPS.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-2 rounded ${step > s.n ? 'bg-slate-800' : 'bg-gray-200'}`} />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-5 space-y-5">
                                {/* Subject */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Subject</label>
                                    {!options ? (
                                        <div className="space-y-2">
                                            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
                                        </div>
                                    ) : optionsError ? (
                                        <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3">
                                            <p className="text-xs font-medium text-red-600">{optionsError}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {Object.keys(options).map(s => (
                                                <button key={s} type="button" onClick={() => chooseSubject(s)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                                        subject === s ? 'border-slate-700 bg-slate-50 shadow-sm' : 'border-gray-100 hover:border-gray-200'
                                                    }`}
                                                >
                                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                        subject === s ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        <SubjectIcon subject={s} size={15} />
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-800">{builderLabel(s)}</p>
                                                    {subject === s && <ArrowRight size={14} className="ml-auto text-slate-700" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {subjectOptions && (
                                    <>
                                        {/* Filters */}
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">
                                                <Filter size={11} /> Filters <span className="font-normal normal-case text-gray-400">(optional)</span>
                                            </label>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {subjectOptions.filters.map(key => (
                                                    <div key={key}>
                                                        <label className="block text-[11px] font-medium text-gray-500 mb-1">{builderLabel(key)}</label>
                                                        <FilterControl
                                                            subject={subject}
                                                            filterKey={key}
                                                            value={filterValues[key] ?? ''}
                                                            onChange={v => setFilterValue(key, v)}
                                                            colleges={colleges}
                                                            lockedCollege={lockedCollege}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Group by */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">
                                                Group by <span className="font-normal normal-case text-gray-400">(optional)</span>
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {subjectOptions.dimensions.map(dim => (
                                                    <button key={dim} type="button"
                                                        onClick={() => toggleIn(dimensions, setDimensions, dim)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                                            dimensions.includes(dim)
                                                                ? 'bg-slate-700 border-slate-700 text-white'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        {builderLabel(dim)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Metrics */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Metrics</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {subjectOptions.metrics.map(metric => (
                                                    <button key={metric} type="button"
                                                        onClick={() => toggleIn(metrics, setMetrics, metric)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                                            metrics.includes(metric)
                                                                ? 'bg-slate-700 border-slate-700 text-white'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        {builderLabel(metric)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                onClick={generate}
                                                disabled={generating || !ready}
                                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {generating
                                                    ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                                                    : <><Wand2 size={14} /> Generate Report</>
                                                }
                                            </button>
                                            <button
                                                onClick={reset}
                                                type="button"
                                                className="px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* History */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-gray-800">Your Builder Reports</h2>
                                <button onClick={loadHistory} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                                    <RefreshCw size={11} /> Refresh
                                </button>
                            </div>

                            {historyLoading ? (
                                <div className="space-y-2">
                                    {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
                                </div>
                            ) : history.length === 0 ? (
                                <div className="py-6 text-center text-gray-400">
                                    <Layers size={24} className="mx-auto mb-1.5 opacity-40" />
                                    <p className="text-xs">No custom reports generated yet</p>
                                </div>
                            ) : (
                                <ul className="space-y-1.5">
                                    {history.map(s => (
                                        <li key={s.id}>
                                            <button
                                                type="button"
                                                onClick={() => setResult(s)}
                                                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all hover:shadow-sm ${
                                                    result?.id === s.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-100 bg-white'
                                                }`}
                                            >
                                                <Table2 size={13} className="text-slate-500 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-gray-700 truncate">
                                                        {builderLabel(s.result?.subject ?? 'Report')}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Clock size={9} className="text-gray-400" />
                                                        <p className="text-[10px] text-gray-400">{formatDateTime(s.completed_at ?? s.created_at)}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                                                    s.status === 'ready'      ? 'bg-green-100 text-green-700' :
                                                    s.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>{s.status}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* ── Preview / results ── */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-112">
                            {result ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                {builderLabel(result.result?.subject ?? '')}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                Generated {formatDateTime(result.completed_at ?? result.created_at)}
                                            </p>
                                        </div>
                                        <DownloadExcelButton snapshot={result} />
                                    </div>
                                    <ReportBuilderTable data={result.result} />
                                </div>
                            ) : generating ? (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
                                    <RefreshCw size={36} className="mb-3 animate-spin text-slate-500" />
                                    <p className="text-sm font-medium">Generating your report…</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
                                    <Sliders size={40} className="mb-3 opacity-40" />
                                    <p className="text-sm font-medium text-gray-500">
                                        {subject ? 'Choose your metrics, then generate' : 'Choose a subject to get started'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">Your report preview will appear here</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
