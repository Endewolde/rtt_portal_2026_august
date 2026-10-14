import { AlertTriangle } from 'lucide-react';

/** Amber chip for a possible conflict of interest; the reasons are spelled out beside it on wide rows. */
export default function ReviewerConflictBadge({ conflicts, showReasons = false }) {
    if (!conflicts?.length) return null;
    return (
        <span className="inline-flex max-w-full items-start gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
            title={conflicts.join(' · ')}>
            <AlertTriangle size={10} className="mt-px shrink-0" />
            <span className="truncate">{showReasons ? `Possible conflict: ${conflicts.join(' · ')}` : 'Possible conflict'}</span>
        </span>
    );
}

/** The server's message when a blind reviewer has an unconfirmed possible conflict. */
export const isConflictWarning = (message) => typeof message === 'string' && message.startsWith('Possible conflict of interest');
