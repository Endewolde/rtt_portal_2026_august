import { useState, useEffect, useCallback, useMemo } from 'react';
import { ListChecks, CheckCircle2, Clock, XCircle, UserX, Trophy, Building2, EyeOff, Presentation, RotateCcw } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import InsightsNav from '../../Components/InsightsNav';
import { PageHeader, Select, RefreshButton, StatCard, Panel, EmptyState, StatSkeletons, Skeleton } from '../../Components/Insights/Kit';
import { get } from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';
import { term } from '../../lib/terms';
import { programmeKeys } from '../../lib/programmes';


const PHASE_TABS = [
    { key: 'both', label: 'Both phases' },
    { key: 'blind_review', label: 'Blind review' },
    { key: 'open_defence', label: 'Open defence' },
];

const LEGEND_ITEMS = [
    { icon: CheckCircle2, dot: 'bg-emerald-500', label: 'Reviewed', hint: 'Reviewer decided and the proposal passed this phase' },
    { icon: XCircle, dot: 'bg-rose-500', label: 'Rejected', hint: 'Reviewer decided and the proposal was rejected at this phase' },
    { icon: Clock, dot: 'bg-amber-400', label: 'On review', hint: 'A reviewer is assigned but hasn’t submitted a decision yet' },
    { icon: UserX, dot: 'bg-gray-300', label: 'Waiting for assignment', hint: 'No reviewer has been assigned to this proposal yet' },
];

// null completion_pct only happens when no proposal of the college has reached
// this phase — nothing to report on, not "behind".
function pctTone(pct) {
    if (pct == null) return 'text-gray-300';
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-rose-600';
}

// Completion is against the proposals that reached the phase — validated ones for
// blind review, ones that passed blind review for open defence. One still waiting
// on a reviewer assignment counts against the phase like one awaiting a decision,
// so it shows as its own "unassigned" segment rather than being left out.
function PhaseBar({ phase }) {
    if (!phase || phase.total === 0) {
        return <p className="text-xs italic text-gray-400">No proposals at this phase</p>;
    }

    const pct = (n) => (n / phase.total) * 100;

    return (
        <div className="min-w-44 space-y-1.5">
            <div className="flex items-baseline justify-between">
                <span className={`text-lg font-extrabold tabular-nums ${pctTone(phase.completion_pct)}`}>{phase.completion_pct}%</span>
                <span className="text-[11px] text-gray-400">of {phase.total}</span>
            </div>
            <div className="flex h-2 gap-px overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-emerald-500" style={{ width: `${pct(phase.reviewed)}%` }} title={`${phase.reviewed} reviewed`} />
                <div className="h-full bg-rose-500" style={{ width: `${pct(phase.rejected)}%` }} title={`${phase.rejected} rejected`} />
                <div className="h-full bg-amber-400" style={{ width: `${pct(phase.pending)}%` }} title={`${phase.pending} on review`} />
                <div className="h-full bg-gray-300" style={{ width: `${pct(phase.unassigned)}%` }} title={`${phase.unassigned} waiting for assignment`} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-1" title="Reviewed"><CheckCircle2 size={11} className="text-emerald-500" /> {phase.reviewed}</span>
                <span className="flex items-center gap-1" title="Rejected"><XCircle size={11} className="text-rose-500" /> {phase.rejected}</span>
                <span className="flex items-center gap-1" title="On review"><Clock size={11} className="text-amber-500" /> {phase.pending}</span>
                <span className="flex items-center gap-1" title="Waiting for assignment"><UserX size={11} className="text-gray-400" /> {phase.unassigned}</span>
            </div>
        </div>
    );
}

/** Share of proposals across all shown colleges that have a decision at this phase. */
function overall(colleges, key) {
    const totals = colleges.reduce((acc, c) => {
        const p = c.phases?.[key];
        if (!p) return acc;
        return { total: acc.total + p.total, decided: acc.decided + p.reviewed + p.rejected };
    }, { total: 0, decided: 0 });
    return totals.total > 0 ? Math.round((totals.decided / totals.total) * 100) : null;
}

export default function CollegePhaseCompletion() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState(null);
    const [collegeOptions, setCollegeOptions] = useState([]);

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
            .then((r) => {
                setData(r.data ?? null);
                // The college list comes from an unfiltered load, so choosing a college never removes the others from the menu.
                if (!collegeId) setCollegeOptions((r.data?.colleges ?? []).map((c) => ({ id: c.college_id, name: c.college_name })));
            })
            .catch(() => {})
            .finally(() => { setLoading(false); setRefreshing(false); });
    }, [academicYear, collegeId, category]);

    useEffect(() => { load(); }, [load]);

    const colleges = data?.colleges ?? [];
    const showBlind = phaseTab === 'both' || phaseTab === 'blind_review';
    const showDefence = phaseTab === 'both' || phaseTab === 'open_defence';
    const filtered = !!(collegeId || category);

    const fullyDoneCount = (key) => colleges.filter((c) => (c.phases?.[key]?.completion_pct ?? null) === 100).length;

    // A college counts as "fully done" for the current view once every phase shown is at 100%.
    const isFullyDone = (c) => {
        const checks = [];
        if (showBlind) checks.push(c.phases?.blind_review?.completion_pct ?? null);
        if (showDefence) checks.push(c.phases?.open_defence?.completion_pct ?? null);
        return checks.length > 0 && checks.every((pct) => pct === 100);
    };

    const sortedColleges = useMemo(() => {
        const relevantPct = (c) => {
            const pcts = [];
            if (showBlind) pcts.push(c.phases?.blind_review?.completion_pct);
            if (showDefence) pcts.push(c.phases?.open_defence?.completion_pct);
            const known = pcts.filter((p) => p != null);
            return known.length > 0 ? Math.min(...known) : -1;
        };
        return [...colleges].sort((a, b) => relevantPct(b) - relevantPct(a));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colleges, phaseTab]);

    const blindOverall = overall(colleges, 'blind_review');
    const defenceOverall = overall(colleges, 'open_defence');

    return (
        <AppLayout breadcrumb="College Phase Completion">
            <InsightsNav />
            <div className="mx-auto max-w-7xl space-y-6">
                <PageHeader icon={ListChecks} color="emerald" title="College Phase Completion"
                    description={`Blind review and open defence progress per college · ${data?.academic_year ?? 'selected'} academic year`}>
                    <Select label={term('academic_year')} value={academicYear} onChange={setAcademicYear}>
                        <option value="">{data?.academic_year ? `Current (${data.academic_year})` : `All ${term('academic_year', { plural: true, lower: true })}`}</option>
                        {(data?.academic_years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
                    </Select>
                    <RefreshButton onClick={() => load({ silent: true })} loading={refreshing} />
                </PageHeader>

                {loading && !data ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={EyeOff} color="indigo" label="Blind review decided" value={blindOverall != null ? `${blindOverall}%` : '—'} hint="Across the colleges shown" />
                        <StatCard icon={Trophy} color="emerald" label="Colleges done with blind review" value={`${fullyDoneCount('blind_review')} / ${colleges.length}`} hint="At 100%" />
                        <StatCard icon={Presentation} color="violet" label="Open defence decided" value={defenceOverall != null ? `${defenceOverall}%` : '—'} hint="Across the colleges shown" />
                        <StatCard icon={Trophy} color="amber" label="Colleges done with defence" value={`${fullyDoneCount('open_defence')} / ${colleges.length}`} hint="At 100%" />
                    </div>
                )}

                <Panel bodyClassName="">
                    {/* Toolbar */}
                    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="inline-flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
                            {PHASE_TABS.map((tab) => (
                                <button key={tab.key} onClick={() => setPhaseTab(tab.key)}
                                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${phaseTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                            {collegeOptions.length > 1 && (
                                <Select label={term('college')} value={collegeId} onChange={setCollegeId}>
                                    <option value="">All {term('college', { plural: true, lower: true })}</option>
                                    {collegeOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            )}
                            <Select label="Category" value={category} onChange={setCategory}>
                                <option value="">All categories</option>
                                {programmeKeys().map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                            </Select>
                            {filtered && (
                                <button onClick={() => { setCollegeId(''); setCategory(''); }}
                                    className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800">
                                    <RotateCcw size={13} /> Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-gray-100 bg-gray-50/60 px-5 py-2.5 text-xs">
                        {LEGEND_ITEMS.map(({ dot, label, hint }) => (
                            <span key={label} className="flex items-center gap-1.5" title={hint}>
                                <span className={`h-2 w-2 rounded-full ${dot}`} />
                                <span className="font-medium text-gray-700">{label}</span>
                            </span>
                        ))}
                        <span className="text-gray-400 lg:ml-auto">Blind review counts validated proposals · open defence counts those that passed blind review</span>
                    </div>

                    {loading ? (
                        <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
                    ) : colleges.length === 0 ? (
                        <EmptyState icon={Building2} title="No colleges match these filters" />
                    ) : (
                        <div className={`overflow-x-auto transition ${refreshing ? 'opacity-60' : ''}`}>
                            <table className="w-full min-w-160 text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-500"><th className="px-5 py-2.5 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                        <th className="px-5 py-2.5 text-left">{term('college')}</th>
                                        <th className="px-4 py-2.5 text-right">Proposals</th>
                                        {showBlind && <th className="px-4 py-2.5 text-left">Blind review</th>}
                                        {showDefence && <th className="px-4 py-2.5 text-left">Open defence</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedColleges.map((c, rowIdx) => {
                                        const done = isFullyDone(c);
                                        return (
                                            <tr key={c.college_id} className={done ? 'bg-emerald-50/50' : 'hover:bg-gray-50/60'}><td className="px-5 py-4 w-10 text-xs font-medium tabular-nums text-gray-400">{rowIdx + 1}</td>
                                                <td className="whitespace-nowrap px-5 py-4 align-top">
                                                    <span className="flex items-center gap-2 font-semibold text-gray-900">
                                                        {done
                                                            ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Trophy size={12} /></span>
                                                            : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Building2 size={12} /></span>}
                                                        {c.college_name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right align-top tabular-nums text-gray-500">{c.total_proposals}</td>
                                                {showBlind && <td className="px-4 py-4 align-top"><PhaseBar phase={c.phases?.blind_review} /></td>}
                                                {showDefence && <td className="px-4 py-4 align-top"><PhaseBar phase={c.phases?.open_defence} /></td>}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>
        </AppLayout>
    );
}
