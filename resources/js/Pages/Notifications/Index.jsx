import { useState, useEffect, useCallback } from 'react';
import {
    Bell, Check, FileText, DollarSign, Award, AlertCircle,
    ClipboardCheck, CheckCircle2, Clock, Inbox,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { timeAgo } from '../../lib/utils';

// ─── Notification type config ─────────────────────────────────────────────────

const TYPE_CFG = {
    submission_success:   { icon: FileText,      color: 'bg-blue-100 text-blue-600',    label: 'Submission'      },
    budget_allocated:     { icon: DollarSign,    color: 'bg-emerald-100 text-emerald-600', label: 'Budget'       },
    award_approval:       { icon: Award,         color: 'bg-yellow-100 text-yellow-600', label: 'Award'          },
    review_assigned:      { icon: ClipboardCheck,color: 'bg-indigo-100 text-indigo-600', label: 'Review'         },
    proposal_approved:    { icon: CheckCircle2,  color: 'bg-green-100 text-green-600',  label: 'Approval'        },
    proposal_rejected:    { icon: AlertCircle,   color: 'bg-red-100 text-red-600',      label: 'Rejection'       },
    budget_request:       { icon: DollarSign,    color: 'bg-teal-100 text-teal-600',    label: 'Budget Request'  },
    signature_required:   { icon: ClipboardCheck,color: 'bg-amber-100 text-amber-600',  label: 'Signature'       },
    default:              { icon: Bell,          color: 'bg-gray-100 text-gray-500',    label: 'Notification'    },
};

function getCfg(type) {
    return TYPE_CFG[type] ?? TYPE_CFG.default;
}

// ─── Group helpers ────────────────────────────────────────────────────────────

function groupByDate(notifications) {
    const today     = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    const groups = { Today: [], Yesterday: [], Earlier: [] };
    for (const n of notifications) {
        const d = new Date(n.created_at); d.setHours(0,0,0,0);
        if (d >= today)          groups.Today.push(n);
        else if (d >= yesterday) groups.Yesterday.push(n);
        else                     groups.Earlier.push(n);
    }
    return groups;
}

// ─── Notification item ────────────────────────────────────────────────────────

function NotificationItem({ notification: n, onMarkRead }) {
    const cfg  = getCfg(n.type);
    const Icon = cfg.icon;
    const isUnread = !n.read_at;

    return (
        <div className={`flex items-start gap-4 px-5 py-4 transition-colors ${isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-gray-50'}`}>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.color}`}>
                <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cfg.label}</span>
                        <p className="text-sm text-gray-800 mt-0.5 leading-snug">
                            {n.data?.message ?? n.data?.title ?? n.type?.replace(/_/g, ' ')}
                        </p>
                        {n.data?.proposal_title && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{n.data.proposal_title}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {isUnread && (
                            <button
                                onClick={() => onMarkRead(n.id)}
                                title="Mark as read"
                                className="p-1 rounded-full hover:bg-blue-100 text-blue-500"
                            >
                                <Check size={12} />
                            </button>
                        )}
                        <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                    </div>
                </div>
            </div>
            {isUnread && (
                <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsIndex() {
    const [notifications, setNotifications] = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [tab,           setTab]           = useState('all');

    const load = useCallback(() => {
        setLoading(true);
        get('/notifications?limit=100')
            .then(r => setNotifications(r.data?.data ?? r.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const markRead = async (ids) => {
        await post('/notifications/read', { ids }).catch(() => {});
        setNotifications(prev =>
            prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)
        );
    };

    const markAll = async () => {
        const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
        if (!unreadIds.length) return;
        await post('/notifications/read', { ids: unreadIds }).catch(() => {});
        setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    };

    const unreadCount = notifications.filter(n => !n.read_at).length;
    const visible     = tab === 'unread' ? notifications.filter(n => !n.read_at) : notifications;
    const groups      = groupByDate(visible);

    return (
        <AppLayout breadcrumb="Notifications">
            <div className="max-w-3xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Bell size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                            </p>
                        </div>
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAll}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                        >
                            <Check size={14} /> Mark all read
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                    {[
                        { key: 'all',    label: `All (${notifications.length})` },
                        { key: 'unread', label: `Unread (${unreadCount})`       },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <Inbox size={40} className="mb-3 opacity-40" />
                            <p className="text-sm font-medium">
                                {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                            {tab === 'unread' && (
                                <p className="text-xs mt-1 text-gray-400">You're all caught up!</p>
                            )}
                        </div>
                    ) : (
                        Object.entries(groups).map(([label, items]) => {
                            if (!items.length) return null;
                            return (
                                <div key={label}>
                                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                            {label}
                                        </p>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {items.map(n => (
                                            <NotificationItem
                                                key={n.id}
                                                notification={n}
                                                onMarkRead={id => markRead([id])}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {!loading && visible.length > 0 && (
                    <p className="text-center text-xs text-gray-400">
                        Showing {visible.length} notification{visible.length !== 1 ? 's' : ''}
                        {tab === 'all' && unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
                    </p>
                )}
            </div>
        </AppLayout>
    );
}
