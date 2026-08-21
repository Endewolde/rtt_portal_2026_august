import { useState } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

const ACCENT_STYLES = {
    indigo: { active: 'border-indigo-300 bg-indigo-50 text-indigo-700', badge: 'bg-indigo-600' },
    purple: { active: 'border-purple-300 bg-purple-50 text-purple-700', badge: 'bg-purple-600' },
    teal: { active: 'border-teal-300 bg-teal-50 text-teal-700', badge: 'bg-teal-600' },
    blue: { active: 'border-blue-300 bg-blue-50 text-blue-700', badge: 'bg-blue-600' },
    amber: { active: 'border-amber-300 bg-amber-50 text-amber-700', badge: 'bg-amber-600' },
};

/**
 * Responsive filter bar: renders `children` (a set of <select>/filter controls)
 * inline on desktop, and behind a collapsible "Filters" trigger on mobile so a
 * row of 3-4 dropdowns doesn't overflow or wrap awkwardly on small screens.
 * `trailing` (e.g. ViewToggle, Refresh button) always stays visible.
 */
export default function FilterBar({ children, activeCount = 0, trailing, accent = 'indigo' }) {
    const [open, setOpen] = useState(false);
    const accentCls = ACCENT_STYLES[accent] ?? ACCENT_STYLES.indigo;

    return (
        <div className="w-full sm:w-auto">
            {/* Mobile trigger row */}
            <div className="flex items-center gap-2 sm:hidden">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors',
                        open || activeCount > 0 ? accentCls.active : 'border-gray-200 text-gray-600 bg-white'
                    )}
                >
                    <SlidersHorizontal size={14} />
                    Filters
                    {activeCount > 0 && (
                        <span className={cn('text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none', accentCls.badge)}>
                            {activeCount}
                        </span>
                    )}
                    <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
                </button>
                {trailing}
            </div>

            {/* Mobile collapsible panel */}
            {open && (
                <div className="sm:hidden mt-2 p-3 bg-white border border-gray-200 rounded-2xl space-y-2.5">
                    {children}
                </div>
            )}

            {/* Desktop inline row */}
            <div className="hidden sm:flex sm:items-center sm:gap-2 sm:flex-wrap">
                {children}
                {trailing}
            </div>
        </div>
    );
}
