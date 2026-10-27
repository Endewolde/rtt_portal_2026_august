import { useCallback, useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Handshake, Search, Sparkles, Users, Loader2, X, Check, Award, Building2, Inbox, ToggleLeft, ToggleRight, Send } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post, put } from '../../lib/api';
import { translate as tr } from '../../lib/i18n';
import { useToast } from '../../Components/Toast';

const STATUS = {
    requested: ['bg-amber-50 text-amber-700 ring-amber-200', 'Waiting for a reply'],
    active: ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'Active'],
    declined: ['bg-gray-50 text-gray-500 ring-gray-200', 'Declined'],
    ended: ['bg-gray-50 text-gray-500 ring-gray-200', 'Ended'],
};

const initials = (name = '') => name.replace(/^(Dr|Prof|Mr|Mrs|Ms)\.?\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function StatusPill({ status }) {
    const [tone, label] = STATUS[status] ?? STATUS.ended;
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}>{tr(label)}</span>;
}

function RequestModal({ mentor, proposals, onClose, onSent }) {
    const { success, error } = useToast();
    const [message, setMessage] = useState('');
    const [proposalId, setProposalId] = useState('');
    const [sending, setSending] = useState(false);

    const send = async () => {
        setSending(true);
        try {
            const r = await post('/mentorships', { mentor_id: mentor.id, proposal_id: proposalId || null, message });
            success(r.message ?? tr('Request sent.'));
            onSent();
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? tr('The request could not be sent.')));
        }
        setSending(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{tr('Ask :name to mentor you', { name: mentor.name })}</h2>
                        <p className="text-xs text-gray-500">{tr('Say what you are working on and what help you are looking for.')}</p>
                    </div>
                    <button onClick={onClose} aria-label={tr('Close')} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="space-y-4 px-6 py-5">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-gray-700">{tr('Your message')} *</span>
                        <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000}
                            placeholder={tr('e.g. I am preparing my first proposal on irrigation and would value advice on the methodology and budget.')}
                            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-300 sm:text-sm" />
                    </label>
                    {proposals.length > 0 && (
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-gray-700">{tr('About a proposal (optional)')}</span>
                            <select value={proposalId} onChange={(e) => setProposalId(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-300 sm:text-sm">
                                <option value="">{tr('General guidance')}</option>
                                {proposals.map((p) => <option key={p.id} value={p.id}>{p.tracker_number} — {p.title}</option>)}
                            </select>
                        </label>
                    )}
                </div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">{tr('Cancel')}</button>
                    <button onClick={send} disabled={sending || message.trim().length < 10}
                        className="inline-flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {tr('Send request')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MentorshipRow({ m, onChanged }) {
    const { success, error } = useToast();
    const [busy, setBusy] = useState(false);

    const act = async (path, body) => {
        setBusy(true);
        try {
            const r = await post(`/mentorships/${m.id}/${path}`, body);
            success(r.message);
            onChanged();
        } catch (e) {
            error(e.response?.data?.message ?? tr('That did not work.'));
        }
        setBusy(false);
    };

    return (
        <li className="px-5 py-4">
            <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">{initials(m.other)}</span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{m.other}</p>
                        <StatusPill status={m.status} />
                    </div>
                    {m.proposal && (
                        <Link href={`/proposals/${m.proposal.id}`} className="mt-0.5 block truncate text-xs text-indigo-600 hover:underline">
                            {m.proposal.tracker_number} — {m.proposal.title}
                        </Link>
                    )}
                    {m.message && <p className="mt-2 whitespace-pre-line rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">{m.message}</p>}
                    {m.response && <p className="mt-2 whitespace-pre-line rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900">{m.response}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                    {m.role === 'mentor' && m.status === 'requested' && (
                        <>
                            <button onClick={() => act('respond', { accept: false })} disabled={busy}
                                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">{tr('Decline')}</button>
                            <button onClick={() => act('respond', { accept: true })} disabled={busy}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check size={13} /> {tr('Accept')}</button>
                        </>
                    )}
                    {['requested', 'active'].includes(m.status) && !(m.role === 'mentor' && m.status === 'requested') && (
                        <button onClick={() => act('end', {})} disabled={busy}
                            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                            {m.status === 'requested' ? tr('Withdraw') : tr('End')}
                        </button>
                    )}
                </div>
            </div>
        </li>
    );
}

export default function Mentorship() {
    const { success, error } = useToast();
    const [mine, setMine] = useState(null);
    const [mentors, setMentors] = useState(null);
    const [query, setQuery] = useState('');
    const [asking, setAsking] = useState(null);
    const [note, setNote] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);

    const loadMine = useCallback(() => get('/mentorships').then((r) => { setMine(r.data); setNote(r.data?.settings?.mentor_note ?? ''); }).catch(() => setMine({ as_mentee: [], as_mentor: [], settings: {}, my_proposals: [] })), []);
    const loadMentors = useCallback(() => get('/mentors', query ? { q: query } : {}).then((r) => setMentors(r.data ?? [])).catch(() => setMentors([])), [query]);

    useEffect(() => { loadMine(); }, [loadMine]);
    useEffect(() => { const t = setTimeout(loadMentors, 300); return () => clearTimeout(t); }, [loadMentors]);

    const saveSettings = async (available) => {
        setSavingSettings(true);
        try {
            const r = await put('/mentorships/settings', { mentor_available: available, mentor_note: note });
            success(r.message);
            loadMine();
        } catch (e) {
            error(e.response?.data?.message ?? tr('Could not save.'));
        }
        setSavingSettings(false);
    };

    const settings = mine?.settings ?? {};
    const pendingForMe = (mine?.as_mentor ?? []).filter((m) => m.status === 'requested').length;

    return (
        <AppLayout breadcrumb="Mentorship">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-700 via-violet-700 to-fuchsia-700 px-6 py-7 text-white sm:px-8">
                    <span className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative flex items-start gap-4">
                        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex"><Handshake size={22} /></span>
                        <div>
                            <h1 className="text-2xl font-bold">{tr('Mentorship')}</h1>
                            <p className="mt-1 max-w-2xl text-sm text-indigo-100">{tr('Learn from colleagues who have led funded projects — or guide those just starting out.')}</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Find a mentor */}
                    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white lg:col-span-2">
                        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="font-semibold text-gray-900">{tr('Find a mentor')}</h2>
                            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 sm:w-72">
                                <Search size={15} className="shrink-0 text-gray-400" />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Name, college or expertise…')} className="w-full bg-transparent text-base focus:outline-none sm:text-sm" />
                            </div>
                        </div>
                        {mentors === null ? (
                            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}</div>
                        ) : mentors.length === 0 ? (
                            <div className="flex flex-col items-center px-6 py-14 text-center">
                                <Users size={26} className="text-gray-300" />
                                <p className="mt-2 text-sm text-gray-500">{query ? tr('No mentor matches your search.') : tr('No mentors are listed yet.')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {mentors.map((m) => (
                                    <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-100 to-violet-100 text-sm font-bold text-indigo-700">{initials(m.name)}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-gray-900">{m.name}</p>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                                {m.college && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {m.college}</span>}
                                                <span className="inline-flex items-center gap-1"><Award size={11} /> {tr(':count funded projects', { count: m.funded_projects })}</span>
                                                {m.mentees > 0 && <span>{tr('mentoring :count', { count: m.mentees })}</span>}
                                            </p>
                                            {m.note && <p className="mt-1.5 text-sm text-gray-600">{m.note}</p>}
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {m.expertise.slice(0, 6).map((e) => (
                                                    <span key={e} className={`rounded-full px-2 py-0.5 text-[11px] ${m.shared.includes(e) ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-600'}`}>{e}</span>
                                                ))}
                                            </div>
                                            {m.shared.length > 0 && <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700"><Sparkles size={11} /> {tr('Shares your interests')}</p>}
                                        </div>
                                        <div className="shrink-0">
                                            {m.my_request ? <StatusPill status={m.my_request} /> : (
                                                <button onClick={() => setAsking(m)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                                                    <Handshake size={14} /> {tr('Ask')}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* My settings */}
                    <section className="h-fit overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <div className="border-b border-gray-100 px-5 py-4">
                            <h2 className="font-semibold text-gray-900">{tr('Offer to mentor')}</h2>
                            <p className="text-xs text-gray-500">{tr('Open to anyone who has led a funded project.')}</p>
                        </div>
                        <div className="space-y-3 p-5">
                            {mine && !settings.eligible ? (
                                <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">{tr('Once you have led a funded project you can list yourself as a mentor here.')}</p>
                            ) : (
                                <>
                                    <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                                        placeholder={tr('What you can help with, e.g. methodology, budgets, community engagement…')}
                                        className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:text-sm" />
                                    <button onClick={() => saveSettings(!settings.mentor_available)} disabled={savingSettings || !mine}
                                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${settings.mentor_available ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                                        {settings.mentor_available ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                        {settings.mentor_available ? tr('Listed as a mentor — tap to stop') : tr('List me as a mentor')}
                                    </button>
                                    {settings.mentor_available && (
                                        <button onClick={() => saveSettings(true)} disabled={savingSettings} className="w-full text-xs font-medium text-indigo-600 hover:underline">{tr('Save note')}</button>
                                    )}
                                </>
                            )}
                        </div>
                    </section>
                </div>

                {/* My mentorships */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {[['as_mentor', tr('People asking you'), pendingForMe], ['as_mentee', tr('Your mentors'), 0]].map(([key, title, badge]) => (
                        <section key={key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
                                <h2 className="font-semibold text-gray-900">{title}</h2>
                                {badge > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{badge}</span>}
                            </div>
                            {!mine ? <div className="h-24 animate-pulse bg-gray-50" /> : (mine[key] ?? []).length === 0 ? (
                                <div className="flex flex-col items-center px-6 py-10 text-center">
                                    <Inbox size={22} className="text-gray-300" />
                                    <p className="mt-2 text-sm text-gray-500">{key === 'as_mentor' ? tr('No requests yet.') : tr('You have not asked anyone yet.')}</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {mine[key].map((m) => <MentorshipRow key={m.id} m={m} onChanged={() => { loadMine(); loadMentors(); }} />)}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            </div>

            {asking && (
                <RequestModal mentor={asking} proposals={mine?.my_proposals ?? []} onClose={() => setAsking(null)}
                    onSent={() => { setAsking(null); loadMine(); loadMentors(); }} />
            )}
        </AppLayout>
    );
}
