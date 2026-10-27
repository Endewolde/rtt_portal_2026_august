import { getStatusLabel } from '../lib/utils';
import { currency } from '../lib/terms';

const CATEGORY_COLORS = {
    research:             'bg-blue-100 text-blue-700',
    community_engagement: 'bg-green-100 text-green-700',
    technology_transfer:  'bg-purple-100 text-purple-700',
    innovation:           'bg-orange-100 text-orange-700',
};

const STATUS_COLORS = {
    draft:               'bg-gray-100 text-gray-600 border-gray-200',
    submitted:           'bg-blue-50 text-blue-700 border-blue-200',
    validated:           'bg-indigo-50 text-indigo-700 border-indigo-200',
    under_blind_review:  'bg-yellow-50 text-yellow-700 border-yellow-200',
    blind_review_passed: 'bg-orange-50 text-orange-700 border-orange-200',
    under_open_defence:  'bg-purple-50 text-purple-700 border-purple-200',
    accepted:            'bg-green-50 text-green-700 border-green-200',
    funded:              'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected:            'bg-red-50 text-red-700 border-red-200',
};

const CONTRACT_STATUS_LABELS = {
    null:      'Not Submitted',
    pending:   'Pending Review',
    approved:  'Approved',
    rejected:  'Rejected',
};

const CONTRACT_STATUS_COLORS = {
    null:      'bg-gray-100 text-gray-600 border-gray-200',
    pending:   'bg-blue-50 text-blue-700 border-blue-200',
    approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected:  'bg-red-50 text-red-700 border-red-200',
};

function ContractStatusBadge({ status, submittedAt }) {
    const key = status ?? 'null';
    const daysPending = status === 'pending' && submittedAt
        ? Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000)
        : null;
    return (
        <div className="inline-flex flex-col items-start gap-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap ${CONTRACT_STATUS_COLORS[key]}`}>
                {CONTRACT_STATUS_LABELS[key]}
            </span>
            {daysPending !== null && (
                <span className={`text-[10px] font-medium ${daysPending > 7 ? 'text-red-500' : 'text-gray-400'}`}>
                    {daysPending === 0 ? 'today' : `${daysPending}d pending`}
                </span>
            )}
        </div>
    );
}

function SkeletonRow({ hasSelect = false }) {
    return (
        <tr>
            {hasSelect && (
                <td className="px-4 py-3 w-10">
                    <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                </td>
            )}
            <td className="px-4 py-3 w-10">
                <div className="h-3.5 w-5 bg-gray-200 rounded animate-pulse" />
            </td>
            {[...Array(5)].map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                </td>
            ))}
        </tr>
    );
}

export default function ProposalTable({
    proposals = [],
    showColumns = ['tracker', 'title', 'category', 'college', 'status', 'date'],
    actions = null,
    loading = false,
    emptyMessage = 'No proposals found.',
    emptyIcon = '📄',
    selectable = false,
    selectedIds = null,
    onToggle = null,
    onToggleAll = null,
}) {
    const allSelected = selectable && proposals.length > 0 && proposals.every(p => selectedIds?.has(p.id));
    const someSelected = selectable && proposals.some(p => selectedIds?.has(p.id));

    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} hasSelect={selectable} />)}</tbody>
                </table>
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <div className="text-4xl mb-3">{emptyIcon}</div>
                <p className="text-gray-500 font-medium text-sm">{emptyMessage}</p>
            </div>
        );
    }

    const col = (key) => showColumns.includes(key);

    const fmtDate = (d) => d
        ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

    const fmtCurrency = (n) =>
        n != null ? `${currency()} ${parseFloat(n).toLocaleString()}` : '—';

    // Secondary fields shown in the mobile card grid — tracker/grant_reference,
    // title and status get dedicated placement above this grid instead.
    const mobileFields = (p) => [
        col('category') && { label: 'Category', value: <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[p.category] ?? 'bg-gray-100 text-gray-700'}`}>{p.category?.replace(/_/g, ' ') ?? '—'}</span> },
        col('pi') && { label: 'PI', value: p.pi?.name ?? '—' },
        col('college') && { label: 'College', value: p.college?.name ?? '—' },
        col('date') && { label: 'Submitted', value: fmtDate(p.submitted_at) },
        col('deadline') && { label: 'Deadline', value: fmtDate(p.proposal_call?.end_date) },
        col('blind_score') && { label: 'Blind', value: <ScoreChip value={p.blind_score_raw ?? p.blind_score} max={p.blind_max ?? 100} /> },
        col('defence_score') && { label: 'Defence', value: <ScoreChip value={p.defence_score_raw ?? p.defence_score} max={p.defence_max ?? 100} /> },
        col('combined_score') && { label: 'Total', value: <ScoreChip value={p.combined_score} max={(p.blind_max ?? 0) + (p.defence_max ?? 0)} bold /> },
        col('awarded_amount') && { label: 'Awarded', value: <span className="font-semibold text-emerald-700">{fmtCurrency(p.award?.awarded_amount ?? p.awarded_amount)}</span> },
        col('reviewers') && { label: 'Reviews', value: p.review_assignments ? `${p.review_assignments.filter(a => a.status === 'submitted').length}/${p.review_assignments.length}` : '—' },
        col('defence_date') && { label: 'Defence Date', value: fmtDate(p.defence_session?.scheduled_date) },
        col('contract_status') && { label: 'Contract', value: <ContractStatusBadge status={p.contract_status} submittedAt={p.contract_submitted_at} /> },
        col('contract_submitted') && { label: 'Contract Submitted', value: fmtDate(p.contract_submitted_at) },
    ].filter(Boolean);

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Desktop / tablet table */}
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {selectable && (
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer"
                                        checked={allSelected}
                                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                        onChange={onToggleAll}
                                        aria-label="Select all"
                                    />
                                </th>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-10">#</th>
                            {col('tracker') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Tracker #</th>}
                            {col('grant_reference') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Grant Ref</th>}
                            {col('title') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>}
                            {col('category') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>}
                            {col('pi') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">PI</th>}
                            {col('college') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">College</th>}
                            {col('status') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>}
                            {col('date') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Submitted</th>}
                            {col('deadline') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Deadline</th>}
                            {col('blind_score') && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Blind</th>}
                            {col('defence_score') && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Defence</th>}
                            {col('combined_score') && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Total</th>}
                            {col('awarded_amount') && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Awarded</th>}
                            {col('reviewers') && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Reviews</th>}
                            {col('defence_date') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Defence Date</th>}
                            {col('contract_status') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Contract</th>}
                            {col('contract_submitted') && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Submitted</th>}
                            {actions && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {proposals.map((p, i) => (
                            <tr key={p.id} className={`transition-colors ${
                                selectedIds?.has(p.id) ? 'bg-green-50' : `hover:bg-blue-50/40 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`
                            }`}>
                                {selectable && (
                                    <td className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer"
                                            checked={!!selectedIds?.has(p.id)}
                                            onChange={() => onToggle?.(p.id)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </td>
                                )}
                                <td className="px-4 py-3 text-xs font-medium text-gray-400 tabular-nums w-10">
                                    {i + 1}
                                </td>
                                {col('tracker') && (
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <a href={`/proposals/${p.id}`}
                                            className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                                            {p.tracker_number ?? '—'}
                                        </a>
                                    </td>
                                )}
                                {col('grant_reference') && (
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                            {p.award?.grant_reference ?? '—'}
                                        </span>
                                    </td>
                                )}
                                {col('title') && (
                                    <td className="px-4 py-3 max-w-xs">
                                        <a href={`/proposals/${p.id}`}
                                            className="font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1 block">
                                            {p.title || 'Untitled'}
                                        </a>
                                    </td>
                                )}
                                {col('category') && (
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[p.category] ?? 'bg-gray-100 text-gray-700'}`}>
                                            {p.category?.replace(/_/g, ' ') ?? '—'}
                                        </span>
                                    </td>
                                )}
                                {col('pi') && (
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <p className="text-xs text-gray-700 font-medium">{p.pi?.name ?? '—'}</p>
                                    </td>
                                )}
                                {col('college') && (
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <p className="text-xs text-gray-600">{p.college?.name ?? '—'}</p>
                                    </td>
                                )}
                                {col('status') && (
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[p.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                            {p.status ? getStatusLabel(p.status) : '—'}
                                        </span>
                                    </td>
                                )}
                                {col('date') && (
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                        {fmtDate(p.submitted_at)}
                                    </td>
                                )}
                                {col('deadline') && (
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                        {fmtDate(p.proposal_call?.end_date)}
                                    </td>
                                )}
                                {col('blind_score') && (
                                    <td className="px-4 py-3 text-center">
                                        <ScoreChip value={p.blind_score_raw ?? p.blind_score} max={p.blind_max ?? 100} />
                                    </td>
                                )}
                                {col('defence_score') && (
                                    <td className="px-4 py-3 text-center">
                                        <ScoreChip value={p.defence_score_raw ?? p.defence_score} max={p.defence_max ?? 100} />
                                    </td>
                                )}
                                {col('combined_score') && (
                                    <td className="px-4 py-3 text-center">
                                        <ScoreChip value={p.combined_score} max={(p.blind_max ?? 0) + (p.defence_max ?? 0)} bold />
                                    </td>
                                )}
                                {col('awarded_amount') && (
                                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm font-semibold text-emerald-700">
                                        {fmtCurrency(p.award?.awarded_amount ?? p.awarded_amount)}
                                    </td>
                                )}
                                {col('reviewers') && (
                                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                                        {p.review_assignments
                                            ? `${p.review_assignments.filter(a => a.status === 'submitted').length}/${p.review_assignments.length}`
                                            : '—'}
                                    </td>
                                )}
                                {col('defence_date') && (
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                        {fmtDate(p.defence_session?.scheduled_date)}
                                    </td>
                                )}
                                {col('contract_status') && (
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <ContractStatusBadge status={p.contract_status} submittedAt={p.contract_submitted_at} />
                                    </td>
                                )}
                                {col('contract_submitted') && (
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                        {fmtDate(p.contract_submitted_at)}
                                    </td>
                                )}
                                {actions && (
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        {actions(p)}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile: stacked cards — no horizontal scrolling */}
            <div className="sm:hidden divide-y divide-gray-100">
                {proposals.map((p, i) => (
                    <div key={p.id} className="p-4">
                        {selectable && (
                            <label className="flex items-center gap-2 mb-2.5 text-xs text-gray-500">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer"
                                    checked={!!selectedIds?.has(p.id)}
                                    onChange={() => onToggle?.(p.id)}
                                />
                                Select
                            </label>
                        )}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-gray-100 px-1 text-[10px] font-bold tabular-nums text-gray-500">{i + 1}</span>
                                {col('tracker') && (
                                    <a href={`/proposals/${p.id}`}
                                        className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                                        {p.tracker_number ?? '—'}
                                    </a>
                                )}
                                {col('grant_reference') && (
                                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                        {p.award?.grant_reference ?? '—'}
                                    </span>
                                )}
                            </div>
                            {col('status') && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${STATUS_COLORS[p.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                    {p.status ? getStatusLabel(p.status) : '—'}
                                </span>
                            )}
                        </div>
                        {col('title') && (
                            <a href={`/proposals/${p.id}`}
                                className="font-medium text-gray-900 text-sm leading-snug hover:text-blue-600 transition-colors block mb-2.5">
                                {p.title || 'Untitled'}
                            </a>
                        )}
                        {mobileFields(p).length > 0 && (
                            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs mb-2.5">
                                {mobileFields(p).map(f => (
                                    <p key={f.label}><span className="text-gray-400">{f.label}:</span> <span className="text-gray-600">{f.value}</span></p>
                                ))}
                            </div>
                        )}
                        {actions && (
                            <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                                {actions(p)}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
            </div>
        </div>
    );
}

function ScoreChip({ value, max, bold }) {
    if (value == null) return <span className="text-gray-300">—</span>;
    const pct = max > 0 ? (value / max) * 100 : 0;
    const color = pct >= 60 ? 'text-green-600' : 'text-red-500';
    return (
        <span className={`text-xs ${bold ? 'text-sm font-bold' : 'font-semibold'} tabular-nums ${color}`}>
            {value}
            {max != null && <span className="text-gray-400 font-normal"> / {max}</span>}
        </span>
    );
}
