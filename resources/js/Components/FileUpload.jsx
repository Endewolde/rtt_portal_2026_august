import { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle } from 'lucide-react';

export default function FileUpload({ accept = '*', maxSize = 10, multiple = false, onUpload, label = 'Upload File' }) {
    const [files, setFiles] = useState([]);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState({});
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    const validate = (file) => {
        if (file.size > maxSize * 1024 * 1024) return `File exceeds ${maxSize}MB limit.`;
        return null;
    };

    const handleFiles = (incoming) => {
        setError('');
        const validated = [];
        for (const file of incoming) {
            const err = validate(file);
            if (err) { setError(err); return; }
            validated.push(file);
        }
        const next = multiple ? [...files, ...validated] : validated.slice(0, 1);
        setFiles(next);
        // Simulate progress
        next.forEach((f) => {
            setProgress((p) => ({ ...p, [f.name]: 0 }));
            let pct = 0;
            const iv = setInterval(() => {
                pct += 20;
                setProgress((p) => ({ ...p, [f.name]: pct }));
                if (pct >= 100) {
                    clearInterval(iv);
                    onUpload?.(next);
                }
            }, 100);
        });
    };

    return (
        <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles([...e.dataTransfer.files]); }}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors
                    ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'}`}
            >
                <Upload size={24} className="text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Drag & drop or <span className="text-blue-600 font-medium">browse</span></p>
                <p className="text-xs text-gray-400 mt-1">Max {maxSize}MB · {accept}</p>
                <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden"
                    onChange={(e) => handleFiles([...e.target.files])} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {files.map((f) => (
                <div key={f.name} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <FileText size={18} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{f.name}</p>
                        <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</p>
                        {progress[f.name] < 100 && (
                            <div className="mt-1 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress[f.name]}%` }} />
                            </div>
                        )}
                    </div>
                    {progress[f.name] >= 100 && <CheckCircle size={16} className="text-green-500 shrink-0" />}
                    <button onClick={(e) => { e.stopPropagation(); setFiles(files.filter((x) => x.name !== f.name)); }}
                        className="text-gray-400 hover:text-red-500">
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
}
