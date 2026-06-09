import { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GuestLayout from '../../Layouts/GuestLayout';
import { useAuth } from '../../hooks/useAuth';

const schema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean().optional(),
});

export default function Login() {
    const { login } = useAuth();
    const [serverError, setServerError] = useState('');
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

    const onSubmit = async (data) => {
        setServerError('');
        try {
            await login(data);
            const redirect = localStorage.getItem('redirect_after_login');
            if (redirect) {
                localStorage.removeItem('redirect_after_login');
                window.location.href = redirect;
            } else {
                router.visit('/dashboard');
            }
        } catch (e) {
            setServerError(e.response?.data?.message ?? 'Invalid credentials.');
        }
    };

    return (
        <GuestLayout>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500 mb-6">Sign in to your RTT account</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" {...register('email')} autoComplete="email"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="password" {...register('password')} autoComplete="current-password"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                </div>
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" {...register('remember')} className="rounded border-gray-300" />
                        Remember me
                    </label>
                    <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</Link>
                </div>
                {serverError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>}
                <button type="submit" disabled={isSubmitting}
                    className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                    {isSubmitting ? 'Signing in…' : 'Sign In'}
                </button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
                Don't have an account? <Link href="/register" className="text-blue-600 font-medium hover:underline">Create one</Link>
            </p>
        </GuestLayout>
    );
}
