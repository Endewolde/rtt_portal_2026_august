import { useEffect, useState } from 'react';
import { Route, X, Loader2, EyeOff, Presentation, Landmark, ArrowRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { get, put } from '../lib/api';
import { useToast } from './Toast';

const STANDARD = { open_defence: true, blind_reviewers: null, defence_reviewers: null, blind_threshold: null, defence_threshold: null, combined_threshold: null };

function Stage({ icon: Icon, title, tone, muted, children }) {
    return (
        <div className={`rounded-2xl border p-4 transition ${muted ? 'border-dashed border-gray-200 bg-gray-50 opacity-60' : `border-gray-200 bg-white`}`}>
            <div className="mb-3 flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon size={15} /></span>
                <p className="font-semibold text-gray-900">{title}</p>
            </div>
            {children}
        </div>
    );
}

function NumberField({ label, value, onChange, placeholder, suffix, min = 0, step = 1, disabled }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
                <input type="number" min={min} step={step} value={value ?? ''} disabled={disabled}
                    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100 sm:text-sm" />
                {suffix && <span className="shrink-0 text-xs text-gray-500">{suffix}</span>}
            </div>
        </label>
    );
}

/**
 * A call's own review route: whether proposals face an open defence, how many
 * reviewers each decision waits for, and its own pass marks (raw points, like the
 * standard ones in Settings → Review Thresholds). Empty fields follow the standard.
 */
export default function ReviewRouteModal({ call, onClose, onSaved }) {
    const { success, error } = useToast();
    const [info, setInfo] = useState(null);
    const [route, setRoute] = useState(STANDARD);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        get(`/proposal-calls/${call.id}/review-route`)
            .then((r) => { setInfo(r.data); setRoute({ ...STANDARD, ...(r.data?.route ?? {}) }); })
            .catch((e) => { error(e.response?.data?.message ?? 'Could not load the review route.'); onClose(); });
    }, [call.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const set = (key, value) => setRoute((r) => ({ ...r, [key]: value }));
    const std = info?.standard ?? {};
    const max = info?.max_points ?? {};
    const pts = (n) => (n ? `of ${n} points` : 'points');

    const save = async (next = route) => {
        setSaving(true);
        try {
            const r = await put(`/proposal-calls/${call.id}/review-route`, next);
            success(r.message || 'Review route saved.');
            onSaved?.(r.data);
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? 'The review route could not be saved.'));
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><Route size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">Review route</h2>
                            <p className="truncate text-xs text-gray-500">{call.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                {!info ? (
                    <div className="space-y-3 p-6">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}</div>
                ) : (
                    <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/60 px-6 py-5">
                        <p className="text-sm text-gray-600">
                            How proposals to this call are reviewed. Leave a field empty to use the standard setting.
                            Pass marks are points out of the evaluation criteria total, as in Review Thresholds.
                        </p>

                        {info.proposals_in_review > 0 && (
                            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <span>{info.proposals_in_review} proposal{info.proposals_in_review === 1 ? ' is' : 's are'} in review now. Changes apply to decisions not yet made; past decisions stay as recorded.</span>
                            </div>
                        )}

                        <Stage icon={EyeOff} title="Blind review" tone="bg-indigo-100 text-indigo-600">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <NumberField label="Reviewers before deciding" min={1} value={route.blind_reviewers} onChange={(v) => set('blind_reviewers', v)}
                                    placeholder="All who are assigned" />
                                <NumberField label="Pass mark" step={0.5} value={route.blind_threshold} onChange={(v) => set('blind_threshold', v)}
                                    placeholder={`Standard: ${std.blind_threshold ?? '—'}`} suffix={pts(max.blind)} />
                            </div>
                        </Stage>

                        <div className="flex justify-center text-gray-300"><ArrowRight size={16} className="rotate-90" /></div>

                        <Stage icon={Presentation} title="Open defence" tone="bg-amber-100 text-amber-600" muted={!route.open_defence}>
                            <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                                <input type="checkbox" checked={route.open_defence} onChange={(e) => set('open_defence', e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                                <span>
                                    <span className="block text-sm font-medium text-gray-800">Proposals present at an open defence</span>
                                    <span className="block text-xs text-gray-500">Switch off to send proposals that pass blind review straight to central evaluation.</span>
                                </span>
                            </label>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <NumberField label="Panel members before deciding" min={1} disabled={!route.open_defence} value={route.defence_reviewers}
                                    onChange={(v) => set('defence_reviewers', v)} placeholder="All assigned" />
                                <NumberField label="Defence pass mark" step={0.5} disabled={!route.open_defence} value={route.defence_threshold}
                                    onChange={(v) => set('defence_threshold', v)} placeholder={`Standard: ${std.defence_threshold ?? '—'}`} suffix={pts(max.defence)} />
                                <NumberField label="Combined pass mark" step={0.5} disabled={!route.open_defence} value={route.combined_threshold}
                                    onChange={(v) => set('combined_threshold', v)} placeholder={`Standard: ${std.combined_threshold ?? '—'}`}
                                    suffix={pts((max.blind ?? 0) + (max.defence ?? 0))} />
                            </div>
                        </Stage>

                        <div className="flex justify-center text-gray-300"><ArrowRight size={16} className="rotate-90" /></div>

                        <Stage icon={Landmark} title="Central evaluation & funding" tone="bg-emerald-100 text-emerald-600">
                            <p className="text-sm text-gray-600">
                                {route.open_defence
                                    ? 'Proposals that clear the combined pass mark come here for the funding decision.'
                                    : 'Proposals that clear the blind review pass mark come here for the funding decision.'}
                            </p>
                        </Stage>
                    </div>
                )}

                <div className="flex flex-wrap gap-3 border-t border-gray-100 px-6 py-4">
                    {info?.customised && (
                        <button onClick={() => save(STANDARD)} disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                            <RotateCcw size={14} /> Use standard route
                        </button>
                    )}
                    <div className="ml-auto flex flex-1 gap-3 sm:flex-none">
                        <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none">Cancel</button>
                        <button onClick={() => save()} disabled={saving || !info}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:flex-none">
                            {saving && <Loader2 size={14} className="animate-spin" />} Save route
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
