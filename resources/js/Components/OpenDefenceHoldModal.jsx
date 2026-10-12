import { Link } from '@inertiajs/react';
import { Hourglass, X, EyeOff, ArrowRight } from 'lucide-react';
import StatusBadge from './StatusBadge';

/**
 * Shown to a college officer who tries to open Open Defence while their college
 * still has proposals in blind review. `onClose` is optional — omit it to make the
 * modal non-dismissible (e.g. when the Open Defence page was opened directly).
 */
export default function OpenDefenceHoldModal({ open, collegeName, pending = [], onClose }) {
    if (!open) return null;

    const count = pending.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-4 top-5 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X size={16} />
                    </button>
                )}

                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-4 ring-amber-50">
                            <Hourglass size={22} />
                        </div>
                        <div className="min-w-0 flex-1 pr-6">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Open defence on hold</p>
                            <h2 className="mt-0.5 text-lg font-bold text-gray-900">Blind review is still in progress</h2>
                        </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-gray-600">
                        {count} {count === 1 ? 'proposal' : 'proposals'} from{' '}
                        <span className="font-semibold text-gray-800">{collegeName ?? 'your college'}</span>{' '}
                        {count === 1 ? 'has' : 'have'} not yet completed the blind review phase. To keep the evaluation
                        fair and consistent, the open defence phase opens once every blind review in your college
                        has been completed.
                    </p>

                    {count > 0 && (
                        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                            <p className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">
                                Remaining in blind review
                            </p>
                            <ul className="max-h-52 divide-y divide-gray-100 overflow-y-auto">
                                {pending.map((p) => (
                                    <li key={p.id}>
                                        <Link
                                            href={`/proposals/${p.id}`}
                                            className="group flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/60"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-mono text-xs text-gray-400">{p.tracker_number}</p>
                                                <p className="truncate text-sm font-medium text-gray-800">{p.title}</p>
                                            </div>
                                            <StatusBadge status={p.status} />
                                            <ArrowRight size={14} className="shrink-0 text-gray-300 group-hover:text-amber-600" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Stay here
                            </button>
                        )}
                        <Link
                            href="/admin/blind-review"
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            <EyeOff size={15} /> Go to Blind Review
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
