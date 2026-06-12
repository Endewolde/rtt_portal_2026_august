import { useEffect } from 'react';
import { router } from '@inertiajs/react';

export default function OAuthSuccess({ token, user }) {
    useEffect(() => {
        if (token && user) {
            localStorage.setItem('rtt_token', token);
            localStorage.setItem('rtt_user', JSON.stringify(user));
        }
        router.visit('/dashboard', { replace: true });
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-3 text-gray-500">
                <svg className="h-8 w-8 animate-spin text-teal-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p className="text-sm font-medium">Signing you in…</p>
            </div>
        </div>
    );
}
