import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    MessageSquareWarning, MessageSquare, ArrowUpCircle, Pencil, Trash2, X, ChevronRight,
    CheckCircle2, FileText, RefreshCw, Timer, Building2, Scale, Inbox,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import DataTable from '../../Components/DataTable';
import ConfirmDialog from '../../Components/ConfirmDialog';
import {
    AWAITING, DAY, daysBetween, plural, topicLabel, complaintPermissions,
    ComplaintStatusBadge as StatusBadge, LevelBadge, AgeNote, ComplaintTimeline,
    RespondModal, EscalateModal, EditModal,
} from '../../Components/ComplaintKit';
import { get, del } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';

const STATUS_FILTERS = [
    { value: '',          label: 'All',               match: () => true },
    { value: 'awaiting',  label: 'Awaiting response', match: c => AWAITING.includes(c.status) },
    { value: 'escalated', label: 'Escalated',         match: c => c.status === 'escalated' },
    { value: 'resolved',  label: 'Resolved',          match: c => c.status === 'resolved' },
    { value: 'dismissed', label: 'Dismissed',         match: c => c.status === 'dismissed' },
];

// ─── Small pieces ────────────────────────────────────────────────────────────

function StatTile({ label, value, hint, icon: Icon, tone }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
                    <Icon size={15} />
                </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
            {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
        </div>
    );
}

// ─── Detail drawer ───────────────────────────────────────────────────────────

function DetailDrawer({ complaint: initial, permissions, onClose, onAction }) {
    const [complaint, setComplaint] = useState(initial);

    useEffect(() => {
        get(`/complaints/${initial.id}`).then(r => setComplaint(c => ({ ...c, ...(r.data?.data ?? r.data) }))).catch(() => {});
    }, [initial.id]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const { canRespond, canEscalate, canEdit, canWithdraw } = permissions(complaint);
    const handler = complaint.assigned_to?.name;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
            <aside role="dialog" aria-modal="true" aria-label="Complaint details"
                className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="border-b border-gray-100 px-6 py-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
                                {complaint.proposal?.tracker_number ?? '—'}
                            </span>
                            <StatusBadge status={complaint.status} />
                        </div>
                        <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            <X size={16} />
                        </button>
                    </div>
                    <h2 className="mt-2 text-base font-bold leading-snug text-gray-900">{complaint.proposal?.title ?? 'Proposal'}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <LevelBadge level={complaint.level} />
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">{topicLabel(complaint)}</span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <dl className="mb-6 grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl bg-gray-50 p-3">
                            <dt className="text-gray-400">Filed by</dt>
                            <dd className="mt-0.5 font-semibold text-gray-800">{complaint.complainant?.name ?? '—'}</dd>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                            <dt className="text-gray-400">Handled by</dt>
                            <dd className="mt-0.5 font-semibold text-gray-800">
                                {complaint.resolved_by?.name ?? handler ?? (complaint.level === 'college' ? 'College office' : 'Category director')}
                            </dd>
                        </div>
                    </dl>

                    {complaint.escalated_from_id && (
                        <div className="mb-5 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-800">
                            <ArrowUpCircle size={14} className="mt-px shrink-0" />
                            Escalated from a Level 1 college complaint after the complainant disagreed with its outcome.
                        </div>
                    )}

                    <ComplaintTimeline complaint={complaint} />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
                    <Link href={`/proposals/${complaint.proposal?.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800">
                        <FileText size={13} /> View proposal <ChevronRight size={12} />
                    </Link>
                    <div className="flex flex-wrap gap-2">
                        {canWithdraw && (
                            <button onClick={() => onAction('withdraw', complaint)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                                <Trash2 size={13} /> Withdraw
                            </button>
                        )}
                        {canEdit && (
                            <button onClick={() => onAction('edit', complaint)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                <Pencil size={13} /> Edit
                            </button>
                        )}
                        {canEscalate && (
                            <button onClick={() => onAction('escalate', complaint)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600">
                                <ArrowUpCircle size={13} /> Escalate
                            </button>
                        )}
                        {canRespond && (
                            <button onClick={() => onAction('respond', complaint)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                                <MessageSquare size={13} /> Respond
                            </button>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ComplaintsIndex() {
    const { user, hasPermission, accessScope } = useAuth();
    const { success, error } = useToast();

    // Complaint handlers work at the level that matches their scope: everything,
    // Level 1 for their college, Level 2 for their category.
    const canRespond        = hasPermission('complaints.respond');
    const isAdmin           = canRespond && accessScope.type === 'all';
    const isCollegeOfficer  = canRespond && accessScope.type === 'college';
    const isCategoryOfficer = canRespond && accessScope.type === 'category';
    const isUser            = !isAdmin && !isCollegeOfficer && !isCategoryOfficer;

    const defaultLevel = isAdmin ? '' : isCollegeOfficer ? 'college' : isCategoryOfficer ? 'officer' : '';
    const [levelFilter,  setLevelFilter]  = useState(defaultLevel);
    const [statusFilter, setStatusFilter] = useState(isUser ? '' : 'awaiting');
    const [complaints,   setComplaints]   = useState([]);
    const [loading,      setLoading]      = useState(true);

    const [detail,      setDetail]      = useState(null);
    const [respond,     setRespond]     = useState(null);
    const [escalate,    setEscalate]    = useState(null);
    const [edit,        setEdit]        = useState(null);
    const [withdraw,    setWithdraw]    = useState(null);
    const [withdrawing, setWithdrawing] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        get('/complaints', levelFilter ? { level: levelFilter } : {})
            .then(r => {
                const raw = r.data?.data ?? r.data ?? [];
                setComplaints(Array.isArray(raw) ? raw : raw?.data ?? []);
            })
            .catch(() => error('Failed to load complaints.'))
            .finally(() => setLoading(false));
    }, [levelFilter]);

    useEffect(() => { load(); }, [load]);

    const permissions = useCallback(
        (c) => complaintPermissions(c, { userId: user?.id, canRespond, scope: accessScope }),
        [user, canRespond, accessScope],
    );

    const handleAction = (type, complaint) => {
        setDetail(null);
        if (type === 'respond')  setRespond(complaint);
        if (type === 'escalate') setEscalate(complaint);
        if (type === 'edit')     setEdit(complaint);
        if (type === 'withdraw') setWithdraw(complaint);
    };

    const handleWithdrawConfirm = async () => {
        if (!withdraw) return;
        setWithdrawing(true);
        try {
            await del(`/complaints/${withdraw.id}`);
            setWithdraw(null);
            success('Complaint withdrawn.');
            load();
        } catch (e) {
            error(e.response?.data?.message || 'Failed to withdraw.');
        }
        setWithdrawing(false);
    };

    const done = (msg) => {
        setRespond(null); setEscalate(null); setEdit(null);
        success(msg);
        load();
    };

    const stats = useMemo(() => {
        const awaiting = complaints.filter(c => AWAITING.includes(c.status));
        const answered = complaints.filter(c => c.resolved_at);
        const oldest = awaiting.reduce((max, c) => Math.max(max, daysBetween(c.created_at)), 0);
        const avg = answered.length
            ? answered.reduce((s, c) => s + (new Date(c.resolved_at) - new Date(c.created_at)), 0) / answered.length / DAY
            : null;
        return {
            awaiting:  awaiting.length,
            oldest,
            escalated: complaints.filter(c => c.status === 'escalated').length,
            resolved:  complaints.filter(c => c.status === 'resolved').length,
            dismissed: complaints.filter(c => c.status === 'dismissed').length,
            avg,
        };
    }, [complaints]);

    const counts = useMemo(() => Object.fromEntries(STATUS_FILTERS.map(f => [f.value, complaints.filter(f.match).length])), [complaints]);

    const visible = useMemo(() => {
        const f = STATUS_FILTERS.find(x => x.value === statusFilter) ?? STATUS_FILTERS[0];
        return complaints.filter(f.match);
    }, [complaints, statusFilter]);

    const levelTabs = isUser ? [] : [
        ...(isAdmin ? [{ value: '', label: 'All levels' }] : []),
        ...(isAdmin || isCollegeOfficer ? [{ value: 'college', label: 'Level 1 · College', icon: Building2 }] : []),
        ...(isAdmin || isCategoryOfficer ? [{ value: 'officer', label: 'Level 2 · Director', icon: Scale }] : []),
    ];

    const columns = useMemo(() => [
        {
            id: 'proposal',
            header: 'Complaint',
            accessorFn: row => `${row.proposal?.tracker_number ?? ''} ${row.proposal?.title ?? ''} ${row.description ?? ''} ${row.complainant?.name ?? ''}`,
            cell: ({ row: { original: c } }) => (
                <button onClick={() => setDetail(c)} className="group block max-w-md text-left">
                    <span className="flex items-center gap-2">
                        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-700">{c.proposal?.tracker_number ?? '—'}</span>
                        <span className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-700">{c.proposal?.title}</span>
                    </span>
                    <span className="mt-1 line-clamp-1 text-xs text-gray-500">{c.description}</span>
                </button>
            ),
        },
        {
            id: 'level',
            header: 'Level & topic',
            accessorFn: row => `${row.level} ${topicLabel(row)}`,
            cell: ({ row: { original: c } }) => (
                <div className="flex flex-col items-start gap-1">
                    <LevelBadge level={c.level} />
                    <span className="text-xs text-gray-500">{topicLabel(c)}</span>
                </div>
            ),
        },
        ...(!isUser ? [{
            id: 'complainant',
            header: 'Filed by',
            accessorFn: row => row.complainant?.name ?? '',
            cell: ({ row: { original: c } }) => (
                <div>
                    <p className="text-sm text-gray-800">{c.complainant?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{formatDate(c.created_at)}</p>
                </div>
            ),
        }] : [{
            id: 'date',
            header: 'Filed',
            accessorFn: row => row.created_at,
            cell: ({ row: { original: c } }) => <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>,
        }]),
        {
            id: 'status',
            header: 'Status',
            accessorFn: row => row.status,
            cell: ({ row: { original: c } }) => (
                <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={c.status} />
                    <AgeNote complaint={c} />
                </div>
            ),
        },
        {
            id: 'actions',
            header: '',
            enableSorting: false,
            cell: ({ row: { original: c } }) => {
                const { canRespond, canEscalate } = permissions(c);
                return (
                    <div className="flex items-center justify-end gap-1.5">
                        {canRespond && (
                            <button onClick={() => setRespond(c)}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                                <MessageSquare size={11} /> Respond
                            </button>
                        )}
                        {canEscalate && (
                            <button onClick={() => setEscalate(c)}
                                className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
                                <ArrowUpCircle size={11} /> Escalate
                            </button>
                        )}
                        <button onClick={() => setDetail(c)} aria-label="Open complaint"
                            className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                            Open <ChevronRight size={12} />
                        </button>
                    </div>
                );
            },
        },
    ], [isUser, permissions]);

    const subtitle = isAdmin
        ? 'Every complaint across both levels and all colleges'
        : isCollegeOfficer
            ? 'Level 1 complaints about blind review and open defence in your college'
            : isCategoryOfficer
                ? 'Level 2 complaints after funding, and escalations, in your category'
                : 'Complaints you have filed about your proposals and how they were answered';

    return (
        <AppLayout breadcrumb="Complaints">
            <div className="mx-auto max-w-7xl space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900">
                            <MessageSquareWarning size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Complaints</h1>
                            <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        {isUser && (
                            <Link href="/my-proposals" className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                <FileText size={15} /> File from a proposal
                            </Link>
                        )}
                    </div>
                </div>

                {/* How complaints work — for the people who file them */}
                {isUser && (
                    <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-3">
                        {[
                            { icon: Building2, tone: 'bg-sky-50 text-sky-700', title: 'Level 1 · College office', text: 'For concerns during blind review or open defence. File it from the Complaints tab on your proposal.' },
                            { icon: ArrowUpCircle, tone: 'bg-orange-50 text-orange-600', title: 'Not satisfied?', text: 'Once the college office answers, you can escalate the complaint to Level 2.' },
                            { icon: Scale, tone: 'bg-violet-50 text-violet-700', title: 'Level 2 · Category director', text: 'Reviews escalations and post-funding concerns about budget or decisions.' },
                        ].map(step => (
                            <div key={step.title} className="flex gap-3">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${step.tone}`}><step.icon size={16} /></span>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{step.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatTile label="Awaiting response" value={stats.awaiting} icon={Inbox}
                        tone={stats.oldest > 14 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}
                        hint={stats.awaiting ? `Oldest waiting ${plural(stats.oldest, 'day')}` : 'Nothing waiting'} />
                    <StatTile label="Escalated" value={stats.escalated} icon={ArrowUpCircle} tone="bg-orange-50 text-orange-600"
                        hint="Moved to Level 2" />
                    <StatTile label="Closed" value={stats.resolved + stats.dismissed} icon={CheckCircle2} tone="bg-green-50 text-green-600"
                        hint={`${stats.resolved} resolved · ${stats.dismissed} dismissed`} />
                    <StatTile label="Average response time" icon={Timer} tone="bg-slate-100 text-slate-600"
                        value={stats.avg === null ? '—' : stats.avg < 1 ? '< 1 day' : plural(Math.round(stats.avg), 'day')}
                        hint="From filing to answer" />
                </div>

                {/* List */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                        {levelTabs.length > 1 ? (
                            <div className="inline-flex w-fit rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Complaint level">
                                {levelTabs.map(tab => (
                                    <button key={tab.value} role="tab" aria-selected={levelFilter === tab.value}
                                        onClick={() => setLevelFilter(tab.value)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                            levelFilter === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}>
                                        {tab.icon && <tab.icon size={12} />} {tab.label}
                                    </button>
                                ))}
                            </div>
                        ) : <p className="text-sm font-semibold text-gray-900">{isUser ? 'My complaints' : levelTabs[0]?.label}</p>}

                        <div className="flex gap-1.5 overflow-x-auto">
                            {STATUS_FILTERS.map(f => (
                                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                        statusFilter === f.value ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}>
                                    {f.label}
                                    <span className={`rounded-full px-1.5 tabular-nums ${statusFilter === f.value ? 'bg-white/20' : 'bg-white text-gray-500'}`}>{counts[f.value] ?? 0}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-5">
                        <DataTable
                            columns={columns}
                            data={visible}
                            isLoading={loading}
                            emptyMessage={
                                isUser
                                    ? 'You haven\'t filed any complaints. To file one, open a proposal and use its Complaints tab.'
                                    : statusFilter === 'awaiting' ? 'Nothing is waiting for a response.' : 'No complaints match the selected filters.'
                            }
                        />
                    </div>
                </div>
            </div>

            {detail && (
                <DetailDrawer complaint={detail} permissions={permissions} onClose={() => setDetail(null)} onAction={handleAction} />
            )}
            {respond && (
                <RespondModal complaint={respond}
                    onSave={(resolution) => done(resolution === 'dismissed' ? 'Complaint dismissed — the complainant has been notified.' : 'Complaint resolved — the complainant has been notified.')}
                    onClose={() => setRespond(null)} />
            )}
            {escalate && (
                <EscalateModal complaint={escalate} onSave={() => done('Complaint escalated to Level 2.')} onClose={() => setEscalate(null)} />
            )}
            {edit && (
                <EditModal complaint={edit} onSave={() => done('Complaint updated.')} onClose={() => setEdit(null)} />
            )}
            <ConfirmDialog
                open={!!withdraw}
                title="Withdraw complaint"
                description={`Withdraw your complaint about ${withdraw?.proposal?.tracker_number ?? 'this proposal'}? This can't be undone.`}
                confirmLabel={withdrawing ? 'Withdrawing…' : 'Withdraw'}
                confirmVariant="danger"
                onConfirm={handleWithdrawConfirm}
                onCancel={() => setWithdraw(null)}
            />
        </AppLayout>
    );
}
