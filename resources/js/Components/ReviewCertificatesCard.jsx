import { useState, useEffect } from 'react';
import { Award, Download, ShieldCheck, ShieldX, Clock, CheckCircle2 } from 'lucide-react';
import { get } from '../lib/api';
import { downloadFile } from '../lib/download';
import { useToast } from './Toast';

/** Right-hand side of a year row: download, or why it isn't available yet. */
function YearStatus({ y, downloading, onDownload }) {
    if (y.released && y.revoked) {
        return (
            <span className="inline-flex max-w-xs items-start gap-1.5 text-xs text-red-600" title={y.revocation_reason ?? ''}>
                <ShieldX size={13} className="mt-0.5 shrink-0" />
                <span>Revoked{y.revocation_reason ? `: ${y.revocation_reason}` : ''}</span>
            </span>
        );
    }
    if (y.released && y.code) {
        return (
            <>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-400" title="Certificate number — anyone can verify it">
                    <ShieldCheck size={12} /> {y.code}
                </span>
                <button
                    onClick={() => onDownload(y)}
                    disabled={downloading === y.academic_year}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                    <Download size={13} /> {downloading === y.academic_year ? 'Preparing…' : 'Download PDF'}
                </button>
            </>
        );
    }
    if (y.released) {
        return <span className="text-xs text-gray-400">Not issued — {y.min_reviews} qualifying reviews were required</span>;
    }
    if (y.eligible) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={13} /> You qualify · released after the year's reviews close
            </span>
        );
    }
    const needed = y.min_reviews - y.counted;
    return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            <Clock size={13} /> {needed} more {y.on_time_only ? 'on-time ' : ''}review{needed === 1 ? '' : 's'} to qualify
        </span>
    );
}

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
                    <p className="text-xs text-gray-500">Thank you for reviewing. The central office releases a signed, verifiable certificate for each academic year once its reviews are finished.</p>
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
                                {y.on_time_only && y.late > 0 && ` · ${y.late} late (not counted)`}
                            </p>
                        </div>
                        <YearStatus y={y} downloading={downloading} onDownload={download} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
