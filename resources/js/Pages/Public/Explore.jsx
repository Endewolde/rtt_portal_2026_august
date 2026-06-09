import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import StatusBadge from '../../Components/StatusBadge';
import { get } from '../../lib/api';
import { getCategoryLabel, truncate } from '../../lib/utils';

const CATEGORIES = ['research', 'community_engagement', 'technology_transfer', 'innovation', 'other'];

export default function Explore() {
    const [proposals, setProposals] = useState([]);
    const [meta, setMeta] = useState({});
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ categories: [], academic_year: '' });
    const [sort, setSort] = useState('newest');
    const [page, setPage] = useState(1);

    useEffect(() => {
        setLoading(true);
        const params = { page, sort };
        if (search) params.search = search;
        if (filters.categories.length) params.category = filters.categories[0];
        if (filters.academic_year) params.academic_year = filters.academic_year;

        get('/proposals/public', params)
            .then((r) => { setProposals(r.data?.data ?? []); setMeta(r.data ?? {}); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [page, search, filters, sort]);

    const toggleCategory = (cat) => setFilters((f) => ({
        ...f,
        categories: f.categories.includes(cat)
            ? f.categories.filter((c) => c !== cat)
            : [...f.categories, cat],
    }));

    return (
        <PublicLayout>
            <div className="max-w-7xl mx-auto px-4 py-10">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Explore Proposals</h1>
                <div className="flex gap-6">
                    {/* Filters sidebar */}
                    <aside className="w-56 shrink-0 hidden md:block space-y-6">
                        <div>
                            <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Category</p>
                            {CATEGORIES.map((cat) => (
                                <label key={cat} className="flex items-center gap-2 text-sm text-gray-700 py-1 cursor-pointer">
                                    <input type="checkbox"
                                        checked={filters.categories.includes(cat)}
                                        onChange={() => toggleCategory(cat)}
                                        className="rounded border-gray-300 text-blue-600"
                                    />
                                    {getCategoryLabel(cat)}
                                </label>
                            ))}
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Academic Year</p>
                            <input type="text" placeholder="e.g. 2026"
                                value={filters.academic_year}
                                onChange={(e) => setFilters({ ...filters, academic_year: e.target.value })}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none"
                            />
                        </div>
                    </aside>

                    {/* Main content */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                    placeholder="Search proposals…"
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg
                                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <select value={sort} onChange={(e) => setSort(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none">
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                            </select>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">
                            Showing {proposals.length} of {meta.total ?? 0} proposals
                        </p>

                        {loading ? (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-36 bg-gray-200 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : proposals.length === 0 ? (
                            <p className="text-gray-400 text-center py-16">No proposals found.</p>
                        ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {proposals.map((p) => (
                                    <div key={p.id}
                                        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-mono text-gray-400">{p.tracker_number}</span>
                                            <StatusBadge status={p.status} />
                                        </div>
                                        <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">{p.title}</h3>
                                        <p className="text-xs text-gray-400 mb-2">
                                            {getCategoryLabel(p.category)} · {p.college?.name ?? ''}
                                        </p>
                                        <p className="text-xs text-gray-500 line-clamp-2">
                                            {truncate(p.abstract ?? '', 80)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {meta.last_page > 1 && (
                            <div className="mt-6 flex justify-center gap-2">
                                {page > 1 && (
                                    <button onClick={() => setPage(page - 1)}
                                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Prev</button>
                                )}
                                <span className="px-3 py-1 text-sm text-gray-600">
                                    Page {page} / {meta.last_page}
                                </span>
                                {page < meta.last_page && (
                                    <button onClick={() => setPage(page + 1)}
                                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Next</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
