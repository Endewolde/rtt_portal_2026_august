import { useState, useEffect, useRef } from 'react';
import { Link } from '@inertiajs/react';
import {
    Calendar, Clock, MapPin, Video, Globe, Users, ArrowLeft,
    ExternalLink, Link2, Mail, ChevronDown, CheckCircle2, AlertCircle,
    Star, Building2, Mic, Coffee, Users2, Presentation, Layers,
    CalendarDays, Sparkles, Tag, X, ChevronRight, FileText, Send,
} from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';
import api from '../../lib/api';

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(targetDate) {
    const [timeLeft, setTimeLeft] = useState(null);
    useEffect(() => {
        if (!targetDate) return;
        const tick = () => {
            const diff = new Date(targetDate) - Date.now();
            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, started: true });
                return;
            }
            setTimeLeft({
                days:    Math.floor(diff / 86_400_000),
                hours:   Math.floor((diff % 86_400_000) / 3_600_000),
                minutes: Math.floor((diff % 3_600_000)  / 60_000),
                seconds: Math.floor((diff % 60_000)     / 1_000),
                started: false,
            });
        };
        tick();
        const t = setInterval(tick, 1_000);
        return () => clearInterval(t);
    }, [targetDate]);
    return timeLeft;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d, opts = {}) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', ...opts })
    : '—';
const fmtTime = d => d
    ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
const fmtDateTime = d => d ? `${fmtDate(d, { month: 'short' })} · ${fmtTime(d)}` : '—';

const SESSION_TYPE_CFG = {
    keynote:  { Icon: Star,         label: 'Keynote',  color: '#f59e0b', bg: '#fffbeb' },
    talk:     { Icon: Mic,          label: 'Talk',     color: '#3b82f6', bg: '#eff6ff' },
    workshop: { Icon: Layers,       label: 'Workshop', color: '#10b981', bg: '#f0fdf4' },
    panel:    { Icon: Users2,       label: 'Panel',    color: '#8b5cf6', bg: '#f5f3ff' },
    break:    { Icon: Coffee,       label: 'Break',    color: '#94a3b8', bg: '#f8fafc' },
    other:    { Icon: Presentation, label: 'Other',    color: '#64748b', bg: '#f8fafc' },
};

const TYPE_CFG = {
    physical: { label: 'In-Person', Icon: Building2, color: '#3b82f6' },
    virtual:  { label: 'Virtual',   Icon: Video,     color: '#10b981' },
    hybrid:   { label: 'Hybrid',    Icon: Globe,     color: '#8b5cf6' },
};

// ─── Countdown Block ──────────────────────────────────────────────────────────

function CountdownBlock({ startDate }) {
    const t = useCountdown(startDate);
    if (!t) return null;

    if (t.started) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-green-700">Conference is happening now!</span>
            </div>
        );
    }

    const units = [
        { label: 'Days',    val: t.days    },
        { label: 'Hours',   val: t.hours   },
        { label: 'Minutes', val: t.minutes },
        { label: 'Seconds', val: t.seconds },
    ];

    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Starts in</p>
            <div className="flex gap-2">
                {units.map(({ label, val }) => (
                    <div key={label}
                        className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl
                                   py-2.5 text-center min-w-0">
                        <div className="text-2xl font-black text-white tabular-nums leading-none">
                            {String(val).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] font-medium text-white/60 mt-1 uppercase tracking-wider">{label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Registration Form ────────────────────────────────────────────────────────

function RegistrationForm({ conference, onSuccess }) {
    const [form, setForm]     = useState({ name: '', email: '', organization: '', phone: '' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [done, setDone]     = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        setErrors({});
        setLoading(true);
        try {
            await api.post(`/conferences/${conference.slug}/register`, form);
            setDone(true);
            onSuccess?.();
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data?.errors ?? {});
            } else {
                setErrors({ general: err.response?.data?.message ?? 'Registration failed. Please try again.' });
            }
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="text-center py-8 px-4">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">You're registered!</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                    A confirmation email has been sent to <strong>{form.email}</strong>.
                    We look forward to seeing you!
                </p>
            </div>
        );
    }

    const field = (label, key, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {label} {key === 'name' || key === 'email' ? <span className="text-red-400">*</span> : ''}
            </label>
            <input
                type={type}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors
                            focus:outline-none focus:ring-2 focus:ring-indigo-500
                            ${errors[key] ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
            />
            {errors[key] && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors[key][0]}
                </p>
            )}
        </div>
    );

    return (
        <form onSubmit={submit} className="space-y-4">
            {errors.general && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    {errors.general}
                </div>
            )}
            {field('Full Name', 'name', 'text', 'Your full name')}
            {field('Email Address', 'email', 'email', 'you@example.com')}
            {field('Organization', 'organization', 'text', 'University / Company (optional)')}
            {field('Phone Number', 'phone', 'tel', '+251… (optional)')}
            <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold
                           hover:bg-indigo-700 active:scale-95 transition-all duration-150
                           disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {loading ? 'Registering…' : 'Register Now — It\'s Free'}
            </button>
        </form>
    );
}

// ─── Session Track ────────────────────────────────────────────────────────────

function AgendaTrack({ sessions }) {
    const tracks = [...new Set(sessions.map(s => s.track || 'Main'))];
    const [activeTrack, setActiveTrack] = useState(tracks[0]);

    const filtered = sessions.filter(s => (s.track || 'Main') === activeTrack);

    return (
        <div>
            {tracks.length > 1 && (
                <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                    {tracks.map(t => (
                        <button key={t} onClick={() => setActiveTrack(t)}
                            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                                activeTrack === t
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}>
                            {t}
                        </button>
                    ))}
                </div>
            )}
            <div className="space-y-3">
                {filtered.map((session, idx) => {
                    const cfg = SESSION_TYPE_CFG[session.type] ?? SESSION_TYPE_CFG.other;
                    const SIcon = cfg.Icon;
                    return (
                        <div key={session.id ?? idx}
                            className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
                            {/* Time column */}
                            <div className="w-20 shrink-0 text-right">
                                <span className="text-xs font-bold text-gray-900">{fmtTime(session.starts_at)}</span>
                                {session.ends_at && (
                                    <span className="block text-[10px] text-gray-400">{fmtTime(session.ends_at)}</span>
                                )}
                            </div>

                            {/* Accent line */}
                            <div className="w-0.5 self-stretch rounded-full shrink-0"
                                style={{ backgroundColor: cfg.color }} />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-gray-900 leading-snug">{session.title}</h4>
                                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ color: cfg.color, backgroundColor: cfg.bg }}>
                                        <SIcon size={9} /> {cfg.label}
                                    </span>
                                </div>
                                {session.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                        {session.description}
                                    </p>
                                )}
                                {session.speakers?.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <Mic size={10} className="text-gray-400" />
                                        <span className="text-[11px] text-gray-500">
                                            {session.speakers.map(s => s.name).join(', ')}
                                        </span>
                                    </div>
                                )}
                                {session.room && (
                                    <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                        {session.room}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Speaker Card ─────────────────────────────────────────────────────────────

function SpeakerCard({ speaker }) {
    const initials = speaker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg
                        hover:shadow-indigo-500/8 hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-start gap-4">
                {speaker.photo
                    ? <img src={speaker.photo} alt={speaker.name}
                           className="w-14 h-14 rounded-2xl object-cover shrink-0 ring-2 ring-white shadow" />
                    : <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600
                                      flex items-center justify-center text-white font-black text-lg shrink-0 shadow">
                          {initials}
                      </div>
                }
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 text-sm group-hover:text-indigo-700 transition-colors">
                        {speaker.name}
                    </h4>
                    {speaker.title && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{speaker.title}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        {speaker.email && (
                            <a href={`mailto:${speaker.email}`}
                                className="p-1 rounded-lg bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                <Mail size={12} />
                            </a>
                        )}
                        {speaker.website && (
                            <a href={speaker.website} target="_blank" rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                <ExternalLink size={12} />
                            </a>
                        )}
                        {speaker.linkedin && (
                            <a href={speaker.linkedin} target="_blank" rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                <Link2 size={12} />
                            </a>
                        )}
                        {speaker.twitter && (
                            <a href={speaker.twitter} target="_blank" rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                <Link2 size={12} />
                            </a>
                        )}
                    </div>
                </div>
            </div>
            {speaker.bio && (
                <p className="text-xs text-gray-400 mt-3 leading-relaxed line-clamp-3">{speaker.bio}</p>
            )}
        </div>
    );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────

function Tab({ active, onClick, children, count }) {
    return (
        <button onClick={onClick}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}>
            {children}
            {count != null && (
                <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                    {count}
                </span>
            )}
        </button>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConferenceDetail() {
    const [conference, setConference] = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [notFound,   setNotFound]   = useState(false);
    const [tab,        setTab]        = useState('about');
    const [regOpen,    setRegOpen]    = useState(false);

    const slug = window.location.pathname.split('/').filter(Boolean).pop();

    useEffect(() => {
        setLoading(true);
        get(`/conferences/${slug}`)
            .then(res => setConference(res.data?.data ?? res.data))
            .catch(err => {
                if (err.response?.status === 404) setNotFound(true);
            })
            .finally(() => setLoading(false));
    }, [slug]);

    if (loading) {
        return (
            <PublicLayout>
                <div className="max-w-5xl mx-auto px-6 py-12 space-y-6 animate-pulse">
                    <div className="h-72 rounded-3xl bg-gray-100" />
                    <div className="h-8 bg-gray-100 rounded-xl w-2/3" />
                    <div className="h-4 bg-gray-100 rounded-lg w-1/3" />
                </div>
            </PublicLayout>
        );
    }

    if (notFound || !conference) {
        return (
            <PublicLayout>
                <div className="text-center py-32">
                    <CalendarDays size={48} className="mx-auto text-gray-200 mb-4" />
                    <h2 className="text-xl font-bold text-gray-700">Conference not found</h2>
                    <p className="text-gray-400 mt-2 mb-6">This event may have been removed or the link is incorrect.</p>
                    <Link href="/conferences"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white
                                   rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
                        <ArrowLeft size={15} /> Back to Conferences
                    </Link>
                </div>
            </PublicLayout>
        );
    }

    const c    = conference;
    const type = TYPE_CFG[c.location_type] ?? TYPE_CFG.physical;
    const isOngoing  = c.start_date && new Date(c.start_date) <= Date.now() && (!c.end_date || new Date(c.end_date) >= Date.now());
    const isUpcoming = c.start_date && new Date(c.start_date) > Date.now();
    const isPast     = !isOngoing && !isUpcoming;

    const tabs = [
        { key: 'about',    label: 'About'    },
        { key: 'speakers', label: 'Speakers', count: c.speakers?.length ?? 0 },
        { key: 'agenda',   label: 'Agenda',   count: c.sessions?.length ?? 0 },
    ].filter(t => {
        if (t.key === 'speakers') return c.speakers?.length > 0;
        if (t.key === 'agenda')   return c.sessions?.length > 0;
        return true;
    });

    return (
        <PublicLayout>
            {/* ── Hero ── */}
            <div className="relative overflow-hidden">
                {/* Banner */}
                <div className="h-72 sm:h-96 w-full relative">
                    {c.banner_image
                        ? <img src={c.banner_image} alt={c.title}
                               className="w-full h-full object-cover" />
                        : <div className="w-full h-full"
                               style={{ background: `linear-gradient(135deg, ${type.color}33, ${type.color}88, #1e1b4b)` }}>
                              <div className="absolute inset-0 flex items-center justify-center">
                                  <CalendarDays size={80} style={{ color: `${type.color}44` }} />
                              </div>
                          </div>
                    }
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
                </div>

                {/* Back button */}
                <div className="absolute top-5 left-5 sm:top-6 sm:left-8">
                    <Link href="/conferences"
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/40 backdrop-blur-sm
                                   text-white/90 text-sm font-medium hover:bg-black/60 transition-colors">
                        <ArrowLeft size={14} /> Conferences
                    </Link>
                </div>

                {/* Title overlay */}
                <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 pb-8">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
                            style={{ backgroundColor: type.color }}>
                            <type.Icon size={10} /> {type.label}
                        </span>
                        {c.is_featured && (
                            <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1
                                             bg-amber-400 text-amber-900 rounded-full">
                                <Star size={9} className="fill-amber-900" /> Featured
                            </span>
                        )}
                        {isOngoing && (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1
                                             bg-green-500 text-white rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live Now
                            </span>
                        )}
                        {isPast && (
                            <span className="text-[11px] font-bold px-2.5 py-1 bg-white/20 text-white rounded-full">
                                Past Event
                            </span>
                        )}
                    </div>
                    <h1 className="text-white text-2xl sm:text-4xl font-extrabold leading-tight tracking-tight
                                   max-w-3xl drop-shadow-sm">
                        {c.title}
                    </h1>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="max-w-6xl mx-auto px-6 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ── Main content ── */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Tabs */}
                        <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-2xl overflow-x-auto">
                            {tabs.map(t => (
                                <Tab key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} count={t.count}>
                                    {t.label}
                                </Tab>
                            ))}
                        </div>

                        {/* ── About ── */}
                        {tab === 'about' && (
                            <div className="space-y-6">
                                {c.description && (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Sparkles size={16} className="text-indigo-500" /> About this Conference
                                        </h2>
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                                            {c.description}
                                        </p>
                                    </div>
                                )}

                                {/* Tags */}
                                {c.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        <Tag size={13} className="text-gray-400 mt-0.5" />
                                        {c.tags.map(t => (
                                            <span key={t}
                                                className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700
                                                           rounded-full font-medium border border-indigo-100">
                                                #{t}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Abstract submission CTA */}
                                {c.abstract_submission_open && (!c.abstract_deadline || new Date(c.abstract_deadline) > Date.now()) && (
                                    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                                                <FileText size={18} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-violet-900 text-sm mb-1">
                                                    Abstract Submissions Open
                                                </h3>
                                                <p className="text-xs text-violet-700 leading-relaxed mb-3">
                                                    Submit your research abstract for presentation at this conference.
                                                    {c.abstract_deadline && (
                                                        <span className="block mt-1 font-semibold">
                                                            Deadline: {new Date(c.abstract_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                </p>
                                                <Link
                                                    href={`/conferences/${c.slug}/submit-abstract`}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white
                                                               text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors
                                                               shadow-sm shadow-violet-300">
                                                    <Send size={13} /> Submit Abstract
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Registration CTA (mobile) */}
                                {!isPast && (
                                    <div className="lg:hidden">
                                        {c.is_full
                                            ? (
                                                <div className="w-full py-3.5 rounded-2xl bg-red-50 border border-red-200
                                                                text-red-700 font-bold text-sm text-center">
                                                    Conference Full — Registration Closed
                                                </div>
                                            ) : (
                                                <button onClick={() => setRegOpen(true)}
                                                    className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white
                                                               font-bold text-sm hover:bg-indigo-700 transition-colors
                                                               shadow-lg shadow-indigo-500/25">
                                                    Register for this Conference
                                                </button>
                                            )
                                        }
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Speakers ── */}
                        {tab === 'speakers' && (
                            <div>
                                <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                                    <Users size={16} className="text-indigo-500" />
                                    Speakers <span className="text-gray-400 font-normal">· {c.speakers.length}</span>
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {c.speakers.map(s => <SpeakerCard key={s.id} speaker={s} />)}
                                </div>
                            </div>
                        )}

                        {/* ── Agenda ── */}
                        {tab === 'agenda' && (
                            <div>
                                <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                                    <Calendar size={16} className="text-indigo-500" />
                                    Agenda <span className="text-gray-400 font-normal">· {c.sessions.length} sessions</span>
                                </h2>
                                <AgendaTrack sessions={c.sessions} />
                            </div>
                        )}
                    </div>

                    {/* ── Sidebar ── */}
                    <div className="space-y-5">

                        {/* Countdown */}
                        {isUpcoming && (
                            <div className="rounded-2xl p-5 text-white"
                                style={{ background: `linear-gradient(135deg, ${type.color}, #1e1b4b)` }}>
                                <CountdownBlock startDate={c.start_date} />
                            </div>
                        )}

                        {/* Registration card */}
                        {!isPast && (
                            <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${
                                c.is_full ? 'border-red-100' : 'border-gray-100'
                            }`}>
                                <div className={`px-5 py-4 border-b ${c.is_full ? 'border-red-50 bg-red-50/60' : 'border-gray-50'}`}>
                                    <h3 className="font-bold text-gray-900 text-sm">
                                        {c.is_full ? 'Registration Closed' : 'Register'}
                                    </h3>
                                    {c.is_full
                                        ? <p className="text-xs text-red-600 mt-0.5 font-medium">This event has reached full capacity</p>
                                        : (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Free · Confirmation by email
                                                {c.spots_remaining != null && (
                                                    <span className={`ml-2 font-semibold ${
                                                        c.spots_remaining <= 5 ? 'text-orange-600' : 'text-green-600'
                                                    }`}>
                                                        · {c.spots_remaining} spot{c.spots_remaining !== 1 ? 's' : ''} left
                                                    </span>
                                                )}
                                            </p>
                                        )
                                    }
                                </div>
                                <div className="p-5">
                                    {c.is_full ? (
                                        <div className="text-center py-3">
                                            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
                                                <Users size={24} className="text-red-400" />
                                            </div>
                                            <p className="text-sm font-semibold text-gray-700 mb-1">No spots remaining</p>
                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                All {c.max_capacity} available spots have been filled.
                                                Check back in case a spot opens up.
                                            </p>
                                            {c.registration_link && (
                                                <a href={c.registration_link} target="_blank" rel="noopener noreferrer"
                                                    className="block mt-3 text-xs text-indigo-500 hover:text-indigo-700 transition-colors font-medium">
                                                    Try external registration →
                                                </a>
                                            )}
                                        </div>
                                    ) : regOpen ? (
                                        <RegistrationForm conference={c} onSuccess={() => {}} />
                                    ) : (
                                        <div className="text-center py-2">
                                            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                                                {isOngoing
                                                    ? 'The conference is happening now. Register to be counted.'
                                                    : 'Secure your spot at this event.'}
                                            </p>
                                            <button onClick={() => setRegOpen(true)}
                                                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold
                                                           text-sm hover:bg-indigo-700 active:scale-95 transition-all
                                                           shadow-lg shadow-indigo-500/20">
                                                Register for Free
                                            </button>
                                            {c.registration_link && (
                                                <a href={c.registration_link} target="_blank" rel="noopener noreferrer"
                                                    className="block mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                                    Or use external registration →
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Abstract submission sidebar card */}
                        {c.abstract_submission_open && (!c.abstract_deadline || new Date(c.abstract_deadline) > Date.now()) && (
                            <div className="bg-linear-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText size={16} className="text-violet-200" />
                                    <h3 className="font-bold text-sm">Submit Abstract</h3>
                                </div>
                                <p className="text-xs text-violet-200 leading-relaxed mb-3">
                                    Abstract submissions are open for this conference.
                                    {c.abstract_deadline && (
                                        <span className="block mt-1 font-semibold text-white">
                                            Due: {new Date(c.abstract_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    )}
                                </p>
                                <Link
                                    href={`/conferences/${c.slug}/submit-abstract`}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                                               bg-white text-violet-700 font-bold text-sm
                                               hover:bg-violet-50 active:scale-95 transition-all">
                                    <Send size={13} /> Submit Your Abstract
                                </Link>
                            </div>
                        )}

                        {/* Details card */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                            <h3 className="font-bold text-gray-900 text-sm">Event Details</h3>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                        <Calendar size={14} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Date</p>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {fmtDate(c.start_date)}
                                            {c.end_date && <><br /><span className="font-normal text-gray-500">to {fmtDate(c.end_date)}</span></>}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                        <Clock size={14} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Time</p>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {fmtTime(c.start_date)} <span className="font-normal text-gray-400">{c.timezone}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                        <type.Icon size={14} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Format</p>
                                        <p className="text-sm font-semibold text-gray-900">{type.label}</p>
                                    </div>
                                </div>

                                {c.location_address && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                            <MapPin size={14} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Venue</p>
                                            <p className="text-sm font-semibold text-gray-900">{c.location_address}</p>
                                        </div>
                                    </div>
                                )}

                                {c.virtual_link && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                                            <Globe size={14} className="text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Join Online</p>
                                            <a href={c.virtual_link} target="_blank" rel="noopener noreferrer"
                                                className="text-sm font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                                                Join Link <ExternalLink size={11} />
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {c.max_capacity && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                                            <Users size={14} className="text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Capacity</p>
                                            <p className="text-sm font-semibold text-gray-900">{c.max_capacity.toLocaleString()} attendees</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Speakers mini-list */}
                        {c.speakers?.length > 0 && tab !== 'speakers' && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-900 text-sm">Speakers</h3>
                                    <button onClick={() => setTab('speakers')}
                                        className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 transition-colors">
                                        View all
                                    </button>
                                </div>
                                <div className="flex -space-x-2">
                                    {c.speakers.slice(0, 6).map((s, i) => (
                                        s.photo
                                            ? <img key={s.id} src={s.photo} alt={s.name}
                                                   title={s.name}
                                                   className="w-9 h-9 rounded-full object-cover ring-2 ring-white"
                                                   style={{ zIndex: 10 - i }} />
                                            : <div key={s.id} title={s.name}
                                                   className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-violet-600
                                                              ring-2 ring-white flex items-center justify-center
                                                              text-white text-xs font-bold"
                                                   style={{ zIndex: 10 - i }}>
                                                  {s.name[0]}
                                              </div>
                                    ))}
                                    {c.speakers.length > 6 && (
                                        <div className="w-9 h-9 rounded-full bg-gray-100 ring-2 ring-white
                                                         flex items-center justify-center text-xs font-bold text-gray-500"
                                             style={{ zIndex: 0 }}>
                                            +{c.speakers.length - 6}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Back link */}
                        <Link href="/conferences"
                            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors py-1">
                            <ArrowLeft size={13} /> All Conferences
                        </Link>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
