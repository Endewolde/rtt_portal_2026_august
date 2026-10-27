/**
 * Download what a page shows as CSV, Excel or a printable PDF — no server round
 * trip and no extra library. Columns are { label, value(row) } and the rows are
 * exactly the ones on screen, so downloads follow the page's filters.
 */

const cell = (column, row) => {
    const v = column.value(row);
    return v === null || v === undefined ? '' : v;
};

const escapeHtml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function save(blob, filename) {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: filename }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function table(columns, rows) {
    const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
    const body = rows.map((r) => `<tr>${columns.map((c) => {
        const v = cell(c, r);
        return `<td${typeof v === 'number' ? ' class="num"' : ''}>${escapeHtml(typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v)}</td>`;
    }).join('')}</tr>`).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function exportCsv({ filename, columns, rows }) {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(cell(c, r))).join(','))];
    // The byte-order mark lets Excel read accented and Amharic text correctly.
    save(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

export function exportExcel({ filename, title, columns, rows }) {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
        <style>th{background:#eef2ff;font-weight:bold;border:1px solid #c7d2fe}td{border:1px solid #e5e7eb}.num{mso-number-format:"#,##0.00";text-align:right}</style></head>
        <body>${title ? `<h3>${escapeHtml(title)}</h3>` : ''}${table(columns, rows)}</body></html>`;
    save(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' }), `${filename}.xls`);
}

/** Opens a clean, printable page; the browser's print dialog saves it as PDF. */
export function exportPdf({ title, subtitle, columns, rows }) {
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
        <style>
            body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;margin:24px}
            h1{font-size:18px;margin:0}p{color:#6b7280;font-size:12px;margin:4px 0 16px}
            table{width:100%;border-collapse:collapse;font-size:11px}
            th{background:#f3f4f6;text-align:left;padding:6px 8px;border-bottom:1px solid #d1d5db;text-transform:uppercase;font-size:10px;letter-spacing:.03em;color:#4b5563}
            td{padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}.num{text-align:right;font-variant-numeric:tabular-nums}
            @page{size:landscape;margin:12mm}
        </style></head><body>
        <h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle ?? '')} · ${rows.length} row${rows.length === 1 ? '' : 's'} · ${new Date().toLocaleString('en-GB')}</p>
        ${table(columns, rows)}
        <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
    return true;
}
