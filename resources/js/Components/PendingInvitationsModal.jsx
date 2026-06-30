import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { router } from '@inertiajs/react';
import { Users, X, Bell, ChevronRight } from 'lucide-react';
import { get } from '../lib/api';

const SESSION_KEY = 'rtt_invitations_checked';

export default function PendingInvitationsModal({ userId }) {
    const [open, setOpen]         = useState(false);
    const [count, setCount]       = useState(0);

    useEffect(() => {
        if (sessionStorage.getItem(SESSION_KEY)) return;

        get('/proposals/involved')
            .then(res => {
                const coPIs   = res.data?.as_co_pi ?? [];
                const pending = coPIs.filter(p => p.my_invitation_status === 'pending');
                if (pending.length > 0) {
                    setCount(pending.length);
                    setOpen(true);
                }
            })
            .catch(() => {})
            .finally(() => sessionStorage.setItem(SESSION_KEY, '1'));
    }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

    const goToMyProposals = () => {
        setOpen(false);
        router.visit('/my-proposals');
    };

    const dismiss = () => setOpen(false);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismiss} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="bg-linear-to-r from-amber-500 to-orange-500 px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Bell size={20} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Invitation Pending</h2>
                                <p className="text-xs text-white/80 mt-0.5">Action required</p>
                            </div>
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
                <div className="px-6 py-5 space-y-4">
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <Users size={18} className="text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800 leading-relaxed">
                            You have{' '}
                            <span className="font-bold">
                                {count === 1 ? '1 pending co-investigator invitation' : `${count} pending co-investigator invitations`}
                            </span>
                            . Please review and respond before the PI can submit the proposal.
                        </p>
                    </div>

                    <button
                        onClick={goToMyProposals}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-amber-200"
                    >
                        Go to My Proposals
                        <ChevronRight size={15} />
                    </button>

                    <button
                        onClick={dismiss}
                        className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Remind me later
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
