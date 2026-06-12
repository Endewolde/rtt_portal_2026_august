import { useState } from 'react';
import { Search, CheckCircle, XCircle } from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import StatusBadge from '../../Components/StatusBadge';
import TrackerNumberDisplay from '../../Components/TrackerNumberDisplay';
import ProposalTimeline from '../../Components/ProposalTimeline';
import { get } from '../../lib/api';

export default function Tracker() {
    const [input, setInput] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const search = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await get(`/tracker/${input.trim()}`);
            setResult(res.data);
        } catch (e) {
            setError(e.response?.data?.message ?? 'Tracker number not found.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PublicLayout>
            <div className="max-w-2xl mx-auto px-4 py-16">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Proposal</h1>
                    <p className="text-gray-500">Enter your tracker number to see the current status and history.</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
                    <div className="flex gap-3">
                        <input value={input} onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && search()}
                            placeholder="e.g. RES-2026-000001"
                            className="flex-1 font-mono text-sm border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={search} disabled={loading}
                            className="flex items-center gap-2 rounded-lg bg-blue-700 text-white px-5 py-3 text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
                            <Search size={16} /> {loading ? 'Searching…' : 'Search'}
                        </button>
                    </div>
                    {error && <p className="mt-3 text-sm text-red-600 flex items-center gap-2"><XCircle size={16} />{error}</p>}
                </div>

                {result && (
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <div className="flex items-start justify-between mb-3">
                                <TrackerNumberDisplay trackerNumber={result.tracker_number} />
                                <StatusBadge status={result.current_status} size="lg" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">{result.title}</h2>
                            <p className="text-sm text-gray-500">{result.category} · {result.college} · {result.academic_year}</p>
                        </div>

                        {/* Final decision banner */}
                        {result.is_terminal && (
                            <div className={`flex items-center gap-3 rounded-xl p-4 ${result.final_decision === 'accepted' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                {result.final_decision === 'accepted'
                                    ? <CheckCircle size={20} className="text-green-600" />
                                    : <XCircle size={20} className="text-red-600" />
                                }
                                <p className={`font-semibold ${result.final_decision === 'accepted' ? 'text-green-800' : 'text-red-800'}`}>
                                    This proposal was {result.final_decision === 'accepted' ? 'accepted for funding' : 'not accepted'}.
                                </p>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <h3 className="font-semibold text-gray-800 mb-4">Workflow History</h3>
                            <ProposalTimeline history={result.history ?? []} currentStatus={result.current_status} />
                        </div>
                    </div>
                )}
            </div>
        </PublicLayout>
    );
}
