import { useState, useEffect, useCallback, useMemo } from 'react';
import { ListChecks, RefreshCw, CheckCircle2, Clock, XCircle, UserX, Trophy } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import FilterBar from '../../Components/FilterBar';
import { get } from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';

const CATEGORY_OPTIONS = ['research', 'community_engagement', 'technology_transfer'];

const PHASE_TABS = [
    { key: 'both', label: 'Both Phases' },
    { key: 'blind_review', label: 'Blind Review' },
    { key: 'open_defence', label: 'Open Defence' },
];

const LEGEND_ITEMS = [
    { icon: CheckCircle2, color: 'text-emerald-500', label: 'Reviewed', hint: 'Reviewer decided and the proposal passed this phase' },
    { icon: XCircle, color: 'text-rose-500', label: 'Rejected', hint: 'Reviewer decided and the proposal was rejected at this phase' },
    { icon: Clock, color: 'text-amber-500', label: 'On Review', hint: 'A reviewer is assigned but hasn’t submitted a decision yet' },
    { icon: UserX, color: 'text-gray-400', label: 'Waiting for Assignment', hint: 'No reviewer has been assigned to this proposal yet' },
];

function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
            {LEGEND_ITEMS.map(({ icon: Icon, color, label, hint }) => (
                <span key={label} className="flex items-center gap-1.5" title={hint}>
                    <Icon size={13} className={color} />
                    <span className="font-semibold text-gray-700">{label}</span>
                    <span className="text-gray-400 hidden sm:inline">— {hint}</span>
                </span>
            ))}
        </div>
    );
}

// null completion_pct only happens when the college has zero submitted
// proposals for this phase's scope — nothing to report on, not "behind".
function phaseStatusColor(pct) {
    if (pct == null) return 'text-gray-300';
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-rose-600';
}

// Completion is against the college's FULL submitted-proposal count, not just
// the subset a reviewer has been assigned to — a proposal still waiting on a
// reviewer assignment counts against the phase exactly like one still awaiting
// a decision, so it shows as its own "unassigned" segment rather than being
// left out of the bar entirely.
function PhaseBar({ phase }) {
    if (!phase || phase.total === 0) {
        return <p className="text-xs text-gray-400 italic">No proposals submitted</p>;
    }

    const pct = (n) => (n / phase.total) * 100;

    return (
        <div className="space-y-1.5 min-w-42.5">
            <div className="flex items-center justify-between">
                <span className={`text-lg font-extrabold tabular-nums ${phaseStatusColor(phase.completion_pct)}`}>
                    {phase.completion_pct}%
                </span>
                <span className="text-[11px] text-gray-400">of {phase.total}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${pct(phase.reviewed)}%` }} title={`${phase.reviewed} Reviewed`} />
                <div className="bg-rose-500 h-full" style={{ width: `${pct(phase.rejected)}%` }} title={`${phase.rejected} Rejected`} />
                <div className="bg-amber-400 h-full" style={{ width: `${pct(phase.pending)}%` }} title={`${phase.pending} On Review`} />
                <div className="bg-gray-300 h-full" style={{ width: `${pct(phase.unassigned)}%` }} title={`${phase.unassigned} Waiting for Assignment`} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-1" title="Reviewed"><CheckCircle2 size={11} className="text-emerald-500" /> {phase.reviewed}</span>
                <span className="flex items-center gap-1" title="Rejected"><XCircle size={11} className="text-rose-500" /> {phase.rejected}</span>
                <span className="flex items-center gap-1" title="On Review"><Clock size={11} className="text-amber-500" /> {phase.pending}</span>
                <span className="flex items-center gap-1" title="Waiting for Assignment"><UserX size={11} className="text-gray-400" /> {phase.unassigned}</span>
            </div>
        </div>
    );
}

export default function CollegePhaseCompletion() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState(null);

    const [academicYear, setAcademicYear] = useState('');
    const [collegeId, setCollegeId] = useState('');
    const [category, setCategory] = useState('');
    const [phaseTab, setPhaseTab] = useState('both');

    const load = useCallback((opts = {}) => {
        opts.silent ? setRefreshing(true) : setLoading(true);

        return get('/college-phase-completion', {
            academic_year: academicYear || undefined,
            college_id: collegeId || undefined,
            category: category || undefined,
        })
            .then(r => setData(r.data ?? null))
            .catch(() => {})
            .finally(() => { setLoading(false); setRefreshing(false); });
    }, [academicYear, collegeId, category]);

    useEffect(() => { load(); }, [load]);

    const colleges = data?.colleges ?? [];
    const activeFilterCount = [collegeId, category].filter(Boolean).length;

    const showBlind = phaseTab === 'both' || phaseTab === 'blind_review';
    const showDefence = phaseTab === 'both' || phaseTab === 'open_defence';

    const fullyDoneCount = (phaseKey) => colleges.filter(c => (c.phases?.[phaseKey]?.completion_pct ?? null) === 100).length;

    // A college counts as "fully done" for the current view once every phase
    // shown is at 100% — used to surface finished colleges at the top of the
    // table and badge them, rather than leaving that to be spotted row-by-row.
    const isFullyDone = (c) => {
        const checks = [];
        if (showBlind) checks.push(c.phases?.blind_review?.completion_pct ?? null);
        if (showDefence) checks.push(c.phases?.open_defence?.completion_pct ?? null);

        return checks.length > 0 && checks.every(pct => pct === 100);
    };

    const sortedColleges = useMemo(() => {
        const relevantPct = (c) => {
            const pcts = [];
            if (showBlind) pcts.push(c.phases?.blind_review?.completion_pct);
            if (showDefence) pcts.push(c.phases?.open_defence?.completion_pct);
            const known = pcts.filter(p => p != null);

            return known.length > 0 ? Math.min(...known) : -1;
        };

        return [...colleges].sort((a, b) => relevantPct(b) - relevantPct(a));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colleges, phaseTab]);

    return (
        <AppLayout breadcrumb="College Phase Completion">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-emerald-900 px-6 py-7 text-white">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                <ListChecks size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">College Phase Completion</h1>
                                <p className="text-sm text-slate-300 mt-0.5">
                                    Blind review &amp; open defence progress per college for {data?.academic_year ?? 'the selected'} academic year
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            <select
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                                className="text-sm bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-gray-900"
                            >
                                <option value="">{data?.academic_year ? `Current: ${data.academic_year}` : 'All Years'}</option>
                                {(data?.academic_years ?? []).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => load({ silent: true })}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 disabled:opacity-60 transition-colors"
                            >
                                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                {refreshing ? 'Refreshing…' : 'Refresh'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-2xl font-extrabold text-emerald-700 tabular-nums">{fullyDoneCount('blind_review')} / {colleges.length}</p>
                        <p className="text-xs font-semibold text-emerald-700/80 mt-0.5">Colleges at 100% Blind Review</p>
                    </div>
                    <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-2xl font-extrabold text-emerald-700 tabular-nums">{fullyDoneCount('open_defence')} / {colleges.length}</p>
                        <p className="text-xs font-semibold text-emerald-700/80 mt-0.5">Colleges at 100% Open Defence</p>
                    </div>
                </div>

                {/* Phase tabs + filters */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
                        {PHASE_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setPhaseTab(tab.key)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    phaseTab === tab.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <FilterBar accent="indigo" activeCount={activeFilterCount}>
                        {(data?.colleges?.length ?? 0) > 1 && (
                            <select
                                value={collegeId}
                                onChange={e => setCollegeId(e.target.value)}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            >
                                <option value="">All Colleges</option>
                                {data.colleges.map(c => <option key={c.college_id} value={c.college_id}>{c.college_name}</option>)}
                            </select>
                        )}
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                            <option value="">All Categories</option>
                            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                        </select>
                    </FilterBar>
                </div>

                <Legend />

                {/* Table */}
                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : colleges.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <ListChecks size={32} className="mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium text-sm">No colleges match these filters.</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">College</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                                        {showBlind && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Blind Review</th>}
                                        {showDefence && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Open Defence</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedColleges.map((c, i) => {
                                        const done = isFullyDone(c);
                                        return (
                                            <tr key={c.college_id} className={done ? 'bg-emerald-50/60' : i % 2 === 0 ? '' : 'bg-gray-50/40'}>
                                                <td className="px-4 py-4 font-semibold text-gray-900 whitespace-nowrap align-top">
                                                    <span className="flex items-center gap-1.5">
                                                        {done && <Trophy size={13} className="text-emerald-500 shrink-0" />}
                                                        {c.college_name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-gray-500 tabular-nums align-top">{c.total_proposals}</td>
                                                {showBlind && <td className="px-4 py-4 align-top"><PhaseBar phase={c.phases?.blind_review} /></td>}
                                                {showDefence && <td className="px-4 py-4 align-top"><PhaseBar phase={c.phases?.open_defence} /></td>}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                            {colleges.length} college{colleges.length !== 1 ? 's' : ''} · completion is against every submitted proposal — one still waiting on a reviewer assignment counts against it, same as one still awaiting a decision
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
