import { useEffect, useState } from 'react'
import { Link, router } from '@inertiajs/react'
import { CheckCircle, AlertCircle, Mail, RefreshCw } from 'lucide-react'
import GuestLayout from '../../Layouts/GuestLayout'
import { get, post } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

export default function VerifyEmail() {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token') ?? ''
    const email  = params.get('email') ?? ''

    const { setUser } = useAuth()

    const [state,     setState]     = useState('verifying') // verifying | success | error
    const [message,   setMessage]   = useState('')
    const [resending, setResending] = useState(false)
    const [resent,    setResent]    = useState(false)

    useEffect(() => {
        if (!token || !email) {
            setState('error')
            setMessage('This verification link is missing required information.')
            return
        }

        get('/auth/verify-email', { token, email })
            .then(r => {
                // Save token + user so they're logged in right away
                if (r.data?.token) {
                    localStorage.setItem('rtt_token', r.data.token)
                    if (r.data?.user) {
                        localStorage.setItem('rtt_user', JSON.stringify(r.data.user))
                        setUser?.(r.data.user)
                    }
                }
                setState('success')
                setMessage(r.message ?? 'Email verified successfully!')
            })
            .catch(e => {
                setState('error')
                setMessage(e.response?.data?.message ?? 'Verification failed. The link may be invalid or expired.')
            })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleResend = async () => {
        if (!email) return
        setResending(true)
        try {
            await post('/auth/resend-verification', { email })
            setResent(true)
        } catch {
            // Silent — server always responds the same way
            setResent(true)
        }
        setResending(false)
    }

    return (
        <GuestLayout
            panelHeading={state === 'success' ? 'All Set!' : state === 'error' ? 'Verification Failed' : 'Verifying…'}
            panelSubtext={
                state === 'success'
                    ? 'Your email has been confirmed and your account is now active.'
                    : state === 'error'
                    ? 'Something went wrong with the verification link.'
                    : 'Please wait while we confirm your email address.'
            }
        >
            {/* ── Verifying spinner ── */}
            {state === 'verifying' && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-teal-50 flex items-center justify-center">
                        <svg className="h-7 w-7 animate-spin text-teal-600" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-gray-800">Verifying your email…</p>
                        <p className="text-xs text-gray-400 mt-1">This will only take a moment.</p>
                    </div>
                </div>
            )}

            {/* ── Success ── */}
            {state === 'success' && (
                <div className="text-center py-4">
                    <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <CheckCircle size={30} className="text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Email verified!</h1>
                    <p className="text-sm text-gray-500 mb-6">{message}</p>
                    <button
                        onClick={() => router.visit('/dashboard')}
                        className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white
                                   hover:bg-teal-700 active:scale-[0.98] transition-all
                                   shadow-sm shadow-teal-200"
                    >
                        Go to Dashboard
                    </button>
                    <p className="mt-3 text-xs text-gray-400">
                        Or <Link href="/login" className="text-teal-600 hover:underline">sign in manually</Link>
                    </p>
                </div>
            )}

            {/* ── Error ── */}
            {state === 'error' && (
                <div className="py-4">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                            <AlertCircle size={26} className="text-red-500" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Verification failed</h1>
                        <p className="text-sm text-gray-500">{message}</p>
                    </div>

                    {email && !resent && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
                            <p className="text-sm text-amber-800 mb-3 text-center">
                                Need a new verification link?
                            </p>
                            <button
                                onClick={handleResend}
                                disabled={resending}
                                className="w-full flex items-center justify-center gap-2 rounded-xl
                                           bg-amber-500 py-2.5 text-sm font-bold text-white
                                           hover:bg-amber-600 disabled:opacity-60 transition-colors"
                            >
                                {resending
                                    ? <><RefreshCw size={13} className="animate-spin" /> Sending…</>
                                    : <><Mail size={13} /> Resend Verification Email</>
                                }
                            </button>
                        </div>
                    )}

                    {resent && (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
                            <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                            <p className="text-sm text-emerald-700">
                                If your email is pending verification, a new link has been sent.
                            </p>
                        </div>
                    )}

                    <Link href="/login"
                        className="flex items-center justify-center w-full rounded-xl
                                   border border-gray-200 py-2.5 text-sm font-semibold
                                   text-gray-700 hover:bg-gray-50 transition-colors">
                        Back to Sign In
                    </Link>
                </div>
            )}
        </GuestLayout>
    )
}
