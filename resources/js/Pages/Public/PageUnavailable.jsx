import { Link } from '@inertiajs/react';
import { EyeOff, ArrowLeft } from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { useT } from '../../lib/i18n';

/** Shown in place of a public page the site's administrators have switched off. */
export default function PageUnavailable() {
    const t = useT();

    return (
        <PublicLayout>
            <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500"><EyeOff size={24} /></span>
                <h1 className="mt-5 text-2xl font-bold text-gray-900">{t('This page is not available')}</h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{t('It has been switched off for now. Please check back later.')}</p>
                <Link href="/" className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                    <ArrowLeft size={14} /> {t('Back to the home page')}
                </Link>
            </div>
        </PublicLayout>
    );
}
