import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function TrackerNumberDisplay({ trackerNumber }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(trackerNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <span className="inline-flex items-center gap-2 rounded bg-gray-100 px-3 py-1 font-mono text-sm text-gray-800">
            {trackerNumber}
            <button onClick={copy} className="text-gray-500 hover:text-gray-800 transition-colors" title="Copy">
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
        </span>
    );
}
