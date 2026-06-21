import { useState, useEffect } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    User, GraduationCap, Mail, Phone, CreditCard,
    ChevronDown, Building2, BookOpen, X, AlertCircle,
} from 'lucide-react';
import GuestLayout from '../../Layouts/GuestLayout';
import { post, get } from '../../lib/api';

function buildSchema(emailDomain, hasDepartments) {
    let emailRule = z.string().min(1, 'Email is required').email('Invalid email');
    if (emailDomain) {
        const suffix = emailDomain.startsWith('@') ? emailDomain : `@${emailDomain}`;
        emailRule = emailRule.refine(
            (v) => v.toLowerCase().endsWith(suffix.toLowerCase()),
            { message: `Email must end with ${suffix}` }
        );
    }

    return z.object({
        name:          z.string().min(2, 'Full name is required'),
        title:         z.string().min(1, 'Academic title is required'),
        email:         emailRule,
        gender:        z.string().min(1, 'Please select your gender'),
        phone:         z.string().optional(),
        employee_id:   z.string().optional(),
        college_id:    z.string().min(1, 'Please select your college'),
        department_id: hasDepartments
            ? z.string().min(1, 'Please select your department')
            : z.string().optional(),
        expertise:     z.array(z.string()).min(1, 'Add at least one area of expertise'),
    });
}

function FieldWrap({ label, required, error, hint, icon: Icon, children }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 bg-white transition-all duration-150
                ${error
                    ? 'ring-2 ring-red-300 border-red-300'
                    : 'border-gray-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100'
                }`}
                style={{ border: error ? undefined : '1px solid #e5e7eb' }}>
                {Icon && <Icon size={14} className={`shrink-0 ${error ? 'text-red-400' : 'text-gray-350'}`} style={{ color: error ? undefined : '#9ca3af' }} />}
                {children}
            </div>
            {error && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle size={10} /> {error}
                </p>
            )}
            {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
    );
}

const inputCls = 'flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none min-w-0';
const selectCls = 'flex-1 bg-transparent text-sm text-gray-900 outline-none appearance-none cursor-pointer min-w-0';

function SectionHeading({ icon: Icon, label, color }) {
    return (
        <div className="flex items-center gap-2 mb-4">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={13} className="text-white" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
            <div className="flex-1 h-px bg-gray-100" />
        </div>
    );
}

export default function Register() {
    const appSettings = usePage().props.app_settings ?? {};
    const emailDomain = appSettings.registration_email_domain ?? '';

    const [success, setSuccess]             = useState(false);
    const [serverError, setServerError]     = useState('');
    const [colleges, setColleges]           = useState([]);
    const [departments, setDepartments]     = useState([]);
    const [depsLoading, setDepsLoading]     = useState(false);
    const [expertiseInput, setExpertiseInput] = useState('');
    const [expertiseTags, setExpertiseTags]   = useState([]);
    const [selectedCollege, setSelectedCollege] = useState('');

    const hasDepartments = departments.length > 0;
    const schema = buildSchema(emailDomain, hasDepartments);

    const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: { expertise: [], gender: '', college_id: '', department_id: '', phone: '', employee_id: '' },
    });

    useEffect(() => {
        get('/colleges/public').then(r => setColleges(r.data ?? [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (selectedCollege) {
            setDepsLoading(true);
            get(`/colleges/${selectedCollege}/departments/public`)
                .then(r => {
                    setDepartments(r.data ?? []);
                    setValue('department_id', '');
                })
                .catch(() => setDepartments([]))
                .finally(() => setDepsLoading(false));
        } else {
            setDepartments([]);
            setValue('department_id', '');
        }
    }, [selectedCollege]);

    const addTag = (raw) => {
        const tag = raw.trim().replace(/,+$/, '').trim();
        if (!tag) return;
        const next = [...expertiseTags, tag].filter((t, i, arr) => arr.indexOf(t) === i);
        setExpertiseTags(next);
        setValue('expertise', next);
        setExpertiseInput('');
    };

    const removeTag = (tag) => {
        const next = expertiseTags.filter(t => t !== tag);
        setExpertiseTags(next);
        setValue('expertise', next);
    };

    const onExpertiseKey = (e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(expertiseInput); }
        else if (e.key === 'Backspace' && !expertiseInput && expertiseTags.length) {
            removeTag(expertiseTags[expertiseTags.length - 1]);
        }
    };

    const onSubmit = async (data) => {
        setServerError('');
        try {
            const payload = {
                ...data,
                expertise:   expertiseTags,
                employee_id: data.employee_id || null,
                phone:       data.phone       || null,
                title:       data.title       || null,
            };
            await post('/auth/register', payload);
            setSuccess(true);
        } catch (e) {
            const status = e.response?.status;
            if (status === 429) {
                setServerError('Too many attempts. Please wait before trying again.');
            } else {
                setServerError(e.response?.data?.message ?? 'Registration failed. Please try again.');
            }
        }
    };

    const layoutProps = {
        panelHeading:  'Join the Platform',
        panelSubtext:  'Create your institutional account to submit research proposals and collaborate with the university research community.',
        panelLinkText: 'Sign In',
        panelLinkHref: '/login',
        contentWidth:  'max-w-2xl',
    };

    if (success) return (
        <GuestLayout {...layoutProps}>
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 px-8 py-10 text-center">
                <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-teal-50 flex items-center justify-center">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email!</h2>
                <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                    We sent a verification link to your email. Click it to activate your account before signing in.
                </p>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-left max-w-xs mx-auto">
                    <p className="text-xs text-amber-800 font-medium">
                        Don't see it? Check your spam folder. The link expires in <strong>24 hours</strong>.
                    </p>
                </div>
                <Link href="/login"
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' }}>
                    Back to Sign In
                </Link>
            </div>
        </GuestLayout>
    );

    return (
        <GuestLayout {...layoutProps}>
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 px-8 py-8">

                {/* Header */}
                <div className="mb-7">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create account</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">

                    {/* ── Personal Information ─────────────────────────── */}
                    <div>
                        <SectionHeading icon={User} label="Personal Information" color="bg-teal-500" />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4">

                            <FieldWrap label="Full Name" required icon={User} error={errors.name?.message}>
                                <input type="text" placeholder="e.g. Abebe Kebede"
                                    className={inputCls} {...register('name')} />
                            </FieldWrap>

                            <FieldWrap label="Academic Title" required icon={GraduationCap} error={errors.title?.message}
                                hint="Prof., Dr., Mr., Mrs., Ms.">
                                <input type="text" placeholder="Prof. / Dr. / Mr. …"
                                    className={inputCls} {...register('title')} />
                            </FieldWrap>

                            <FieldWrap label="Email" required icon={Mail} error={errors.email?.message}
                                hint={emailDomain ? `Must end with @${emailDomain.replace(/^@/, '')}` : undefined}>
                                <input type="email"
                                    placeholder={emailDomain ? `name@${emailDomain.replace(/^@/, '')}` : 'you@institution.edu.et'}
                                    className={inputCls} {...register('email')} />
                            </FieldWrap>

                            <FieldWrap label="Gender" required icon={ChevronDown} error={errors.gender?.message}>
                                <select className={selectCls} {...register('gender')}>
                                    <option value="">Select gender…</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                                <ChevronDown size={12} className="text-gray-400 shrink-0 pointer-events-none" />
                            </FieldWrap>

                            <FieldWrap label="Phone" icon={Phone} error={errors.phone?.message}>
                                <input type="tel" placeholder="+251 9xx xxx xxxx"
                                    className={inputCls} {...register('phone')} />
                            </FieldWrap>

                            <FieldWrap label="Employee ID" icon={CreditCard} error={errors.employee_id?.message}>
                                <input type="text" placeholder="e.g. EMP-001"
                                    className={inputCls} {...register('employee_id')} />
                            </FieldWrap>

                        </div>
                    </div>

                    {/* ── Organisation ────────────────────────────────── */}
                    <div>
                        <SectionHeading icon={Building2} label="Organisation" color="bg-indigo-500" />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4">

                            <FieldWrap label="College" required icon={Building2} error={errors.college_id?.message}>
                                <select
                                    className={selectCls}
                                    {...register('college_id')}
                                    onChange={e => {
                                        setSelectedCollege(e.target.value);
                                        setValue('college_id', e.target.value);
                                    }}
                                >
                                    <option value="">Select college…</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <ChevronDown size={12} className="text-gray-400 shrink-0 pointer-events-none" />
                            </FieldWrap>

                            <FieldWrap
                                label="Department"
                                required={hasDepartments}
                                icon={Building2}
                                error={errors.department_id?.message}
                                hint={!selectedCollege ? 'Select a college first' : depsLoading ? 'Loading…' : undefined}
                            >
                                <select
                                    className={`${selectCls} ${(!selectedCollege || depsLoading) ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    disabled={!selectedCollege || depsLoading || !hasDepartments}
                                    {...register('department_id')}
                                >
                                    <option value="">
                                        {depsLoading ? 'Loading…' : !selectedCollege ? 'Select college first' : !hasDepartments ? 'No departments' : 'Select department…'}
                                    </option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <ChevronDown size={12} className="text-gray-400 shrink-0 pointer-events-none" />
                            </FieldWrap>

                        </div>
                    </div>

                    {/* ── Research Expertise ──────────────────────────── */}
                    <div>
                        <SectionHeading icon={BookOpen} label="Research Expertise" color="bg-violet-500" />

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Expertise Areas <span className="text-red-500">*</span>
                            </label>
                            <div className={`flex flex-wrap gap-1.5 p-3 rounded-xl bg-white transition-all duration-150 min-h-12
                                ${errors.expertise
                                    ? 'ring-2 ring-red-300 border-red-300'
                                    : 'border-gray-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100'
                                }`}
                                style={{ border: errors.expertise ? undefined : '1px solid #e5e7eb' }}>
                                {expertiseTags.map((tag, i) => (
                                    <span key={i}
                                        className="flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-200 text-xs font-medium px-2.5 py-1 rounded-lg">
                                        {tag}
                                        <button type="button" onClick={() => removeTag(tag)}
                                            className="text-teal-400 hover:text-teal-700 transition-colors ml-0.5">
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    value={expertiseInput}
                                    onChange={e => setExpertiseInput(e.target.value)}
                                    onKeyDown={onExpertiseKey}
                                    onBlur={() => addTag(expertiseInput)}
                                    placeholder={expertiseTags.length === 0 ? 'Type an area and press Enter or comma — e.g. Machine Learning, Biomedical Engineering…' : ''}
                                    className="flex-1 min-w-48 text-sm outline-none bg-transparent placeholder-gray-400 px-1"
                                />
                            </div>
                            {errors.expertise && (
                                <p className="flex items-center gap-1 text-xs text-red-500">
                                    <AlertCircle size={10} /> {errors.expertise.message}
                                </p>
                            )}
                            {!errors.expertise && (
                                <p className="text-xs text-gray-400">Press Enter or comma after each area. Used to match you with relevant proposals.</p>
                            )}
                        </div>
                    </div>

                    {/* Server error */}
                    {serverError && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{serverError}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-xl py-3.5 text-sm font-semibold text-white tracking-wide
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
                                Creating account…
                              </span>
                            : 'Create Account'
                        }
                    </button>

                </form>
            </div>
        </GuestLayout>
    );
}
