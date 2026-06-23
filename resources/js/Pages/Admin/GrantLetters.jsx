import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
    FileText, Printer, Search, ChevronRight, BadgeDollarSign,
    User, RefreshCw, Layers, CheckCircle, Lock, Unlock, Download,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import api from '../../lib/api';
import { usePage } from '@inertiajs/react';

// ── Pure helpers ──────────────────────────────────────────────────────────────

const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function numberToWords(num) {
    if (!num || isNaN(num)) return '';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
        'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
        'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = n => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
        if (n < 1_000_000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        return convert(Math.floor(n / 1_000_000)) + ' Million' + (n % 1_000_000 ? ' ' + convert(n % 1_000_000) : '');
    };
    return convert(Math.round(parseFloat(num)));
}

function todayFormatted() {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildData(proposal, head) {
    const pi     = proposal?.pi;
    const coInvs = (proposal?.members ?? [])
        .filter(m => m.role === 'co_investigator' && m.status === 'active')
        .map(m => m.user).filter(Boolean);
    const award  = proposal?.award;
    const amount = award?.awarded_amount ? parseFloat(award.awarded_amount) : null;
    const amountFmt = amount
        ? amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
          + ' (' + numberToWords(amount) + ' Ethiopian Birr)'
        : '[Amount]';

    const members = [
        ...(pi ? [{ name: pi.name, role: 'PI' }] : []),
        ...coInvs.map(u => ({ name: u.name, role: 'Member' })),
    ];

    const category = (proposal?.category ?? '').replace(/_/g, ' ');
    const title    = proposal?.title ?? '';

    const body = proposal ? [
        `${head.orgName} is pleased to inform you that your ${category} proposal entitled "${title}" has undergone a thorough evaluation and assessment by the Evaluation Management System and is accepted for funding amounting to ${amountFmt} for one year.`,
        '',
        `Thus, we are pleased to inform you that the office of the Vice President for Research and Technology Transfer has approved your proposal for the aforementioned budget grant. Upon completion of the project and when all functional requirements are met, you are required to hand over the system to the university. In the meantime, training, support and maintenance should be provided by the team members whenever deemed necessary by the office of the Vice President for Research and Technology Transfer during the grant period. We wish you success in your research project and look forward to receiving tangible outputs and successful implementation of the project.`,
    ].join('\n') : '';

    return {
        refNo:         award?.grant_reference ?? '',
        fileNo:        '',
        date:          todayFormatted(),
        members,
        subject:       `Decision to award grant to ${category} project proposal`,
        body,
        signatoryName:  '',
        signatoryTitle: 'Vice President, Research and Technology Transfer',
        cc: [
            'To Office of the Vice President for Research and Technology Transfer',
            'To Finance and Budget Directorate',
            'To University Industry Linkage and Technology Transfer Directorate',
        ],
        amount,
        category,
        title,
    };
}

// ── HTML generator ────────────────────────────────────────────────────────────
// Every text node has contenteditable="true" — user can click anywhere and type.
// data-field attributes allow template extraction from the live DOM.

function generateLetterHtml(data, head) {
    const sealHtml = head.logo
        ? `<img data-logo src="${esc(head.logo)}" style="height:80px;width:80px;object-fit:contain;" />`
        : `<div data-logo-placeholder style="width:80px;height:80px;border-radius:50%;border:3px double #555;
               display:flex;align-items:center;justify-content:center;font-size:8pt;color:#777;
               text-align:center;padding:6px;">[Click to<br/>upload seal]</div>`;

    // Column-wise 3-up: fill left → middle → right, top-to-bottom.
    const colSize = Math.ceil(data.members.length / 3);
    const col1 = data.members.slice(0, colSize);
    const col2 = data.members.slice(colSize, colSize * 2);
    const col3 = data.members.slice(colSize * 2);
    const cell = (m, idx) => m ? `
            <td style="padding-right:8px;max-width:140px;">
                <span contenteditable="true" data-field="member-name-${idx}" style="outline:none;">${esc(m.name)}</span>
            </td>
            <td style="white-space:nowrap;padding-right:28px;">
                <span contenteditable="true" data-field="member-role-${idx}" style="outline:none;">${esc(m.role)}</span>
            </td>` : '<td colspan="2"></td>';
    const membersRows = col1.map((m, i) => {
        const m2 = col2[i], m3 = col3[i];
        return `
        <tr>
            <td style="padding-right:12px;vertical-align:top;width:36px;white-space:nowrap;">${i === 0 ? 'To:' : ''}</td>
            ${cell(m,  i)}
            ${cell(m2, i + colSize)}
            ${cell(m3, i + colSize * 2)}
        </tr>`;
    }).join('');

    const ccContent = data.cc.filter(Boolean).map(c => `• ${c}`).join('\n');

    return `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
    <div style="font-weight:bold;text-align:center;font-size:11pt;min-width:130px;">
        <div contenteditable="true" data-field="orgNameAmharic"
             style="outline:none;display:block;">${esc(head.orgNameAmharic)}</div>
        <div contenteditable="true" data-field="orgSubAmharic"
             style="outline:none;display:block;font-weight:normal;font-size:9pt;">${esc(head.orgSubAmharic ?? '')}</div>
    </div>
    <div data-logo-area contenteditable="false"
         style="text-align:center;cursor:pointer;user-select:none;">
        ${sealHtml}
        <div style="font-size:7pt;color:#94a3b8;margin-top:3px;">▲ click to change</div>
    </div>
    <div style="text-align:right;font-size:11pt;min-width:130px;">
        <div contenteditable="true" data-field="orgName"
             style="outline:none;font-weight:bold;display:block;">${esc(head.orgName)}</div>
        <div contenteditable="true" data-field="address"
             style="outline:none;font-size:9pt;display:block;">${esc(head.address)}</div>
    </div>
</div>

<div style="border-top:2px solid #000;margin-bottom:10px;"></div>

<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
    <table style="font-size:10pt;border-collapse:collapse;">
        <tbody>
            <tr>
                <td style="padding-right:8px;white-space:nowrap;">Ref/No:</td>
                <td style="border-bottom:1px solid #000;min-width:90px;padding-right:12px;">
                    <span contenteditable="true" data-field="refNo" style="outline:none;">${esc(data.refNo)}</span>
                </td>
                <td style="padding-right:8px;padding-left:8px;white-space:nowrap;">File No:</td>
                <td style="border-bottom:1px solid #000;min-width:60px;">
                    <span contenteditable="true" data-field="fileNo" style="outline:none;">${esc(data.fileNo)}</span>
                </td>
            </tr>
            <tr>
                <td style="padding-right:8px;padding-top:6px;white-space:nowrap;">Date:</td>
                <td colspan="3" style="border-bottom:1px solid #000;padding-top:6px;">
                    <span contenteditable="true" data-field="date" style="outline:none;">${esc(data.date)}</span>
                </td>
            </tr>
        </tbody>
    </table>
</div>

<div style="margin-bottom:16px;font-size:11pt;">
    <table style="border-collapse:collapse;font-size:10pt;" data-members-table>
        <tbody>${membersRows}</tbody>
    </table>
</div>

<div style="margin-bottom:16px;font-size:11pt;">
    <strong><u><span contenteditable="true" data-field="subject"
        style="outline:none;">Subject:&nbsp;${esc(data.subject)}</span></u></strong>
</div>

<div contenteditable="true" data-field="body"
     style="margin-bottom:24px;font-size:11pt;text-align:justify;
            white-space:pre-wrap;line-height:1.7;outline:none;">${esc(data.body)}</div>

<div style="margin-bottom:4px;font-size:11pt;">Sincerely,</div>

<div style="display:flex;justify-content:space-between;align-items:flex-end;margin:20px 0 16px;">
    <div>
        <div style="height:48px;"></div>
        <div style="border-top:1px solid #000;padding-top:6px;min-width:200px;">
            <div style="font-weight:bold;">
                <span contenteditable="true" data-field="signatoryName"
                      style="outline:none;">${esc(data.signatoryName)}</span>
            </div>
            <div style="font-size:10pt;">
                <span contenteditable="true" data-field="signatoryTitle"
                      style="outline:none;">${esc(data.signatoryTitle)}</span>
            </div>
        </div>
    </div>
    <div data-stamp-area contenteditable="false"
         style="width:90px;height:90px;border-radius:50%;
                ${head.stamp ? 'border:none;padding:0;' : 'border:2px dashed #999;padding:8px;'}
                overflow:hidden;cursor:pointer;display:flex;align-items:center;
                justify-content:center;flex-shrink:0;">
        ${head.stamp
            ? `<img data-stamp src="${esc(head.stamp)}" style="width:100%;height:100%;object-fit:contain;" />`
            : `<div data-stamp-placeholder style="text-align:center;font-size:8pt;color:#bbb;line-height:1.4;">
                   Official<br/>Stamp<br/><span style="font-size:7pt;color:#93c5fd;">▲ upload</span>
               </div>`
        }
    </div>
</div>

<div style="font-size:10pt;margin-top:8px;">
    <span style="font-weight:bold;">CC:</span>
    <div contenteditable="true" data-field="cc"
         style="outline:none;padding-left:8px;white-space:pre-wrap;margin-top:2px;">${esc(ccContent)}</div>
</div>

<div data-letter-footer style="position:absolute;bottom:10mm;left:20mm;right:20mm;
            border-top:1.5px solid #000;padding-top:5px;
            display:flex;justify-content:space-between;font-size:8.5pt;color:#222;">
    <div>Fax No:&nbsp;<span contenteditable="true" data-field="fax"
        style="outline:none;display:inline-block;min-width:80px;border-bottom:1px dashed #aaa;">${esc(head.fax ?? '')}</span></div>
    <div>E mail:&nbsp;<span contenteditable="true" data-field="email"
        style="outline:none;display:inline-block;min-width:100px;border-bottom:1px dashed #aaa;">${esc(head.email ?? '')}</span></div>
    <div><span contenteditable="true" data-field="footerAmharic"
        style="outline:none;display:inline-block;min-width:80px;">${esc(head.footerAmharic ?? head.orgNameAmharic ?? '')}</span></div>
</div>`;
}

// ── Letter canvas — memo prevents parent re-renders from resetting user edits.
// key={proposalId} causes a clean remount when a new proposal is chosen.

const LetterCanvas = memo(
    function LetterCanvas({ html, onMount }) {
        const ref = useRef(null);
        useEffect(() => { if (ref.current) onMount(ref.current); }, []); // eslint-disable-line

        return (
            <div
                ref={ref}
                className="grant-letter-page"
                style={{
                    width: '210mm', minHeight: '297mm',
                    background: 'white',
                    fontFamily: '"Times New Roman", Times, serif',
                    fontSize: '11pt', color: '#000',
                    padding: '14mm 20mm 28mm',
                    boxSizing: 'border-box', position: 'relative', lineHeight: '1.5',
                }}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );
    },
    () => true, // never re-render from outside; DOM is source of truth
);


// ── Main ──────────────────────────────────────────────────────────────────────

export default function GrantLetters() {
    const appSettings = usePage().props.app_settings ?? {};

    const [head, setHead] = useState({
        orgName:        appSettings.organization_name ?? 'Wolaita Sodo University',
        orgNameAmharic: appSettings.org_name_amharic  ?? 'ወላይታ ሶዶ ዩኒቨርሲቲ',
        orgSubAmharic:  appSettings.org_sub_amharic   ?? 'ወላይታ ሶዶ',
        address:        appSettings.address            ?? 'Wolaita Sodo, Ethiopia',
        fax:            appSettings.fax                ?? '',
        email:          appSettings.mail_from_address  ?? '',
        footerAmharic:  appSettings.org_name_amharic  ?? 'ወላይታ ሶዶ ዩኒቨርሲቲ',
        logo:           appSettings.system_logo        ?? null,
        stamp:          null,
    });

    const [proposals, setProposals]     = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [search, setSearch]           = useState('');
    const [selected, setSelected]       = useState(null);
    const [currentHtml, setCurrentHtml] = useState(null);

    const [templateLocked, setTemplateLocked]     = useState(false);
    const [bulkProposals, setBulkProposals]       = useState([]);
    const [bulkLoading, setBulkLoading]           = useState(false);
    const [lockedHead, setLockedHead]             = useState(null);
    const [lockedOverrides, setLockedOverrides]   = useState(null);

    const canvasDomRef  = useRef(null);
    const logoInputRef  = useRef(null);
    const stampInputRef = useRef(null);

    // Load funded proposals
    useEffect(() => {
        setLoadingList(true);
        api.get('/proposals', { params: { status: 'funded', per_page: 200 } })
            .then(r => {
                const items = r.data?.data?.data ?? r.data?.data ?? [];
                Promise.all(
                    items.map(p =>
                        api.get(`/proposals/${p.id}/award`)
                            .then(ar => ({ ...p, award: ar.data?.data ?? null }))
                            .catch(() => p),
                    ),
                ).then(setProposals);
            })
            .catch(() => {})
            .finally(() => setLoadingList(false));
    }, []);

    // Wire logo + stamp click handlers whenever the canvas remounts (new proposal)
    const handleCanvasMount = useCallback(domNode => {
        canvasDomRef.current = domNode;
        const logoArea = domNode.querySelector('[data-logo-area]');
        if (logoArea) {
            logoArea.addEventListener('click', () => logoInputRef.current?.click());
        }
        const stampArea = domNode.querySelector('[data-stamp-area]');
        if (stampArea) {
            stampArea.addEventListener('click', () => stampInputRef.current?.click());
        }
    }, []);

    const handleLogoFile = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const src = ev.target.result;
            // Update the DOM directly — no React re-render, no edit loss
            const dom = canvasDomRef.current;
            if (dom) {
                const existing = dom.querySelector('[data-logo]');
                if (existing) {
                    existing.src = src;
                } else {
                    const placeholder = dom.querySelector('[data-logo-placeholder]');
                    if (placeholder) {
                        const img = document.createElement('img');
                        img.setAttribute('data-logo', '');
                        img.src = src;
                        img.style.cssText = 'height:80px;width:80px;object-fit:contain;';
                        placeholder.replaceWith(img);
                    }
                }
            }
            setHead(h => ({ ...h, logo: src })); // keep in sync for bulk letters
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleStampFile = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const src = ev.target.result;
            const dom = canvasDomRef.current;
            if (dom) {
                const stampArea = dom.querySelector('[data-stamp-area]');
                if (stampArea) {
                    // Remove the dashed circle once a real stamp is uploaded
                    stampArea.style.border = 'none';
                    stampArea.style.padding = '0';
                }
                const existing = dom.querySelector('[data-stamp]');
                if (existing) {
                    existing.src = src;
                } else {
                    const placeholder = dom.querySelector('[data-stamp-placeholder]');
                    if (placeholder) {
                        const img = document.createElement('img');
                        img.setAttribute('data-stamp', '');
                        img.src = src;
                        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
                        placeholder.replaceWith(img);
                    }
                }
            }
            setHead(h => ({ ...h, stamp: src }));
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const selectProposal = async p => {
        let full = p;
        try {
            const r = await api.get(`/proposals/${p.id}`);
            full = { ...p, ...(r.data?.data ?? {}), award: p.award ?? r.data?.data?.award };
        } catch {}
        const data = buildData(full, head);
        setSelected(full);
        setCurrentHtml(generateLetterHtml(data, head));
        setTemplateLocked(false);
        setBulkProposals([]);
    };

    // Read the live DOM to capture whatever the user has typed
    const captureDomTemplate = () => {
        const dom = canvasDomRef.current;
        if (!dom) return {};
        const get = field => dom.querySelector(`[data-field="${field}"]`)?.innerText?.trim() ?? '';
        const capturedHead = {
            orgName:        get('orgName')        || head.orgName,
            orgNameAmharic: get('orgNameAmharic') || head.orgNameAmharic,
            orgSubAmharic:  get('orgSubAmharic')  || head.orgSubAmharic,
            address:        get('address')        || head.address,
            fax:            get('fax')            || head.fax,
            email:          get('email')          || head.email,
            footerAmharic:  get('footerAmharic')  || head.footerAmharic,
            logo:           head.logo,
            stamp:          head.stamp,
        };
        const overrides = {
            signatoryName:  get('signatoryName'),
            signatoryTitle: get('signatoryTitle') || 'Vice President, Research and Technology Transfer',
            date:           get('date')            || todayFormatted(),
            fileNo:         get('fileNo'),
            cc:             get('cc').split('\n').map(s => s.replace(/^•\s*/, '').trim()).filter(Boolean),
        };
        return { capturedHead, overrides };
    };

    const lockTemplate = async () => {
        const { capturedHead, overrides } = captureDomTemplate();
        setLockedHead(capturedHead);
        setLockedOverrides(overrides);
        setTemplateLocked(true);

        setBulkLoading(true);
        const full = await Promise.all(
            proposals.map(p =>
                api.get(`/proposals/${p.id}`)
                    .then(r => ({ ...p, ...(r.data?.data ?? {}), award: p.award ?? r.data?.data?.award }))
                    .catch(() => p),
            ),
        );
        setBulkProposals(full);
        setBulkLoading(false);
    };

    // @page owns the paper margins (14mm top, 20mm sides, 28mm bottom).
    // Each letter div is exactly the remaining content height (255mm = 297-14-28).
    // The footer inline style (bottom:10mm left:20mm right:20mm) is correct for the
    // on-screen canvas but wrong for print — we override it via [data-letter-footer].
    const PRINT_CSS = `
        * { margin:0; padding:0; box-sizing:border-box; }
        html, body { background:white; }
        @page { size:A4 portrait; margin:14mm 20mm 28mm; }
        [data-letter-footer] { bottom:0!important; left:0!important; right:0!important; }
        [data-logo-area] > div:last-child { display:none!important; }
        [data-stamp-placeholder] { display:none!important; }
        [data-stamp-area]:not(:has(img)) { border:none!important; background:none!important; }
        [contenteditable] { outline:none!important; background:none!important; border-bottom:none!important; }
    `;

    // height:255mm = 297 - 14(top margin) - 28(bottom margin)
    // No padding — @page margin provides the white space on paper.
    const LETTER_STYLE =
        'height:255mm;overflow:hidden;position:relative;background:white;' +
        'font-family:"Times New Roman",Times,serif;font-size:11pt;color:#000;' +
        'line-height:1.5;break-after:page;page-break-after:always;';

    // Converts any image URL (relative or absolute) to a base64 data-URI so it
    // survives being embedded in a blob: document that has no origin to resolve from.
    const toDataUrl = async (src) => {
        if (!src || src.startsWith('data:')) return src;
        try {
            const abs = src.startsWith('http') ? src : window.location.origin + src;
            const res = await fetch(abs);
            const buf = await res.arrayBuffer();
            const mime = res.headers.get('content-type') || 'image/png';
            const b64  = btoa(String.fromCharCode(...new Uint8Array(buf)));
            return `data:${mime};base64,${b64}`;
        } catch {
            return src; // best-effort fallback
        }
    };

    // Opens a real browser tab (not iframe) via blob URL — guarantees correct
    // mm-unit rendering, proper viewport, and auto-prints then closes.
    const printViaBlob = async (bodyHtml) => {
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
            <style>${PRINT_CSS}</style>
        </head><body>${bodyHtml}
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); window.close(); }, 250);
                };
            </script>
        </body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const win  = window.open(url, '_blank');
        if (!win) {
            alert('Please allow pop-ups for this site to print/download grant letters.');
        }
        setTimeout(() => URL.revokeObjectURL(url), 15000);
    };

    const printSingleLetter = async () => {
        const dom = canvasDomRef.current;
        if (!dom) return;
        // Inline the logo as base64 so the blob window can render it without an origin
        const logoImg = dom.querySelector('[data-logo]');
        let savedSrc = null;
        if (logoImg && logoImg.src && !logoImg.src.startsWith('data:')) {
            savedSrc = logoImg.getAttribute('src');
            logoImg.setAttribute('src', await toDataUrl(savedSrc));
        }
        await printViaBlob(`<div style="${LETTER_STYLE}">${dom.innerHTML}</div>`);
        if (logoImg && savedSrc) logoImg.setAttribute('src', savedSrc); // restore
    };

    const printBulk = async () => {
        if (!templateLocked || !lockedHead || !lockedOverrides) return;
        // Pre-convert logo once for all pages
        const logoSrc = lockedHead.logo ? await toDataUrl(lockedHead.logo) : null;
        const headWithInlinedLogo = { ...lockedHead, logo: logoSrc ?? lockedHead.logo };
        const pages = bulkProposals.map(p => {
            const data = {
                ...buildData(p, headWithInlinedLogo),
                ...lockedOverrides,
                refNo: p.award?.grant_reference ?? '',
            };
            return `<div style="${LETTER_STYLE}">${generateLetterHtml(data, headWithInlinedLogo)}</div>`;
        }).join('');
        await printViaBlob(pages);
    };

    const filtered = proposals.filter(p =>
        !search
        || p.title?.toLowerCase().includes(search.toLowerCase())
        || p.tracker_number?.includes(search),
    );

    return (
        <AppLayout breadcrumb="Grant Letters">
            {/* Mobile gate — A4 canvas is 210mm wide and cannot be meaningfully edited on a phone */}
            <div className="lg:hidden flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5">
                    <FileText size={28} className="text-slate-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Desktop Required</h2>
                <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
                    Grant letter editing uses an A4 canvas that requires a larger screen.
                    Please open this page on a <span className="font-semibold text-gray-700">laptop or desktop</span> for the best experience.
                </p>
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    Recommended: 1280px width or wider
                </div>
            </div>

            <div className="hidden lg:block">
            <style>{`
                [contenteditable=true]:hover {
                    outline: 1px dashed #93c5fd !important;
                    border-radius: 2px;
                    cursor: text;
                }
                [contenteditable=true]:focus {
                    outline: 2px solid #3b82f6 !important;
                    background: rgba(239,246,255,0.9) !important;
                    border-radius: 2px;
                }
                [data-logo-area]:hover { opacity: 0.8; }

            `}</style>

            <div className="max-w-screen-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
                            <FileText size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Grant Letters</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {currentHtml
                                    ? 'Click any text on the letter to edit it — body, names, header, footer, all inline'
                                    : 'Select a funded proposal to start'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentHtml && !templateLocked && (
                            <>
                                <button
                                    onClick={printSingleLetter}
                                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                                >
                                    <Printer size={14} /> Print / Download
                                </button>
                                <button
                                    onClick={lockTemplate}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
                                >
                                    <Lock size={14} /> Approve Template &amp; Generate All
                                </button>
                            </>
                        )}
                        {templateLocked && (
                            <>
                                <button
                                    onClick={() => setTemplateLocked(false)}
                                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                                >
                                    <Unlock size={14} /> Edit Template
                                </button>
                                <button
                                    onClick={printBulk}
                                    disabled={bulkLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
                                    title="Opens print dialog — choose 'Save as PDF' to download"
                                >
                                    {bulkLoading
                                        ? <><RefreshCw size={14} className="animate-spin" /> Preparing…</>
                                        : <><Download size={14} /> Download All {proposals.length} Letters</>
                                    }
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Template locked banner */}
                {templateLocked && (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
                        <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-emerald-800">
                                Template approved — {proposals.length} letters ready
                            </p>
                            <p className="text-xs text-emerald-700 mt-0.5">
                                Shared fields (date, signatory, stamp, CC, footer, letterhead) apply to all letters. Each letter gets its own PI, co-investigators, title, and amount. In the print dialog, choose <strong>Save as PDF</strong> to download.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex gap-5 items-start">
                    {/* Left: proposal list */}
                    <div className="w-72 shrink-0">
                        <div className="relative mb-3">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search funded proposals…"
                                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Funded Proposals</span>
                                <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                    {proposals.length}
                                </span>
                            </div>

                            {loadingList ? (
                                <div className="flex justify-center py-10">
                                    <div className="h-6 w-6 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-10 text-center">
                                    <BadgeDollarSign size={28} className="mx-auto text-gray-300 mb-2" />
                                    <p className="text-xs text-gray-400">No funded proposals</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 max-h-[calc(100vh-240px)] overflow-y-auto">
                                    {filtered.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => selectProposal(p)}
                                            className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-start gap-3 border-l-2 ${selected?.id === p.id ? 'bg-slate-50 border-slate-900' : 'border-transparent'}`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-xs font-bold text-emerald-700">{p.tracker_number}</span>
                                                </div>
                                                <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{p.title}</p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <User size={10} className="text-gray-400" />
                                                    <span className="text-xs text-gray-500">{p.pi?.name}</span>
                                                </div>
                                                {p.award?.awarded_amount && (
                                                    <div className="mt-1 text-xs font-semibold text-emerald-700">
                                                        ETB {parseFloat(p.award.awarded_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </div>
                                                )}
                                            </div>
                                            <ChevronRight size={14} className={`shrink-0 mt-1 ${selected?.id === p.id ? 'text-slate-900' : 'text-gray-300'}`} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {currentHtml && !templateLocked && (
                            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-1">
                                <p className="text-xs font-semibold text-blue-700">Editing tips</p>
                                <p className="text-xs text-blue-600">• Click any text to edit it — hover to see editable areas highlighted</p>
                                <p className="text-xs text-blue-600">• Edit letterhead names, address, Amharic text directly on the letter</p>
                                <p className="text-xs text-blue-600">• Click the seal / logo area to upload a logo image</p>
                                <p className="text-xs text-blue-600">• Click the stamp circle to upload a stamp image</p>
                                <p className="text-xs text-blue-600">• Edit footer fax, email, Amharic directly at the bottom</p>
                                <p className="text-xs text-blue-600">• When satisfied, click "Approve Template" to print all letters</p>
                            </div>
                        )}
                    </div>

                    {/* Right: A4 letter preview */}
                    <div className="flex-1 flex justify-center overflow-x-auto">
                        {!currentHtml ? (
                            <div className="w-full max-w-2xl flex flex-col items-center justify-center py-32 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400">
                                <FileText size={40} className="mb-4 opacity-30" />
                                <p className="text-sm font-medium">Select a funded proposal</p>
                                <p className="text-xs mt-1">The letter will appear here for editing</p>
                            </div>
                        ) : (
                            <div style={{
                                boxShadow: '0 8px 48px rgba(0,0,0,0.18)',
                                transform: 'scale(0.82)',
                                transformOrigin: 'top center',
                                marginBottom: '-230px',
                                opacity: templateLocked ? 0.5 : 1,
                                pointerEvents: templateLocked ? 'none' : 'auto',
                                transition: 'opacity 0.2s',
                            }}>
                                <LetterCanvas
                                    key={selected?.id}
                                    html={currentHtml}
                                    onMount={handleCanvasMount}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden file inputs for logo and stamp */}
            <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFile}
            />
            <input
                ref={stampInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleStampFile}
            />

            </div>{/* end lg:block */}
        </AppLayout>
    );
}
