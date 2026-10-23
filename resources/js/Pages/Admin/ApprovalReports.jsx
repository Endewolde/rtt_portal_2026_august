import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    ShieldQuestion, RefreshCw, Clock, CheckCircle2, XCircle, ChevronRight, ChevronDown, RotateCcw, Search,
    Building2, Hourglass, Gavel, Flag, Ban, Timer, Inbox,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { formatDate, getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';
import ResolveApprovalReportModal from '../../Components/ResolveApprovalReportModal';
import ReportMistakenApprovalModal from '../../Components/ReportMistakenApprovalModal';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { APPROVAL_REPORT_ISSUES, issueByKey } from '../../lib/approvalReportIssues';

const PER_PAGE = 20;

const TABS = [
    { key: 'open', label: 'Open', icon: Clock, active: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
    { key: 'reviewed', label: 'Reviewed', icon: CheckCircle2, active: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    { key: 'withdrawn', label: 'Cancelled', icon: XCircle, active: 'text-gray-700', badge: 'bg-gray-200 text-gray-600' },
];

const STATUS_LABELS = {
    submitted: 'Submitted', validated: 'Validated', under_blind_review: 'Under Blind Review',
    blind_review_passed: 'Blind Review Passed', under_open_defence: 'Under Open Defence',
    accepted: 'Central Evaluation', funded: 'Funded', rejected: 'Rejected',
};

const OUTCOMES = {
    approval_revoked: { label: 'Mistaken approval confirmed', short: 'Approval revoked', pill: 'bg-red-50 text-red-700 ring-red-200', panel: 'border-red-100 bg-red-50/60', title: 'text-red-700', bar: 'bg-red-500', icon: Ban },
    approval_stands: { label: 'Approval stands', short: 'Approval stands', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', panel: 'border-emerald-100 bg-emerald-50/60', title: 'text-emerald-700', bar: 'bg-emerald-500', icon: CheckCircle2 },
    moved_to_ongoing: { label: 'Already ongoing — moved to Ongoing Proposals', short: 'Moved to ongoing', pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200', panel: 'border-indigo-100 bg-indigo-50/60', title: 'text-indigo-700', bar: 'bg-indigo-500', icon: Gavel },
};

const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function StatCard({ icon: Icon, tone, label, value, hint }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon size={15} /></span>
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
            <p className="mt-0.5 min-h-4 text-[11px] text-gray-400">{hint}</p>
        </div>
    );
}

/** How reviewed reports ended, as one stacked bar with a legend. */
function OutcomeCard({ outcomes }) {
    const total = Object.values(outcomes ?? {}).reduce((a, b) => a + b, 0);

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <span className="text-xs font-medium text-gray-500">Review outcomes</span>
            {total === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No reviewed reports yet.</p>
            ) : (
                <>
                    <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-gray-100">
                        {Object.entries(OUTCOMES).map(([key, o]) => outcomes[key] > 0 && (
                            <div key={key} className={o.bar} style={{ width: `${(outcomes[key] / total) * 100}%` }} title={`${o.short}: ${outcomes[key]}`} />
                        ))}
                    </div>
                    <ul className="mt-3 space-y-1">
                        {Object.entries(OUTCOMES).map(([key, o]) => (
                            <li key={key} className="flex items-center justify-between text-[11px] text-gray-600">
                                <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${o.bar}`} /> {o.short}</span>
                                <span className="font-semibold tabular-nums text-gray-800">{outcomes[key] ?? 0}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

function AgeBadge({ days }) {
    const tone = days > 7 ? 'bg-red-50 text-red-700 ring-red-200' : days > 3 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-gray-50 text-gray-600 ring-gray-200';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}>
            <Hourglass size={11} /> {days === 0 ? 'Today' : `Waiting ${plural(days, 'day')}`}
        </span>
    );
}

function SkeletonList() {
    return (
        <div className="space-y-3">
            {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="flex gap-4">
                        <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
                            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function ApprovalReports() {
    const { success, error } = useToast();
    const [reports, setReports] = useState([]);
    const [meta, setMeta] = useState({ page: 1, last: 1, total: 0 });
    const [stats, setStats] = useState(null);
    const [colleges, setColleges] = useState([]);
    const [canResolve, setCanResolve] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [tab, setTab] = useState('open');
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [issue, setIssue] = useState('');
    const [collegeId, setCollegeId] = useState('');
    const [sort, setSort] = useState('newest');

    const [reviewing, setReviewing] = useState(null);
    const [reportingAgain, setReportingAgain] = useState(null);
    const [cancelling, setCancelling] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    const fetchPage = useCallback(async (page) => {
        const params = { status: tab, per_page: PER_PAGE, page, sort };
        if (debounced) params.search = debounced;
        if (issue) params.issue_type = issue;
        if (collegeId) params.college_id = collegeId;
        const res = await get('/approval-reports', params);
        setStats(res.meta?.stats ?? null);
        setColleges(res.meta?.colleges ?? []);
        setCanResolve(res.meta?.can_resolve ?? false);
        setMeta({ page: res.data?.current_page ?? 1, last: res.data?.last_page ?? 1, total: res.data?.total ?? 0 });
        return res.data?.data ?? [];
    }, [tab, debounced, issue, collegeId, sort]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setReports(await fetchPage(1));
        } catch {
            error('Failed to load approval reports.');
        }
        setLoading(false);
    }, [fetchPage]);

    useEffect(() => { load(); }, [load]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const next = await fetchPage(meta.page + 1);
            setReports((prev) => [...prev, ...next]);
        } catch {
            error('Failed to load more reports.');
        }
        setLoadingMore(false);
    };

    const cancelReport = async () => {
        const report = cancelling;
        setCancelling(null);
        try {
            const res = await post(`/approval-reports/${report.id}/withdraw`, {});
            success(res.message ?? 'Report cancelled.');
            load();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not cancel the report.');
        }
    };

    const filtered = !!(debounced || issue || collegeId);
    const clearFilters = () => { setSearch(''); setDebounced(''); setIssue(''); setCollegeId(''); };

    return (
        <AppLayout breadcrumb="Approval Reports">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-slate-800 to-slate-950 shadow-sm">
                            <ShieldQuestion size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Approval Reports</h1>
                            <p className="mt-0.5 text-sm text-gray-500">
                                {canResolve
                                    ? 'Proposals a college officer flagged as possibly approved by mistake.'
                                    : "Track the mistaken-approval reports you've filed."}
                            </p>
                        </div>
                    </div>
                    <button onClick={load} className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard icon={Clock} tone="bg-amber-100 text-amber-600" label="Open" value={stats.open}
                            hint={stats.oldest_open_days != null ? `Oldest waiting ${plural(stats.oldest_open_days, 'day')}` : 'Nothing waiting'} />
                        <StatCard icon={CheckCircle2} tone="bg-emerald-100 text-emerald-600" label="Reviewed" value={stats.reviewed}
                            hint={stats.avg_review_days != null ? `Reviewed in ${stats.avg_review_days} days on average` : ''} />
                        <StatCard icon={XCircle} tone="bg-gray-100 text-gray-500" label="Cancelled" value={stats.withdrawn} hint="Withdrawn by the reporting officer" />
                        <OutcomeCard outcomes={stats.outcomes} />
                    </div>
                )}

                {/* Tabs + toolbar */}
                <div className="mb-4 rounded-2xl border border-gray-200 bg-white">
                    <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-2 pt-2">
                        {TABS.map((t) => {
                            const Icon = t.icon;
                            const active = tab === t.key;
                            return (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    className={`relative inline-flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${active ? t.active : 'text-gray-500 hover:text-gray-700'}`}>
                                    <Icon size={14} /> {t.label}
                                    {stats && <span className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${active ? t.badge : 'bg-gray-100 text-gray-500'}`}>{stats[t.key]}</span>}
                                    {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-current" />}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
                        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-slate-200">
                            <Search size={14} className="shrink-0 text-gray-400" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tracker number, title or reporting officer…"
                                className="w-full bg-transparent text-sm focus:outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:flex">
                            <select value={issue} onChange={(e) => setIssue(e.target.value)}
                                className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-200 md:w-48">
                                <option value="">All issues</option>
                                {APPROVAL_REPORT_ISSUES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                            </select>
                            {colleges.length > 0 && (
                                <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)}
                                    className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-200 md:w-44">
                                    <option value="">All colleges</option>
                                    {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            <select value={sort} onChange={(e) => setSort(e.target.value)}
                                className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-200">
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* List */}
                {loading ? <SkeletonList /> : reports.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-14 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><Inbox size={22} className="text-gray-400" /></div>
                        <h3 className="font-semibold text-gray-700">{filtered ? 'No reports match your filters' : `No ${TABS.find((t) => t.key === tab).label.toLowerCase()} reports`}</h3>
                        <p className="mt-1 text-sm text-gray-400">
                            {filtered ? 'Try a different search or clear the filters.'
                                : tab === 'open' ? 'Nothing is waiting for review.' : tab === 'withdrawn' ? 'No reports have been cancelled.' : 'No reports have been reviewed yet.'}
                        </p>
                        {filtered && <button onClick={clearFilters} className="mt-4 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Clear filters</button>}
                    </div>
                ) : (
                    <>
                        <p className="mb-2 px-1 text-xs text-gray-400">Showing {reports.length} of {meta.total}</p>
                        <div className="space-y-3">
                            {reports.map((rep) => (
                                <ReportCard key={rep.id} report={rep} canResolve={canResolve}
                                    onReview={() => setReviewing(rep)} onReportAgain={() => setReportingAgain(rep)} onCancel={() => setCancelling(rep)} />
                            ))}
                        </div>
                        {meta.page < meta.last && (
                            <div className="mt-4 text-center">
                                <button onClick={loadMore} disabled={loadingMore}
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                                    {loadingMore ? <RefreshCw size={14} className="animate-spin" /> : <ChevronDown size={14} />} Load more
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {reviewing && (
                <ResolveApprovalReportModal report={reviewing} onSaved={() => { setReviewing(null); load(); }} onClose={() => setReviewing(null)} />
            )}

            {cancelling && (
                <ConfirmDialog
                    open
                    title="Cancel this report?"
                    description={`Use this if you reported ${cancelling.proposal?.tracker_number ?? 'this proposal'} by mistake. The proposal goes back to where it was and the directors are told no action is needed.`}
                    confirmLabel="Cancel report"
                    cancelLabel="Keep report"
                    onConfirm={cancelReport}
                    onCancel={() => setCancelling(null)}
                />
            )}

            {reportingAgain && (
                <ReportMistakenApprovalModal
                    proposal={reportingAgain.proposal}
                    previousReport={reportingAgain}
                    onReported={() => { setReportingAgain(null); setTab('open'); load(); }}
                    onClose={() => setReportingAgain(null)}
                />
            )}
        </AppLayout>
    );
}

function ReportCard({ report, canResolve, onReview, onReportAgain, onCancel }) {
    const [expanded, setExpanded] = useState(false);
    const status = report.status;
    const issue = issueByKey(report.issue_type);
    const IssueIcon = issue?.icon ?? Flag;
    const outcome = OUTCOMES[report.outcome];
    const stripe = status === 'open' ? 'bg-amber-400' : status === 'withdrawn' ? 'bg-gray-300' : (outcome?.bar ?? 'bg-emerald-500');
    const proposal = report.proposal ?? {};

    return (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm">
            <div className={`absolute inset-y-0 left-0 w-1 ${stripe}`} />
            <div className="p-4 pl-5 sm:p-5 sm:pl-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-100 sm:flex">
                        <IssueIcon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/proposals/${report.proposal_id}`}
                                className="rounded-lg bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 hover:bg-blue-100">
                                {proposal.tracker_number}
                            </Link>
                            <span className="text-[11px] text-gray-400">{getCategoryLabel(proposal.category)}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {STATUS_LABELS[proposal.status] ?? proposal.status}
                            </span>
                            {status === 'open' && <AgeBadge days={daysSince(report.created_at)} />}
                            {status === 'reviewed' && outcome && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${outcome.pill}`}>
                                    <outcome.icon size={11} /> {outcome.short}
                                </span>
                            )}
                        </div>

                        <Link href={`/proposals/${report.proposal_id}`} className="mt-1.5 block font-semibold leading-snug text-gray-900 hover:text-blue-700 line-clamp-2">
                            {proposal.title}
                        </Link>

                        {report.issue_label && (
                            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                                <IssueIcon size={12} /> {report.issue_label}
                            </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span>Reported by <span className="font-medium text-gray-700">{report.reported_by?.name ?? '—'}</span> · {formatDate(report.created_at)}</span>
                            {proposal.college?.name && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {proposal.college.name}</span>}
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                        {status === 'open' && canResolve && (
                            <button onClick={onReview}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800">
                                Review <ChevronRight size={13} />
                            </button>
                        )}
                        {report.can_cancel && (
                            <button onClick={onCancel}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                <XCircle size={13} /> Cancel report
                            </button>
                        )}
                        {status === 'open' && !canResolve && !report.can_cancel && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Timer size={12} /> Awaiting the director</span>
                        )}
                        {report.can_report_again && (
                            <button onClick={onReportAgain}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                                <RotateCcw size={13} /> Report again
                            </button>
                        )}
                        <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                            Details <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {expanded && <ReportTimeline report={report} outcome={outcome} canResolve={canResolve} />}
            </div>
        </div>
    );
}

/** What happened to the report, step by step. */
function ReportTimeline({ report, outcome, canResolve }) {
    const steps = [
        {
            icon: Flag, tone: 'bg-amber-100 text-amber-700',
            title: report.issue_label ? `Reported: ${report.issue_label}` : 'Reported',
            meta: `${report.reported_by?.name ?? 'College officer'} · ${formatDate(report.created_at)}`,
            body: report.reason || null, empty: 'No additional details given.',
        },
    ];

    if (report.status === 'reviewed') {
        steps.push({
            icon: outcome?.icon ?? CheckCircle2, tone: outcome ? `${outcome.pill.split(' ').slice(0, 2).join(' ')}` : 'bg-emerald-100 text-emerald-700',
            title: outcome?.label ?? 'Reviewed',
            meta: `${report.reviewed_by?.name ?? 'Director'} · ${formatDate(report.reviewed_at)}`,
            body: report.resolution_notes || null, panel: outcome?.panel,
        });
    } else if (report.status === 'withdrawn') {
        steps.push({
            icon: XCircle, tone: 'bg-gray-100 text-gray-500', title: 'Cancelled by the reporting officer',
            meta: `${report.reported_by?.name ?? 'Reporting officer'} · ${formatDate(report.withdrawn_at)}`,
        });
    } else {
        steps.push({
            icon: Clock, tone: 'bg-gray-100 text-gray-400', title: 'Waiting for a director to review', meta: `Open for ${plural(daysSince(report.created_at), 'day')}`, pending: true,
        });
    }

    const stillReportable = ['validated', 'under_blind_review', 'blind_review_passed'].includes(report.proposal?.status);

    return (
        <div className="mt-4 border-t border-gray-100 pt-4">
            <ol className="relative space-y-4">
                {steps.map((s, i) => (
                    <li key={i} className="relative flex gap-3">
                        {i < steps.length - 1 && <span className="absolute left-3.75 top-8 -bottom-4 w-px bg-gray-200" />}
                        <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.tone}`}><s.icon size={14} /></span>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <p className={`text-sm font-semibold ${s.pending ? 'text-gray-500' : 'text-gray-900'}`}>{s.title}</p>
                            <p className="text-[11px] text-gray-400">{s.meta}</p>
                            {(s.body || s.empty) && (
                                <div className={`mt-2 rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${s.panel ?? 'border-slate-100 bg-slate-50'}`}>
                                    {s.body ? <p className="whitespace-pre-line text-gray-700">{s.body}</p> : <p className="italic text-gray-400">{s.empty}</p>}
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ol>

            {report.outcome === 'approval_stands' && !canResolve && !report.can_report_again && (
                <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    {stillReportable
                        ? 'A newer report has already been filed for this proposal.'
                        : `The proposal has moved on to ${STATUS_LABELS[report.proposal?.status] ?? report.proposal?.status}, so it can no longer be reported.`}
                </p>
            )}
        </div>
    );
}
