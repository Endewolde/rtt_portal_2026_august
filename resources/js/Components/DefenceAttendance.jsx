import { useState } from 'react';
import { CheckCircle2, UserX, AlertTriangle, X, ClipboardCheck } from 'lucide-react';
import { post } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useToast } from './Toast';

/**
 * College officer records whether an open defence took place: "held" lets the
 * panel's scores decide the result; "team did not appear" rejects the proposal
 * and voids any scores already submitted. `defence` is the proposal's
 * defence_deadline payload.
 */
export function DefenceAttendanceModal({ proposal, defence, initial = null, onClose, onSaved }) {
    const { success, error } = useToast();
    const [choice, setChoice] = useState(initial);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const absent = choice === 'absent';
    const canSubmit = choice && !saving && (!absent || note.trim().length >= 10);

    const submit = async () => {
        setSaving(true);
        try {
            const res = await post(`/defence-sessions/${defence.session_id}/attendance`, { attendance: choice, note: note.trim() || null });
            absent ? error(res.message) : success(res.message);
            onSaved();
        } catch (e) {
            const errors = e.response?.data?.errors ?? {};
            error(Object.values(errors)[0]?.[0] ?? e.response?.data?.message ?? 'Could not record attendance.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
            <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Record defence attendance</h2>
                        <p className="mt-0.5 font-mono text-xs text-gray-400">{proposal.tracker_number}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="space-y-4 overflow-y-auto p-5">
                    {defence.absence_reported && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
                            <AlertTriangle size={14} className="mt-px shrink-0" />
                            <span>
                                <strong>{defence.absence_reported.by ?? 'A panel member'}</strong> reported that the team did not appear
                                {defence.absence_reported.note ? <> — “{defence.absence_reported.note}”</> : '.'}
                            </span>
                        </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" onClick={() => setChoice('held')}
                            className={`rounded-xl border-2 p-3 text-left transition-all ${choice === 'held' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-gray-200 hover:border-gray-300'}`}>
                            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><CheckCircle2 size={16} className="text-emerald-600" /> Defence was held</span>
                            <span className="mt-1 block text-xs leading-relaxed text-gray-500">The team presented. The panel&apos;s scores decide the result.</span>
                        </button>
                        <button type="button" onClick={() => setChoice('absent')}
                            className={`rounded-xl border-2 p-3 text-left transition-all ${absent ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-200 hover:border-gray-300'}`}>
                            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><UserX size={16} className="text-red-600" /> Team did not appear</span>
                            <span className="mt-1 block text-xs leading-relaxed text-gray-500">The proposal is rejected for failing to defend.</span>
                        </button>
                    </div>

                    {choice && (
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                {absent ? <>What happened? <span className="text-red-500">*</span></> : <>Note <span className="font-normal text-gray-400">(optional)</span></>}
                            </label>
                            <textarea rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)}
                                placeholder={absent ? 'e.g. No team member came by 10:30; the PI did not answer two calls.' : 'e.g. All team members presented.'}
                                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                            {absent && note.trim().length < 10 && <p className="mt-1 text-xs text-gray-400">At least 10 characters — the team sees this as the reason.</p>}
                        </div>
                    )}

                    {absent && (
                        <div className="rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-3 text-xs leading-relaxed text-red-800">
                            This can&apos;t be undone. The proposal is <strong>rejected now</strong>, any scores already submitted are <strong>voided</strong>, the remaining panel members are stood down and the team is notified with your note.
                        </div>
                    )}
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
                    <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={!canSubmit}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${absent ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        {saving ? 'Saving…' : absent ? 'Reject — Team Absent' : 'Confirm — Defence Held'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Attendance state and actions shown on an open defence card. */
export function DefenceAttendanceStrip({ proposal, defence, allSubmitted, onRecord }) {
    if (!defence) return null;

    if (defence.attendance === 'held') {
        return (
            <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2.5 text-xs text-emerald-700">
                <CheckCircle2 size={13} /> Defence held
                <span className="text-gray-400">· recorded by {defence.attendance_marked_by ?? '—'} {defence.attendance_marked_at && `· ${formatDate(defence.attendance_marked_at)}`}</span>
            </div>
        );
    }

    if (defence.phase === 'upcoming') return null;

    const tone = defence.absence_reported ? 'amber' : allSubmitted ? 'purple' : 'gray';
    const toneClasses = {
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        purple: 'border-purple-200 bg-purple-50 text-purple-800',
        gray: 'border-gray-100 bg-gray-50/60 text-gray-600',
    }[tone];

    return (
        <div className={`flex flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-center ${toneClasses}`}>
            <p className="flex flex-1 items-start gap-2 text-xs leading-relaxed">
                {defence.absence_reported ? <AlertTriangle size={14} className="mt-px shrink-0" /> : <ClipboardCheck size={14} className="mt-px shrink-0" />}
                <span>
                    {defence.absence_reported
                        ? <><strong>{defence.absence_reported.by ?? 'A panel member'}</strong> reported that the team did not appear. Confirm what happened.</>
                        : allSubmitted
                            ? <><strong>Every score is in.</strong> Confirm the defence was held so the result can be decided.</>
                            : 'Record whether the defence took place. The result is decided only after it is recorded as held.'}
                </span>
            </p>
            {defence.can_mark_attendance && (
                <button onClick={() => onRecord(proposal)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">
                    <ClipboardCheck size={13} /> Record attendance
                </button>
            )}
        </div>
    );
}
