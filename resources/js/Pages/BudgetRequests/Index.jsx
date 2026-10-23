import { useState, useEffect } from 'react';
import { translate as tr } from '../../lib/i18n'
import { Link } from '@inertiajs/react';
import { DollarSign } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import DataTable from '../../Components/DataTable';
import StatusBadge from '../../Components/StatusBadge';
import { get } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';

const columns = [
    { accessorKey: 'proposal.tracker_number', header: 'Proposal', cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-500">{row.original.proposal?.tracker_number ?? '—'}</span>
    )},
    { accessorKey: 'funding_round', header: 'Round', cell: ({ row }) => <span className="text-sm">{tr("Round :funding_round", { funding_round: row.original.funding_round })}</span> },
    { accessorKey: 'total_amount', header: 'Amount', cell: ({ row }) => <span className="text-sm font-medium">{formatCurrency(row.original.total_amount)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'submitted_at', header: 'Submitted', cell: ({ row }) => <span className="text-xs text-gray-500">{formatDate(row.original.submitted_at)}</span> },
    { id: 'actions', header: '', cell: ({ row }) => (
        <Link href={`/budget-requests/${row.original.id}`} className="text-xs text-blue-600 hover:underline">{tr("View")}</Link>
    )},
];

export default function BudgetRequestIndex() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        get('/proposals').then((r) => {
            const proposals = r.data?.data ?? [];
            Promise.all(proposals.map((p) => get(`/proposals/${p.id}/budget-requests`).catch(() => ({ data: [] }))))
                .then((results) => setData(results.flatMap((r) => r.data ?? [])));
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    return (
        <AppLayout breadcrumb="Budget Requests">
            <div className="flex items-center gap-3 mb-6">
                <DollarSign size={24} className="text-emerald-600" />
                <h1 className="text-xl font-bold text-gray-900">{tr("Budget Requests")}</h1>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <DataTable columns={columns} data={data} isLoading={loading} emptyMessage="No budget requests found." />
            </div>
        </AppLayout>
    );
}
