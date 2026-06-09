import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GuestLayout from '../../Layouts/GuestLayout';
import { post } from '../../lib/api';

const schema = z.object({ email: z.string().email('Invalid email address') });

export default function ForgotPassword() {
    const [sent, setSent] = useState(false);
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

    const onSubmit = async (data) => {
        try { await post('/auth/forgot-password', data); } catch {}
        setSent(true);
    };

    if (sent) return (
        <GuestLayout>
            <div className="text-center py-6">
                <div className="text-4xl mb-4">📧</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
                <p className="text-sm text-gray-500 mb-4">If that email exists, we sent a reset link.</p>
                <Link href="/login" className="text-blue-600 font-medium hover:underline text-sm">Back to login</Link>
            </div>
        </GuestLayout>
    );

    return (
        <GuestLayout>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Reset password</h2>
            <p className="text-sm text-gray-500 mb-6">Enter your email to receive a reset link.</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" {...register('email')}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting}
                    className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                    {isSubmitting ? 'Sending…' : 'Send Reset Link'}
                </button>
            </form>
            <p className="mt-4 text-center text-sm">
                <Link href="/login" className="text-blue-600 hover:underline">Back to login</Link>
            </p>
        </GuestLayout>
    );
}
