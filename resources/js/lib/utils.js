import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { translate } from './i18n';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function formatDate(date) {
    if (!date) return '—';
    try {
        const d = typeof date === 'string' ? parseISO(date) : date;
        return format(d, 'dd MMM yyyy');
    } catch {
        return date;
    }
}

export function formatDateTime(date) {
    if (!date) return '—';
    try {
        const d = typeof date === 'string' ? parseISO(date) : date;
        return format(d, 'dd MMM yyyy, HH:mm');
    } catch {
        return date;
    }
}

export function formatCurrency(amount) {
    if (amount == null) return '—';
    return `ETB ${Number(amount).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function truncate(text, length = 120) {
    if (!text) return '';
    return text.length > length ? text.slice(0, length) + '…' : text;
}

export function getStatusColor(status) {
    const map = {
        draft: 'bg-gray-100 text-gray-700',
        submitted: 'bg-blue-100 text-blue-700',
        validated: 'bg-indigo-100 text-indigo-700',
        under_blind_review: 'bg-yellow-100 text-yellow-700',
        blind_review_passed: 'bg-orange-100 text-orange-700',
        under_open_defence: 'bg-purple-100 text-purple-700',
        accepted: 'bg-sky-100 text-sky-700',
        funded: 'bg-emerald-100 text-emerald-700',
        midterm_evaluation: 'bg-teal-100 text-teal-700',
        completed: 'bg-cyan-100 text-cyan-700',
        archived: 'bg-slate-100 text-slate-700',
        rejected: 'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
}

export function getStatusLabel(status) {
    const map = {
        draft: 'Draft',
        submitted: 'Submitted',
        validated: 'Validated',
        under_blind_review: 'Under Review',
        blind_review_passed: 'Review Passed',
        under_open_defence: 'Open Defence',
        accepted: 'Central Evaluation',
        funded: 'Funded',
        midterm_evaluation: 'Midterm Eval.',
        completed: 'Completed',
        archived: 'Archived',
        rejected: 'Rejected',
    };
    return translate(map[status] ?? status);
}

export function getCategoryLabel(category) {
    const map = {
        research: 'Research',
        community_engagement: 'Community Engagement',
        technology_transfer: 'Technology Transfer',
        innovation: 'Innovation',
        other: 'Other',
    };
    return translate(map[category] ?? category);
}

export function timeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const d = typeof date === 'string' ? new Date(date) : date;
    const seconds = Math.floor((now - d) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}
