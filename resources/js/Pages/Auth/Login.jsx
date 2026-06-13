import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, AlertCircle, RefreshCw } from 'lucide-react';
import GuestLayout from '../../Layouts/GuestLayout';
import { useAuth } from '../../hooks/useAuth';
import { post } from '../../lib/api';

const schema = z.object({
    email:    z.string().email('Enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean().optional(),
});

function InputField({ icon: Icon, type = 'text', placeholder, error, rightSlot, ...rest }) {
    return (
        <div>
            <div className={`flex items-center gap-3 border rounded-xl px-4 py-3
                             bg-gray-50 transition-colors
                             ${error
                                 ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-200'
                                 : 'border-gray-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 focus-within:bg-white'
                             }`}>
                {Icon && <Icon size={16} className={error ? 'text-red-400 shrink-0' : 'text-gray-400 shrink-0'} />}
                <input
                    type={type}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400
                               outline-none min-w-0"
                    {...rest}
                />
                {rightSlot}
            </div>
            {error && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle size={11} /> {error}
                </p>
            )}
        </div>
    )
}

export default function Login() {
    const { login } = useAuth();
    const { app_settings } = usePage().props;
    const googleSsoEnabled    = app_settings?.google_sso_enabled === 'true';
    const microsoftSsoEnabled = app_settings?.microsoft_sso_enabled === 'true';
    const ssoEnabled          = googleSsoEnabled || microsoftSsoEnabled;
    const selfRegistration    = app_settings?.self_registration !== 'false';
    const ssoError   = new URLSearchParams(window.location.search).get('sso_error');

    const [serverError,       setServerError]       = useState(ssoError || '');
    const [showPassword,      setShowPassword]       = useState(false);
    const [emailUnverified,   setEmailUnverified]    = useState(false);
    const [unverifiedEmail,   setUnverifiedEmail]    = useState('');
    const [resending,         setResending]          = useState(false);
    const [resent,            setResent]             = useState(false);

    const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data) => {
        setServerError('');
        setEmailUnverified(false);
        setResent(false);
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
            const status = e.response?.status;
            const apiErrors = e.response?.data?.errors ?? {};
            const emailErr = Array.isArray(apiErrors.email) ? apiErrors.email[0] : '';

            if (status === 429) {
                setServerError('Too many login attempts. Please wait a moment and try again.');
            } else if (emailErr === 'email_not_verified') {
                setEmailUnverified(true);
                setUnverifiedEmail(data.email);
            } else {
                setServerError(e.response?.data?.message ?? 'Invalid email or password.');
            }
        }
    };

    const handleResendVerification = async () => {
        setResending(true);
        try {
            await post('/auth/resend-verification', { email: unverifiedEmail });
        } catch { /* server never reveals internals */ }
        setResending(false);
        setResent(true);
    };

    return (
        <GuestLayout
            panelHeading="Welcome Back!"
            panelSubtext="Sign in with your institutional credentials to access research proposals, reviews, and platform tools."
            panelLinkText={selfRegistration ? 'Create Account' : null}
            panelLinkHref={selfRegistration ? '/register' : null}
        >
            {/* Heading */}
            <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-gray-900">Sign in</h1>
                {selfRegistration && (
                    <p className="mt-1 text-sm text-gray-500">
                        Don't have an account?{' '}
                        <Link href="/register" className="font-semibold text-teal-600 hover:text-teal-700">
                            Create one
                        </Link>
                    </p>
                )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                {/* Email */}
                <InputField
                    icon={Mail}
                    type="email"
                    placeholder="you@university.edu"
                    autoComplete="email"
                    error={errors.email?.message}
                    {...register('email')}
                />

                {/* Password */}
                <InputField
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    autoComplete="current-password"
                    error={errors.password?.message}
                    rightSlot={
                        <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    }
                    {...register('password')}
                />

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            {...register('remember')}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600
                                       accent-teal-600 cursor-pointer"
                        />
                        Remember me
                    </label>
                    <Link
                        href="/forgot-password"
                        className="text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                        Forgot password?
                    </Link>
                </div>

                {/* Email not verified */}
                {emailUnverified && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                        <div className="flex items-start gap-2.5">
                            <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800 font-medium">
                                Please verify your email before signing in.
                            </p>
                        </div>
                        {!resent ? (
                            <button
                                type="button"
                                onClick={handleResendVerification}
                                disabled={resending}
                                className="flex items-center gap-1.5 text-xs font-semibold text-amber-700
                                           hover:text-amber-900 underline disabled:opacity-60 transition-colors ml-6"
                            >
                                {resending
                                    ? <><RefreshCw size={11} className="animate-spin" /> Sending…</>
                                    : 'Resend verification email'
                                }
                            </button>
                        ) : (
                            <p className="text-xs text-emerald-700 ml-6 font-medium">
                                ✓ Verification email sent — check your inbox.
                            </p>
                        )}
                    </div>
                )}

                {/* Server error */}
                {serverError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200
                                    bg-red-50 px-4 py-3">
                        <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{serverError}</p>
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white
                               hover:bg-teal-700 active:scale-[0.98] transition-all duration-150
                               disabled:opacity-60 disabled:cursor-not-allowed
                               shadow-sm shadow-teal-200 mt-2"
                >
                    {isSubmitting
                        ? <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                    stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Signing in…
                          </span>
                        : 'Sign In'
                    }
                </button>
            </form>

            {ssoEnabled && (
                <>
                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">or continue with</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <div className="flex flex-col gap-3">
                        {googleSsoEnabled && (
                            <a
                                href="/auth/oauth/google"
                                className="flex items-center justify-center gap-3 w-full rounded-xl border border-gray-200
                                           bg-white py-2.5 text-sm font-semibold text-gray-700
                                           hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                Sign in with Google
                            </a>
                        )}

                        {microsoftSsoEnabled && (
                            <a
                                href="/auth/oauth/microsoft"
                                className="flex items-center justify-center gap-3 w-full rounded-xl border border-gray-200
                                           bg-white py-2.5 text-sm font-semibold text-gray-700
                                           hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
                                    <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
                                    <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
                                    <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
                                    <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
                                </svg>
                                Sign in with Microsoft
                            </a>
                        )}
                    </div>
                </>
            )}
        </GuestLayout>
    );
}
