import { useEffect, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { LifeBuoy, Search, ArrowLeft, ArrowRight, BookOpen, MessageCircleQuestion } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';
import HelpBody from '../../Components/HelpBody';

function ArticleView({ slug }) {
    const [article, setArticle] = useState(null);
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        setArticle(null);
        get(`/help/articles/${encodeURIComponent(slug)}`).then((r) => setArticle(r.data)).catch(() => setMissing(true));
    }, [slug]);

    if (missing) return <p className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">This article isn't available.</p>;
    if (!article) return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />;

    return (
        <article className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{article.category}</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{article.title}</h1>
            <p className="mt-2 text-sm text-gray-500">{article.summary}</p>
            <HelpBody text={article.body} className="mt-6 text-[15px]" />
            {article.action_url && (
                <Link href={article.action_url} className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                    {article.action_label || 'Open'} <ArrowRight size={14} />
                </Link>
            )}
            {article.questions?.length > 0 && (
                <section className="mt-8 border-t border-gray-100 pt-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">This article answers</h2>
                    <ul className="mt-2 space-y-1.5">
                        {article.questions.map((q) => <li key={q} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />{q}</li>)}
                    </ul>
                </section>
            )}
            {article.related?.length > 0 && (
                <section className="mt-6 border-t border-gray-100 pt-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Related in {article.category}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {article.related.map((r) => <Link key={r.slug} href={`/help/${r.slug}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700">{r.title}</Link>)}
                    </div>
                </section>
            )}
        </article>
    );
}

/** Help centre: searchable articles for the reader's role; /help/{slug} shows one article. */
export default function HelpIndex() {
    const { url } = usePage();
    const slug = (url.split('?')[0].match(/^\/help\/([^/]+)/) ?? [])[1];
    const [articles, setArticles] = useState(null);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState(null);

    useEffect(() => {
        if (!slug) get('/help/articles').then((r) => setArticles(r.data ?? [])).catch(() => setArticles([]));
    }, [slug]);

    useEffect(() => {
        const q = search.trim();
        if (q.length < 2) { setResults(null); return; }
        const timer = setTimeout(() => get('/help/articles', { search: q }).then((r) => setResults(r.data ?? [])).catch(() => setResults([])), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const grouped = (articles ?? []).reduce((acc, a) => ({ ...acc, [a.category]: [...(acc[a.category] ?? []), a] }), {});

    return (
        <AppLayout breadcrumb="Help Centre">
            <div className="mx-auto max-w-4xl">
                {slug ? (
                    <>
                        <Link href="/help" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"><ArrowLeft size={14} /> All help topics</Link>
                        <ArticleView slug={slug} />
                    </>
                ) : (
                    <>
                        <div className="mb-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 px-6 py-8 text-white">
                            <div className="flex items-center gap-2 text-sm font-medium text-indigo-100"><LifeBuoy size={16} /> Help Centre</div>
                            <h1 className="mt-2 text-2xl font-bold">How can we help?</h1>
                            <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-gray-700">
                                <Search size={16} className="text-gray-400" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search help, e.g. “submit a proposal” or “defence deadline”" aria-label="Search help"
                                    className="w-full bg-transparent text-sm focus:outline-none" />
                            </div>
                            <p className="mt-3 flex items-center gap-1.5 text-xs text-indigo-100"><MessageCircleQuestion size={13} /> Or press <strong>Ask</strong> at the bottom right of any page.</p>
                        </div>

                        {results !== null ? (
                            <section className="space-y-2">
                                <p className="text-sm text-gray-500">{results.length ? `Best matches for “${search.trim()}”` : `Nothing found for “${search.trim()}”. Try other words, or ask the assistant.`}</p>
                                {results.map((a) => <ArticleLink key={a.slug} article={a} />)}
                            </section>
                        ) : !articles ? (
                            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />)}</div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(grouped).map(([category, list]) => (
                                    <section key={category}>
                                        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{category}</h2>
                                        <div className="grid gap-2 sm:grid-cols-2">{list.map((a) => <ArticleLink key={a.slug} article={a} />)}</div>
                                    </section>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function ArticleLink({ article }) {
    return (
        <Link href={`/help/${article.slug}`} className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-indigo-300 hover:shadow-sm">
            <BookOpen size={16} className="mt-0.5 shrink-0 text-indigo-500" />
            <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 group-hover:text-indigo-700">{article.title}</span>
                <span className="block text-xs text-gray-500">{article.summary}</span>
            </span>
        </Link>
    );
}
