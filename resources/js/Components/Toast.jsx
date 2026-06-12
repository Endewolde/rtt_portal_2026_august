import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
    success: <CheckCircle size={18} className="text-green-500 shrink-0" />,
    error:   <XCircle    size={18} className="text-red-500 shrink-0" />,
    warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
    info:    <Info       size={18} className="text-blue-500 shrink-0" />,
};

const STYLES = {
    success: 'border-green-200 bg-green-50',
    error:   'border-red-200 bg-red-50',
    warning: 'border-amber-200 bg-amber-50',
    info:    'border-blue-200 bg-blue-50',
};

const PROGRESS_COLORS = {
    success: 'bg-green-400',
    error:   'bg-red-400',
    warning: 'bg-amber-400',
    info:    'bg-blue-400',
};

function ToastItem({ toast, onRemove }) {
    const [visible, setVisible] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));

        if (!toast.persistent) {
            const duration = toast.duration ?? 5000;
            const interval = 50;
            const step = (interval / duration) * 100;

            const progressTimer = setInterval(() => {
                setProgress((prev) => {
                    if (prev <= 0) { clearInterval(progressTimer); return 0; }
                    return prev - step;
                });
            }, interval);

            const dismissTimer = setTimeout(() => dismiss(), duration);
            return () => { clearInterval(progressTimer); clearTimeout(dismissTimer); };
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const dismiss = () => {
        setLeaving(true);
        setTimeout(() => onRemove(toast.id), 300);
    };

    return (
        <div className={`
            relative w-80 rounded-xl border shadow-lg shadow-slate-200/50
            overflow-hidden transition-all duration-300 ease-out
            ${STYLES[toast.type]}
            ${visible && !leaving ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-8 scale-95'}
        `}>
            <div className="flex items-start gap-3 p-4">
                {ICONS[toast.type]}
                <div className="flex-1 min-w-0">
                    {toast.title && (
                        <p className="text-sm font-semibold text-slate-800 mb-0.5">{toast.title}</p>
                    )}
                    <p className="text-sm text-slate-600 leading-relaxed">{toast.message}</p>
                    {toast.action && (
                        <button
                            onClick={() => { toast.action.onClick(); dismiss(); }}
                            className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>
                <button onClick={dismiss} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 mt-0.5">
                    <X size={15} />
                </button>
            </div>

            {!toast.persistent && (
                <div className="h-0.5 bg-black/5">
                    <div
                        className={`h-full ${PROGRESS_COLORS[toast.type]} transition-all ease-linear`}
                        style={{ width: `${progress}%`, transitionDuration: '50ms' }}
                    />
                </div>
            )}
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const add = useCallback((toast) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { ...toast, id }]);
        return id;
    }, []);

    const remove = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const success = useCallback((message, options = {}) => add({ type: 'success', message, ...options }), [add]);
    const error   = useCallback((message, options = {}) => add({ type: 'error',   message, duration: 7000, ...options }), [add]);
    const warning = useCallback((message, options = {}) => add({ type: 'warning', message, ...options }), [add]);
    const info    = useCallback((message, options = {}) => add({ type: 'info',    message, ...options }), [add]);

    const promise = useCallback(async (promiseFn, messages) => {
        const id = add({ type: 'info', message: messages.loading ?? 'Loading…', persistent: true });
        try {
            const result = await promiseFn();
            remove(id);
            success(messages.success ?? 'Done!');
            return result;
        } catch (err) {
            remove(id);
            const msg = err?.response?.data?.message ?? err?.message ?? messages.error ?? 'Something went wrong.';
            error(msg);
            throw err;
        }
    }, [add, remove, success, error]);

    // Listen for API errors dispatched from the axios interceptor
    useEffect(() => {
        const handler = (e) => {
            const { status, message } = e.detail;
            if (status === 401) return; // already redirects
            if (status === 422) return; // shown per-field in forms
            if (status === 403) {
                error(message ?? 'You do not have permission to do this.', { title: 'Access Denied' });
            } else if (status === 429) {
                warning('Too many requests. Please slow down.', { title: 'Rate Limited' });
            } else if (status >= 500) {
                error('A server error occurred. Please try again.', { title: 'Server Error' });
            } else if (message) {
                error(message);
            }
        };
        window.addEventListener('api-error', handler);
        return () => window.removeEventListener('api-error', handler);
    }, [error, warning]);

    return (
        <ToastContext.Provider value={{ success, error, warning, info, promise, remove }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} onRemove={remove} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}

export default ToastProvider;
