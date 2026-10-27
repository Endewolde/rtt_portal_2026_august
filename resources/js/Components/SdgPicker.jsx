import { Check } from 'lucide-react';
import { SDGS, MAX_SDGS, sdgByNumber } from '../lib/sdgs';
import { translate as tr } from '../lib/i18n';

/** Choose up to three Sustainable Development Goals; each tile wears the goal's own colour. */
export default function SdgPicker({ value = [], onChange }) {
    const selected = (value ?? []).map(Number);
    const full = selected.length >= MAX_SDGS;

    const toggle = (n) => {
        if (selected.includes(n)) onChange(selected.filter((x) => x !== n));
        else if (!full) onChange([...selected, n]);
    };

    return (
        <div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SDGS.map(({ n, name, color }) => {
                    const on = selected.includes(n);
                    const disabled = !on && full;
                    return (
                        <button key={n} type="button" onClick={() => toggle(n)} disabled={disabled} title={name} aria-pressed={on}
                            className={`relative flex min-h-16 flex-col justify-between rounded-lg p-2 text-left text-white transition ${on ? 'ring-2 ring-offset-2 ring-gray-900' : ''} ${disabled ? 'opacity-30' : 'hover:brightness-110'}`}
                            style={{ backgroundColor: color }}>
                            <span className="text-lg font-extrabold leading-none">{n}</span>
                            <span className="line-clamp-2 text-[9px] font-semibold uppercase leading-tight tracking-wide">{name}</span>
                            {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-gray-900"><Check size={11} /></span>}
                        </button>
                    );
                })}
            </div>
            <p className="mt-2 text-xs text-gray-400">
                {selected.length === 0
                    ? tr('Optional — pick up to three goals this work contributes to.')
                    : tr(':count of 3 chosen', { count: selected.length })}
            </p>
        </div>
    );
}

/** Small coloured goal badges for showing a proposal's SDGs. */
export function SdgBadges({ value = [], size = 'sm' }) {
    const goals = (value ?? []).map(sdgByNumber).filter(Boolean);
    if (goals.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {goals.map((g) => (
                <span key={g.n} title={`SDG ${g.n}: ${g.name}`}
                    className={`inline-flex items-center gap-1.5 rounded-md font-semibold text-white ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
                    style={{ backgroundColor: g.color }}>
                    <span className="font-extrabold">{g.n}</span> {g.name}
                </span>
            ))}
        </div>
    );
}
