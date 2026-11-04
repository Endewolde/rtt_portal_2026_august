import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
    FileText, Users, Star, Gavel, ClipboardCheck, Award, BookOpen, Download, Loader2, Search, Trash2, ShieldCheck,
    History as HistoryIcon, Globe2, CalendarX, AlertTriangle,
} from 'lucide-react';
import { Panel, EmptyState, StatCard, Skeleton } from '../Insights/Kit';
import api from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { useToast } from '../Toast';
import { cn, formatDate } from '../../lib/utils';

const PRIMARY = '#4f46e5';
const TOOLTIP = {
    contentStyle: { borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 10px 25px -10px rgba(15,23,42,0.25)', padding: '8px 12px' },
    labelStyle: { fontWeight: 600, color: '#111827', marginBottom: 4 },
};
const STATUS_LABEL = { submitted: 'Awaiting reviewers', under_review: 'Under review', revision_requested: 'Revision asked', accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn' };

/** Running total by day — how a call or registration filled up. */
const cumulative = (rows) => {
    let total = 0;
    return rows.map((r) => ({ day: new Date(r.day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), total: (total += r.count), added: r.count }));
};

function GrowthChart({ rows, label, empty }) {
    const data = cumulative(rows ?? []);
    if (data.length === 0) return <EmptyState title={empty} />;
    return (
        <div className="h-48" role="img" aria-label={`${label}: ${data.at(-1).total} in total`}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.18} />
                            <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip {...TOOLTIP} cursor={{ stroke: '#cbd5e1' }} formatter={(v, _n, p) => [`${v} (+${p.payload.added} that day)`, label]} />
                    <Area type="monotone" dataKey="total" stroke={PRIMARY} strokeWidth={2} fill={`url(#g-${label})`} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Counts as labelled bars in one hue; the number is always written beside the bar. */
function BarList({ rows, empty = 'Nothing yet.' }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (rows.length === 0 || rows.every((r) => !r.value)) return <p className="py-4 text-center text-sm text-gray-400">{empty}</p>;
    return (
        <ul className="space-y-2.5">
            {rows.map((r) => (
                <li key={r.label} title={`${r.label}: ${r.value}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                        <span className="truncate text-gray-700">{r.label}</span>
                        <span className="shrink-0 tabular-nums font-semibold text-gray-900">{r.value}{r.suffix ?? ''}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(r.value / max) * 100}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export function ConferenceOverview({ conference, onChanged }) {
    const { success, error } = useToast();
    const [d, setD] = useState(null);
    const [busy, setBusy] = useState('');

    useEffect(() => {
        api.get(`/admin/conferences/${conference.id}/overview`).then((r) => setD(r.data?.data)).catch(() => setD(false));
    }, [conference.id]);

    const downloadBook = async () => {
        setBusy('book');
        try { await downloadFile(`/admin/conferences/${conference.id}/book-of-abstracts`, 'book-of-abstracts.pdf'); } catch { error('Could not create the book of abstracts.'); }
        setBusy('');
    };
    const togglePublish = async () => {
        setBusy('publish');
        try {
            await api.put(`/admin/conferences/${conference.id}`, { book_published: !conference.book_published });
            success(conference.book_published ? 'The book is no longer on the public page.' : 'The book of abstracts is now on the public conference page.');
            onChanged();
        } catch (e) { error(e.response?.data?.message ?? 'Could not change it.'); }
        setBusy('');
    };

    if (d === false) return <Panel bodyClassName="p-0"><EmptyState icon={AlertTriangle} title="Could not load the overview" /></Panel>;
    const a = d?.abstracts;
    const r = d?.reviews;
    const g = d?.registrations;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={FileText} label="Abstracts received" value={a?.total ?? '—'} hint={a ? `${a.by_status?.accepted ?? 0} accepted` : ''} loading={!d} />
                <StatCard icon={Gavel} label="Acceptance rate" value={a?.acceptance_rate != null ? `${a.acceptance_rate}%` : '—'} hint="Of those decided" color="violet" loading={!d} />
                <StatCard icon={ClipboardCheck} label="Reviews in" value={r ? `${r.submitted} / ${r.assigned - r.conflicts}` : '—'} hint={r ? `${r.pending} still out${r.conflicts ? ` · ${r.conflicts} conflicts` : ''}` : ''} color="amber" loading={!d} />
                <StatCard icon={Users} label="Registered" value={g?.confirmed ?? '—'} hint={g ? `${g.checked_in} checked in${g.waitlisted ? ` · ${g.waitlisted} waiting` : ''}` : ''} color="emerald" loading={!d} />
            </div>

            {a?.accepted_unscheduled > 0 && (
                <p className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <CalendarX size={15} className="shrink-0" /> {a.accepted_unscheduled} accepted abstract{a.accepted_unscheduled === 1 ? ' is' : 's are'} not in a programme session yet.
                    <a href={`/admin/abstracts?conference_id=${conference.id}&status=accepted`} className="ml-auto shrink-0 font-semibold underline">Place them</a>
                </p>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Abstracts received" subtitle="Running total by day of submission">{d ? <GrowthChart rows={a.per_day} label="Abstracts" empty="No abstracts yet" /> : <Skeleton className="h-48" />}</Panel>
                <Panel title="Registrations" subtitle="Running total by day of registration">{d ? <GrowthChart rows={g.per_day} label="Registrations" empty="No registrations yet" /> : <Skeleton className="h-48" />}</Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
                <Panel title="Where abstracts stand">
                    {d ? <BarList rows={Object.entries(STATUS_LABEL).map(([k, label]) => ({ label, value: a.by_status?.[k] ?? 0 })).filter((x) => x.value)} empty="No abstracts yet." /> : <Skeleton className="h-32" />}
                </Panel>
                <Panel title={a?.by_track?.length ? 'By track' : 'By format'}>
                    {d ? <BarList rows={a.by_track?.length ? a.by_track.map((t) => ({ label: t.name, value: t.count })) : Object.entries(a.by_type ?? {}).map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), value: v }))} /> : <Skeleton className="h-32" />}
                </Panel>
                <Panel title="Authors' countries" icon={Globe2}>
                    {d ? <BarList rows={(a.countries ?? []).map((c) => ({ label: c.country, value: c.count }))} empty="Countries appear as authors give them." /> : <Skeleton className="h-32" />}
                </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Reviewer workload" subtitle="Most reviews still outstanding first" bodyClassName="p-0">
                    {!d ? <div className="p-5"><Skeleton className="h-32" /></div> : r.load.length === 0 ? <EmptyState icon={ClipboardCheck} title="No reviewers assigned yet" /> : (
                        <ul className="divide-y divide-gray-100">
                            {r.load.map((x) => (
                                <li key={x.name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                                    <span className="truncate font-medium text-gray-900">{x.name}</span>
                                    <span className="shrink-0 text-xs tabular-nums text-gray-600">
                                        {x.done} of {x.assigned} done
                                        {x.assigned - x.done > 0 && <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-px font-semibold text-amber-700">{x.assigned - x.done} out</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
                <Panel title="Book of abstracts" icon={BookOpen} subtitle="Every accepted abstract by track, numbered, with an author index. No email addresses.">
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">{a ? `${a.by_status?.accepted ?? 0} accepted abstract${(a.by_status?.accepted ?? 0) === 1 ? '' : 's'} will be included.` : ' '}</p>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={downloadBook} disabled={busy === 'book'} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                                {busy === 'book' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download PDF
                            </button>
                            <button onClick={togglePublish} disabled={busy === 'publish'} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                                {busy === 'publish' && <Loader2 size={14} className="animate-spin" />} {conference.book_published ? 'Take off the public page' : 'Publish on the public page'}
                            </button>
                        </div>
                        {conference.book_published && <p className="text-xs text-emerald-700">Published — anyone can download it from the conference page.</p>}
                        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
                            <span className="inline-flex items-center gap-1.5"><Award size={13} className="text-amber-500" /> {d?.certificates ?? '—'} certificates issued</span>
                            <span className="inline-flex items-center gap-1.5"><Star size={13} className="text-amber-500" /> {d?.feedback?.average != null ? `${d.feedback.average} / 5 from ${d.feedback.responses}` : 'No feedback yet'}</span>
                        </div>
                    </div>
                </Panel>
            </div>

            {g?.by_type?.length > 0 && (
                <Panel title="Places by registration type">
                    <BarList rows={g.by_type.map((t) => ({ label: t.capacity ? `${t.name} (${t.capacity} places)` : t.name, value: t.count }))} />
                </Panel>
            )}
        </div>
    );
}

// ─── Committee ────────────────────────────────────────────────────────────────

const ROLES = [
    { key: 'chair', label: 'Conference chair', hint: 'Runs everything for this conference, including decisions.' },
    { key: 'track_chair', label: 'Track chair', hint: 'Reads the abstracts of one track and chooses their reviewers.' },
    { key: 'checkin', label: 'Check-in desk', hint: 'Checks attendees in by scanning tickets.' },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]));

export function ConferenceCommittee({ conference }) {
    const { success, error } = useToast();
    const [members, setMembers] = useState(null);
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState([]);
    const [picked, setPicked] = useState(null);
    const [role, setRole] = useState('chair');
    const [trackId, setTrackId] = useState('');
    const [busy, setBusy] = useState(false);
    const tracks = conference.tracks ?? [];

    const load = useCallback(() => {
        api.get(`/admin/conferences/${conference.id}/committee`).then((r) => setMembers(r.data?.data ?? [])).catch(() => setMembers([]));
    }, [conference.id]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (picked || search.trim().length < 2) { setUsers([]); return undefined; }
        const t = setTimeout(() => {
            api.get('/users', { params: { search, per_page: 6 }, skipErrorToast: true })
                .then((r) => { const d = r.data?.data ?? r.data; setUsers(Array.isArray(d) ? d : (d?.data ?? [])); })
                .catch(() => setUsers([]));
        }, 300);
        return () => clearTimeout(t);
    }, [search, picked]);

    const add = async (e) => {
        e.preventDefault();
        if (!picked) return;
        setBusy(true);
        try {
            const r = await api.post(`/admin/conferences/${conference.id}/committee`, { user_id: picked.id, role, track_id: role === 'track_chair' ? trackId || null : null });
            success(r.data?.message ?? 'Added.');
            setPicked(null); setSearch(''); setTrackId('');
            load();
        } catch (err) {
            error(err.response?.data?.errors?.track_id?.[0] ?? err.response?.data?.message ?? 'Could not add them.');
        }
        setBusy(false);
    };

    const remove = async (m) => {
        try { await api.delete(`/admin/conferences/${conference.id}/committee/${m.id}`); success('Removed from the committee.'); load(); } catch { error('Could not remove them.'); }
    };

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel title="Add someone" icon={ShieldCheck} subtitle="A committee role works on this conference only, without platform-wide conference rights.">
                <form onSubmit={add} className="space-y-3">
                    <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={picked ? `${picked.name} — ${picked.email}` : search} onChange={(e) => { setPicked(null); setSearch(e.target.value); }}
                            placeholder="Search people by name or email…" aria-label="Person"
                            className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                        {users.length > 0 && (
                            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                                {users.map((u) => (
                                    <button key={u.id} type="button" onClick={() => { setPicked(u); setUsers([]); }} className="block w-full px-3 py-2 text-left hover:bg-indigo-50">
                                        <span className="block truncate text-sm font-medium text-gray-900">{u.name}</span>
                                        <span className="block truncate text-[11px] text-gray-500">{u.email}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        {ROLES.map((r) => (
                            <label key={r.key} className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5', role === r.key ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200')}>
                                <input type="radio" name="committee-role" checked={role === r.key} onChange={() => setRole(r.key)} className="mt-0.5 text-indigo-600" />
                                <span><span className="block text-sm font-semibold text-gray-900">{r.label}</span><span className="block text-xs text-gray-500">{r.hint}</span></span>
                            </label>
                        ))}
                    </div>
                    {role === 'track_chair' && (tracks.length === 0
                        ? <p className="text-xs text-amber-700">This conference has no tracks yet — add them in the conference editor first.</p>
                        : (
                            <select value={trackId} onChange={(e) => setTrackId(e.target.value)} aria-label="Track" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                                <option value="">Choose the track…</option>
                                {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        ))}
                    <button disabled={!picked || busy || (role === 'track_chair' && !trackId)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
                        {busy && <Loader2 size={14} className="animate-spin" />} Add and email them
                    </button>
                </form>
            </Panel>

            <Panel title="Committee" bodyClassName="p-0">
                {members === null ? <div className="p-5"><Skeleton className="h-32" /></div> : members.length === 0 ? (
                    <EmptyState icon={Users} title="No committee yet" text="People with the platform's conference rights manage every conference. Add chairs, track chairs or desk staff for this one." />
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {members.map((m) => (
                            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-gray-900">{m.user?.name}</span>
                                    <span className="block truncate text-xs text-gray-500">{m.user?.email}</span>
                                </span>
                                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{ROLE_LABEL[m.role]}{m.track ? ` · ${m.track.name}` : ''}</span>
                                <button onClick={() => remove(m)} aria-label={`Remove ${m.user?.name}`} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
}

// ─── History ──────────────────────────────────────────────────────────────────

export function ConferenceHistory({ conference }) {
    const [rows, setRows] = useState(null);
    const [meta, setMeta] = useState(null);
    const [page, setPage] = useState(1);

    useEffect(() => {
        api.get(`/admin/conferences/${conference.id}/history`, { params: { page } })
            .then((r) => { const p = r.data?.data ?? {}; setRows(p.data ?? []); setMeta(p); })
            .catch(() => setRows([]));
    }, [conference.id, page]);

    return (
        <Panel title="History" icon={HistoryIcon} subtitle="What has happened to this conference and its abstracts, newest first." bodyClassName="p-0">
            {rows === null ? <div className="p-5"><Skeleton className="h-40" /></div> : rows.length === 0 ? (
                <EmptyState icon={HistoryIcon} title="Nothing recorded yet" />
            ) : (
                <>
                    <ol className="divide-y divide-gray-100">
                        {rows.map((h) => (
                            <li key={h.id} className="flex gap-3 px-5 py-3 text-sm">
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-gray-900"><b className="font-semibold">{h.label}</b>{h.change && <span className="text-gray-600"> — {h.change}</span>}</span>
                                    {h.subject && <span className="block truncate text-xs text-gray-500">{h.subject}</span>}
                                </span>
                                <span className="shrink-0 text-right text-xs text-gray-500">
                                    <span className="block">{h.actor ?? 'Public visitor'}</span>
                                    <span className="block tabular-nums">{formatDate(h.at)} {new Date(h.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                    {meta?.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-gray-600">
                            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 font-semibold hover:bg-gray-100 disabled:opacity-40">Newer</button>
                            <span>Page {meta.current_page} of {meta.last_page}</span>
                            <button disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 font-semibold hover:bg-gray-100 disabled:opacity-40">Older</button>
                        </div>
                    )}
                </>
            )}
        </Panel>
    );
}
