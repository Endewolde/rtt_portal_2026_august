import { useState, useEffect } from 'react';
import { Clock, CalendarPlus, AlertTriangle, CheckCircle2, X, Hourglass, UserX } from 'lucide-react';
import { post } from '../lib/api';
import { useToast } from './Toast';

export function formatDeadline(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function formatRemaining(ms) {
    if (ms <= 0) return null;
    const minutes = Math.floor(ms / 60000);
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

const toLocalInput = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * College officer's request for a later open defence score deadline for one proposal.
 * Goes to that proposal's category director or the central office for approval.
 */
export function RequestDeadlineExtensionModal({ proposal, onClose, onSaved }) {
    const { success, error } = useToast();
    const deadline = proposal.defence_deadline;
    const base = new Date(Math.max(Date.now(), new Date(deadline.deadline).getTime()));
    base.setDate(base.getDate() + 1);
    base.setHours(23, 59, 0, 0);
    const [until, setUntil] = useState(toLocalInput(base));
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (reason.trim().length < 10) { error('Please give a reason of at least 10 characters.'); return; }
        setSaving(true);
        try {
            const res = await post(`/defence-sessions/${deadline.session_id}/deadline-extensions`, { requested_until: until, reason });
            success(res.message ?? 'Extension request sent for approval.');
            onSaved();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not send the extension request.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                            <CalendarPlus size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Extend Score Deadline</h2>
                            <p className="mt-0.5 text-xs text-gray-500">{proposal.tracker_number} · {deadline.outstanding_scores} score{deadline.outstanding_scores === 1 ? '' : 's'} outstanding</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4 p-6">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        Current deadline: <strong>{formatDeadline(deadline.deadline)}</strong>
                    </div>

                    {(deadline.extensions?.length ?? 0) > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
                            <strong>This will be request number {deadline.extensions.length + 1} for this defence.</strong>{' '}
                            {deadline.is_extended ? 'The deadline has already been extended once. ' : ''}
                            Approvers see every earlier request — explain what has changed, or consider replacing a reviewer who can't score.
                        </div>
                    )}

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">New deadline <span className="text-red-500">*</span></label>
                        <input
                            type="datetime-local"
                            value={until}
                            min={toLocalInput(new Date())}
                            onChange={(e) => setUntil(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Reason <span className="text-red-500">*</span></label>
                        <textarea
                            rows={4}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain why the reviewers need more time…"
                            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                            Sent for approval to the director for this proposal's category or the central office. Reviewers can submit again once it is approved.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={saving || !until}
                            className="flex-1 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
                        >
                            {saving ? 'Sending…' : 'Send for Approval'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Score deadline row on an Open Defence card. */
export default function DefenceDeadlineStrip({ deadline, onRequestExtension }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(t);
    }, []);

    if (!deadline) return null;

    const remaining = formatRemaining(new Date(deadline.deadline).getTime() - now);
    const passed = deadline.phase === 'passed' || !remaining;
    // Nothing outstanding only means "done" when someone is actually on the panel.
    const noPanel = (deadline.panel_size ?? 1) === 0;
    const done = !noPanel && deadline.outstanding_scores === 0;

    const tone = noPanel
        ? 'border-amber-100 bg-amber-50/70 text-amber-800'
        : done
        ? 'border-green-100 bg-green-50/60 text-green-800'
        : passed
            ? 'border-red-100 bg-red-50/70 text-red-800'
            : 'border-purple-100 bg-purple-50/50 text-purple-900';

    const Icon = noPanel ? UserX : done ? CheckCircle2 : passed ? AlertTriangle : deadline.phase === 'upcoming' ? Clock : Hourglass;

    return (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-5 py-2.5 text-xs ${tone}`}>
            <Icon size={14} className="shrink-0" />
            <span>
                Score deadline: <strong>{formatDeadline(deadline.deadline)}</strong>
                {deadline.is_extended && <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Extended</span>}
            </span>
            <span className="font-semibold">
                {noPanel
                    ? 'No panel members — add reviewers before scores can be collected'
                    : done
                    ? 'All scores submitted'
                    : passed
                        ? `Deadline passed · ${deadline.outstanding_scores} score${deadline.outstanding_scores === 1 ? '' : 's'} missing`
                        : deadline.phase === 'upcoming'
                            ? 'Scoring opens on the defence day'
                            : `${remaining} left`}
            </span>

            <span className="ml-auto flex items-center gap-2">
                {deadline.pending_extension && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                        <Clock size={11} /> Extension to {formatDeadline(deadline.pending_extension.requested_until)} awaiting approval
                    </span>
                )}
                {!done && !noPanel && deadline.can_request_extension && onRequestExtension && (
                    <button
                        onClick={onRequestExtension}
                        className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-2.5 py-1 font-semibold text-purple-700 hover:bg-purple-50"
                    >
                        <CalendarPlus size={12} /> Request Extension
                    </button>
                )}
            </span>
        </div>
    );
}
