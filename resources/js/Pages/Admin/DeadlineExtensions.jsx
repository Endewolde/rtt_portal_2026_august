import { useState } from 'react';
import { CalendarClock, Loader2, CalendarCheck } from 'lucide-react';
import ReviewQueue, { DecisionSheet, DecisionToggle, Quote } from '../../Components/ReviewQueue';
import { post } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const daysBetween = (from, to) => (from && to ? Math.round((new Date(to) - new Date(from)) / 86400000) : null);

function ResolveModal({ item, onClose, onDone }) {
    const [decision, setDecision] = useState('approved');
    const [notes, setNotes] = useState('');
    const [grantedUntil, setGrantedUntil] = useState(toLocalInput(item.requested_until));
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();
    const callEnd = item.proposal?.proposal_call?.end_date;
    const extra = daysBetween(callEnd, grantedUntil);
    const valid = notes.trim().length >= 10 && (decision === 'denied' || !!grantedUntil);

    const submit = async () => {
        if (!valid) return error(decision === 'approved' && !grantedUntil ? 'Choose the new deadline.' : 'Write at least 10 characters explaining the decision.');
        setSaving(true);
        try {
            const payload = { decision, resolution_notes: notes.trim() };
            if (decision === 'approved') payload.granted_until = new Date(grantedUntil).toISOString();
            const res = await post(`/deadline-extensions/${item.id}/resolve`, payload);
            success(res?.message || 'Request decided.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message || 'The request could not be decided.');
        }
        setSaving(false);
    };

    return (
        <DecisionSheet icon={CalendarClock} title="Decide deadline extension" subtitle={`${item.proposal?.tracker_number} · ${item.proposal?.title}`} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={saving || !valid}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                    {saving && <Loader2 size={14} className="animate-spin" />} {decision === 'approved' ? 'Grant extension' : 'Deny request'}
                </button>
            </>}>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                <div><p className="text-[11px] text-gray-500">Call closes</p><p className="text-sm font-bold text-gray-900">{callEnd ? formatDate(callEnd) : '—'}</p></div>
                <div><p className="text-[11px] text-gray-500">Asked until</p><p className="text-sm font-bold text-indigo-700">{formatDate(item.requested_until)}</p></div>
            </div>
            <Quote label={`Reason from ${item.requested_by?.name ?? 'the PI'}`}>{item.reason}</Quote>
            <DecisionToggle value={decision} onChange={setDecision} approveLabel="Grant" denyLabel="Deny" />
            {decision === 'approved' && (
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">New deadline</span>
                    <input type="datetime-local" value={grantedUntil} onChange={(e) => setGrantedUntil(e.target.value)} min={toLocalInput(new Date(Date.now() + 3600000).toISOString())}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:text-sm" />
                    <span className="mt-1 block text-xs text-gray-500">
                        Starts as what was asked for{extra !== null && extra > 0 ? ` — ${extra} day${extra === 1 ? '' : 's'} after the call closes` : ''}. Change it to grant a different date.
                    </span>
                </label>
            )}
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Notes to the PI</span>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain the decision…"
                    className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                <span className="mt-1 block text-xs text-gray-400">At least 10 characters.</span>
            </label>
        </DecisionSheet>
    );
}

const config = {
    title: 'Deadline Extensions',
    noun: 'request',
    filename: 'deadline-extensions',
    icon: CalendarClock,
    color: 'sky',
    description: 'Researchers asking for more time to finish and submit a draft after the call closes.',
    endpoint: '/deadline-extensions',
    personLabel: 'Requested by',
    person: (i) => i.requested_by?.name,
    statusLabels: { approved: 'Granted', denied: 'Denied' },
    emptyText: 'Decided requests appear here.',
    exportExtra: [
        { label: 'Call closes', value: (i) => (i.proposal?.proposal_call?.end_date ? formatDate(i.proposal.proposal_call.end_date) : '') },
        { label: 'Asked until', value: (i) => (i.requested_until ? formatDate(i.requested_until) : '') },
        { label: 'Granted until', value: (i) => (i.granted_until ? formatDate(i.granted_until) : '') },
    ],
    highlight: (i) => (
        <div className="text-left sm:text-right">
            <p className="text-[11px] text-gray-500">{i.status === 'approved' ? 'Granted until' : 'Asked until'}</p>
            <p className={`text-sm font-bold ${i.status === 'approved' ? 'text-emerald-700' : 'text-gray-900'}`}>{formatDate(i.granted_until ?? i.requested_until)}</p>
        </div>
    ),
    detail: (i) => (
        <>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
                {i.proposal?.proposal_call?.title && <span>Call: <span className="font-medium text-gray-800">{i.proposal.proposal_call.title}</span></span>}
                {i.proposal?.proposal_call?.end_date && <span>Closes {formatDateTime(i.proposal.proposal_call.end_date)}</span>}
                <span>Asked until {formatDateTime(i.requested_until)}</span>
            </div>
            <Quote label="Reason">{i.reason}</Quote>
            {i.resolution_notes && (
                <Quote label={`Decision${i.resolved_at ? ` · ${formatDate(i.resolved_at)}` : ''}`} tone={i.status === 'approved' ? 'emerald' : 'red'}>
                    {i.resolution_notes}
                    {i.granted_until && <span className="mt-1 flex items-center gap-1 font-semibold"><CalendarCheck size={13} /> Granted until {formatDateTime(i.granted_until)}</span>}
                </Quote>
            )}
        </>
    ),
    Modal: ResolveModal,
};

export default function DeadlineExtensions() {
    return <ReviewQueue config={config} />;
}
