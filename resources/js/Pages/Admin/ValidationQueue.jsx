import { useState, useEffect } from 'react';
import { CheckCircle, RotateCcw, XCircle, Clock } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import { get, post } from '../../lib/api';
import { formatDate } from '../../lib/utils';
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

function ProposalRow({ proposal, onAction }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-gray-500">{proposal.tracker_number}</span>
                    {proposal.proposal_call && (
                        <span className="text-xs text-gray-400">{proposal.proposal_call.academic_year}</span>
                    )}
                </div>
                <p className="text-sm font-medium text-gray-900 line-clamp-1">{proposal.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                    {proposal.pi?.name ?? '—'} · {proposal.college?.name ?? '—'} · Submitted {formatDate(proposal.submitted_at)}
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onAction('approve', proposal.id)}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Approve">
                    <CheckCircle size={16} />
                </button>
                <button onClick={() => onAction('return', proposal.id)}
                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg" title="Return">
                    <RotateCcw size={16} />
                </button>
                <button onClick={() => onAction('reject', proposal.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Reject">
                    <XCircle size={16} />
                </button>
            </div>
        </div>
    );
}

export default function ValidationQueue() {
    const toast = useToast();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialog, setDialog] = useState(null);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [view, setView] = useViewPreference('validation_queue', 'card');

    const load = () => {
        get('/proposals/validation-queue')
            .then((r) => setData(r.data?.data ?? r.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

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

    const now = new Date();
    const awaitingDeadline   = data.filter(p => p.proposal_call && new Date(p.proposal_call.end_date) > now);
    const readyForValidation = data.filter(p => !p.proposal_call || new Date(p.proposal_call.end_date) <= now);

    return (
        <AppLayout breadcrumb="Validation Queue">
            <div className="max-w-5xl mx-auto">
                <WorkflowBreadcrumb current="submitted" />
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-bold text-gray-900">Validation Queue</h1>
                    <ViewToggle view={view} onChange={setView} />
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <p className="text-gray-400">No proposals awaiting validation.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {awaitingDeadline.length > 0 && (
                            <div>
                                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Clock size={14} /> Awaiting Deadline ({awaitingDeadline.length})
                                </h2>
                                <div className="space-y-3">
                                    {awaitingDeadline.map(p => (
                                        <div key={p.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-xs font-bold text-amber-700">{p.tracker_number}</span>
                                                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Awaiting Deadline</span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{p.pi?.name ?? '—'} · {p.college?.name ?? '—'}</p>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <p className="text-xs text-amber-600 font-medium mb-0.5">Call closes:</p>
                                                <CountdownTimer endDate={p.proposal_call.end_date} />
                                                <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.proposal_call.end_date)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {readyForValidation.length > 0 && (
                            <div>
                                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <CheckCircle size={14} /> Ready for Validation ({readyForValidation.length})
                                </h2>
                                {view === 'table' ? (
                                    <ProposalTable
                                        proposals={readyForValidation}
                                        showColumns={['tracker','title','category','pi','college','deadline']}
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
                                    <div className="space-y-3">
                                        {readyForValidation.map(p => (
                                            <ProposalRow key={p.id} proposal={p} onAction={openDialog} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {dialog && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
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
