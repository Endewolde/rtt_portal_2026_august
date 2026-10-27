import { useState } from 'react'
import { Link } from '@inertiajs/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, AlertCircle, CheckCircle } from 'lucide-react'
import GuestLayout from '../../Layouts/GuestLayout'
import { post } from '../../lib/api'

const schema = z.object({ email: z.string().email('Enter a valid email address') })

export default function ForgotPassword() {
    const [sent,  setSent]  = useState(false)
    const [error, setError] = useState('')

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
    })

    const onSubmit = async (data) => {
        setError('')
        try {
            await post('/auth/forgot-password', data)
        } catch (e) {
            const status = e.response?.status
            if (status === 429) {
                setError('Too many attempts. Please wait before trying again.')
                return
            }
            // Other errors: still show success (security — don't reveal email existence)
        }
        setSent(true)
    }

    if (sent) return (
        <GuestLayout card
            panelHeading="Check Your Inbox"
            panelSubtext="A password reset link has been sent if your email is registered with us."
        >
            <div className="text-center py-4">
                <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <CheckCircle size={30} className="text-emerald-500" />
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Check your inbox</h1>
                <p className="text-sm text-gray-500 mb-2">
                    If that email is registered, we've sent a password reset link.
                    It expires in <strong>60 minutes</strong>.
                </p>
                <p className="text-xs text-gray-400 mb-6">
                    Don't see it? Check your spam folder.
                </p>
                <Link href="/login"
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl
                               bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
                    Back to Sign In
                </Link>
            </div>
        </GuestLayout>
    )

    return (
        <GuestLayout card
            panelHeading="Forgot Password?"
            panelSubtext="No worries — enter your email and we'll send you a link to reset your password."
        >
            <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-gray-900">Reset password</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Remember it?{' '}
                    <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700">Sign in</Link>
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Email Address
                    </label>
                    <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 bg-gray-50 transition-colors
                                     ${errors.email
                                         ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-200'
                                         : 'border-gray-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 focus-within:bg-white'
                                     }`}>
                        <Mail size={16} className={errors.email ? 'text-red-400 shrink-0' : 'text-gray-400 shrink-0'} />
                        <input
                            type="email"
                            {...register('email')}
                            placeholder="you@university.edu"
                            autoComplete="email"
                            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                        />
                    </div>
                    {errors.email && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                            <AlertCircle size={11} /> {errors.email.message}
                        </p>
                    )}
                </div>

                {error && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
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
                            Sending…
                          </span>
                        : 'Send Reset Link'
                    }
                </button>
            </form>
        </GuestLayout>
    )
}
