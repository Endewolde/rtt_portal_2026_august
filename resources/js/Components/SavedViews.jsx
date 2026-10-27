import { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkPlus, Check, ChevronDown, Link2, Trash2 } from 'lucide-react';
import { useToast } from './Toast';

/** Read a view shared by link (?view=…), if the page was opened with one. */
export function readSharedView() {
    try {
        const raw = new URLSearchParams(window.location.search).get('view');
        return raw ? JSON.parse(decodeURIComponent(escape(atob(raw)))) : null;
    } catch {
        return null;
    }
}

function encodeView(filters) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(filters))));
}

function loadViews(storageKey) {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') ?? []; } catch { return []; }
}

/**
 * Named filter sets for a list page: save the current filters under a name, switch
 * between them, and copy a link that opens the page with the same filters for a colleague.
 */
export default function SavedViews({ storageKey, current, onApply }) {
    const { success } = useToast();
    const [views, setViews] = useState(() => loadViews(storageKey));
    const [open, setOpen] = useState(false);
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setNaming(false); } };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const persist = (next) => {
        setViews(next);
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
    };

    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const active = views.find((v) => same(v.filters, current));

    const save = (e) => {
        e.preventDefault();
        const label = name.trim();
        if (!label) return;
        persist([...views.filter((v) => v.name !== label), { name: label, filters: current }]);
        setName('');
        setNaming(false);
        success(`View "${label}" saved.`);
    };

    const copyLink = async (filters) => {
        const url = `${window.location.origin}${window.location.pathname}?view=${encodeView(filters)}`;
        try {
            await navigator.clipboard.writeText(url);
            success('Link copied — anyone with access opens the page with these filters.');
        } catch {
            window.prompt('Copy this link:', url);
        }
    };

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                <Bookmark size={14} /> <span className="hidden max-w-32 truncate sm:inline">{active ? active.name : 'Views'}</span>
                <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute right-0 z-30 mt-1.5 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="max-h-64 overflow-y-auto py-1">
                        {views.length === 0 && <p className="px-4 py-3 text-xs text-gray-500">No saved views yet. Set the filters you use often, then save them here.</p>}
                        {views.map((v) => (
                            <div key={v.name} className="group flex items-center gap-1 px-2">
                                <button onClick={() => { onApply(v.filters); setOpen(false); }}
                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                                    {same(v.filters, current) ? <Check size={13} className="shrink-0 text-indigo-600" /> : <Bookmark size={13} className="shrink-0 text-gray-300" />}
                                    <span className="truncate">{v.name}</span>
                                </button>
                                <button onClick={() => copyLink(v.filters)} title="Copy a link to this view" className="rounded-md p-1.5 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"><Link2 size={13} /></button>
                                <button onClick={() => persist(views.filter((x) => x.name !== v.name))} title="Delete view" className="rounded-md p-1.5 text-gray-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"><Trash2 size={13} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-gray-100 p-2">
                        {naming ? (
                            <form onSubmit={save} className="flex gap-1.5">
                                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name this view…"
                                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                                <button type="submit" disabled={!name.trim()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Save</button>
                            </form>
                        ) : (
                            <div className="flex gap-1.5">
                                <button onClick={() => setNaming(true)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"><BookmarkPlus size={13} /> Save current view</button>
                                <button onClick={() => copyLink(current)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"><Link2 size={13} /> Share</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
