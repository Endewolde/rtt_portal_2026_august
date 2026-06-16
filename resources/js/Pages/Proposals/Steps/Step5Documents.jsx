import { useState, useRef } from 'react';
import { Upload, CheckCircle, XCircle, FileText, X, AlertCircle } from 'lucide-react';
import api from '../../../lib/api';
import { useToast } from '../../../Components/Toast';

export const DOC_TYPES = [
    {
        key:         'proposal_document',
        label:       'Proposal Document',
        description: 'Full research proposal in PDF format',
        accept:      '.pdf',
        maxMB:       10,
        required:    true,
    },
    {
        key:         'budget_spreadsheet',
        label:       'Budget Spreadsheet',
        description: 'Detailed budget breakdown (PDF or Excel)',
        accept:      '.pdf,.xlsx,.xls',
        maxMB:       5,
        required:    true,
    },
    {
        key:         'pi_cv',
        label:       'CV of Principal Investigator',
        description: 'Current CV in PDF format (optional)',
        accept:      '.pdf',
        maxMB:       5,
        required:    false,
    },
    {
        key:         'supporting_document',
        label:       'Supporting Documents',
        description: 'Any additional supporting files (optional)',
        accept:      '*',
        maxMB:       10,
        required:    false,
    },
];

export default function Step5Documents({ proposalId, onComplete, initialUploads }) {
    const toast = useToast();
    const [uploads, setUploads] = useState(initialUploads ?? {});
    const [saving, setSaving]   = useState(false);
    const inputRefs             = useRef({});

    const update = (key, data) =>
        setUploads((prev) => ({ ...prev, [key]: { ...prev[key], ...data } }));

    const handleFile = async (key, file, maxMB) => {
        if (!file) return;

        if (file.size > maxMB * 1024 * 1024) {
            update(key, { error: `File too large. Maximum size is ${maxMB}MB.`, status: 'error' });
            return;
        }

        update(key, { filename: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', status: 'uploading', progress: 0, error: null });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', key);

        const doUpload = async (attempt = 1) => {
            try {
                const res = await api.post(`/proposals/${proposalId}/documents`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (e) => update(key, { progress: Math.round((e.loaded * 100) / e.total) }),
                });
                update(key, { status: 'done', progress: 100, documentId: res.data?.data?.id });
            } catch (err) {
                if (err.response?.status === 429 && attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                    return doUpload(attempt + 1);
                }
                const msg = err.response?.data?.message ?? 'Upload failed. Please try again.';
                update(key, { status: 'error', error: msg });
                toast.error(`Failed to upload ${file.name}. ${msg}`, { title: 'Upload Failed' });
            }
        };
        await doUpload();
    };

    const remove = (key) => {
        setUploads((prev) => { const n = { ...prev }; delete n[key]; return n; });
        if (inputRefs.current[key]) inputRefs.current[key].value = '';
    };

    const requiredDone = DOC_TYPES.filter((d) => d.required).every((d) => uploads[d.key]?.status === 'done');

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post(`/proposals/${proposalId}/steps/5`, {
                document_ids: Object.values(uploads)
                    .filter((u) => u.status === 'done' && u.documentId)
                    .map((u) => u.documentId),
            });
            onComplete({ documents: uploads });
        } catch {}
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Upload the required documents. Required items are marked <span className="text-red-500">*</span>
                </p>
            </div>

            <div className="space-y-4">
                {DOC_TYPES.map((dt) => {
                    const u        = uploads[dt.key];
                    const isDone   = u?.status === 'done';
                    const isUp     = u?.status === 'uploading';
                    const isErr    = u?.status === 'error';

                    return (
                        <div key={dt.key}
                            className={`border-2 rounded-lg p-4 transition-colors ${isDone ? 'border-green-300 bg-green-50' : isErr ? 'border-red-300 bg-red-50' : 'border-dashed border-gray-300 hover:border-blue-400 bg-white'}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); handleFile(dt.key, e.dataTransfer.files[0], dt.maxMB); }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    {isDone  ? <CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" />
                                             : isErr  ? <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                                             : <Upload size={20} className="text-gray-400 shrink-0 mt-0.5" />}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-gray-900">
                                                {dt.label}
                                                {dt.required && <span className="text-red-500 ml-1">*</span>}
                                            </p>
                                            {!dt.required && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Optional</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{dt.description}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {dt.accept === '*' ? 'Any file type' : dt.accept.toUpperCase()} · Max {dt.maxMB}MB
                                        </p>

                                        {u?.filename && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <FileText size={14} className="text-gray-400" />
                                                <span className="text-xs text-gray-700 truncate">{u.filename}</span>
                                                <span className="text-xs text-gray-400">({u.size})</span>
                                            </div>
                                        )}

                                        {isUp && (
                                            <div className="mt-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-blue-600">Uploading…</span>
                                                    <span className="text-xs text-blue-600">{u.progress}%</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                                                </div>
                                            </div>
                                        )}

                                        {isErr && <p className="mt-1 text-xs text-red-600">{u.error}</p>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {u?.filename && (
                                        <button onClick={() => remove(dt.key)} className="text-gray-400 hover:text-red-500 transition-colors">
                                            <X size={16} />
                                        </button>
                                    )}
                                    {!isDone && (
                                        <button onClick={() => inputRefs.current[dt.key]?.click()} disabled={isUp}
                                            className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors">
                                            {isUp ? 'Uploading…' : u?.filename ? 'Replace' : 'Choose File'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <input ref={(el) => (inputRefs.current[dt.key] = el)} type="file"
                                accept={dt.accept} className="hidden"
                                onChange={(e) => handleFile(dt.key, e.target.files[0], dt.maxMB)} />
                        </div>
                    );
                })}
            </div>

            {!requiredDone && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <AlertCircle size={16} className="text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">Please upload all required documents before continuing.</p>
                </div>
            )}

            <div className="flex justify-between pt-2">
                <button onClick={() => onComplete(null, 'back')}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                    Back
                </button>
                <button onClick={handleSave} disabled={!requiredDone || saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save & Continue'}
                </button>
            </div>
        </div>
    );
}
