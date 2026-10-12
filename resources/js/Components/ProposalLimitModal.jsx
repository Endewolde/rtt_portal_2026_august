import * as Dialog from '@radix-ui/react-dialog';
import { Link } from '@inertiajs/react';
import { FolderClock, X, ArrowRight } from 'lucide-react';

export default function ProposalLimitModal({ open, onClose, message, title = 'Unable to Continue' }) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl bg-white shadow-2xl focus:outline-none overflow-hidden">
                    <div className="bg-linear-to-r from-amber-500 to-orange-500 px-6 py-5 relative">
                        <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                            <X size={16} className="text-white" />
                        </button>
                        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                            <FolderClock size={22} className="text-white" />
                        </div>
                        <Dialog.Title className="text-base font-bold text-white">{title}</Dialog.Title>
                    </div>

                    <div className="px-6 py-5">
                        <Dialog.Description className="text-sm text-gray-700 leading-relaxed">
                            {message}
                        </Dialog.Description>

                        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                            <Link
                                href="/my-proposals"
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors"
                            >
                                Go to My Proposals <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
