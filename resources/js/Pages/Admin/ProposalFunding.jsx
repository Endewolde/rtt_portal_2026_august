import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    BadgeDollarSign, Pencil, FileText, ReceiptText, Hash, XCircle, AlertTriangle, User, X, Search,
    Loader2, Trophy, Wallet, TrendingUp, Building2, Award,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import { PageHeader, StatCard, Panel, EmptyState, Select, RefreshButton, StatSkeletons, Skeleton, DataTable } from '../../Components/Insights/Kit';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatDate, formatCurrency } from '../../lib/utils';
import { currency, term } from '../../lib/terms';
import { programmes, programmeLabel, programmeColor } from '../../lib/programmes';
import RejectWithReasonModal from '../../Components/RejectWithReasonModal';
import ProposalHover from '../../Components/Finance/ProposalHover';
import DownloadMenu from '../../Components/Finance/DownloadMenu';
import ClearButton from '../../Components/Finance/ClearButton';

const RUNNING = { funded: 'Funded', midterm_evaluation: 'Midterm evaluation' };

const STATUS_LABELS = {
    draft: ['Draft', 'bg-gray-100 text-gray-600'],
    submitted: ['Submitted', 'bg-sky-50 text-sky-700'],
    validated: ['Validated', 'bg-indigo-50 text-indigo-700'],
    under_blind_review: ['Blind review', 'bg-violet-50 text-violet-700'],
    blind_review_passed: ['Blind review passed', 'bg-orange-50 text-orange-700'],
    under_open_defence: ['Open defence', 'bg-purple-50 text-purple-700'],
    accepted: ['Central evaluation', 'bg-teal-50 text-teal-700'],
    funded: ['Funded', 'bg-emerald-50 text-emerald-700'],
    midterm_evaluation: ['Midterm', 'bg-cyan-50 text-cyan-700'],
    completed: ['Completed', 'bg-green-50 text-green-700'],
    rejected: ['Rejected', 'bg-red-50 text-red-700'],
    archived: ['Archived', 'bg-slate-100 text-slate-600'],
};

const amountOf = (p) => parseFloat(p.award?.awarded_amount ?? 0);

function ProgrammeChip({ category }) {
    const color = programmeColor(category);
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {programmeLabel(category)}
        </span>
    );
}

function Sheet({ title, subtitle, icon: Icon, tone, onClose, children, footer }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                            {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>}
            </div>
        </div>
    );
}

function EditAmountModal({ proposal, onSave, onClose }) {
    const [amount, setAmount] = useState(String(proposal.award?.awarded_amount ?? ''));
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();
    const before = amountOf(proposal);
    const after = parseFloat(amount) || 0;

    const save = async () => {
        if (!(after > 0)) return error('Enter an amount above zero.');
        setSaving(true);
        try {
            await api.patch(`/proposals/${proposal.id}/award`, { awarded_amount: after });
            success('Awarded amount updated.');
            onSave();
        } catch (e) { error(e.response?.data?.message || 'The amount could not be updated.'); }
        setSaving(false);
    };

    return (
        <Sheet title="Awarded amount" subtitle={`${proposal.tracker_number} · ${proposal.title}`} icon={Pencil} tone="bg-emerald-100 text-emerald-600" onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={save} disabled={saving || after === before}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {saving && <Loader2 size={14} className="animate-spin" />} Save
                </button>
            </>}>
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Amount ({currency()})</span>
                <input type="number" min="0" step="0.01" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-lg font-semibold tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            {after > 0 && after !== before && (
                <p className={`rounded-xl px-3 py-2 text-xs ${after > before ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                    {after > before ? 'Up' : 'Down'} {formatCurrency(Math.abs(after - before))} from {formatCurrency(before)}.
                </p>
            )}
        </Sheet>
    );
}

function PIHistoryModal({ piId, piName, onClose }) {
    const [history, setHistory] = useState(undefined);

    useEffect(() => {
        api.get(`/users/${piId}/proposal-history`).then((r) => setHistory(r.data?.data ?? null)).catch(() => setHistory(null));
    }, [piId]);

    const s = history?.summary;

    return (
        <Sheet title="Funding history" subtitle={piName} icon={User} tone="bg-slate-100 text-slate-700" onClose={onClose}>
            {history === undefined ? (
                <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : !history ? (
                <p className="py-6 text-center text-sm text-gray-500">The history could not be loaded.</p>
            ) : (
                <>
                    {(s.funded_active > 1 || s.unsettled_budgets > 0) && (
                        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                            <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={13} /> Worth a look</p>
                            {s.funded_active > 1 && <p>Leads <strong>{s.funded_active}</strong> funded projects at once (this one included).</p>}
                            {s.unsettled_budgets > 0 && <p><strong>{s.unsettled_budgets}</strong> approved budget request{s.unsettled_budgets === 1 ? ' is' : 's are'} not settled yet.</p>}
                        </div>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                        {[['Total', s.total, 'text-gray-900'], ['Funded', s.funded_active, 'text-emerald-700'], ['In review', s.pending_review, 'text-sky-700'], ['Rejected', s.rejected, 'text-red-700']].map(([label, v, cls]) => (
                            <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
                                <p className={`text-xl font-bold tabular-nums ${cls}`}>{v}</p>
                                <p className="text-[11px] text-gray-500">{label}</p>
                            </div>
                        ))}
                    </div>
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                        {history.proposals.map((p) => {
                            const [label, cls] = STATUS_LABELS[p.status] ?? [p.status, 'bg-gray-100 text-gray-600'];
                            return (
                                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <ProposalHover id={p.id}><Link href={`/proposals/${p.id}`} className="font-mono text-xs font-bold text-indigo-600">{p.tracker_number}</Link></ProposalHover>
                                        <p className="truncate text-xs text-gray-700">{p.title}</p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-gray-400">{p.academic_year}</span>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </Sheet>
    );
}

export default function ProposalFunding() {
    const { error, success } = useToast();
    const { hasPermission } = useAuth();
    const [view, setView] = useViewPreference('proposal_funding', 'card');
    const [proposals, setProposals] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [revoking, setRevoking] = useState(null);
    const [piHistory, setPiHistory] = useState(null);

    const [search, setSearch] = useState('');
    const [programme, setProgramme] = useState('');
    const [college, setCollege] = useState('');
    const [year, setYear] = useState('');
    const [stage, setStage] = useState('');
    const [sort, setSort] = useState('newest');

    const canEdit = hasPermission('funding.manage');
    const canRevoke = hasPermission('funding.revoke');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/proposals', { params: { status: Object.keys(RUNNING).join(','), per_page: 200, with_award: 1 } });
            const items = res.data?.data?.data ?? res.data?.data ?? [];
            setProposals(items.map((p) => ({ ...p, award: p.award ?? null })));
        } catch {
            setProposals([]);
            error('Could not load funded projects.');
        }
        setLoading(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const all = proposals ?? [];
    const years = [...new Set(all.map((p) => p.academic_year).filter(Boolean))].sort().reverse();
    const colleges = [...new Map(all.filter((p) => p.college).map((p) => [p.college.id ?? p.college_id, p.college.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = all.filter((p) => (!programme || p.category === programme)
            && (!college || (p.college?.id ?? p.college_id) === college)
            && (!year || p.academic_year === year)
            && (!stage || p.status === stage)
            && (!q || [p.tracker_number, p.title, p.pi?.name, p.award?.grant_reference].some((v) => v?.toLowerCase().includes(q))));
        const by = {
            newest: (a, b) => new Date(b.award?.approved_at ?? b.updated_at ?? 0) - new Date(a.award?.approved_at ?? a.updated_at ?? 0),
            largest: (a, b) => amountOf(b) - amountOf(a),
            smallest: (a, b) => amountOf(a) - amountOf(b),
            tracker: (a, b) => (a.tracker_number ?? '').localeCompare(b.tracker_number ?? ''),
        };
        return [...list].sort(by[sort]);
    }, [all, search, programme, college, year, stage, sort]);

    const total = visible.reduce((s, p) => s + amountOf(p), 0);
    const missingRef = visible.filter((p) => !p.award?.grant_reference).length;
    const largest = visible.reduce((m, p) => (amountOf(p) > amountOf(m ?? {}) ? p : m), null);
    const byProgramme = useMemo(() => {
        const map = new Map();
        visible.forEach((p) => map.set(p.category, (map.get(p.category) ?? 0) + amountOf(p)));
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
    }, [visible]);

    const exportColumns = [
        { label: 'Tracker', value: (p) => p.tracker_number },
        { label: 'Grant reference', value: (p) => p.award?.grant_reference },
        { label: 'Title', value: (p) => p.title },
        { label: 'PI', value: (p) => p.pi?.name },
        { label: term('college'), value: (p) => p.college?.name },
        { label: 'Programme', value: (p) => programmeLabel(p.category) },
        { label: 'Academic year', value: (p) => p.academic_year },
        { label: 'Stage', value: (p) => RUNNING[p.status] ?? p.status },
        { label: 'Awarded', value: (p) => amountOf(p) },
        { label: 'Awarded on', value: (p) => (p.award?.approved_at ? formatDate(p.award.approved_at) : '') },
    ];
    const filtersOn = !!(search || programme || college || year || stage || sort !== 'newest');
    const clearFilters = () => { setSearch(''); setProgramme(''); setCollege(''); setYear(''); setStage(''); setSort('newest'); };

    const actions = (p, compact) => (
        <div className={`flex items-center ${compact ? 'justify-end gap-1' : 'flex-wrap gap-1'}`}>
            <Link href={`/proposals/${p.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100" title="Open proposal">
                <FileText size={12} /> {!compact && 'Proposal'}
            </Link>
            <Link href={`/proposals/${p.id}/award`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100" title="Award details">
                <Award size={12} /> {!compact && 'Award'}
            </Link>
            <Link href={`/budget-requests?proposal=${encodeURIComponent(p.tracker_number ?? '')}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100" title="Budget requests">
                <ReceiptText size={12} /> {!compact && 'Budget requests'}
            </Link>
            {canRevoke && p.status === 'funded' && (
                <button onClick={() => setRevoking(p)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 ${compact ? '' : 'ml-auto'}`} title="Revoke funding">
                    <XCircle size={12} /> {!compact && 'Revoke funding'}
                </button>
            )}
        </div>
    );

    const columns = [
        { key: 'tracker', label: 'Project', render: (p) => (
            <div className="min-w-0">
                <ProposalHover id={p.id}><Link href={`/proposals/${p.id}`} className="font-mono text-xs font-bold text-indigo-600">{p.tracker_number}</Link></ProposalHover>
                <p className="max-w-72 truncate text-xs text-gray-600">{p.title}</p>
            </div>
        ) },
        { key: 'ref', label: 'Grant ref', render: (p) => p.award?.grant_reference ? <span className="font-mono text-xs text-gray-700">{p.award.grant_reference}</span> : <span className="text-xs text-amber-600">Missing</span> },
        { key: 'pi', label: 'PI', render: (p) => <button onClick={() => setPiHistory({ id: p.pi?.id, name: p.pi?.name })} className="text-xs font-medium text-gray-700 hover:text-indigo-600 hover:underline">{p.pi?.name}</button> },
        { key: 'prog', label: 'Programme', render: (p) => <ProgrammeChip category={p.category} /> },
        { key: 'amount', label: 'Awarded', align: 'right', render: (p) => <span className="font-semibold text-gray-900">{p.award ? formatCurrency(amountOf(p)) : '—'}</span> },
        { key: 'act', label: '', align: 'right', render: (p) => actions(p, true) },
    ];

    return (
        <AppLayout breadcrumb="Proposal Funding">
            <div className="mx-auto max-w-6xl space-y-5">
                <WorkflowBreadcrumb current="funded" />

                <PageHeader icon={BadgeDollarSign} color="emerald" title="Proposal Funding"
                    description="Funded projects with their awards — adjust amounts, follow each PI’s record, or revoke funding.">
                    <ViewToggle view={view} onChange={setView} />
                    <DownloadMenu filename="funded-projects" title="Funded projects" subtitle={`Total awarded ${formatCurrency(total)}`} columns={exportColumns} rows={visible} />
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {proposals === null ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={Trophy} color="emerald" label="Funded projects" value={visible.length} hint={`${all.filter((p) => p.status === 'midterm_evaluation').length} at midterm`} />
                        <StatCard icon={Wallet} color="indigo" label="Total awarded" value={formatCurrency(total)} hint={visible.length ? `Average ${formatCurrency(total / visible.length)}` : '—'} />
                        <StatCard icon={TrendingUp} color="violet" label="Largest award" value={largest ? formatCurrency(amountOf(largest)) : '—'} hint={largest?.tracker_number ?? ''} />
                        <StatCard icon={Hash} color={missingRef ? 'amber' : 'slate'} label="Missing grant reference" value={missingRef}
                            hint={missingRef ? 'Set it on the award page' : 'Every award has one'} hintTone={missingRef ? 'text-amber-600 font-medium' : undefined} />
                    </div>
                )}

                {byProgramme.length > 1 && total > 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="text-sm font-semibold text-gray-900">Awarded by programme</p>
                        <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-gray-100">
                            {byProgramme.map(([key, v]) => <div key={key} className="h-full" style={{ width: `${(v / total) * 100}%`, backgroundColor: programmeColor(key) }} title={`${programmeLabel(key)}: ${formatCurrency(v)}`} />)}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
                            {byProgramme.map(([key, v]) => (
                                <span key={key} className="inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: programmeColor(key) }} /> {programmeLabel(key)}
                                    <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(v)}</span>
                                    <span className="text-gray-400">{Math.round((v / total) * 100)}%</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 lg:flex-row">
                    <label className="relative min-w-0 flex-1">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tracker, grant reference, title or PI…"
                            className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:text-sm" />
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Select label="Stage" value={stage} onChange={setStage} className="sm:w-40">
                            <option value="">Any stage</option>
                            {Object.entries(RUNNING).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        {programmes({ includeInactive: true }).length > 1 && (
                            <Select label="Programme" value={programme} onChange={setProgramme} className="sm:w-44">
                                <option value="">All programmes</option>
                                {programmes({ includeInactive: true }).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                            </Select>
                        )}
                        {colleges.length > 1 && (
                            <Select label={term('college')} value={college} onChange={setCollege} className="sm:w-44">
                                <option value="">All {term('college', { plural: true, lower: true })}</option>
                                {colleges.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                            </Select>
                        )}
                        {years.length > 1 && (
                            <Select label="Year" value={year} onChange={setYear} className="sm:w-36">
                                <option value="">All years</option>
                                {years.map((y) => <option key={y} value={y}>{y}</option>)}
                            </Select>
                        )}
                        <Select label="Sort" value={sort} onChange={setSort} className="sm:w-40">
                            <option value="newest">Newest award</option>
                            <option value="largest">Largest first</option>
                            <option value="smallest">Smallest first</option>
                            <option value="tracker">Tracker number</option>
                        </Select>
                        {filtersOn && <ClearButton onClick={clearFilters} />}
                    </div>
                </div>

                {proposals === null ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
                ) : visible.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={BadgeDollarSign} title={all.length ? 'Nothing matches' : 'No funded projects yet'}
                            text={all.length ? 'Try another search or filter.' : 'Projects appear here once central evaluation funds them.'} />
                    </Panel>
                ) : view === 'table' ? (
                    <Panel bodyClassName="p-0"><DataTable columns={columns} rows={visible} rowKey={(p) => p.id} minWidth={860} /></Panel>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {visible.map((p) => (
                            <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md">
                                <div className="flex flex-1 items-start gap-4 p-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <ProposalHover id={p.id} className="font-mono text-xs font-bold text-indigo-600">{p.tracker_number}</ProposalHover>
                                            {p.award?.grant_reference
                                                ? <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-600"><Hash size={10} />{p.award.grant_reference}</span>
                                                : <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">No grant ref</span>}
                                            <ProgrammeChip category={p.category} />
                                            {p.status === 'midterm_evaluation' && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">Midterm</span>}
                                        </div>
                                        <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold text-gray-900"><ProposalHover id={p.id}>{p.title}</ProposalHover></h3>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                            <button onClick={() => setPiHistory({ id: p.pi?.id, name: p.pi?.name })} className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-indigo-600 hover:underline" title="Funding history">
                                                <User size={11} /> {p.pi?.name}
                                            </button>
                                            {p.college?.name && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {p.college.name}</span>}
                                            {p.academic_year && <span>{p.academic_year}</span>}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-lg font-bold tabular-nums text-emerald-700">{p.award ? formatCurrency(amountOf(p)) : '—'}</p>
                                        {p.award?.approved_at && <p className="text-[11px] text-gray-400">awarded {formatDate(p.award.approved_at)}</p>}
                                        {canEdit && p.award && (
                                            <button onClick={() => setEditing(p)} className="mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-emerald-50 hover:text-emerald-700">
                                                <Pencil size={11} /> Change
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-gray-100 bg-gray-50/60 px-2 py-1.5">{actions(p, false)}</div>
                            </article>
                        ))}
                    </div>
                )}

            </div>

            {editing && <EditAmountModal proposal={editing} onSave={() => { setEditing(null); load(); }} onClose={() => setEditing(null)} />}
            {revoking && (
                <RejectWithReasonModal context="funding_revocation" title="Revoke funding" subtitle={`${revoking.tracker_number ?? ''} · ${revoking.title ?? ''}`}
                    note="This can't be undone through the normal workflow. The project moves to Rejected and the PI is told this reason."
                    confirmLabel="Revoke funding" onClose={() => setRevoking(null)}
                    onSubmit={async (payload) => {
                        const res = await api.post(`/proposals/${revoking.id}/funding/revoke`, payload);
                        success(res.data?.message || 'Funding revoked.');
                        setRevoking(null);
                        load();
                    }} />
            )}
            {piHistory && <PIHistoryModal piId={piHistory.id} piName={piHistory.name} onClose={() => setPiHistory(null)} />}
        </AppLayout>
    );
}
