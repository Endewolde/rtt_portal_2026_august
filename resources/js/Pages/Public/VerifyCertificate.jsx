import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { ShieldCheck, ShieldX, Award, Search, QrCode } from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';

/** "5 (3 blind, 2 open defence)" */
function breakdown(c) {
    const parts = [c.blind_reviews && `${c.blind_reviews} blind`, c.defence_reviews && `${c.defence_reviews} open defence`].filter(Boolean);
    return parts.length ? `${c.total} (${parts.join(', ')})` : String(c.total);
}

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function Details({ rows }) {
    return (
        <dl className="divide-y divide-gray-100 px-6 text-sm">
            {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-right font-medium text-gray-900">{v}</dd>
                </div>
            ))}
        </dl>
    );
}

function LookupForm({ initial = '', compact = false }) {
    const [value, setValue] = useState(initial);
    const code = value.trim().toUpperCase();

    const submit = (e) => {
        e.preventDefault();
        if (code) router.visit(`/certificates/verify/${encodeURIComponent(code)}`);
    };

    return (
        <form onSubmit={submit} className={compact ? 'mt-8' : ''}>
            {compact && <p className="mb-2 text-center text-xs font-medium text-gray-500">Check another certificate</p>}
            <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search size={16} className="shrink-0 text-gray-400" />
                    <input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="e.g. AB12-CD34-EF56"
                        aria-label="Certificate number"
                        autoFocus={!compact}
                        className="w-full py-2.5 font-mono text-sm uppercase tracking-wide placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:outline-none"
                    />
                </div>
                <button type="submit" disabled={!code}
                    className="rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    Verify
                </button>
            </div>
        </form>
    );
}

/** Public page anyone can use to confirm a reviewer certificate is genuine — by link/QR code or by typing its number. */
export default function VerifyCertificate() {
    const { url } = usePage();
    const match = url.split('?')[0].match(/\/certificates\/verify\/([^/]+)/);
    const code = match ? decodeURIComponent(match[1]) : '';
    const [state, setState] = useState({ loading: !!code, data: null });

    useEffect(() => {
        if (!code) return;
        setState({ loading: true, data: null });
        get(`/certificates/verify/${encodeURIComponent(code)}`)
            .then((r) => setState({ loading: false, data: r.data }))
            .catch(() => setState({ loading: false, data: null }));
    }, [code]);

    const c = state.data;

    return (
        <PublicLayout>
            <div className="mx-auto max-w-lg px-4 py-16">
                {!code ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShieldCheck size={24} /></div>
                        <h1 className="text-center text-xl font-bold text-gray-900">Verify a Certificate</h1>
                        <p className="mx-auto mb-6 mt-1.5 max-w-sm text-center text-sm text-gray-500">
                            Confirm that a certificate of review service was genuinely issued. Enter the certificate number printed at the bottom of the certificate.
                        </p>
                        <LookupForm />
                        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                            <QrCode size={13} /> Or scan the QR code on the certificate with your phone camera.
                        </p>
                    </div>
                ) : state.loading ? (
                    <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
                ) : c?.status === 'revoked' ? (
                    <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
                        <div className="flex items-center gap-3 bg-red-50 px-6 py-5">
                            <ShieldX size={28} className="text-red-600" />
                            <div>
                                <p className="text-lg font-bold text-red-900">Certificate revoked</p>
                                <p className="text-sm text-red-700">This certificate was issued but is no longer valid.</p>
                            </div>
                        </div>
                        <Details rows={[
                            ['Issued to', c.reviewer],
                            ['Academic year', c.academic_year],
                            ['Revoked', formatDate(c.revoked_at)],
                            ['Certificate no.', c.code],
                        ]} />
                    </div>
                ) : c ? (
                    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                        <div className="flex items-center gap-3 bg-emerald-50 px-6 py-5">
                            <ShieldCheck size={28} className="text-emerald-600" />
                            <div>
                                <p className="text-lg font-bold text-emerald-900">Certificate verified</p>
                                <p className="text-sm text-emerald-700">This certificate of review service is genuine.</p>
                            </div>
                        </div>
                        <Details rows={[
                            ['Reviewer', c.reviewer],
                            ['Academic year', c.academic_year],
                            ['Reviews completed', breakdown(c)],
                            ['Issued', formatDate(c.issued_at)],
                            ['Certificate no.', c.code],
                        ]} />
                    </div>
                ) : (
                    <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                        <ShieldX size={32} className="mx-auto text-red-500" />
                        <p className="mt-3 text-lg font-bold text-gray-900">Certificate not found</p>
                        <p className="mt-1 text-sm text-gray-500">No certificate with number <span className="font-mono">{code}</span> exists. Check the number and try again.</p>
                    </div>
                )}
                {code && <LookupForm key={code} compact />}
                <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400"><Award size={12} /> Research &amp; Technology Transfer — certificate verification</p>
            </div>
        </PublicLayout>
    );
}
