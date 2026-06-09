import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowLeft, User } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';
import { formatDate } from '../../lib/utils';

const ROLE_LABELS = {
    super_admin: 'Super Admin', central_office: 'Central Office',
    college_admin: 'College Admin', department_head: 'Dept. Head',
    pi: 'Principal Investigator', reviewer: 'Reviewer',
    finance: 'Finance Officer', guest: 'Guest',
};

export default function AdminUserShow() {
    const id = window.location.pathname.split('/').pop();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        get(`/users/${id}`)
            .then((r) => setUser(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <AppLayout breadcrumb="User Details">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-48" />
                    <div className="h-40 bg-gray-100 rounded-xl" />
                </div>
            </AppLayout>
        );
    }

    if (!user) {
        return (
            <AppLayout breadcrumb="User Not Found">
                <p className="text-gray-500">User not found.</p>
            </AppLayout>
        );
    }

    const roles = user.roles ?? [];
    const primaryRole = roles[0] ?? 'guest';

    const fields = [
        { label: 'Name', value: user.name },
        { label: 'Email', value: user.email },
        { label: 'Role', value: ROLE_LABELS[primaryRole] ?? primaryRole },
        { label: 'Employee ID', value: user.employee_id ?? '—' },
        { label: 'Phone', value: user.phone ?? '—' },
        { label: 'College', value: user.college?.name ?? '—' },
        { label: 'Department', value: user.department?.name ?? '—' },
        { label: 'Status', value: user.status },
        { label: 'Registered', value: formatDate(user.created_at) },
    ];

    return (
        <AppLayout breadcrumb="User Details">
            <div className="mb-6">
                <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <ArrowLeft size={14} /> Back to Users
                </Link>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-full bg-blue-700 flex items-center justify-center text-white text-xl font-bold">
                        {user.name?.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
                        <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {fields.map(({ label, value }) => (
                        <div key={label}>
                            <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
                            <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </AppLayout>
    );
}
