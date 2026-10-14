import { useEffect, useState } from 'react';
import { GitCompare, ChevronDown, ChevronUp, Plus, Minus, ArrowRight, FileText, Users, Wallet, PenLine } from 'lucide-react';
import { get } from '../lib/api';
import { formatCurrency } from '../lib/utils';

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function TextChange({ change }) {
    const [open, setOpen] = useState(false);
    const long = String(change.before ?? '').length > 160 || String(change.after ?? '').length > 160;
    const show = (v) => (v === null || v === undefined || v === '' ? <span className="italic text-gray-400">empty</span> : String(v));

    if (!long) {
        return (
            <p className="text-xs text-gray-700">
                <span className="font-semibold">{change.label}:</span>{' '}
                <span className="rounded bg-rose-50 px-1 text-rose-700 line-through decoration-rose-300">{show(change.before)}</span>
                <ArrowRight size={11} className="mx-1 inline text-gray-400" />
                <span className="rounded bg-emerald-50 px-1 text-emerald-800">{show(change.after)}</span>
            </p>
        );
    }

    return (
        <div className="text-xs">
            <button onClick={() => setOpen(!open)} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-indigo-700">
                {change.label} was rewritten {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {open && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-3">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600">Before</p>
                        <p className="whitespace-pre-line text-gray-700">{show(change.before)}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">After</p>
                        <p className="whitespace-pre-line text-gray-700">{show(change.after)}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

function Group({ icon: Icon, title, children }) {
    return (
        <div className="flex gap-2.5">
            <Icon size={14} className="mt-0.5 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
                {children}
            </div>
        </div>
    );
}

const Added = ({ children }) => <p className="flex items-start gap-1.5 text-xs text-emerald-800"><Plus size={12} className="mt-0.5 shrink-0" />{children}</p>;
const Removed = ({ children }) => <p className="flex items-start gap-1.5 text-xs text-rose-700"><Minus size={12} className="mt-0.5 shrink-0" /><span className="line-through decoration-rose-300">{children}</span></p>;

function Changes({ changes }) {
    if (!changes || changes.count === 0) {
        return <p className="text-xs text-gray-500">Resubmitted without changes.</p>;
    }
    const { fields, team, budget, documents } = changes;
    const budgetChanged = budget.added.length || budget.removed.length || budget.changed.length;

    return (
        <div className="space-y-4">
            {fields.length > 0 && (
                <Group icon={PenLine} title="Proposal details">
                    {fields.map((c) => <TextChange key={c.field} change={c} />)}
                </Group>
            )}
            {(team.added.length > 0 || team.removed.length > 0) && (
                <Group icon={Users} title="Team">
                    {team.added.map((n) => <Added key={`a-${n}`}>{n} joined</Added>)}
                    {team.removed.map((n) => <Removed key={`r-${n}`}>{n}</Removed>)}
                </Group>
            )}
            {budgetChanged > 0 && (
                <Group icon={Wallet} title={`Budget · ${formatCurrency(budget.total_before)} → ${formatCurrency(budget.total_after)}`}>
                    {budget.added.map((l, i) => <Added key={`a${i}`}>{l.item} ({l.category}) — {formatCurrency(l.amount)}</Added>)}
                    {budget.removed.map((l, i) => <Removed key={`r${i}`}>{l.item} ({l.category}) — {formatCurrency(l.amount)}</Removed>)}
                    {budget.changed.map((l, i) => (
                        <p key={`c${i}`} className="text-xs text-gray-700">
                            {l.item} ({l.category}): {formatCurrency(l.before)} <ArrowRight size={11} className="mx-0.5 inline text-gray-400" /> <span className="font-semibold">{formatCurrency(l.amount)}</span>
                        </p>
                    ))}
                </Group>
            )}
            {(documents.added.length > 0 || documents.removed.length > 0) && (
                <Group icon={FileText} title="Documents">
                    {documents.added.map((n, i) => <Added key={`a${i}`}>{n} uploaded</Added>)}
                    {documents.removed.map((n, i) => <Removed key={`r${i}`}>{n}</Removed>)}
                </Group>
            )}
        </div>
    );
}

/** Submission versions of a proposal, newest first, each showing what changed since the previous one. */
export default function ProposalVersions({ proposalId }) {
    const [versions, setVersions] = useState(null);
    const [openId, setOpenId] = useState(null);

    useEffect(() => {
        get(`/proposals/${proposalId}/versions`)
            .then((r) => {
                const list = r.data ?? [];
                setVersions(list);
                setOpenId(list[0]?.changes ? list[0].id : null);
            })
            .catch(() => setVersions([]));
    }, [proposalId]);

    // Nothing to compare until the proposal has been resubmitted at least once.
    if (!versions || versions.length < 2) return null;

    return (
        <section className="mb-5 overflow-hidden rounded-2xl border border-indigo-100 bg-white">
            <header className="flex items-center gap-2.5 border-b border-indigo-50 bg-indigo-50/40 px-5 py-3.5">
                <GitCompare size={16} className="text-indigo-600" />
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Submission Versions</h3>
                    <p className="text-xs text-gray-500">Submitted {versions.length} times — expand a version to see what changed from the one before.</p>
                </div>
            </header>
            <ol className="divide-y divide-gray-100">
                {versions.map((v) => {
                    const open = openId === v.id;
                    return (
                        <li key={v.id}>
                            <button onClick={() => setOpenId(open ? null : v.id)} disabled={!v.changes}
                                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">v{v.version_number}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900">{v.version_number === 1 ? 'First submission' : 'Resubmission'}</p>
                                    <p className="text-xs text-gray-500">{formatDate(v.submitted_at)}{v.submitted_by ? ` · ${v.submitted_by}` : ''}</p>
                                </div>
                                {v.changes && (
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        {v.changes.count} change{v.changes.count === 1 ? '' : 's'} {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </span>
                                )}
                            </button>
                            {open && v.changes && <div className="px-5 pb-4 pl-15"><Changes changes={v.changes} /></div>}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
