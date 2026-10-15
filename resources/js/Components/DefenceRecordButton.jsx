import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { downloadFile } from '../lib/download';
import { useToast } from './Toast';

/** Downloads the signed-off record of a proposal's open defence (PDF). */
export default function DefenceRecordButton({ proposalId, trackerNumber, className = '' }) {
    const { error } = useToast();
    const [busy, setBusy] = useState(false);

    const download = async () => {
        setBusy(true);
        try {
            await downloadFile(`/proposals/${proposalId}/defence-record`, `defence-record-${trackerNumber ?? proposalId}.pdf`);
        } catch (e) {
            error(e.response?.status === 404 ? 'This proposal has no open defence session yet.' : 'Could not create the defence record.');
        }
        setBusy(false);
    };

    return (
        <button onClick={download} disabled={busy}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-50 ${className}`}>
            <FileDown size={13} /> {busy ? 'Preparing…' : 'Defence record'}
        </button>
    );
}
