import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { ShieldCheck, ShieldX, Award } from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';

/** "5 (3 blind, 2 open defence)" */
function breakdown(c) {
    const parts = [c.blind_reviews && `${c.blind_reviews} blind`, c.defence_reviews && `${c.defence_reviews} open defence`].filter(Boolean);
    return parts.length ? `${c.total} (${parts.join(', ')})` : String(c.total);
}

/** Public page anyone can use to confirm a reviewer certificate is genuine. */
export default function VerifyCertificate() {
    const { url } = usePage();
    const code = decodeURIComponent(url.split('/').pop().split('?')[0]);
    const [state, setState] = useState({ loading: true, data: null });

    useEffect(() => {
        get(`/certificates/verify/${encodeURIComponent(code)}`)
            .then((r) => setState({ loading: false, data: r.data }))
            .catch(() => setState({ loading: false, data: null }));
    }, [code]);

    const c = state.data;

    return (
        <PublicLayout>
            <div className="mx-auto max-w-lg px-4 py-16">
                {state.loading ? (
                    <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
                ) : c ? (
                    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                        <div className="flex items-center gap-3 bg-emerald-50 px-6 py-5">
                            <ShieldCheck size={28} className="text-emerald-600" />
                            <div>
                                <p className="text-lg font-bold text-emerald-900">Certificate verified</p>
                                <p className="text-sm text-emerald-700">This certificate of review service is genuine.</p>
                            </div>
                        </div>
                        <dl className="divide-y divide-gray-100 px-6 text-sm">
                            {[
                                ['Reviewer', c.reviewer],
                                ['Academic year', c.academic_year],
                                ['Reviews completed', breakdown(c)],
                                ['Issued', new Date(c.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
                                ['Certificate no.', c.code],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4 py-3">
                                    <dt className="text-gray-500">{k}</dt>
                                    <dd className="text-right font-medium text-gray-900">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                        <ShieldX size={32} className="mx-auto text-red-500" />
                        <p className="mt-3 text-lg font-bold text-gray-900">Certificate not found</p>
                        <p className="mt-1 text-sm text-gray-500">No certificate with number <span className="font-mono">{code}</span> exists. Check the number and try again.</p>
                    </div>
                )}
                <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400"><Award size={12} /> Research &amp; Technology Transfer — certificate verification</p>
            </div>
        </PublicLayout>
    );
}
