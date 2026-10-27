import { X } from 'lucide-react';

/** Resets a page's filters; shown only while some filter is on. */
export default function ClearButton({ onClick }) {
    return (
        <button type="button" onClick={onClick}
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            <X size={14} /> Clear
        </button>
    );
}
