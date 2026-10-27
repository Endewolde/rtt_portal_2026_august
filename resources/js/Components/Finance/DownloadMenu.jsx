import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown } from 'lucide-react';
import { exportCsv, exportExcel, exportPdf } from '../../lib/exportTable';
import { useToast } from '../Toast';

/**
 * One "Download" button for every budget page: Excel, CSV or PDF of exactly the
 * rows on screen (the page's filters apply).
 */
export default function DownloadMenu({ filename, title, subtitle, columns, rows }) {
    const { error } = useToast();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const stamp = new Date().toISOString().slice(0, 10);
    const args = { filename: `${filename}-${stamp}`, title, subtitle, columns, rows };
    const run = (fn) => {
        setOpen(false);
        if (fn(args) === false) error('Allow pop-ups for this site to print or save as PDF.');
    };

    const options = [
        { label: 'Excel', hint: '.xls', icon: FileSpreadsheet, fn: exportExcel },
        { label: 'CSV', hint: '.csv', icon: FileText, fn: exportCsv },
        { label: 'PDF / Print', hint: 'opens print', icon: Printer, fn: exportPdf },
    ];

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen((v) => !v)} disabled={!rows.length} aria-haspopup="menu" aria-expanded={open}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                <Download size={14} /> <span className="hidden sm:inline">Download</span> <ChevronDown size={13} className="text-gray-400" />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                    <p className="px-3 pb-1 pt-1.5 text-[11px] text-gray-400">{rows.length} row{rows.length === 1 ? '' : 's'}, as filtered</p>
                    {options.map((o) => (
                        <button key={o.label} role="menuitem" onClick={() => run(o.fn)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <o.icon size={15} className="text-gray-400" /> {o.label} <span className="ml-auto text-[11px] text-gray-400">{o.hint}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
