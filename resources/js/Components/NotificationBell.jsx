import { useState, useEffect, useRef } from 'react';
import { Bell, Check, FileText, DollarSign, Award, AlertCircle } from 'lucide-react';
import { get, post } from '../lib/api';
import { timeAgo } from '../lib/utils';

const icons = {
    submission_success: FileText,
    budget_allocated: DollarSign,
    award_approval: Award,
    default: AlertCircle,
};

export default function NotificationBell({ onCountChange }) {
    const [count, setCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState({});
    const ref = useRef(null);
    const btnRef = useRef(null);

    const fetchCount = () => get('/notifications/unread-count').then((r) => {
        const c = r.data?.count ?? 0;
        setCount(c);
        onCountChange?.(c);
    }).catch(() => {});
    const fetchNotifications = () => get('/notifications').then((r) => setNotifications(r.data ?? [])).catch(() => {});

    useEffect(() => {
        fetchCount();
        const id = setInterval(fetchCount, 30000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (open) fetchNotifications();
    }, [open]);

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const handleToggle = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom - 12;
            const spaceAbove = rect.top - 12;
            const dropW = Math.min(320, window.innerWidth - 16);
            const rightEdge = window.innerWidth - rect.right;
            const maxH = Math.max(160, Math.min(288, spaceBelow > 200 ? spaceBelow : spaceAbove));
            const style = {
                position: 'fixed',
                right: Math.max(8, rightEdge),
                zIndex: 9999,
                width: dropW,
                maxHeight: maxH,
            };
            if (spaceBelow >= 200) {
                style.top = rect.bottom + 6;
            } else {
                style.bottom = window.innerHeight - rect.top + 6;
            }
            setDropdownStyle(style);
        }
        setOpen(v => !v);
    };

    const markAll = async () => {
        await post('/notifications/read', {}).catch(() => {});
        setCount(0);
        setNotifications([]);
    };

    return (
        <div ref={ref} className="relative">
            <button ref={btnRef} onClick={handleToggle} className="relative p-2 rounded-full hover:bg-gray-100">
                <Bell size={20} className="text-gray-600" />
                {count > 0 && (
                    <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {open && (
                <div style={dropdownStyle} className="rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                        <span className="text-sm font-semibold text-gray-800">Notifications</span>
                        {count > 0 && (
                            <button onClick={markAll} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                <Check size={12} /> Mark all read
                            </button>
                        )}
                    </div>
                    <ul className="divide-y divide-gray-50 overflow-y-auto flex-1">
                        {notifications.length === 0
                            ? <li className="px-4 py-6 text-center text-sm text-gray-400">No new notifications</li>
                            : notifications.map((n) => {
                                const Icon = icons[n.type] ?? icons.default;
                                return (
                                    <li key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                                        <Icon size={16} className="mt-0.5 shrink-0 text-blue-500" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-700 leading-snug">{n.type?.replace(/_/g, ' ')}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                                        </div>
                                    </li>
                                );
                            })}
                    </ul>
                </div>
            )}
        </div>
    );
}
