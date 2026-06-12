import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    withCredentials: true,
});

// Attach CSRF token and Bearer token on each request
api.interceptors.request.use((config) => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) config.headers['X-CSRF-TOKEN'] = meta.content;

    const token = localStorage.getItem('rtt_token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

    return config;
});

// Handle auth, format 422 validation errors, and dispatch api-error events
// so the ToastProvider can surface server errors without coupling api.js to React.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status  = error.response?.status;
        const message = error.response?.data?.message;

        if (status === 401) {
            localStorage.removeItem('rtt_token');
            localStorage.removeItem('rtt_user');
            window.location.href = '/login';
        }

        if (status === 422) {
            const errors = error.response.data?.errors ?? {};
            error.validationErrors = errors;
        }

        // Dispatch for the ToastProvider listener; 401 already redirects so skip it.
        if (status !== 401) {
            window.dispatchEvent(new CustomEvent('api-error', { detail: { status, message, error } }));
        }

        return Promise.reject(error);
    }
);

export const get  = (url, params = {}) => api.get(url, { params }).then((r) => r.data);
export const post = (url, data = {})   => api.post(url, data).then((r) => r.data);
export const put  = (url, data = {})   => api.put(url, data).then((r) => r.data);
export const patch = (url, data = {})  => api.patch(url, data).then((r) => r.data);
export const del  = (url)              => api.delete(url).then((r) => r.data);

export default api;
