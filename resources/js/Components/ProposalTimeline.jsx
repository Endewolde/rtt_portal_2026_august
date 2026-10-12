import { formatDateTime, getStatusLabel } from '../lib/utils';
import { CheckCircle, Circle, Clock } from 'lucide-react';

export default function ProposalTimeline({ history = [], currentStatus }) {
    if (!history.length) {
        return <p className="text-gray-500 text-sm">No workflow history available.</p>;
    }

    return (
        <ol className="relative border-l border-gray-200 ml-4">
            {history.map((entry, i) => {
                const isLast = i === history.length - 1;
                return (
                    <li key={i} className="mb-8 ml-6">
                        <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white
                            ${isLast ? 'bg-blue-600 animate-pulse' : 'bg-green-500'}`}>
                            {isLast
                                ? <Clock size={12} className="text-white" />
                                : <CheckCircle size={12} className="text-white" />
                            }
                        </span>
                        <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sm text-gray-800 capitalize">
                                    {entry.to_stage ? getStatusLabel(entry.to_stage) : (entry.action ?? '').replace(/_/g, ' ')}
                                </span>
                                <span className="text-xs text-gray-400">{formatDateTime(entry.occurred_at)}</span>
                            </div>
                            <p className="text-xs text-gray-500">By: <span className="font-medium">{entry.actor}</span></p>
                            {entry.notes && <p className="mt-1 text-xs text-gray-600 italic">{entry.notes}</p>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
