import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import {
    ClipboardCheck, Clock, AlertCircle, Download,
    CheckCircle2, ChevronRight, BookOpen, Calendar,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { useToast } from '../../Components/Toast';
import api from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';

const STATUS_META = {
    pending:     { label: 'Pending',     bg: 'bg-amber-100',   text: 'text-amber-700',  dot: 'bg-amber-400'   },
    accepted:    { label: 'Accepted',    bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500'    },
    in_progress: { label: 'In Progress', bg: 'bg-violet-100',  text: 'text-violet-700', dot: 'bg-violet-500'  },
    submitted:   { label: 'Submitted',   bg: 'bg-emerald-100', text: 'text-emerald-700',dot: 'bg-emerald-500' },
    declined:    { label: 'Declined',    bg: 'bg-red-100',     text: 'text-red-700',    dot: 'bg-red-400'     },
};

function getDaysRemaining(dueDate) {
    if (!dueDate) return null;
    return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dueDate }) {
    const days = getDaysRemaining(dueDate);
    if (days === null) return null;

    if (days < 0) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
            <AlertCircle size={11} className="animate-pulse" />
            Overdue {Math.abs(days)}d
        </span>
    );
    if (days === 0) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
            <Clock size={11} className="animate-pulse" />
            Due today
        </span>
    );
    if (days <= 3) return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
            <Clock size={11} />
            {days}d left
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
            <Calendar size={11} />
            {formatDate(dueDate)}
        </span>
    );
}

function UrgencyStripe({ daysLeft, isDone }) {
    if (isDone)           return 'border-l-4 border-l-emerald-400';
    if (daysLeft === null) return 'border-l-4 border-l-gray-200';
    if (daysLeft < 0)     return 'border-l-4 border-l-red-400';
    if (daysLeft <= 3)    return 'border-l-4 border-l-orange-400';
    return 'border-l-4 border-l-blue-300';
}

export default function ReviewIndex() {
    const { error } = useToast();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/review-assignments/my')
            .then(res => setAssignments(res.data?.data ?? []))
            .catch(() => error('Failed to load your review assignments.'))
            .finally(() => setLoading(false));
    }, []);

    const total     = assignments.length;
    const pending   = assignments.filter(a => ['pending', 'in_progress', 'accepted'].includes(a.status)).length;
    const completed = assignments.filter(a => a.status === 'submitted').length;
    const overdue   = assignments.filter(a => {
        const d = getDaysRemaining(a.due_date);
        return d !== null && d < 0 && a.status !== 'submitted';
    }).length;

    if (loading) {
        return (
            <AppLayout breadcrumb="Reviews">
                <div className="p-8 flex items-center justify-center min-h-64">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-9 h-9 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-400">Loading assignments…</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumb="Reviews">
            <div className="p-6 max-w-5xl mx-auto space-y-6">

                {/* ── Page header ─────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <ClipboardCheck size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">My Review Assignments</h1>
                            <p className="text-sm text-gray-400 mt-0.5">Proposals assigned to you for evaluation</p>
                        </div>
                    </div>
                    <a
                        href={`/api/v1/calendar/export?token=${localStorage.getItem('rtt_token') ?? ''}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-colors shrink-0"
                    >
                        <Download size={13} />
                        Export iCal
                    </a>
                </div>

                {/* ── Stats row ────────────────────────────────────────────── */}
                {total > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Total',     value: total,     bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100'    },
                            { label: 'Pending',   value: pending,   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'   },
                            { label: 'Completed', value: completed, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
                            { label: 'Overdue',   value: overdue,   bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-100'     },
                        ].map(stat => (
                            <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-2xl px-4 py-3.5 flex items-center justify-between`}>
                                <span className="text-xs font-medium text-gray-500">{stat.label}</span>
                                <span className={`text-2xl font-extrabold ${stat.text} tabular-nums`}>{stat.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Empty state ──────────────────────────────────────────── */}
                {total === 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-14 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ClipboardCheck size={28} className="text-gray-300" />
                        </div>
                        <h3 className="text-gray-700 font-semibold mb-1.5">No assignments yet</h3>
                        <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
                            You have no review assignments at the moment.
                            Check back after proposals are assigned for review.
                        </p>
                    </div>
                )}

                {/* ── Assignment cards ─────────────────────────────────────── */}
                {total > 0 && (
                    <div className="space-y-3">
                        {assignments.map(assignment => {
                            const daysLeft = getDaysRemaining(assignment.due_date);
                            const isDone   = assignment.status === 'submitted';
                            const meta     = STATUS_META[assignment.status] ?? STATUS_META.pending;
                            const stripe   = UrgencyStripe({ daysLeft, isDone });

                            return (
                                <div
                                    key={assignment.id}
                                    className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md ${stripe}`}
                                >
                                    <div className="p-5">
                                        <div className="flex items-start gap-4">

                                            {/* Icon */}
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                                                {isDone
                                                    ? <CheckCircle2 size={18} className="text-emerald-600" />
                                                    : <BookOpen size={18} className="text-blue-600" />
                                                }
                                            </div>

                                            {/* Main content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                                        {assignment.proposal?.tracker_number || 'N/A'}
                                                    </span>
                                                    <span className="text-xs text-gray-400 capitalize">
                                                        {getCategoryLabel(assignment.proposal?.category)}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                                        {meta.label}
                                                    </span>
                                                </div>
                                                <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1 pr-4">
                                                    {assignment.proposal?.title || 'Untitled Proposal'}
                                                </h3>
                                                <p className="text-xs text-gray-400">
                                                    {assignment.evaluation_type?.label || 'Evaluation'}
                                                </p>
                                            </div>

                                            {/* Right side */}
                                            <div className="flex flex-col items-end gap-3 shrink-0">
                                                <DueBadge dueDate={assignment.due_date} />

                                                {isDone ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                                                        <CheckCircle2 size={13} />
                                                        Submitted
                                                    </span>
                                                ) : (
                                                    <Link
                                                        href={`/reviews/${assignment.id}/score`}
                                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm shadow-blue-200"
                                                    >
                                                        <ClipboardCheck size={13} />
                                                        Score Review
                                                        <ChevronRight size={13} />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
