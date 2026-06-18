import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { ClipboardCheck, Clock, AlertCircle, Download } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { useToast } from '../../Components/Toast';
import api from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';

const STATUS_COLORS = {
    pending:     'bg-yellow-100 text-yellow-700 border-yellow-200',
    accepted:    'bg-blue-100 text-blue-700 border-blue-200',
    in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
    submitted:   'bg-green-100 text-green-700 border-green-200',
    declined:    'bg-red-100 text-red-700 border-red-200',
};

function getDaysRemaining(dueDate) {
    if (!dueDate) return null;
    return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
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

    if (loading) {
        return (
            <AppLayout breadcrumb="Reviews">
                <div className="p-6 flex items-center justify-center min-h-64">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumb="Reviews">
            <div className="p-6 max-w-6xl mx-auto">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Review Assignments</h1>
                        <p className="text-sm text-gray-500 mt-1">Proposals assigned to you for evaluation</p>
                    </div>
                    <a
                        href={`/api/v1/calendar/export?token=${localStorage.getItem('rtt_token') ?? ''}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                        <Download size={12} />
                        Export Calendar
                    </a>
                </div>

                {assignments.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <ClipboardCheck size={40} className="mx-auto text-gray-300 mb-3" />
                        <h3 className="text-gray-600 font-medium mb-1">No assignments yet</h3>
                        <p className="text-sm text-gray-400">
                            You have no review assignments at the moment.
                            Check back after proposals are assigned for review.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary bar */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            {[
                                { label: 'Total Assigned',  value: assignments.length,                                                      color: 'blue' },
                                { label: 'Pending Review',  value: assignments.filter(a => ['pending', 'in_progress'].includes(a.status)).length, color: 'yellow' },
                                { label: 'Completed',       value: assignments.filter(a => a.status === 'submitted').length,                color: 'green' },
                            ].map(stat => (
                                <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                                    <div className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</div>
                                    <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        {assignments.map(assignment => {
                            const daysLeft  = getDaysRemaining(assignment.due_date);
                            const isOverdue = daysLeft !== null && daysLeft < 0;
                            const isUrgent  = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
                            const isDone    = assignment.status === 'submitted';

                            return (
                                <div
                                    key={assignment.id}
                                    className={`bg-white border rounded-xl p-5 transition-all hover:shadow-md ${
                                        isOverdue ? 'border-red-200 bg-red-50/30' :
                                        isUrgent  ? 'border-orange-200 bg-orange-50/30' :
                                        isDone    ? 'border-green-200 bg-green-50/30' :
                                        'border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                    {assignment.proposal?.tracker_number || 'N/A'}
                                                </span>
                                                <span className="text-xs text-gray-400 capitalize">
                                                    {getCategoryLabel(assignment.proposal?.category)}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[assignment.status] ?? STATUS_COLORS.pending}`}>
                                                    {assignment.status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
                                                {assignment.proposal?.title || 'Untitled Proposal'}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                {assignment.evaluation_type?.label || 'Evaluation'}
                                            </p>
                                        </div>

                                        <div className="flex flex-col items-end gap-3 shrink-0">
                                            {assignment.due_date && (
                                                <div className={`flex items-center gap-1.5 text-xs font-medium ${
                                                    isOverdue ? 'text-red-600' :
                                                    isUrgent  ? 'text-orange-600' :
                                                    'text-gray-500'
                                                }`}>
                                                    {(isOverdue || isUrgent) && <AlertCircle size={12} className="animate-pulse" />}
                                                    <Clock size={12} />
                                                    {isOverdue
                                                        ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`
                                                        : daysLeft === 0
                                                        ? 'Due today'
                                                        : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
                                                    }
                                                </div>
                                            )}

                                            {isDone ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                                    Review Submitted
                                                </span>
                                            ) : (
                                                <Link
                                                    href={`/reviews/${assignment.id}/score`}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                                >
                                                    <ClipboardCheck size={14} />
                                                    Score Review
                                                </Link>
                                            )}
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
