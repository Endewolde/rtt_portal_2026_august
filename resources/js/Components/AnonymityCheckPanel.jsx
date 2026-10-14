import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw, ChevronDown, ChevronUp, XCircle, User, Mail, Phone } from 'lucide-react';
import { post } from '../lib/api';
import { useToast } from './Toast';

const STATES = {
    clean: {
        icon: ShieldCheck, title: 'No identifying details found', tone: 'border-emerald-200 bg-emerald-50/60', iconCls: 'bg-emerald-100 text-emerald-700',
        text: 'The documents reviewers will see do not mention the PI or team members by name, email or phone.',
    },
    issues: {
        icon: ShieldAlert, title: 'Possible identity reveal', tone: 'border-red-200 bg-red-50/60', iconCls: 'bg-red-100 text-red-700',
        text: 'Reviewers could identify the research team from what was found below. Check it before approving for blind review.',
    },
    not_checked: {
        icon: ShieldQuestion, title: 'Check by hand', tone: 'border-amber-200 bg-amber-50/60', iconCls: 'bg-amber-100 text-amber-700',
        text: 'No reviewer document could be read automatically (for example a scanned PDF). Please open it and check for names before approving.',
    },
};

const TYPE_ICON = { name: User, email: Mail, phone: Phone };

function highlight(snippet, value) {
    const index = snippet.toLowerCase().indexOf(value.toLowerCase());
    if (index < 0) return snippet;
    return (
        <>
            {snippet.slice(0, index)}
            <mark className="rounded bg-red-200 px-0.5 text-red-900">{snippet.slice(index, index + value.length)}</mark>
            {snippet.slice(index + value.length)}
        </>
    );
}

/** Result of the automatic blind-review anonymity check, with re-check and reject actions. */
export default function AnonymityCheckPanel({ proposal, canRecheck, canReject, onRejectAsNotAnonymous, onChecked }) {
    const { success, error } = useToast();
    const [checking, setChecking] = useState(false);
    const [open, setOpen] = useState(proposal.anonymity_status === 'issues');

    const status = proposal.anonymity_status;
    const findings = proposal.anonymity_findings?.findings ?? [];
    const unreadable = proposal.anonymity_findings?.unreadable_documents ?? [];
    const state = STATES[status];

    const recheck = async () => {
        setChecking(true);
        try {
            const res = await post(`/proposals/${proposal.id}/anonymity-check`, {});
            success(res.message ?? 'Check complete.');
            onChecked?.();
        } catch (e) {
            error(e.response?.data?.message ?? 'The check could not be run.');
        }
        setChecking(false);
    };

    const rejectDetails = () => findings
        .slice(0, 5)
        .map((f) => `${f.source}: "${f.value}" (${f.person})`)
        .join('; ');

    if (!state) {
        return (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <span className="inline-flex items-center gap-2"><ShieldQuestion size={16} className="text-gray-400" /> This proposal has not been checked for identifying details yet.</span>
                {canRecheck && (
                    <button onClick={recheck} disabled={checking} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                        <RefreshCw size={12} className={checking ? 'animate-spin' : ''} /> Run check
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`mt-4 overflow-hidden rounded-xl border ${state.tone}`}>
            <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${state.iconCls}`}><state.icon size={18} /></span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                        Anonymity check · {state.title}
                        {status === 'issues' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{findings.length}</span>}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{state.text}</p>
                    {proposal.anonymity_checked_at && (
                        <p className="mt-1 text-[11px] text-gray-400">Checked {new Date(proposal.anonymity_checked_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    {status === 'issues' && canReject && (
                        <button
                            onClick={() => onRejectAsNotAnonymous(rejectDetails())}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                            <XCircle size={13} /> Reject as not anonymous
                        </button>
                    )}
                    {canRecheck && (
                        <button onClick={recheck} disabled={checking} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking…' : 'Re-check'}
                        </button>
                    )}
                    {findings.length > 0 && (
                        <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Hide findings' : 'Show findings'} className="rounded-lg p-1.5 text-gray-500 hover:bg-white">
                            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    )}
                </div>
            </div>

            {open && findings.length > 0 && (
                <ul className="divide-y divide-red-100 border-t border-red-100 bg-white/70">
                    {findings.map((f, i) => {
                        const Icon = TYPE_ICON[f.type] ?? User;
                        return (
                            <li key={i} className="px-4 py-2.5">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700"><Icon size={11} /> {f.type}</span>
                                    <span className="font-medium text-gray-800">{f.person}</span>
                                    <span className="text-gray-400">in {f.source}</span>
                                </div>
                                <p className="mt-1 font-mono text-xs leading-relaxed text-gray-600">{highlight(f.snippet, f.value)}</p>
                            </li>
                        );
                    })}
                </ul>
            )}

            {unreadable.length > 0 && status !== 'not_checked' && (
                <p className="border-t border-gray-200/70 px-4 py-2 text-[11px] text-gray-500">
                    Not read automatically: {unreadable.join(', ')} — check by hand.
                </p>
            )}
        </div>
    );
}
