import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import { RotateCcw, XCircle, X, Loader2, ArrowRight, Bot, Info, ClipboardCheck, AlertTriangle } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import DataTable from '../../Components/DataTable';
import { PageHeader, Select, RefreshButton, Panel } from '../../Components/Insights/Kit';
import { useToast } from '../../Components/Toast';
import { get, post } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';
import { term } from '../../lib/terms';
import { programmeKeys } from '../../lib/programmes';

const KIND_STYLES = {
    validation:      'bg-gray-100 text-gray-700',
    before_review:   'bg-slate-100 text-slate-700',
    blind_review:    'bg-amber-100 text-amber-800',
    open_defence:    'bg-orange-100 text-orange-800',
    no_show:         'bg-purple-100 text-purple-800',
    central:         'bg-rose-100 text-rose-800',
    funding_revoked: 'bg-red-100 text-red-800',
    unknown:         'bg-gray-100 text-gray-500',
};

/** Ask for a reason, then reopen each proposal through the normal Reopen — one by one, so each is logged and its team notified. */
function RestoreModal({ proposals, onClose, onDone }) {
    const { success, error } = useToast();
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState({});
    const restorable = proposals.filter((p) => p.restorable);
    const skipped = proposals.length - restorable.length;

    const submit = async () => {
        setBusy(true);
        let ok = 0;
        for (const p of restorable) {
            try {
                await post(`/proposals/${p.id}/reopen`, { reason });
                setResults((r) => ({ ...r, [p.id]: 'ok' }));
                ok++;
            } catch (e) {
                setResults((r) => ({ ...r, [p.id]: e.response?.data?.message ?? 'Could not restore.' }));
            }
        }
        setBusy(false);
        if (ok === restorable.length) {
            success(ok === 1 ? 'Proposal restored.' : `${ok} proposals restored.`);
            onDone();
        } else {
            error(`${restorable.length - ok} of ${restorable.length} could not be restored — see the list.`);
        }
    };

    const failed = Object.values(results).some((r) => r !== 'ok');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">
                            Restore {restorable.length === 1 ? 'proposal' : `${restorable.length} proposals`}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">Each goes back to the stage it was rejected from. The team is notified and the history records your reason.</p>
                    </div>
                    <button onClick={onClose} disabled={busy} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={16} /></button>
                </div>

                <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                    {restorable.map((p) => (
                        <li key={p.id} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <span className="min-w-0 truncate font-medium text-gray-900">{p.tracker_number} · {p.title}</span>
                                {results[p.id] === 'ok' && <span className="shrink-0 text-xs font-semibold text-emerald-600">Restored</span>}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="text-rose-600">Rejected</span> <ArrowRight size={12} /> <span className="font-medium text-gray-800">{p.restore_to_label}</span>
                            </div>
                            {p.restore_next && <p className="mt-1 text-xs text-amber-700">Then: {p.restore_next}</p>}
                            {results[p.id] && results[p.id] !== 'ok' && <p className="mt-1 text-xs text-red-600">{results[p.id]}</p>}
                        </li>
                    ))}
                </ul>
                {skipped > 0 && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        {skipped} selected proposal{skipped === 1 ? ' has' : 's have'} no rejection on record, so there is nowhere known to restore {skipped === 1 ? 'it' : 'them'} to — skipped.
                    </p>
                )}

                <label className="mt-4 block text-sm font-medium text-gray-700">
                    Reason <span className="text-red-500">*</span>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} disabled={busy}
                        placeholder="e.g. Rejected by mistake when a reviewer was removed — restoring for reconsideration."
                        className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <p className="mt-1 text-xs text-gray-400">At least 10 characters. Shown to the team in their notification.</p>

                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={onClose} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        {failed ? 'Close' : 'Cancel'}
                    </button>
                    <button onClick={submit} disabled={busy || reason.trim().length < 10 || restorable.length === 0}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        Restore {restorable.length > 1 ? restorable.length : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}

const OUTCOME_STYLES = {
    pass: 'text-emerald-700',
    fail: 'text-red-600',
};

/** Apply never-applied blind review results — one by one, through the normal blind review decision. */
function ApplyBlindReviewModal({ proposals, onClose, onDone }) {
    const { success, error } = useToast();
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState({});
    const failing = proposals.filter((p) => p.outcome === 'fail').length;

    const submit = async () => {
        setBusy(true);
        let ok = 0;
        for (const p of proposals) {
            try {
                const res = await post(`/proposals/${p.id}/restore-blind-review`);
                setResults((r) => ({ ...r, [p.id]: { ok: true, message: res?.message } }));
                ok++;
            } catch (e) {
                setResults((r) => ({ ...r, [p.id]: { ok: false, message: e.response?.data?.message ?? 'Could not apply.' } }));
            }
        }
        setBusy(false);
        if (ok === proposals.length) {
            success(ok === 1 ? 'Blind review result applied.' : `${ok} blind review results applied.`);
            onDone();
        } else {
            error(`${proposals.length - ok} of ${proposals.length} could not be applied — see the list.`);
        }
    };

    const done = Object.keys(results).length > 0 && !busy;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">
                            Restore to blind review{proposals.length > 1 ? ` (${proposals.length})` : ''}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">Each goes back to its blind review stage and the submitted review is applied with the normal pass mark — exactly as if it had never been sent back.</p>
                    </div>
                    <button onClick={onClose} disabled={busy} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={16} /></button>
                </div>

                <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                    {proposals.map((p) => (
                        <li key={p.id} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                            <div className="truncate font-medium text-gray-900">{p.tracker_number} · {p.title}</div>
                            <div className="mt-1 text-xs text-gray-500">
                                Score {p.score_label ?? '—'}{p.threshold != null ? ` · pass mark ${p.threshold}` : ''}
                                {' → '}<span className={`font-medium ${OUTCOME_STYLES[p.outcome] ?? 'text-amber-700'}`}>{p.outcome_label}</span>
                            </div>
                            {results[p.id] && <p className={`mt-1 text-xs ${results[p.id].ok ? 'text-emerald-600' : 'text-red-600'}`}>{results[p.id].message}</p>}
                        </li>
                    ))}
                </ul>

                {failing > 0 && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        {failing === 1 ? 'One proposal is' : `${failing} proposals are`} below the pass mark and will be rejected, and the team told. You can still restore {failing === 1 ? 'it' : 'them'} later from the Rejected tab.
                    </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={done ? onDone : onClose} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        {done ? 'Close' : 'Cancel'}
                    </button>
                    {!done && (
                        <button onClick={submit} disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                            Restore {proposals.length > 1 ? proposals.length : ''}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function RejectedProposals() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [academicYear, setAcademicYear] = useState('');
    const [category, setCategory] = useState('');
    const [kind, setKind] = useState('');
    const [restoring, setRestoring] = useState(null);
    const [applying, setApplying] = useState(null);
    const [tab, setTab] = useState('rejected');

    const load = useCallback(() => {
        setLoading(true);
        return get('/rejected-proposals', { academic_year: academicYear || undefined, category: category || undefined })
            .then((r) => setData(r.data ?? null))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [academicYear, category]);

    useEffect(() => { load(); }, [load]);

    const proposals = data?.proposals ?? [];
    const rows = useMemo(() => (kind ? proposals.filter((p) => p.kind === kind) : proposals), [proposals, kind]);
    const canRestore = !!data?.can_restore;
    const kinds = data?.kinds ?? {};
    const counts = data?.counts ?? {};
    const unapplied = data?.unapplied ?? [];

    const unappliedColumns = [
        {
            id: 'proposal', header: 'Proposal', accessorFn: (p) => `${p.tracker_number} ${p.title} ${p.pi ?? ''} ${p.college ?? ''}`,
            cell: ({ row: { original: p } }) => (
                <div className="min-w-56 max-w-sm">
                    <Link href={`/proposals/${p.id}`} className="font-semibold text-gray-900 hover:text-blue-700">{p.title}</Link>
                    <div className="mt-0.5 text-xs text-gray-500">{p.tracker_number} · {p.programme}</div>
                    <div className="text-xs text-gray-400">{[p.pi, p.college].filter(Boolean).join(' · ')}</div>
                </div>
            ),
        },
        {
            id: 'result', header: 'Blind review result', accessorFn: (p) => p.score_label ?? '',
            cell: ({ row: { original: p } }) => (
                <div className="whitespace-nowrap text-sm">
                    <div className="font-semibold text-gray-900">{p.score_label ?? '—'}</div>
                    <div className="text-xs text-gray-400">
                        {p.threshold != null ? `Pass mark ${p.threshold} · ` : ''}{p.submitted} review{p.submitted === 1 ? '' : 's'} submitted{p.required ? ` of ${p.required}` : ''}
                    </div>
                </div>
            ),
        },
        {
            id: 'reverted', header: 'Sent back to validated', accessorFn: (p) => p.reverted_at ?? '',
            cell: ({ row: { original: p } }) => (
                <div className="whitespace-nowrap text-sm">
                    <div className="text-gray-800">{p.reverted_at ? formatDate(p.reverted_at) : '—'}</div>
                    <div className="text-xs text-gray-400">{p.reverted_by ? `${p.reverted_by} removed a reviewer` : '—'}</div>
                </div>
            ),
        },
        {
            id: 'outcome', header: 'Restoring will', accessorFn: (p) => p.outcome_label,
            cell: ({ row: { original: p } }) => (
                <span className={`block min-w-48 max-w-60 text-sm font-medium ${OUTCOME_STYLES[p.outcome] ?? 'text-amber-700'}`}>{p.outcome_label}</span>
            ),
        },
        ...(canRestore ? [{
            id: 'actions', header: '', enableSorting: false,
            cell: ({ row: { original: p } }) => (
                <button onClick={() => setApplying([p])}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                    <RotateCcw size={13} /> Restore to blind review
                </button>
            ),
        }] : []),
    ];

    const columns = [
        {
            id: 'proposal', header: 'Proposal', accessorFn: (p) => `${p.tracker_number} ${p.title} ${p.pi ?? ''} ${p.college ?? ''}`,
            cell: ({ row: { original: p } }) => (
                <div className="min-w-56 max-w-sm">
                    <Link href={`/proposals/${p.id}`} className="font-semibold text-gray-900 hover:text-blue-700">{p.title}</Link>
                    <div className="mt-0.5 text-xs text-gray-500">{p.tracker_number} · {p.programme}</div>
                    <div className="text-xs text-gray-400">{[p.pi, p.college].filter(Boolean).join(' · ')}</div>
                </div>
            ),
        },
        {
            id: 'kind', header: 'How it was rejected', accessorFn: (p) => p.kind_label,
            cell: ({ row: { original: p } }) => (
                <div className="flex flex-col items-start gap-1">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${KIND_STYLES[p.kind] ?? KIND_STYLES.unknown}`}>{p.kind_label}</span>
                    {p.automatic && <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Bot size={11} /> Automatic</span>}
                </div>
            ),
        },
        {
            id: 'rejected_at', header: 'Rejected', accessorFn: (p) => p.rejected_at ?? '',
            cell: ({ row: { original: p } }) => (
                <div className="whitespace-nowrap text-sm">
                    <div className="text-gray-800">{p.rejected_at ? formatDate(p.rejected_at) : '—'}</div>
                    <div className="text-xs text-gray-400">{p.rejected_by ?? '—'}</div>
                </div>
            ),
        },
        {
            id: 'reason', header: 'Reason', accessorFn: (p) => p.reason ?? '',
            cell: ({ row: { original: p } }) => (
                <p className="line-clamp-3 min-w-44 max-w-xs text-xs text-gray-600" title={p.reason ?? ''}>{p.reason || '—'}</p>
            ),
        },
        {
            id: 'restore_to', header: 'Restores to', accessorFn: (p) => p.restore_to_label ?? '',
            cell: ({ row: { original: p } }) => p.restorable ? (
                <div className="min-w-48 max-w-60 text-sm">
                    <div className="font-medium text-gray-800">{p.restore_to_label}</div>
                    {p.restore_next && <div className="mt-0.5 text-xs text-amber-700">{p.restore_next}</div>}
                </div>
            ) : <span className="text-xs text-gray-400">Unknown — can't restore</span>,
        },
        ...(canRestore ? [{
            id: 'actions', header: '', enableSorting: false,
            cell: ({ row: { original: p } }) => p.restorable && (
                <button onClick={() => setRestoring([p])}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                    <RotateCcw size={13} /> Restore
                </button>
            ),
        }] : []),
    ];

    return (
        <AppLayout breadcrumb="Rejected Proposals">
            <div className="mx-auto max-w-7xl space-y-6">
                <PageHeader icon={XCircle} color="red" title="Rejected Proposals"
                    description="Every rejected proposal in one place, and every blind review result that was never applied — with a way to restore each to where it belongs.">
                    <Select label={term('academic_year')} value={academicYear} onChange={setAcademicYear}>
                        <option value="">{data?.academic_year && data.academic_year !== 'all' ? `Current (${data.academic_year})` : 'Current year'}</option>
                        <option value="all">All years</option>
                        {(data?.academic_years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
                    </Select>
                    <Select label="Programme" value={category} onChange={setCategory}>
                        <option value="">All programmes</option>
                        {programmeKeys().map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                    </Select>
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {/* Rejected proposals, and proposals whose blind review result was never applied */}
                <div className="flex gap-1 border-b border-gray-200">
                    <button onClick={() => setTab('rejected')}
                        className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === 'rejected' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        Rejected <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{proposals.length}</span>
                    </button>
                    <button onClick={() => setTab('unapplied')}
                        className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === 'unapplied' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        Blind review result not applied
                        <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${unapplied.length ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{unapplied.length}</span>
                    </button>
                </div>

                {tab === 'unapplied' && (
                    <Panel bodyClassName="p-4">
                        <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <ClipboardCheck size={16} className="mt-0.5 shrink-0" />
                            <span>These proposals show <b>Assign reviewers</b> although a reviewer had already submitted their blind review: removing another reviewer sent them back to Validated before the result was applied. Restoring returns each to its blind review stage and applies the submitted result.</span>
                        </p>
                        <DataTable
                            columns={unappliedColumns}
                            data={unapplied}
                            isLoading={loading}
                            emptyMessage="No proposals are waiting for a blind review result to be applied."
                            selectable={canRestore}
                            bulkActions={[{ label: 'Restore selected to blind review', action: 'apply', variant: 'primary' }]}
                            onBulkAction={(action, ids) => action === 'apply' && setApplying(unapplied.filter((p) => ids.includes(p.id)))}
                        />
                    </Panel>
                )}

                {tab === 'rejected' && (<>
                {/* How they were rejected — click to filter */}
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setKind('')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${kind === '' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                        All <span className="ml-1 opacity-70">{proposals.length}</span>
                    </button>
                    {Object.entries(kinds).filter(([key]) => counts[key]).map(([key, label]) => (
                        <button key={key} onClick={() => setKind(kind === key ? '' : key)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${kind === key ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                            {label} <span className="ml-1 opacity-70">{counts[key]}</span>
                        </button>
                    ))}
                </div>

                <Panel bodyClassName="p-4">
                    <DataTable
                        columns={columns}
                        data={rows}
                        isLoading={loading}
                        emptyMessage="No rejected proposals match these filters."
                        selectable={canRestore}
                        bulkActions={[{ label: 'Restore selected', action: 'restore', variant: 'primary' }]}
                        onBulkAction={(action, ids) => action === 'restore' && setRestoring(rows.filter((p) => ids.includes(p.id)))}
                    />
                    {canRestore && (
                        <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
                            <Info size={13} className="mt-0.5 shrink-0" />
                            Restoring uses Reopen for Reconsideration: the proposal returns to the stage it was rejected from, the history records who and why, and the team is notified.
                        </p>
                    )}
                </Panel>
                </>)}
            </div>

            {applying && (
                <ApplyBlindReviewModal proposals={applying} onClose={() => setApplying(null)}
                    onDone={() => { setApplying(null); load(); }} />
            )}

            {restoring && (
                <RestoreModal proposals={restoring} onClose={() => setRestoring(null)}
                    onDone={() => { setRestoring(null); load(); }} />
            )}
        </AppLayout>
    );
}
