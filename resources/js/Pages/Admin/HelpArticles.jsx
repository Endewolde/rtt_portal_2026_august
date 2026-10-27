import { useEffect, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, X, Eye, ThumbsUp, ThumbsDown, MessageCircleQuestion, AlertCircle, RefreshCw } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post, put, del } from '../../lib/api';
import { useToast } from '../../Components/Toast';
import HelpBody from '../../Components/HelpBody';

const ROLES = [
    ['staff', 'Researchers & reviewers (staff)'], ['external_reviewer', 'External reviewers'], ['college_officer', 'College officers'],
    ['research_officer', 'Research director'], ['community_officer', 'Community director'], ['technology_officer', 'Technology director'],
    ['central_officer', 'Central office'], ['finance_officer', 'Finance'], ['support_officer', 'Support'], ['admin', 'Admins'], ['super_admin', 'Super admins'],
];

const EMPTY = { title: '', summary: '', body: '', category: '', roles: [], keywords: '', questions: '', page_paths: '', action_label: '', action_url: '', is_published: true };

function Editor({ article, categories, onClose, onSaved }) {
    const { success, error } = useToast();
    const [form, setForm] = useState(() => article ? { ...EMPTY, ...article, roles: article.roles ?? [], page_paths: (article.page_paths ?? []).join(', '), keywords: article.keywords ?? '', questions: article.questions ?? '', action_label: article.action_label ?? '', action_url: article.action_url ?? '' } : EMPTY);
    const [preview, setPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const save = async () => {
        setSaving(true);
        const payload = {
            ...form,
            page_paths: form.page_paths.split(',').map((p) => p.trim()).filter(Boolean),
            action_label: form.action_label || null,
            action_url: form.action_url || null,
        };
        try {
            const res = article ? await put(`/admin/help-articles/${article.id}`, payload) : await post('/admin/help-articles', payload);
            success(res.message);
            onSaved();
        } catch (e) {
            const errors = e.response?.data?.errors;
            error(errors ? Object.values(errors).flat()[0] : (e.response?.data?.message ?? 'Could not save the article.'));
        }
        setSaving(false);
    };

    const input = 'w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';
    const label = 'mb-1 block text-xs font-semibold text-gray-700';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" className="flex max-h-[94vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
                <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-900">{article ? 'Edit help article' : 'New help article'}</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </header>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-2"><label className={label}>Title *</label><input className={input} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Scheduling an open defence" /></div>
                        <div>
                            <label className={label}>Category *</label>
                            <input className={input} value={form.category} onChange={(e) => set('category', e.target.value)} list="help-categories" placeholder="e.g. Reviewing" />
                            <datalist id="help-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                        </div>
                    </div>
                    <div><label className={label}>Summary * <span className="font-normal text-gray-400">(one sentence shown in search results)</span></label><input className={input} value={form.summary} onChange={(e) => set('summary', e.target.value)} maxLength={500} /></div>
                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">Article * <span className="font-normal text-gray-400">— blank line between paragraphs, “1.” numbered steps, “- ” bullets, **bold**</span></label>
                            <button onClick={() => setPreview(!preview)} className="text-xs font-semibold text-indigo-600 hover:underline">{preview ? 'Edit' : 'Preview'}</button>
                        </div>
                        {preview
                            ? <div className="min-h-40 rounded-xl border border-gray-200 bg-gray-50 p-4"><HelpBody text={form.body} /></div>
                            : <textarea className={`${input} min-h-48 font-mono text-[13px]`} value={form.body} onChange={(e) => set('body', e.target.value)} />}
                    </div>
                    <div>
                        <label className={label}>Who sees it <span className="font-normal text-gray-400">(none ticked = everyone signed in)</span></label>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                            {ROLES.map(([value, text]) => (
                                <label key={value} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="checkbox" checked={form.roles.includes(value)} onChange={(e) => set('roles', e.target.checked ? [...form.roles, value] : form.roles.filter((r) => r !== value))} className="rounded border-gray-300" />
                                    {text}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div><label className={label}>Common questions <span className="font-normal text-gray-400">(one per line — the ways people ask about this; shown on the article and used by search)</span></label><textarea className={`${input} min-h-24`} value={form.questions} onChange={(e) => set('questions', e.target.value)} placeholder={'How do I …?\nWhy can\'t I …?'} /></div>
                    <div><label className={label}>Keywords <span className="font-normal text-gray-400">(other words people use for this topic — helps search)</span></label><input className={input} value={form.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder="e.g. panel defense presentation schedule" /></div>
                    <div><label className={label}>Suggest on these pages <span className="font-normal text-gray-400">(comma separated)</span></label><input className={input} value={form.page_paths} onChange={(e) => set('page_paths', e.target.value)} placeholder="/admin/open-defence, /admin/blind-review" /></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div><label className={label}>Button label</label><input className={input} value={form.action_label} onChange={(e) => set('action_label', e.target.value)} placeholder="Open open defence" /></div>
                        <div><label className={label}>Button link</label><input className={input} value={form.action_url} onChange={(e) => set('action_url', e.target.value)} placeholder="/admin/open-defence" /></div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} className="rounded border-gray-300" /> Published</label>
                </div>
                <footer className="flex shrink-0 gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving || !form.title || !form.summary || !form.body || !form.category}
                        className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save article'}</button>
                </footer>
            </div>
        </div>
    );
}

function Insights() {
    const [data, setData] = useState(null);
    useEffect(() => { get('/admin/assistant-insights').then((r) => setData(r.data)).catch(() => setData({})); }, []);
    if (!data) return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Questions (90 days)', data.total ?? 0], ['Answered', data.answered_rate != null ? `${data.answered_rate}%` : '—'], ['Helpful 👍', data.helpful?.yes ?? 0], ['Not helpful 👎', data.helpful?.no ?? 0]].map(([l, v]) => (
                    <div key={l} className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">{l}</p><p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{v}</p></div>
                ))}
            </div>
            <section className="rounded-2xl border border-amber-200 bg-white">
                <h3 className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-5 py-3 text-sm font-semibold text-amber-900"><AlertCircle size={15} /> Questions with no answer — write articles for these</h3>
                {data.unanswered?.length ? (
                    <ul className="divide-y divide-gray-100">{data.unanswered.map((u, i) => (
                        <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"><span className="text-gray-800">“{u.query}”</span><span className="text-xs text-gray-400">{u.page ?? ''} · {new Date(u.created_at).toLocaleDateString('en-GB')}</span></li>
                    ))}</ul>
                ) : <p className="px-5 py-6 text-sm text-gray-400">Nothing unanswered yet.</p>}
            </section>
            <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-gray-200 bg-white">
                    <h3 className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900"><MessageCircleQuestion size={15} /> Most asked</h3>
                    <ul className="divide-y divide-gray-100">{(data.top ?? []).map((t, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 px-5 py-2 text-sm"><span className="truncate text-gray-800">{t.q}</span><span className="shrink-0 tabular-nums text-gray-500">{t.times}×</span></li>
                    ))}</ul>
                </section>
                <section className="rounded-2xl border border-gray-200 bg-white">
                    <h3 className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900"><BookOpen size={15} /> Most read articles</h3>
                    <ul className="divide-y divide-gray-100">{(data.articles ?? []).map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
                            <span className="truncate text-gray-800">{a.title}</span>
                            <span className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-gray-500"><span className="flex items-center gap-1"><Eye size={12} />{a.views}</span><span className="flex items-center gap-1"><ThumbsUp size={12} />{a.helpful_yes}</span><span className="flex items-center gap-1"><ThumbsDown size={12} />{a.helpful_no}</span></span>
                        </li>
                    ))}</ul>
                </section>
            </div>
        </div>
    );
}

/** Admin: keep the help centre accurate, and see what people ask the assistant. */
export default function HelpArticles() {
    const { success, error } = useToast();
    const [tab, setTab] = useState('articles');
    const [articles, setArticles] = useState(null);
    const [editing, setEditing] = useState(null);

    const load = () => get('/admin/help-articles').then((r) => setArticles(r.data ?? [])).catch(() => setArticles([]));
    useEffect(() => { load(); }, []);

    const remove = async (a) => {
        if (!window.confirm(`Delete “${a.title}”? This can't be undone.`)) return;
        try { await del(`/admin/help-articles/${a.id}`); success('Article deleted.'); load(); } catch { error('Could not delete the article.'); }
    };

    const categories = [...new Set((articles ?? []).map((a) => a.category))];

    return (
        <AppLayout breadcrumb="Help Articles">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100"><BookOpen size={20} className="text-indigo-600" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Help Articles</h1>
                            <p className="mt-0.5 text-sm text-gray-500">The Help Centre and the Ask assistant answer only from these articles.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><RefreshCw size={14} /></button>
                        <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={15} /> New article</button>
                    </div>
                </div>

                <div className="mb-5 inline-flex rounded-xl bg-gray-100 p-1 text-sm">
                    {[['articles', 'Articles'], ['insights', 'What people ask']].map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3.5 py-1.5 font-medium ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{l}</button>
                    ))}
                </div>

                {tab === 'insights' ? <Insights /> : !articles ? (
                    <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                        <table className="w-full min-w-170 text-sm">
                            <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                <tr><th className="px-4 py-2.5 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th><th className="px-4 py-2.5">Article</th><th className="px-3 py-2.5">Category</th><th className="px-3 py-2.5">Audience</th><th className="px-3 py-2.5 text-right">Read</th><th className="px-3 py-2.5 text-right">👍 / 👎</th><th className="px-4 py-2.5" /></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {articles.map((a, rowIdx) => (
                                    <tr key={a.id} className={a.is_published ? '' : 'opacity-50'}><td className="px-4 py-3 w-10 text-xs font-medium tabular-nums text-gray-400">{rowIdx + 1}</td>
                                        <td className="px-4 py-3"><p className="font-medium text-gray-900">{a.title}</p><p className="line-clamp-1 text-xs text-gray-500">{a.summary}</p></td>
                                        <td className="px-3 py-3 text-gray-600">{a.category}</td>
                                        <td className="px-3 py-3 text-xs text-gray-500">{a.roles?.length ? `${a.roles.length} role${a.roles.length === 1 ? '' : 's'}` : 'Everyone'}{!a.is_published && ' · hidden'}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-gray-600">{a.views}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-gray-600">{a.helpful_yes} / {a.helpful_no}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => setEditing(a)} aria-label="Edit" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600"><Pencil size={14} /></button>
                                                <button onClick={() => remove(a)} aria-label="Delete" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-rose-600"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editing && (
                <Editor article={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
            )}
        </AppLayout>
    );
}
