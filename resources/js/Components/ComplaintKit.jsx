import { useState, useEffect } from 'react';
import {
    MessageSquare, ArrowUpCircle, Pencil, X, Clock, CheckCircle2, XCircle, RotateCcw,
    FileText, Hourglass, Timer, Building2, Scale, Send, ShieldCheck, Wallet, Gavel, HelpCircle,
} from 'lucide-react';
import { post, put } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useToast } from './Toast';

/**
 * Shared building blocks for complaints: badges, the complaint timeline and the
 * file / respond / escalate / edit forms. Used by the Complaints page and the
 * Complaints tab on a proposal.
 */

export const STAGE_LABELS = {
    blind_review: 'Blind Review',
    open_defence: 'Open Defence',
    post_funding: 'Post Funding',
};

export const TYPE_LABELS = {
    budget:     'Budget',
    rejection:  'Rejection',
    other:      'Other',
    escalation: 'Escalation',
};

export const STATUS_CONFIG = {
    open:         { label: 'Awaiting response', cls: 'bg-blue-50 text-blue-700 ring-blue-200',       icon: Clock },
    under_review: { label: 'Under review',      cls: 'bg-amber-50 text-amber-700 ring-amber-200',    icon: RotateCcw },
    resolved:     { label: 'Resolved',          cls: 'bg-green-50 text-green-700 ring-green-200',    icon: CheckCircle2 },
    dismissed:    { label: 'Dismissed',         cls: 'bg-gray-100 text-gray-600 ring-gray-200',      icon: XCircle },
    escalated:    { label: 'Escalated',         cls: 'bg-orange-50 text-orange-700 ring-orange-200', icon: ArrowUpCircle },
};

export const AWAITING = ['open', 'under_review'];

export const CATEGORY_FOR_OFFICER = {
    research_officer:   'research',
    community_officer:  'community_engagement',
    technology_officer: 'technology_transfer',
};

export const DAY = 86400000;
export const daysBetween = (from, to = Date.now()) => Math.max(0, Math.floor((new Date(to) - new Date(from)) / DAY));
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const topicLabel = (c) => (c.complaint_type ? (TYPE_LABELS[c.complaint_type] ?? c.complaint_type) : (STAGE_LABELS[c.stage] ?? c.stage));

/**
 * What a person may do with a complaint — mirrors the server's rules.
 *
 * @param {{ userId: string, isAdmin: boolean, isCollegeOfficer: boolean, officerRole?: string }} who
 */
export function complaintPermissions(c, { userId, isAdmin, isCollegeOfficer, officerRole }) {
    const isOwner  = c.complainant_id === userId;
    const awaiting = AWAITING.includes(c.status);
    const isResponsible = isAdmin
        || (isCollegeOfficer && c.level === 'college')
        || (!!officerRole && c.level === 'officer' && c.proposal?.category === CATEGORY_FOR_OFFICER[officerRole]);
    return {
        canRespond:  awaiting && isResponsible && !isOwner,
        canEscalate: isOwner && c.level === 'college' && ['resolved', 'dismissed'].includes(c.status),
        canEdit:     isOwner && awaiting,
        canWithdraw: isOwner && c.status === 'open',
    };
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export function ComplaintStatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 ring-gray-200', icon: Clock };
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.cls}`}>
            <Icon size={11} /> {cfg.label}
        </span>
    );
}

export function LevelBadge({ level }) {
    const college = level === 'college';
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${college ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>
            {college ? <Building2 size={10} /> : <Scale size={10} />}
            {college ? 'Level 1 · College' : 'Level 2 · Director'}
        </span>
    );
}

/** How long a complaint has waited, or how long it took to answer. */
export function AgeNote({ complaint }) {
    if (AWAITING.includes(complaint.status)) {
        const days = daysBetween(complaint.created_at);
        const tone = days > 14 ? 'text-red-600' : days > 7 ? 'text-amber-600' : 'text-gray-400';
        return (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${tone}`}>
                <Hourglass size={10} /> {days === 0 ? 'Filed today' : `Waiting ${plural(days, 'day')}`}
            </span>
        );
    }
    if (complaint.resolved_at) {
        const days = daysBetween(complaint.created_at, complaint.resolved_at);
        return (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <Timer size={10} /> Answered in {days === 0 ? 'under a day' : plural(days, 'day')}
            </span>
        );
    }
    return null;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

function TimelineItem({ icon: Icon, tone, title, meta, last, children }) {
    return (
        <li className="relative flex gap-3 pb-6 last:pb-0">
            {!last && <span className="absolute left-4 top-9 -ml-px h-[calc(100%-2.25rem)] w-0.5 bg-gray-100" aria-hidden="true" />}
            <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${tone}`}>
                <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <p className="text-sm font-semibold text-gray-900">{title}</p>
                    {meta && <p className="text-xs text-gray-400">{meta}</p>}
                </div>
                {children && <div className="mt-2">{children}</div>}
            </div>
        </li>
    );
}

/** Filed → answered (or still waiting) → escalated. */
export function ComplaintTimeline({ complaint }) {
    const awaiting = AWAITING.includes(complaint.status);
    const dismissed = complaint.status === 'dismissed';
    const escalated = complaint.status === 'escalated';

    return (
        <ol>
            <TimelineItem icon={FileText} tone="bg-blue-100 text-blue-700"
                title={`Filed by ${complaint.complainant?.name ?? 'the research team'}`} meta={formatDate(complaint.created_at)}
                last={!complaint.response && !awaiting && !escalated}>
                <p className="whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                    {complaint.description}
                </p>
            </TimelineItem>

            {complaint.response ? (
                <TimelineItem icon={dismissed ? XCircle : CheckCircle2}
                    tone={dismissed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}
                    title={`${dismissed ? 'Dismissed' : 'Resolved'} by ${complaint.resolved_by?.name ?? 'the officer'}`}
                    meta={formatDate(complaint.resolved_at)} last={!escalated}>
                    <p className={`whitespace-pre-wrap rounded-xl border p-4 text-sm leading-relaxed ${dismissed ? 'border-gray-200 bg-white text-gray-700' : 'border-green-200 bg-green-50/60 text-green-900'}`}>
                        {complaint.response}
                    </p>
                </TimelineItem>
            ) : awaiting ? (
                <TimelineItem icon={Hourglass} tone="bg-amber-100 text-amber-700" title="Awaiting a response"
                    meta={`${plural(daysBetween(complaint.created_at), 'day')} so far`} last>
                    <p className="text-xs text-gray-500">
                        {complaint.level === 'college'
                            ? 'The college office reviews the complaint and responds. The complainant is notified when it does.'
                            : 'The category director reviews the complaint and responds. The complainant is notified when they do.'}
                    </p>
                </TimelineItem>
            ) : null}

            {escalated && (
                <TimelineItem icon={ArrowUpCircle} tone="bg-orange-100 text-orange-700" title="Escalated to Level 2"
                    meta={formatDate(complaint.updated_at)} last>
                    <p className="text-xs text-gray-500">The complainant asked the category director to review this outcome. It continues as a new Level 2 complaint.</p>
                </TimelineItem>
            )}
        </ol>
    );
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

export function ModalShell({ title, subtitle, icon: Icon, iconTone, onClose, children, footer, width = 'max-w-lg' }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label={title}
                className={`flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
                            <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-gray-900">{title}</h2>
                            {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4">{footer}</div>}
            </div>
        </div>
    );
}

function CharCount({ value, min }) {
    const n = value.trim().length;
    return (
        <p className={`mt-1 text-right text-[11px] ${n < min ? 'text-gray-400' : 'text-green-600'}`}>
            {n < min ? `${min - n} more character${min - n === 1 ? '' : 's'} needed` : `${n} characters`}
        </p>
    );
}

function ModalButtons({ onClose, onSubmit, disabled, busy, label, busyLabel, tone = 'bg-slate-900 hover:bg-slate-800', icon: Icon }) {
    return (
        <>
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={onSubmit} disabled={disabled || busy}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${tone}`}>
                {Icon && <Icon size={14} />} {busy ? busyLabel : label}
            </button>
        </>
    );
}

// ─── Forms ───────────────────────────────────────────────────────────────────

const COMPLAINT_TYPES = [
    { value: 'budget',    label: 'Budget dispute',   hint: 'Allocations, releases or settlements',  icon: Wallet },
    { value: 'rejection', label: 'Decision appeal',  hint: 'A decision made about the project',      icon: Gavel },
    { value: 'other',     label: 'Something else',   hint: 'Any other post-funding concern',         icon: HelpCircle },
];

/** File a Level 1 (review stage) or Level 2 (post-funding) complaint about a proposal. */
export function FileComplaintModal({ proposal, level, stage, onSave, onClose }) {
    const isOfficer = level === 'officer';
    const [description,   setDescription]   = useState('');
    const [complaintType, setComplaintType] = useState('budget');
    const [saving,        setSaving]        = useState(false);
    const { error } = useToast();
    const min = 50;

    const submit = async () => {
        if (description.trim().length < min) { error(`Description must be at least ${min} characters.`); return; }
        setSaving(true);
        try {
            if (isOfficer) {
                await post(`/proposals/${proposal.id}/complaints/officer`, { complaint_type: complaintType, description });
            } else {
                await post(`/proposals/${proposal.id}/complaints`, { stage, description });
            }
            onSave();
        } catch (e) {
            error(e.response?.data?.message || e.response?.data?.errors?.description?.[0] || 'Failed to submit complaint.');
        }
        setSaving(false);
    };

    return (
        <ModalShell
            title={isOfficer ? 'File a post-funding complaint' : `File a complaint about ${STAGE_LABELS[stage] ?? 'the review'}`}
            subtitle={`${proposal.tracker_number} · ${isOfficer ? 'goes to the category director' : 'goes to the college office'}`}
            icon={isOfficer ? Scale : Building2}
            iconTone={isOfficer ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}
            onClose={onClose}
            footer={<ModalButtons onClose={onClose} onSubmit={submit} disabled={description.trim().length < min} busy={saving}
                label="Submit complaint" busyLabel="Submitting…" icon={Send} />}>
            {isOfficer && (
                <fieldset>
                    <legend className="mb-1.5 text-xs font-semibold text-gray-700">What is it about?</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {COMPLAINT_TYPES.map(t => (
                            <label key={t.value}
                                className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors ${complaintType === t.value ? 'border-violet-500 bg-violet-50 text-violet-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                <input type="radio" name="complaint-type" className="sr-only" value={t.value}
                                    checked={complaintType === t.value} onChange={() => setComplaintType(t.value)} />
                                <t.icon size={15} />
                                <span className="text-sm font-semibold">{t.label}</span>
                                <span className="text-[11px] leading-snug opacity-80">{t.hint}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}

            <div>
                <label htmlFor="file-complaint" className="mb-1.5 block text-xs font-semibold text-gray-700">
                    Describe your complaint <span className="text-red-500">*</span>
                </label>
                <textarea id="file-complaint" value={description} onChange={e => setDescription(e.target.value)} rows={7}
                    className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    placeholder="What happened, when it happened, and what outcome you are asking for…" />
                <CharCount value={description} min={min} />
            </div>

            <ul className="space-y-1 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
                <li>• Be specific: name the review, score, decision or payment concerned.</li>
                <li>• Stick to facts — the officer sees your name and this text.</li>
                <li>• You'll be notified of the response, and can edit or withdraw until it's answered.</li>
            </ul>
        </ModalShell>
    );
}

const RESOLUTIONS = [
    { value: 'resolved',  label: 'Resolved',  hint: 'The concern was valid and has been addressed.', icon: CheckCircle2, on: 'border-green-500 bg-green-50 text-green-800' },
    { value: 'dismissed', label: 'Dismissed', hint: 'No action is warranted — explain why in your response.', icon: XCircle, on: 'border-gray-500 bg-gray-50 text-gray-800' },
];

export function RespondModal({ complaint, onSave, onClose }) {
    const [response,   setResponse]   = useState('');
    const [resolution, setResolution] = useState('resolved');
    const [saving,     setSaving]     = useState(false);
    const { error } = useToast();
    const min = 20;

    const submit = async () => {
        if (response.trim().length < min) { error(`Please write at least ${min} characters.`); return; }
        setSaving(true);
        try {
            await post(`/complaints/${complaint.id}/respond`, { response, resolution });
            onSave(resolution);
        } catch (e) { error(e.response?.data?.message || 'Failed to submit response.'); }
        setSaving(false);
    };

    return (
        <ModalShell title="Respond to complaint"
            subtitle={`${complaint.proposal?.tracker_number ?? ''} · filed by ${complaint.complainant?.name ?? 'the researcher'}`}
            icon={MessageSquare} iconTone="bg-slate-900 text-white" onClose={onClose}
            footer={<ModalButtons onClose={onClose} onSubmit={submit} disabled={response.trim().length < min} busy={saving}
                label="Send response" busyLabel="Sending…" icon={Send} />}>
            <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-500">Complaint</p>
                <p className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                    {complaint.description}
                </p>
            </div>

            <fieldset>
                <legend className="mb-1.5 text-xs font-semibold text-gray-700">Outcome</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    {RESOLUTIONS.map(opt => (
                        <label key={opt.value}
                            className={`flex cursor-pointer gap-2.5 rounded-xl border-2 p-3 transition-colors ${resolution === opt.value ? opt.on : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                            <input type="radio" name="resolution" className="sr-only" value={opt.value}
                                checked={resolution === opt.value} onChange={() => setResolution(opt.value)} />
                            <opt.icon size={16} className="mt-0.5 shrink-0" />
                            <span>
                                <span className="block text-sm font-semibold">{opt.label}</span>
                                <span className="mt-0.5 block text-[11px] leading-snug opacity-80">{opt.hint}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div>
                <label htmlFor="complaint-response" className="mb-1.5 block text-xs font-semibold text-gray-700">
                    Response to the complainant <span className="text-red-500">*</span>
                </label>
                <textarea id="complaint-response" value={response} onChange={e => setResponse(e.target.value)} rows={6}
                    className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    placeholder="Explain what you reviewed, what you decided and why…" />
                <CharCount value={response} min={min} />
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
                <ShieldCheck size={14} className="mt-px shrink-0" />
                The complainant is notified and sees your name and response. This closes the complaint.
            </p>
        </ModalShell>
    );
}

export function EscalateModal({ complaint, onSave, onClose }) {
    const [description, setDescription] = useState('');
    const [saving,      setSaving]      = useState(false);
    const { error } = useToast();
    const min = 30;

    const submit = async () => {
        if (description.trim().length < min) { error(`Please provide at least ${min} characters.`); return; }
        setSaving(true);
        try {
            await post(`/complaints/${complaint.id}/escalate`, { description });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to escalate.'); }
        setSaving(false);
    };

    return (
        <ModalShell title="Escalate to Level 2" subtitle={complaint.proposal?.tracker_number}
            icon={ArrowUpCircle} iconTone="bg-orange-100 text-orange-600" onClose={onClose}
            footer={<ModalButtons onClose={onClose} onSubmit={submit} disabled={description.trim().length < min} busy={saving}
                label="Escalate complaint" busyLabel="Escalating…" tone="bg-orange-500 hover:bg-orange-600" />}>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                The director responsible for your proposal's category (Research, Community or Technology) will review the college office's decision.
            </p>
            {complaint.response && (
                <div>
                    <p className="mb-1.5 text-xs font-semibold text-gray-500">College office response</p>
                    <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">{complaint.response}</p>
                </div>
            )}
            <div>
                <label htmlFor="escalate-reason" className="mb-1.5 block text-xs font-semibold text-gray-700">
                    Why are you not satisfied? <span className="text-red-500">*</span>
                </label>
                <textarea id="escalate-reason" value={description} onChange={e => setDescription(e.target.value)} rows={5}
                    className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Explain what the college office's decision missed…" />
                <CharCount value={description} min={min} />
            </div>
        </ModalShell>
    );
}

export function EditModal({ complaint, onSave, onClose }) {
    const [description, setDescription] = useState(complaint.description ?? '');
    const [saving,      setSaving]      = useState(false);
    const { error } = useToast();
    const min = 50;

    const submit = async () => {
        if (description.trim().length < min) { error(`Description must be at least ${min} characters.`); return; }
        setSaving(true);
        try {
            await put(`/complaints/${complaint.id}`, { description });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to update.'); }
        setSaving(false);
    };

    return (
        <ModalShell title="Edit complaint" subtitle={complaint.proposal?.tracker_number}
            icon={Pencil} iconTone="bg-blue-100 text-blue-700" onClose={onClose}
            footer={<ModalButtons onClose={onClose} onSubmit={submit} disabled={description.trim().length < min} busy={saving}
                label="Save changes" busyLabel="Saving…" />}>
            <div>
                <label htmlFor="edit-description" className="mb-1.5 block text-xs font-semibold text-gray-700">
                    Description <span className="text-red-500">*</span>
                </label>
                <textarea id="edit-description" value={description} onChange={e => setDescription(e.target.value)} rows={8}
                    className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <CharCount value={description} min={min} />
            </div>
        </ModalShell>
    );
}
