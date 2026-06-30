import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import {
    Trophy, Beaker, DollarSign, Clock,
    RefreshCw, Building2, Users, ChevronRight, AlertTriangle,
    FileText, Calendar, Hash, BadgeCheck,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import api from '../../lib/api';
import { useToast } from '../../Components/Toast';
import { formatCurrency, getCategoryLabel } from '../../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ACCENT = {
    research:             { border: 'border-l-indigo-500',  badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    community_engagement: { border: 'border-l-teal-500',    badge: 'bg-teal-50 text-teal-700 border-teal-200'       },
    technology_transfer:  { border: 'border-l-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200'    },
};

function accent(category) {
    return CATEGORY_ACCENT[category] ?? { border: 'border-l-gray-300', badge: 'bg-gray-50 text-gray-600 border-gray-200' };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }) {
    const colors = {
        emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
        blue:    { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',       val: 'text-blue-700'    },
        violet:  { bg: 'bg-violet-50',  icon: 'bg-violet-100 text-violet-600',   val: 'text-violet-700'  },
        gray:    { bg: 'bg-gray-50',    icon: 'bg-gray-100 text-gray-500',       val: 'text-gray-700'    },
    }[color] ?? { bg: 'bg-gray-50', icon: 'bg-gray-100 text-gray-500', val: 'text-gray-700' };

    return (
        <div className={`${colors.bg} border border-white rounded-2xl px-5 py-4 flex items-center gap-4`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-2xl font-bold leading-none mt-0.5 ${colors.val}`}>{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, count, description, color }) {
    const colors = {
        emerald: { border: 'border-l-emerald-500', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
        blue:    { border: 'border-l-blue-500',    icon: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700'       },
    }[color] ?? { border: 'border-l-gray-400', icon: 'text-gray-500', badge: 'bg-gray-100 text-gray-600' };

    return (
        <div className={`border-l-4 ${colors.border} pl-4 mb-4`}>
            <div className="flex items-center gap-3">
                <Icon size={18} className={colors.icon} />
                <h2 className="text-base font-bold text-gray-900">{title}</h2>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${colors.badge}`}>{count}</span>
            </div>
            {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
    );
}

// ─── Funded Proposal Card ─────────────────────────────────────────────────────

function FundedCard({ proposal }) {
    const ac         = accent(proposal.category);
    const awarded    = proposal.award?.awarded_amount;
    const grantRef   = proposal.award?.grant_reference;
    const budgetUsed = proposal.budget_total ?? 0;

    return (
        <div className={`bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-emerald-300 transition-all`}>
            <div className="flex items-stretch">
                <div className={`w-1 shrink-0 bg-emerald-500 rounded-tl-2xl`} />
                <div className="flex-1 min-w-0 px-5 py-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                                    {proposal.tracker_number}
                                </span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ac.badge}`}>
                                    {getCategoryLabel(proposal.category)}
                                </span>
                                <StatusBadge status={proposal.status} />
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                    <Trophy size={10} /> Funded Proposal
                                </span>
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{proposal.title}</h3>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {proposal.college?.name && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Building2 size={10} className="text-gray-300" /> {proposal.college.name}
                                    </span>
                                )}
                                {proposal.co_investigators_count > 0 && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Users size={10} className="text-gray-300" /> {proposal.co_investigators_count} co-investigator{proposal.co_investigators_count !== 1 ? 's' : ''}
                                    </span>
                                )}
                                {proposal.proposalCall?.academic_year && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Calendar size={10} className="text-gray-300" /> {proposal.proposalCall.academic_year}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Award info */}
                        {awarded && (
                            <div className="shrink-0 text-right">
                                <p className="text-xs text-gray-400">Awarded</p>
                                <p className="text-base font-bold text-emerald-600">{formatCurrency(awarded)}</p>
                                {grantRef && (
                                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{grantRef}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Budget bar */}
                    {awarded && budgetUsed > 0 && (
                        <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-gray-400">Budget utilisation</span>
                                <span className="text-[11px] font-semibold text-gray-600">
                                    {formatCurrency(budgetUsed)} / {formatCurrency(awarded)}
                                </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${Math.min((budgetUsed / awarded) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-emerald-50/40 flex items-center justify-between">
                <Link href={`/proposals/${proposal.id}`}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors flex items-center gap-1">
                    <FileText size={12} /> View Details
                </Link>

                <Link
                    href={`/budget-requests?proposal_id=${proposal.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-100"
                >
                    <DollarSign size={13} /> Request Budget
                    <ChevronRight size={12} />
                </Link>
            </div>
        </div>
    );
}

// ─── Completed Proposal Card ──────────────────────────────────────────────────

function CompletedCard({ proposal }) {
    const ac      = accent(proposal.category);
    const awarded = proposal.award?.awarded_amount;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm transition-all opacity-90 hover:opacity-100">
            <div className="flex items-stretch">
                <div className="w-1 shrink-0 bg-blue-400 rounded-tl-2xl" />
                <div className="flex-1 min-w-0 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg shrink-0">
                                    {proposal.tracker_number}
                                </span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ac.badge}`}>
                                    {getCategoryLabel(proposal.category)}
                                </span>
                                <StatusBadge status={proposal.status} />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-800 leading-snug">{proposal.title}</h3>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {proposal.college?.name && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Building2 size={10} className="text-gray-300" /> {proposal.college.name}
                                    </span>
                                )}
                                {proposal.proposalCall?.academic_year && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Calendar size={10} className="text-gray-300" /> {proposal.proposalCall.academic_year}
                                    </span>
                                )}
                            </div>
                        </div>
                        {awarded && (
                            <div className="shrink-0 text-right">
                                <p className="text-xs text-gray-400">Total Awarded</p>
                                <p className="text-base font-bold text-blue-600">{formatCurrency(awarded)}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1.5">
                    <BadgeCheck size={13} /> Research completed
                </span>
                <Link href={`/proposals/${proposal.id}`}
                    className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors flex items-center gap-1">
                    View Details <ChevronRight size={12} />
                </Link>
            </div>
        </div>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, sub, color }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl py-12 text-center">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-${color}-50`}>
                <Icon size={24} className={`text-${color}-300`} />
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">{title}</p>
            <p className="text-xs text-gray-400">{sub}</p>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyResearch() {
    const { error } = useToast();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading]     = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/proposals/my');
            setProposals(res.data?.data ?? []);
        } catch { error('Failed to load your proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const funded    = proposals.filter(p => p.status === 'funded');
    const completed = proposals.filter(p => ['completed', 'archived'].includes(p.status));

    const totalAwarded = [...funded, ...completed].reduce((s, p) => s + (p.award?.awarded_amount ?? 0), 0);
    const totalBudget  = funded.reduce((s, p) => s + (p.budget_total ?? 0), 0);

    return (
        <AppLayout breadcrumb="Funded Proposals">
            <div className="max-w-5xl mx-auto">

                {/* ── Page header ── */}
                <div className="flex items-start justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200">
                            <Trophy size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Funded Proposals</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Your funded and completed research proposals</p>
                        </div>
                    </div>
                    <button onClick={load}
                        className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium shrink-0">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {/* ── Stat cards ── */}
                {!loading && (funded.length > 0 || completed.length > 0) && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                        <StatCard icon={Trophy}       label="Funded Proposals"   value={funded.length}    color="emerald" />
                        <StatCard icon={BadgeCheck}   label="Completed Projects" value={completed.length} color="blue"    />
                        <StatCard icon={DollarSign}   label="Total Awarded"      value={formatCurrency(totalAwarded)} sub="across all grants" color="violet" />
                        <StatCard icon={FileText}     label="Budget Allocated"   value={formatCurrency(totalBudget)}  sub="from funded proposals" color="gray" />
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-400">Loading your research…</p>
                    </div>
                ) : funded.length === 0 && completed.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <Beaker size={30} className="text-emerald-300" />
                        </div>
                        <h3 className="text-gray-700 font-semibold text-base mb-1">No funded or completed proposals yet</h3>
                        <p className="text-sm text-gray-400 mb-4">Your funded and completed research projects will appear here.</p>
                        <Link href="/my-proposals"
                            className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 font-semibold transition-colors">
                            View all my proposals <ChevronRight size={14} />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-10">

                        {/* ── Funded proposals ── */}
                        <div>
                            <SectionHeader
                                icon={Trophy}
                                title="Funded Proposals"
                                count={funded.length}
                                description="These proposals have been awarded funding. Use the Request Budget button to submit a budget request."
                                color="emerald"
                            />
                            {funded.length === 0 ? (
                                <EmptyState
                                    icon={Trophy}
                                    title="No funded proposals"
                                    sub="Proposals that receive funding will appear here."
                                    color="emerald"
                                />
                            ) : (
                                <div className="space-y-3">
                                    {funded.map(p => <FundedCard key={p.id} proposal={p} />)}
                                </div>
                            )}
                        </div>

                        {/* ── Completed proposals ── */}
                        {completed.length > 0 && (
                            <div>
                                <SectionHeader
                                    icon={BadgeCheck}
                                    title="Completed Projects"
                                    count={completed.length}
                                    description="Research projects that have been fully completed and archived."
                                    color="blue"
                                />
                                <div className="space-y-3">
                                    {completed.map(p => <CompletedCard key={p.id} proposal={p} />)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
