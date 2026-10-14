import { useState, useEffect } from 'react';
import { Award, Download, ShieldCheck } from 'lucide-react';
import { get } from '../lib/api';
import { downloadFile } from '../lib/download';
import { useToast } from './Toast';

/** My Reviews → certificates of review service, one per academic year with completed reviews. */
export default function ReviewCertificatesCard() {
    const { error } = useToast();
    const [years, setYears] = useState(null);
    const [downloading, setDownloading] = useState(null);

    useEffect(() => {
        get('/review-certificates').then((r) => setYears(r.data ?? [])).catch(() => setYears([]));
    }, []);

    if (!years || years.length === 0) return null;

    const download = async (year) => {
        setDownloading(year.academic_year);
        try {
            await downloadFile(
                `/review-certificates/download?academic_year=${encodeURIComponent(year.academic_year)}`,
                `review-certificate-${year.academic_year.replace(/[^0-9a-z]+/gi, '-')}.pdf`
            );
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not generate the certificate.');
        }
        setDownloading(null);
    };

    return (
        <div className="mb-5 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center gap-3 px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Award size={20} /></span>
                <div>
                    <p className="text-sm font-semibold text-gray-900">Certificates of review service</p>
                    <p className="text-xs text-gray-500">Thank you for reviewing. Download a signed, verifiable certificate for each academic year.</p>
                </div>
            </div>
            <ul className="divide-y divide-amber-100 border-t border-amber-100 bg-white/60">
                {years.map((y) => (
                    <li key={y.academic_year} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{y.academic_year} academic year</p>
                            <p className="text-xs text-gray-500">
                                {y.total} review{y.total === 1 ? '' : 's'} completed
                                {y.blind_reviews > 0 && ` · ${y.blind_reviews} blind`}
                                {y.defence_reviews > 0 && ` · ${y.defence_reviews} open defence`}
                            </p>
                        </div>
                        {y.code && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-400" title="Certificate number — anyone can verify it">
                                <ShieldCheck size={12} /> {y.code}
                            </span>
                        )}
                        <button
                            onClick={() => download(y)}
                            disabled={downloading === y.academic_year}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                            <Download size={13} /> {downloading === y.academic_year ? 'Preparing…' : 'Download PDF'}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
