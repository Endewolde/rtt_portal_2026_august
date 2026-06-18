import { useState, useEffect, useRef } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import GuestLayout from '../../Layouts/GuestLayout';
import LoginNoticeBanner from '../../Components/LoginNoticeBanner';
import { post, get } from '../../lib/api';

const schema = z.object({
    email:    z.string().email('Enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean().optional(),
});

function InputField({ label, icon: Icon, type = 'text', placeholder, error, rightSlot, id, ...rest }) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <div
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-3 transition-all duration-150 bg-white ${
                    error
                        ? 'ring-2 ring-red-300 border-red-300'
                        : 'border-gray-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-400/20'
                }`}
                style={{ border: error ? undefined : '1px solid #e5e7eb' }}
            >
                {Icon && <Icon size={15} className={`shrink-0 ${error ? 'text-red-400' : 'text-gray-400'}`} />}
                <input
                    id={id}
                    type={type}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none min-w-0"
                    {...rest}
                />
                {rightSlot}
            </div>
            {error && (
                <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                    <AlertCircle size={11} /> {error}
                </p>
            )}
        </div>
    );
}

export default function Login() {
    const { app_settings } = usePage().props;
    const googleSsoEnabled    = app_settings?.google_sso_enabled === 'true';
    const microsoftSsoEnabled = app_settings?.microsoft_sso_enabled === 'true';
    const ssoEnabled          = googleSsoEnabled || microsoftSsoEnabled;
    const selfRegistration    = app_settings?.self_registration !== 'false';
    const passwordLoginEnabled = app_settings?.password_login_enabled !== 'false';
    const ssoError   = new URLSearchParams(window.location.search).get('sso_error');

    const [serverError,     setServerError]     = useState(ssoError || '');
    const [showPassword,    setShowPassword]     = useState(false);
    const [emailUnverified, setEmailUnverified]  = useState(false);
    const [unverifiedEmail, setUnverifiedEmail]  = useState('');
    const [resending,       setResending]        = useState(false);
    const [resent,          setResent]           = useState(false);
    const [notices,         setNotices]          = useState([]);

    const [showPasswordForm, setShowPasswordForm] = useState(false);

    // 2FA state
    const [step,          setStep]          = useState('password'); // 'password' | 'otp'
    const [partialToken,  setPartialToken]  = useState('');
    const [otp,           setOtp]           = useState('');
    const [otpError,      setOtpError]      = useState('');
    const [otpLoading,    setOtpLoading]    = useState(false);
    const [resendCooldown,setResendCooldown]= useState(0);
    const [resendLoading, setResendLoading] = useState(false);
    const otpRef = useRef(null);

    useEffect(() => {
        get('/login-notices/active').then(res => setNotices(res.data ?? [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (step === 'otp') {
            otpRef.current?.focus();
        }
    }, [step]);

    useEffect(() => {
        if (resendCooldown <= 0) { return; }
        const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
        return () => clearInterval(t);
    }, [resendCooldown]);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
    });

    const finalizeLogin = (token, user, evictedSession) => {
        localStorage.setItem('rtt_token', token);
        localStorage.setItem('rtt_user', JSON.stringify(user));
        if (evictedSession) {
            localStorage.setItem('rtt_session_evicted_notice', '1');
        }
        const redirect = localStorage.getItem('redirect_after_login');
        if (redirect) {
            localStorage.removeItem('redirect_after_login');
            window.location.href = redirect;
        } else {
            router.visit('/dashboard');
        }
    };

    const onSubmit = async (data) => {
        setServerError('');
        setEmailUnverified(false);
        setResent(false);
        try {
            const res = await post('/auth/login', data);
            const payload = res.data;

            if (payload.requires_2fa) {
                setPartialToken(payload.partial_token);
                setStep('otp');
                setResendCooldown(60);
                return;
            }

            finalizeLogin(payload.token, payload.user, payload.evicted_session);
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

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        if (otp.length !== 6) { setOtpError('Enter the 6-digit code.'); return; }
        setOtpError('');
        setOtpLoading(true);
        try {
            const res = await post('/auth/2fa/verify', { partial_token: partialToken, code: otp });
            const payload = res.data;
            finalizeLogin(payload.token, payload.user, payload.evicted_session);
        } catch (e) {
            const apiErrors = e.response?.data?.errors ?? {};
            const codeErr = Array.isArray(apiErrors.code) ? apiErrors.code[0] : '';
            const tokenErr = Array.isArray(apiErrors.partial_token) ? apiErrors.partial_token[0] : '';
            if (tokenErr) {
                setOtpError('Session expired. Please sign in again.');
            } else {
                setOtpError(codeErr || e.response?.data?.message || 'Verification failed.');
            }
        } finally {
            setOtpLoading(false);
        }
    };

    const handleResendCode = async () => {
        setResendLoading(true);
        try {
            const res = await post('/auth/2fa/resend', { partial_token: partialToken });
            setPartialToken(res.data.partial_token);
            setResendCooldown(60);
            setOtpError('');
            setOtp('');
        } catch (e) {
            const msg = e.response?.data?.message || '';
            if (msg.toLowerCase().includes('expired')) {
                setOtpError('Session expired. Please sign in again.');
            }
        } finally {
            setResendLoading(false);
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

    if (step === 'otp') {
        return (
            <GuestLayout
                panelHeading="Verification Required"
                panelSubtext="Two-factor authentication is enabled on your account. Check your email for a 6-digit code."
                panelLinkText={null}
                panelLinkHref={null}
            >
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 px-8 py-8">
                    <div className="mb-7">
                        <div className="h-11 w-11 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
                            <ShieldCheck size={22} className="text-teal-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Check your email</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            We sent a 6-digit code to your email. It expires in 5 minutes.
                        </p>
                    </div>

                    <form onSubmit={handleOtpSubmit} className="space-y-5">
                        <div>
                            <input
                                ref={otpRef}
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className={`w-full text-center text-3xl font-bold tracking-[0.5em] rounded-xl px-4 py-4
                                            outline-none transition-all bg-white
                                            ${otpError
                                                ? 'ring-2 ring-red-300'
                                                : 'focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400'
                                            }`}
                                style={{ border: otpError ? '1px solid #fca5a5' : '1px solid #e5e7eb' }}
                            />
                            {otpError && (
                                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                                    <AlertCircle size={11} /> {otpError}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={otpLoading || otp.length !== 6}
                            className="w-full rounded-xl py-3 text-sm font-semibold text-white tracking-wide
                                       active:scale-[0.99] transition-all duration-150
                                       disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                                boxShadow: '0 4px 14px 0 rgba(13,148,136,0.35)',
                            }}
                        >
                            {otpLoading
                                ? <span className="flex items-center justify-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Verifying…
                                  </span>
                                : 'Verify Code'
                            }
                        </button>

                        <div className="flex items-center justify-between pt-1">
                            <button
                                type="button"
                                onClick={() => { setStep('password'); setOtp(''); setOtpError(''); }}
                                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                ← Back to sign in
                            </button>
                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={resendCooldown > 0 || resendLoading}
                                className="text-sm font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-50 transition-colors"
                            >
                                {resendLoading ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                            </button>
                        </div>
                    </form>
                </div>
            </GuestLayout>
        );
    }

    return (
        <GuestLayout
            panelHeading="Welcome Back!"
            panelSubtext="Sign in with your institutional credentials to access research proposals, reviews, and platform tools."
            panelLinkText={selfRegistration ? 'Create Account' : null}
            panelLinkHref={selfRegistration ? '/register' : null}
        >
            <LoginNoticeBanner notices={notices} />

            {/* Card */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 px-8 py-8">

                {/* Heading */}
                <div className="mb-7">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        {showPasswordForm ? 'Sign in with email' : 'Sign in'}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {showPasswordForm ? (
                            <button
                                type="button"
                                onClick={() => { setShowPasswordForm(false); setServerError(''); setEmailUnverified(false); }}
                                className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-semibold transition-colors"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                All sign-in options
                            </button>
                        ) : selfRegistration ? (
                            <>Don't have an account?{' '}
                                <Link href="/register" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                                    Create one
                                </Link>
                            </>
                        ) : 'Choose how you\'d like to sign in.'}
                    </p>
                </div>

                {/* ── Password form (revealed on click) ── */}
                {showPasswordForm && (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                        <InputField
                            id="email"
                            label="Email address"
                            icon={Mail}
                            type="email"
                            placeholder="you@university.edu"
                            autoComplete="email"
                            error={errors.email?.message}
                            {...register('email')}
                        />

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Password
                                </label>
                                <Link href="/forgot-password" className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                            <InputField
                                id="password"
                                icon={Lock}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                error={errors.password?.message}
                                rightSlot={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                }
                                {...register('password')}
                            />
                        </div>

                        <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer select-none w-fit">
                            <input
                                type="checkbox"
                                {...register('remember')}
                                className="h-4 w-4 rounded border-gray-300 accent-teal-600 cursor-pointer"
                            />
                            Remember me
                        </label>

                        {emailUnverified && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-800 font-medium">Please verify your email before signing in.</p>
                                </div>
                                {!resent ? (
                                    <button
                                        type="button"
                                        onClick={handleResendVerification}
                                        disabled={resending}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 underline disabled:opacity-60 transition-colors ml-5"
                                    >
                                        {resending ? <><RefreshCw size={10} className="animate-spin" /> Sending…</> : 'Resend verification email'}
                                    </button>
                                ) : (
                                    <p className="text-xs text-emerald-700 ml-5 font-medium">✓ Check your inbox — email sent.</p>
                                )}
                            </div>
                        )}

                        {serverError && (
                            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{serverError}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-xl py-3 text-sm font-semibold text-white tracking-wide
                                       active:scale-[0.99] transition-all duration-150
                                       disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                                boxShadow: '0 4px 14px 0 rgba(13,148,136,0.35)',
                            }}
                        >
                            {isSubmitting
                                ? <span className="flex items-center justify-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Signing in…
                                  </span>
                                : 'Sign In'
                            }
                        </button>
                    </form>
                )}

                {/* ── Provider buttons (shown when form is hidden) ── */}
                {!showPasswordForm && (
                    <div className="flex flex-col gap-3">
                        {!passwordLoginEnabled && !ssoEnabled && (
                            <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                                <AlertCircle size={14} className="text-gray-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-500">Login is currently unavailable. Please contact your administrator.</p>
                            </div>
                        )}

                        {passwordLoginEnabled && (
                            <button
                                type="button"
                                onClick={() => setShowPasswordForm(true)}
                                className="group relative flex items-center gap-4 w-full rounded-2xl px-5 py-3.5 text-left
                                           border border-gray-200 bg-white
                                           hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5
                                           active:translate-y-0 active:shadow-sm
                                           transition-all duration-200"
                            >
                                <div className="h-9 w-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                    <Mail size={18} className="text-gray-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-800">Sign in with email</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Use your email and password</p>
                                </div>
                                <svg className="h-4 w-4 text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {googleSsoEnabled && (
                            <a
                                href="/auth/oauth/google"
                                className="group relative flex items-center gap-4 w-full rounded-2xl px-5 py-3.5
                                           border border-gray-200 bg-white
                                           hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5
                                           active:translate-y-0 active:shadow-sm
                                           transition-all duration-200"
                            >
                                <div className="h-9 w-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                    <svg viewBox="0 0 24 24" className="h-5 w-5">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold text-gray-800">Sign in with Google</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Use your Google account</p>
                                </div>
                                <svg className="h-4 w-4 text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </a>
                        )}

                        {microsoftSsoEnabled && (
                            <a
                                href="/auth/oauth/microsoft"
                                className="group relative flex items-center gap-4 w-full rounded-2xl px-5 py-3.5
                                           border border-blue-100 overflow-hidden
                                           hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60 hover:-translate-y-0.5
                                           active:translate-y-0 active:shadow-sm
                                           transition-all duration-200"
                                style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 60%, #f8f4ff 100%)' }}
                            >
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                     style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, transparent 60%)' }} />
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-blue-100/60"
                                     style={{ background: 'linear-gradient(135deg, #e8f0fe 0%, #f3e8ff 100%)' }}>
                                    <svg viewBox="0 0 24 24" className="h-5 w-5">
                                        <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
                                        <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
                                        <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
                                        <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold text-gray-800">Sign in with Microsoft</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Work or school account</p>
                                </div>
                                <svg className="h-4 w-4 text-blue-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </a>
                        )}
                    </div>
                )}
            </div>
        </GuestLayout>
    );
}
