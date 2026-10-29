import { useState, useEffect, useRef } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, AlertCircle, RefreshCw, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import GuestLayout from '../../Layouts/GuestLayout';
import LoginNoticeBanner from '../../Components/LoginNoticeBanner';
import { post, get } from '../../lib/api';

const schema = z.object({
    email:    z.string().email('Enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean().optional(),
});

const CARD = 'bg-white rounded-3xl border border-gray-100 shadow-xl shadow-slate-900/5 px-5 py-7 sm:px-8 sm:py-9';
const PRIMARY = `w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white
    bg-linear-to-br from-teal-600 to-teal-700 shadow-lg shadow-teal-700/25 hover:from-teal-500 hover:to-teal-700
    active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100`;
const SSO_MAIN = `flex items-center justify-center gap-3 h-14 w-full rounded-2xl border border-gray-200 bg-white px-4
    text-[15px] font-semibold text-gray-900 shadow-md shadow-slate-900/5 ring-1 ring-black/[0.02]
    hover:border-gray-300 hover:shadow-lg active:scale-[0.99] transition`;
const SSO = `flex items-center justify-center gap-2.5 h-12 w-full rounded-xl border border-gray-200 bg-white px-4
    text-sm font-semibold text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition`;

function InputField({ label, labelAside, icon: Icon, error, rightSlot, id, ...rest }) {
    return (
        <div className="space-y-1.5">
            {(label || labelAside) && (
                <div className="flex items-center justify-between gap-2">
                    {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
                    {labelAside}
                </div>
            )}
            <div className={`flex items-center gap-2.5 h-12 rounded-xl border bg-white px-3.5 transition
                ${error ? 'border-red-300 ring-4 ring-red-100' : 'border-gray-200 hover:border-gray-300 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/15'}`}>
                {Icon && <Icon size={17} className={`shrink-0 ${error ? 'text-red-400' : 'text-gray-400'}`} />}
                {/* 16px on phones so iOS does not zoom into the field. */}
                <input id={id} aria-invalid={!!error}
                    className="flex-1 min-w-0 bg-transparent text-base sm:text-sm text-gray-900 placeholder-gray-400 outline-none"
                    {...rest} />
                {rightSlot}
            </div>
            {error && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                    <AlertCircle size={12} /> {error}
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
    const ssoOnly             = ssoEnabled && !passwordLoginEnabled;
    const emailDomain         = (app_settings?.registration_email_domain ?? '').replace(/^@/, '');
    const ssoAccountName      = googleSsoEnabled && microsoftSsoEnabled
        ? 'institutional Google or Microsoft account'
        : microsoftSsoEnabled ? 'Microsoft work or school account' : 'Google account';
    const ssoError   = new URLSearchParams(window.location.search).get('sso_error');

    const [serverError,     setServerError]     = useState(ssoError || '');
    const [showPassword,    setShowPassword]     = useState(false);
    const [emailUnverified, setEmailUnverified]  = useState(false);
    const [unverifiedEmail, setUnverifiedEmail]  = useState('');
    const [resending,       setResending]        = useState(false);
    const [resent,          setResent]           = useState(false);
    const [notices,         setNotices]          = useState([]);
    // One tap only: a second tap would start a second sign-in and make the first one fail.
    const [redirecting,     setRedirecting]      = useState('');

    // 2FA state
    const [step,          setStep]          = useState('password'); // 'password' | 'otp'
    const [partialToken,  setPartialToken]  = useState('');
    const [otp,           setOtp]           = useState('');
    const [otpError,      setOtpError]      = useState('');
    const [otpLoading,    setOtpLoading]    = useState(false);
    const [resendCooldown,setResendCooldown]= useState(0);
    const [resendLoading, setResendLoading] = useState(false);
    const otpRef = useRef(null);

    // Coming back with the browser's Back button must re-enable the buttons.
    useEffect(() => {
        const reset = () => setRedirecting('');
        window.addEventListener('pageshow', reset);
        return () => window.removeEventListener('pageshow', reset);
    }, []);

    const startSso = (provider) => (e) => {
        if (redirecting) { e.preventDefault(); return; }
        setServerError('');
        setRedirecting(provider);
    };

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

    const spinner = (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
    );

    if (step === 'otp') {
        return (
            <GuestLayout
                panelHeading="Verification required"
                panelSubtext="Two-factor authentication is on for your account. Enter the code we just emailed you."
            >
                <div className={CARD}>
                    <div className="mb-6">
                        <span className="h-12 w-12 rounded-2xl bg-teal-50 ring-1 ring-teal-100 flex items-center justify-center mb-4">
                            <ShieldCheck size={22} className="text-teal-600" />
                        </span>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Check your email</h1>
                        <p className="mt-1 text-sm text-gray-500">We sent a 6-digit code. It expires in 5 minutes.</p>
                    </div>

                    <form onSubmit={handleOtpSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="otp" className="sr-only">Verification code</label>
                            <input
                                id="otp"
                                ref={otpRef}
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="••••••"
                                className={`w-full h-16 text-center text-3xl font-bold tracking-[0.5em] tabular-nums rounded-2xl border bg-white outline-none transition
                                    ${otpError ? 'border-red-300 ring-4 ring-red-100' : 'border-gray-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15'}`}
                            />
                            {otpError && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                                    <AlertCircle size={12} /> {otpError}
                                </p>
                            )}
                        </div>

                        <button type="submit" disabled={otpLoading || otp.length !== 6} className={PRIMARY}>
                            {otpLoading ? <>{spinner} Verifying…</> : <>Verify and continue <ArrowRight size={16} /></>}
                        </button>

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <button type="button" onClick={() => { setStep('password'); setOtp(''); setOtpError(''); }}
                                className="inline-flex items-center gap-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
                                <ArrowLeft size={14} /> Back
                            </button>
                            <button type="button" onClick={handleResendCode} disabled={resendCooldown > 0 || resendLoading}
                                className="py-2 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:text-gray-400 transition-colors tabular-nums">
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
            panelHeading="Welcome back"
            panelSubtext="Sign in with your institutional account to reach your proposals, reviews and research tools."
            panelLinkText={selfRegistration ? 'Create account' : null}
            panelLinkHref={selfRegistration ? '/register' : null}
        >
            {notices.length > 0 && <div className="mb-3"><LoginNoticeBanner notices={notices} /></div>}

            <div className={CARD}>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sign in</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {ssoOnly
                            ? `Use your ${ssoAccountName} — no separate password needed.`
                            : ssoEnabled ? 'Use your institution account or your email.' : 'Good to see you again.'}
                    </p>
                </div>

                {!passwordLoginEnabled && !ssoEnabled && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <AlertCircle size={15} className="text-gray-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-600">Sign-in is currently unavailable. Please contact your administrator.</p>
                    </div>
                )}

                {/* Single sign-on */}
                {ssoEnabled && (
                    <div className="grid gap-2.5">
                        {/* With one way in, the button is the whole page — make it the obvious action. */}
                        {googleSsoEnabled && (
                            <a href="/auth/oauth/google" onClick={startSso('google')} aria-disabled={!!redirecting}
                                className={`${ssoOnly ? SSO_MAIN : SSO} ${redirecting && redirecting !== 'google' ? 'opacity-50 pointer-events-none' : ''}`}>
                                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                {redirecting === 'google' ? <>{spinner} Opening Google…</> : 'Continue with Google'}
                            </a>
                        )}
                        {microsoftSsoEnabled && (
                            <a href="/auth/oauth/microsoft" onClick={startSso('microsoft')} aria-disabled={!!redirecting}
                                className={`${ssoOnly ? SSO_MAIN : SSO} ${redirecting && redirecting !== 'microsoft' ? 'opacity-50 pointer-events-none' : ''}`}>
                                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                                    <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
                                    <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
                                    <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
                                    <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
                                </svg>
                                {redirecting === 'microsoft' ? <>{spinner} Opening Microsoft…</> : 'Continue with Microsoft'}
                            </a>
                        )}
                    </div>
                )}

                {ssoOnly && (
                    <ul className="mt-5 space-y-2.5 rounded-2xl bg-slate-50 px-4 py-3.5 text-[13px] text-gray-600">
                        <li className="flex items-start gap-2.5">
                            <Mail size={15} className="mt-0.5 shrink-0 text-teal-600" />
                            <span>Sign in with your university email{emailDomain ? <> (<span className="font-medium text-gray-800">…@{emailDomain}</span>)</> : ''}.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-teal-600" />
                            <span>Your password is checked by your institution, never stored here.</span>
                        </li>
                    </ul>
                )}

                {ssoEnabled && passwordLoginEnabled && (
                    <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        <span className="h-px flex-1 bg-gray-200" /> or with email <span className="h-px flex-1 bg-gray-200" />
                    </div>
                )}

                {/* Email & password */}
                {passwordLoginEnabled && (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                        <InputField
                            id="email"
                            label="Email address"
                            icon={Mail}
                            type="email"
                            inputMode="email"
                            placeholder="you@university.edu"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            error={errors.email?.message}
                            {...register('email')}
                        />

                        <InputField
                            id="password"
                            label="Password"
                            labelAside={
                                <Link href="/forgot-password" className="text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors">
                                    Forgot password?
                                </Link>
                            }
                            icon={Lock}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Your password"
                            autoComplete="current-password"
                            error={errors.password?.message}
                            rightSlot={
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    className="-mr-1.5 h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            }
                            {...register('password')}
                        />

                        <label className="flex items-center gap-2.5 py-1 text-sm text-gray-600 cursor-pointer select-none w-fit">
                            <input type="checkbox" {...register('remember')}
                                className="h-[18px] w-[18px] rounded border-gray-300 accent-teal-600 cursor-pointer" />
                            Keep me signed in
                        </label>

                        {emailUnverified && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-800 font-medium">Please verify your email before signing in.</p>
                                </div>
                                {!resent ? (
                                    <button type="button" onClick={handleResendVerification} disabled={resending}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 underline disabled:opacity-60 transition-colors ml-6">
                                        {resending ? <><RefreshCw size={11} className="animate-spin" /> Sending…</> : 'Resend verification email'}
                                    </button>
                                ) : (
                                    <p className="text-xs text-emerald-700 ml-6 font-medium">✓ Check your inbox — email sent.</p>
                                )}
                            </div>
                        )}

                        {serverError && (
                            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{serverError}</p>
                            </div>
                        )}

                        <button type="submit" disabled={isSubmitting} className={`${PRIMARY} mt-2`}>
                            {isSubmitting ? <>{spinner} Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
                        </button>
                    </form>
                )}

                {/* An SSO error with no password form still needs to be seen. */}
                {!passwordLoginEnabled && serverError && (
                    <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{serverError}</p>
                    </div>
                )}

                {selfRegistration && (
                    <p className="mt-6 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
                        New to the platform?{' '}
                        <Link href="/register" className="font-semibold text-teal-700 hover:text-teal-800 transition-colors">Create an account</Link>
                    </p>
                )}
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <Lock size={12} /> Secure, encrypted sign-in
            </p>
        </GuestLayout>
    );
}
