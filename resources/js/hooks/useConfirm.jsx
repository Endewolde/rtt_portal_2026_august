import { useState, useCallback } from 'react';
import ConfirmDialog from '../Components/ConfirmDialog';

export function useConfirm() {
    const [state, setState] = useState({ open: false });

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            setState({
                open:         true,
                title:        options.title        ?? 'Are you sure?',
                description:  options.description  ?? 'This action cannot be undone.',
                confirmLabel: options.confirmLabel  ?? 'Confirm',
                cancelLabel:  options.cancelLabel   ?? 'Cancel',
                variant:      options.variant       ?? 'default',
                onConfirm: () => { setState({ open: false }); resolve(true); },
                onCancel:  () => { setState({ open: false }); resolve(false); },
            });
        });
    }, []);

    // Rendered in the component's JSX: <Dialog />
    const Dialog = useCallback(() => state.open ? (
        <ConfirmDialog
            open={state.open}
            title={state.title}
            description={state.description}
            confirmLabel={state.confirmLabel}
            cancelLabel={state.cancelLabel}
            confirmVariant={state.variant}
            onConfirm={state.onConfirm ?? (() => {})}
            onCancel={state.onCancel   ?? (() => {})}
        />
    ) : null, [state]);

    return { confirm, Dialog };
}
