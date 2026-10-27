import { useState, useCallback, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import {
    Search, Mail, AlertCircle, CalendarDays, ArrowRight, CheckCircle2,
    Copy, Check, X, ChevronDown, FileText, Clock, Layers,
    Mic, ImageIcon, Users2, MoreHorizontal,
} from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';
import api from '../../lib/api';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
    draft: {
        label: 'Draft',
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        ring: 'ring-gray-200',
        dot: 'bg-gray-400',
    },
    submitted: {
        label: 'Submitted',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        ring: 'ring-blue-200',
        dot: 'bg-blue-500',
    },
    under_review: {
        label: 'Under Review',
        bg: 'bg-violet-50',
        text: 'text-violet-700',
        ring: 'ring-violet-200',
        dot: 'bg-violet-500',
    },
    revision_requested: {
        label: 'Revision Requested',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        ring: 'ring-amber-200',
        dot: 'bg-amber-500',
    },
    accepted: {
        label: 'Accepted',
        bg: 'bg-green-50',
        text: 'text-green-700',
        ring: 'ring-green-200',
        dot: 'bg-green-500',
    },
    rejected: {
        label: 'Rejected',
        bg: 'bg-red-50',
        text: 'text-red-600',
        ring: 'ring-red-200',
        dot: 'bg-red-400',
    },
    withdrawn: {
        label: 'Withdrawn',
        bg: 'bg-gray-100',
        text: 'text-gray-400',
        ring: 'ring-gray-200',
        dot: 'bg-gray-300',
        strikethrough: true,
    },
};

const WITHDRAWABLE_STATUSES = ['draft', 'submitted', 'under_review', 'revision_requested'];

// ─── Presentation type icons ──────────────────────────────────────────────────

const PTYPE_ICON = {
    oral:     Mic,
    poster:   ImageIcon,
    workshop: Layers,
    panel:    Users2,
    other:    MoreHorizontal,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByConference(abstracts) {
    return abstracts.reduce((acc, ab) => {
        const key = ab.conference_slug ?? ab.conference_id ?? 'unknown';
        if (!acc[key]) {
            acc[key] = {
                conferenceName: ab.conference_name ?? ab.conference?.title ?? 'Unknown Conference',
                conferenceSlug: ab.conference_slug ?? ab.conference?.slug ?? null,
                abstracts: [],
            };
        }
        acc[key].abstracts.push(ab);
        return acc;
    }, {});
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full
                          ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}
                          ${cfg.strikethrough ? 'line-through opacity-70' : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

// ─── Token Copy Button ────────────────────────────────────────────────────────

function TokenButton({ token }) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(token).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <button
            onClick={copy}
            title={copied ? 'Copied!' : 'Copy tracking token'}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                        transition-all duration-200 border
                        ${copied
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                        }`}
        >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : token?.slice(0, 12) + '…'}
        </button>
    );
}

// ─── Abstract Card ────────────────────────────────────────────────────────────

function AbstractCard({ abstract, onWithdraw }) {
    const [withdrawing, setWithdrawing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const canWithdraw = WITHDRAWABLE_STATUSES.includes(abstract.status);
    const PTypeIcon   = PTYPE_ICON[abstract.presentation_type] ?? MoreHorizontal;

    const handleWithdraw = async () => {
        setWithdrawing(true);
        try {
            await api.post(`/abstracts/withdraw/${abstract.submission_token}`);
            onWithdraw(abstract.submission_token);
        } catch {
            // ignore — api.js handles error toasts
        } finally {
            setWithdrawing(false);
            setConfirmOpen(false);
        }
    };

    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                         hover:shadow-md transition-shadow duration-200
                         ${abstract.status === 'withdrawn' ? 'opacity-70' : ''}`}>
            <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold text-gray-900 leading-snug ${abstract.status === 'withdrawn' ? 'line-through text-gray-500' : ''}`}>
                            {abstract.title}
                        </p>
                    </div>
                    <StatusBadge status={abstract.status} />
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                        <Clock size={10} />
                        Submitted {fmtDate(abstract.submitted_at ?? abstract.created_at)}
                    </span>
                    {abstract.word_count != null && (
                        <span className="flex items-center gap-1">
                            <FileText size={10} />
                            {abstract.word_count} words
                        </span>
                    )}
                    {abstract.presentation_type && (
                        <span className="flex items-center gap-1">
                            <PTypeIcon size={10} />
                            {abstract.presentation_type.charAt(0).toUpperCase() + abstract.presentation_type.slice(1)}
                        </span>
                    )}
                </div>

                {abstract.feedback && (
                    <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Committee feedback</p>
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-700">{abstract.feedback}</p>
                    </div>
                )}
                {['draft', 'revision_requested'].includes(abstract.status) && abstract.conference?.slug && (
                    <Link href={`/conferences/${abstract.conference.slug}/submit-abstract?token=${abstract.submission_token}`}
                        className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                        {abstract.status === 'draft' ? 'Continue draft' : 'Revise and resubmit'} <ArrowRight size={12} />
                    </Link>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-50">
                    <TokenButton token={abstract.submission_token} />

                    {canWithdraw && !confirmOpen && (
                        <button
                            onClick={() => setConfirmOpen(true)}
                            className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
                        >
                            Withdraw
                        </button>
                    )}

                    {confirmOpen && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium">Confirm?</span>
                            <button
                                onClick={handleWithdraw}
                                disabled={withdrawing}
                                className="text-xs font-bold px-3 py-1.5 bg-red-600 text-white rounded-lg
                                           hover:bg-red-700 transition-colors disabled:opacity-60"
                            >
                                {withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}
                            </button>
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Conference Group ─────────────────────────────────────────────────────────

function ConferenceGroup({ name, slug, abstracts, onWithdraw }) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-100/50 transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                        <CalendarDays size={15} className="text-white" />
                    </div>
                    <div className="text-left min-w-0">
                        {slug ? (
                            <Link
                                href={`/conferences/${slug}`}
                                onClick={e => e.stopPropagation()}
                                className="text-sm font-bold text-gray-900 hover:text-indigo-700 transition-colors
                                           flex items-center gap-1 group"
                            >
                                <span className="truncate">{name}</span>
                                <ArrowRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        ) : (
                            <p className="text-sm font-bold text-gray-900 truncate">{name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                            {abstracts.length} abstract{abstracts.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <ChevronDown
                    size={16}
                    className={`text-gray-400 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Abstract cards */}
            {expanded && (
                <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {abstracts.map(ab => (
                        <AbstractCard key={ab.id ?? ab.submission_token} abstract={ab} onWithdraw={onWithdraw} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyAbstracts() {
    const [email,     setEmail]     = useState('');
    const [abstracts, setAbstracts] = useState([]);
    const [loading,   setLoading]   = useState(false);
    const [searched,  setSearched]  = useState(false);
    const [error,     setError]     = useState(null);
    const [sent,      setSent]      = useState(null);

    // Opened from the emailed link: show that address's abstracts.
    useEffect(() => {
        const key = new URLSearchParams(window.location.search).get('key');
        if (!key) return;
        setLoading(true);
        get('/abstracts/mine', { key })
            .then((res) => {
                setAbstracts(res?.data ?? []);
                setEmail(res?.meta?.email ?? '');
                setSearched(true);
            })
            .catch((e) => setError(e.response?.data?.message ?? 'This link has expired. Ask for a new one below.'))
            .finally(() => setLoading(false));
    }, []);

    // For privacy the list is never shown for a typed address — a link is emailed to it.
    const search = useCallback(async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true);
        setError(null);
        setSent(null);
        try {
            const res = await api.post('/abstracts/mine/link', { email: email.trim() });
            setSent(res.data?.message ?? 'Check your inbox for a link to your abstracts.');
        } catch (e) {
            setError(e.response?.status === 429 ? 'Too many requests — please wait a few minutes and try again.' : 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [email]);

    const handleWithdraw = (token) => {
        setAbstracts(prev => prev.map(ab =>
            ab.submission_token === token ? { ...ab, status: 'withdrawn' } : ab
        ));
    };

    const grouped  = groupByConference(abstracts);
    const groupArr = Object.values(grouped);

    return (
        <PublicLayout>
            {/* ── Hero ── */}
            <div className="relative overflow-hidden bg-linear-to-br from-indigo-950 via-indigo-900 to-violet-900">
                <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-violet-600/20 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-indigo-400/10 blur-3xl" />
                <div className="relative max-w-4xl mx-auto px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest
                                    bg-white/10 text-indigo-300 border border-white/10 px-3 py-1 rounded-full mb-5">
                        <FileText size={10} /> Abstract Tracker
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 leading-tight">
                        My Submitted Abstracts
                    </h1>
                    <p className="text-indigo-200 text-base max-w-xl mx-auto leading-relaxed">
                        Enter the email address you used when submitting — we'll email you a private link to all your submissions.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-10">

                {/* ── Email lookup form ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
                    <form onSubmit={search} className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Enter your email address…"
                                required
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm
                                           bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                                           focus:ring-indigo-500 transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !email.trim()}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white
                                       text-sm font-bold rounded-xl hover:bg-indigo-700 active:scale-95
                                       transition-all shadow-lg shadow-indigo-500/20
                                       disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                        >
                            <Search size={15} />
                            {loading ? 'Sending…' : 'Email me a link'}
                        </button>
                    </form>

                    {sent && (
                        <div className="flex items-start gap-2 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                            {sent}
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertCircle size={14} className="shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                {/* ── Loading skeleton ── */}
                {loading && (
                    <div className="space-y-4">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="bg-gray-100 rounded-2xl h-40 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* ── Results ── */}
                {!loading && searched && (
                    <>
                        {/* Summary bar */}
                        <div className="flex items-center justify-between mb-5">
                            <p className="text-sm text-gray-500">
                                Found{' '}
                                <span className="font-bold text-gray-900">{abstracts.length}</span>{' '}
                                abstract{abstracts.length !== 1 ? 's' : ''} for{' '}
                                <span className="font-semibold text-indigo-600">{email}</span>
                            </p>
                            {abstracts.length > 0 && (
                                <p className="text-xs text-gray-400">
                                    {groupArr.length} conference{groupArr.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>

                        {/* Empty state */}
                        {abstracts.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                                <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
                                    <FileText size={36} className="text-indigo-300" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-700 mb-2">No abstracts found</h3>
                                <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
                                    We couldn't find any submissions for <strong>{email}</strong>. Double-check the email
                                    address you used when submitting.
                                </p>
                                <div className="mt-6">
                                    <Link
                                        href="/conferences"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white
                                                   text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                                    >
                                        Browse Conferences <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {groupArr.map(group => (
                                    <ConferenceGroup
                                        key={group.conferenceSlug ?? group.conferenceName}
                                        name={group.conferenceName}
                                        slug={group.conferenceSlug}
                                        abstracts={group.abstracts}
                                        onWithdraw={handleWithdraw}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ── Pre-search CTA ── */}
                {!searched && !loading && (
                    <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                            <Search size={28} className="text-indigo-300" />
                        </div>
                        <h3 className="text-base font-bold text-gray-700 mb-1">Enter your email to get a link</h3>
                        <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
                            All your abstract submissions will appear here, grouped by conference.
                        </p>
                        <Link
                            href="/conferences"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600
                                       hover:text-indigo-700 transition-colors"
                        >
                            Browse upcoming conferences <ArrowRight size={13} />
                        </Link>
                    </div>
                )}

                {/* ── Status legend ── */}
                {searched && abstracts.length > 0 && (
                    <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Status Guide</p>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                                <span key={key} className={`inline-flex items-center gap-1.5 text-xs font-semibold
                                                            px-2.5 py-1 rounded-full ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                    {cfg.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </PublicLayout>
    );
}
