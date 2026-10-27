import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import ToastProvider from './Components/Toast';
import { watchTerms } from './lib/terms';

createInertiaApp({
    // The browser tab carries the organisation's own system name, not a fixed one.
    title: (title) => `${title ? `${title} · ` : ''}${document.querySelector('meta[name="app-name"]')?.content || 'RTT Portal'}`,
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        return pages[`./Pages/${name}.jsx`];
    },
    setup({ el, App, props }) {
        watchTerms(props.initialPage.props?.app_settings ?? {}, props.initialPage.props?.programmes);
        createRoot(el).render(
            <ToastProvider>
                <App {...props} />
            </ToastProvider>
        );
    },
    progress: { color: '#1a365d' },
});

// Installable as a phone app; the worker only provides an offline page (see public/sw.js).
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
