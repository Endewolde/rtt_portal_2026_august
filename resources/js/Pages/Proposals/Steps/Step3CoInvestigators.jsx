import { useState, useEffect } from 'react';
import { translate as tr, Trans } from '../../../lib/i18n'
import { Search, X, UserPlus, Users, Info, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../Components/Toast';
import { useFeature } from '../../../hooks/useFeature';

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
const getInitials = (name) => name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '??';
const getColor   = (name) => COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length];

function InvitationBadge({ status }) {
    if (status === 'accepted') return <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700"><CheckCircle2 size={10} /> {tr("Accepted")}</span>;
    if (status === 'declined') return <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700"><XCircle size={10} /> {tr("Declined")}</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"><Clock size={10} /> {tr("Pending")}</span>;
}

export default function Step3CoInvestigators({ proposalId, piUser, onComplete, initialData }) {
    const toast = useToast();
    const { hasSubFeature } = useFeature();
    const showInvitationStatus = hasSubFeature('workflow.co_pi_acceptance');
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [coIs, setCoIs] = useState(initialData ?? []);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Debounced user search (400 ms)
    useEffect(() => {
        if (!search || search.length < 2) { setResults([]); return; }

        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await api.get('/users', { params: { search, per_page: 10, role: 'staff' } });
                const users = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
                const taken = new Set([piUser?.id, ...coIs.map((c) => c.user_id)]);
                setResults(Array.isArray(users) ? users.filter((u) => !taken.has(u.id)) : []);
            } catch { setResults([]); }
            setSearching(false);
        }, 400);

        return () => clearTimeout(timer);
    }, [search, coIs, piUser?.id]);

    // Equal-effort split: PI + all co-investigators share contribution evenly.
    // PI's share is implicit (100 - sum of co-investigator shares), so only the
    // co-investigator rows need an explicit equal percentage here.
    const equalSplit = (list) => {
        const totalMembers = list.length + 1; // +1 for the PI
        const share = Math.round((100 / totalMembers) * 100) / 100;
        return list.map((c) => ({ ...c, contribution_percentage: share }));
    };

    const add = (u) => {
        setCoIs((prev) => equalSplit([...prev, {
            user_id:                u.id,
            name:                   u.name,
            email:                  u.email,
            college_name:           u.college?.name ?? u.college_name ?? '',
            department_name:        u.department?.name ?? u.department_name ?? '',
            contribution_percentage: 0,
        }]));
        setSearch('');
        setResults([]);
    };

    const remove = (id) => setCoIs((prev) => equalSplit(prev.filter((c) => c.user_id !== id)));

    const [resendingId, setResendingId] = useState(null);
    const resend = async (c) => {
        if (!c.id) return;
        setResendingId(c.user_id);
        try {
            await api.post(`/proposal-members/${c.id}/resend-invitation`);
            setCoIs((prev) => prev.map((x) => x.user_id === c.user_id ? { ...x, invitation_status: 'pending' } : x));
            toast.success(`Invitation resent to ${c.name}.`);
        } catch (e) {
            toast.error(e.response?.data?.message ?? 'Failed to resend invitation.');
        }
        setResendingId(null);
    };

    const setContrib = (id, val) =>
        setCoIs((prev) => prev.map((c) => c.user_id === id ? { ...c, contribution_percentage: parseFloat(val) || 0 } : c));

    const totalCo          = coIs.reduce((s, c) => s + (parseFloat(c.contribution_percentage) || 0), 0);
    const piContrib        = Math.max(0, 100 - totalCo);
    const valid            = totalCo <= 100;
    const hasCoInvestigator = coIs.length >= 1;

    const handleSave = async () => {
        if (!valid) return;
        setSaving(true);
        setError(null);
        try {
            await api.post(`/proposals/${proposalId}/steps/3`, {
                co_investigators: coIs.map((c) => ({
                    user_id:                c.user_id,
                    contribution_percentage: c.contribution_percentage,
                })),
            });
            onComplete({ co_investigators: coIs });
        } catch (e) {
            const msg = e.response?.data?.message ?? 'Failed to save. Please try again.';
            setError(msg);
            toast.error(msg, { title: 'Save Failed' });
        }
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">{tr("Co-Investigators")}</h2>
                <p className="text-sm text-gray-500 mt-1">{tr("Add team members to your proposal.")}</p>
            </div>

            {/* Required co-PI banner */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-blue-800">{tr("Team Requirement")}</p>
                    <p className="text-sm text-blue-700 mt-0.5">
                        <Trans text="Your proposal must have <b>at least one Co-Investigator</b>. The PI cannot submit alone. Search and add your team members below." />
                    </p>
                    <p className="text-sm text-blue-700 mt-1.5">
                        <Trans text="Only individuals with the <b>Staff</b> role can be added as Co-Investigators — search results are limited to eligible staff accounts." />
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                    <Search size={16} className="text-gray-400 mr-2 shrink-0" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={tr("Search by name or email…")}
                        className="flex-1 outline-none text-sm text-gray-900 placeholder-gray-400"
                    />
                    {searching && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2" />}
                </div>

                {results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {results.map((u) => (
                            <button key={u.id} onClick={() => add(u)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-100 last:border-0">
                                <div className={`w-8 h-8 rounded-full ${getColor(u.name)} flex items-center justify-center text-white text-xs font-medium shrink-0`}>
                                    {getInitials(u.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                    {(u.college?.name ?? u.college_name) && (
                                        <p className="text-xs text-blue-600 truncate">
                                            {u.college?.name ?? u.college_name}
                                            {(u.department?.name ?? u.department_name) && ` · ${u.department?.name ?? u.department_name}`}
                                        </p>
                                    )}
                                </div>
                                <UserPlus size={16} className="text-blue-500 shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {search.length >= 2 && !searching && results.length === 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow px-4 py-3">
                        <p className="text-sm text-gray-500">No users found for &ldquo;{search}&rdquo;</p>
                    </div>
                )}
            </div>

            {/* Team table */}
            {coIs.length > 0 || piUser ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr><th className="px-4 py-3 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                {['Member', 'College / Dept', 'Role', ...(showInvitationStatus ? ['Invite'] : []), 'Contribution %', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {/* PI row — read-only */}
                            {piUser && (
                                <tr className="bg-blue-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
                                                {getInitials(piUser.name)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{piUser.name}</p>
                                                <p className="text-xs text-gray-500">{piUser.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">{piUser.college_name ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{tr("PI")}</span>
                                    </td>
                                    {showInvitationStatus && <td className="px-4 py-3"><span className="text-xs text-gray-400">—</span></td>}
                                    <td className="px-4 py-3 text-center">
                                        <span className={`font-semibold ${piContrib < 20 ? 'text-orange-600' : 'text-blue-700'}`}>
                                            {piContrib.toFixed(1)}%
                                        </span>
                                        <p className="text-xs text-gray-400">{tr("auto")}</p>
                                    </td>
                                    <td />
                                </tr>
                            )}

                            {/* Co-PI rows */}
                            {coIs.map((c, i) => (
                                <tr key={c.user_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}><td className="px-4 py-3 w-10 text-xs font-medium tabular-nums text-gray-400">{i + 1}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full ${getColor(c.name)} flex items-center justify-center text-white text-xs font-medium shrink-0`}>
                                                {getInitials(c.name)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{c.name}</p>
                                                <p className="text-xs text-gray-500">{c.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">
                                        {c.college_name || '—'}
                                        {c.department_name && <span className="block text-gray-400">{c.department_name}</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">{tr("Co-PI")}</span>
                                    </td>
                                    {showInvitationStatus && (
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <InvitationBadge status={c.invitation_status ?? 'pending'} />
                                                {c.invitation_status === 'declined' && c.id && (
                                                    <button
                                                        onClick={() => resend(c)}
                                                        disabled={resendingId === c.user_id}
                                                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 underline disabled:opacity-50 whitespace-nowrap"
                                                    >
                                                        {resendingId === c.user_id ? 'Resending…' : 'Resend'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-4 py-3 text-center">
                                        <input type="number" min="0" max="100" step="0.5"
                                            value={c.contribution_percentage}
                                            onChange={(e) => setContrib(c.user_id, e.target.value)}
                                            className="w-20 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => remove(c.user_id)} className="text-red-400 hover:text-red-600 transition-colors">
                                            <X size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                            <tr>
                                <td colSpan={4} className="px-4 py-2 text-sm text-gray-600">
                                    Total team: {coIs.length + 1} member{coIs.length !== 0 ? 's' : ''}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`font-semibold text-sm ${!valid ? 'text-red-600' : 'text-green-600'}`}>
                                        {(totalCo + piContrib).toFixed(1)}%
                                    </span>
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                    <Users size={32} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">{tr("No co-investigators added yet.")}</p>
                    <p className="text-xs text-gray-400 mt-1">{tr("Search above to add team members.")}</p>
                </div>
            )}

            {!valid && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-red-700">{tr("Total contribution exceeds 100%. Please adjust the percentages.")}</p>
                </div>
            )}

            {!hasCoInvestigator && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <AlertCircle size={16} className="text-amber-500" />
                    <p className="text-sm text-amber-700 font-medium">
                        {tr("Add at least one Co-Investigator to continue.")}
                    </p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div className="flex justify-between pt-2">
                <button onClick={() => onComplete(null, 'back')}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                    {tr("Back")}
                </button>
                <button onClick={handleSave} disabled={!hasCoInvestigator || !valid || saving}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                        hasCoInvestigator && valid
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}>
                    {saving ? 'Saving…' : coIs.length === 0 ? 'Add Co-Investigator First' : 'Save & Continue'}
                </button>
            </div>
        </div>
    );
}
