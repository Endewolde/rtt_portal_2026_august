import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, LogIn } from 'lucide-react';
import { get } from '../lib/api';

export default function SwitchLoginModal({ open, onClose, onSelect }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) { setQuery(''); setResults([]); }
    }, [open]);

    useEffect(() => {
        if (!open || !query.trim()) { setResults([]); return; }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await get('/users', { search: query.trim() });
                setResults(res.data?.data ?? []);
            } catch {
                setResults([]);
            }
            setLoading(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [query, open]);

    return (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-white p-6 shadow-xl focus:outline-none">
                    <div className="flex items-start justify-between mb-4">
                        <Dialog.Title className="text-base font-semibold text-gray-900">Switch Login</Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                    </div>
                    <Dialog.Description className="text-sm text-gray-500 mb-4">
                        Search for a user to log in as their account.
                    </Dialog.Description>

                    <div className="relative mb-3">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name or email…"
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="max-h-72 overflow-y-auto -mx-1">
                        {loading && (
                            <p className="text-sm text-gray-400 text-center py-6">Searching…</p>
                        )}
                        {!loading && query.trim() && results.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-6">No users found.</p>
                        )}
                        {!loading && results.map((u) => (
                            <button
                                key={u.id}
                                onClick={() => onSelect?.(u)}
                                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0 overflow-hidden">
                                    {u.avatar
                                        ? <img src={u.avatar} alt={u.name} className="h-full w-full object-cover" />
                                        : (u.name ?? '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
                                    }
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                </div>
                                <LogIn size={14} className="text-gray-300 shrink-0" />
                            </button>
                        ))}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
