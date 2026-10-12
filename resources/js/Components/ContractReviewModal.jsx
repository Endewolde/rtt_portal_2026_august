import { useState, useEffect } from 'react';
import { X, Eye, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { useToast } from './Toast';

export default function ContractReviewModal({ proposal, onClose, onDone }) {
    const { success, error } = useToast();
    const [pdfUrl, setPdfUrl] = useState(null);
    const [loadingPdf, setLoadingPdf] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('rtt_token');
        fetch(`/api/v1/proposals/${proposal.id}/contract/download`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.blob())
            .then(blob => setPdfUrl(URL.createObjectURL(blob)))
            .catch(() => setPdfUrl(null))
            .finally(() => setLoadingPdf(false));
        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    }, [proposal.id]);

    const approve = async () => {
        setSaving(true);
        try {
            await api.post(`/proposals/${proposal.id}/contract/approve`);
            success('Contract approved. PI may now submit their first budget request.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to approve contract.');
        }
        setSaving(false);
    };

    const reject = async () => {
        if (!reason.trim()) { error('Please provide a reason for rejection.'); return; }
        setSaving(true);
        try {
            await api.post(`/proposals/${proposal.id}/contract/reject`, { reason });
            success('Contract returned to PI for correction.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to reject contract.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <Eye size={18} className="text-blue-600" /> Review Submitted Contract
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">{proposal.tracker_number} — {proposal.title}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>

                {/* PDF viewer */}
                <div className="flex-1 overflow-hidden bg-gray-100 min-h-100">
                    {loadingPdf ? (
                        <div className="flex items-center justify-center h-full py-16">
                            <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full min-h-100" title="Contract PDF" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                            <AlertCircle size={32} className="mb-2" />
                            <p className="text-sm">Unable to load PDF preview.</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-5 border-t border-gray-100 space-y-3">
                    {rejecting ? (
                        <div className="space-y-3">
                            <label className="text-xs font-medium text-gray-700 block">Reason for rejection (sent to PI)</label>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                placeholder="Explain what needs to be corrected…"
                            />
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setRejecting(false)} disabled={saving}
                                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                                    Back
                                </button>
                                <button onClick={reject} disabled={saving || !reason.trim()}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                                    {saving ? 'Sending…' : 'Return to PI'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-3 justify-end">
                            <button onClick={onClose} disabled={saving}
                                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                                Close
                            </button>
                            <button onClick={() => setRejecting(true)} disabled={saving}
                                className="px-4 py-2 text-sm font-semibold text-red-700 border border-red-300 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50">
                                Reject &amp; Return
                            </button>
                            <button onClick={approve} disabled={saving}
                                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                                {saving ? 'Saving…' : 'Approve Contract'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
