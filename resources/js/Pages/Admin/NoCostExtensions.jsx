import { useState } from 'react';
import { CalendarRange, Loader2, ArrowRight } from 'lucide-react';
import ReviewQueue, { DecisionSheet, DecisionToggle, Quote } from '../../Components/ReviewQueue';
import { post } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { useToast } from '../../Components/Toast';
import RejectWithReasonModal from '../../Components/RejectWithReasonModal';

const addMonths = (iso, months) => {
    if (!iso || !months) return null;
    const d = new Date(iso);
    d.setMonth(d.getMonth() + Number(months));
    return d.toISOString();
};

/** Current → requested duration, and when the project would now end. */
function Durations({ item, large }) {
    const start = item.proposal?.award?.approved_at;
    const extra = item.requested_duration_months - item.current_duration_months;
    const size = large ? 'text-2xl' : 'text-sm';
    return (
        <div className={`flex items-center ${large ? 'justify-center gap-4 rounded-xl bg-gray-50 py-3' : 'gap-2'}`}>
            <div className="text-center">
                {large && <p className="text-[11px] text-gray-500">Now</p>}
                <p className={`${size} font-bold tabular-nums text-gray-900`}>{item.current_duration_months}<span className="text-xs font-normal text-gray-400"> mo</span></p>
                {large && start && <p className="text-[10px] text-gray-400">ends {formatDate(addMonths(start, item.current_duration_months))}</p>}
            </div>
            <ArrowRight size={large ? 18 : 13} className="text-gray-300" />
            <div className="text-center">
                {large && <p className="text-[11px] text-gray-500">Asked</p>}
                <p className={`${size} font-bold tabular-nums text-emerald-700`}>{item.requested_duration_months}<span className="text-xs font-normal text-gray-400"> mo</span></p>
                {large && start && <p className="text-[10px] text-gray-400">ends {formatDate(addMonths(start, item.requested_duration_months))}</p>}
            </div>
            <span className={`rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700 ${large ? 'text-sm' : 'text-[11px]'}`}>+{extra} mo</span>
        </div>
    );
}

function ReviewModal({ item, onClose, onDone }) {
    const [decision, setDecision] = useState('approved');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [denying, setDenying] = useState(false);
    const { error, success } = useToast();
    const valid = true;

    const submit = async () => {
        // A denial uses the standard reasons list, like every other rejection.
        if (decision === 'denied') { setDenying(true); return; }
        setSaving(true);
        try {
            const res = await post(`/no-cost-extensions/${item.id}/approve`, { resolution_notes: notes.trim() || null });
            success(res?.message || 'Request approved.');
            onDone();
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs ? Object.values(errs).flat()[0] : (e.response?.data?.message || 'The request could not be decided.'));
        }
        setSaving(false);
    };

    return (
        <DecisionSheet icon={CalendarRange} title="Decide no-cost extension" subtitle={`${item.proposal?.tracker_number} · ${item.proposal?.title}`} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={saving || !valid}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                    {saving && <Loader2 size={14} className="animate-spin" />} {decision === 'approved' ? 'Approve & extend' : 'Choose a reason & deny'}
                </button>
            </>}>
            <Durations item={item} large />
            <Quote label={`Reason from ${item.requested_by?.name ?? 'the PI'}`}>{item.reason}</Quote>
            <DecisionToggle value={decision} onChange={setDecision} approveLabel="Approve" denyLabel="Deny" />
            <p className="text-xs text-gray-500">{decision === 'approved' ? 'The project’s duration changes straight away; the budget stays the same.' : 'The project keeps its current end date.'}</p>
            {decision === 'approved' ? (
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Notes to the PI <span className="font-normal text-gray-400">(optional)</span></span>
                    <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the team should know…"
                        className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                </label>
            ) : <p className="text-xs text-gray-500">Next you choose the reason from the standard list; the PI is told it.</p>}
            {denying && (
                <RejectWithReasonModal context="no_cost_extension" title="Deny no-cost extension" subtitle={item.proposal?.tracker_number}
                    note="The PI is told this reason. The project end date stays unchanged." confirmLabel="Deny request"
                    onClose={() => setDenying(false)}
                    onSubmit={async (payload) => {
                        const res = await post(`/no-cost-extensions/${item.id}/reject`, payload);
                        success(res?.message || 'Request denied.');
                        onDone();
                    }} />
            )}
        </DecisionSheet>
    );
}

const config = {
    title: 'No-Cost Extensions',
    noun: 'request',
    filename: 'no-cost-extensions',
    icon: CalendarRange,
    color: 'violet',
    description: 'Funded projects asking for more time to finish, with no extra money.',
    endpoint: '/no-cost-extensions',
    personLabel: 'Requested by',
    person: (i) => i.requested_by?.name,
    statusLabels: { approved: 'Approved', denied: 'Denied' },
    emptyText: 'Decided requests appear here.',
    exportExtra: [
        { label: 'Current months', value: (i) => i.current_duration_months },
        { label: 'Requested months', value: (i) => i.requested_duration_months },
        { label: 'Extra months', value: (i) => i.requested_duration_months - i.current_duration_months },
    ],
    highlight: (i) => <Durations item={i} />,
    detail: (i) => (
        <>
            <Quote label="Reason">{i.reason}</Quote>
            {i.resolution_notes && (
                <Quote label={`Decision${i.resolved_at ? ` · ${formatDate(i.resolved_at)}` : ''}`} tone={i.status === 'approved' ? 'emerald' : 'red'}>{i.resolution_notes}</Quote>
            )}
            {i.status === 'approved' && !i.resolution_notes && <p className="text-xs text-emerald-700">Approved{i.resolved_at ? ` on ${formatDate(i.resolved_at)}` : ''} — the project now runs {i.requested_duration_months} months.</p>}
        </>
    ),
    Modal: ReviewModal,
};

export default function NoCostExtensions() {
    return <ReviewQueue config={config} />;
}
