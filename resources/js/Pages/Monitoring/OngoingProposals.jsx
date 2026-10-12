import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    TrendingUp, RefreshCw, Search, ChevronLeft, ChevronRight, ExternalLink,
    ArrowUp, ArrowDown, ArrowUpDown, Building2, Wallet, Download, AlertTriangle, Archive,
    Gavel, X, ArrowLeft, Upload, FileDown, CheckCircle2, FileUp,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import AppLayout from '../../Layouts/AppLayout';
import FilterBar from '../../Components/FilterBar';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { useFeature } from '../../hooks/useFeature';
import { useToast } from '../../Components/Toast';
import api, { get, post } from '../../lib/api';
import { formatDate, formatCurrency, getCategoryLabel, getStatusLabel } from '../../lib/utils';

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

const CATEGORY_OPTIONS = ['research', 'community_engagement', 'technology_transfer'];
const CATEGORY_COLORS = { research: '#6366f1', community_engagement: '#ec4899', technology_transfer: '#14b8a6' };

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
    return (
        <div className="min-w-24">
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span>{pct}%</span>
                <span className="text-gray-400">{formatCurrency(allocated)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─── Hover detail card ──────────────────────────────────────────────────────────

function HoverDetailCard({ info }) {
    if (!info) return null;
    const { p, x, y } = info;
    const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300);

    return (
        <div className="fixed z-50 w-72 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-4 pointer-events-none" style={{ left, top: y }}>
            <p className="font-semibold text-white leading-snug mb-2 line-clamp-3">{p.title || 'Untitled'}</p>
            <div className="space-y-1 text-gray-300">
                <p><span className="text-gray-500">Tracker:</span> {p.tracker_number ?? '—'}</p>
                <p><span className="text-gray-500">PI:</span> {p.pi?.name ?? '—'}</p>
                <p><span className="text-gray-500">College:</span> {p.college?.name ?? '—'}</p>
                <p><span className="text-gray-500">Category:</span> {getCategoryLabel(p.category)}</p>
                <p><span className="text-gray-500">Funded:</span> {p.funded_at ? formatDate(p.funded_at) : '—'}</p>
                <p><span className="text-gray-500">Research Outputs:</span> {p.outputs_count ?? 0}</p>
                <p><span className="text-gray-500">Contract:</span> {p.contract_status ? p.contract_status.charAt(0).toUpperCase() + p.contract_status.slice(1) : 'Not Submitted'}</p>
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
                    <label className="text-xs font-semibold text-gray-600">Awarded Amount (ETB) <span className="text-red-500">*</span></label>
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
                            <table className="min-w-full text-xs">
                                <thead>
                                    <tr className="bg-red-50 border-b border-red-100">
                                        <th className="px-3 py-2 text-left font-semibold text-red-400 w-12">Row</th>
                                        <th className="px-3 py-2 text-left font-semibold text-red-400">Tracker</th>
                                        <th className="px-3 py-2 text-left font-semibold text-red-400">Issue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.errors.map((e, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                                            <td className="px-3 py-2 font-mono text-gray-400">{e.row}</td>
                                            <td className="px-3 py-2 text-gray-600">{e.tracker_number}</td>
                                            <td className="px-3 py-2 text-red-500">{e.error}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {preview.headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {preview.rows.map((row, ri) => (
                                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
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
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
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
                    <label className="text-xs font-semibold text-gray-600">Awarded Amount (ETB) <span className="text-red-500">*</span></label>
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
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
            <button onClick={() => onSort(column.key)} className={`flex items-center gap-1 transition-colors ${active ? 'text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
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
    if (p.needs_contract) return { type: 'link', href: '/admin/awarded', label: 'Review Contract', cls: 'text-red-700 hover:text-red-900' };
    if (p.needs_midterm) return { type: 'link', href: '/midterm-evaluations', label: 'Schedule Midterm', cls: 'text-amber-700 hover:text-amber-900' };
    if (p.needs_completion_workshop) return { type: 'link', href: '/completion-workshops', label: 'Schedule Workshop', cls: 'text-purple-700 hover:text-purple-900' };
    if (p.needs_disbursement) return { type: 'link', href: '/disbursements', label: 'Process Disbursement', cls: 'text-blue-700 hover:text-blue-900' };
    if (p.needs_archiving) return { type: 'archive' };
    return { type: 'view' };
}

function ActionCell({ p, canArchive, onRequestArchive }) {
    const action = primaryAction(p);

    if (action.type === 'link') {
        return (
            <a href={action.href} className={`flex items-center gap-1 text-xs font-semibold ${action.cls}`}>
                {action.label} <ExternalLink size={11} />
            </a>
        );
    }
    if (action.type === 'archive') {
        return canArchive ? (
            <button onClick={() => onRequestArchive(p)} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                <Archive size={11} /> Archive
            </button>
        ) : (
            <span className="text-xs text-gray-400">Awaiting archive</span>
        );
    }
    return <a href={`/proposals/${p.id}`} className="text-xs font-semibold text-gray-500 hover:text-gray-700">View</a>;
}

function daysSince(date) {
    if (!date) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

// ─── Table ────────────────────────────────────────────────────────────────────

function OngoingTable({ proposals, loading, sortKey, sortDir, onSort, canArchive, onRequestArchive }) {
    const [hoverInfo, setHoverInfo] = useState(null);
    const showHover = (e, p) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverInfo({ p, x: rect.left, y: rect.bottom + 8 });
    };
    const hideHover = () => setHoverInfo(null);

    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="divide-y divide-gray-100">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="px-4 py-3.5 flex items-center gap-4">
                            {Array.from({ length: 6 }).map((_, j) => (
                                <div key={j} className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: `${12 + j * 4}%` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <TrendingUp size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium text-sm">No ongoing proposals match these filters.</p>
            </div>
        );
    }

    return (
        <>
            <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                {SORT_COLUMNS.map(col => (
                                    <SortableHeader key={col.key} column={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                                ))}
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Since Funded</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Midterm</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Completion Workshop</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contract</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {proposals.map((p, i) => (
                                <tr key={p.id} className={`transition-colors hover:bg-indigo-50/40 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                    <td className="px-4 py-3 max-w-xs">
                                        <a href={`/proposals/${p.id}`}
                                            onMouseEnter={e => showHover(e, p)}
                                            onMouseLeave={hideHover}
                                            className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                                            {p.tracker_number ?? '—'}
                                        </a>
                                        <p className="text-xs text-gray-600 line-clamp-1 mt-1">{p.title ?? 'Untitled'}</p>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 font-medium">{p.pi?.name ?? '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{p.college?.name ?? '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{p.funded_at ? formatDate(p.funded_at) : '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">{getCategoryLabel(p.category)}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs tabular-nums">
                                        {p.is_overdue ? (
                                            <span className="flex items-center gap-1 text-red-600 font-bold">
                                                <AlertTriangle size={11} /> {daysSince(p.funded_at)}
                                            </span>
                                        ) : (
                                            <span className="text-gray-600">{daysSince(p.funded_at) ?? '—'}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap"><MidtermBadge status={p.midterm_status} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap"><WorkshopBadge status={p.completion_workshop_status} needsWorkshop={p.needs_completion_workshop} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap"><ContractBadge status={p.contract_status} /></td>
                                    <td className="px-4 py-3"><UtilizationBar allocated={p.budget_allocated} utilized={p.budget_utilized} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <ActionCell p={p} canArchive={canArchive} onRequestArchive={onRequestArchive} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                    {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} on this page
                </div>
            </div>

            {/* Mobile: stacked cards */}
            <div className="sm:hidden space-y-3">
                {proposals.map(p => (
                    <div key={p.id} className={`bg-white border rounded-xl p-4 ${p.is_overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <a href={`/proposals/${p.id}`} className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded shrink-0">
                                {p.tracker_number ?? '—'}
                            </a>
                            <MidtermBadge status={p.midterm_status} />
                        </div>
                        <p className="font-medium text-gray-900 text-sm leading-snug mb-2.5">{p.title || 'Untitled'}</p>
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs mb-3">
                            <p><span className="text-gray-400">PI:</span> <span className="text-gray-600">{p.pi?.name ?? '—'}</span></p>
                            <p><span className="text-gray-400">College:</span> <span className="text-gray-600">{p.college?.name ?? '—'}</span></p>
                            <p><span className="text-gray-400">Category:</span> <span className="text-gray-600">{getCategoryLabel(p.category)}</span></p>
                            <p><span className="text-gray-400">Funded:</span> <span className="text-gray-600">{p.funded_at ? formatDate(p.funded_at) : '—'}</span></p>
                            <p className="flex items-center gap-1"><span className="text-gray-400">Workshop:</span> <WorkshopBadge status={p.completion_workshop_status} needsWorkshop={p.needs_completion_workshop} /></p>
                            <p className="flex items-center gap-1"><span className="text-gray-400">Contract:</span> <ContractBadge status={p.contract_status} /></p>
                        </div>
                        {p.is_overdue && (
                            <p className="flex items-center gap-1 text-xs font-bold text-red-600 mb-2">
                                <AlertTriangle size={11} /> Midterm overdue — {daysSince(p.funded_at)} days since funded
                            </p>
                        )}
                        <UtilizationBar allocated={p.budget_allocated} utilized={p.budget_utilized} />
                        {primaryAction(p).type !== 'view' && (
                            <div className="mt-3">
                                <ActionCell p={p} canArchive={canArchive} onRequestArchive={onRequestArchive} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <HoverDetailCard info={hoverInfo} />
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OngoingProposals() {
    const { hasRole, hasAnyRole } = useAuth();
    const toast = useToast();
    const isCollegeOfficer = hasRole('college_officer');
    const isCategoryOfficer = hasAnyRole(['research_officer', 'community_officer', 'technology_officer']);
    // Matches ARCHIVE_ROLES server-side — no plain 'admin', that's intentional.
    const canArchive = hasAnyRole(['super_admin', 'central_officer']);
    // Matches LEGACY_GRANT_ROLES server-side.
    const canGrantLegacy = hasAnyRole(['super_admin', 'admin', 'central_officer']);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [archiveTarget, setArchiveTarget] = useState(null);
    const [archiving, setArchiving] = useState(false);
    const [grantModalOpen, setGrantModalOpen] = useState(false);
    const [data, setData] = useState(null);

    const [status, setStatus] = useState('');
    const [collegeFilter, setCollegeFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState('funded_at');
    const [sortDir, setSortDir] = useState('desc');

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
    const activeFilterCount = [collegeFilter, categoryFilter, q].filter(Boolean).length;
    const utilizationPct = kpis.total_budget_allocated > 0
        ? Math.round((kpis.total_budget_utilized / kpis.total_budget_allocated) * 100)
        : 0;

    const categoryChartData = CATEGORY_OPTIONS
        .filter(c => byCategory[c])
        .map(c => ({ name: getCategoryLabel(c), value: byCategory[c], fill: CATEGORY_COLORS[c] }));

    return (
        <AppLayout breadcrumb="Ongoing Proposals">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="rounded-2xl bg-linear-to-r from-slate-900 via-emerald-950 to-slate-900 px-6 py-7 text-white">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                <TrendingUp size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Ongoing Proposals</h1>
                                <p className="text-sm text-slate-300 mt-0.5">
                                    Funded proposals still in progress — post-award monitoring in one place
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-start lg:self-auto">
                            {canGrantLegacy && (
                                <button
                                    onClick={() => setGrantModalOpen(true)}
                                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 transition-colors"
                                >
                                    <Gavel size={14} />
                                    Grant Legacy Proposal
                                </button>
                            )}
                            <button
                                onClick={() => load({ silent: true })}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 disabled:opacity-60 transition-colors"
                            >
                                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                {refreshing ? 'Refreshing…' : 'Refresh'}
                            </button>
                            <button
                                onClick={downloadExcel}
                                disabled={downloading || proposals.length === 0}
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Download size={14} className={downloading ? 'animate-bounce' : ''} />
                                {downloading ? 'Preparing…' : 'Download'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* KPI cards — tap/click narrows the status filter below */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                        { key: '', label: 'Total Ongoing', value: kpis.total_ongoing, color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
                        { key: 'awaiting_midterm', label: 'Awaiting Midterm', value: kpis.awaiting_midterm, color: '#b45309', bg: '#fffbeb', border: '#fde68a', overdue: kpis.overdue_awaiting_midterm },
                        { key: 'in_midterm', label: 'In Midterm', value: kpis.in_midterm, color: '#7e22ce', bg: '#faf5ff', border: '#e9d5ff' },
                        { key: 'awaiting_archive', label: 'Awaiting Archive', value: kpis.awaiting_archive, color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
                        { key: 'needs_contract', label: 'Contract Pending', value: kpis.needs_contract, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
                        { key: 'needs_disbursement', label: 'Needs Disbursement', value: kpis.needs_disbursement, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
                    ].map(card => {
                        const active = status === card.key && card.key !== '';
                        return (
                            <button
                                key={card.label}
                                onClick={() => card.key && toggleStatus(card.key)}
                                className={`text-left rounded-2xl border-2 p-4 transition-all duration-150 active:scale-95 touch-manipulation ${active ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm'} ${!card.key ? 'cursor-default' : 'cursor-pointer'}`}
                                style={{ borderColor: active ? card.border : '#e5e7eb', backgroundColor: active ? card.bg : '#ffffff' }}
                            >
                                <p className="text-2xl font-extrabold tabular-nums" style={{ color: card.color }}>{card.value}</p>
                                <p className="text-xs font-semibold text-gray-500 mt-0.5">{card.label}</p>
                                {!!card.overdue && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={e => { e.stopPropagation(); toggleStatus('overdue'); }}
                                        className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${status === 'overdue' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'}`}
                                    >
                                        <AlertTriangle size={9} /> {card.overdue} overdue
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Wallet size={14} className="text-emerald-600" />
                            <p className="text-xs font-semibold text-gray-500">Budget Utilized</p>
                        </div>
                        <p className="text-lg font-extrabold text-emerald-700">{formatCurrency(kpis.total_budget_utilized)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{utilizationPct}% of {formatCurrency(kpis.total_budget_allocated)}</p>
                    </div>
                </div>

                {/* Charts — omitted where they'd only ever show one meaningless bar/slice */}
                {(!isCollegeOfficer || !isCategoryOfficer) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {!isCollegeOfficer && byCollege.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                <p className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-1.5"><Building2 size={14} /> Ongoing by College</p>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={byCollege} margin={{ left: -20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                        {!isCategoryOfficer && categoryChartData.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-5">
                                <p className="text-sm font-bold text-gray-800 mb-4">Ongoing by Category</p>
                                <div className="flex items-center gap-4">
                                    <ResponsiveContainer width="55%" height={200}>
                                        <PieChart>
                                            <Pie data={categoryChartData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                                                {categoryChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex-1 space-y-1.5 min-w-0">
                                        {categoryChartData.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: c.fill }} />
                                                    <span className="text-[11px] text-gray-600 truncate">{c.name}</span>
                                                </div>
                                                <span className="text-[11px] font-bold text-gray-800 shrink-0">{c.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Filters + table */}
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Search tracker #, title or PI…"
                                className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>

                        <FilterBar accent="indigo" activeCount={activeFilterCount}>
                            {!isCollegeOfficer && colleges.length > 1 && (
                                <select
                                    value={collegeFilter}
                                    onChange={e => setCollegeFilter(e.target.value)}
                                    className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                >
                                    <option value="">All Colleges</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            {!isCategoryOfficer && (
                                <select
                                    value={categoryFilter}
                                    onChange={e => setCategoryFilter(e.target.value)}
                                    className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                >
                                    <option value="">All Categories</option>
                                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                                </select>
                            )}
                        </FilterBar>
                    </div>

                    <OngoingTable
                        proposals={proposals}
                        loading={loading}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        canArchive={canArchive}
                        onRequestArchive={setArchiveTarget}
                    />

                    {pagination && pagination.last_page > 1 && (
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs text-gray-400">
                                Page {pagination.current_page} of {pagination.last_page} · {pagination.total} proposals
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={pagination.current_page <= 1}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={13} /> Prev
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                                    disabled={pagination.current_page >= pagination.last_page}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next <ChevronRight size={13} />
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
