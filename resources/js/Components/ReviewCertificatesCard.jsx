import { useState, useEffect } from 'react';
import { translate as tr } from '../lib/i18n'
import { Award, Download, ShieldCheck, ShieldX, Clock, CheckCircle2 } from 'lucide-react';
import { get } from '../lib/api';
import { downloadFile } from '../lib/download';
import { useToast } from './Toast';

/** Right-hand side of a year row: download, or why it isn't available yet. */
function YearStatus({ y, downloading, onDownload }) {
    if (y.withdrawn) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <ShieldX size={13} /> {tr('Withdrawn by the central office for now')}
            </span>
        );
    }
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
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-400" title={tr("Certificate number — anyone can verify it")}>
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
        return <span className="text-xs text-gray-400">{tr("Not issued — :min_reviews qualifying reviews were required", { min_reviews: y.min_reviews })}</span>;
    }
    if (y.eligible) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={13} /> {tr("You qualify · released after the year's reviews close")}
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

    const issued = years.filter((y) => y.released && y.code && !y.revoked && !y.withdrawn).length;

    return (
        <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-yellow-600 text-white shadow-sm"><Award size={18} /></span>
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">{tr("Certificates of review service")}</h2>
                        <p className="text-xs text-gray-500">{tr("One signed, verifiable certificate per academic year")}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums leading-none text-amber-600">{issued}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{tr("issued")}</p>
                </div>
            </header>

            <ul className="flex-1 space-y-2 px-5 py-4">
                {years.map((y) => {
                    const showProgress = !y.released && !y.withdrawn && y.min_reviews > 0;
                    const pct = showProgress ? Math.min(100, Math.round((y.counted / y.min_reviews) * 100)) : 0;
                    return (
                        <li key={y.academic_year} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="rounded-lg bg-white px-2 py-1 font-mono text-xs font-bold text-gray-800 ring-1 ring-gray-200">{y.academic_year}</span>
                                <p className="min-w-0 flex-1 text-xs text-gray-500">
                                    <b className="text-gray-800">{y.total}</b> review{y.total === 1 ? '' : 's'} completed
                                    {y.blind_reviews > 0 && ` · ${y.blind_reviews} blind`}
                                    {y.defence_reviews > 0 && ` · ${y.defence_reviews} open defence`}
                                    {y.on_time_only && y.late > 0 && ` · ${y.late} late (not counted)`}
                                </p>
                                <div className="flex flex-wrap items-center gap-2"><YearStatus y={y} downloading={downloading} onDownload={download} /></div>
                            </div>
                            {showProgress && (
                                <div className="mt-2.5 flex items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                                        <div className={`h-full rounded-full ${y.eligible ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[10px] tabular-nums text-gray-500">{Math.min(y.counted, y.min_reviews)}/{y.min_reviews}</span>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <footer className="flex items-start gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-[11px] leading-relaxed text-gray-500">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-amber-600" />
                {tr("Thank you for reviewing. The central office releases a signed, verifiable certificate for each academic year once its reviews are finished.")}
            </footer>
        </section>
    );
}
