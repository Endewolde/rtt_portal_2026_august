import { useEffect, useState } from 'react';
import { FileLock2, RefreshCw, ShieldAlert, CheckCircle2, XCircle, X, Info, Clock } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { useToast } from '../../Components/Toast';

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const STATUS = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-gray-100 text-gray-600 border-gray-200',
    cancelled: 'bg-gray-50 text-gray-400 border-gray-200',
};

/** Admin: people's requests to delete their personal data. */
export default function DataRequests() {
    const { success, error } = useToast();
    const [rows, setRows] = useState(null);
    const [acting, setActing] = useState(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const load = () => get('/admin/data-deletion-requests').then((r) => setRows(r.data ?? [])).catch(() => { setRows([]); error('Could not load requests.'); });
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async () => {
        setSaving(true);
        try {
            const res = await post(`/admin/data-deletion-requests/${acting.row.id}/${acting.type}`, { note: note.trim() || null });
            success(res.message);
            setActing(null);
            setNote('');
            load();
        } catch (e) {
            const errors = e.response?.data?.errors;
            error(errors && Object.keys(errors).length ? Object.values(errors).flat()[0] : (e.response?.data?.message ?? 'The action failed.'));
        }
        setSaving(false);
    };

    const pendingCount = (rows ?? []).filter((r) => r.status === 'pending').length;
    const rejecting = acting?.type === 'reject';

    return (
        <AppLayout breadcrumb="Data Deletion Requests">
            <div className="mx-auto max-w-5xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100"><FileLock2 size={20} className="text-rose-600" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Data Deletion Requests</h1>
                            <p className="mt-0.5 text-sm text-gray-500">People who asked for their personal data to be removed{pendingCount ? ` · ${pendingCount} waiting` : ''}.</p>
                        </div>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><RefreshCw size={14} /> <span className="hidden sm:inline">Refresh</span></button>
                </div>

                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                    <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <span>Approving anonymises the account: name, email, phone and other personal details are removed and sign-in is disabled. Proposals, reviews and decisions stay as records, shown as "Deleted User". This cannot be undone.</span>
                </div>

                {!rows ? (
                    <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}</div>
                ) : rows.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-14 text-center">
                        <FileLock2 size={28} className="mx-auto text-gray-300" />
                        <p className="mt-3 font-semibold text-gray-700">No requests</p>
                        <p className="mt-1 text-sm text-gray-400">Requests made from My Profile → Your Data &amp; Privacy appear here.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {rows.map((r) => (
                            <li key={r.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-gray-900">{r.user.name}</p>
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS[r.status]}`}>{r.status}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{r.user.email} · requested {formatDate(r.created_at)}</p>
                                        {r.reason && <p className="mt-2 text-sm text-gray-700">“{r.reason}”</p>}
                                        {r.handled_at && (
                                            <p className="mt-2 text-xs text-gray-500">
                                                {r.status === 'cancelled' ? 'Cancelled by the person' : `${r.status === 'approved' ? 'Approved' : 'Declined'} by ${r.handled_by ?? 'an admin'}`} on {formatDate(r.handled_at)}{r.admin_note ? ` — ${r.admin_note}` : ''}
                                            </p>
                                        )}
                                        {r.blockers.length > 0 && (
                                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                                                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800"><ShieldAlert size={13} /> Can't be removed yet</p>
                                                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-800">{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                                            </div>
                                        )}
                                    </div>
                                    {r.status === 'pending' && (
                                        <div className="flex shrink-0 gap-2">
                                            <button onClick={() => { setActing({ row: r, type: 'reject' }); setNote(''); }}
                                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Decline</button>
                                            <button onClick={() => { setActing({ row: r, type: 'approve' }); setNote(''); }} disabled={r.blockers.length > 0}
                                                title={r.blockers.length ? 'Resolve the items listed first' : ''}
                                                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">Approve &amp; anonymise</button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {acting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                        <div className={`h-1.5 rounded-t-2xl ${rejecting ? 'bg-gray-400' : 'bg-gradient-to-r from-rose-500 to-red-600'}`} />
                        <div className="flex items-start justify-between gap-3 px-6 pt-5">
                            <div className="flex items-start gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${rejecting ? 'bg-gray-100 text-gray-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {rejecting ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">{rejecting ? 'Decline Request' : 'Approve & Anonymise'}</h2>
                                    <p className="text-xs text-gray-500">{acting.row.user.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setActing(null)} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                        </div>
                        <div className="space-y-3 px-6 py-5">
                            {!rejecting && <p className="flex items-start gap-2 text-sm text-gray-700"><Clock size={14} className="mt-0.5 shrink-0 text-rose-500" /> This permanently removes their personal details. It cannot be undone.</p>}
                            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} autoFocus
                                placeholder={rejecting ? 'Reason (sent to the person, at least 10 characters)' : 'Optional internal note'}
                                className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
                        </div>
                        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                            <button onClick={() => setActing(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                            <button onClick={submit} disabled={saving || (rejecting && note.trim().length < 10)}
                                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${rejecting ? 'bg-gray-700 hover:bg-gray-800' : 'bg-rose-600 hover:bg-rose-700'}`}>
                                {saving ? 'Saving…' : rejecting ? 'Decline' : 'Approve & anonymise'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
