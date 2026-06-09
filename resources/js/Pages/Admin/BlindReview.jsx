import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { EyeOff, UserCheck, Calendar, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import StatusBadge from '../../Components/StatusBadge';
import WorkflowBreadcrumb from '../../Components/WorkflowBreadcrumb';
import ViewToggle from '../../Components/ViewToggle';
import ProposalTable from '../../Components/ProposalTable';
import { useViewPreference } from '../../hooks/useViewPreference';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../Components/Toast';
import { getCategoryLabel } from '../../lib/utils';

const SUBMISSION_COLORS = {
    pending:     'bg-yellow-100 text-yellow-700',
    accepted:    'bg-blue-100 text-blue-700',
    in_progress: 'bg-purple-100 text-purple-700',
    submitted:   'bg-green-100 text-green-700',
    declined:    'bg-red-100 text-red-700',
};

function DaysLeft({ dueDate }) {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
    if (diff < 0)  return <span className="text-xs font-medium text-red-600 flex items-center gap-1"><AlertCircle size={11} />Overdue {Math.abs(diff)}d</span>;
    if (diff === 0) return <span className="text-xs font-medium text-orange-600 flex items-center gap-1"><Clock size={11} />Due today</span>;
    if (diff <= 3)  return <span className="text-xs font-medium text-orange-600 flex items-center gap-1"><Clock size={11} />{diff}d left</span>;
    return <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} />{diff}d left</span>;
}

function ReassignModal({ assignment, availableReviewers, onSave, onClose }) {
    const [selectedId, setSelectedId] = useState('');
    const [dueDate, setDueDate] = useState(assignment.due_date?.slice(0, 10) ?? '');
    const [saving, setSaving] = useState(false);
    const { error } = useToast();

    const save = async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            await api.put(`/review-assignments/${assignment.id}/reassign`, { new_reviewer_id: selectedId, due_date: dueDate || null });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to reassign.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Reassign Reviewer</h3>
                <p className="text-xs text-gray-500 mb-4">Replacing: <strong>{assignment.reviewer?.name}</strong></p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Reviewer <span className="text-red-500">*</span></label>
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— Select reviewer —</option>
                            {availableReviewers.map(r => (
                                <option key={r.id} value={r.id}>{r.name} ({r.email})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Due Date</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={!selectedId || saving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Reassign'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ExtendModal({ assignment, onSave, onClose }) {
    const [dueDate, setDueDate] = useState('');
    const [saving, setSaving] = useState(false);
    const { error } = useToast();

    const save = async () => {
        if (!dueDate) return;
        setSaving(true);
        try {
            await api.put(`/review-assignments/${assignment.id}/extend`, { due_date: dueDate });
            onSave();
        } catch (e) { error(e.response?.data?.message || 'Failed to extend due date.'); }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Extend Due Date</h3>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={!dueDate || saving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Extend'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ReviewCard({ proposal, onReassign, onExtend }) {
    const assignments = proposal.review_assignments ?? [];
    const submitted   = assignments.filter(a => a.status === 'submitted').length;
    const allDone     = assignments.length > 0 && submitted === assignments.length;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {proposal.tracker_number}
                        </span>
                        <span className="text-xs text-gray-400">{getCategoryLabel(proposal.category)}</span>
                        <StatusBadge status={proposal.status} />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{proposal.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{proposal.pi?.name} · {proposal.college?.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${allDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {submitted}/{assignments.length} submitted
                    </span>
                    <Link href={`/proposals/${proposal.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                </div>
            </div>

            {assignments.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No reviewers assigned.</p>
            ) : (
                <div className="space-y-2">
                    {assignments.map(a => (
                        <div key={a.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <UserCheck size={14} className="text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{a.reviewer?.name ?? '—'}</p>
                                    <p className="text-xs text-gray-400 truncate">{a.reviewer?.email}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${SUBMISSION_COLORS[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {a.status?.replace('_', ' ')}
                                </span>
                                <DaysLeft dueDate={a.due_date} />
                            </div>
                            {a.status !== 'submitted' && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => onReassign(a, proposal.id)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg">
                                        <RefreshCw size={11} /> Replace
                                    </button>
                                    <button onClick={() => onExtend(a)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">
                                        <Calendar size={11} /> Extend
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function BlindReview() {
    const { success, error } = useToast();
    const { user, hasRole } = useAuth();
    const isCollegeAdmin = hasRole('college_admin');
    const [proposals, setProposals] = useState([]);
    const [view, setView] = useViewPreference('blind_review', 'card');
    const [loading, setLoading] = useState(true);
    const [availableReviewersMap, setAvailableReviewersMap] = useState({});
    const [reassignModal, setReassignModal] = useState(null);
    const [extendModal, setExtendModal]     = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/review-management', {
                params: { status: 'validated,under_blind_review' },
            });
            setProposals(res.data?.data ?? []);
        } catch { error('Failed to load blind review proposals.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openReassign = async (assignment, proposalId) => {
        if (!availableReviewersMap[proposalId]) {
            try {
                const res = await api.get(`/proposals/${proposalId}/available-reviewers`);
                setAvailableReviewersMap(m => ({ ...m, [proposalId]: res.data?.data ?? [] }));
            } catch { error('Failed to load available reviewers.'); return; }
        }
        setReassignModal({ assignment, proposalId });
    };

    const afterSave = () => {
        success('Saved successfully.');
        setReassignModal(null);
        setExtendModal(null);
        load();
    };

    const validated   = proposals.filter(p => p.status === 'validated');
    const underReview = proposals.filter(p => p.status === 'under_blind_review');

    return (
        <AppLayout breadcrumb="Blind Review">
            <div className="max-w-6xl mx-auto">
                <WorkflowBreadcrumb current="under_blind_review" />
                {isCollegeAdmin && user?.college_name && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-sm text-blue-700">
                        Showing proposals from your college: <strong>{user.college_name}</strong>
                    </div>
                )}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <EyeOff size={22} className="text-blue-600" /> Blind Review Management
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Validated proposals awaiting assignment and proposals under review</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ViewToggle view={view} onChange={setView} />
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : validated.length === 0 && underReview.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <EyeOff size={40} className="mx-auto text-gray-300 mb-3" />
                        <h3 className="text-gray-600 font-medium mb-1">No proposals in blind review</h3>
                        <p className="text-sm text-gray-400">Approved proposals will appear here once validated.</p>
                        <Link href="/admin/validation-queue" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                            Go to Validation Queue →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">

                        {/* Section 1 — Awaiting reviewer assignment */}
                        {validated.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                        Awaiting Reviewer Assignment ({validated.length})
                                    </h2>
                                </div>
                                {view === 'table' ? (
                                    <ProposalTable
                                        proposals={validated}
                                        showColumns={['tracker','title','category','college','deadline']}
                                        actions={(p) => (
                                            <a href={`/proposals/${p.id}/assign-reviewers`}
                                                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                                                Assign Reviewers
                                            </a>
                                        )}
                                        emptyMessage="No proposals awaiting assignment."
                                    />
                                ) : (
                                <div className="space-y-3">
                                    {validated.map(proposal => (
                                        <div key={proposal.id}
                                            className="bg-white border border-indigo-200 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-all">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                        {proposal.tracker_number}
                                                    </span>
                                                    <span className="text-xs text-gray-400 capitalize">
                                                        {getCategoryLabel(proposal.category)}
                                                    </span>
                                                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                                        Validated ✓
                                                    </span>
                                                </div>
                                                <h3 className="text-sm font-semibold text-gray-900 truncate">{proposal.title}</h3>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {proposal.pi?.name} · {proposal.college?.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4 shrink-0">
                                                <Link href={`/proposals/${proposal.id}`}
                                                    className="text-xs text-gray-500 hover:underline">View</Link>
                                                <Link href={`/proposals/${proposal.id}/assign-reviewers`}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                                                    <UserCheck size={14} /> Assign Reviewers
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                )}
                            </div>
                        )}

                        {/* Section 2 — Under blind review */}
                        {underReview.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                        Under Blind Review ({underReview.length})
                                    </h2>
                                </div>
                                {view === 'table' ? (
                                    <ProposalTable
                                        proposals={underReview}
                                        showColumns={['tracker','title','category','college','reviewers','status']}
                                        actions={(p) => (
                                            <a href={`/proposals/${p.id}`}
                                                className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                                                View Progress
                                            </a>
                                        )}
                                        emptyMessage="No proposals under review."
                                    />
                                ) : (
                                <div className="space-y-4">
                                    {underReview.map(proposal => (
                                        <ReviewCard
                                            key={proposal.id}
                                            proposal={proposal}
                                            onReassign={openReassign}
                                            onExtend={setExtendModal}
                                        />
                                    ))}
                                </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {reassignModal && (
                <ReassignModal
                    assignment={reassignModal.assignment}
                    availableReviewers={availableReviewersMap[reassignModal.proposalId] ?? []}
                    onSave={afterSave}
                    onClose={() => setReassignModal(null)}
                />
            )}

            {extendModal && (
                <ExtendModal
                    assignment={extendModal}
                    onSave={afterSave}
                    onClose={() => setExtendModal(null)}
                />
            )}
        </AppLayout>
    );
}
