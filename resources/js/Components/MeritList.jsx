import { Fragment, useEffect, useState } from 'react';
import { Trophy, Wallet, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { get } from '../lib/api';
import { formatCurrency } from '../lib/utils';

function BudgetBar({ call, fittingRequested }) {
    if (call.budget === null) {
        return (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <Info size={13} className="text-gray-400" /> No funding budget set for this call — add one in Proposal Calls to see where the money runs out.
            </p>
        );
    }
    const pct = (v) => `${Math.min(100, Math.max(0, (v / Math.max(call.budget, 1)) * 100))}%`;
    return (
        <div>
            <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
                <div style={{ width: pct(call.committed), background: '#059669' }} title={`Already awarded: ${formatCurrency(call.committed)}`} />
                <div style={{ width: pct(fittingRequested) }} className="border-l-2 border-white bg-indigo-400" title={`Requested by proposals that fit: ${formatCurrency(fittingRequested)}`} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Awarded {formatCurrency(call.committed)}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" /> Fits on this list {formatCurrency(fittingRequested)}</span>
                <span>Remaining {formatCurrency(call.remaining)} of {formatCurrency(call.budget)}</span>
            </div>
        </div>
    );
}

/**
 * Central Evaluation merit list: proposals awaiting the decision, ranked by combined score
 * per call, with the line where the call's remaining budget runs out.
 */
export default function MeritList({ onApprove, refreshKey }) {
    const [calls, setCalls] = useState(null);

    useEffect(() => {
        get('/central-evaluation/merit-list').then((r) => setCalls(r.data ?? [])).catch(() => setCalls([]));
    }, [refreshKey]);

    if (!calls) return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />;
    if (calls.length === 0) return <div className="rounded-2xl border border-gray-200 bg-white p-14 text-center text-sm text-gray-400">No proposals are awaiting a funding decision.</div>;

    return (
        <div className="space-y-5">
            {calls.map(({ call, proposals, fitting }) => {
                const fittingRequested = proposals.filter((p) => p.fits).reduce((sum, p) => sum + p.requested, 0);
                const cutoff = proposals.findIndex((p) => !p.fits);
                return (
                    <section key={call.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <header className="space-y-3 border-b border-gray-100 px-4 py-4 sm:px-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Trophy size={16} /></span>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900">{call.title}</h3>
                                        <p className="text-xs text-gray-500">{call.academic_year} · {proposals.length} awaiting decision{call.budget !== null ? ` · ${fitting} fit the remaining budget` : ''}</p>
                                    </div>
                                </div>
                                {call.budget !== null && (
                                    <span className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700"><Wallet size={13} /> {formatCurrency(call.remaining)} left</span>
                                )}
                            </div>
                            <BudgetBar call={call} fittingRequested={fittingRequested} />
                        </header>
                        {/* Phones: one card per proposal, the budget line between them */}
                        <ol className="divide-y divide-gray-100 sm:hidden">
                            {proposals.map((p, i) => (
                                <Fragment key={p.id}>
                                    {i === cutoff && (
                                        <li className="bg-rose-50 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                                            <AlertTriangle size={11} className="mr-1 inline" /> Remaining budget runs out here
                                        </li>
                                    )}
                                    <li className={`px-4 py-3.5 ${p.fits ? '' : 'bg-gray-50/60'}`}>
                                        <div className="flex items-start gap-3">
                                            <span className="mt-0.5 shrink-0 text-sm font-bold tabular-nums text-gray-900">#{p.rank}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-mono text-[11px] text-gray-500">{p.tracker_number}</p>
                                                <p className="line-clamp-2 text-sm font-medium text-gray-900">{p.title}</p>
                                                <p className="truncate text-xs text-gray-500">{[p.pi, p.college].filter(Boolean).join(' · ')}</p>
                                            </div>
                                            <span className="shrink-0 text-sm tabular-nums"><span className="font-semibold text-gray-900">{p.combined_score ?? '—'}</span><span className="text-gray-400">/{p.combined_max}</span></span>
                                        </div>
                                        <dl className="mt-2.5 grid grid-cols-2 gap-2 pl-8 text-xs">
                                            <div><dt className="text-gray-400">Requested</dt><dd className="font-medium tabular-nums text-gray-800">{formatCurrency(p.requested)}</dd></div>
                                            <div><dt className="text-gray-400">Running total</dt><dd className="font-medium tabular-nums text-gray-800">{formatCurrency(p.cumulative)}</dd></div>
                                        </dl>
                                        <div className="mt-2.5 flex items-center justify-between gap-2 pl-8">
                                            {p.fits
                                                ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={12} /> Fits the budget</span>
                                                : <span className="text-[11px] font-semibold text-rose-600">Over budget</span>}
                                            <button onClick={() => onApprove(p.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Approve…</button>
                                        </div>
                                    </li>
                                </Fragment>
                            ))}
                        </ol>

                        <div className="hidden overflow-x-auto sm:block">
                            <table className="w-full min-w-170 text-sm">
                                <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2.5">Rank</th>
                                        <th className="px-3 py-2.5">Proposal</th>
                                        <th className="px-3 py-2.5 text-right">Score</th>
                                        <th className="px-3 py-2.5 text-right">Requested</th>
                                        <th className="px-3 py-2.5 text-right">Running total</th>
                                        <th className="px-4 py-2.5 text-right">Decision</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {proposals.map((p, i) => (
                                        <Fragment key={p.id}>
                                            {i === cutoff && (
                                                <tr>
                                                    <td colSpan={6} className="bg-rose-50 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                                                        <AlertTriangle size={11} className="mr-1 inline" /> Remaining budget runs out here
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className={`border-t border-gray-100 ${p.fits ? '' : 'bg-gray-50/60 text-gray-500'}`}>
                                                <td className="px-4 py-3 font-bold tabular-nums text-gray-900">#{p.rank}</td>
                                                <td className="px-3 py-3">
                                                    <p className="font-mono text-[11px] text-gray-500">{p.tracker_number}</p>
                                                    <p className="line-clamp-1 font-medium text-gray-900">{p.title}</p>
                                                    <p className="text-xs text-gray-500">{[p.pi, p.college].filter(Boolean).join(' · ')}</p>
                                                </td>
                                                <td className="px-3 py-3 text-right tabular-nums"><span className="font-semibold text-gray-900">{p.combined_score ?? '—'}</span><span className="text-gray-400">/{p.combined_max}</span></td>
                                                <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(p.requested)}</td>
                                                <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(p.cumulative)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {p.fits
                                                            ? <span className="hidden items-center gap-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex"><CheckCircle2 size={12} /> Fits</span>
                                                            : <span className="hidden text-[11px] font-semibold text-rose-600 sm:inline">Over budget</span>}
                                                        <button onClick={() => onApprove(p.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Approve…</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
