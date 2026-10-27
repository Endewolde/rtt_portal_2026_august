import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    Archive, ChevronLeft, Search, X, RefreshCw, Building2,
    Users, Filter, BookOpen, Calendar, FileText,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { programmes } from '../../lib/programmes';
import { useToast } from '../../Components/Toast';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';

const ARCHIVE_STATUSES = ['completed', 'archived'];
const categoryOptions = () => [{ value: '', label: 'All Categories' }, ...programmes({ includeInactive: true }).map((p) => ({ value: p.key, label: p.name }))];

// ─── Year card ────────────────────────────────────────────────────────────────

function YearCard({ year, count, totalAwarded, onSelect }) {
    return (
        <button
            onClick={() => onSelect(year)}
            className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-teal-200 transition-all p-6 text-left group"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-teal-50 rounded-xl flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <Archive size={20} className="text-teal-600" />
                </div>
                <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded-lg font-semibold">
                    {count} {count === 1 ? 'project' : 'projects'}
                </span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{year}</h3>
            <p className="text-xs text-gray-400 mb-3">Academic Year</p>
            {totalAwarded > 0 && (
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(totalAwarded)} awarded</p>
            )}
            <div className="mt-4 flex items-center gap-1 text-xs text-teal-600 font-medium group-hover:gap-2 transition-all">
                <span>Browse projects</span>
                <ChevronLeft size={12} className="rotate-180" />
            </div>
        </button>
    );
}

// ─── Project row ─────────────────────────────────────────────────────────────

function ProjectRow({ proposal }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                            {proposal.tracker_number}
                        </span>
                        <span className="text-xs text-gray-400">{getCategoryLabel(proposal.category)}</span>
                        <StatusBadge status={proposal.status} />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{proposal.title}</h3>
                </div>
                {proposal.award?.awarded_amount > 0 && (
                    <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(proposal.award.awarded_amount)}</p>
                        <p className="text-xs text-gray-400">awarded</p>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                {proposal.pi?.name && (
                    <span className="flex items-center gap-1">
                        <Users size={11} className="text-gray-300" /> {proposal.pi.name}
                    </span>
                )}
                {proposal.college?.name && (
                    <span className="flex items-center gap-1">
                        <Building2 size={11} className="text-gray-300" /> {proposal.college.name}
                    </span>
                )}
                {proposal.award?.approved_at && (
                    <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-gray-300" /> {formatDate(proposal.award.approved_at)}
                    </span>
                )}
            </div>

            {/* Co-investigators */}
            {proposal.co_investigators_count > 0 && (
                <p className="text-xs text-gray-400 mb-3">
                    {proposal.co_investigators_count} co-investigator{proposal.co_investigators_count !== 1 ? 's' : ''}
                </p>
            )}

            <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
                <Link href={`/proposals/${proposal.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <FileText size={11} /> View Proposal
                </Link>
                {proposal.award && (
                    <Link href={`/proposals/${proposal.id}/award`} className="text-xs text-emerald-600 hover:underline">
                        Award Details
                    </Link>
                )}
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompletedArchive() {
    const { error } = useToast();
    const [view, setView] = useViewPreference('completed_archive', 'card');

    // year-level state
    const [yearSummaries, setYearSummaries] = useState([]);  // [{ year, count, totalAwarded }]
    const [loadingYears, setLoadingYears]   = useState(true);
    const [selectedYear, setSelectedYear]   = useState(null);

    // drill-in state
    const [proposals, setProposals]   = useState([]);
    const [loadingProps, setLoadingProps] = useState(false);
    const [colleges, setColleges]     = useState([]);
    const [page, setPage]             = useState(1);
    const [lastPage, setLastPage]     = useState(1);

    const [filters, setFilters] = useState({
        search: '',
        pi_search: '',
        member_search: '',
        college_id: '',
        category: '',
        status: '',
    });

    // ── Load year summaries ───────────────────────────────────────────────────

    useEffect(() => {
        const loadYears = async () => {
            setLoadingYears(true);
            try {
                const results = await Promise.all(
                    ARCHIVE_STATUSES.map(s =>
                        api.get('/proposals', { params: { status: s, per_page: 200, with_award: 1 } })
                            .then(r => r.data?.data?.data ?? r.data?.data ?? [])
                            .catch(() => [])
                    )
                );
                const withAwards = results.flat();

                // Build year summaries
                const byYear = {};
                for (const p of withAwards) {
                    const y = p.academic_year ?? 'Unknown';
                    if (!byYear[y]) byYear[y] = { year: y, count: 0, totalAwarded: 0 };
                    byYear[y].count++;
                    byYear[y].totalAwarded += parseFloat(p.award?.awarded_amount ?? 0);
                }
                setYearSummaries(Object.values(byYear).sort((a, b) => b.year.localeCompare(a.year)));
            } catch { error('Failed to load archive.'); }
            setLoadingYears(false);
        };

        loadYears();
        api.get('/colleges').then(r => setColleges(r.data?.data ?? r.data ?? [])).catch(() => {});
    }, []);

    // ── Load proposals for selected year ─────────────────────────────────────

    const loadProposals = useCallback(async (year, f, pg = 1) => {
        setLoadingProps(true);
        try {
            const params = {
                status: ARCHIVE_STATUSES.join(','),
                academic_year: year,
                per_page: 20,
                page: pg,
                with_award: 1,
            };
            if (f.search)        params.search        = f.search;
            if (f.pi_search)     params.pi_search     = f.pi_search;
            if (f.member_search) params.member_search = f.member_search;
            if (f.college_id)    params.college_id    = f.college_id;
            if (f.category)      params.category      = f.category;
            if (f.status)        params.status        = f.status;

            const res = await api.get('/proposals', { params });
            const raw  = res.data?.data?.data ?? res.data?.data ?? [];
            const meta = res.data?.data;
            setLastPage(meta?.last_page ?? 1);
            setPage(pg);

            setProposals(raw.map(p => ({ ...p, award: p.award ?? null })));
        } catch { error('Failed to load proposals.'); }
        setLoadingProps(false);
    }, []);

    useEffect(() => {
        if (!selectedYear) return;
        const t = setTimeout(() => loadProposals(selectedYear, filters, 1), 350);
        return () => clearTimeout(t);
    }, [filters, selectedYear]);

    const selectYear = (year) => {
        setSelectedYear(year);
        setFilters({ search: '', pi_search: '', member_search: '', college_id: '', category: '', status: '' });
        loadProposals(year, { search: '', pi_search: '', member_search: '', college_id: '', category: '', status: '' }, 1);
    };

    const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const clearFilters = () => setFilters({ search: '', pi_search: '', member_search: '', college_id: '', category: '', status: '' });
    const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

    // ─────────────────────────────────────────────────────────────────────────
    // YEAR OVERVIEW
    // ─────────────────────────────────────────────────────────────────────────

    if (!selectedYear) {
        return (
            <AppLayout breadcrumb="Completed Project Archive">
                <div className="max-w-6xl mx-auto space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Archive size={22} className="text-teal-600" /> Completed Project Archive
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Browse completed and archived research projects by academic year</p>
                        </div>
                    </div>

                    {loadingYears ? (
                        <div className="flex justify-center py-20">
                            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : yearSummaries.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                            <Archive size={40} className="mx-auto text-gray-200 mb-4" />
                            <h3 className="text-gray-500 font-medium mb-1">No completed projects yet</h3>
                            <p className="text-sm text-gray-400">Completed and archived proposals will appear here.</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary strip */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 text-center">
                                    <p className="text-2xl font-bold text-teal-600">{yearSummaries.length}</p>
                                    <p className="text-xs text-gray-500 mt-1">Academic Years</p>
                                </div>
                                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 text-center">
                                    <p className="text-2xl font-bold text-gray-900">{yearSummaries.reduce((s, y) => s + y.count, 0)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Total Projects</p>
                                </div>
                                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 text-center">
                                    <p className="text-2xl font-bold text-emerald-600">
                                        {formatCurrency(yearSummaries.reduce((s, y) => s + y.totalAwarded, 0))}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Total Awarded</p>
                                </div>
                            </div>

                            {/* Year cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {yearSummaries.map(y => (
                                    <YearCard
                                        key={y.year}
                                        year={y.year}
                                        count={y.count}
                                        totalAwarded={y.totalAwarded}
                                        onSelect={selectYear}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </AppLayout>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRILL-IN: projects for selected year
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <AppLayout breadcrumb={`Completed Archive / ${selectedYear}`}>
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedYear(null)}
                            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="h-10 w-10 bg-teal-50 rounded-xl flex items-center justify-center">
                            <Archive size={18} className="text-teal-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{selectedYear}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">Completed Project Archive</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ViewToggle view={view} onChange={setView} />
                        <button onClick={() => loadProposals(selectedYear, filters, 1)}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Filters panel */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Filter size={14} className="text-teal-500" />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</p>
                            {activeFilterCount > 0 && (
                                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">{activeFilterCount} active</span>
                            )}
                        </div>
                        {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium">
                                <X size={11} /> Clear all
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                        {/* Title search */}
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input value={filters.search} onChange={e => setFilter('search', e.target.value)}
                                placeholder="Search by title…"
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        </div>

                        {/* PI search */}
                        <div className="relative">
                            <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input value={filters.pi_search} onChange={e => setFilter('pi_search', e.target.value)}
                                placeholder="Search by PI name…"
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        </div>

                        {/* Team member search */}
                        <div className="relative">
                            <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input value={filters.member_search} onChange={e => setFilter('member_search', e.target.value)}
                                placeholder="Search by team member…"
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        </div>

                        {/* College */}
                        <div className="relative">
                            <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <select value={filters.college_id} onChange={e => setFilter('college_id', e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none">
                                <option value="">All Colleges</option>
                                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {/* Category */}
                        <div className="relative">
                            <BookOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <select value={filters.category} onChange={e => setFilter('category', e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none">
                                {categoryOptions().map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>

                        {/* Status */}
                        <div className="relative">
                            <Archive size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none">
                                <option value="">All Statuses</option>
                                <option value="completed">Completed</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results */}
                {loadingProps ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                        <Archive size={36} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-500 font-medium">No projects match the current filters.</p>
                        {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="mt-3 text-sm text-teal-600 hover:underline">Clear filters</button>
                        )}
                    </div>
                ) : view === 'table' ? (
                    <>
                        <ProposalTable
                            proposals={proposals}
                            showColumns={['tracker','title','pi','college','category','awarded_amount','status']}
                            actions={(p) => (
                                <Link href={`/proposals/${p.id}`}
                                    className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                                    View
                                </Link>
                            )}
                            emptyMessage="No projects found."
                        />
                        {lastPage > 1 && (
                            <div className="flex justify-center gap-2">
                                {Array.from({ length: lastPage }, (_, i) => i + 1).map(pg => (
                                    <button key={pg} onClick={() => loadProposals(selectedYear, filters, pg)}
                                        className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                                            pg === page ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}>{pg}</button>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {proposals.map(p => <ProjectRow key={p.id} proposal={p} />)}
                        </div>
                        {lastPage > 1 && (
                            <div className="flex justify-center gap-2">
                                {Array.from({ length: lastPage }, (_, i) => i + 1).map(pg => (
                                    <button key={pg} onClick={() => loadProposals(selectedYear, filters, pg)}
                                        className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                                            pg === page ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}>{pg}</button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
