import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { MessageCircleQuestion, X, Send, ThumbsUp, ThumbsDown, ArrowRight, ChevronDown, ChevronUp, BookOpen, Sparkles, RotateCcw } from 'lucide-react';
import { get, post } from '../lib/api';
import HelpBody from './HelpBody';

const STORAGE_KEY = 'rtt_assistant_chat';

const load = () => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
};
const save = (messages) => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch { /* private mode */ }
};

const TONE = { danger: 'border-rose-200 bg-rose-50/60', success: 'border-emerald-200 bg-emerald-50/60', default: 'border-gray-200 bg-white' };

function ArticleAnswer({ article, defaultOpen }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-gray-200 bg-white">
            <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left">
                <BookOpen size={14} className="mt-0.5 shrink-0 text-indigo-500" />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">{article.title}</span>
                    {!open && <span className="block text-xs text-gray-500">{article.summary}</span>}
                </span>
                {open ? <ChevronUp size={14} className="mt-0.5 text-gray-400" /> : <ChevronDown size={14} className="mt-0.5 text-gray-400" />}
            </button>
            {open && (
                <div className="border-t border-gray-100 px-3 py-3">
                    <HelpBody text={article.body} />
                    <div className="mt-3 flex flex-wrap gap-2">
                        {article.action_url && (
                            <Link href={article.action_url} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                                {article.action_label || 'Open'} <ArrowRight size={12} />
                            </Link>
                        )}
                        <Link href={`/help/${article.slug}`} className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Full article</Link>
                    </div>
                </div>
            )}
        </div>
    );
}

function AssistantMessage({ message, onFeedback }) {
    const a = message.answer;
    return (
        <div className="space-y-2">
            <p className="text-sm text-gray-800">{a.message}</p>
            {a.cards?.map((c, i) => (
                <div key={i} className={`rounded-xl border px-3 py-2.5 ${TONE[c.tone] ?? TONE.default}`}>
                    <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                    {c.subtitle && <p className="font-mono text-[11px] text-gray-500">{c.subtitle}</p>}
                    {c.lines?.map((l, j) => <p key={j} className="text-xs text-gray-600">{l}</p>)}
                    {c.action && (
                        <Link href={c.action.url} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
                            {c.action.label} <ArrowRight size={12} />
                        </Link>
                    )}
                </div>
            ))}
            {a.articles?.map((art, i) => <ArticleAnswer key={art.slug} article={art} defaultOpen={i === 0} />)}
            {a.action && (
                <Link href={a.action.url} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                    {a.action.label} <ArrowRight size={12} />
                </Link>
            )}
            {a.query_id && (
                <div className="flex items-center gap-1 pt-0.5 text-[11px] text-gray-400">
                    {message.feedback === undefined ? (
                        <>
                            <span>Was this helpful?</span>
                            <button onClick={() => onFeedback(true)} aria-label="Helpful" className="rounded p-1 hover:bg-gray-100 hover:text-emerald-600"><ThumbsUp size={12} /></button>
                            <button onClick={() => onFeedback(false)} aria-label="Not helpful" className="rounded p-1 hover:bg-gray-100 hover:text-rose-600"><ThumbsDown size={12} /></button>
                        </>
                    ) : <span>Thanks for the feedback.</span>}
                </div>
            )}
        </div>
    );
}

/** "Ask" — the help assistant available on every signed-in page. */
export default function AssistantPanel() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState(load);
    const [suggestions, setSuggestions] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const endRef = useRef(null);
    const inputRef = useRef(null);
    const page = typeof window !== 'undefined' ? window.location.pathname : '/';

    useEffect(() => { save(messages); }, [messages]);

    useEffect(() => {
        if (!open) return;
        get('/assistant/suggestions', { page }).then((r) => setSuggestions(r.data ?? [])).catch(() => {});
        setTimeout(() => inputRef.current?.focus(), 50);
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, open]);

    const ask = async (text) => {
        const q = text.trim();
        if (q.length < 2 || busy) return;
        setInput('');
        setMessages((m) => [...m, { role: 'user', text: q }]);
        setBusy(true);
        try {
            const res = await post('/assistant/ask', { q, page }, { skipErrorToast: true });
            setMessages((m) => [...m, { role: 'assistant', answer: res.data }]);
            if (res.data?.suggestions?.length) setSuggestions(res.data.suggestions);
        } catch (e) {
            setMessages((m) => [...m, { role: 'assistant', answer: { message: e.response?.status === 429 ? 'You are asking very quickly — please wait a moment and try again.' : "Sorry, I couldn't answer just now. Please try again." } }]);
        }
        setBusy(false);
    };

    const feedback = (index, helpful) => {
        const msg = messages[index];
        setMessages((m) => m.map((x, i) => (i === index ? { ...x, feedback: helpful } : x)));
        post(`/assistant/queries/${msg.answer.query_id}/feedback`, { helpful }, { skipErrorToast: true }).catch(() => {});
    };

    return (
        <>
            {!open && (
                <button onClick={() => setOpen(true)} aria-label="Ask for help" data-tour="assistant"
                    className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-indigo-600 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 print:hidden">
                    <MessageCircleQuestion size={18} /> Ask
                </button>
            )}

            {open && (
                <div role="dialog" aria-label="Help assistant"
                    className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100vh-40px))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-2xl">
                    <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-4 py-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><Sparkles size={17} /></span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">Ask RTT</p>
                            <p className="text-[11px] text-gray-500">Help with the platform and your own work</p>
                        </div>
                        {messages.length > 0 && (
                            <button onClick={() => setMessages([])} aria-label="New conversation" title="New conversation" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><RotateCcw size={15} /></button>
                        )}
                        <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={16} /></button>
                    </header>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        {messages.length === 0 && (
                            <div className="rounded-xl bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
                                Hi! Ask how to do something — like <em>“How do I submit a proposal?”</em> — or about your own work, like <em>“Which reviews are due?”</em> or a tracker number.
                            </div>
                        )}
                        {messages.map((m, i) => (m.role === 'user' ? (
                            <div key={i} className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2 text-sm text-white">{m.text}</p></div>
                        ) : (
                            <AssistantMessage key={i} message={m} onFeedback={(helpful) => feedback(i, helpful)} />
                        )))}
                        {busy && <div className="flex gap-1 px-1">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
                        <div ref={endRef} />
                    </div>

                    {suggestions.length > 0 && (
                        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-gray-100 px-4 py-2 [scrollbar-width:none]">
                            {suggestions.map((s) => (
                                <button key={s} onClick={() => ask(s)} disabled={busy}
                                    className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50">{s}</button>
                            ))}
                        </div>
                    )}

                    <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-3 py-3">
                        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
                            placeholder="Ask a question or paste a tracker number…" aria-label="Your question"
                            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                        <button type="submit" disabled={busy || input.trim().length < 2} aria-label="Send"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"><Send size={16} /></button>
                    </form>
                </div>
            )}
        </>
    );
}
