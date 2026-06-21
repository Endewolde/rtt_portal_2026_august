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
        n != null ? `ETB ${parseFloat(n).toLocaleString()}` : '—';

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
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
                                            {p.status?.replace(/_/g, ' ') ?? '—'}
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
