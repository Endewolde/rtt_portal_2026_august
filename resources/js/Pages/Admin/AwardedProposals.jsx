import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { Trophy, RefreshCw, Calendar } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatDate, formatCurrency, getCategoryLabel } from '../../lib/utils';

const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];

export default function AwardedProposals() {
    const { error } = useToast();
    const [view, setView]               = useViewPreference('awarded_proposals', 'card');
    const [proposals, setProposals]     = useState([]);
    const [loading, setLoading]         = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [yearFilter, setYearFilter]   = useState('all');

    const load = async () => {
        setLoading(true);
        try {
            const results = await Promise.all(
                FUNDED_STATUSES.map(s =>
                    api.get('/proposals', { params: { status: s, per_page: 200 } })
                        .then(r => r.data?.data?.data ?? r.data?.data ?? [])
                        .catch(() => [])
                )
            );
            const all = results.flat();
            const withAwards = await Promise.all(
                all.map(async p => {
                    try {
                        const r = await api.get(`/proposals/${p.id}/award`);
                        return { ...p, award: r.data?.data ?? null };
                    } catch { return { ...p, award: null }; }
                })
            );
            setProposals(withAwards);
        } catch { error('Failed to load awarded proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const academicYears = ['all', ...Array.from(new Set(proposals.map(p => p.academic_year).filter(Boolean))).sort().reverse()];

    const visible = proposals.filter(p =>
        (statusFilter === 'all' || p.status === statusFilter) &&
        (yearFilter === 'all' || p.academic_year === yearFilter)
    );

    // Summary per academic year for the year selector
    const yearSummary = (year) => {
        const group = year === 'all' ? proposals : proposals.filter(p => p.academic_year === year);
        return {
            count: group.length,
            total: group.reduce((s, p) => s + parseFloat(p.award?.awarded_amount ?? 0), 0),
        };
    };

    return (
        <AppLayout breadcrumb="Awarded Proposals">
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Page header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Trophy size={22} className="text-amber-500" /> Awarded Proposals
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">All proposals that have been funded or are in post-award phases</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ViewToggle view={view} onChange={setView} />
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Academic year selector */}
                {!loading && (
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar size={14} className="text-amber-500" />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Academic Year</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {academicYears.map(y => {
                                const s = yearSummary(y);
                                const active = yearFilter === y;
                                return (
                                    <button key={y} onClick={() => setYearFilter(y)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                            active
                                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700'
                                        }`}>
                                        <span>{y === 'all' ? 'All Years' : y}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${
                                            active ? 'bg-amber-400/50 text-white' : 'bg-gray-100 text-gray-500'
                                        }`}>{s.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {yearFilter !== 'all' && (
                            <p className="text-xs text-gray-400 mt-2">
                                {yearSummary(yearFilter).count} proposals · Total awarded:{' '}
                                <span className="font-semibold text-emerald-600">{formatCurrency(yearSummary(yearFilter).total)}</span>
                            </p>
                        )}
                    </div>
                )}

                {/* Status filter tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[['all', 'All'], ...FUNDED_STATUSES.map(s => [s, s.replace('_', ' ')])].map(([val, label]) => {
                        const cnt = val === 'all'
                            ? proposals.filter(p => yearFilter === 'all' || p.academic_year === yearFilter).length
                            : proposals.filter(p => p.status === val && (yearFilter === 'all' || p.academic_year === yearFilter)).length;
                        return (
                            <button key={val} onClick={() => setStatusFilter(val)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap capitalize transition-colors ${
                                    statusFilter === val
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}>
                                {label} ({cnt})
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <Trophy size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No proposals found for the selected filters.</p>
                    </div>
                ) : view === 'table' ? (
                    <ProposalTable
                        proposals={visible}
                        showColumns={['grant_reference','tracker','title','pi','college','category','awarded_amount','status']}
                        actions={(p) => (
                            <a href={`/proposals/${p.id}/award`}
                                className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                                Award Details
                            </a>
                        )}
                        emptyMessage="No awarded proposals found."
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {visible.map(p => (
                            <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    {p.award?.grant_reference ? (
                                        <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                                            <Trophy size={11} /> {p.award.grant_reference}
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                                            No grant reference
                                        </div>
                                    )}
                                    <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg font-medium shrink-0">
                                        {p.academic_year}
                                    </span>
                                </div>

                                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2">{p.title}</h3>

                                <div className="flex items-center gap-2 mb-3">
                                    <StatusBadge status={p.status} />
                                    <span className="text-xs text-gray-400">{getCategoryLabel(p.category)}</span>
                                </div>

                                <div className="text-xs text-gray-500 mb-3">
                                    <p>{p.pi?.name} · {p.college?.name}</p>
                                    {p.award?.approved_at && (
                                        <p className="mt-0.5">Awarded {formatDate(p.award.approved_at)}</p>
                                    )}
                                </div>

                                {p.award && (
                                    <div className="text-lg font-bold text-emerald-700 mb-3">
                                        {formatCurrency(p.award.awarded_amount)}
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                                    <Link href={`/proposals/${p.id}`} className="text-xs text-blue-600 hover:underline">View Proposal</Link>
                                    {p.award && (
                                        <Link href={`/proposals/${p.id}/award`} className="text-xs text-emerald-600 hover:underline">Award Details</Link>
                                    )}
                                    <Link href={`/budget-requests?proposal_id=${p.id}`} className="text-xs text-gray-500 hover:underline">Budget Requests</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
