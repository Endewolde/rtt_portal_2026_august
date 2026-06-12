import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
import GuestLayout from '../../Layouts/GuestLayout';
import { post } from '../../lib/api';

const schema = z.object({
    name: z.string().min(3, 'At least 3 characters'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'At least 8 characters'),
    password_confirmation: z.string(),
    employee_id: z.string().optional(),
    college_id: z.string().optional(),
    department_id: z.string().optional(),
    phone: z.string().optional(),
}).refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match', path: ['password_confirmation'],
});

export default function Register() {
    const [success, setSuccess] = useState(false);
    const [serverError, setServerError] = useState('');

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

    const onSubmit = async (data) => {
        setServerError('');
        try {
            await post('/auth/register', data);
            setSuccess(true);
        } catch (e) {
            const status = e.response?.status;
            if (status === 429) {
                setServerError('Too many attempts. Please wait a while before trying again.');
            } else {
                setServerError(e.response?.data?.message ?? 'Registration failed. Please try again.');
            }
        }
    };

    const layoutProps = {
        panelHeading:  'Join the Platform',
        panelSubtext:  'Create your institutional account to submit research proposals and collaborate with the university community.',
        panelLinkText: 'Sign In',
        panelLinkHref: '/login',
    }

    if (success) return (
        <GuestLayout {...layoutProps}>
            <div className="text-center py-4">
                <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-teal-50 flex items-center justify-center">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.62-.72a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Check your email!</h2>
                <p className="text-sm text-gray-500 mb-1">
                    We sent a verification link to your email address.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                    Click the link in the email to activate your account before signing in.
                </p>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-left">
                    <p className="text-xs text-amber-800 font-medium">
                        📬 Don't see it? Check your spam or junk folder.
                        The link expires in <strong>24 hours</strong>.
                    </p>
                </div>
                <Link href="/login"
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl
                               bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
                    Back to Sign In
                </Link>
            </div>
        </GuestLayout>
    );

    return (
        <GuestLayout {...layoutProps}>
            <div className="mb-7">
                <h1 className="text-2xl font-extrabold text-gray-900">Create account</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700">Sign in</Link>
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
                {[
                    { name: 'name',                  label: 'Full Name',       type: 'text',     required: true  },
                    { name: 'email',                 label: 'Email',           type: 'email',    required: true  },
                    { name: 'password',              label: 'Password',        type: 'password', required: true  },
                    { name: 'password_confirmation', label: 'Confirm Password',type: 'password', required: true  },
                    { name: 'employee_id',           label: 'Employee ID',     type: 'text',     required: false },
                    { name: 'phone',                 label: 'Phone',           type: 'text',     required: false },
                ].map(({ name, label, type, required }) => (
                    <div key={name}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                            {label} {required && <span className="text-red-500 normal-case">*</span>}
                        </label>
                        <input
                            type={type}
                            {...register(name)}
                            className={`w-full rounded-xl border px-4 py-3 text-sm bg-gray-50
                                        outline-none transition-colors
                                        focus:bg-white focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                                        ${errors[name] ? 'border-red-400' : 'border-gray-200'}`}
                        />
                        {errors[name] && (
                            <p className="mt-1 text-xs text-red-600">{errors[name].message}</p>
                        )}
                    </div>
                ))}

                {serverError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{serverError}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white
                               hover:bg-teal-700 transition-colors disabled:opacity-60 mt-1
                               shadow-sm shadow-teal-200"
                >
                    {isSubmitting ? 'Creating account…' : 'Create Account'}
                </button>
            </form>
        </GuestLayout>
    );
}
