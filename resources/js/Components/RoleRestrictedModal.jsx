import * as Dialog from '@radix-ui/react-dialog';
import { ShieldAlert, X, Mail } from 'lucide-react';

export default function RoleRestrictedModal({ open, onClose, currentRole, requiredRole = 'Staff', contactEmail }) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl focus:outline-none">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>

                    <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                        <ShieldAlert size={26} className="text-red-500" />
                    </div>

                    <Dialog.Title className="text-base font-bold text-gray-900">
                        Submission Not Allowed for Your Role
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-600 mt-2 leading-relaxed">
                        With your current role{currentRole ? <> (<span className="font-semibold text-gray-800">{currentRole}</span>)</> : ''},
                        you are not permitted to submit proposals.
                        Only users with the <span className="font-semibold text-gray-800">{requiredRole}</span> role can submit.
                    </Dialog.Description>

                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                        If you believe you should have access to submit proposals, please contact your administrator
                        to request the {requiredRole} role.
                    </div>

                    {contactEmail && (
                        <a href={`mailto:${contactEmail}`}
                            className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                            <Mail size={14} /> {contactEmail}
                        </a>
                    )}

                    <div className="mt-6 flex justify-end">
                        <button onClick={onClose}
                            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                            Got it
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
