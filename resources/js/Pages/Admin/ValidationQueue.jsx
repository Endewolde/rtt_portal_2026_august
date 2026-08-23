import { useState, useEffect, useRef } from 'react';
import { CheckCircle, RotateCcw, XCircle, Clock, ShieldCheck, RefreshCw, FileQuestion, X, Ban } from 'lucide-react';
import { Link } from '@inertiajs/react';
import AppLayout from '../../Layouts/AppLayout';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import { get, post } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

function CountdownTimer({ endDate }) {
    const [display, setDisplay] = useState('');

    useEffect(() => {
        const update = () => {
            const diff = new Date(endDate) - new Date();
            if (diff <= 0) { setDisplay('Deadline passed'); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            setDisplay(d > 0 ? `${d}d ${h}h remaining` : `${h}h ${m}m remaining`);
        };
        update();
        const id = setInterval(update, 60000);
        return () => clearInterval(id);
    }, [endDate]);

    return <p className="text-sm font-semibold text-amber-700">{display}</p>;
}

function ProposalCard({ proposal, onAction, num, checked, onToggle }) {
    return (
        <div className={`bg-white border rounded-xl flex items-stretch overflow-hidden hover:shadow-md transition-all ${
            checked ? 'border-green-300 shadow-sm' : 'border-gray-200'
        }`}>
            <div className={`w-0.5 shrink-0 ${checked ? 'bg-green-500' : 'bg-blue-600'}`} />
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0 px-4 py-3.5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {onToggle && (
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggle(proposal.id)}
                            onClick={e => e.stopPropagation()}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer shrink-0"
                        />
                    )}
                    {num != null && (
                        <span className="text-xs font-medium text-gray-400 tabular-nums w-5 text-center shrink-0">{num}</span>
                    )}
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg shrink-0">
                        {proposal.tracker_number}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{proposal.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {proposal.pi?.name ?? '—'} · {proposal.college?.name ?? '—'} · {formatDate(proposal.submitted_at)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                        onClick={() => onAction('approve', proposal.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors"
                    >
                        <CheckCircle size={13} /> <span className="hidden sm:inline">Approve</span>
                    </button>
                    <button
                        onClick={() => onAction('return', proposal.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors"
                    >
                        <RotateCcw size={13} /> <span className="hidden sm:inline">Return</span>
                    </button>
                    <button
                        onClick={() => onAction('reject', proposal.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors"
                    >
                        <XCircle size={13} /> <span className="hidden sm:inline">Reject</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function RejectedCard({ proposal }) {
    return (
        <div className="bg-white border border-red-200 rounded-xl flex items-stretch overflow-hidden">
            <div className="w-0.5 bg-red-500 shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0 px-4 py-3.5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-mono text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg shrink-0">
                        {proposal.tracker_number}
                    </span>
                    <div className="flex-1 min-w-0">
                        <a href={`/proposals/${proposal.id}`} className="text-sm font-semibold text-gray-900 truncate hover:text-blue-700 hover:underline block">
                            {proposal.title}
                        </a>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {proposal.pi?.name ?? '—'} · {proposal.college?.name ?? '—'} · Rejected {formatDate(proposal.rejected_at)}
                        </p>
                        {proposal.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1 line-clamp-2">{proposal.rejection_reason}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ValidationQueue() {
    const toast = useToast();
    const [tab, setTab]             = useState('queue');
    const [data, setData]           = useState([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [collegeFilter, setCollegeFilter] = useState('');
    const [loading, setLoading]     = useState(true);
    const [dialog, setDialog]       = useState(null);
    const [reason, setReason]       = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [view, setView]           = useViewPreference('validation_queue', 'card');

    // Bulk selection
    const [selectedIds, setSelectedIds]   = useState(new Set());
    const [bulkApproving, setBulkApproving] = useState(false);

    // Rejected tab — proposals rejected specifically at this step (not blind
    // review / open defence / central evaluation, which also end in 'rejected').
    const [rejectedData, setRejectedData]   = useState([]);
    const [rejectedLoading, setRejectedLoading] = useState(false);
    const [rejectedLoaded, setRejectedLoaded] = useState(false);

    const load = () => {
        setLoading(true);
        get('/proposals/validation-queue')
            .then((r) => {
                setData(r.data?.data ?? r.data ?? []);
                setSelectedIds(new Set());
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    const loadRejected = () => {
        setRejectedLoading(true);
        get('/proposals/validation-queue/rejected')
            .then((r) => setRejectedData(r.data?.data ?? r.data ?? []))
            .catch(() => {})
            .finally(() => { setRejectedLoading(false); setRejectedLoaded(true); });
    };

    useEffect(() => { load(); }, []);
    useEffect(() => { if (tab === 'rejected' && !rejectedLoaded) loadRejected(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    const openDialog = (action, proposalId) => { setDialog({ action, proposalId }); setReason(''); };

    const confirm = async () => {
        if (!dialog) return;
        if (dialog.action !== 'approve' && !reason.trim()) { toast.warning('Reason is required.'); return; }
        setSubmitting(true);
        try {
            await post(`/proposals/${dialog.proposalId}/validation/${dialog.action}`, { reason });
            if (dialog.action === 'approve') toast.success('Proposal approved and moved to Blind Review.', {
                title: 'Approved',
                action: { label: 'Go to Blind Review', onClick: () => { window.location.href = '/admin/blind-review'; } },
            });
            if (dialog.action === 'return')  toast.warning('Proposal returned to PI for correction.');
            if (dialog.action === 'reject')  toast.error('Proposal has been rejected.');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Action failed.');
        }
        setSubmitting(false); setDialog(null); setReason('');
    };

    // ── Category/college options & client-side filters ──
    const availableCategories = [...new Set(data.map(p => p.category).filter(Boolean))].sort();
    const availableColleges   = [...new Map(data.filter(p => p.college).map(p => [p.college.id, p.college])).values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    const filteredData = data
        .filter(p => !categoryFilter || p.category === categoryFilter)
        .filter(p => !collegeFilter || p.college_id === collegeFilter);

    const now = new Date();
    const awaitingDeadline   = filteredData.filter(p => p.proposal_call && new Date(p.proposal_call.end_date) > now);
    const readyForValidation = filteredData.filter(p => !p.proposal_call || new Date(p.proposal_call.end_date) <= now);

    // Selection helpers scoped to readyForValidation
    const readyIds    = readyForValidation.map(p => p.id);
    const allSelected = readyIds.length > 0 && readyIds.every(id => selectedIds.has(id));
    const someSelected = readyIds.some(id => selectedIds.has(id));
    const selectAllRef = useRef(null);

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = someSelected && !allSelected;
        }
    }, [someSelected, allSelected]);

    const toggleOne = (id) => setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const toggleAll = () => setSelectedIds(prev => {
        const next = new Set(prev);
        if (allSelected) { readyIds.forEach(id => next.delete(id)); }
        else             { readyIds.forEach(id => next.add(id)); }
        return next;
    });

    const executeBulkApprove = async () => {
        setBulkApproving(true);
        try {
            const res = await post('/proposals/validation/bulk-approve', { ids: [...selectedIds] });
            toast.success(res.data?.message ?? `${selectedIds.size} proposal(s) approved.`, {
                title: 'Bulk Approved',
                action: { label: 'Go to Blind Review', onClick: () => { window.location.href = '/admin/blind-review'; } },
            });
            load();
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Bulk approve failed.');
        }
        setBulkApproving(false);
    };

    return (
        <AppLayout breadcrumb="Validation Queue">
            <div className="max-w-5xl mx-auto">
                <WorkflowBreadcrumb current="submitted" />

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                            <ShieldCheck size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Validation Queue</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Review submitted proposals and approve, return, or reject them</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                            <button
                                onClick={() => setTab('queue')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'queue' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Queue
                            </button>
                            <button
                                onClick={() => setTab('rejected')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'rejected' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Rejected{rejectedLoaded && rejectedData.length > 0 ? ` (${rejectedData.length})` : ''}
                            </button>
                        </div>
                        {tab === 'queue' && availableColleges.length > 1 && (
                            <select
                                value={collegeFilter}
                                onChange={e => setCollegeFilter(e.target.value)}
                                className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">All Colleges</option>
                                {availableColleges.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                        {tab === 'queue' && availableCategories.length > 1 && (
                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">All Categories</option>
                                {availableCategories.map(c => (
                                    <option key={c} value={c}>{getCategoryLabel(c)}</option>
                                ))}
                            </select>
                        )}
                        {tab === 'queue' && !loading && (
                            <>
                                {awaitingDeadline.length > 0 && (
                                    <span className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                                        <Clock size={12} /> {awaitingDeadline.length} Awaiting
                                    </span>
                                )}
                                {readyForValidation.length > 0 && (
                                    <span className="flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg">
                                        <CheckCircle size={12} /> {readyForValidation.length} Ready
                                    </span>
                                )}
                            </>
                        )}
                        {tab === 'queue' && <ViewToggle view={view} onChange={setView} />}
                        <button
                            onClick={tab === 'queue' ? load : loadRejected}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {tab === 'queue' ? (loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className="h-14 w-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <FileQuestion size={28} className="text-gray-400" />
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1">Queue is empty</h3>
                        <p className="text-sm text-gray-400">No proposals awaiting validation right now.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {awaitingDeadline.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                                    <h2 className="text-sm font-semibold text-gray-700">
                                        Awaiting Deadline
                                        <span className="ml-2 inline-flex items-center justify-center bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                            {awaitingDeadline.length}
                                        </span>
                                    </h2>
                                </div>
                                <div className="space-y-2">
                                    {awaitingDeadline.map((p, i) => (
                                        <div key={p.id} className="bg-white border border-amber-200 rounded-xl flex items-stretch overflow-hidden hover:shadow-md transition-shadow">
                                            <div className="w-0.5 bg-amber-500 shrink-0" />
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0 px-4 py-3.5">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="text-xs font-medium text-gray-400 tabular-nums w-5 text-center shrink-0">{i + 1}</span>
                                                    <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg shrink-0">
                                                        {p.tracker_number}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{p.pi?.name ?? '—'} · {p.college?.name ?? '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 self-end sm:self-auto">
                                                    <p className="text-xs text-amber-600 font-medium mb-0.5">Call closes:</p>
                                                    <CountdownTimer endDate={p.proposal_call.end_date} />
                                                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.proposal_call.end_date)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {readyForValidation.length > 0 && (
                            <div>
                                {/* Section header with select-all + bulk bar */}
                                <div className="flex items-center gap-3 mb-3 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={selectAllRef}
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            aria-label="Select all ready proposals"
                                        />
                                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600" />
                                        <h2 className="text-sm font-semibold text-gray-700">
                                            Ready for Validation
                                            <span className="ml-2 inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                                {readyForValidation.length}
                                            </span>
                                        </h2>
                                    </div>

                                    {selectedIds.size > 0 && (
                                        <div className="ml-auto flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
                                            <span className="text-xs font-semibold text-green-700">
                                                {selectedIds.size} selected
                                            </span>
                                            <button
                                                onClick={executeBulkApprove}
                                                disabled={bulkApproving}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                                            >
                                                {bulkApproving
                                                    ? <><RefreshCw size={11} className="animate-spin" /> Approving…</>
                                                    : <><CheckCircle size={11} /> Approve All</>
                                                }
                                            </button>
                                            <button
                                                onClick={() => setSelectedIds(new Set())}
                                                className="text-green-500 hover:text-green-800 transition-colors"
                                                aria-label="Clear selection"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {view === 'table' ? (
                                    <ProposalTable
                                        proposals={readyForValidation}
                                        showColumns={['tracker','title','category','pi','college','deadline']}
                                        selectable
                                        selectedIds={selectedIds}
                                        onToggle={toggleOne}
                                        onToggleAll={toggleAll}
                                        actions={(p) => (
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <button onClick={() => openDialog('approve', p.id)}
                                                    className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">Approve</button>
                                                <button onClick={() => openDialog('return', p.id)}
                                                    className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600">Return</button>
                                                <button onClick={() => openDialog('reject', p.id)}
                                                    className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">Reject</button>
                                            </div>
                                        )}
                                        emptyMessage="No proposals ready for validation."
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        {readyForValidation.map((p, i) => (
                                            <ProposalCard
                                                key={p.id}
                                                proposal={p}
                                                onAction={openDialog}
                                                num={i + 1}
                                                checked={selectedIds.has(p.id)}
                                                onToggle={toggleOne}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )) : (
                    rejectedLoading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : rejectedData.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                            <div className="h-14 w-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Ban size={28} className="text-gray-400" />
                            </div>
                            <h3 className="text-gray-700 font-semibold mb-1">No rejected proposals</h3>
                            <p className="text-sm text-gray-400">Nothing has been rejected at this validation step.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {rejectedData.map(p => <RejectedCard key={p.id} proposal={p} />)}
                        </div>
                    )
                )}
            </div>

            {dialog && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
                        <h2 className="text-base font-semibold mb-3 capitalize">{dialog.action} Proposal</h2>
                        {dialog.action !== 'approve' && (
                            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                                placeholder="Reason (required)…" rows={3}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none resize-none" />
                        )}
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setDialog(null); setReason(''); }}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={confirm} disabled={submitting}
                                className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-60 ${
                                    dialog.action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                                    dialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                                    'bg-yellow-600 hover:bg-yellow-700'}`}>
                                {submitting ? 'Processing…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
