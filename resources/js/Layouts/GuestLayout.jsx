import { Link } from '@inertiajs/react';
import { FlaskConical } from 'lucide-react';

export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-950 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-white">
                        <FlaskConical size={28} className="text-blue-400" />
                        <span className="text-xl font-bold">RTT Platform</span>
                    </Link>
                    <p className="text-blue-200 text-sm mt-1">Haramaya University Research Office</p>
                </div>
                <div className="bg-white rounded-2xl shadow-2xl p-8">{children}</div>
            </div>
        </div>
    );
}
