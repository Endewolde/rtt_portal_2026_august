import { useState, useEffect, useCallback, useRef } from 'react';
import {
    ScanLine, Camera, CameraOff, CheckCircle2, AlertTriangle, XCircle, Undo2, Users, UserCheck, Clock, Award,
    Star, Loader2, Download, ShieldX, ShieldCheck, ArrowLeft, MessageSquare, ThumbsUp,
    LayoutDashboard, History as HistoryIcon, CalendarDays, FileText, Copy,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, EmptyState, StatCard, Skeleton, RefreshButton } from '../../Components/Insights/Kit';
import api from '../../lib/api';
import { ConferenceOverview, ConferenceCommittee, ConferenceHistory } from '../../Components/Conference/HubPanels';
import { useToast } from '../../Components/Toast';
import { cn, formatDate } from '../../lib/utils';

const TABS = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'checkin', label: 'Check-in desk', icon: ScanLine },
    { key: 'certificates', label: 'Certificates', icon: Award },
    { key: 'feedback', label: 'Feedback', icon: MessageSquare },
    { key: 'committee', label: 'Committee', icon: Users },
    { key: 'history', label: 'History', icon: HistoryIcon },
];

const KIND_LABEL = { attendance: 'Attendance', presentation: 'Presentation', reviewer: 'Peer review' };
const KIND_HINT = {
    attendance: 'Everyone confirmed who checked in',
    presentation: 'The presenting author of each accepted abstract',
    reviewer: 'Everyone who submitted an abstract review',
};

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

// ─── Check-in ─────────────────────────────────────────────────────────────────

/** Reads QR codes from the camera where the browser can (BarcodeDetector); typing or a USB scanner always works. */
function CameraScanner({ onCode }) {
    const videoRef = useRef(null);
    const [on, setOn] = useState(false);
    const [problem, setProblem] = useState('');
    const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

    useEffect(() => {
        if (!on) return undefined;
        let stream;
        let timer;
        let last = '';
        let lastAt = 0;
        (async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                timer = setInterval(async () => {
                    try {
                        const [hit] = await detector.detect(videoRef.current);
                        // The same ticket held in front of the camera is read once every few seconds, not on every frame.
                        if (hit?.rawValue && (hit.rawValue !== last || Date.now() - lastAt > 4000)) {
                            last = hit.rawValue;
                            lastAt = Date.now();
                            onCode(hit.rawValue);
                        }
                    } catch { /* a frame that could not be read */ }
                }, 350);
            } catch (e) {
                setProblem(e?.name === 'NotAllowedError' ? 'Camera access was refused. Allow it in the browser, or type the code.' : 'The camera could not be started. Type the code instead.');
                setOn(false);
            }
        })();
        return () => { clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
    }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!supported) {
        return <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs text-gray-500">This browser cannot read QR codes from the camera. Type the ticket code, or use a handheld scanner — it types into the box for you.</p>;
    }

    return (
        <div className="space-y-2">
            {on && <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" />}
            <button type="button" onClick={() => { setProblem(''); setOn((v) => !v); }}
                className={cn('inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
                    on ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-indigo-600 text-white hover:bg-indigo-700')}>
                {on ? <><CameraOff size={15} /> Stop camera</> : <><Camera size={15} /> Scan with camera</>}
            </button>
            {problem && <p className="text-xs text-red-600">{problem}</p>}
        </div>
    );
}

function CheckInDesk({ conferenceId }) {
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [stats, setStats] = useState(null);
    const inputRef = useRef(null);

    const loadStats = useCallback(() => {
        api.get(`/admin/conferences/${conferenceId}/attendance`).then((r) => setStats(r.data?.data)).catch(() => {});
    }, [conferenceId]);
    useEffect(() => { loadStats(); }, [loadStats]);

    const submit = async (value, undo = false) => {
        const v = (value ?? code).trim();
        if (!v) return;
        setBusy(true);
        try {
            const r = await api.post(`/admin/conferences/${conferenceId}/check-in`, { code: v, undo }, { skipErrorToast: true });
            setResult({ tone: undo ? 'neutral' : r.data?.meta?.code === 'already' ? 'warn' : 'ok', message: r.data?.message, person: r.data?.data, undoable: !undo });
            loadStats();
        } catch (e) {
            setResult({ tone: 'error', message: e.response?.data?.message ?? 'Could not check the ticket.', person: e.response?.data?.data });
        }
        setCode('');
        setBusy(false);
        inputRef.current?.focus();
    };

    const TONE = {
        ok: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2, iconCls: 'text-emerald-600' },
        warn: { cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle, iconCls: 'text-amber-600' },
        error: { cls: 'border-red-200 bg-red-50 text-red-900', icon: XCircle, iconCls: 'text-red-600' },
        neutral: { cls: 'border-gray-200 bg-gray-50 text-gray-800', icon: Undo2, iconCls: 'text-gray-500' },
    };
    const tone = result ? TONE[result.tone] : null;

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel title="Scan or type a ticket" icon={ScanLine}>
                <div className="space-y-4">
                    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
                        <input ref={inputRef} autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ticket code, e.g. K7M3QX9PRA"
                            aria-label="Ticket code" autoComplete="off" spellCheck={false}
                            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 font-mono text-base tracking-widest focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                        <button disabled={busy || !code.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />} Check in
                        </button>
                    </form>
                    <CameraScanner onCode={(v) => submit(v)} />

                    {result && (
                        <div role="status" className={cn('rounded-2xl border p-4', tone.cls)}>
                            <div className="flex items-start gap-3">
                                <tone.icon size={22} className={cn('mt-0.5 shrink-0', tone.iconCls)} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-bold">{result.message}</p>
                                    {result.person && (
                                        <p className="mt-0.5 text-sm opacity-80">
                                            {[result.person.organization, result.person.type].filter(Boolean).join(' · ')}
                                            {result.person.ticket_code && <span className="ml-1 font-mono text-xs">({result.person.ticket_code})</span>}
                                        </p>
                                    )}
                                </div>
                                {result.undoable && result.person?.checked_in_at && result.tone === 'ok' && (
                                    <button onClick={() => submit(result.person.ticket_code, true)} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-black/5"><Undo2 size={12} /> Undo</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Panel>

            <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                    <StatCard icon={UserCheck} label="Checked in" value={stats ? stats.checked_in : '—'} hint={stats ? `of ${stats.confirmed} confirmed` : ''} color="emerald" loading={!stats} />
                    <StatCard icon={Users} label="Confirmed" value={stats?.confirmed ?? '—'} hint={stats?.conference?.max_capacity ? `${stats.conference.max_capacity} places` : 'No limit'} loading={!stats} />
                    <StatCard icon={Clock} label="Waiting list" value={stats?.waitlisted ?? '—'} color="amber" loading={!stats} />
                </div>
                {stats?.types?.length > 0 && (
                    <Panel title="By registration type" bodyClassName="p-0">
                        <ul className="divide-y divide-gray-100">
                            {stats.types.map((t) => (
                                <li key={t.name} className="px-5 py-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-gray-900">{t.name}</span>
                                        <span className="tabular-nums text-gray-500">{t.checked_in} / {t.confirmed}{t.capacity ? ` · ${t.capacity} places` : ''}</span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${t.confirmed ? (t.checked_in / t.confirmed) * 100 : 0}%` }} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}
                <Panel title="Latest check-ins" bodyClassName="p-0">
                    {!stats ? <div className="p-5"><Skeleton className="h-24" /></div> : stats.recent.length === 0 ? (
                        <EmptyState icon={UserCheck} title="Nobody checked in yet" text="Arrivals appear here as tickets are scanned." />
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {stats.recent.map((r) => (
                                <li key={r.ticket_code} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                                    <span className="min-w-0"><span className="block truncate font-medium text-gray-900">{r.name}</span>{r.organization && <span className="block truncate text-xs text-gray-500">{r.organization}</span>}</span>
                                    <span className="shrink-0 text-xs tabular-nums text-gray-500">{fmtTime(r.checked_in_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    );
}

// ─── Certificates ─────────────────────────────────────────────────────────────

function Certificates({ conferenceId }) {
    const { success, error } = useToast();
    const [rows, setRows] = useState(null);
    const [eligible, setEligible] = useState({});
    const [kinds, setKinds] = useState(['attendance', 'presentation', 'reviewer']);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        api.get(`/admin/conferences/${conferenceId}/certificates`).then((r) => { setRows(r.data?.data ?? []); setEligible(r.data?.meta?.eligible ?? {}); }).catch(() => setRows([]));
    }, [conferenceId]);
    useEffect(() => { load(); }, [load]);

    const issue = async () => {
        setBusy(true);
        try {
            const r = await api.post(`/admin/conferences/${conferenceId}/certificates`, { kinds });
            success(r.data?.message ?? 'Done.');
            load();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not issue certificates.');
        }
        setBusy(false);
    };

    const toggleRevoke = async (cert) => {
        try {
            const r = await api.patch(`/admin/conferences/${conferenceId}/certificates/${cert.id}`, { revoked: !cert.revoked_at });
            success(r.data?.message);
            load();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not update the certificate.');
        }
    };

    const issuedOf = (k) => (rows ?? []).filter((c) => c.kind === k).length;

    return (
        <div className="space-y-5">
            <Panel title="Issue certificates" icon={Award} subtitle="Each person gets one of each kind they earned, emailed with a PDF and a QR code anyone can verify. Issuing again only adds the new ones.">
                <div className="grid gap-3 sm:grid-cols-3">
                    {Object.keys(KIND_LABEL).map((k) => (
                        <label key={k} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5', kinds.includes(k) ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200')}>
                            <input type="checkbox" checked={kinds.includes(k)} onChange={(e) => setKinds((v) => e.target.checked ? [...v, k] : v.filter((x) => x !== k))} className="mt-0.5 rounded text-indigo-600" />
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-gray-900">{KIND_LABEL[k]}</span>
                                <span className="block text-xs text-gray-500">{KIND_HINT[k]}</span>
                                <span className="mt-1 block text-xs tabular-nums text-gray-700">{issuedOf(k)} issued · {eligible[k] ?? 0} eligible</span>
                            </span>
                        </label>
                    ))}
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={issue} disabled={busy || kinds.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />} Issue and email
                    </button>
                </div>
            </Panel>

            <Panel title="Issued" bodyClassName="p-0">
                {rows === null ? <div className="p-5"><Skeleton className="h-32" /></div> : rows.length === 0 ? (
                    <EmptyState icon={Award} title="No certificates yet" text="Check attendees in at the desk, then issue certificates after the conference." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-160 text-sm">
                            <thead><tr className="border-b border-gray-100 bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                <th className="px-5 py-2.5">Recipient</th><th className="px-5 py-2.5">Kind</th><th className="px-5 py-2.5">Number</th><th className="px-5 py-2.5">Issued</th><th className="px-5 py-2.5" />
                            </tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.map((c) => (
                                    <tr key={c.id} className={c.revoked_at ? 'opacity-60' : ''}>
                                        <td className="px-5 py-2.5"><span className="block font-medium text-gray-900">{c.recipient_name}</span><span className="block max-w-xs truncate text-xs text-gray-500">{c.detail ?? c.recipient_email}</span></td>
                                        <td className="px-5 py-2.5 text-gray-700">{KIND_LABEL[c.kind]}</td>
                                        <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{c.code}</td>
                                        <td className="px-5 py-2.5 text-xs text-gray-500">{c.revoked_at ? <span className="font-semibold text-red-600">Revoked</span> : formatDate(c.issued_at)}</td>
                                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                                            {!c.revoked_at && <a href={`/api/v1/conference-certificates/${c.code}/pdf`} className="mr-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"><Download size={12} /> PDF</a>}
                                            <button onClick={() => toggleRevoke(c)} className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold', c.revoked_at ? 'text-emerald-700 hover:bg-emerald-50' : 'text-red-600 hover:bg-red-50')}>
                                                {c.revoked_at ? <><ShieldCheck size={12} /> Reinstate</> : <><ShieldX size={12} /> Revoke</>}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

function FeedbackResults({ conference, onToggled }) {
    const { success, error } = useToast();
    const [data, setData] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get(`/admin/conferences/${conference.id}/feedback`).then((r) => setData(r.data?.data)).catch(() => setData({ responses: 0, comments: [], distribution: {} }));
    }, [conference.id]);

    const toggle = async () => {
        setSaving(true);
        try {
            await api.put(`/admin/conferences/${conference.id}`, { feedback_open: !conference.feedback_open });
            success(conference.feedback_open ? 'Feedback closed.' : 'Feedback is open — attendees see the form on their ticket page.');
            onToggled();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not change feedback.');
        }
        setSaving(false);
    };

    const max = data ? Math.max(1, ...Object.values(data.distribution ?? {})) : 1;

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">{conference.feedback_open ? 'Attendees can rate the conference from their ticket page.' : 'Open the survey when the conference ends — attendees then see it on their ticket page.'}</p>
                <button onClick={toggle} disabled={saving} className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60', conference.feedback_open ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-indigo-600 text-white hover:bg-indigo-700')}>
                    {saving && <Loader2 size={14} className="animate-spin" />} {conference.feedback_open ? 'Close feedback' : 'Open feedback'}
                </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                <StatCard icon={Star} label="Average rating" value={data?.average != null ? `${data.average} / 5` : '—'} color="amber" loading={!data} />
                <StatCard icon={MessageSquare} label="Responses" value={data?.responses ?? '—'} hint={data ? `of ${data.attendees} attendees` : ''} loading={!data} />
                <StatCard icon={ThumbsUp} label="Would recommend" value={data?.recommend_pct != null ? `${data.recommend_pct}%` : '—'} color="emerald" loading={!data} />
            </div>
            {data && data.responses > 0 && (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <Panel title="Ratings">
                        <ul className="space-y-2">
                            {[5, 4, 3, 2, 1].map((n) => (
                                <li key={n} className="flex items-center gap-2 text-xs">
                                    <span className="w-8 tabular-nums text-gray-600">{n} ★</span>
                                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${((data.distribution[n] ?? 0) / max) * 100}%` }} /></span>
                                    <span className="w-6 text-right tabular-nums text-gray-500">{data.distribution[n] ?? 0}</span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                    <Panel title="Comments" bodyClassName="p-0">
                        {data.comments.length === 0 ? <EmptyState title="No written comments" /> : (
                            <ul className="max-h-120 divide-y divide-gray-100 overflow-y-auto">
                                {data.comments.map((c, i) => (
                                    <li key={i} className="space-y-1.5 px-5 py-3 text-sm">
                                        <p className="text-xs text-amber-600">{'★'.repeat(c.rating)}<span className="text-gray-300">{'★'.repeat(5 - c.rating)}</span></p>
                                        {c.liked && <p className="text-gray-700"><span className="font-semibold text-emerald-700">Worked well: </span>{c.liked}</p>}
                                        {c.improve && <p className="text-gray-700"><span className="font-semibold text-amber-700">Improve: </span>{c.improve}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConferenceAttendance() {
    const { success, error } = useToast();
    const conferenceId = window.location.pathname.split('/').filter(Boolean)[2];
    const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab'));
    const [conference, setConference] = useState(null);
    const [copying, setCopying] = useState(false);

    const loadConference = useCallback(() => {
        api.get(`/admin/conferences/${conferenceId}`, { skipErrorToast: true }).then((r) => setConference(r.data?.data)).catch(() => setConference(false));
    }, [conferenceId]);
    useEffect(() => { loadConference(); }, [loadConference]);

    const access = conference?.my_access ?? {};
    // Desk staff see only the desk; chairs and organisers see the whole conference.
    const tabs = TABS.filter((t) => (t.key === 'checkin' ? access.checks_in : access.manages));
    const current = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key;

    const pick = (key) => {
        setTab(key);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', key);
        window.history.replaceState(window.history.state, '', url);
    };

    const duplicate = async () => {
        setCopying(true);
        try {
            const r = await api.post(`/admin/conferences/${conferenceId}/duplicate`, { shift_years: 1 });
            success(`${r.data?.message ?? 'Copied.'} Dates moved on a year — check them in the editor.`);
            window.location.href = `/admin/conferences/${r.data?.data?.id}/attendance?tab=overview`;
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not copy the conference.');
        }
        setCopying(false);
    };

    if (conference === false || (conference && tabs.length === 0)) {
        return <AppLayout breadcrumb="Conference"><Panel bodyClassName="p-0"><EmptyState icon={ShieldX} title="Not available" text="This conference does not exist, or you are not on its committee." /></Panel></AppLayout>;
    }

    return (
        <AppLayout breadcrumb="Conference">
            <div className="mx-auto max-w-7xl space-y-5">
                {access.organiser && <a href="/admin/conferences" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"><ArrowLeft size={14} /> Conferences</a>}
                <PageHeader icon={CalendarDays} color="emerald" title={conference ? conference.title : 'Conference'}
                    description={conference ? [formatDate(conference.start_date), conference.location_address].filter(Boolean).join(' · ') : ' '}>
                    {access.manages && <a href={`/admin/abstracts?conference_id=${conferenceId}`} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><FileText size={14} /> <span className="hidden sm:inline">Abstracts</span></a>}
                    {access.organiser && (
                        <button onClick={duplicate} disabled={copying} title="A new draft set up like this one — tracks, rubric, registration, speakers, sessions and committee — dates a year later"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            {copying ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} <span className="hidden sm:inline">Copy for next year</span>
                        </button>
                    )}
                    {current === 'checkin' && <RefreshButton onClick={() => window.location.reload()} label="Reload" />}
                </PageHeader>

                {conference && (
                    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1" role="tablist">
                        {tabs.map((t) => (
                            <button key={t.key} role="tab" aria-selected={current === t.key} onClick={() => pick(t.key)}
                                className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors', current === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                                <t.icon size={14} /> {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {!conference ? <Skeleton className="h-48" />
                    : current === 'overview' ? <ConferenceOverview conference={conference} onChanged={loadConference} />
                    : current === 'checkin' ? <CheckInDesk conferenceId={conferenceId} />
                    : current === 'certificates' ? <Certificates conferenceId={conferenceId} />
                    : current === 'feedback' ? <FeedbackResults conference={conference} onToggled={loadConference} />
                    : current === 'committee' ? <ConferenceCommittee conference={conference} />
                    : <ConferenceHistory conference={conference} />}
            </div>
        </AppLayout>
    );
}
