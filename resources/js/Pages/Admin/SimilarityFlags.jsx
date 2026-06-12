import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ViewToggle from '../../Components/ViewToggle';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';

function ScoreBar({ score }) {
    const pct = Math.round(score * 100);
    const color = pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-orange-400' : 'bg-yellow-400';
    return (
        <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-bold tabular-nums ${pct >= 80 ? 'text-red-600' : pct >= 60 ? 'text-orange-600' : 'text-yellow-600'}`}>
                {pct}%
            </span>
        </div>
    );
}

export default function SimilarityFlags() {
    const [flags, setFlags]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [search, setSearch]     = useState('');
    const [view, setView]         = useViewPreference('similarity_flags', 'table');

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/similarity-scores', { params: { flagged_only: flaggedOnly ? 1 : 0 } });
            const raw = res.data?.data?.data ?? res.data?.data ?? [];
            setFlags(Array.isArray(raw) ? raw : []);
        } catch {
            setFlags([]);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, [flaggedOnly]);

    const visible = search
        ? flags.filter(f =>
            f.proposal?.title?.toLowerCase().includes(search.toLowerCase()) ||
            f.proposal?.tracker_number?.toLowerCase().includes(search.toLowerCase())
        )
        : flags;

    return (
        <AppLayout breadcrumb="Similarity Flags">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={22} className="text-orange-500" />
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Similarity Flags</h1>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Proposals with high similarity to existing submissions
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ViewToggle view={view} onChange={setView} />
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search proposals…"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-400" />
                        <span className="text-sm text-gray-700">Flagged only</span>
                    </label>
                    <span className="text-sm text-gray-400">{visible.length} result{visible.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <AlertTriangle size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No similarity flags found</p>
                        <p className="text-sm text-gray-400 mt-1">Similarity checks run automatically when proposals are submitted.</p>
                    </div>
                ) : view === 'table' ? (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        {['Proposal', 'Title', 'Similar To', 'Score', 'Flagged', 'Checked', 'Actions'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visible.map((f, i) => (
                                        <tr key={f.id} className={`hover:bg-orange-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <a href={`/proposals/${f.proposal_id}`}
                                                    className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">
                                                    {f.proposal?.tracker_number ?? '—'}
                                                </a>
                                            </td>
                                            <td className="px-4 py-3 max-w-xs">
                                                <p className="text-sm text-gray-900 line-clamp-1">{f.proposal?.title ?? '—'}</p>
                                                <p className="text-xs text-gray-400">{f.proposal?.college?.name}</p>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <a href={`/proposals/${f.similar_proposal_id}`}
                                                    className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100">
                                                    {f.similar_proposal?.tracker_number ?? '—'}
                                                </a>
                                                <p className="text-xs text-gray-400 mt-0.5">{f.similar_proposal?.title?.slice(0, 40)}{(f.similar_proposal?.title?.length ?? 0) > 40 ? '…' : ''}</p>
                                            </td>
                                            <td className="px-4 py-3"><ScoreBar score={f.score} /></td>
                                            <td className="px-4 py-3">
                                                {f.flagged ? (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold border border-red-200">Flagged</span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                {f.checked_at ? new Date(f.checked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <a href={`/proposals/${f.proposal_id}`}
                                                        className="px-2 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50">Proposal</a>
                                                    <a href={`/proposals/${f.similar_proposal_id}`}
                                                        className="px-2 py-1 border border-purple-200 text-purple-600 rounded text-xs hover:bg-purple-50">Similar</a>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                            {visible.length} result{visible.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {visible.map(f => {
                            const pct = Math.round(f.score * 100);
                            return (
                                <div key={f.id} className={`bg-white border rounded-xl p-5 ${f.flagged ? 'border-red-200 bg-red-50/20' : 'border-gray-200'}`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <a href={`/proposals/${f.proposal_id}`}
                                                className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
                                                {f.proposal?.tracker_number ?? '—'}
                                            </a>
                                            {f.flagged && (
                                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">⚠ Flagged</span>
                                            )}
                                        </div>
                                        <ScoreBar score={f.score} />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">{f.proposal?.title ?? '—'}</p>
                                    <p className="text-xs text-gray-400 mb-3">{f.proposal?.college?.name}</p>
                                    <div className="border-t border-gray-100 pt-3">
                                        <p className="text-xs text-gray-500 mb-1">Similar to:</p>
                                        <a href={`/proposals/${f.similar_proposal_id}`}
                                            className="text-xs font-mono text-purple-600 hover:underline">
                                            {f.similar_proposal?.tracker_number}
                                        </a>
                                        <p className="text-xs text-gray-500 line-clamp-1">{f.similar_proposal?.title}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
