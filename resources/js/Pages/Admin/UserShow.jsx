import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import {
    ArrowLeft, Mail, Phone, CreditCard, Building2,
    BookOpen, Calendar, ShieldCheck, CheckCircle2,
    XCircle, AlertTriangle,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';
import { formatDate, cn } from '../../lib/utils';

const ROLE_LABELS = {
    admin: 'Admin', central_officer: 'Central Officer', college_officer: 'College Officer',
    finance_officer: 'Finance Officer', research_officer: 'Research Officer',
    community_officer: 'Community Officer', technology_officer: 'Technology Officer',
    support_officer: 'Support Officer', staff: 'Staff', guest: 'Guest',
    // legacy / custom fallback handled by replace(/_/g, ' ')
};

const ROLE_COLORS = {
    admin:              'bg-rose-50 text-rose-700 border border-rose-200',
    central_officer:    'bg-orange-50 text-orange-700 border border-orange-200',
    college_officer:    'bg-teal-50 text-teal-700 border border-teal-200',
    finance_officer:    'bg-amber-50 text-amber-700 border border-amber-200',
    research_officer:   'bg-indigo-50 text-indigo-700 border border-indigo-200',
    community_officer:  'bg-pink-50 text-pink-700 border border-pink-200',
    technology_officer: 'bg-violet-50 text-violet-700 border border-violet-200',
    support_officer:    'bg-sky-50 text-sky-700 border border-sky-200',
    staff:              'bg-cyan-50 text-cyan-700 border border-cyan-200',
    guest:              'bg-gray-100 text-gray-500 border border-gray-200',
};

const STATUS_CONFIG = {
    active:    { label: 'Active',    icon: CheckCircle2,  cls: 'bg-green-50 text-green-700 border border-green-200' },
    inactive:  { label: 'Inactive',  icon: XCircle,       cls: 'bg-gray-100 text-gray-500 border border-gray-200'  },
    suspended: { label: 'Suspended', icon: AlertTriangle, cls: 'bg-red-50 text-red-600 border border-red-200'      },
};

const AVATAR_GRADIENTS = [
    'from-blue-500 to-indigo-600', 'from-purple-500 to-violet-600',
    'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',   'from-cyan-500 to-sky-600',
];

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
                <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-32" />
                    <div className="h-48 bg-gray-100 rounded-2xl" />
                    <div className="grid grid-cols-2 gap-4">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
                    </div>
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

    const roles     = (user.roles ?? []).map(r => typeof r === 'string' ? r : r.name);
    const name      = user.name ?? '';
    const initials  = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const gradient  = AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
    const statusCfg = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.active;
    const StatusIcon = statusCfg.icon;

    const infoCards = [
        { icon: Mail,      label: 'Email',       value: user.email },
        { icon: Phone,     label: 'Phone',        value: user.phone ?? '—' },
        { icon: CreditCard, label: 'Employee ID', value: user.employee_id ?? '—' },
        { icon: Building2, label: 'College',      value: user.college?.name ?? '—' },
        { icon: BookOpen,  label: 'Department',   value: user.department?.name ?? '—' },
        { icon: Calendar,  label: 'Registered',   value: formatDate(user.created_at) },
    ];

    return (
        <AppLayout breadcrumb="User Details">
            <div className="max-w-3xl mx-auto space-y-5">

                {/* Back */}
                <Link href="/admin/users"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    <ArrowLeft size={14} /> Back to Users
                </Link>

                {/* Profile card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                    {/* Hero banner */}
                    <div className={`relative h-36 bg-linear-to-br ${gradient}`}>
                        {/* Decorative shapes */}
                        <span className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
                        <span className="absolute bottom-0 right-20 w-24 h-24 rounded-full bg-white/8 pointer-events-none" />
                        <span className="absolute top-5 right-36 w-8 h-8 rotate-45 rounded-lg border border-white/20 pointer-events-none" />
                        <span className="absolute bottom-6 left-40 w-4 h-4 rotate-45 bg-white/15 rounded-sm pointer-events-none" />

                        {/* Status badge — pinned top-right */}
                        <span className={cn(
                            'absolute top-4 right-4 flex items-center gap-1.5',
                            'text-xs font-semibold px-3 py-1.5 rounded-full',
                            statusCfg.cls,
                        )}>
                            <StatusIcon size={12} />
                            {statusCfg.label}
                        </span>
                    </div>

                    <div className="px-6 pb-6">
                        {/* Avatar — large circle overlapping banner */}
                        <div className="-mt-14 mb-4 relative z-10">
                            <div className={cn(
                                `w-28 h-28 rounded-full bg-linear-to-br ${gradient}`,
                                'flex items-center justify-center text-white text-3xl font-bold',
                                'ring-4 ring-white shadow-xl shrink-0 overflow-hidden',
                            )}>
                                {user.avatar
                                    ? <img src={user.avatar} alt={name} className="w-full h-full object-cover" />
                                    : initials
                                }
                            </div>
                        </div>

                        {/* Identity */}
                        <div className="mb-5">
                            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                                {user.title && (
                                    <span className="text-gray-400 font-normal text-lg mr-2">{user.title}</span>
                                )}
                                {name}
                            </h1>
                            <p className="text-sm text-gray-400 mt-1">{user.email}</p>
                        </div>

                        {/* Roles */}
                        <div className="flex items-center gap-2 flex-wrap mb-6">
                            <ShieldCheck size={14} className="text-gray-400 shrink-0" />
                            {roles.length === 0
                                ? <span className="text-xs text-gray-400 italic">No role assigned</span>
                                : roles.map(r => (
                                    <span key={r}
                                        className={cn(
                                            'text-xs font-semibold px-3 py-1 rounded-full capitalize',
                                            ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
                                        )}>
                                        {ROLE_LABELS[r] ?? r.replace(/_/g, ' ')}
                                    </span>
                                ))
                            }
                        </div>

                        {/* Info grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {infoCards.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Icon size={12} className="text-gray-400 shrink-0" />
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                                    </div>
                                    <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Expertise */}
                        {(user.expertise?.length > 0) && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Research Expertise</p>
                                <div className="flex flex-wrap gap-2">
                                    {user.expertise.map((tag, i) => (
                                        <span key={i}
                                            className="text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
