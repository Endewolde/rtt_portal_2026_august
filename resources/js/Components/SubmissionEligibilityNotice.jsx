import { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { get } from '../lib/api';

/**
 * Tells a PI up front if they can't submit a new proposal yet (overdue progress report,
 * too many active grants, unsettled funds) — they can still prepare a draft meanwhile.
 */
export default function SubmissionEligibilityNotice({ onChange }) {
    const [result, setResult] = useState(null);

    useEffect(() => {
        get('/submission-eligibility')
            .then((r) => { setResult(r.data); onChange?.(r.data); })
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!result || result.eligible) return null;

    return (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-900">You can prepare a draft, but you can't submit a new proposal yet</p>
                    <ul className="mt-2 space-y-1.5">
                        {result.reasons.map((r, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-x-2 text-sm text-amber-800">
                                <span>{r.message}</span>
                                {r.proposal_id && (
                                    <Link href={`/proposals/${r.proposal_id}${r.type === 'overdue_report' ? '?tab=Progress' : r.type === 'unsettled_budget' ? '?tab=Budget' : ''}`}
                                        className="inline-flex items-center gap-1 font-semibold text-amber-900 underline underline-offset-2 hover:no-underline">
                                        Open project <ArrowRight size={12} />
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
