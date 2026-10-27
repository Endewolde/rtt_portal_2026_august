import { useEffect, useState } from 'react';
import { Star, Lightbulb } from 'lucide-react';
import { get } from '../lib/api';
import { translate as tr } from '../lib/i18n';

/** A reviewer's own quality record: how the office rated their reviews. Hidden until something is rated. */
export default function ReviewQualityCard() {
    const [q, setQ] = useState(null);

    useEffect(() => {
        get('/my-review-quality').then((r) => setQ(r.data ?? null)).catch(() => setQ(null));
    }, []);

    if (!q || q.rated === 0) return null;

    const parts = [
        { key: 'useful', label: 'Useful', bar: 'bg-emerald-500', text: 'text-emerald-700', tile: 'bg-emerald-50 ring-emerald-100' },
        { key: 'adequate', label: 'Adequate', bar: 'bg-sky-500', text: 'text-sky-700', tile: 'bg-sky-50 ring-sky-100' },
        { key: 'thin', label: 'Thin', bar: 'bg-amber-400', text: 'text-amber-700', tile: 'bg-amber-50 ring-amber-100' },
    ];
    const share = (n) => Math.round((n / q.rated) * 100);
    const usefulPct = share(q.useful ?? 0);

    return (
        <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-sm"><Star size={18} /></span>
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">{tr('How your reviews were rated')}</h2>
                        <p className="text-xs text-gray-500">{tr(':count reviews rated by the office', { count: q.rated })}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums leading-none text-emerald-600">{usefulPct}%</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{tr('rated useful')}</p>
                </div>
            </header>

            <div className="flex-1 px-5 py-4">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-gray-100">
                    {parts.map((p) => q[p.key] > 0 && <div key={p.key} className={`${p.bar} rounded-full`} style={{ width: `${share(q[p.key])}%` }} title={`${tr(p.label)}: ${q[p.key]}`} />)}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {parts.map((p) => (
                        <div key={p.key} className={`rounded-xl px-3 py-2.5 ring-1 ${p.tile}`}>
                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600"><span className={`h-2 w-2 rounded-full ${p.bar}`} /> {tr(p.label)}</p>
                            <p className={`mt-0.5 text-lg font-bold tabular-nums ${p.text}`}>{q[p.key] ?? 0}</p>
                            <p className="text-[10px] tabular-nums text-gray-400">{share(q[p.key] ?? 0)}%</p>
                        </div>
                    ))}
                </div>
            </div>

            <footer className="flex items-start gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-[11px] leading-relaxed text-gray-500">
                <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-500" />
                {tr('Detailed, specific comments help research teams most — and count towards being matched to future proposals.')}
            </footer>
        </section>
    );
}
