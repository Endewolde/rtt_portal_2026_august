import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import { Award, RefreshCw, Users, BadgeCheck, ShieldX, Send, X, Info, Clock, RotateCcw, Search, Settings2, Lock, LockOpen } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { useToast } from '../../Components/Toast';

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Kpi({ icon: Icon, label, value, hint }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500"><Icon size={14} /> {label}</div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
        </div>
    );
}

function Modal({ accent, icon: Icon, title, subtitle, onClose, children, footer }) {
    const tones = {
        amber: ['from-amber-400 via-amber-500 to-orange-500', 'bg-amber-100 text-amber-700 ring-amber-50'],
        red: ['from-red-500 via-rose-500 to-red-600', 'bg-red-100 text-red-600 ring-red-50'],
    }[accent];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                <div className={`h-1.5 rounded-t-2xl bg-gradient-to-r ${tones[0]}`} />
                <div className="flex items-start justify-between gap-3 px-6 pt-5">
                    <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-4 ${tones[1]}`}><Icon size={20} /></div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={16} /></button>
                </div>
                <div className="space-y-4 px-6 py-5">{children}</div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>
            </div>
        </div>
    );
}

function StatusPill({ row, released, closed }) {
    if (row.certificate?.revoked_at) {
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"><ShieldX size={11} /> Revoked</span>;
    }
    if (row.certificate && closed) {
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Lock size={11} /> Withdrawn</span>;
    }
    if (row.certificate) {
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><BadgeCheck size={11} /> Issued</span>;
    }
    if (released) {
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">Not eligible</span>;
    }
    return row.eligible
        ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><BadgeCheck size={11} /> Eligible</span>
        : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">Below minimum</span>;
}

/** Central office: release each academic year's reviewer certificates, close or reopen a release, and revoke or reinstate them. */
export default function ReviewCertificates() {
    const { success, error } = useToast();
    const [year, setYear] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [releasing, setReleasing] = useState(false);
    const [revoking, setRevoking] = useState(null);
    const [closing, setClosing] = useState(false);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async (academicYear = year) => {
        setLoading(true);
        try {
            const res = await get('/review-certificates/admin', academicYear ? { academic_year: academicYear } : {});
            setData(res.data);
            if (!academicYear && res.data?.academic_year) setYear(res.data.academic_year);
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not load certificates.');
        }
        setLoading(false);
    }, [year]);

    useEffect(() => { load(year); }, [year]);

    const act = async (request) => {
        setSaving(true);
        try {
            const res = await request();
            setData(res.data);
            success(res.message);
            setReleasing(false);
            setRevoking(null);
            setClosing(false);
            setReason('');
        } catch (e) {
            const errors = e.response?.data?.errors;
            error(errors && Object.keys(errors).length ? Object.values(errors).flat()[0] : (e.response?.data?.message ?? 'The action failed.'));
        }
        setSaving(false);
    };

    const released = !!data?.release;
    const closed = !!data?.release?.closed_at;
    const rules = data?.rules;
    const term = search.trim().toLowerCase();
    const rows = (data?.reviewers ?? []).filter((r) => !term || r.name.toLowerCase().includes(term) || (r.email ?? '').toLowerCase().includes(term) || (r.certificate?.code ?? '').toLowerCase().includes(term));
    const reasonValid = reason.trim().length >= 10;

    return (
        <AppLayout breadcrumb="Reviewer Certificates">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100"><Award size={20} className="text-amber-600" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Reviewer Certificates</h1>
                            <p className="mt-0.5 text-sm text-gray-500">Release each academic year's certificates of review service once its reviews are finished.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {data?.years?.length > 0 && (
                            <select value={year} onChange={(e) => setYear(e.target.value)}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300">
                                {data.years.map((y) => <option key={y} value={y}>{y}</option>)}
                            </select>
                        )}
                        <button onClick={() => load(year)} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={14} /> <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                {loading && !data ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />)}</div>
                ) : !data?.academic_year ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center">
                        <Award size={28} className="mx-auto text-amber-300" />
                        <h3 className="mt-3 font-semibold text-gray-700">No completed reviews yet</h3>
                        <p className="mt-1 text-sm text-gray-400">Certificates become available once reviewers submit blind reviews or open defence evaluations.</p>
                    </div>
                ) : (
                    <>
                        {/* Release banner */}
                        {closed ? (
                            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center">
                                <Lock size={20} className="hidden shrink-0 text-amber-600 sm:block" />
                                <div className="min-w-0 flex-1 text-sm">
                                    <p className="font-semibold text-amber-900">Certificates for {data.academic_year} are closed since {formatDate(data.release.closed_at)}{data.release.closed_by ? ` (closed by ${data.release.closed_by})` : ''}.</p>
                                    <p className="text-xs text-amber-800">Reason: {data.release.close_reason}</p>
                                    <p className="mt-0.5 text-xs text-amber-700">Reviewers cannot download them, and verifying a certificate shows it as withdrawn.</p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button onClick={() => act(() => post('/review-certificates/admin/reopen', { academic_year: data.academic_year }))} disabled={saving}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                                        <LockOpen size={14} /> Reopen
                                    </button>
                                    <button onClick={() => setReleasing(true)} disabled={data.stats.eligible === 0}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                                        <Send size={14} /> Release Again
                                    </button>
                                </div>
                            </div>
                        ) : released ? (
                            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center">
                                <BadgeCheck size={20} className="hidden shrink-0 text-emerald-600 sm:block" />
                                <div className="min-w-0 flex-1 text-sm">
                                    <p className="font-semibold text-emerald-900">Certificates for {data.academic_year} were released on {formatDate(data.release.released_at)}{data.release.released_by ? ` by ${data.release.released_by}` : ''}.</p>
                                    <p className="text-xs text-emerald-700">
                                        Rules applied: at least {rules.min_reviews} completed review{rules.min_reviews === 1 ? '' : 's'}{rules.on_time_only ? ', submitted on time' : ''}. Counts are frozen as of the release.
                                    </p>
                                </div>
                                <button onClick={() => { setClosing(true); setReason(''); }}
                                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                                    <Lock size={14} /> Close Release
                                </button>
                            </div>
                        ) : (
                            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-5 py-4 sm:flex-row sm:items-center">
                                <Clock size={20} className="hidden shrink-0 text-amber-600 sm:block" />
                                <div className="min-w-0 flex-1 text-sm">
                                    <p className="font-semibold text-gray-900">{data.academic_year} certificates are not released yet</p>
                                    <p className="text-xs text-gray-600">
                                        {data.stats.eligible} of {data.stats.reviewers} reviewers currently qualify (at least {rules.min_reviews} review{rules.min_reviews === 1 ? '' : 's'}{rules.on_time_only ? ' submitted on time' : ''}).
                                        {' '}<Link href="/admin/settings" className="inline-flex items-center gap-0.5 font-medium text-amber-700 hover:underline"><Settings2 size={11} /> Change the rules</Link>
                                    </p>
                                </div>
                                <button onClick={() => setReleasing(true)} disabled={data.stats.eligible === 0}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                                    <Send size={14} /> Release Certificates
                                </button>
                            </div>
                        )}

                        {/* KPIs */}
                        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <Kpi icon={Users} label="Reviewers" value={data.stats.reviewers} hint="With completed reviews" />
                            <Kpi icon={BadgeCheck} label="Eligible" value={data.stats.eligible} hint={`${rules.min_reviews}+ qualifying reviews`} />
                            <Kpi icon={Award} label="Issued" value={released ? data.stats.issued : '—'} hint={closed ? 'Withdrawn while closed' : released ? 'Valid certificates' : 'After release'} />
                            <Kpi icon={ShieldX} label="Revoked" value={released ? data.stats.revoked : '—'} />
                        </div>

                        {/* Reviewer table */}
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                                <Search size={14} className="text-gray-400" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or certificate number…"
                                    className="w-full text-sm focus:outline-none" />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-sm">
                                    <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                        <tr>
                                            <th className="px-4 py-2.5">Reviewer</th>
                                            <th className="px-3 py-2.5 text-right">Blind</th>
                                            <th className="px-3 py-2.5 text-right">Defence</th>
                                            <th className="px-3 py-2.5 text-right">Late</th>
                                            <th className="px-3 py-2.5 text-right">Counted</th>
                                            <th className="px-3 py-2.5">Status</th>
                                            <th className="px-3 py-2.5">Certificate</th>
                                            <th className="px-4 py-2.5 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {rows.map((r) => (
                                            <tr key={r.user_id} className="hover:bg-gray-50/60">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900">{r.name}</p>
                                                    {r.email && <p className="text-xs text-gray-400">{r.email}</p>}
                                                </td>
                                                <td className="px-3 py-3 text-right tabular-nums text-gray-700">{r.blind_reviews}</td>
                                                <td className="px-3 py-3 text-right tabular-nums text-gray-700">{r.defence_reviews}</td>
                                                <td className={`px-3 py-3 text-right tabular-nums ${r.late ? 'text-amber-600' : 'text-gray-300'}`}>{r.late}</td>
                                                <td className="px-3 py-3 text-right font-semibold tabular-nums text-gray-900">{r.counted}</td>
                                                <td className="px-3 py-3"><StatusPill row={r} released={released} closed={closed} /></td>
                                                <td className="px-3 py-3">
                                                    {r.certificate ? (
                                                        <div>
                                                            <a href={`/certificates/verify/${r.certificate.code}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-gray-600 hover:text-amber-700 hover:underline">{r.certificate.code}</a>
                                                            {r.certificate.revoked_at && <p className="max-w-56 truncate text-[11px] text-red-600" title={r.certificate.revocation_reason}>{r.certificate.revocation_reason}</p>}
                                                        </div>
                                                    ) : <span className="text-xs text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {r.certificate && !r.certificate.revoked_at && (
                                                        <button onClick={() => { setRevoking(r); setReason(''); }}
                                                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Revoke</button>
                                                    )}
                                                    {r.certificate?.revoked_at && (
                                                        <button onClick={() => act(() => post(`/review-certificates/${r.certificate.id}/reinstate`))} disabled={saving}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                                                            <RotateCcw size={11} /> Reinstate
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {rows.length === 0 && (
                                            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No reviewers match your search.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {releasing && data && (
                <Modal accent="amber" icon={Send} title={closed ? 'Release Certificates Again' : 'Release Certificates'} subtitle={`${data.academic_year} academic year`} onClose={() => setReleasing(false)}
                    footer={<>
                        <button onClick={() => setReleasing(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button onClick={() => act(() => post('/review-certificates/admin/release', { academic_year: data.academic_year }))} disabled={saving}
                            className="flex-[1.6] rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                            {saving ? 'Releasing…' : `Release ${data.stats.eligible} Certificate${data.stats.eligible === 1 ? '' : 's'}`}
                        </button>
                    </>}>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Will receive a certificate</p>
                            <p className="mt-0.5 text-xl font-bold text-gray-900">{data.stats.eligible}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Below the minimum</p>
                            <p className="mt-0.5 text-xl font-bold text-gray-900">{data.stats.reviewers - data.stats.eligible}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        {closed ? (
                            <span>
                                Counts are recalculated with the current rules and frozen as of now. Reviewers who already had a certificate keep its number;
                                anyone who no longer qualifies has their certificate revoked. Certificates you revoked individually stay revoked.
                            </span>
                        ) : (
                            <span>
                                Each qualifying reviewer gets a certificate with their review counts frozen as of now, and is notified by email and in the app.
                                Release it after the year's reviews are finished. If needed, you can close the release later and reopen or release it again.
                            </span>
                        )}
                    </div>
                </Modal>
            )}

            {closing && data && (
                <Modal accent="red" icon={Lock} title="Close Release" subtitle={`${data.academic_year} · ${data.stats.issued} valid certificate${data.stats.issued === 1 ? '' : 's'}`} onClose={() => setClosing(false)}
                    footer={<>
                        <button onClick={() => setClosing(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button onClick={() => act(() => post('/review-certificates/admin/close', { academic_year: data.academic_year, reason: reason.trim() }))} disabled={!reasonValid || saving}
                            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                            {saving ? 'Closing…' : 'Close Release'}
                        </button>
                    </>}>
                    <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-700">
                            <span>Reason for closing <span className="text-red-500">*</span></span>
                            <span className="font-normal tabular-nums text-gray-400">{reason.length}/500</span>
                        </label>
                        <textarea rows={4} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} autoFocus
                            placeholder="e.g. Released before all open defence evaluations were submitted…"
                            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                        {reason.length > 0 && !reasonValid && <p className="mt-1 text-xs text-gray-400">Please write at least 10 characters.</p>}
                    </div>
                    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>
                            Every {data.academic_year} certificate is withdrawn at once: reviewers are notified with this reason and can no longer download them,
                            and verifying any of them shows it as withdrawn. Nothing is deleted — you can reopen the release as it was, or release it again with the current rules.
                        </span>
                    </div>
                </Modal>
            )}

            {revoking && (
                <Modal accent="red" icon={ShieldX} title="Revoke Certificate" subtitle={`${revoking.name} · ${revoking.certificate.code}`} onClose={() => setRevoking(null)}
                    footer={<>
                        <button onClick={() => setRevoking(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button onClick={() => act(() => post(`/review-certificates/${revoking.certificate.id}/revoke`, { reason: reason.trim() }))} disabled={!reasonValid || saving}
                            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                            {saving ? 'Revoking…' : 'Revoke Certificate'}
                        </button>
                    </>}>
                    <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-700">
                            <span>Reason for revoking <span className="text-red-500">*</span></span>
                            <span className="font-normal tabular-nums text-gray-400">{reason.length}/500</span>
                        </label>
                        <textarea rows={4} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} autoFocus
                            placeholder="e.g. Issued in error, or a breach of review confidentiality…"
                            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                        {reason.length > 0 && !reasonValid && <p className="mt-1 text-xs text-gray-400">Please write at least 10 characters.</p>}
                    </div>
                    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>The reviewer is notified with this reason and can no longer download the certificate. Anyone verifying its number or QR code will see that it was revoked. You can reinstate it later.</span>
                    </div>
                </Modal>
            )}
        </AppLayout>
    );
}
