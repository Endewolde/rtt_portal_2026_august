import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { get, post } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

export default function SignatureStatus() {
    const { url } = usePage();
    const id = url.split('/')[2];
    const { user } = useAuth();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [signing, setSigning] = useState(false);

    const load = () => get(`/budget-requests/${id}`)
        .then((r) => setRequest(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));

    useEffect(() => { load(); }, [id]);

    const handleSign = async () => {
        setSigning(true);
        try { await post(`/budget-requests/${id}/sign`); await load(); } catch {}
        setSigning(false); setConfirmOpen(false);
    };

    const mySignature = request?.signatures?.find((s) => s.user_id === user?.id);

    if (loading) return <AppLayout breadcrumb="Budget Request"><div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" /></div></AppLayout>;
    if (!request) return <AppLayout breadcrumb="Budget Request"><p className="text-gray-500">Budget request not found.</p></AppLayout>;

    return (
        <AppLayout breadcrumb="Budget Request — Signatures">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h1 className="text-lg font-bold text-gray-900 mb-1">Budget Request — Round {request.funding_round}</h1>
                    <p className="text-sm text-gray-500">Status: <span className="font-medium capitalize">{request.status}</span></p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Signature Chain</h2>
                    <ul className="space-y-3">
                        {(request.signatures ?? []).map((sig) => (
                            <li key={sig.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3">
                                {sig.status === 'signed' && <CheckCircle size={18} className="text-green-500 shrink-0" />}
                                {sig.status === 'refused' && <XCircle size={18} className="text-red-500 shrink-0" />}
                                {sig.status === 'pending' && <Clock size={18} className="text-gray-400 shrink-0" />}
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800">{sig.user?.name ?? sig.user_id}</p>
                                    <p className="text-xs text-gray-400 capitalize">{sig.role?.replace('_', ' ')}</p>
                                    {sig.status === 'signed' && <p className="text-xs text-green-600">Signed {formatDateTime(sig.signed_at)}</p>}
                                    {sig.status === 'refused' && <p className="text-xs text-red-600">Refused: {sig.refusal_reason}</p>}
                                </div>
                            </li>
                        ))}
                    </ul>

                    {mySignature?.status === 'pending' && (
                        <button onClick={() => setConfirmOpen(true)}
                            className="mt-4 w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                            Sign Budget Request
                        </button>
                    )}
                </div>
            </div>

            <ConfirmDialog open={confirmOpen} onCancel={() => setConfirmOpen(false)} onConfirm={handleSign}
                title="Sign Budget Request" description="By signing, you confirm the budget details are accurate."
                confirmLabel={signing ? 'Signing…' : 'Sign'} />
        </AppLayout>
    );
}
