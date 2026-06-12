import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ConfirmDialog({
    open,
    onConfirm,
    onCancel,
    title,
    description,
    confirmLabel  = 'Confirm',
    cancelLabel   = 'Cancel',
    confirmVariant = 'default',
}) {
    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel?.()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-white p-6 shadow-xl focus:outline-none">
                    <div className="flex items-start justify-between mb-4">
                        <Dialog.Title className="text-base font-semibold text-gray-900">{title}</Dialog.Title>
                        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                    </div>
                    {description && <Dialog.Description className="text-sm text-gray-600 mb-6">{description}</Dialog.Description>}
                    <div className="flex justify-end gap-3">
                        <button onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                            {cancelLabel}
                        </button>
                        <button onClick={onConfirm}
                            className={cn('px-4 py-2 text-sm font-medium rounded-lg text-white',
                                confirmVariant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')}>
                            {confirmLabel}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
