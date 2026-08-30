import { useState, useEffect } from 'react';
import { usePage, Link } from '@inertiajs/react';
import {
    DollarSign, CheckCircle2, Clock, Send, XCircle, CreditCard,
    FileCheck, ArrowLeft, AlertCircle, ChevronRight, Info,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { formatDate, formatDateTime, formatCurrency } from '../../lib/utils';
import api from '../../lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    draft:                { label: 'Draft',              cls: 'bg-gray-100 text-gray-600',     icon: Clock,        step: 0 },
    pending_signatures:   { label: 'Pending Signatures', cls: 'bg-yellow-100 text-yellow-700', icon: Clock,        step: 1 },
    submitted:            { label: 'Submitted',          cls: 'bg-blue-100 text-blue-700',     icon: Send,         step: 2 },
    under_college_review: { label: 'Under Review',       cls: 'bg-purple-100 text-purple-700', icon: Clock,        step: 2 },
    finance_returned:     { label: 'Returned by Finance', cls: 'bg-orange-100 text-orange-700', icon: XCircle,     step: 2 },
    college_approved:     { label: 'College Approved',   cls: 'bg-indigo-100 text-indigo-700', icon: CheckCircle2, step: 3 },
    approved:             { label: 'Finance Approved',   cls: 'bg-green-100 text-green-700',   icon: CheckCircle2, step: 4 },
    rejected:             { label: 'Rejected',           cls: 'bg-red-100 text-red-700',       icon: XCircle,      step: 2 },
    disbursed:            { label: 'Disbursed',          cls: 'bg-teal-100 text-teal-700',     icon: CreditCard,   step: 5 },
    settled:              { label: 'Settled',            cls: 'bg-slate-100 text-slate-600',   icon: FileCheck,    step: 6 },
};

const TIMELINE_STEPS = [
    { key: 'draft',            label: 'Created',          icon: DollarSign   },
    { key: 'signed',           label: 'Signed',           icon: CheckCircle2 },
    { key: 'submitted',        label: 'Submitted',        icon: Send         },
    { key: 'college_approved', label: 'College Approved', icon: CheckCircle2 },
    { key: 'approved',         label: 'Finance Approved', icon: CheckCircle2 },
    { key: 'disbursed',        label: 'Disbursed',        icon: CreditCard   },
    { key: 'settled',          label: 'Settled',          icon: FileCheck    },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, size = 'sm' }) {
    const cfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
    const Icon = cfg.icon;
    const pad  = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad} ${cfg.cls}`}>
            <Icon size={size === 'lg' ? 14 : 11} />{cfg.label}
        </span>
    );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ status }) {
    const currentStep = STATUS_CONFIG[status]?.step ?? 0;
    return (
        <div className="flex items-center gap-0">
            {TIMELINE_STEPS.map((s, i) => {
                const done    = i < currentStep || (i === currentStep && status !== 'draft');
                const active  = i === currentStep;
                const Icon    = s.icon;
                return (
                    <div key={s.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                done   ? 'bg-blue-600 border-blue-600 text-white' :
                                active ? 'bg-white border-blue-600 text-blue-600' :
                                         'bg-gray-100 border-gray-200 text-gray-400'
                            }`}>
                                {done ? <CheckCircle2 size={14} /> : <Icon size={13} />}
                            </div>
                            <span className={`text-[10px] font-medium whitespace-nowrap ${done || active ? 'text-blue-700' : 'text-gray-400'}`}>
                                {s.label}
                            </span>
                        </div>
                        {i < TIMELINE_STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mb-5 mx-1 ${i < currentStep ? 'bg-blue-500' : 'bg-gray-200'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, action }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                    <Icon size={16} className="text-gray-500" />
                    <p className="text-sm font-semibold text-gray-800">{title}</p>
                </div>
                {action}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

// ─── Refuse modal ─────────────────────────────────────────────────────────────

function RefuseModal({ requestId, onClose, onDone }) {
    const { error } = useToast();
    const [reason,    setReason]    = useState('');
    const [refusing,  setRefusing]  = useState(false);

    const submit = async () => {
        if (reason.trim().length < 5) return error('Reason must be at least 5 characters.');
        setRefusing(true);
        try {
            await api.post(`/budget-requests/${requestId}/refuse`, { reason });
            onDone();
        } catch (e) { error(e.response?.data?.message ?? 'Failed to refuse.'); }
        setRefusing(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Refuse Signature</h3>
                <p className="text-sm text-gray-500 mb-4">Provide a reason for refusing to sign this budget request.</p>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                    placeholder="Explain why you are refusing…" />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={refusing || reason.trim().length < 5}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                        {refusing ? 'Refusing…' : 'Refuse'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetRequestDetail() {
    const { url }          = usePage();
    const id               = url.split('/').pop();
    const { user, hasAnyRole } = useAuth();
    const { success, error }   = useToast();

    const [request,    setRequest]    = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [acting,     setActing]     = useState(false);
    const [showRefuse, setShowRefuse] = useState(false);

    const load = () => {
        setLoading(true);
        api.get(`/budget-requests/${id}`)
            .then(r => setRequest(r.data?.data ?? r.data))
            .catch(() => error('Failed to load budget request.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const isCollegeOfficer = hasAnyRole(['super_admin', 'admin', 'central_officer', 'college_officer']);
    const isFinanceOfficer = hasAnyRole(['super_admin', 'admin', 'central_officer', 'finance_officer', 'support_officer']);

    const act = async (apiCall, successMsg) => {
        if (acting) return;
        setActing(true);
        try {
            const res = await apiCall();
            setRequest(res.data?.data ?? res.data);
            success(successMsg);
        } catch (e) {
            error(e.response?.data?.message ?? 'Action failed.');
        } finally {
            setActing(false);
        }
    };

    if (loading) return (
        <AppLayout breadcrumb="Budget Requests / Detail">
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        </AppLayout>
    );

    if (!request) return (
        <AppLayout breadcrumb="Budget Requests / Detail">
            <div className="max-w-3xl mx-auto text-center py-20">
                <AlertCircle size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Budget request not found.</p>
                <Link href="/budget-requests" className="text-blue-600 text-sm hover:underline mt-2 inline-block">← Back to Budget Requests</Link>
            </div>
        </AppLayout>
    );

    const sigs      = request.signatures ?? [];
    const signed    = sigs.filter(s => s.status === 'signed').length;
    const allSigned = signed === sigs.length && sigs.length > 0;
    const mySig     = sigs.find(s => s.user_id === user?.id);
    const canSign   = mySig?.status === 'pending';
    const canSubmit         = allSigned && ['draft', 'pending_signatures'].includes(request.status);
    const canCollegeApprove = isCollegeOfficer && ['submitted', 'finance_returned'].includes(request.status);
    const canFinanceApprove = isFinanceOfficer && request.status === 'college_approved';
    const canDisburse       = isFinanceOfficer && request.status === 'approved';

    return (
        <AppLayout breadcrumb={`Budget Requests / ${request.proposal?.tracker_number ?? id}`}>
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Back + header */}
                <div className="flex items-center gap-3">
                    <Link href="/budget-requests"
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500">
                        <ArrowLeft size={16} />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-blue-600">{request.proposal?.tracker_number}</span>
                            <span className="text-gray-400 text-sm">Round {request.funding_round}</span>
                            <StatusBadge status={request.status} size="lg" />
                        </div>
                        <p className="text-base font-bold text-gray-900 truncate mt-0.5">{request.proposal?.title}</p>
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Request Progress</p>
                    <Timeline status={request.status} />
                </div>

                <div className="grid lg:grid-cols-3 gap-5">
                    {/* Left col (2/3) */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* Budget items */}
                        <Section title="Budget Items" icon={DollarSign}>
                            {(request.items ?? []).length === 0 ? (
                                <p className="text-sm text-gray-400">No items.</p>
                            ) : (
                                <>
                                    <div className="hidden sm:block overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-100">
                                                    {['#', 'Category', 'Description', 'Amount', 'Justification'].map(h => (
                                                        <th key={h} className="text-left py-2 pr-4 text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {request.items.map((item, i) => (
                                                    <tr key={i}>
                                                        <td className="py-2.5 pr-4 text-xs font-medium text-gray-400 tabular-nums">{i + 1}</td>
                                                        <td className="py-2.5 pr-4 font-medium text-gray-700">{item.category}</td>
                                                        <td className="py-2.5 pr-4 text-gray-600">{item.description}</td>
                                                        <td className="py-2.5 pr-4 font-semibold text-gray-900">{formatCurrency(item.amount)}</td>
                                                        <td className="py-2.5 text-gray-400 text-xs">{item.justification || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile: stacked cards */}
                                    <div className="sm:hidden space-y-2">
                                        {request.items.map((item, i) => (
                                            <div key={i} className="border border-gray-100 rounded-xl p-3">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <span className="text-xs font-medium text-gray-700">{item.category}</span>
                                                    <span className="shrink-0 font-semibold text-gray-900 text-sm">{formatCurrency(item.amount)}</span>
                                                </div>
                                                <p className="text-sm text-gray-600">{item.description}</p>
                                                {item.justification && <p className="text-xs text-gray-400 mt-1">{item.justification}</p>}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-between items-center mt-3 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                                        <span className="text-sm font-bold text-blue-800">Total Requested</span>
                                        <span className="text-lg font-bold text-blue-900">{formatCurrency(request.total_amount)}</span>
                                    </div>
                                </>
                            )}
                        </Section>

                        {/* Signature chain */}
                        <Section title={`Signatures — ${signed}/${sigs.length} signed`} icon={CheckCircle2}>
                            {sigs.length === 0 ? (
                                <p className="text-sm text-gray-400">No signatures required.</p>
                            ) : (
                                <div className="space-y-3">
                                    {sigs.map(sig => (
                                        <div key={sig.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                sig.status === 'signed'  ? 'bg-green-500' :
                                                sig.status === 'refused' ? 'bg-red-500' : 'bg-gray-200'
                                            }`}>
                                                {sig.status === 'signed'  && <CheckCircle2 size={14} className="text-white" />}
                                                {sig.status === 'refused' && <XCircle      size={14} className="text-white" />}
                                                {sig.status === 'pending' && <Clock        size={14} className="text-gray-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-gray-800">{sig.user?.name ?? '—'}</span>
                                                    <span className="text-xs text-gray-400 capitalize">({sig.role})</span>
                                                </div>
                                                {sig.status === 'signed'  && <p className="text-xs text-green-600">Signed {formatDateTime(sig.signed_at)}</p>}
                                                {sig.status === 'refused' && sig.refusal_reason && <p className="text-xs text-red-500 truncate">{sig.refusal_reason}</p>}
                                                {sig.status === 'pending' && <p className="text-xs text-gray-400">Pending signature</p>}
                                            </div>
                                            <span className={`text-xs font-semibold capitalize shrink-0 ${
                                                sig.status === 'signed'  ? 'text-green-600' :
                                                sig.status === 'refused' ? 'text-red-500' : 'text-gray-400'
                                            }`}>{sig.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* My signature actions */}
                            {canSign && (
                                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                                    <button onClick={() => act('Sign', () => api.post(`/budget-requests/${id}/sign`), 'Signed successfully.')}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
                                        <CheckCircle2 size={14} /> Sign Budget Request
                                    </button>
                                    <button onClick={() => setShowRefuse(true)}
                                        className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50">
                                        <XCircle size={14} /> Refuse
                                    </button>
                                </div>
                            )}
                        </Section>

                        {/* Disbursements */}
                        {(request.disbursements ?? []).length > 0 && (
                            <Section title="Disbursements" icon={CreditCard}>
                                <div className="space-y-2">
                                    {request.disbursements.map(d => (
                                        <div key={d.id} className="flex items-center justify-between p-3 bg-teal-50 border border-teal-100 rounded-xl">
                                            <div>
                                                <p className="text-sm font-bold text-teal-800">{formatCurrency(d.amount)}</p>
                                                {d.transaction_id && <p className="text-xs text-teal-600">Txn: {d.transaction_id}</p>}
                                                {d.cheque_number  && <p className="text-xs text-teal-600">Cheque: {d.cheque_number}</p>}
                                                {d.notes          && <p className="text-xs text-teal-500">{d.notes}</p>}
                                            </div>
                                            <p className="text-xs text-teal-500">{formatDate(d.created_at)}</p>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* Settlement */}
                        {request.settlement && (
                            <Section title="Settlement" icon={FileCheck}>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Total Spent</span>
                                        <span className="font-bold text-gray-900">{formatCurrency(request.settlement.total_spent)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Status</span>
                                        <span className="font-medium capitalize text-gray-700">{request.settlement.status?.replace(/_/g, ' ')}</span>
                                    </div>
                                    {request.settlement.notes && (
                                        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{request.settlement.notes}</p>
                                    )}
                                </div>
                            </Section>
                        )}
                    </div>

                    {/* Right col (1/3) */}
                    <div className="space-y-5">
                        {/* Meta */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Details</p>
                            {[
                                ['Submitted by', request.requestedBy?.name],
                                ['Template',     request.formTemplate?.name],
                                ['Funding Round',`Round ${request.funding_round}`],
                                ['Created',      formatDate(request.created_at)],
                                ['Submitted',    request.submitted_at ? formatDate(request.submitted_at) : null],
                                ['Approved',     request.approved_at  ? formatDate(request.approved_at)  : null],
                            ].filter(([, v]) => v).map(([label, value]) => (
                                <div key={label} className="flex items-start justify-between gap-2 text-sm">
                                    <span className="text-gray-400 shrink-0">{label}</span>
                                    <span className="font-medium text-gray-800 text-right">{value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Actions</p>

                            {canSubmit && (
                                <button
                                    onClick={() => act(() => api.post(`/budget-requests/${id}/submit`), 'Submitted for review.')}
                                    disabled={acting}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-60">
                                    {acting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}
                                    Submit for Review
                                </button>
                            )}
                            {canCollegeApprove && (
                                <button
                                    onClick={() => act(() => api.post(`/budget-requests/${id}/approve`), 'Budget request approved by college.')}
                                    disabled={acting}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 disabled:opacity-60">
                                    {acting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                                    Approve Request
                                </button>
                            )}
                            {canFinanceApprove && (
                                <button
                                    onClick={() => act(() => api.post(`/budget-requests/${id}/approve`), 'Finance approval confirmed.')}
                                    disabled={acting}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 disabled:opacity-60">
                                    {acting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                                    Finance Approve
                                </button>
                            )}
                            {canDisburse && (
                                <Link href={`/disbursements`}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-teal-300 text-teal-700 text-sm font-semibold rounded-xl hover:bg-teal-50">
                                    <CreditCard size={14} /> Disburse Funds
                                </Link>
                            )}
                            {request.status === 'disbursed' && !request.settlement && (
                                <Link href={`/settlements`}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50">
                                    <FileCheck size={14} /> Submit Settlement
                                </Link>
                            )}

                            {!canSubmit && !canCollegeApprove && !canFinanceApprove && !canDisburse && request.status !== 'disbursed' && (
                                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                                    <Info size={13} className="shrink-0 mt-0.5" />
                                    {request.status === 'college_approved' ? 'Waiting for Finance Officer to approve.' :
                                     request.status === 'approved'         ? 'Waiting for Finance to disburse funds.' :
                                     request.status === 'settled'          ? 'This request has been fully settled.' :
                                     'No actions available at this stage.'}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {request.college_review_notes && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Review Notes</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{request.college_review_notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showRefuse && (
                <RefuseModal
                    requestId={id}
                    onClose={() => setShowRefuse(false)}
                    onDone={() => { setShowRefuse(false); success('Signature refused.'); load(); }}
                />
            )}
        </AppLayout>
    );
}
