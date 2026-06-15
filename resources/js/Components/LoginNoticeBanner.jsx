import { useState, useEffect } from 'react'
import { X, Info, TriangleAlert, CheckCircle2, Wrench, ExternalLink } from 'lucide-react'

const STORAGE_KEY = 'rtt_dismissed_notices'

const TYPE_CONFIG = {
    information: {
        bar:    'bg-indigo-500',
        bg:     'bg-indigo-50',
        border: 'border-indigo-200',
        icon:   Info,
        iconCl: 'text-indigo-500',
        title:  'text-indigo-900',
        body:   'text-indigo-700',
        btn:    'bg-indigo-600 hover:bg-indigo-700 text-white',
        dismiss:'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100',
        dot:    'bg-indigo-400',
    },
    warning: {
        bar:    'bg-amber-500',
        bg:     'bg-amber-50',
        border: 'border-amber-200',
        icon:   TriangleAlert,
        iconCl: 'text-amber-500',
        title:  'text-amber-900',
        body:   'text-amber-700',
        btn:    'bg-amber-500 hover:bg-amber-600 text-white',
        dismiss:'text-amber-400 hover:text-amber-600 hover:bg-amber-100',
        dot:    'bg-amber-400',
    },
    success: {
        bar:    'bg-emerald-500',
        bg:     'bg-emerald-50',
        border: 'border-emerald-200',
        icon:   CheckCircle2,
        iconCl: 'text-emerald-500',
        title:  'text-emerald-900',
        body:   'text-emerald-700',
        btn:    'bg-emerald-600 hover:bg-emerald-700 text-white',
        dismiss:'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100',
        dot:    'bg-emerald-400',
    },
    maintenance: {
        bar:    'bg-slate-600',
        bg:     'bg-slate-50',
        border: 'border-slate-200',
        icon:   Wrench,
        iconCl: 'text-slate-500',
        title:  'text-slate-900',
        body:   'text-slate-600',
        btn:    'bg-slate-700 hover:bg-slate-800 text-white',
        dismiss:'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
        dot:    'bg-slate-400',
    },
}

function NoticeCard({ notice, onDismiss }) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        // Stagger entrance via requestAnimationFrame
        requestAnimationFrame(() => setVisible(true))
    }, [])

    const cfg = TYPE_CONFIG[notice.type] ?? TYPE_CONFIG.information
    const Icon = cfg.icon

    const dismiss = () => {
        setVisible(false)
        setTimeout(() => onDismiss(notice.id), 300)
    }

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border ${cfg.bg} ${cfg.border} shadow-sm transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
        >
            {/* Left accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar} rounded-l-2xl`} />

            <div className="pl-5 pr-4 py-4 flex items-start gap-3">
                {/* Icon or emoji */}
                <div className="shrink-0 mt-0.5">
                    {notice.icon
                        ? <span className="text-xl leading-none">{notice.icon}</span>
                        : <Icon size={18} className={cfg.iconCl} />
                    }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        {! notice.is_dismissible && (
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse shrink-0`} />
                        )}
                        <p className={`text-sm font-semibold ${cfg.title} leading-snug`}>
                            {notice.title}
                        </p>
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${cfg.body}`}>
                        {notice.body}
                    </p>
                    {notice.link_label && notice.link_url && (
                        <a
                            href={notice.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${cfg.btn}`}
                        >
                            {notice.link_label}
                            <ExternalLink size={11} />
                        </a>
                    )}
                </div>

                {/* Dismiss button */}
                {notice.is_dismissible && (
                    <button
                        onClick={dismiss}
                        className={`shrink-0 p-1 rounded-lg transition-colors ${cfg.dismiss}`}
                        aria-label="Dismiss"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
    )
}

export default function LoginNoticeBanner({ notices }) {
    const [dismissed, setDismissed] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
        } catch {
            return []
        }
    })

    const visible = (notices ?? []).filter(n => !dismissed.includes(n.id))

    const dismiss = (id) => {
        const next = [...dismissed, id]
        setDismissed(next)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
    }

    if (visible.length === 0) return null

    return (
        <div className="space-y-2.5 mb-6">
            {visible.map(notice => (
                <NoticeCard key={notice.id} notice={notice} onDismiss={dismiss} />
            ))}
        </div>
    )
}
