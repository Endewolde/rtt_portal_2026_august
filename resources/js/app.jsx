import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import ToastProvider from './Components/Toast';
import { watchTerms } from './lib/terms';

createInertiaApp({
    // The browser tab carries the organisation's own system name, not a fixed one.
    // A page without its own title keeps the full one the server sent (also used for link previews).
    title: (title) => title
        ? `${title} · ${document.querySelector('meta[name="app-name"]')?.content || 'RTT Portal'}`
        : (document.querySelector('meta[property="og:title"]')?.content || document.querySelector('meta[name="app-name"]')?.content || 'RTT Portal'),
    // Each page's code is downloaded when it is opened, so a visitor to the home page
    // doesn't download the whole admin system first.
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx');
        return pages[`./Pages/${name}.jsx`]();
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
