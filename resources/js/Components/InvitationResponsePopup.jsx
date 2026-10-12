import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { router } from '@inertiajs/react';
import { CheckCircle2, XCircle, X, ChevronRight } from 'lucide-react';
import { get, post } from '../lib/api';

const SESSION_KEY = 'rtt_invitation_responses_checked';

export default function InvitationResponsePopup({ userId }) {
    const [open, setOpen]           = useState(false);
    const [responses, setResponses] = useState([]);

    useEffect(() => {
        if (sessionStorage.getItem(SESSION_KEY)) return;

        get('/notifications', { unread: 1, per_page: 50 })
            .then(res => {
                const items = (res.data ?? []).filter(n => n.type === 'co_pi_response');
                if (items.length > 0) {
                    setResponses(items);
                    setOpen(true);
                }
            })
            .catch(() => {})
            .finally(() => sessionStorage.setItem(SESSION_KEY, '1'));
    }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

    const dismiss = () => {
        setOpen(false);
        const ids = responses.map(r => r.id);
        if (ids.length > 0) post('/notifications/read', { ids }).catch(() => {});
    };

    const goToProposal = (r) => {
        dismiss();
        if (r.data?.proposal_id) router.visit(`/proposals/${r.data.proposal_id}`);
    };

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismiss} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-white">Co-Investigator Response</h2>
                            <p className="text-xs text-white/80 mt-0.5">
                                {responses.length === 1 ? '1 update while you were away' : `${responses.length} updates while you were away`}
                            </p>
                        </div>
                        <button
                            onClick={dismiss}
                            className="h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                        >
                            <X size={16} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-2.5 max-h-80 overflow-y-auto">
                    {responses.map(r => {
                        const accepted = r.data?.response === 'accepted';
                        return (
                            <button
                                key={r.id}
                                onClick={() => goToProposal(r)}
                                className={`w-full flex items-start gap-3 text-left rounded-xl p-3.5 border transition-colors ${
                                    accepted ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-red-50 border-red-200 hover:bg-red-100'
                                }`}
                            >
                                {accepted
                                    ? <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0" />
                                    : <XCircle size={18} className="text-red-600 mt-0.5 shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold ${accepted ? 'text-green-800' : 'text-red-800'}`}>
                                        {r.data?.co_pi_name} {accepted ? 'accepted' : 'declined'} your invitation
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{r.data?.tracker_number}</p>
                                </div>
                                <ChevronRight size={14} className="text-gray-400 mt-1 shrink-0" />
                            </button>
                        );
                    })}
                </div>

                <div className="px-6 pb-6">
                    <button
                        onClick={dismiss}
                        className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
