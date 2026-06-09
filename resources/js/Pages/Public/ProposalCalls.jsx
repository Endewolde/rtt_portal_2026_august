import { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import ProposalCallCard from '../../Components/ProposalCallCard';
import { get } from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';

const CATEGORIES = ['research', 'community_engagement', 'technology_transfer', 'innovation', 'other'];

export default function ProposalCalls() {
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        const now = new Date();
        get('/proposal-calls', { status: 'open' })
            .then((r) => {
                const raw = r.data?.data ?? r.data ?? [];
                const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
                setCalls(items.filter(c => !c.end_date || (c.countdown_seconds ?? 1) > 0));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = calls.filter((c) => {
        const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase());
        const matchCat    = !category || c.category === category;
        return matchSearch && matchCat;
    });

    return (
        <PublicLayout>
            <div className="max-w-7xl mx-auto px-4 py-12">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Proposal Calls</h1>
                <p className="text-gray-500 mb-8">Open funding opportunities for research and community projects.</p>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search calls..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="relative">
                        <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="pl-9 pr-8 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                        >
                            <option value="">All Categories</option>
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{getCategoryLabel(c)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-gray-100 rounded-2xl h-64 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        <p className="text-lg font-medium">No open calls found.</p>
                        <p className="text-sm mt-1">Check back later for new funding opportunities.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((call) => (
                            <ProposalCallCard key={call.id} call={call} />
                        ))}
                    </div>
                )}
            </div>
        </PublicLayout>
    );
}
