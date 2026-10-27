import { useState } from 'react'
import { Link, router } from '@inertiajs/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import GuestLayout from '../../Layouts/GuestLayout'
import { post } from '../../lib/api'

const schema = z.object({
    password: z.string().min(8, 'At least 8 characters'),
    password_confirmation: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
})

function PasswordInput({ placeholder, error, ...rest }) {
    const [show, setShow] = useState(false)
    return (
        <div>
            <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 bg-gray-50 transition-colors
                             ${error
                                 ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-200'
                                 : 'border-gray-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 focus-within:bg-white'
                             }`}>
                <Lock size={16} className={error ? 'text-red-400 shrink-0' : 'text-gray-400 shrink-0'} />
                <input
                    type={show ? 'text' : 'password'}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                    {...rest}
                />
                <button type="button" onClick={() => setShow(v => !v)}
                    className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors" tabIndex={-1}>
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
            {error && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle size={11} /> {error}
                </p>
            )}
        </div>
    )
}

export default function ResetPassword() {
    const params   = new URLSearchParams(window.location.search)
    const token    = params.get('token') ?? ''
    const email    = params.get('email') ?? ''

    const [success,     setSuccess]     = useState(false)
    const [serverError, setServerError] = useState('')

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
    })

    const onSubmit = async (data) => {
        setServerError('')
        try {
            await post('/auth/reset-password', { token, email, ...data })
            setSuccess(true)
        } catch (e) {
            const status = e.response?.status
            if (status === 429) {
                setServerError('Too many attempts. Please wait a moment.')
            } else {
                setServerError(e.response?.data?.message ?? 'Failed to reset password. The link may have expired.')
            }
        }
    }

    if (!token || !email) return (
        <GuestLayout card panelHeading="Invalid Link" panelSubtext="This password reset link is missing required information.">
            <div className="text-center py-6">
                <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center">
                    <AlertCircle size={28} className="text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid reset link</h1>
                <p className="text-sm text-gray-500 mb-6">This link is missing required information. Please request a new reset link.</p>
                <Link href="/forgot-password"
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl
                               bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
                    Request New Link
                </Link>
            </div>
        </GuestLayout>
    )

    if (success) return (
        <GuestLayout card panelHeading="Password Updated" panelSubtext="Your new password is ready. Sign in to continue.">
            <div className="text-center py-4">
                <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <CheckCircle size={30} className="text-emerald-500" />
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Password updated!</h1>
                <p className="text-sm text-gray-500 mb-6">
                    Your password has been changed successfully. You can now sign in with your new password.
                </p>
                <button
                    onClick={() => router.visit('/login')}
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl
                               bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
                    Sign In
                </button>
            </div>
        </GuestLayout>
    )

    return (
        <GuestLayout card
            panelHeading="Set New Password"
            panelSubtext="Choose a strong password you haven't used before."
        >
            <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-gray-900">Set new password</h1>
                <p className="mt-1 text-sm text-gray-500">For <strong className="text-gray-700">{email}</strong></p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        New Password
                    </label>
                    <PasswordInput
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        error={errors.password?.message}
                        {...register('password')}
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Confirm New Password
                    </label>
                    <PasswordInput
                        placeholder="Repeat your new password"
                        autoComplete="new-password"
                        error={errors.password_confirmation?.message}
                        {...register('password_confirmation')}
                    />
                </div>

                {serverError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-red-700">{serverError}</p>
                            {serverError.includes('expired') && (
                                <Link href="/forgot-password"
                                    className="text-xs text-red-600 underline mt-1 inline-block">
                                    Request a new reset link
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white
                               hover:bg-teal-700 active:scale-[0.98] transition-all disabled:opacity-60
                               shadow-sm shadow-teal-200 mt-2"
                >
                    {isSubmitting
                        ? <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Saving…
                          </span>
                        : 'Reset Password'
                    }
                </button>
            </form>
        </GuestLayout>
    )
}
