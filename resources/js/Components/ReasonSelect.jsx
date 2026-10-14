import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const ACCENTS = {
    amber: { ring: 'focus:ring-amber-400', border: 'border-amber-400', chip: 'bg-amber-100 text-amber-700', row: 'bg-amber-50', check: 'text-amber-600' },
    red:   { ring: 'focus:ring-red-400',   border: 'border-red-400',   chip: 'bg-red-100 text-red-700',     row: 'bg-red-50',   check: 'text-red-600' },
};

/** Accessible single-choice dropdown where each option has an icon, a label and a one-line description. */
export default function ReasonSelect({ options, value, onChange, placeholder = 'Select a reason…', accent = 'amber' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const a = ACCENTS[accent] ?? ACCENTS.amber;
    const selected = options.find((o) => o.key === value) ?? null;

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 ${a.ring} ${
                    open ? a.border : 'border-gray-300 hover:border-gray-400'
                }`}
            >
                {selected ? (
                    <>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.chip}`}>
                            <selected.icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-gray-900">{selected.label}</span>
                            <span className="block truncate text-xs text-gray-500">{selected.description}</span>
                        </span>
                    </>
                ) : (
                    <span className="flex-1 text-gray-400">{placeholder}</span>
                )}
                <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 z-10 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                >
                    {options.map((issue) => {
                        const active = issue.key === value;
                        return (
                            <li key={issue.key} role="option" aria-selected={active}>
                                <button
                                    type="button"
                                    onClick={() => { onChange(issue.key); setOpen(false); }}
                                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                                        active ? a.row : 'hover:bg-gray-50'
                                    } ${issue.key === 'other' ? 'mt-1 border-t border-gray-100 pt-3' : ''}`}
                                >
                                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? a.chip : 'bg-gray-100 text-gray-500'}`}>
                                        <issue.icon size={14} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium text-gray-900">{issue.label}</span>
                                        <span className="block text-xs leading-relaxed text-gray-500">{issue.description}</span>
                                    </span>
                                    {active && <Check size={15} className={`mt-1 shrink-0 ${a.check}`} />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
