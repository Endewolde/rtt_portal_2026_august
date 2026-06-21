import { useState, useMemo } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function DataTable({
    columns,
    data = [],
    isLoading,
    emptyMessage = 'No data found.',
    // Bulk selection props
    selectable = false,
    bulkActions = [],   // [{ label, action, variant? }]
    onBulkAction,       // (action, selectedIds) => void
    getRowId,           // (row) => string — defaults to row.id
}) {
    const [sorting, setSorting]           = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [pagination, setPagination]     = useState({ pageIndex: 0, pageSize: 10 });
    const [rowSelection, setRowSelection] = useState({});

    const resolveId = getRowId ?? ((row) => row.id);

    const rowNumberColumn = useMemo(() => ({
        id: '__rownum__',
        header: '#',
        cell: ({ row, table }) => {
            const { pageIndex, pageSize } = table.getState().pagination;
            return (
                <span className="text-xs font-medium text-gray-400 tabular-nums">
                    {pageIndex * pageSize + row.index + 1}
                </span>
            );
        },
        enableSorting: false,
        size: 48,
    }), []);

    const selectionColumn = useMemo(() => ({
        id: '__select__',
        header: ({ table }) => (
            <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                checked={table.getIsAllPageRowsSelected()}
                ref={el => { if (el) { el.indeterminate = table.getIsSomePageRowsSelected(); } }}
                onChange={table.getToggleAllPageRowsSelectedHandler()}
                aria-label="Select all on page"
            />
        ),
        cell: ({ row }) => (
            <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                checked={row.getIsSelected()}
                onChange={row.getToggleSelectedHandler()}
                onClick={(e) => e.stopPropagation()}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        size: 40,
    }), []);

    const effectiveColumns = [rowNumberColumn, ...(selectable ? [selectionColumn, ...columns] : columns)];

    const table = useReactTable({
        data,
        columns: effectiveColumns,
        state: { sorting, globalFilter, pagination, rowSelection },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        onRowSelectionChange: setRowSelection,
        getRowId: (row) => resolveId(row),
        enableRowSelection: selectable,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    const selectedIds   = Object.keys(rowSelection);
    const selectedCount = selectedIds.length;

    const handleBulkAction = (action) => {
        onBulkAction?.(action, selectedIds);
        setRowSelection({});
    };

    const variantClass = (variant) => {
        if (variant === 'danger') {
            return 'bg-red-600 hover:bg-red-700 text-white';
        }
        if (variant === 'secondary') {
            return 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700';
        }
        return 'bg-indigo-600 hover:bg-indigo-700 text-white';
    };

    return (
        <div className="w-full">
            {/* Bulk action bar */}
            {selectable && selectedCount > 0 && (
                <div className="mb-3 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
                    <span className="text-sm font-semibold text-indigo-700 mr-1">
                        {selectedCount} selected
                    </span>
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                        {bulkActions.map((ba) => (
                            <button
                                key={ba.action}
                                onClick={() => handleBulkAction(ba.action)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${variantClass(ba.variant)}`}
                            >
                                {ba.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setRowSelection({})}
                        className="ml-auto text-indigo-400 hover:text-indigo-700 transition"
                        aria-label="Clear selection"
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

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
                                        style={header.column.columnDef.size ? { width: header.column.columnDef.size } : undefined}
                                        className="px-4 py-3 cursor-pointer select-none"
                                        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
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
                                    {effectiveColumns.map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={effectiveColumns.length} className="px-4 py-8 text-center text-gray-400">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className={row.getIsSelected() ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                                >
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
                    {selectable && selectedCount > 0 && ` · ${selectedCount} selected`}
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
