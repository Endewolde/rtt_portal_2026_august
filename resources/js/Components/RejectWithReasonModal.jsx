import { useState } from 'react';
import { XCircle, X, Info } from 'lucide-react';
import { useToast } from './Toast';
import ReasonSelect from './ReasonSelect';
import { REJECTION_REASONS } from '../lib/rejectionReasons';

const MAX_DETAILS = 900;

/**
 * Reject dialog used by every reject action: choose a reason from the context's list
 * (App\Support\RejectionReasons) and add details — required for "Other".
 *
 * `onSubmit({ reason_code, reason })` performs the request; throw to keep the modal
 * open (the server's message is shown). `detailsField` renames `reason` for endpoints
 * that expect another field name (e.g. `notes`).
 */
export default function RejectWithReasonModal({
    context,
    title,
    subtitle,
    note,
    confirmLabel = 'Reject',
    detailsField = 'reason',
    initialCode = '',
    initialDetails = '',
    onSubmit,
    onClose,
}) {
    const { error } = useToast();
    const [code, setCode] = useState(initialCode);
    const [details, setDetails] = useState(initialDetails.slice(0, MAX_DETAILS));
    const [saving, setSaving] = useState(false);

    const isOther = code === 'other';
    const trimmed = details.trim();
    const detailsInvalid = (isOther && trimmed.length < 10) || (trimmed.length > 0 && trimmed.length < 10);
    const canSubmit = code && !detailsInvalid && !saving;

    const submit = async () => {
        if (!canSubmit) return;
        setSaving(true);
        try {
            await onSubmit({ reason_code: code, [detailsField]: trimmed || null });
        } catch (e) {
            const errors = e?.response?.data?.errors;
            error(errors ? Object.values(errors).flat()[0] : (e?.response?.data?.message ?? 'The rejection could not be saved.'));
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-red-500 via-rose-500 to-red-600" />

                <div className="flex items-start justify-between gap-3 px-6 pt-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 ring-4 ring-red-50">
                            <XCircle size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-5 px-6 py-5">
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                            Reason for rejection <span className="text-red-500">*</span>
                        </label>
                        <ReasonSelect options={REJECTION_REASONS[context] ?? []} value={code} onChange={setCode} accent="red" />
                    </div>

                    {code && (
                        <div>
                            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-700">
                                <span>
                                    {isOther
                                        ? <>Describe the reason <span className="text-red-500">*</span></>
                                        : <>Additional details <span className="font-normal text-gray-400">(optional)</span></>}
                                </span>
                                <span className="font-normal tabular-nums text-gray-400">{details.length}/{MAX_DETAILS}</span>
                            </label>
                            <textarea
                                rows={4}
                                value={details}
                                maxLength={MAX_DETAILS}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder={isOther ? 'Explain clearly why this is being rejected…' : 'Add specifics that will help the recipient understand or fix the issue…'}
                                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                            {detailsInvalid && <p className="mt-1 text-xs text-gray-400">Please write at least 10 characters.</p>}
                        </div>
                    )}

                    {note && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                            <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                            <span>{note}</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!canSubmit}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
