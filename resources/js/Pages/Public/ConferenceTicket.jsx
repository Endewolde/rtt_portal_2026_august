import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import {
    CalendarDays, MapPin, Video, CheckCircle2, Clock, XCircle, Award, Download, Star, Loader2, ArrowLeft, Ticket,
} from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import api from '../../lib/api';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

const CERT_LABEL = { attendance: 'Certificate of attendance', presentation: 'Certificate of presentation', reviewer: 'Certificate for peer review' };

function FeedbackForm({ code, onDone }) {
    const [rating, setRating] = useState(0);
    const [recommend, setRecommend] = useState(null);
    const [liked, setLiked] = useState('');
    const [improve, setImprove] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const send = async (e) => {
        e.preventDefault();
        if (!rating) { setError('Choose a rating first.'); return; }
        setBusy(true);
        setError('');
        try {
            await api.post(`/conference-tickets/${code}/feedback`, { rating, would_recommend: recommend, liked, improve }, { skipErrorToast: true });
            onDone();
        } catch (err) {
            setError(err.response?.data?.message ?? 'Could not send your feedback.');
        }
        setBusy(false);
    };

    return (
        <form onSubmit={send} className="space-y-4">
            <div>
                <p className="mb-2 text-sm font-medium text-gray-700">How was the conference overall?</p>
                <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} of 5`} onClick={() => setRating(n)}
                            className="rounded-lg p-1 transition-transform hover:scale-110">
                            <Star size={28} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Would you recommend it to a colleague?</p>
                <div className="flex gap-2">
                    {[[true, 'Yes'], [false, 'No']].map(([v, l]) => (
                        <button key={l} type="button" onClick={() => setRecommend(v)}
                            className={`rounded-xl border px-4 py-1.5 text-sm font-semibold ${recommend === v ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{l}</button>
                    ))}
                </div>
            </div>
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">What worked well?</span>
                <textarea rows={2} value={liked} onChange={(e) => setLiked(e.target.value)} maxLength={2000} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </label>
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">What should we improve next time?</span>
                <textarea rows={2} value={improve} onChange={(e) => setImprove(e.target.value)} maxLength={2000} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">Organisers see your answers without your name.</p>
                <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {busy && <Loader2 size={14} className="animate-spin" />} Send feedback
                </button>
            </div>
        </form>
    );
}

export default function ConferenceTicket() {
    const code = window.location.pathname.split('/').filter(Boolean).pop();
    const [ticket, setTicket] = useState(null);
    const [missing, setMissing] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [thanks, setThanks] = useState(false);

    const load = () => api.get(`/conference-tickets/${code}`, { skipErrorToast: true })
        .then((r) => setTicket(r.data?.data))
        .catch(() => setMissing(true));

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const cancel = async () => {
        setCancelling(true);
        try { await api.post(`/conference-tickets/${code}/cancel`); await load(); } catch { /* the api layer shows the error */ }
        setCancelling(false);
        setConfirmCancel(false);
    };

    const c = ticket?.conference;
    const status = ticket?.status;
    const canCancel = ticket && ['pending', 'confirmed', 'waitlisted'].includes(status) && !ticket.checked_in_at && !c?.is_past;

    return (
        <PublicLayout>
            <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
                {missing ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                        <XCircle size={32} className="mx-auto text-red-400" />
                        <p className="mt-3 text-lg font-bold text-gray-900">Ticket not found</p>
                        <p className="mt-1 text-sm text-gray-500">Check the link in your confirmation email.</p>
                    </div>
                ) : !ticket ? (
                    <div className="h-96 animate-pulse rounded-3xl bg-gray-100" />
                ) : (
                    <>
                        {c?.slug && (
                            <Link href={`/conferences/${c.slug}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
                                <ArrowLeft size={14} /> {c.title}
                            </Link>
                        )}

                        {/* The ticket */}
                        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                            <div className={`px-6 py-5 text-white ${status === 'confirmed' ? 'bg-indigo-700' : status === 'waitlisted' ? 'bg-amber-600' : 'bg-gray-500'}`}>
                                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/70"><Ticket size={12} /> {status === 'waitlisted' ? 'Waiting list' : status === 'cancelled' ? 'Cancelled' : 'Ticket'}</p>
                                <h1 className="mt-1 text-xl font-bold leading-snug">{c?.title}</h1>
                                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
                                    <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} /> {fmtDate(c?.start_date)} · {fmtTime(c?.start_date)}</span>
                                    {c?.location_type !== 'virtual' && c?.location_address && <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {c.location_address}</span>}
                                </p>
                            </div>

                            <div className="relative border-t border-dashed border-gray-200">
                                <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-gray-50 ring-1 ring-gray-200" aria-hidden="true" />
                                <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-gray-50 ring-1 ring-gray-200" aria-hidden="true" />
                            </div>

                            <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
                                <dl className="space-y-3 text-sm">
                                    <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Name</dt><dd className="font-semibold text-gray-900">{ticket.name}</dd></div>
                                    {ticket.organization && <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Organisation</dt><dd className="text-gray-700">{ticket.organization}</dd></div>}
                                    {ticket.type && <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Attending as</dt><dd className="text-gray-700">{ticket.type}</dd></div>}
                                    <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ticket code</dt><dd className="font-mono text-base font-bold tracking-widest text-gray-900">{ticket.ticket_code}</dd></div>
                                </dl>
                                {ticket.qr ? (
                                    <div className="mx-auto text-center">
                                        <img src={ticket.qr} alt={`QR code for ticket ${ticket.ticket_code}`} className="h-40 w-40 rounded-xl border border-gray-100 p-1.5 [image-rendering:pixelated]" />
                                        <p className="mt-1.5 text-[11px] text-gray-400">Show this at the registration desk</p>
                                    </div>
                                ) : status === 'waitlisted' ? (
                                    <div className="mx-auto rounded-2xl bg-amber-50 px-5 py-4 text-center">
                                        <p className="text-3xl font-bold text-amber-700">#{ticket.waitlist_position}</p>
                                        <p className="text-xs text-amber-800">on the waiting list</p>
                                    </div>
                                ) : null}
                            </div>

                            {ticket.checked_in_at && (
                                <p className="flex items-center gap-2 border-t border-gray-100 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-800">
                                    <CheckCircle2 size={15} /> Checked in {fmtDate(ticket.checked_in_at)}, {fmtTime(ticket.checked_in_at)}
                                </p>
                            )}
                            {status === 'waitlisted' && (
                                <p className="flex items-start gap-2 border-t border-gray-100 bg-amber-50/60 px-6 py-3 text-sm text-amber-900">
                                    <Clock size={15} className="mt-0.5 shrink-0" /> If a place opens up it goes to the next person on the list, and we email you. This page then becomes your ticket.
                                </p>
                            )}
                            {c?.virtual_link && (
                                <a href={c.virtual_link} target="_blank" rel="noreferrer" className="flex items-center gap-2 border-t border-gray-100 px-6 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50/50">
                                    <Video size={15} /> Join online
                                </a>
                            )}
                        </div>

                        {/* Certificates */}
                        {ticket.certificates?.length > 0 && (
                            <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><Award size={15} className="text-amber-500" /> Your certificates</h2>
                                <ul className="space-y-2">
                                    {ticket.certificates.map((cert) => (
                                        <li key={cert.code} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3.5 py-2.5">
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-gray-900">{CERT_LABEL[cert.kind]}</span>
                                                <span className="block font-mono text-[11px] text-gray-500">{cert.code}</span>
                                            </span>
                                            <a href={cert.url} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"><Download size={12} /> PDF</a>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Feedback */}
                        {ticket.feedback?.open && (
                            <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                <h2 className="mb-3 text-sm font-bold text-gray-900">Tell us how it went</h2>
                                {thanks || ticket.feedback.submitted ? (
                                    <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15} /> Thank you — your feedback has been received.{!thanks && ' You can send it again to change it.'}</p>
                                ) : null}
                                {!thanks && <div className={ticket.feedback.submitted ? 'mt-4' : ''}><FeedbackForm code={code} onDone={() => setThanks(true)} /></div>}
                            </section>
                        )}

                        {canCancel && (
                            <div className="mt-6 text-center">
                                {confirmCancel ? (
                                    <div className="inline-flex flex-wrap items-center justify-center gap-2 text-sm">
                                        <span className="text-gray-600">Give up your place?</span>
                                        <button onClick={cancel} disabled={cancelling} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{cancelling ? 'Cancelling…' : 'Yes, cancel'}</button>
                                        <button onClick={() => setConfirmCancel(false)} className="rounded-lg px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-100">Keep it</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setConfirmCancel(true)} className="text-sm font-medium text-gray-400 hover:text-red-600">
                                        {status === 'waitlisted' ? 'Leave the waiting list' : 'Cancel my registration'}
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </PublicLayout>
    );
}
