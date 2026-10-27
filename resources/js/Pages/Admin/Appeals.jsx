import { useState } from 'react';
import { Scale, Loader2, Undo2 } from 'lucide-react';
import ReviewQueue, { DecisionSheet, DecisionToggle, Quote } from '../../Components/ReviewQueue';
import { post } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

function ResolveModal({ item, onClose, onDone }) {
    const [decision, setDecision] = useState('approved');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();
    const valid = notes.trim().length >= 10;

    const submit = async () => {
        if (!valid) return error('Write at least 10 characters explaining the decision.');
        setSaving(true);
        try {
            const res = await post(`/appeals/${item.id}/resolve`, { decision, resolution_notes: notes.trim() });
            success(res?.message || 'Appeal decided.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message || 'The appeal could not be decided.');
        }
        setSaving(false);
    };

    return (
        <DecisionSheet icon={Scale} title="Decide appeal" subtitle={`${item.proposal?.tracker_number} · ${item.proposal?.title}`} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={saving || !valid}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                    {saving && <Loader2 size={14} className="animate-spin" />} {decision === 'approved' ? 'Approve & reopen' : 'Deny appeal'}
                </button>
            </>}>
            {item.proposal?.rejection_reason && <Quote label="Why it was rejected" tone="red">{item.proposal.rejection_reason}</Quote>}
            <Quote label={`Appeal from ${item.submitted_by?.name ?? 'the team'}`}>{item.reason}</Quote>
            <DecisionToggle value={decision} onChange={setDecision} approveLabel="Approve & reopen" denyLabel="Deny appeal" />
            {decision === 'approved' && (
                <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                    <Undo2 size={13} className="mt-0.5 shrink-0" /> The proposal goes back to draft so the team can revise and resubmit it.
                </p>
            )}
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Notes to the team</span>
                <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain the decision…"
                    className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                <span className="mt-1 block text-xs text-gray-400">At least 10 characters. The team receives this by email.</span>
            </label>
        </DecisionSheet>
    );
}

const config = {
    title: 'Appeals',
    noun: 'appeal',
    filename: 'appeals',
    icon: Scale,
    color: 'slate',
    description: 'Teams asking to reconsider a rejected proposal. Approving reopens it as a draft.',
    endpoint: '/appeals',
    personLabel: 'Submitted by',
    person: (i) => i.submitted_by?.name,
    statusLabels: { approved: 'Approved', denied: 'Denied' },
    emptyText: 'Decided appeals appear here.',
    exportExtra: [{ label: 'Rejection reason', value: (i) => i.proposal?.rejection_reason }],
    detail: (i) => (
        <>
            {i.proposal?.rejection_reason && i.status === 'pending' && <Quote label="Why it was rejected" tone="red">{i.proposal.rejection_reason}</Quote>}
            <Quote label="Appeal">{i.reason}</Quote>
            {i.resolution_notes && (
                <Quote label={`Decision${i.resolved_at ? ` · ${formatDate(i.resolved_at)}` : ''}`} tone={i.status === 'approved' ? 'emerald' : 'red'}>{i.resolution_notes}</Quote>
            )}
        </>
    ),
    Modal: ResolveModal,
};

export default function Appeals() {
    return <ReviewQueue config={config} />;
}
