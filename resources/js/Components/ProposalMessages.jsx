import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Paperclip, Send, X, Download, Loader2, Users, ShieldCheck } from 'lucide-react';
import api, { get } from '../lib/api';
import { downloadFile } from '../lib/download';
import { translate as tr } from '../lib/i18n';
import { useToast } from './Toast';

const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The proposal's message thread between the research team and the staff handling
 * it. Messages are kept on the record; attachments are private to the thread.
 */
export default function ProposalMessages({ proposalId, onRead }) {
    const { error } = useToast();
    const [messages, setMessages] = useState(null);
    const [body, setBody] = useState('');
    const [file, setFile] = useState(null);
    const [sending, setSending] = useState(false);
    const [isTeam, setIsTeam] = useState(false);
    const endRef = useRef(null);
    const fileRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const r = await get(`/proposals/${proposalId}/messages`);
            setMessages(r.data ?? []);
            setIsTeam(!!r.meta?.is_team);
            onRead?.();
        } catch (e) {
            setMessages([]);
            error(e.response?.data?.message ?? tr('Could not load the messages.'));
        }
    }, [proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [load]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages?.length]);

    const send = async () => {
        if (!body.trim()) return;
        setSending(true);
        try {
            const form = new FormData();
            form.append('body', body.trim());
            if (file) form.append('attachment', file);
            await api.post(`/proposals/${proposalId}/messages`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setBody('');
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
            load();
        } catch (e) {
            const errs = e.response?.data?.errors;
            error(errs ? Object.values(errs).flat()[0] : (e.response?.data?.message ?? tr('The message could not be sent.')));
        }
        setSending(false);
    };

    const download = (m) => downloadFile(`/proposal-messages/${m.id}/attachment`, m.attachment_name || 'attachment').catch(() => error(tr('The attachment could not be downloaded.')));

    return (
        <div className="flex flex-col">
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <MessageSquare size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span>{tr('Ask and answer questions about this proposal here. Everything is kept on the record. Reviewers cannot see this conversation.')}</span>
            </div>

            <div className="max-h-[28rem] min-h-40 space-y-3 overflow-y-auto pr-1">
                {messages === null ? (
                    [0, 1, 2].map((i) => <div key={i} className={`h-14 w-2/3 animate-pulse rounded-2xl bg-gray-100 ${i % 2 ? 'ml-auto' : ''}`} />)
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center">
                        <MessageSquare size={24} className="text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">{tr('No messages yet.')}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{isTeam ? tr('Write to the office handling your proposal.') : tr('Write to the research team.')}</p>
                    </div>
                ) : messages.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${m.mine ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md border border-gray-200 bg-white text-gray-800'} ${m.new ? 'ring-2 ring-amber-300' : ''}`}>
                            <div className={`mb-1 flex flex-wrap items-center gap-x-2 text-[11px] ${m.mine ? 'text-indigo-100' : 'text-gray-500'}`}>
                                <span className="font-semibold">{m.mine ? tr('You') : m.author}</span>
                                <span className="inline-flex items-center gap-1">
                                    {m.from_team ? <Users size={10} /> : <ShieldCheck size={10} />} {m.from_team ? tr('Research team') : tr('Office')}
                                </span>
                                <span>· {when(m.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-line text-sm leading-relaxed">{m.body}</p>
                            {m.has_attachment && (
                                <button onClick={() => download(m)}
                                    className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${m.mine ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                    <Download size={12} /> <span className="truncate">{m.attachment_name}</span>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-2 focus-within:ring-2 focus-within:ring-indigo-200">
                <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
                    placeholder={tr('Write a message…')}
                    className="w-full resize-none bg-transparent px-2 py-1.5 text-base focus:outline-none sm:text-sm" />
                <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-1 pt-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.csv,.zip" />
                        {file ? (
                            <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                                <Paperclip size={12} className="shrink-0" /> <span className="truncate">{file.name}</span>
                                <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label={tr('Remove attachment')}><X size={12} /></button>
                            </span>
                        ) : (
                            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">
                                <Paperclip size={13} /> {tr('Attach a file')}
                            </button>
                        )}
                    </div>
                    <button onClick={send} disabled={sending || !body.trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {tr('Send')}
                    </button>
                </div>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-gray-400">{tr('Ctrl + Enter to send · attachments up to 10 MB')}</p>
        </div>
    );
}
