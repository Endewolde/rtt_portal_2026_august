import { useState, useEffect } from 'react';
import { Link, router } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GuestLayout from '../../Layouts/GuestLayout';
import { post, get } from '../../lib/api';

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
    const [colleges, setColleges] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [success, setSuccess] = useState(false);
    const [serverError, setServerError] = useState('');

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
    const selectedCollege = watch('college_id');

    useEffect(() => {
        get('/colleges').then((r) => setColleges(r.data?.data ?? r.data ?? [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (selectedCollege) {
            get(`/colleges/${selectedCollege}/departments`).then((r) => setDepartments(r.data ?? [])).catch(() => {});
        }
    }, [selectedCollege]);

    const onSubmit = async (data) => {
        setServerError('');
        try {
            await post('/auth/register', data);
            setSuccess(true);
        } catch (e) {
            setServerError(e.response?.data?.message ?? 'Registration failed.');
        }
    };

    if (success) return (
        <GuestLayout>
            <div className="text-center py-6">
                <div className="text-4xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Account created!</h2>
                <p className="text-sm text-gray-500 mb-6">Please check your email to verify your account.</p>
                <Link href="/login" className="text-blue-600 font-medium hover:underline">Back to login</Link>
            </div>
        </GuestLayout>
    );

    return (
        <GuestLayout>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Create account</h2>
            <p className="text-sm text-gray-500 mb-5">Join the RTT research platform</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {[
                    { name: 'name', label: 'Full Name', type: 'text', required: true },
                    { name: 'email', label: 'Email', type: 'email', required: true },
                    { name: 'password', label: 'Password', type: 'password', required: true },
                    { name: 'password_confirmation', label: 'Confirm Password', type: 'password', required: true },
                    { name: 'employee_id', label: 'Employee ID', type: 'text', required: false },
                    { name: 'phone', label: 'Phone', type: 'text', required: false },
                ].map(({ name, label, type, required }) => (
                    <div key={name}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input type={type} {...register(name)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name].message}</p>}
                    </div>
                ))}

                {serverError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>}
                <button type="submit" disabled={isSubmitting}
                    className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                    {isSubmitting ? 'Creating account…' : 'Create Account'}
                </button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
                Already have an account? <Link href="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
            </p>
        </GuestLayout>
    );
}
