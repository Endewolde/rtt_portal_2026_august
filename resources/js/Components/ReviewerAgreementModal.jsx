import { useEffect, useState } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { get, post } from '../lib/api';
import { useToast } from './Toast';

/**
 * The yearly reviewer confidentiality agreement. Shown before a reviewer can open or score
 * a proposal; `onAccepted` runs once it's recorded.
 */
export default function ReviewerAgreementModal({ onAccepted, onClose }) {
    const { success, error } = useToast();
    const [agreement, setAgreement] = useState(null);
    const [checked, setChecked] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        get('/reviewer-agreement').then((r) => setAgreement(r.data)).catch(() => error('Could not load the agreement.'));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const accept = async () => {
        setSaving(true);
        try {
            const res = await post('/reviewer-agreement', { confirm: true });
            success(res.message);
            onAccepted?.();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not record your acceptance.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="agreement-title" className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
                <div className="h-1.5 shrink-0 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600" />
                <div className="flex shrink-0 items-start gap-3 px-6 pt-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 ring-4 ring-indigo-50"><Lock size={20} /></div>
                    <div>
                        <h2 id="agreement-title" className="text-lg font-bold text-gray-900">Reviewer Confidentiality Agreement</h2>
                        <p className="mt-0.5 text-xs text-gray-500">{agreement ? `${agreement.academic_year} academic year · accepted once a year` : 'Loading…'}</p>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    {agreement ? (
                        <div className="whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">{agreement.text}</div>
                    ) : <div className="h-40 animate-pulse rounded-xl bg-gray-100" />}
                    <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-200 p-3 text-sm text-gray-700 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 rounded accent-indigo-600" />
                        <span>I have read and agree to keep all proposals and reviews confidential as described above.</span>
                    </label>
                </div>
                <div className="flex shrink-0 gap-3 border-t border-gray-100 px-6 py-4">
                    {onClose && <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Not now</button>}
                    <button onClick={accept} disabled={!checked || saving || !agreement}
                        className="flex flex-[1.6] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                        <ShieldCheck size={15} /> {saving ? 'Saving…' : 'I Agree'}
                    </button>
                </div>
            </div>
        </div>
    );
}
