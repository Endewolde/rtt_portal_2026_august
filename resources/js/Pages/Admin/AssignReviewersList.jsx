import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { UserCheck } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import DataTable from '../../Components/DataTable';
import StatusBadge from '../../Components/StatusBadge';
import { get } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';

const columns = [
    { accessorKey: 'tracker_number', header: 'Tracker', cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-500">{row.original.tracker_number ?? '—'}</span>
    )},
    { accessorKey: 'title', header: 'Title', cell: ({ row }) => (
        <Link href={`/proposals/${row.original.id}`}
            className="text-sm font-medium text-blue-600 hover:underline line-clamp-2">
            {row.original.title ?? 'Untitled'}
        </Link>
    )},
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => (
        <span className="text-xs text-gray-500">{getCategoryLabel(row.original.category)}</span>
    )},
    { accessorKey: 'college.name', header: 'College', cell: ({ row }) => (
        <span className="text-xs text-gray-600">{row.original.college?.name ?? '—'}</span>
    )},
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'validated_at', header: 'Validated', cell: ({ row }) => (
        <span className="text-xs text-gray-500">{formatDate(row.original.validated_at)}</span>
    )},
    { id: 'actions', header: '', cell: ({ row }) => (
        <Link href={`/proposals/${row.original.id}/assign-reviewers`}
            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 whitespace-nowrap">
            <UserCheck size={13} /> Assign
        </Link>
    )},
];

export default function AssignReviewersList() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        get('/proposals', { status: 'validated' })
            .then((r) => setData(r.data?.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <AppLayout breadcrumb="Assign Reviewers">
            <div className="flex items-center gap-3 mb-6">
                <UserCheck size={24} className="text-blue-600" />
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Assign Reviewers</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Proposals awaiting reviewer assignment</p>
                </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <DataTable
                    columns={columns}
                    data={data}
                    isLoading={loading}
                    emptyMessage="No validated proposals awaiting reviewer assignment."
                />
            </div>
        </AppLayout>
    );
}
