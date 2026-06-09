import { useState, useMemo } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataTable({ columns, data = [], isLoading, emptyMessage = 'No data found.' }) {
    const [sorting, setSorting] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const table = useReactTable({
        data,
        columns,
        state: { sorting, globalFilter, pagination },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div className="w-full">
            {/* Search */}
            <div className="mb-4 flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        placeholder="Search…"
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={pagination.pageSize}
                    onChange={(e) => table.setPageSize(Number(e.target.value))}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none"
                >
                    {[10, 25, 50].map((s) => <option key={s} value={s}>Show {s}</option>)}
                </select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                                {hg.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-4 py-3 cursor-pointer select-none"
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <span className="flex items-center gap-1">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {header.column.getCanSort() && (
                                                header.column.getIsSorted() === 'asc' ? <ChevronUp size={12} /> :
                                                header.column.getIsSorted() === 'desc' ? <ChevronDown size={12} /> :
                                                <ChevronsUpDown size={12} className="text-gray-300" />
                                            )}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    {columns.map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">{emptyMessage}</td></tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>
                    Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                    {' · '}{table.getFilteredRowModel().rows.length} results
                </span>
                <div className="flex items-center gap-2">
                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
