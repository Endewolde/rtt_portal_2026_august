import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    TrendingUp, RefreshCw, Search, ChevronLeft, ChevronRight, ExternalLink,
    ArrowUp, ArrowDown, ArrowUpDown, Building2, Wallet, Download, AlertTriangle, Archive,
    Gavel, X, ArrowLeft, Upload, FileDown, CheckCircle2, FileUp,
    Clock, ClipboardCheck, Layers, FileSignature, Banknote, Loader2,
} from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, EmptyState, Skeleton, Select, RefreshButton } from '../../Components/Insights/Kit';
import ProposalHover from '../../Components/Finance/ProposalHover';
import SavedViews, { readSharedView } from '../../Components/SavedViews';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { useFeature } from '../../hooks/useFeature';
import { useToast } from '../../Components/Toast';
import api, { get, post } from '../../lib/api';
import { formatDate, formatCurrency, getCategoryLabel, getStatusLabel } from '../../lib/utils';
import { currency } from '../../lib/terms';
import { programmeColor, programmeKeys } from '../../lib/programmes';

// Same category-specific lookup fallbacks the normal proposal wizard uses
// (resources/js/Pages/Proposals/Create.jsx) — kept in sync so a legacy-created
// proposal offers the same Focus Area / Research Type choices as a normal one.
const FOCUS_AREA_FALLBACK = {
    research: ['Agriculture & Food Systems', 'Health & Biomedical Sciences', 'Engineering & Technology', 'Other'],
    community_engagement: ['Health & Well-being', 'Education & Literacy', 'Environmental Conservation', 'Other'],
    technology_transfer: ['Product Innovation', 'Process Innovation', 'Knowledge & Technology Transfer', 'Other'],
};
const RESEARCH_TYPE_FALLBACK = ['Basic Research', 'Applied Research', 'Experimental Development', 'Clinical Research', 'Action Research', 'Review / Meta-analysis'];
const DURATION_OPTIONS = [3, 6, 9, 12, 18, 24, 30, 36, 48, 60];

async function downloadBlob(axiosPromise, filename) {
    const response = await axiosPromise;
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function parseLocalCsv(text) {
    const lines = text.trim().split('\n').filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };
    const parseLine = (line) => line.split(',').map(c => c.trim());
    const bom = '﻿';
    const first = lines[0].startsWith(bom) ? lines[0].slice(1) : lines[0];
    return { headers: parseLine(first), rows: lines.slice(1).map(parseLine) };
}


const MIDTERM_LABELS = {
    scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
    report_submitted: { label: 'Report Submitted', cls: 'bg-amber-100 text-amber-700' },
    scored: { label: 'Scored', cls: 'bg-purple-100 text-purple-700' },
    completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
};

function MidtermBadge({ status }) {
    if (!status) {
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Not Scheduled</span>;
    }
    const meta = MIDTERM_LABELS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>;
}

const WORKSHOP_LABELS = {
    scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
    postponed: { label: 'Postponed', cls: 'bg-amber-100 text-amber-700' },
};

// The completion workshop only happens once the midterm is scored with
// recommendation=continue — there's no separate proposal status for it, so
// "needsWorkshop" is what tells us whether "no status yet" means "not due yet"
// or "overdue to schedule."
function WorkshopBadge({ status, needsWorkshop }) {
    if (!status) {
        return needsWorkshop
            ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Needs Scheduling</span>
            : <span className="text-xs text-gray-400">—</span>;
    }
    const meta = WORKSHOP_LABELS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>;
}

const CONTRACT_LABELS = {
    approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

function ContractBadge({ status }) {
    if (!status) {
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Not Submitted</span>;
    }
    const meta = CONTRACT_LABELS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>;
}

function UtilizationBar({ allocated, utilized }) {
    const pct = allocated > 0 ? Math.min(100, Math.round((utilized / allocated) * 100)) : 0;
    const tone = pct > 90 ? 'bg-red-500' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-500';
    return (
        <div className="min-w-32">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold tabular-nums text-gray-800">{pct}%</span>
                <span className="truncate tabular-nums text-gray-400">{formatCurrency(utilized ?? 0)} / {formatCurrency(allocated ?? 0)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─── Grant legacy proposal (super_admin override) ──────────────────────────────
//
// For proposals that were actually funded outside — or before — this system's
// normal submit/review/award workflow (legacy data, or a status that never
// reflected reality). This bypasses that workflow entirely, so it's kept as a
// deliberately narrow, two-step flow: pick the proposal, then justify + record it.

function SingleGrantPanel({ onGranted, onClose }) {
    const toast = useToast();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState(null);
    const [justification, setJustification] = useState('');
    const [awardedAmount, setAwardedAmount] = useState('');
    const [grantReference, setGrantReference] = useState('');
    const [approvedAt, setApprovedAt] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (selected) return;
        setSearching(true);
        const t = setTimeout(() => {
            get('/ongoing-proposals/grantable', { q: query || undefined })
                .then(r => setResults(r.data ?? []))
                .catch(() => {})
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(t);
    }, [query, selected]);

    const submit = async () => {
        if (!selected) return;
        setSubmitting(true);
        try {
            await post(`/ongoing-proposals/${selected.id}/grant-legacy`, {
                justification,
                awarded_amount: awardedAmount,
                grant_reference: grantReference || undefined,
                approved_at: approvedAt || undefined,
            });
            toast.success(`${selected.tracker_number} granted — now tracked as ongoing.`);
            onGranted();
            onClose();
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Could not grant this proposal.');
        }
        setSubmitting(false);
    };

    const canSubmit = justification.trim().length >= 10 && awardedAmount !== '' && Number(awardedAmount) >= 0;

    if (!selected) {
        return (
            <>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search tracker # or title…"
                        className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                </div>
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {searching && (
                        <p className="px-4 py-6 text-center text-xs text-gray-400">Searching…</p>
                    )}
                    {!searching && results.length === 0 && (
                        <p className="px-4 py-6 text-center text-xs text-gray-400">
                            No eligible proposals found. Only proposals not already funded, ongoing, or archived — and without an existing award — show up here.
                        </p>
                    )}
                    {!searching && results.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSelected(p)}
                            className="w-full text-left px-4 py-3 hover:bg-emerald-50/60 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{p.tracker_number}</span>
                                <span className="text-[11px] text-gray-400">{getStatusLabel(p.status)}</span>
                            </div>
                            <p className="text-sm text-gray-800 mt-1 line-clamp-1">{p.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{p.pi?.name ?? '—'} · {p.college?.name ?? '—'}</p>
                        </button>
                    ))}
                </div>
            </>
        );
    }

    return (
        <>
            <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700">
                <ArrowLeft size={12} /> Choose a different proposal
            </button>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{selected.tracker_number}</span>
                    <span className="text-[11px] text-gray-400">currently {selected.status}</span>
                </div>
                <p className="text-sm text-gray-800 mt-1">{selected.title}</p>
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Justification <span className="text-red-500">*</span></label>
                <textarea
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    rows={3}
                    placeholder="Why is this proposal being granted outside the normal workflow? (min 10 characters — recorded in the audit trail)"
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-600">Awarded Amount ({currency()}) <span className="text-red-500">*</span></label>
                    <input
                        type="number" min="0" step="0.01"
                        value={awardedAmount}
                        onChange={e => setAwardedAmount(e.target.value)}
                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-600">Grant Date</label>
                    <input
                        type="date"
                        value={approvedAt}
                        onChange={e => setApprovedAt(e.target.value)}
                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                </div>
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Grant Reference <span className="text-gray-400 font-normal">(optional — auto-generated if left blank)</span></label>
                <input
                    value={grantReference}
                    onChange={e => setGrantReference(e.target.value)}
                    placeholder="e.g. an official pre-existing grant number"
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
            </div>

            <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {submitting ? 'Granting…' : 'Grant Proposal'}
            </button>
        </>
    );
}

// Mirrors the CSV-import pattern already established for Users.jsx: local
// parse-and-preview first five rows, submit to the server for the real
// per-row validation, show a summary + per-row error table. One shared
// justification for the whole batch, since every row needs the same "why."
function BulkGrantPanel({ onGranted }) {
    const toast = useToast();
    const fileRef = useRef(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [justification, setJustification] = useState('');
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);

    const handleFile = (f) => {
        if (!f) return;
        setFile(f);
        setResult(null);
        const reader = new FileReader();
        reader.onload = e => {
            const { headers, rows } = parseLocalCsv(e.target.result);
            setPreview({ headers, rows: rows.slice(0, 5) });
        };
        reader.readAsText(f);
    };

    const downloadTemplate = () => {
        downloadBlob(
            api.get('/ongoing-proposals/grant-legacy/import-template', { responseType: 'blob' }),
            'legacy_proposals_import_template.csv'
        ).catch(() => toast.error('Could not download template.'));
    };

    const doImport = async () => {
        if (!file || justification.trim().length < 10) return;
        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('justification', justification);
            const res = await api.post('/ongoing-proposals/grant-legacy/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(res.data?.data);
            toast.success(res.data?.message ?? 'Import complete.');
            onGranted();
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Import failed.');
        }
        setImporting(false);
    };

    const reset = () => { setFile(null); setPreview(null); setResult(null); };
    const canImport = !!file && justification.trim().length >= 10 && !importing;

    if (result) {
        return (
            <div className="space-y-4">
                <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${result.summary.errors === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                    {result.summary.errors === 0
                        ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                        : <AlertTriangle size={20} className="text-amber-500 shrink-0" />}
                    <div>
                        <p className={`text-sm font-semibold ${result.summary.errors === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                            {result.summary.errors === 0 ? 'Import completed successfully' : 'Import finished with some errors'}
                        </p>
                        <p className={`text-xs mt-0.5 ${result.summary.errors === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {result.summary.created} of {result.summary.total} granted
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total', val: result.summary.total, color: '#4f46e5' },
                        { label: 'Granted', val: result.summary.created, color: '#059669' },
                        { label: 'Errors', val: result.summary.errors, color: '#dc2626' },
                    ].map(s => (
                        <div key={s.label} className="rounded-xl border border-gray-200 p-3 text-center">
                            <p className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.val}</p>
                            <p className="text-[11px] font-semibold text-gray-500 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                {result.errors?.length > 0 && (
                    <div>
                        <p className="text-[11px] font-semibold text-red-500 uppercase tracking-widest mb-2">Row errors</p>
                        <div className="rounded-xl overflow-hidden border border-red-100 max-h-48 overflow-y-auto">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs">
                                    <thead>
                                        <tr className="bg-red-50 border-b border-red-100"><th className="px-3 py-2 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                            <th className="px-3 py-2 text-left font-semibold text-red-400 w-12">Row</th>
                                            <th className="px-3 py-2 text-left font-semibold text-red-400">Tracker</th>
                                            <th className="px-3 py-2 text-left font-semibold text-red-400">Issue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.errors.map((e, i) => (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}><td className="px-3 py-2 w-10 text-xs font-medium tabular-nums text-gray-400">{i + 1}</td>
                                                <td className="px-3 py-2 font-mono text-gray-400">{e.row}</td>
                                                <td className="px-3 py-2 text-gray-600">{e.tracker_number}</td>
                                                <td className="px-3 py-2 text-red-500">{e.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                <button onClick={reset} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                    ← Import another file
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <div>
                    <p className="text-xs font-semibold text-gray-700">CSV columns</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">tracker_number*, awarded_amount*, grant_reference, approved_at</p>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">
                    <FileDown size={12} /> Template
                </button>
            </div>

            <div
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors"
                style={{ borderColor: file ? '#10b981' : '#e2e8f0', background: file ? 'rgba(16,185,129,0.04)' : '#fafafa' }}
            >
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
                {file ? (
                    <>
                        <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                        <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                        <p className="text-xs text-indigo-500 mt-0.5">click to replace</p>
                    </>
                ) : (
                    <>
                        <FileUp size={24} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Click to upload a CSV file</p>
                    </>
                )}
            </div>

            {preview && (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="min-w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100"><th className="px-3 py-2 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                {preview.headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {preview.rows.map((row, ri) => (
                                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}><td className="px-3 py-2 w-10 text-xs font-medium tabular-nums text-gray-400">{ri + 1}</td>
                                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap">{cell || <span className="text-gray-300">—</span>}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div>
                <label className="text-xs font-semibold text-gray-600">Justification for this batch <span className="text-red-500">*</span></label>
                <textarea
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    rows={2}
                    placeholder="Why are these proposals being granted outside the normal workflow? (min 10 characters — applied to every row, recorded in the audit trail)"
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
            </div>

            <button
                onClick={doImport}
                disabled={!canImport}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {importing ? <><RefreshCw size={13} className="animate-spin" /> Importing…</> : <><Upload size={13} /> Import & Grant</>}
            </button>
        </>
    );
}

// For proposals that were entirely paper-based/manual and were never entered
// into the system at all — there's no existing row to search for, so this
// creates the Proposal from scratch (real tracker_number, reserved "Legacy /
// Manual Grants" call) and grants it in one step. The PI must already have an
// account — deliberately no inline user creation here, to avoid silently
// provisioning login-capable accounts as a side effect of a grant action.
// The /users endpoint always returns a Laravel paginator under `data`
// (data.data.data, not data.data) — this unwraps either shape defensively,
// same fallback the proposal wizard's co-investigator search already uses.
function unwrapUserList(r) {
    return r?.data?.data ?? r?.data ?? [];
}

function NewProposalGrantPanel({ onGranted, onClose }) {
    const toast = useToast();
    const { hasSubFeature } = useFeature();
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('research');
    const [abstract, setAbstract] = useState('');
    const [keywords, setKeywords] = useState('');
    const [lookupOptions, setLookupOptions] = useState(null);
    const [focusArea, setFocusArea] = useState('');
    const [researchType, setResearchType] = useState('');
    const [durationMonths, setDurationMonths] = useState('');
    const [ecRequired, setEcRequired] = useState(false);
    const [ecNumber, setEcNumber] = useState('');
    const [colleges, setColleges] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [collegeId, setCollegeId] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [academicYears, setAcademicYears] = useState([]);
    const [academicYear, setAcademicYear] = useState('');
    const [customYear, setCustomYear] = useState(false);
    const [piQuery, setPiQuery] = useState('');
    const [piResults, setPiResults] = useState([]);
    const [piSearching, setPiSearching] = useState(false);
    const [selectedPi, setSelectedPi] = useState(null);
    const [coInvQuery, setCoInvQuery] = useState('');
    const [coInvResults, setCoInvResults] = useState([]);
    const [coInvSearching, setCoInvSearching] = useState(false);
    const [coInvestigators, setCoInvestigators] = useState([]);
    const [justification, setJustification] = useState('');
    const [awardedAmount, setAwardedAmount] = useState('');
    const [grantReference, setGrantReference] = useState('');
    const [approvedAt, setApprovedAt] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isResearch = category === 'research';
    const groupKey = category === 'community_engagement' ? 'community_focus_area'
        : category === 'technology_transfer' ? 'technology_focus_area' : 'research_focus_area';
    const focusOptions = lookupOptions?.[groupKey] ?? FOCUS_AREA_FALLBACK[category] ?? FOCUS_AREA_FALLBACK.research;
    const researchTypeOptions = lookupOptions?.research_type ?? RESEARCH_TYPE_FALLBACK;
    const abstractOk = abstract.length >= 100;

    useEffect(() => {
        get('/colleges').then(r => setColleges(r.data ?? [])).catch(() => {});
        get('/ongoing-proposals/grant-legacy/academic-years').then(r => setAcademicYears(r.data ?? [])).catch(() => {});
        get('/lookup-options/active').then(r => setLookupOptions(r.data ?? null)).catch(() => {});
    }, []);

    useEffect(() => { setFocusArea(''); setResearchType(''); }, [category]);

    useEffect(() => {
        setDepartmentId('');
        if (!collegeId) { setDepartments([]); return; }
        get('/departments', { college_id: collegeId }).then(r => setDepartments(r.data ?? [])).catch(() => {});
    }, [collegeId]);

    useEffect(() => {
        if (selectedPi) return;
        setPiSearching(true);
        const t = setTimeout(() => {
            get('/users', { search: piQuery, role: 'staff' })
                .then(r => setPiResults(unwrapUserList(r)))
                .catch(() => {})
                .finally(() => setPiSearching(false));
        }, 300);
        return () => clearTimeout(t);
    }, [piQuery, selectedPi]);

    useEffect(() => {
        if (coInvQuery.trim().length === 0) { setCoInvResults([]); return; }
        setCoInvSearching(true);
        const t = setTimeout(() => {
            get('/users', { search: coInvQuery })
                .then(r => setCoInvResults(unwrapUserList(r)))
                .catch(() => {})
                .finally(() => setCoInvSearching(false));
        }, 300);
        return () => clearTimeout(t);
    }, [coInvQuery]);

    const addCoInvestigator = (u) => {
        if (u.id === selectedPi?.id || coInvestigators.some(c => c.user_id === u.id)) return;
        setCoInvestigators(list => [...list, { user_id: u.id, name: u.name, email: u.email, contribution_percentage: '' }]);
        setCoInvQuery('');
        setCoInvResults([]);
    };
    const removeCoInvestigator = (userId) => setCoInvestigators(list => list.filter(c => c.user_id !== userId));
    const updateCoInvestigatorPct = (userId, pct) =>
        setCoInvestigators(list => list.map(c => (c.user_id === userId ? { ...c, contribution_percentage: pct } : c)));

    const submit = async () => {
        setSubmitting(true);
        try {
            await post('/ongoing-proposals/grant-legacy/create', {
                title,
                category,
                abstract,
                keywords: keywords || undefined,
                focus_area: focusArea,
                research_type: isResearch ? researchType : undefined,
                duration_months: durationMonths,
                ethical_clearance_required: ecRequired,
                ethical_clearance_number: ecRequired ? ecNumber : undefined,
                college_id: collegeId,
                department_id: departmentId,
                pi_user_id: selectedPi?.id,
                academic_year: academicYear,
                justification,
                awarded_amount: awardedAmount,
                grant_reference: grantReference || undefined,
                approved_at: approvedAt || undefined,
                co_investigators: coInvestigators.length
                    ? coInvestigators.map(c => ({
                        user_id: c.user_id,
                        contribution_percentage: c.contribution_percentage === '' ? undefined : c.contribution_percentage,
                    }))
                    : undefined,
            });
            toast.success('Proposal created and granted — now tracked as ongoing.');
            onGranted();
            onClose();
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Could not create and grant this proposal.');
        }
        setSubmitting(false);
    };

    const canSubmit = title.trim().length > 0 && collegeId && departmentId && selectedPi
        && /^\d{4}-\d{4}$/.test(academicYear) && justification.trim().length >= 10
        && awardedAmount !== '' && Number(awardedAmount) >= 0
        && abstractOk && focusArea && durationMonths && (!isResearch || researchType)
        && (!ecRequired || ecNumber.trim().length > 0);

    return (
        <>
            <div>
                <label className="text-xs font-semibold text-gray-600">Proposal Title <span className="text-red-500">*</span></label>
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Community water access improvement study"
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-600">Category <span className="text-red-500">*</span></label>
                    <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                        {programmeKeys().map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-600">Academic Year <span className="text-red-500">*</span></label>
                    {customYear ? (
                        <div className="flex gap-1.5 mt-1">
                            <input
                                autoFocus
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                                placeholder="e.g. 2018-2019"
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            />
                            <button
                                type="button"
                                onClick={() => { setCustomYear(false); setAcademicYear(''); }}
                                className="shrink-0 px-2.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
                            >
                                List
                            </button>
                        </div>
                    ) : (
                        <select
                            value={academicYear}
                            onChange={e => {
                                if (e.target.value === '__other__') { setCustomYear(true); setAcademicYear(''); }
                                else setAcademicYear(e.target.value);
                            }}
                            className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        >
                            <option value="">Select…</option>
                            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                            <option value="__other__">Other (older, not listed)…</option>
                        </select>
                    )}
                </div>
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Abstract <span className="text-red-500">*</span></label>
                <textarea
                    value={abstract}
                    onChange={e => setAbstract(e.target.value)}
                    rows={4}
                    placeholder="Summarize the proposal (minimum 100 characters)…"
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                />
                <p className={`text-xs mt-1 ${abstractOk ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {abstract.length} / 100 characters minimum{abstractOk ? ' — meets requirement' : ''}
                </p>
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Keywords <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    placeholder="e.g. machine learning, climate change, Ethiopian agriculture"
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <p className="text-xs text-gray-400 mt-1">Separate keywords with commas.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className={isResearch ? '' : 'col-span-2'}>
                    <label className="text-xs font-semibold text-gray-600">Focus Area <span className="text-red-500">*</span></label>
                    <select
                        value={focusArea}
                        onChange={e => setFocusArea(e.target.value)}
                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                        <option value="">Select…</option>
                        {focusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                {isResearch && (
                    <div>
                        <label className="text-xs font-semibold text-gray-600">Research Type <span className="text-red-500">*</span></label>
                        <select
                            value={researchType}
                            onChange={e => setResearchType(e.target.value)}
                            className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        >
                            <option value="">Select…</option>
                            {researchTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Duration <span className="text-red-500">*</span></label>
                <select
                    value={durationMonths}
                    onChange={e => setDurationMonths(e.target.value)}
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                >
                    <option value="">Select duration…</option>
                    {DURATION_OPTIONS.map(m => (
                        <option key={m} value={m}>{m < 12 ? `${m} months` : `${m / 12} year${m > 12 ? 's' : ''}`}</option>
                    ))}
                </select>
            </div>

            {hasSubFeature('workflow.ethical_clearance') && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={ecRequired}
                            onChange={e => { setEcRequired(e.target.checked); if (!e.target.checked) setEcNumber(''); }}
                            className="h-4 w-4 rounded border-gray-300 text-amber-600"
                        />
                        This proposal required ethical clearance approval
                    </label>
                    {ecRequired && (
                        <input
                            value={ecNumber}
                            onChange={e => setEcNumber(e.target.value)}
                            placeholder="Clearance reference number, e.g. EC-2022-00123"
                            className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-600">College <span className="text-red-500">*</span></label>
                    <select
                        value={collegeId}
                        onChange={e => setCollegeId(e.target.value)}
                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                        <option value="">Select…</option>
                        {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-600">Department <span className="text-red-500">*</span></label>
                    <select
                        value={departmentId}
                        onChange={e => setDepartmentId(e.target.value)}
                        disabled={!collegeId}
                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50"
                    >
                        <option value="">Select…</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Principal Investigator <span className="text-red-500">*</span></label>
                {selectedPi ? (
                    <div className="mt-1 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                        <div>
                            <p className="text-sm text-gray-800 font-medium">{selectedPi.name}</p>
                            <p className="text-xs text-gray-400">{selectedPi.email}</p>
                        </div>
                        <button onClick={() => setSelectedPi(null)} className="text-xs font-semibold text-gray-500 hover:text-gray-700">Change</button>
                    </div>
                ) : (
                    <>
                        <div className="relative mt-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={piQuery}
                                onChange={e => setPiQuery(e.target.value)}
                                placeholder="Search PI by name or email…"
                                className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            />
                        </div>
                        {piQuery.trim().length > 0 && (
                            <div className="mt-1 border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-40 overflow-y-auto">
                                {piSearching && <p className="px-3 py-3 text-center text-xs text-gray-400">Searching…</p>}
                                {!piSearching && piResults.length === 0 && (
                                    <p className="px-3 py-3 text-center text-xs text-gray-400">No matching staff account found. The PI must already have a staff account — create one via Users first.</p>
                                )}
                                {!piSearching && piResults.map(u => (
                                    <button key={u.id} onClick={() => setSelectedPi(u)} className="w-full text-left px-3 py-2 hover:bg-emerald-50/60 transition-colors">
                                        <p className="text-sm text-gray-800">{u.name}</p>
                                        <p className="text-xs text-gray-400">{u.email}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Co-Investigators <span className="text-gray-400 font-normal">(optional)</span></label>
                {coInvestigators.length > 0 && (
                    <div className="mt-1 space-y-1.5">
                        {coInvestigators.map(c => (
                            <div key={c.user_id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-800 truncate">{c.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{c.email}</p>
                                </div>
                                <input
                                    type="number" min="0" max="100" step="1"
                                    value={c.contribution_percentage}
                                    onChange={e => updateCoInvestigatorPct(c.user_id, e.target.value)}
                                    placeholder="%"
                                    className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                />
                                <button onClick={() => removeCoInvestigator(c.user_id)} className="text-gray-400 hover:text-red-600 shrink-0">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="relative mt-1.5">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={coInvQuery}
                        onChange={e => setCoInvQuery(e.target.value)}
                        placeholder="Search to add a co-investigator…"
                        className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                </div>
                {coInvQuery.trim().length > 0 && (
                    <div className="mt-1 border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-32 overflow-y-auto">
                        {coInvSearching && <p className="px-3 py-3 text-center text-xs text-gray-400">Searching…</p>}
                        {!coInvSearching && coInvResults.length === 0 && (
                            <p className="px-3 py-3 text-center text-xs text-gray-400">No matching account found.</p>
                        )}
                        {!coInvSearching && coInvResults.map(u => (
                            <button key={u.id} onClick={() => addCoInvestigator(u)} className="w-full text-left px-3 py-2 hover:bg-emerald-50/60 transition-colors">
                                <p className="text-sm text-gray-800">{u.name}</p>
                                <p className="text-xs text-gray-400">{u.email}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Justification <span className="text-red-500">*</span></label>
                <textarea
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    rows={2}
                    placeholder="Why is this being recorded outside the normal workflow? (min 10 characters — recorded in the audit trail)"
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-600">Awarded Amount ({currency()}) <span className="text-red-500">*</span></label>
                    <input
                        type="number" min="0" step="0.01"
                        value={awardedAmount}
                        onChange={e => setAwardedAmount(e.target.value)}
                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-600">Grant Date</label>
                    <input
                        type="date"
                        value={approvedAt}
                        onChange={e => setApprovedAt(e.target.value)}
                        className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                </div>
            </div>

            <div>
                <label className="text-xs font-semibold text-gray-600">Grant Reference <span className="text-gray-400 font-normal">(optional — auto-generated if left blank)</span></label>
                <input
                    value={grantReference}
                    onChange={e => setGrantReference(e.target.value)}
                    placeholder="e.g. an official pre-existing grant number"
                    className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
            </div>

            <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {submitting ? 'Creating & Granting…' : 'Create & Grant Proposal'}
            </button>
        </>
    );
}

function GrantLegacyModal({ onClose, onGranted }) {
    const [mode, setMode] = useState('single');

    return createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                <div className="bg-linear-to-r from-slate-900 to-emerald-950 px-6 py-5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <Gavel size={18} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Grant Legacy Proposal</h2>
                                <p className="text-xs text-slate-300 mt-0.5">Administrative override — bypasses the normal review workflow</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
                            <X size={16} className="text-white" />
                        </button>
                    </div>
                    <div className="mt-4 flex gap-1 bg-white/10 rounded-xl p-1">
                        {[
                            { key: 'single', label: 'Single Proposal' },
                            { key: 'bulk', label: 'Bulk Import (CSV)' },
                            { key: 'new', label: 'New Proposal' },
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => setMode(t.key)}
                                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${mode === t.key ? 'bg-white text-emerald-900' : 'text-slate-200 hover:bg-white/10'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-6 py-5 space-y-4 overflow-y-auto">
                    {mode === 'single' && <SingleGrantPanel onGranted={onGranted} onClose={onClose} />}
                    {mode === 'bulk' && <BulkGrantPanel onGranted={onGranted} />}
                    {mode === 'new' && <NewProposalGrantPanel onGranted={onGranted} onClose={onClose} />}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Sortable header ─────────────────────────────────────────────────────────

const SORT_COLUMNS = [
    { key: 'tracker', label: 'Proposal' },
    { key: 'pi', label: 'PI' },
    { key: 'college', label: 'College' },
    { key: 'funded_at', label: 'Funded' },
];

function SortableHeader({ column, sortKey, sortDir, onSort }) {
    const active = sortKey === column.key;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">
            <button onClick={() => onSort(column.key)} className={`inline-flex items-center gap-1 transition-colors ${active ? 'text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}>
                {column.label}
                <Icon size={11} className={active ? 'opacity-100' : 'opacity-40'} />
            </button>
        </th>
    );
}

// Single source of truth for "what's the one thing blocking this proposal right
// now" — ordered roughly by how blocking each gap is. Shared by the desktop
// table and mobile cards so the two can never show different actions.
function primaryAction(p) {
    if (p.needs_contract) return { type: 'link', href: '/admin/awarded', label: 'Review contract', cls: 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100' };
    if (p.needs_midterm) return { type: 'link', href: '/midterm-evaluations', label: 'Schedule midterm', cls: 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100' };
    if (p.needs_completion_workshop) return { type: 'link', href: '/completion-workshops', label: 'Schedule workshop', cls: 'bg-purple-50 text-purple-700 ring-purple-200 hover:bg-purple-100' };
    if (p.needs_disbursement) return { type: 'link', href: '/disbursements', label: 'Disburse', cls: 'bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100' };
    if (p.needs_archiving) return { type: 'archive' };
    return { type: 'view' };
}

function ActionCell({ p, canArchive, onRequestArchive }) {
    const action = primaryAction(p);
    const base = 'inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition';

    if (action.type === 'link') {
        return <a href={action.href} className={`${base} ${action.cls}`}>{action.label} <ExternalLink size={11} /></a>;
    }
    if (action.type === 'archive') {
        return canArchive ? (
            <button onClick={() => onRequestArchive(p)} className={`${base} bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100`}>
                <Archive size={12} /> Archive
            </button>
        ) : (
            <span className="text-xs text-gray-400">Awaiting archive</span>
        );
    }
    return <a href={`/proposals/${p.id}`} className={`${base} bg-white text-gray-600 ring-gray-200 hover:bg-gray-50`}>Open <ChevronRight size={12} /></a>;
}

function daysSince(date) {
    if (!date) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

/** Where the project is in its life after the award: contract → midterm → workshop → archive. */
function LifecycleSteps({ p }) {
    const steps = [
        { label: 'Contract', done: p.contract_status === 'approved', warn: p.needs_contract },
        { label: 'Midterm', done: p.midterm_status === 'completed' || p.midterm_status === 'scored', warn: p.needs_midterm || p.is_overdue, active: !!p.midterm_status },
        { label: 'Workshop', done: p.completion_workshop_status === 'completed', warn: p.needs_completion_workshop, active: !!p.completion_workshop_status },
        { label: 'Archive', done: false, warn: p.needs_archiving },
    ];
    return (
        <div className="flex items-center gap-1" aria-label="Project progress">
            {steps.map((s, i) => (
                <div key={s.label} className="flex items-center gap-1">
                    <span title={`${s.label}: ${s.done ? 'done' : s.warn ? 'needs action' : s.active ? 'in progress' : 'not yet'}`}
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ring-2 ${s.done ? 'bg-emerald-500 text-white ring-emerald-100' : s.warn ? 'bg-amber-400 text-white ring-amber-100' : s.active ? 'bg-indigo-500 text-white ring-indigo-100' : 'bg-gray-100 text-gray-400 ring-white'}`}>
                        {s.done ? <CheckCircle2 size={11} /> : s.label[0]}
                    </span>
                    {i < steps.length - 1 && <span className={`h-0.5 w-3 rounded ${s.done ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                </div>
            ))}
        </div>
    );
}

function Initials({ name }) {
    const letters = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{letters}</span>;
}

// ─── Table ────────────────────────────────────────────────────────────────────

function OngoingTable({ proposals, loading, sortKey, sortDir, onSort, canArchive, onRequestArchive, startAt = 1, onClear }) {
    if (loading) {
        return (
            <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <Panel bodyClassName="p-0">
                <EmptyState icon={TrendingUp} title="No ongoing proposals match" text="Funded proposals appear here as soon as they are funded. Try clearing the filters.">
                    {onClear && <button onClick={onClear} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">Clear filters</button>}
                </EmptyState>
            </Panel>
        );
    }

    return (
        <>
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-245 text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50/80">
                                <th className="w-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">#</th>
                                {SORT_COLUMNS.map(col => <SortableHeader key={col.key} column={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />)}
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Progress</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Budget used</th>
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Next step</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {proposals.map((p, i) => {
                                const days = daysSince(p.funded_at);
                                return (
                                    <tr key={p.id} className={`group transition-colors hover:bg-indigo-50/40 ${p.is_overdue ? 'bg-red-50/30' : ''}`}>
                                        <td className="px-4 py-3.5 text-xs font-medium tabular-nums text-gray-400">{startAt + i}</td>
                                        <td className="max-w-xs px-4 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: programmeColor(p.category) }} title={getCategoryLabel(p.category)} />
                                                <ProposalHover id={p.id}><a href={`/proposals/${p.id}`} className="font-mono text-xs font-bold text-indigo-600 hover:underline">{p.tracker_number ?? '—'}</a></ProposalHover>
                                            </div>
                                            <p className="mt-0.5 line-clamp-1 text-sm font-medium text-gray-900">{p.title ?? 'Untitled'}</p>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-gray-700"><Initials name={p.pi?.name} /> {p.pi?.name ?? '—'}</span>
                                        </td>
                                        <td className="max-w-44 truncate px-4 py-3.5 text-xs text-gray-600">{p.college?.name ?? '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-3.5">
                                            <p className="text-xs text-gray-700">{p.funded_at ? formatDate(p.funded_at) : '—'}</p>
                                            {days !== null && (
                                                <p className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${p.is_overdue ? 'font-semibold text-red-600' : 'text-gray-400'}`}>
                                                    {p.is_overdue && <AlertTriangle size={10} />} {days} days ago
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5"><LifecycleSteps p={p} /></td>
                                        <td className="px-4 py-3.5"><UtilizationBar allocated={p.budget_allocated} utilized={p.budget_utilized} /></td>
                                        <td className="px-4 py-3.5 text-right"><ActionCell p={p} canArchive={canArchive} onRequestArchive={onRequestArchive} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-[11px] text-gray-500">
                    <span className="font-medium text-gray-600">Progress:</span>
                    {[['bg-emerald-500', 'Done'], ['bg-indigo-500', 'In progress'], ['bg-amber-400', 'Needs action'], ['bg-gray-200', 'Not yet']].map(([c, l]) => (
                        <span key={l} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${c}`} /> {l}</span>
                    ))}
                    <span className="ml-auto">C Contract · M Midterm · W Workshop · A Archive</span>
                </div>
            </div>

            {/* Phones and small tablets: cards */}
            <div className="space-y-3 md:hidden">
                {proposals.map((p, i) => {
                    const days = daysSince(p.funded_at);
                    return (
                        <article key={p.id} className={`relative overflow-hidden rounded-2xl border bg-white p-4 pl-5 shadow-sm ${p.is_overdue ? 'border-red-200' : 'border-gray-200'}`}>
                            <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: programmeColor(p.category) }} />
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-[11px] text-gray-400"><span className="tabular-nums">#{startAt + i}</span> <a href={`/proposals/${p.id}`} className="font-mono font-bold text-indigo-600">{p.tracker_number ?? '—'}</a></p>
                                    <p className="mt-0.5 text-sm font-semibold leading-snug text-gray-900">{p.title || 'Untitled'}</p>
                                </div>
                                <LifecycleSteps p={p} />
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                                <p className="flex items-center gap-1.5 text-gray-700"><Initials name={p.pi?.name} /> <span className="truncate">{p.pi?.name ?? '—'}</span></p>
                                <p className="truncate text-gray-500">{p.college?.name ?? '—'}</p>
                                <p className="text-gray-500">{getCategoryLabel(p.category)}</p>
                                <p className={p.is_overdue ? 'font-semibold text-red-600' : 'text-gray-500'}>{p.funded_at ? `Funded ${formatDate(p.funded_at)}` : '—'}{days !== null ? ` · ${days}d` : ''}</p>
                            </div>
                            <div className="mt-3"><UtilizationBar allocated={p.budget_allocated} utilized={p.budget_utilized} /></div>
                            <div className="mt-3 flex justify-end"><ActionCell p={p} canArchive={canArchive} onRequestArchive={onRequestArchive} /></div>
                        </article>
                    );
                })}
            </div>
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OngoingProposals() {
    const { hasPermission, accessScope } = useAuth();
    const toast = useToast();
    const isCollegeOfficer = accessScope.type === 'college';
    const isCategoryOfficer = accessScope.type === 'category';
    const canArchive = hasPermission('monitoring.archive');
    const canGrantLegacy = hasPermission('monitoring.legacy_grants');

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [archiveTarget, setArchiveTarget] = useState(null);
    const [archiving, setArchiving] = useState(false);
    const [grantModalOpen, setGrantModalOpen] = useState(false);
    const [data, setData] = useState(null);

    const shared = useRef(readSharedView() ?? {}).current;
    const [status, setStatus] = useState(shared.status ?? '');
    const [collegeFilter, setCollegeFilter] = useState(shared.college ?? '');
    const [categoryFilter, setCategoryFilter] = useState(shared.category ?? '');
    const [q, setQ] = useState(shared.q ?? '');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState(shared.sort ?? 'funded_at');
    const [sortDir, setSortDir] = useState(shared.dir ?? 'desc');
    const currentView = { status, college: collegeFilter, category: categoryFilter, q, sort: sortKey, dir: sortDir };
    const applyView = (v) => {
        setStatus(v.status ?? ''); setCollegeFilter(v.college ?? ''); setCategoryFilter(v.category ?? '');
        setQ(v.q ?? ''); setSortKey(v.sort ?? 'funded_at'); setSortDir(v.dir ?? 'desc');
    };

    const filterParams = {
        status: status || undefined,
        college_id: collegeFilter || undefined,
        category: categoryFilter || undefined,
        q: q || undefined,
        sort: sortKey,
        direction: sortDir,
    };

    const load = useCallback((opts = {}) => {
        opts.silent ? setRefreshing(true) : setLoading(true);
        return get('/ongoing-proposals', { ...filterParams, page })
            .then(r => setData(r.data ?? null))
            .catch(() => {})
            .finally(() => { setLoading(false); setRefreshing(false); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, collegeFilter, categoryFilter, q, sortKey, sortDir, page]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [status, collegeFilter, categoryFilter, q, sortKey, sortDir]);

    const handleSort = (key) => {
        if (key === sortKey) {
            setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const toggleStatus = (key) => setStatus(prev => (prev === key ? '' : key));
    const clearAll = () => { setStatus(''); setCollegeFilter(''); setCategoryFilter(''); setQ(''); };

    const downloadExcel = async () => {
        setDownloading(true);
        try {
            const token = localStorage.getItem('rtt_token');
            const params = new URLSearchParams(
                Object.fromEntries(Object.entries(filterParams).filter(([, v]) => v))
            );
            const res = await fetch(`/api/v1/ongoing-proposals/export?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ongoing_proposals.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Export failed. Please try again.');
        }
        setDownloading(false);
    };

    const confirmArchive = async () => {
        if (!archiveTarget) return;
        setArchiving(true);
        try {
            await post(`/ongoing-proposals/${archiveTarget.id}/archive`);
            toast.success(`${archiveTarget.tracker_number} archived.`);
            setArchiveTarget(null);
            load({ silent: true });
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Could not archive this proposal.');
        }
        setArchiving(false);
    };

    const kpis = data?.kpis ?? {
        total_ongoing: 0, awaiting_midterm: 0, overdue_awaiting_midterm: 0, in_midterm: 0, awaiting_archive: 0,
        needs_contract: 0, needs_disbursement: 0, total_budget_allocated: 0, total_budget_utilized: 0,
    };
    const byCollege = data?.by_college ?? [];
    const byCategory = data?.by_category ?? {};
    const proposals = data?.proposals?.data ?? [];
    const pagination = data?.proposals ?? null;
    const colleges = data?.colleges ?? [];
    const filtersOn = !!(status || collegeFilter || categoryFilter || q);
    const utilizationPct = kpis.total_budget_allocated > 0
        ? Math.round((kpis.total_budget_utilized / kpis.total_budget_allocated) * 100)
        : 0;

    const categoryChartData = programmeKeys({ includeInactive: true })
        .filter(c => byCategory[c])
        .map(c => ({ name: getCategoryLabel(c), value: byCategory[c], fill: programmeColor(c) }));
    const collegeMax = Math.max(1, ...byCollege.map(c => c.total));

    const STAGES = [
        { key: 'awaiting_midterm', label: 'Awaiting midterm', value: kpis.awaiting_midterm, icon: Clock, tone: 'amber', hint: 'Funded, midterm not held yet' },
        { key: 'in_midterm', label: 'In midterm', value: kpis.in_midterm, icon: ClipboardCheck, tone: 'violet', hint: 'Report or scoring under way' },
        { key: 'awaiting_archive', label: 'Ready to archive', value: kpis.awaiting_archive, icon: Archive, tone: 'emerald', hint: 'Completed, to be closed out' },
    ];
    const ATTENTION = [
        { key: 'overdue', label: 'Midterm overdue', value: kpis.overdue_awaiting_midterm, icon: AlertTriangle, cls: 'red' },
        { key: 'needs_contract', label: 'Contract pending', value: kpis.needs_contract, icon: FileSignature, cls: 'rose' },
        { key: 'needs_disbursement', label: 'Needs disbursement', value: kpis.needs_disbursement, icon: Banknote, cls: 'blue' },
    ];
    const TONES = {
        amber: { on: 'border-amber-300 bg-amber-50 ring-amber-100', icon: 'bg-amber-100 text-amber-700', num: 'text-amber-700' },
        violet: { on: 'border-violet-300 bg-violet-50 ring-violet-100', icon: 'bg-violet-100 text-violet-700', num: 'text-violet-700' },
        emerald: { on: 'border-emerald-300 bg-emerald-50 ring-emerald-100', icon: 'bg-emerald-100 text-emerald-700', num: 'text-emerald-700' },
        red: { on: 'bg-red-600 text-white ring-red-600', off: 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100' },
        rose: { on: 'bg-rose-600 text-white ring-rose-600', off: 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100' },
        blue: { on: 'bg-blue-600 text-white ring-blue-600', off: 'bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100' },
    };
    const statusLabel = [...STAGES, ...ATTENTION].find(s => s.key === status)?.label;
    const startAt = pagination ? (pagination.current_page - 1) * (pagination.per_page ?? 20) + 1 : 1;

    return (
        <AppLayout breadcrumb="Ongoing Proposals">
            <div className="mx-auto max-w-7xl space-y-5">
                <PageHeader icon={TrendingUp} color="emerald" title="Ongoing Proposals"
                    description="Every funded project after the award — contracts, midterms, workshops, money and archiving in one place.">
                    {canGrantLegacy && (
                        <button onClick={() => setGrantModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                            <Gavel size={14} /> <span className="hidden sm:inline">Grant legacy proposal</span>
                        </button>
                    )}
                    <SavedViews storageKey="saved_views_ongoing" current={currentView} onApply={applyView} />
                    <RefreshButton onClick={() => load({ silent: true })} loading={refreshing} />
                    <button onClick={downloadExcel} disabled={downloading || proposals.length === 0}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {downloading ? 'Preparing…' : 'Excel'}
                    </button>
                </PageHeader>

                {/* ── Overview: lifecycle, attention, money ───────────────── */}
                {loading && !data ? (
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /></div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                        <Panel title="Project lifecycle" subtitle="Click a stage or an alert to filter the list." icon={Layers}
                            actions={<span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold tabular-nums text-white">{kpis.total_ongoing} ongoing</span>}>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {STAGES.map((s, i) => {
                                    const active = status === s.key;
                                    const t = TONES[s.tone];
                                    return (
                                        <button key={s.key} onClick={() => toggleStatus(s.key)} aria-pressed={active}
                                            className={`group relative rounded-2xl border p-4 text-left transition-all ${active ? `${t.on} shadow-sm ring-4` : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm'}`}>
                                            <div className="flex items-center justify-between">
                                                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.icon}`}><s.icon size={17} /></span>
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Step {i + 1}</span>
                                            </div>
                                            <p className={`mt-3 text-3xl font-bold tabular-nums ${t.num}`}>{s.value}</p>
                                            <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                                            <p className="text-[11px] text-gray-500">{s.hint}</p>
                                            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-gray-100">
                                                <div className={`h-full rounded-full ${s.tone === 'amber' ? 'bg-amber-400' : s.tone === 'violet' ? 'bg-violet-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${kpis.total_ongoing ? (s.value / kpis.total_ongoing) * 100 : 0}%` }} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                                <span className="text-xs font-semibold text-gray-500">Needs attention:</span>
                                {ATTENTION.map(a => {
                                    const active = status === a.key;
                                    const t = TONES[a.cls];
                                    return (
                                        <button key={a.key} onClick={() => toggleStatus(a.key)} aria-pressed={active} disabled={!a.value && !active}
                                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-400 disabled:ring-gray-200 ${active ? t.on : t.off}`}>
                                            <a.icon size={12} /> <span className="tabular-nums">{a.value}</span> {a.label}
                                        </button>
                                    );
                                })}
                                {!ATTENTION.some(a => a.value) && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={12} /> Nothing overdue or blocked</span>}
                            </div>
                        </Panel>

                        <Panel title="Budget used" subtitle="Spent against what was allocated." icon={Wallet}>
                            <div className="flex items-center gap-5">
                                <div className="relative h-28 w-28 shrink-0">
                                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                                        <circle cx="50" cy="50" r="42" fill="none" stroke="#eef0f3" strokeWidth="10" />
                                        <circle cx="50" cy="50" r="42" fill="none" stroke={utilizationPct > 90 ? '#dc2626' : '#059669'} strokeWidth="10" strokeLinecap="round"
                                            strokeDasharray={`${(Math.min(100, utilizationPct) / 100) * 263.9} 263.9`} />
                                    </svg>
                                    <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                                        <span className="text-2xl font-bold tabular-nums text-gray-900">{utilizationPct}%</span>
                                        <span className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">used</span>
                                    </span>
                                </div>
                                <div className="min-w-0 space-y-2.5 text-sm">
                                    <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Used</p><p className="truncate font-bold tabular-nums text-emerald-700">{formatCurrency(kpis.total_budget_utilized)}</p></div>
                                    <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Allocated</p><p className="truncate font-bold tabular-nums text-gray-900">{formatCurrency(kpis.total_budget_allocated)}</p></div>
                                    <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Left to spend</p><p className="truncate font-bold tabular-nums text-gray-700">{formatCurrency(Math.max(0, kpis.total_budget_allocated - kpis.total_budget_utilized))}</p></div>
                                </div>
                            </div>
                        </Panel>
                    </div>
                )}

                {/* ── Spread: colleges and programmes ─────────────────────── */}
                {(!isCollegeOfficer && byCollege.length > 0) || (!isCategoryOfficer && categoryChartData.length > 0) ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {!isCollegeOfficer && byCollege.length > 0 && (
                            <Panel title="By college" subtitle="Ongoing projects per college." icon={Building2}>
                                <ul className="space-y-2.5">
                                    {byCollege.slice(0, 8).map(c => (
                                        <li key={c.id}>
                                            <button onClick={() => setCollegeFilter(f => (f === c.id ? '' : c.id))} className="group w-full text-left">
                                                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                                    <span className={`truncate ${collegeFilter === c.id ? 'font-semibold text-indigo-700' : 'text-gray-700 group-hover:text-gray-900'}`}>{c.name}</span>
                                                    <span className="font-semibold tabular-nums text-gray-900">{c.total}</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                                    <div className={`h-full rounded-full transition-all ${collegeFilter === c.id ? 'bg-indigo-600' : 'bg-indigo-400 group-hover:bg-indigo-500'}`} style={{ width: `${(c.total / collegeMax) * 100}%` }} />
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                    {byCollege.length > 8 && <li className="text-[11px] text-gray-400">+{byCollege.length - 8} more colleges</li>}
                                </ul>
                            </Panel>
                        )}
                        {!isCategoryOfficer && categoryChartData.length > 0 && (
                            <Panel title="By programme" subtitle="Click one to filter." icon={Layers}>
                                <div className="flex items-center gap-4">
                                    <ResponsiveContainer width="50%" height={180}>
                                        <PieChart>
                                            <Pie data={categoryChartData} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                                                {categoryChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        {programmeKeys({ includeInactive: true }).filter(c => byCategory[c]).map(c => (
                                            <button key={c} onClick={() => setCategoryFilter(f => (f === c ? '' : c))}
                                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition ${categoryFilter === c ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: programmeColor(c) }} />
                                                    <span className="truncate text-xs text-gray-700">{getCategoryLabel(c)}</span>
                                                </span>
                                                <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900">{byCategory[c]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </Panel>
                        )}
                    </div>
                ) : null}

                {/* ── Toolbar ─────────────────────────────────────────────── */}
                <div className="space-y-3">
                    <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
                        <label className="relative min-w-0 flex-1">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tracker number, title or PI…"
                                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            {!isCollegeOfficer && colleges.length > 1 && (
                                <Select label="College" value={collegeFilter} onChange={setCollegeFilter} className="sm:w-48">
                                    <option value="">All colleges</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            )}
                            {!isCategoryOfficer && (
                                <Select label="Programme" value={categoryFilter} onChange={setCategoryFilter} className="sm:w-48">
                                    <option value="">All programmes</option>
                                    {programmeKeys().map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                                </Select>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <p className="text-sm text-gray-600">
                            <b className="text-gray-900">{pagination?.total ?? proposals.length}</b> project{(pagination?.total ?? proposals.length) === 1 ? '' : 's'}
                            {statusLabel && <> · <span className="font-medium text-gray-800">{statusLabel}</span></>}
                            {refreshing && <Loader2 size={13} className="ml-2 inline animate-spin text-gray-400" />}
                        </p>
                        {filtersOn && (
                            <button onClick={clearAll} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100">
                                <X size={12} /> Clear filters
                            </button>
                        )}
                    </div>

                    <OngoingTable proposals={proposals} loading={loading} sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
                        canArchive={canArchive} onRequestArchive={setArchiveTarget} startAt={startAt} onClear={filtersOn ? clearAll : null} />

                    {pagination && pagination.last_page > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                            <p className="text-xs text-gray-500">
                                Showing {startAt}–{startAt + proposals.length - 1} of {pagination.total}
                            </p>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.current_page <= 1} aria-label="Previous page"
                                    className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                                    <ChevronLeft size={15} />
                                </button>
                                {Array.from({ length: pagination.last_page }, (_, i) => i + 1)
                                    .filter(n => n === 1 || n === pagination.last_page || Math.abs(n - pagination.current_page) <= 1)
                                    .map((n, i, arr) => (
                                        <span key={n} className="flex items-center gap-1">
                                            {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-xs text-gray-400">…</span>}
                                            <button onClick={() => setPage(n)}
                                                className={`min-w-8 rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums transition ${n === pagination.current_page ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                                                {n}
                                            </button>
                                        </span>
                                    ))}
                                <button onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))} disabled={pagination.current_page >= pagination.last_page} aria-label="Next page"
                                    className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {archiveTarget && (
                <ConfirmDialog
                    open
                    title="Archive Proposal"
                    description={`Archive ${archiveTarget.tracker_number} — "${archiveTarget.title}"? This closes the proposal out permanently and it will no longer appear on this dashboard.`}
                    confirmLabel={archiving ? 'Archiving…' : 'Archive'}
                    onConfirm={confirmArchive}
                    onCancel={() => setArchiveTarget(null)}
                />
            )}

            {grantModalOpen && (
                <GrantLegacyModal
                    onClose={() => setGrantModalOpen(false)}
                    onGranted={() => load({ silent: true })}
                />
            )}
        </AppLayout>
    );
}
